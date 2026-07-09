// scripts/build-clinic-db.mjs
//
// Собирает офлайн-базу data/clinics.db (SQLite) из HRSA Health Center Data API.
// Источник: HRSA HDW REST API (JSON), метод GetHealthCentersByArea по штатам.
//   Endpoint: https://data.hrsa.gov/HDWAPI3_External/api/v1/GetHealthCentersByArea
//
// Токен нужен ТОЛЬКО здесь (build-time, на твоём Mac). В приложение он НЕ попадает —
// приложение работает офлайн с готовой clinics.db.
//
// Запуск:
//   npm i -D better-sqlite3
//   HRSA_TOKEN="<твой токен>" node scripts/build-clinic-db.mjs
//
// Токен: регистрация на https://data.hrsa.gov/tools/web-services

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';

const API = 'https://data.hrsa.gov/HDWAPI3_External/api/v1/GetHealthCentersByArea';
const TOKEN = process.env.HRSA_TOKEN ?? '';
const OUT = 'data/clinics.db';

// FIPS всех штатов + DC + территории (FQHC есть и там).
const STATE_FIPS = [
  '01','02','04','05','06','08','09','10','11','12','13','15','16','17','18','19',
  '20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35',
  '36','37','38','39','40','41','42','44','45','46','47','48','49','50','51','53',
  '54','55','56',               // 50 штатов + DC (11)
  '60','66','69','72','78',     // AS, GU, MP, PR, VI
];

// --- НОРМАЛИЗАЦИЯ (схема ответа точно известна из DeveloperGuide.pdf) --------

// LAT_LON приходит одной строкой: "36.70099489 -121.61634225" (широта, затем долгота).
function parseLatLon(s) {
  if (!s || typeof s !== 'string') return [NaN, NaN];
  const [lat, lon] = s.trim().split(/\s+/).map(Number);
  return [lat, lon];
}

function normalizeHcc(r) {
  const [latitude, longitude] = parseLatLon(r.LAT_LON);
  return {
    id:        String(r.HCC_FCT_ID ?? `${r.SITE_NM}|${r.SITE_ZIP_CD}`),
    name:      (r.SITE_NM ?? '').trim(),
    address:   (r.SITE_ADDRESS ?? '').trim(),
    city:      (r.SITE_CITY ?? '').trim(),
    state:     (r.SITE_STATE_ABBR ?? '').trim(),
    zip:       (r.SITE_ZIP_CD ?? '').trim(),
    county:    null,
    phone:     (r.SITE_PHONE_NUM ?? '').trim(),
    website:   (r.SITE_URL ?? '').trim(),
    latitude,
    longitude,
    site_type: (r.HCC_TYP_DESC ?? '').trim(),
  };
}

// Датасет включает НЕ только точки приёма (напр. "Administrative" — офисы).
// Отсекаем их, чтобы юзеру не показывать админ-адреса как клиники.
// Список слов уточни, распечатав distinct HCC_TYP_DESC на реальных данных.
function isCareSite(c) {
  const t = c.site_type.toLowerCase();
  if (!t) return true; // нет типа — оставляем (лучше лишнее, чем потерять клинику)
  return !/admin|billing|mailing/.test(t);
}

// --- FETCH (HTTP-биндинг — инференс; сверь с полным Developer Guide) ---------
// Excerpt перечисляет параметры, но не фиксирует GET/POST и точный кейс ключей.
// Ниже — GET со стандартными query-параметрами. Если API ждёт POST/JSON —
// поменяй ТОЛЬКО тут (схема ОТВЕТА при этом не меняется).
async function fetchByState(fips) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ StateFipsCode: fips, Token: TOKEN }),
  });
  if (!res.ok) throw new Error(`FIPS ${fips}: HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.HCC) ? json.HCC : [];
}

async function main() {
  if (!TOKEN) throw new Error('Задай HRSA_TOKEN (регистрация: data.hrsa.gov/tools/web-services)');

  const byId = new Map();
  for (const fips of STATE_FIPS) {
    try {
      const raw = await fetchByState(fips);
      let kept = 0;
      for (const rec of raw) {
        const c = normalizeHcc(rec);
        if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
        if (!isCareSite(c)) continue;
        byId.set(c.id, c); // дедуп по HCC_FCT_ID
        kept++;
      }
      console.log(`FIPS ${fips}: получено ${raw.length}, оставлено ${kept} (уникальных всего: ${byId.size})`);
    } catch (e) {
      console.warn(`FIPS ${fips} пропущен: ${e.message}`);
    }
  }

  const clinics = [...byId.values()];
  mkdirSync('data', { recursive: true });
  const db = new Database(OUT);
  db.pragma('journal_mode = WAL');
  db.exec(`
    DROP TABLE IF EXISTS clinics;
    CREATE TABLE clinics (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      address           TEXT, city TEXT, state TEXT, zip TEXT, county TEXT,
      phone             TEXT, website TEXT,
      latitude          REAL, longitude REAL,
      site_type         TEXT,
      accepts_uninsured INTEGER DEFAULT 1,  -- FQHC обязаны принимать независимо от оплаты
      sliding_scale     INTEGER DEFAULT 1
    );
    CREATE INDEX idx_clinics_geo   ON clinics(latitude, longitude);
    CREATE INDEX idx_clinics_state ON clinics(state);
  `);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO clinics
      (id, name, address, city, state, zip, county, phone, website,
       latitude, longitude, site_type, accepts_uninsured, sliding_scale)
    VALUES
      (@id, @name, @address, @city, @state, @zip, @county, @phone, @website,
       @latitude, @longitude, @site_type, 1, 1)
  `);
  const tx = db.transaction((rows) => { for (const c of rows) insert.run(c); });
  tx(clinics);

  console.log(`Готово: ${clinics.length} клиник -> ${OUT}`);
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
