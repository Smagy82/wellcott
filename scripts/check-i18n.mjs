#!/usr/bin/env node
/**
 * check-i18n.mjs — i18n key audit
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *
 * Checks:
 *   1. Keys used in code but MISSING from en.json  → renders as raw key string (bug)
 *   2. Keys in en.json but UNUSED in code          → dead translations (clutter)
 *   3. Keys in en.json but MISSING from es.json    → missing stubs (fallback gap)
 *
 * Detection strategy (avoids false positives):
 *   - List 1 (missing): scans t() call spans for all quoted strings + template prefixes
 *   - List 2 (unused):  scans ALL string literals in source matching a known namespace
 *     so indirect uses like `labelKey: 'tabs.map'` and t(cond?'a':'b') are found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

const SCAN_DIRS = ['app', 'src'];
const FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectSourceFiles(dir) {
  const results = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return results;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (FILE_EXTS.includes(path.extname(entry.name))) results.push(full);
    }
  };
  walk(abs);
  return results;
}

function flattenJson(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenJson(v, full));
    } else {
      result[full] = v;
    }
  }
  return result;
}

// ── Load locales ──────────────────────────────────────────────────────────────

const EN_PATH = path.join(ROOT, 'src/i18n/locales/en.json');
const ES_PATH = path.join(ROOT, 'src/i18n/locales/es.json');

const enRaw  = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const enFlat = flattenJson(enRaw);
const esFlat = flattenJson(JSON.parse(fs.readFileSync(ES_PATH, 'utf8')));

const enKeys = new Set(Object.keys(enFlat));
const esKeys = new Set(Object.keys(esFlat));

// Top-level namespaces (e.g. "common", "tabs", "mh", …)
const NAMESPACES = new Set(Object.keys(enRaw));

// ── Extract keys used in code ─────────────────────────────────────────────────

/**
 * LIST 1 source: extract all string literals inside t(…) call spans.
 * Handles:
 *   t('key')                           → direct
 *   t("key")                           → direct
 *   t(x ? 'key1' : 'key2', opts)       → ternary — both keys found
 *   t(cond ? 'a' : t('b'))             → nested (rare, still works)
 *
 * Also detects template-literal prefixes: t(`prefix.${…}`) →
 * marks ALL en.json keys that start with "prefix." as used.
 */
function extractKeysFromTCalls(content) {
  const found = new Set();
  const prefixes = new Set(); // from template literals

  // Walk character-by-character to find balanced t(…) spans
  let i = 0;
  while (i < content.length - 1) {
    // Look for t( not preceded by a word character
    if (content[i] === 't' && content[i + 1] === '(' &&
        (i === 0 || !/\w/.test(content[i - 1]))) {
      let depth = 0;
      let spanStart = i + 1;
      let spanEnd = -1;
      for (let j = spanStart; j < content.length; j++) {
        if (content[j] === '(') depth++;
        else if (content[j] === ')') {
          depth--;
          if (depth === 0) { spanEnd = j; break; }
        }
      }
      if (spanEnd !== -1) {
        const span = content.slice(spanStart + 1, spanEnd);

        // All quoted string literals inside the span
        const strRe = /['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g;
        let m;
        while ((m = strRe.exec(span)) !== null) {
          if (m[1].includes('.')) found.add(m[1]);
        }

        // Template literal prefixes: `ns.sub.${…}`
        const tplRe = /`([a-zA-Z][a-zA-Z0-9_.]*)\$\{/g;
        while ((m = tplRe.exec(span)) !== null) {
          if (m[1].includes('.')) prefixes.add(m[1]);
        }

        i = spanEnd + 1;
        continue;
      }
    }
    i++;
  }

  // Also scan for bare template literals that call t outside the span walker
  // e.g.  t(`help.cat_${item}`)  — catch the prefix
  const tplDirectRe = /\bt\(`([a-zA-Z][a-zA-Z0-9_.]*)\$\{/g;
  let m;
  while ((m = tplDirectRe.exec(content)) !== null) {
    if (m[1].includes('.')) prefixes.add(m[1]);
  }

  return { found, prefixes };
}

/**
 * LIST 2 source: ALL string literals in the source that look like i18n keys,
 * plus template literal prefixes found ANYWHERE (not just inside t() spans).
 *
 * This catches indirect patterns such as:
 *   labelKey: 'tabs.map'                    (object property, tabs layout)
 *   const catKey = `help.cat_${x}`; t(key)  (prefix assigned to variable)
 *   const key = 'mh.noNearby'; t(key)       (key stored in variable)
 *   keys stored in arrays/objects
 *
 * Returns { found: Set<string>, prefixes: Set<string> }
 */
function extractAllKeyLiterals(content, namespaces) {
  const found    = new Set();
  const prefixes = new Set();

  // Complete key literals: 'ns.key' or "ns.key" anywhere in source
  const strRe = /['"]([a-zA-Z][a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g;
  let m;
  while ((m = strRe.exec(content)) !== null) {
    const key = m[1];
    if (namespaces.has(key.split('.')[0])) found.add(key);
  }

  // Template literal prefixes anywhere in source: `ns.sub.${…}` → prefix "ns.sub."
  // Catches: const key = `help.cat_${x}` even outside t()
  const tplRe = /`([a-zA-Z][a-zA-Z0-9_]+\.[a-zA-Z0-9_.]*)\$\{/g;
  while ((m = tplRe.exec(content)) !== null) {
    const prefix = m[1];
    if (namespaces.has(prefix.split('.')[0])) prefixes.add(prefix);
  }

  return { found, prefixes };
}

// ── Scan all source files ─────────────────────────────────────────────────────

// For List 1: keys inside t() calls
const tCallKeys  = new Set();   // direct string literals in t() spans
const tCallPrefixes = new Set(); // template literal prefixes

// For List 2: all key-shaped string literals
const allLiterals = new Set();

const keyLocations = {};

for (const dir of SCAN_DIRS) {
  for (const file of collectSourceFiles(dir)) {
    const content = fs.readFileSync(file, 'utf8');

    // List 1 extraction
    const { found, prefixes } = extractKeysFromTCalls(content);
    for (const k of found) {
      tCallKeys.add(k);
      const loc = path.relative(ROOT, file);
      if (!keyLocations[k]) keyLocations[k] = new Set();
      keyLocations[k].add(loc);
    }
    for (const p of prefixes) tCallPrefixes.add(p);

    // List 2 extraction
    const { found: litFound, prefixes: litPrefixes } = extractAllKeyLiterals(content, NAMESPACES);
    for (const k of litFound) allLiterals.add(k);
    for (const p of litPrefixes) tCallPrefixes.add(p); // merge into shared prefix set
  }
}

// Expand prefix matches into full key sets
const prefixMatchedKeys = new Set();
for (const prefix of tCallPrefixes) {
  for (const enKey of enKeys) {
    if (enKey.startsWith(prefix)) prefixMatchedKeys.add(enKey);
  }
}

// ── Compute three lists ────────────────────────────────────────────────────────

// List 1: used inside t() (direct + ternary + prefix-expanded) but missing from en.json
const usedInTCalls = new Set([...tCallKeys, ...prefixMatchedKeys]);
const missingFromEn = [...tCallKeys]
  .filter((k) => !enKeys.has(k) && !k.startsWith('_'))
  .sort();

// List 2: in en.json, not found anywhere in source (not even as a string literal)
const unusedInCode = [...enKeys]
  .filter((k) => !allLiterals.has(k) && !prefixMatchedKeys.has(k))
  .sort();

// List 3: in en.json, missing from es.json
const missingFromEs = [...enKeys]
  .filter((k) => !esKeys.has(k))
  .sort();

// ── Report ─────────────────────────────────────────────────────────────────────

const RED   = '\x1b[31m';
const YEL   = '\x1b[33m';
const GRN   = '\x1b[32m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

function section(title, color, items, showLoc = false) {
  console.log(`\n${color}${BOLD}── ${title} (${items.length}) ──${RESET}`);
  if (items.length === 0) {
    console.log(`${GRN}  ✓ none${RESET}`);
  } else {
    for (const k of items) {
      const locs = keyLocations[k] ? [...keyLocations[k]] : [];
      const locStr = showLoc && locs.length
        ? `  ${DIM}← ${locs.slice(0, 2).join(', ')}${locs.length > 2 ? ` +${locs.length - 2}` : ''}${RESET}`
        : '';
      console.log(`  ${color}${k}${RESET}${locStr}`);
    }
  }
}

const totalUsed     = allLiterals.size;
const totalEn       = enKeys.size;
const totalEs       = esKeys.size;

console.log(`\n${BOLD}i18n key audit${RESET}  ${DIM}(${totalUsed} key-shaped literals in source · ${totalEn} keys in en.json · ${totalEs} keys in es.json)${RESET}`);
console.log(`${DIM}  Template prefixes detected: [${[...tCallPrefixes].join(', ')}]${RESET}`);

section('MISSING FROM en.json — renders as raw key string (BUG)', RED, missingFromEn, true);
section('IN en.json BUT UNUSED IN CODE — candidate for removal', YEL, unusedInCode);
section('IN en.json BUT MISSING FROM es.json — add empty stub', YEL, missingFromEs);

const exitCode = missingFromEn.length > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? GRN + '✓ No critical issues' : RED + '✗ Critical: ' + missingFromEn.length + ' key(s) missing from en.json'}${RESET}\n`);
process.exit(exitCode);
