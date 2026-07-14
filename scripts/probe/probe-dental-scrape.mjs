/**
 * scripts/probe/probe-dental-scrape.mjs
 *
 * РАЗВЕДКА: проверяем гипотезу "dental presence можно определить по сайту FQHC".
 * Ничего не пишет в базу. Только читает clinics-v5.db и делает HTTP GET.
 *
 * Запуск: node scripts/probe/probe-dental-scrape.mjs
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dir, '../../assets/clinics-v5.db');

const TIMEOUT_MS = 10_000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ── Signal patterns ───────────────────────────────────────────────────────────

// Noise — match these first and EXCLUDE from signal counting
const NOISE_RES = [
  /dental\s+insurance/gi,
  /dental\s+coverage/gi,
  /no\s+dental/gi,
  /dental\s+not\s+offered/gi,
];

// Strong: almost certainly has dental services
const STRONG_RES = [
  { re: /href="[^"]*dental[^"]*"/gi,        label: 'href=*dental*' },
  { re: /href="[^"]*oral-health[^"]*"/gi,   label: 'href=*oral-health*' },
  { re: /dental\s+services/gi,              label: 'dental services' },
  { re: /dental\s+care/gi,                  label: 'dental care' },
  { re: /oral\s+health\s+services/gi,       label: 'oral health services' },
];

// Medium: likely but not certain
const MEDIUM_RES = [
  { re: /\bdentist\b/gi,     label: 'dentist' },
  { re: /\bdentistry\b/gi,   label: 'dentistry' },
  { re: /\boral\s+health\b/gi, label: 'oral health' },
];

function normalizeUrl(url) {
  if (!url) return null;
  const s = url.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function extractDomain(url) {
  try {
    return new URL(normalizeUrl(url) ?? url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function analyzeHtml(html) {
  // Strip noise first — replace noise matches with placeholder
  let cleaned = html;
  for (const re of NOISE_RES) {
    cleaned = cleaned.replace(re, ' __NOISE__ ');
  }

  const strongHits = [];
  for (const { re, label } of STRONG_RES) {
    const matches = [...cleaned.matchAll(re)];
    if (matches.length) strongHits.push({ label, count: matches.length });
  }

  const mediumHits = [];
  for (const { re, label } of MEDIUM_RES) {
    const matches = [...cleaned.matchAll(re)];
    if (matches.length) mediumHits.push({ label, count: matches.length });
  }

  return { strongHits, mediumHits };
}

function verdict(strongHits, mediumHits, fetchFailed) {
  if (fetchFailed) return 'FETCH_FAILED';
  if (strongHits.length > 0) return 'HAS_DENTAL';
  if (mediumHits.length > 0) return 'UNCLEAR';
  return 'NO_DENTAL';
}

/** Extract up to `n` context snippets (±100 chars) for a regex in raw html */
function extractContexts(html, re, n = 2) {
  const results = [];
  let cleaned = html;
  for (const noise of NOISE_RES) cleaned = cleaned.replace(noise, ' __NOISE__ ');

  re.lastIndex = 0;
  let m;
  while ((m = re.exec(cleaned)) !== null && results.length < n) {
    const start = Math.max(0, m.index - 100);
    const end   = Math.min(cleaned.length, m.index + m[0].length + 100);
    const snippet = cleaned.slice(start, end).replace(/\s+/g, ' ').trim();
    results.push(snippet);
  }
  return results;
}

// ── Clinic selection ──────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

const TARGET_STATES = ['CA', 'TX', 'NY', 'FL', 'IN', 'MT', 'WY', 'MS', 'AK', 'HI'];

const selected = [];
const usedDomains = new Set();

// 10 from specific states — pick one per state, avoid same domain
for (const state of TARGET_STATES) {
  const rows = db.prepare(
    'SELECT id, name, state, website FROM clinics WHERE state = ? AND website IS NOT NULL ORDER BY RANDOM()',
  ).all(state);

  for (const row of rows) {
    const domain = extractDomain(row.website);
    if (!usedDomains.has(domain)) {
      usedDomains.add(domain);
      selected.push(row);
      break;
    }
  }
}

// 10 random from remainder — different domains
const random = db.prepare(
  'SELECT id, name, state, website FROM clinics WHERE website IS NOT NULL ORDER BY RANDOM() LIMIT 200',
).all();

for (const row of random) {
  if (selected.length >= 20) break;
  if (selected.some(s => s.id === row.id)) continue;
  const domain = extractDomain(row.website);
  if (usedDomains.has(domain)) continue;
  usedDomains.add(domain);
  selected.push(row);
}

db.close();

console.log(`\n${'─'.repeat(80)}`);
console.log('PROBE: dental presence via website scrape');
console.log(`Selected ${selected.length} clinics (${TARGET_STATES.length} state-specific + ${selected.length - TARGET_STATES.length} random)`);
console.log(`${'─'.repeat(80)}\n`);

// ── Fetch + analyze ───────────────────────────────────────────────────────────

const results = [];
const timings = [];

// Pick 5 for context display: first 3 state-specific + 2 random
const CONTEXT_IDS = new Set([
  selected[0]?.id, selected[2]?.id, selected[4]?.id,
  selected[11]?.id, selected[15]?.id,
].filter(Boolean));

for (const clinic of selected) {
  const label = `[${clinic.state}] ${clinic.name.slice(0, 40)}`;
  process.stdout.write(`  Fetching ${label}… `);

  const fetchUrl = normalizeUrl(clinic.website);

  const t0 = Date.now();
  let html = null;
  let httpStatus = null;
  let fetchFailed = !fetchUrl;
  let failReason = fetchUrl ? '' : 'empty url';

  if (!fetchUrl) {
    timings.push(0);
    results.push({ clinic, httpStatus: null, fetchFailed: true, failReason, strongHits: [], mediumHits: [], v: 'FETCH_FAILED', contexts: [], elapsed: 0 });
    console.log('FETCH_FAILED (empty url)');
    continue;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(fetchUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.8' },
    });
    clearTimeout(timer);
    httpStatus = resp.status;
    if (resp.ok) {
      html = await resp.text();
    } else {
      fetchFailed = true;
      failReason = `HTTP ${resp.status}`;
    }
  } catch (err) {
    fetchFailed = true;
    failReason = err.name === 'AbortError' ? 'timeout' : String(err.message).slice(0, 60);
  }

  const elapsed = Date.now() - t0;
  timings.push(elapsed);

  let strongHits = [], mediumHits = [], contexts = [];

  if (html) {
    ({ strongHits, mediumHits } = analyzeHtml(html));

    // Context snippets for selected clinics
    if (CONTEXT_IDS.has(clinic.id)) {
      for (const { re, label: sigLabel } of [...STRONG_RES, ...MEDIUM_RES]) {
        re.lastIndex = 0;
        const snips = extractContexts(html, re);
        if (snips.length) contexts.push({ signal: sigLabel, snippets: snips });
        if (contexts.length >= 3) break;
      }
    }
  }

  const v = verdict(strongHits, mediumHits, fetchFailed);
  const statusStr = fetchFailed ? failReason : `${httpStatus}`;

  console.log(`${v} (${elapsed}ms, ${statusStr})`);

  results.push({ clinic, httpStatus, fetchFailed, failReason, strongHits, mediumHits, v, contexts, elapsed });
}

// ── Results table ─────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(100)}`);
console.log('RESULTS TABLE');
console.log('═'.repeat(100));

const COL = { id: 8, name: 36, st: 4, status: 8, strong: 8, medium: 8, verdict: 14 };
const hdr = [
  'id'.padEnd(COL.id),
  'name'.padEnd(COL.name),
  'st'.padEnd(COL.st),
  'status'.padEnd(COL.status),
  'strong'.padEnd(COL.strong),
  'medium'.padEnd(COL.medium),
  'verdict',
].join(' │ ');
console.log(hdr);
console.log('─'.repeat(hdr.length));

for (const r of results) {
  const strongStr = r.strongHits.map(h => h.label).join(', ').slice(0, 28) || '—';
  const mediumStr = r.mediumHits.map(h => h.label).join(', ').slice(0, 28) || '—';
  const statusStr = r.fetchFailed ? r.failReason.slice(0, 7) : String(r.httpStatus);
  console.log([
    r.clinic.id.slice(0, COL.id).padEnd(COL.id),
    r.clinic.name.slice(0, COL.name).padEnd(COL.name),
    r.clinic.state.padEnd(COL.st),
    statusStr.padEnd(COL.status),
    strongStr.padEnd(COL.strong),
    mediumStr.padEnd(COL.medium),
    r.v,
  ].join(' │ '));
}

// ── Verdict summary ───────────────────────────────────────────────────────────

const counts = { HAS_DENTAL: 0, NO_DENTAL: 0, UNCLEAR: 0, FETCH_FAILED: 0 };
for (const r of results) counts[r.v]++;

console.log('\n' + '─'.repeat(50));
console.log('SUMMARY (n = ' + results.length + ')');
console.log('─'.repeat(50));
for (const [k, v] of Object.entries(counts)) {
  const pct = ((v / results.length) * 100).toFixed(0);
  const bar = '█'.repeat(Math.round(v * 2));
  console.log(`  ${k.padEnd(14)} ${String(v).padStart(2)} / ${results.length}  ${pct.padStart(3)}%  ${bar}`);
}

// ── Context fragments ─────────────────────────────────────────────────────────

const withContext = results.filter(r => r.contexts.length > 0);
if (withContext.length > 0) {
  console.log('\n' + '═'.repeat(80));
  console.log('CONTEXT FRAGMENTS — manual false-positive check');
  console.log('(5 clinics, ≤3 signals each, ±100 chars around match)');
  console.log('═'.repeat(80));

  for (const r of withContext) {
    console.log(`\n► [${r.clinic.state}] ${r.clinic.name}`);
    console.log(`  ${r.clinic.website}`);
    console.log(`  Verdict: ${r.v}`);
    for (const ctx of r.contexts) {
      console.log(`  Signal: "${ctx.signal}"`);
      for (const snip of ctx.snippets) {
        console.log(`    …${snip}…`);
      }
    }
  }
}

// ── Timing estimate ───────────────────────────────────────────────────────────

const successTimings = timings.filter((_, i) => !results[i].fetchFailed);
const avgMs = successTimings.length
  ? Math.round(successTimings.reduce((a, b) => a + b, 0) / successTimings.length)
  : null;
const TOTAL_SITES = 10_320;

console.log('\n' + '─'.repeat(50));
console.log('TIMING ESTIMATE');
console.log('─'.repeat(50));
console.log(`  Successful fetches: ${successTimings.length} / ${timings.length}`);
if (avgMs !== null) {
  console.log(`  Avg per request:    ${avgMs} ms`);
  const seqSec  = Math.round((avgMs * TOTAL_SITES) / 1000);
  const seqMin  = Math.round(seqSec / 60);
  // Realistic: ~10 concurrent, plus some will fail fast
  const concMin = Math.round(seqMin / 10);
  console.log(`  Sequential est.:    ${seqMin} min (${seqSec}s) for ${TOTAL_SITES.toLocaleString()} sites`);
  console.log(`  Concurrent (×10):   ~${concMin} min`);
}

console.log('\n' + '─'.repeat(50));
console.log('HYPOTHESIS CHECK');
console.log('─'.repeat(50));
const detectable = counts.HAS_DENTAL + counts.NO_DENTAL;
const detPct = ((detectable / results.length) * 100).toFixed(0);
console.log(`  Clear signal (HAS or NO): ${detectable} / ${results.length}  (${detPct}%)`);
console.log(`  FETCH_FAILED rate:        ${counts.FETCH_FAILED} / ${results.length}`);
console.log();
if (counts.FETCH_FAILED >= 8) {
  console.log('  ⚠  HIGH FAILURE RATE — scraping likely blocked. Hypothesis probably not viable at scale.');
} else if (counts.HAS_DENTAL >= 5) {
  console.log('  ✓  Positive signal: dental pages are detectable on a meaningful share of sites.');
  console.log('     Worth running full probe (probe-dental-full.mjs) before deciding.');
} else {
  console.log('  ✗  Weak signal: dental presence not reliably detectable from HTML alone.');
  console.log('     Consider alternative: HRSA UDS service-level data API (if exists) or SAMHSA.');
}
console.log();
