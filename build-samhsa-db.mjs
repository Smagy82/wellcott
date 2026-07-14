/**
 * build-samhsa-db.mjs
 *
 * Собирает офлайн-базу samhsa-mh.db из SAMHSA findtreatment.gov API.
 * Источник: https://findtreatment.gov/locator/exportsAsJson/v2
 * Параметры подтверждены: scripts/probe/samhsa-api-notes.md (2026-07-13)
 *
 * Запуск:
 *   node build-samhsa-db.mjs                    — полный прогон (51 штат)
 *   ONLY_STATES=IN,WY node build-samhsa-db.mjs  — тест по 2 штатам
 *   COUNT_ONLY=1 node build-samhsa-db.mjs       — подсчёт без записи в БД
 *
 * Зависимость (build-time, не попадает в приложение):
 *   npm i -D better-sqlite3
 *
 * Выход: samhsa-mh.db — НЕ clinics-v3.db. Мерж — отдельным шагом.
 *
 * ⚠️  Полный прогон (~51 запрос × пагинация) — только после одобрения API-доступа SAMHSA.
 */

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';

// ── Константы ──────────────────────────────────────────────────────────────────

const BASE_URL      = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const PAGE_SIZE     = 2000;
const DELAY_MS      = 300;
const OUT_FILE      = 'samhsa-mh.db';
const SNAPSHOT_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// SAMHSA limitType=0 state IDs — подтверждены probe-samhsa.mjs (2026-07-13).
// limitType=0 + limitValue=<stateId> возвращает все MH-объекты в штате.
const STATE_MAP = {
  ME:1,  MI:2,  MA:3,  MT:4,  NY:5,  NC:6,         // low IDs — не путать с FIPS (17 пропущен)
  OH:7,  PA:8,  RI:9,  TN:10, TX:11, NV:12, NJ:13,
  UT:14, WA:15, WI:16, MD:18, AL:19, AK:20, AZ:21,
  AR:22, CA:23, CO:24, CT:25, DE:26, DC:27, FL:28,
  GA:29, HI:30, ID:31, IL:32, IN:33, IA:34, KS:35,
  KY:36, LA:37, MN:38, MS:39, MO:40, NE:41, NH:42,
  NM:43, ND:44, OK:45, OR:46, SC:47, SD:48, VT:49,
  VA:50, WV:51, WY:52,
};

// ── ENV-флаги ──────────────────────────────────────────────────────────────────

const ONLY_STATES = process.env.ONLY_STATES
  ? process.env.ONLY_STATES.split(',').map(s => s.trim().toUpperCase())
  : null;

const COUNT_ONLY = !!process.env.COUNT_ONLY;

// ── Утилиты ────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Дедуп-ключ: name1 + street1 + zip (один объект может быть на границе двух штатов).
function dedupKey(r) {
  return [
    (r.name1   ?? '').trim().toLowerCase(),
    (r.street1 ?? '').trim().toLowerCase(),
    (r.zip     ?? '').trim(),
  ].join('|');
}

// SHA-1 первые 16 символов — стабильный ID без внешних зависимостей.
function makeId(key) {
  return createHash('sha1').update(key).digest('hex').slice(0, 16);
}

// Вернуть все f3 из блоков с данным f2, склеенные через '; '.
function extractF3(services, f2Code) {
  if (!Array.isArray(services)) return null;
  const vals = services
    .filter(s => s?.f2 === f2Code)
    .map(s => (s.f3 ?? '').trim())
    .filter(Boolean);
  return vals.length ? vals.join('; ') : null;
}

// Нормализация одного facility-объекта из API-ответа.
function normalize(r) {
  const services = Array.isArray(r.services) ? r.services : [];

  const pyasBlocks = services.filter(s => s?.f2 === 'PYAS');
  const payBlocks  = services.filter(s => s?.f2 === 'PAY');

  // has_sliding_fee — подмножество has_pay_assist: PYAS + f3 содержит 'Sliding fee scale'
  const has_sliding_fee  = pyasBlocks.some(s => (s.f3 ?? '').includes('Sliding fee scale')) ? 1 : 0;
  const has_pay_assist   = pyasBlocks.length > 0 ? 1 : 0;
  const accepts_self_pay = payBlocks.some(s => (s.f3 ?? '').includes('Cash or self-payment')) ? 1 : 0;

  // API-поля latitude/longitude — строки, parseFloat обязателен.
  // Поля корректно подписаны: latitude=широта, longitude=долгота (проверено 2026-07-13).
  const latitude  = parseFloat(r.latitude)  || null;
  const longitude = parseFloat(r.longitude) || null;

  return {
    name1:           (r.name1   ?? '').trim(),
    name2:           (r.name2   ?? '').trim() || null,
    street1:         (r.street1 ?? '').trim(),
    city:            (r.city    ?? '').trim(),
    state:           (r.state   ?? '').trim(),
    zip:             (r.zip     ?? '').trim(),
    phone:           (r.phone   ?? '').trim() || null,
    website:         (r.website ?? '').trim() || null,
    latitude,
    longitude,
    has_sliding_fee,
    has_pay_assist,
    accepts_self_pay,
    languages:       extractF3(services, 'SL'),
    age_groups:      extractF3(services, 'AGE'),
    service_setting: extractF3(services, 'SET'),
    snapshot_date:   SNAPSHOT_DATE,
  };
}

// ── Fetch одной страницы ───────────────────────────────────────────────────────

async function fetchPage(stateId, page) {
  // sAddr=0,0 — dummy, игнорируется при limitType=0 (state-based search).
  const url = `${BASE_URL}?sAddr=0,0&limitType=0&limitValue=${stateId}&sType=mh&pageSize=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      Accept:       'application/json',
      'User-Agent': 'Wellcott-ETL/1.0 (wellcott.app)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (stateId=${stateId}, page=${page})`);
  return res.json();
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Валидация ONLY_STATES
  const statesToRun = ONLY_STATES
    ? Object.entries(STATE_MAP).filter(([abbr]) => ONLY_STATES.includes(abbr))
    : Object.entries(STATE_MAP);

  if (ONLY_STATES && statesToRun.length === 0) {
    const known = Object.keys(STATE_MAP).join(', ');
    console.error(`Неизвестные коды: ${ONLY_STATES.join(', ')}\nДопустимые: ${known}`);
    process.exit(1);
  }

  const unknownStates = (ONLY_STATES ?? []).filter(a => !STATE_MAP[a]);
  if (unknownStates.length) {
    console.warn(`⚠️  Неизвестные штаты проигнорированы: ${unknownStates.join(', ')}`);
  }

  console.log(`SAMHSA MH ETL — ${SNAPSHOT_DATE}`);
  console.log(`Штатов: ${statesToRun.length} (${statesToRun.map(([a]) => a).join(', ')})`);
  if (COUNT_ONLY) console.log('COUNT_ONLY=1 — запись в БД отключена');
  console.log('');

  const seen = new Map(); // dedupKey → normalized record

  for (const [abbr, stateId] of statesToRun) {
    let page = 1;
    let totalPages = 1;
    const sizeBeforeState = seen.size;

    while (page <= totalPages) {
      try {
        const data = await fetchPage(stateId, page);
        totalPages = data.totalPages ?? 1;
        const rows = data.rows ?? [];

        for (const r of rows) {
          const key = dedupKey(r);
          if (!seen.has(key)) seen.set(key, normalize(r));
        }

        const label = totalPages > 1 ? ` p${page}/${totalPages}` : '';
        process.stdout.write(`  ${abbr}${label}: ${rows.length} записей\n`);

        page++;
        if (page <= totalPages) await sleep(DELAY_MS);
      } catch (e) {
        console.warn(`  ${abbr} p${page} — ошибка: ${e.message}`);
        break;
      }
    }

    const addedForState = seen.size - sizeBeforeState;
    const dupes = (seen.size - sizeBeforeState < 0 ? 0 : 0); // cross-state dupes если > 0
    console.log(`  → ${abbr}: +${addedForState} уникальных (всего в seen: ${seen.size})\n`);

    await sleep(DELAY_MS);
  }

  const records = [...seen.values()];
  console.log(`Всего уникальных после дедупа: ${records.length}`);

  if (COUNT_ONLY) {
    printStats(records);
    return;
  }

  // ── Запись в БД ───────────────────────────────────────────────────────────────

  const db = new Database(OUT_FILE);
  // WAL = быстрые INSERT'ы, но перед закрытием нужен явный checkpoint.
  // synchronous=FULL гарантирует что WAL сброшен на диск до return из транзакции.
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');

  db.exec(`
    DROP TABLE IF EXISTS mh_facilities;
    CREATE TABLE mh_facilities (
      id               TEXT PRIMARY KEY,    -- SHA-1(name1|street1|zip)[0:16]
      name1            TEXT NOT NULL,
      name2            TEXT,
      street1          TEXT,
      city             TEXT,
      state            TEXT,
      zip              TEXT,
      phone            TEXT,
      website          TEXT,
      latitude         REAL,
      longitude        REAL,
      has_sliding_fee  INTEGER DEFAULT 0,   -- PYAS + f3 contains 'Sliding fee scale'
      has_pay_assist   INTEGER DEFAULT 0,   -- любой PYAS блок
      accepts_self_pay INTEGER DEFAULT 0,   -- PAY + f3 contains 'Cash or self-payment'
      languages        TEXT,                -- f3 из SL блоков, '; '-separated
      age_groups       TEXT,                -- f3 из AGE блоков
      service_setting  TEXT,                -- f3 из SET блоков
      snapshot_date    TEXT                 -- YYYY-MM-DD
    );
    CREATE INDEX idx_mh_geo   ON mh_facilities(latitude, longitude);
    CREATE INDEX idx_mh_state ON mh_facilities(state);
    CREATE INDEX idx_mh_flags ON mh_facilities(has_sliding_fee, has_pay_assist, accepts_self_pay);
  `);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO mh_facilities (
      id, name1, name2, street1, city, state, zip, phone, website,
      latitude, longitude,
      has_sliding_fee, has_pay_assist, accepts_self_pay,
      languages, age_groups, service_setting, snapshot_date
    ) VALUES (
      @id, @name1, @name2, @street1, @city, @state, @zip, @phone, @website,
      @latitude, @longitude,
      @has_sliding_fee, @has_pay_assist, @accepts_self_pay,
      @languages, @age_groups, @service_setting, @snapshot_date
    )
  `);

  const insertAll = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({ ...r, id: makeId(dedupKey(r)) });
    }
  });

  insertAll(records);

  // Checkpoint: сбросить WAL в main-файл, переключиться в DELETE-режим.
  // Без этого при synchronous=NORMAL (и даже FULL) WAL может остаться не слитым
  // в main-файл при внезапном закрытии → база выглядит пустой.
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.pragma('journal_mode = DELETE');

  db.close();

  const sizeBytes = statSync(OUT_FILE).size;
  console.log(`\nЗаписано: ${records.length} строк → ${OUT_FILE} (${(sizeBytes / 1024 / 1024).toFixed(2)} МБ)`);
  printStats(records);
}

function printStats(records) {
  const n = records.length;
  if (n === 0) { console.log('\nНет данных.'); return; }

  const pct = (key) => ((records.filter(r => r[key] === 1).length / n) * 100).toFixed(1) + '%';
  const cnt = (key) =>   records.filter(r => r[key]).length;

  console.log('\n── Статистика ───────────────────────────────────────');
  console.log(`Всего:            ${n}`);
  console.log(`has_sliding_fee:  ${pct('has_sliding_fee')}  (${records.filter(r=>r.has_sliding_fee).length})`);
  console.log(`has_pay_assist:   ${pct('has_pay_assist')}  (${records.filter(r=>r.has_pay_assist).length})`);
  console.log(`accepts_self_pay: ${pct('accepts_self_pay')}  (${records.filter(r=>r.accepts_self_pay).length})`);
  console.log(`has_languages:    ${((cnt('languages') / n) * 100).toFixed(1)}%  (${cnt('languages')})`);
  console.log(`has_age_groups:   ${((cnt('age_groups') / n) * 100).toFixed(1)}%  (${cnt('age_groups')})`);
  console.log(`no_coords:        ${records.filter(r => !r.latitude || !r.longitude).length}`);

  // Распределение по штатам (топ-10)
  const byState = {};
  for (const r of records) byState[r.state] = (byState[r.state] ?? 0) + 1;
  const top = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\nТоп-10 штатов:    ${top.map(([s, c]) => `${s}=${c}`).join(', ')}`);
  console.log('─────────────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
