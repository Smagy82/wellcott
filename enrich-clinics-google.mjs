// enrich-clinics-google.mjs
//
// Обогащает clinics.db данными Google Places API (New).
// Добавляет колонки: place_id, hours_json, google_enriched.
//
// Запуск:
//   GOOGLE_API_KEY="<ключ>" node enrich-clinics-google.mjs
//   GOOGLE_API_KEY="<ключ>" ONLY_STATE=CA node enrich-clinics-google.mjs
//   GOOGLE_API_KEY="<ключ>" ONLY_CITY="San Francisco" DB_PATH=data/clinics.db node enrich-clinics-google.mjs

import Database from 'better-sqlite3';

const KEY       = process.env.GOOGLE_API_KEY;
const DB_PATH   = process.env.DB_PATH   ?? 'data/clinics.db';
const ONLY_STATE = process.env.ONLY_STATE ?? null;
const ONLY_CITY  = process.env.ONLY_CITY  ?? null;

const ENDPOINT   = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours.weekdayDescriptions',
].join(',');

if (!KEY) throw new Error('Задай GOOGLE_API_KEY');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── DB setup ────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const existingCols = db.pragma('table_info(clinics)').map((r) => r.name);

if (!existingCols.includes('place_id'))
  db.exec('ALTER TABLE clinics ADD COLUMN place_id TEXT');
if (!existingCols.includes('hours_json'))
  db.exec('ALTER TABLE clinics ADD COLUMN hours_json TEXT');
if (!existingCols.includes('google_enriched'))
  db.exec('ALTER TABLE clinics ADD COLUMN google_enriched INTEGER DEFAULT 0');

// ── Build query ──────────────────────────────────────────────────────────────

let sql = 'SELECT id, name, address, city, state, zip, phone, website FROM clinics WHERE (google_enriched IS NULL OR google_enriched = 0)';
const params = [];

if (ONLY_STATE) { sql += ' AND state = ?'; params.push(ONLY_STATE); }
if (ONLY_CITY)  { sql += ' AND city = ?';  params.push(ONLY_CITY); }

const rows = db.prepare(sql).all(...params);
console.log(`Клиник для обогащения: ${rows.length}${ONLY_STATE ? ` (state=${ONLY_STATE})` : ''}${ONLY_CITY ? ` (city=${ONLY_CITY})` : ''}`);

// ── Prepared statements ──────────────────────────────────────────────────────

const updateMatched = db.prepare(`
  UPDATE clinics SET
    place_id         = ?,
    hours_json       = ?,
    phone            = CASE WHEN (phone IS NULL OR phone = '') THEN ? ELSE phone END,
    website          = CASE WHEN (website IS NULL OR website = '') THEN ? ELSE website END,
    google_enriched  = 1
  WHERE id = ?
`);

const updateNoMatch = db.prepare(`
  UPDATE clinics SET google_enriched = 1 WHERE id = ?
`);

// ── Main loop ────────────────────────────────────────────────────────────────

let matched = 0, noMatch = 0, errors = 0;

for (let i = 0; i < rows.length; i++) {
  const { id, name, address, city, state, zip, phone, website } = rows[i];
  const textQuery = `${name} ${address} ${city} ${state} ${zip}`;

  process.stdout.write(`[${i + 1}/${rows.length}] ${name.slice(0, 50)}… `);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }

    const json = await res.json();
    const place = json.places?.[0];

    if (!place) {
      updateNoMatch.run(id);
      noMatch++;
      console.log('no match');
    } else {
      const placeId   = place.id ?? null;
      const hoursJson = place.regularOpeningHours?.weekdayDescriptions
        ? JSON.stringify(place.regularOpeningHours.weekdayDescriptions)
        : null;
      const newPhone   = place.nationalPhoneNumber ?? null;
      const newWebsite = place.websiteUri ?? null;

      updateMatched.run(placeId, hoursJson, newPhone, newWebsite, id);
      matched++;
      console.log(`matched → ${place.displayName?.text ?? placeId}`);
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    errors++;
  }

  if (i < rows.length - 1) await sleep(120);
}

db.close();

console.log(`\nГотово: matched=${matched}, no match=${noMatch}, errors=${errors}`);
