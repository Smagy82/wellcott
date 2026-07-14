#!/usr/bin/env node
/**
 * check-i18n.mjs — i18n key audit
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *
 * Checks:
 *   1. Keys used in code but MISSING from en.json  → rendered as raw key string (bug)
 *   2. Keys in en.json but UNUSED in code          → dead translations (clutter)
 *   3. Keys in en.json but MISSING from es.json    → missing stubs (fallback gap)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 1. Extract all t('...') keys from source ────────────────────────────────

const SCAN_DIRS = ['app', 'src'];
const FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

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

// Match both t('key') and t("key"), including keys with dots and brackets
// e.g. t('common.call'), t('mh.nearbyCount', {...}), t("favorites.title")
const KEY_RE = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]/g;

const usedKeys = new Set();
const keyLocations = {}; // key → [file:line, ...]

for (const dir of SCAN_DIRS) {
  for (const file of collectSourceFiles(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      let m;
      const re = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]/g;
      while ((m = re.exec(line)) !== null) {
        const key = m[1];
        usedKeys.add(key);
        const loc = `${path.relative(ROOT, file)}:${idx + 1}`;
        if (!keyLocations[key]) keyLocations[key] = [];
        keyLocations[key].push(loc);
      }
    });
  }
}

// ── 2. Flatten JSON locale files ─────────────────────────────────────────────

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

const EN_PATH = path.join(ROOT, 'src/i18n/locales/en.json');
const ES_PATH = path.join(ROOT, 'src/i18n/locales/es.json');

const enFlat = flattenJson(JSON.parse(fs.readFileSync(EN_PATH, 'utf8')));
const esFlat = flattenJson(JSON.parse(fs.readFileSync(ES_PATH, 'utf8')));

const enKeys = new Set(Object.keys(enFlat));
const esKeys = new Set(Object.keys(esFlat));

// ── 3. Compute three lists ────────────────────────────────────────────────────

// List 1: used in code, missing from en.json
const missingFromEn = [...usedKeys]
  .filter((k) => !enKeys.has(k))
  .sort();

// List 2: in en.json, never used in code
// Exclude keys that are used as namespace prefixes (e.g. key 'common' itself isn't referenced)
const unusedInCode = [...enKeys]
  .filter((k) => !usedKeys.has(k))
  .sort();

// List 3: in en.json, missing from es.json (even as empty stub)
const missingFromEs = [...enKeys]
  .filter((k) => !esKeys.has(k))
  .sort();

// ── 4. Report ─────────────────────────────────────────────────────────────────

const RED   = '\x1b[31m';
const YEL   = '\x1b[33m';
const GRN   = '\x1b[32m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

function section(title, color, items, detail = false) {
  console.log(`\n${color}${BOLD}── ${title} (${items.length}) ──${RESET}`);
  if (items.length === 0) {
    console.log(`${GRN}  ✓ none${RESET}`);
  } else {
    for (const k of items) {
      if (detail && keyLocations[k]) {
        console.log(`  ${color}${k}${RESET}  ${DIM}← used at: ${keyLocations[k].slice(0, 2).join(', ')}${keyLocations[k].length > 2 ? ` +${keyLocations[k].length - 2} more` : ''}${RESET}`);
      } else {
        console.log(`  ${color}${k}${RESET}`);
      }
    }
  }
}

console.log(`\n${BOLD}i18n key audit${RESET}  ${DIM}(${usedKeys.size} keys used in code, ${enKeys.size} keys in en.json, ${esKeys.size} keys in es.json)${RESET}`);

section('MISSING FROM en.json — renders as raw key string (BUG)', RED, missingFromEn, true);
// NOTE: dynamic keys like t(`section.${var}`) or t(cond ? 'a' : 'b') are NOT detected
// by this static grep. Many "unused" entries below may be false positives.
section('IN en.json BUT UNUSED IN CODE — dead translations (⚠ dynamic keys not detected)', YEL, unusedInCode);
section('IN en.json BUT MISSING FROM es.json — no fallback stub', YEL, missingFromEs);

const exitCode = missingFromEn.length > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? GRN + '✓ No critical issues' : RED + '✗ Critical issues found'}${RESET}\n`);
process.exit(exitCode);
