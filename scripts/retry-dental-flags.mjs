/**
 * scripts/retry-dental-flags.mjs
 *
 * Повторный прогон ТОЛЬКО по сайтам, где dental_signal='unknown' и есть валидный URL.
 * Успешные результаты прошлого прогона НЕ перезаписываются.
 * Если сайт снова не ответил — строка остаётся 'unknown'.
 *
 * Мягче первого прогона: таймаут 25с, 3 воркера, задержка 500мс, 2 попытки на сайт.
 *
 * Запуск:
 *   node scripts/retry-dental-flags.mjs
 *   LIMIT=30 node scripts/retry-dental-flags.mjs   — только первые N уникальных сайтов
 *   COUNT_ONLY=1 node scripts/retry-dental-flags.mjs
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { canonicalize, toFetchUrls, analyzeHtml } from './lib/dental-signals.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dir, '../assets/clinics-v6.db');

const TIMEOUT_MS   = 25_000;
const MAX_WORKERS  = 3;
const DELAY_MS     = 500;
const RETRY_PAUSE  = 3_000;
const MAX_RETRIES  = 2;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const LIMIT      = process.env.LIMIT ? parseInt(process.env.LIMIT) : null;
const COUNT_ONLY = process.env.COUNT_ONLY === '1';
const CHECKED_AT = new Date().toISOString().slice(0, 10);

// ── Fetch with https→http fallback + per-site retry ──────────────────────────

async function fetchSite(canon) {
  for (const url of toFetchUrls(canon)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' },
      });
      clearTimeout(timer);
      if (resp.ok) return { ok: true, html: await resp.text() };
    } catch {
      clearTimeout(timer);
    }
  }
  return { ok: false };
}

async function fetchWithRetry(canon) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_PAUSE));
    const result = await fetchSite(canon);
    if (result.ok) return result;
  }
  return { ok: false };
}

// ── Simple semaphore ──────────────────────────────────────────────────────────

function makeSemaphore(limit) {
  let running = 0;
  const queue = [];
  return function acquire() {
    return new Promise(resolve => {
      const tryRun = () => {
        if (running < limit) { running++; resolve(() => { running--; if (queue.length) queue.shift()(); }); }
        else queue.push(tryRun);
      };
      tryRun();
    });
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);

// Select only clinics where last attempt failed and site looks valid
const failing = db.prepare(`
  SELECT id, website
  FROM clinics
  WHERE dental_signal = 'unknown'
    AND website IS NOT NULL
    AND trim(lower(website)) NOT IN ('', 'n/a', 'na', 'none', '-')
    AND length(trim(website)) > 4
    AND website LIKE '%.%'
`).all();

// Dedup by canonical domain
const canonMap = new Map(); // canon → [id, ...]
for (const { id, website } of failing) {
  const c = canonicalize(website);
  if (!c) continue;
  if (!canonMap.has(c)) canonMap.set(c, []);
  canonMap.get(c).push(id);
}

let sites = [...canonMap.entries()];
if (LIMIT) sites = sites.slice(0, LIMIT);

console.log(`\n${'─'.repeat(70)}`);
console.log('retry-dental-flags.mjs');
console.log(`  Clinics in unknown w/ valid site: ${failing.length}`);
console.log(`  Unique canonical sites to retry:  ${canonMap.size}`);
console.log(`  Sites this run:                   ${sites.length}${LIMIT ? ` (LIMIT=${LIMIT})` : ''}`);
console.log(`  Timeout: ${TIMEOUT_MS/1000}s  Workers: ${MAX_WORKERS}  Delay: ${DELAY_MS}ms  Retries: ${MAX_RETRIES}`);
if (COUNT_ONLY) { console.log('\n  COUNT_ONLY=1 — exiting.'); db.close(); process.exit(0); }
console.log(`${'─'.repeat(70)}\n`);

const stmtUpdate = db.prepare(
  "UPDATE clinics SET dental_signal=?, dental_checked_at=? WHERE id=?",
);
const markBatch = db.transaction((signal, ids) => {
  for (const id of ids) stmtUpdate.run(signal, CHECKED_AT, id);
});

const sem = makeSemaphore(MAX_WORKERS);

let done = 0;
let successCount = 0;
let failCount = 0;
const signalCounts = { strong: 0, medium: 0, none: 0 };
const doubleFailedDomains = [];

const tasks = sites.map(([canon, ids], idx) => async () => {
  // Stagger starts: spread across DELAY_MS window so workers don't all launch at once
  await new Promise(r => setTimeout(r, Math.floor(idx * (DELAY_MS / MAX_WORKERS))));
  const release = await sem();
  try {
    const result = await fetchWithRetry(canon);
    done++;

    if (result.ok) {
      const signal = analyzeHtml(result.html);
      markBatch(signal, ids);
      signalCounts[signal]++;
      successCount++;
    } else {
      // Site still unreachable — leave as 'unknown', just track it
      failCount++;
      doubleFailedDomains.push({ canon, clinics: ids.length });
    }

    const pct = ((done / sites.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(done / sites.length * 20));
    const icon = result.ok ? '✓' : '✗';
    process.stdout.write(
      `\r  [${bar.padEnd(20)}] ${pct}% (${done}/${sites.length})  ${icon} ${canon.slice(0, 40).padEnd(40)}`
    );

    // Polite delay after each request before releasing the worker slot
    await new Promise(r => setTimeout(r, DELAY_MS));
  } finally {
    release();
  }
});

await Promise.all(tasks.map(t => t()));
console.log('\n');

// ── Final stats ───────────────────────────────────────────────────────────────

const afterRows = db.prepare(
  'SELECT dental_signal, count(*) as n FROM clinics GROUP BY dental_signal'
).all();
db.close();

console.log('─'.repeat(60));
console.log('RETRY DONE');
console.log('─'.repeat(60));
console.log(`  Sites attempted:     ${sites.length}`);
console.log(`  Succeeded:           ${successCount}`);
console.log(`  Still failed:        ${failCount}`);
console.log();
console.log('  Newly resolved signals (from unknown):');
for (const [k, v] of Object.entries(signalCounts)) {
  if (v > 0) console.log(`    ${k.padEnd(8)}  ${v} sites → ${v} orgs`);
}
console.log();
console.log('  DB distribution after retry:');
for (const { dental_signal, n } of afterRows) {
  console.log(`    ${(dental_signal ?? 'NULL').padEnd(10)}  ${n}`);
}

// Top-10 double-failed domains
if (doubleFailedDomains.length > 0) {
  const top10 = doubleFailedDomains
    .sort((a, b) => b.clinics - a.clinics)
    .slice(0, 10);
  console.log('\n  Top-10 double-failed domains (likely dead sites):');
  for (const { canon, clinics } of top10) {
    console.log(`    ${canon.slice(0, 55).padEnd(55)}  (${clinics} locations)`);
  }
}
console.log();
