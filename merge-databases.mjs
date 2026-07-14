/**
 * merge-databases.mjs
 *
 * Объединяет clinics-v3.db + mh_facilities из samhsa-mh.db
 * → assets/clinics-v4.db
 *
 * Правило: при обновлении bundled-базы ОБЯЗАТЕЛЬНО бампать имя файла (v3→v4),
 * иначе expo-sqlite не перекопирует файл на устройство (см. AGENTS.md).
 *
 * Запуск:
 *   node merge-databases.mjs
 *
 * Зависимость: npm i -D better-sqlite3
 */

import Database from 'better-sqlite3';
import { copyFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const SRC_CLINICS = resolve(ROOT, 'assets/clinics-v3.db');
const SRC_SAMHSA  = resolve(ROOT, 'samhsa-mh.db');
const OUT         = resolve(ROOT, 'assets/clinics-v4.db');

// ── 1. Копируем clinics-v3.db → clinics-v4.db ────────────────────────────────

console.log(`Копируем ${SRC_CLINICS} → ${OUT}`);
copyFileSync(SRC_CLINICS, OUT);

// ── 2. Читаем все строки из samhsa-mh.db ─────────────────────────────────────

const src = new Database(SRC_SAMHSA, { readonly: true });
const rows = src.prepare('SELECT * FROM mh_facilities').all();
src.close();
console.log(`Прочитано MH-объектов из samhsa-mh.db: ${rows.length}`);

// ── 3. Открываем clinics-v4.db и создаём таблицу mh_facilities ───────────────

const db = new Database(OUT);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');

db.exec(`
  DROP TABLE IF EXISTS mh_facilities;
  CREATE TABLE mh_facilities (
    id               TEXT PRIMARY KEY,
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
    has_sliding_fee  INTEGER DEFAULT 0,
    has_pay_assist   INTEGER DEFAULT 0,
    accepts_self_pay INTEGER DEFAULT 0,
    languages        TEXT,
    age_groups       TEXT,
    service_setting  TEXT,
    snapshot_date    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_mh_geo   ON mh_facilities(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_mh_state ON mh_facilities(state);
  CREATE INDEX IF NOT EXISTS idx_mh_flags ON mh_facilities(has_sliding_fee, has_pay_assist, accepts_self_pay);
`);

// ── 4. Вставляем строки транзакцией ──────────────────────────────────────────

const insert = db.prepare(`
  INSERT INTO mh_facilities
    (id, name1, name2, street1, city, state, zip, phone, website,
     latitude, longitude, has_sliding_fee, has_pay_assist, accepts_self_pay,
     languages, age_groups, service_setting, snapshot_date)
  VALUES
    (@id, @name1, @name2, @street1, @city, @state, @zip, @phone, @website,
     @latitude, @longitude, @has_sliding_fee, @has_pay_assist, @accepts_self_pay,
     @languages, @age_groups, @service_setting, @snapshot_date)
`);

const insertAll = db.transaction((records) => {
  for (const r of records) insert.run(r);
});
insertAll(rows);
console.log(`Записано MH-объектов в clinics-v4.db: ${rows.length}`);

// ── 5. Checkpoint + переключение в DELETE перед закрытием ────────────────────
// VACUUM в WAL-режиме ломает файл (WAL не гарантированно слит в main).
// Правильный порядок: checkpoint → DELETE mode → VACUUM → close.

db.pragma('wal_checkpoint(TRUNCATE)');
db.pragma('journal_mode = DELETE');
db.exec('VACUUM');
db.close();

// ── 6. Итоговая проверка ──────────────────────────────────────────────────────

const db2 = new Database(OUT, { readonly: true });
const clinicsCount = db2.prepare('SELECT COUNT(*) as n FROM clinics').get().n;
const mhCount      = db2.prepare('SELECT COUNT(*) as n FROM mh_facilities').get().n;
const mhNoCoords   = db2.prepare('SELECT COUNT(*) as n FROM mh_facilities WHERE latitude IS NULL OR longitude IS NULL').get().n;
const tables       = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
db2.close();

const sizeBytes = statSync(OUT).size;
const sizeMb    = (sizeBytes / 1024 / 1024).toFixed(2);

console.log('');
console.log('── Итог ─────────────────────────────────────────────');
console.log(`Файл:              ${OUT} (${sizeMb} МБ)`);
console.log(`Таблицы:           ${tables.join(', ')}`);
console.log(`clinics:           ${clinicsCount}`);
console.log(`mh_facilities:     ${mhCount} (без координат: ${mhNoCoords})`);
console.log('─────────────────────────────────────────────────────');
console.log('');
console.log('Следующий шаг: обновить src/lib/database.ts (clinics-v3 → clinics-v4)');
