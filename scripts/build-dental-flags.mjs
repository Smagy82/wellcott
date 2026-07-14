/**
 * scripts/build-dental-flags.mjs
 *
 * Скрейпит уникальные сайты клиник и проставляет dental_signal в clinics-v6.db.
 * Organization-level сигнал: один сайт = все адреса этой организации.
 *
 * Запуск:
 *   node scripts/build-dental-flags.mjs              — полный прогон
 *   LIMIT=50 node scripts/build-dental-flags.mjs     — только первые 50 уникальных сайтов
 *   COUNT_ONLY=1 node scripts/build-dental-flags.mjs — только статистика, без HTTP
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { canonicalize, toFetchUrls, analyzeHtml } from './lib/dental-signals.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dir, '../assets/clinics-v6.db');

const TIMEOUT_MS   = 10_000;
const MAX_WORKERS  = 5;
const DELAY_MS     = 200;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const LIMIT      = process.env.LIMIT      ? parseInt(process.env.LIMIT)  : null;
const COUNT_ONLY = process.env.COUNT_ONLY === '1';
const CHECKED_AT = new Date().toISOString().slice(0, 10);

// ── Fetch with https→http fallback ────────────────────────────────────────────

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
      if (resp.ok) {
        const html = await resp.text();
        return { ok: true, html };
      }
      // 4xx/5xx on https — still try http
    } catch {
      clearTimeout(timer);
    }
  }
  return { ok: false };
}

// ── Simple semaphore for concurrency control ──────────────────────────────────

function makeSemaphore(limit) {
  let running = 0;
  const queue = [];
  return function acquire() {
    return new Promise(resolve => {
      const tryRun = () => {
        if (running < limit) {
          running++;
          resolve(() => {
            running--;
            if (queue.length) queue.shift()();
          });
        } else {
          queue.push(tryRun);
        }
      };
      tryRun();
    });
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);

// Collect ALL clinics (including website IS NULL so they're marked unknown)
const rows = db.prepare('SELECT id, website FROM clinics').all();

const canonMap = new Map(); // canon → [id, ...]
for (const { id, website } of rows) {
  const c = canonicalize(website);
  if (!c) continue;
  if (!canonMap.has(c)) canonMap.set(c, []);
  canonMap.get(c).push(id);
}

// Clinics with no valid site → mark unknown immediately
const allIds = new Set(rows.map(r => r.id));
const mappedIds = new Set([...canonMap.values()].flat());
const noSiteIds = rows.filter(r => !mappedIds.has(r.id)).map(r => r.id);

let sites = [...canonMap.entries()]; // [canon, ids[]]
if (LIMIT) sites = sites.slice(0, LIMIT);

console.log(`\n${'─'.repeat(70)}`);
console.log('build-dental-flags.mjs');
console.log(`  Total clinics:          ${rows.length}`);
console.log(`  No valid website:       ${noSiteIds.length} → dental_signal='unknown'`);
console.log(`  Unique canonical sites: ${canonMap.size}`);
console.log(`  Sites to scrape:        ${sites.length}${LIMIT ? ` (LIMIT=${LIMIT})` : ''}`);
console.log(`  Max workers:            ${MAX_WORKERS}`);
console.log(`  Delay between:          ${DELAY_MS}ms`);
if (COUNT_ONLY) console.log('\n  COUNT_ONLY=1 — exiting without HTTP requests.');
console.log(`${'─'.repeat(70)}\n`);

if (COUNT_ONLY) { db.close(); process.exit(0); }

// Mark no-site clinics
const stmtUnknown = db.prepare(
  "UPDATE clinics SET dental_signal='unknown', dental_checked_at=? WHERE id=?",
);
const markUnknown = db.transaction((ids) => {
  for (const id of ids) stmtUnknown.run(CHECKED_AT, id);
});
markUnknown(noSiteIds);
console.log(`Marked ${noSiteIds.length} clinics without valid website as 'unknown'.`);

// Prepare update statement
const stmtUpdate = db.prepare(
  "UPDATE clinics SET dental_signal=?, dental_checked_at=? WHERE id=?",
);
const markBatch = db.transaction((signal, ids) => {
  for (const id of ids) stmtUpdate.run(signal, CHECKED_AT, id);
});

// Scrape with concurrency control
const sem = makeSemaphore(MAX_WORKERS);

let done = 0;
let successCount = 0;
let failCount = 0;
const signalCounts = { strong: 0, medium: 0, none: 0, unknown: 0 };

const tasks = sites.map(([canon, ids], idx) => async () => {
  // Stagger launches slightly to respect DELAY_MS across workers
  await new Promise(r => setTimeout(r, idx * (DELAY_MS / MAX_WORKERS)));
  const release = await sem();
  try {
    const result = await fetchSite(canon);
    const signal = result.ok ? analyzeHtml(result.html) : 'unknown';
    markBatch(signal, ids);
    signalCounts[signal]++;
    if (result.ok) successCount++; else failCount++;
    done++;

    const pct = ((done / sites.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(done / sites.length * 20));
    const sigIcon = signal === 'strong' ? '✓' : signal === 'medium' ? '~' : signal === 'unknown' ? '✗' : '○';
    process.stdout.write(`\r  [${bar.padEnd(20)}] ${pct}% (${done}/${sites.length})  ${sigIcon} ${canon.slice(0, 35).padEnd(35)}`);
  } finally {
    release();
  }
});

await Promise.all(tasks.map(t => t()));
console.log('\n');

// Final report (console)
const afterRows = db.prepare('SELECT dental_signal, count(*) as n FROM clinics GROUP BY dental_signal').all();
db.close();

console.log('─'.repeat(50));
console.log('DONE');
console.log('─'.repeat(50));
console.log(`  Sites fetched:   ${successCount} OK / ${failCount} failed`);
console.log(`  DB clinics:`);
for (const { dental_signal, n } of afterRows) {
  const pct = ((n / rows.length) * 100).toFixed(1);
  console.log(`    ${(dental_signal ?? 'NULL').padEnd(10)}  ${String(n).padStart(5)}  (${pct}%)`);
}
console.log();
