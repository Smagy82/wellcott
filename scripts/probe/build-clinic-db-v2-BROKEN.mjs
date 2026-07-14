#!/usr/bin/env node
// СЛОМАН: Layer 18 теряет реальные Service Delivery Sites.
// Fort Wayne: 25 клиник в v7 → 13 в v8. Alliance Health Centers (8 локаций)
// и Bowen Center (3 локации) исчезли полностью. НЕ ИСПОЛЬЗОВАТЬ.

/**
 * build-clinic-db-v2.mjs  —  Wellcott
 *
 * Пересобирает базу клиник из HRSA ArcGIS REST (Layer 18) вместо bulk-API.
 * Причина: старый ETL терял ~38% площадок (10 429 из 16 781).
 *
 * Что нового по сравнению с v1:
 *   - полные ~16.7k площадок (проверено: CA 2516, TX 737, NY 790, FL 695, OH 540)
 *   - uds_num              → ключ для джойна с dental (в старой схеме его не было)
 *   - admin_phone          → второй телефон
 *   - hours_per_week       → бесплатно, без Google Places
 *   - rural                → флаг сельской местности
 *   - has_dental           → из Layer 25 (1146 дантист + 180 гигиенист)
 *   - dental_source        → 'nhsc' = жёстко. Пусто = НЕИЗВЕСТНО, не "нет".
 *
 * ВАЖНО для UI:
 *   has_dental = 0 означает "нет данных", а НЕ "стоматологии нет".
 *   Никогда не рендерить "No dental at this location".
 *
 * Требует: npm i better-sqlite3
 * Запуск : node build-clinic-db-v2.mjs
 * Выход  : assets/clinics-v8.db
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';

const BASE =
  'https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/HealthCareFacilities/MapServer';
const OUT = 'assets/clinics-v8.db';
const PAGE = 2000;

const SITE_FIELDS = [
  'BPHC_SITE_NUM', 'UDS_NUM', 'SITE_NM', 'SITE_ADDRESS', 'SITE_CITY',
  'SITE_STATE_ABBR', 'SITE_ZIP_CD', 'LIST_BOX_COUNTY_NM',
  'SITE_PHONE_NUM', 'ADMIN_PHONE_NUM', 'SITE_URL',
  'X', 'Y', 'TOT_OPER_HR_PER_WEEK', 'RURAL_DESC', 'HCC_TYP_DESC',
];

const DENTAL_FIELDS = [
  'UDS_NUM', 'SITE_ADDRESS', 'SITE_ZIP_CD', 'APPOINT_PHONE_NUM',
  'DC_DENTIST_FTE_CT', 'DC_DENTAL_HYGIENIST_FTE_CT',
];

async function fetchLayer(layer, fields) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const p = new URLSearchParams({
      where: '1=1',
      outFields: fields.join(','),
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: 'json',
    });
    const res = await fetch(`${BASE}/${layer}/query?${p}`);
    if (!res.ok) throw new Error(`layer ${layer}: HTTP ${res.status}`);
    const j = await res.json();
    if (j.error) throw new Error(`layer ${layer}: ${JSON.stringify(j.error)}`);
    const feats = j.features ?? [];
    out.push(...feats.map((f) => f.attributes));
    process.stderr.write(`layer ${layer}: ${out.length}\r`);
    if (feats.length < PAGE) break;
  }
  process.stderr.write('\n');
  return out;
}

const s = (v) => {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};
const zip5 = (v) => s(v)?.slice(0, 5) ?? null;

const normAddr = (a, z) =>
  `${(a ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(STE|SUITE|UNIT|APT|#)\b.*$/, '')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bHIGHWAY\b/g, 'HWY')
    .replace(/\s+/g, ' ')
    .trim()}|${z ?? ''}`;

async function main() {
  console.log('fetching HRSA layers…');
  const [sites, dental] = await Promise.all([
    fetchLayer(18, SITE_FIELDS),
    fetchLayer(25, DENTAL_FIELDS),
  ]);

  // --- dental lookup: по UDS_NUM и по адресу ---
  const dByUds = new Map();
  const dByAddr = new Map();
  for (const d of dental) {
    const rec = {
      dentist: d.DC_DENTIST_FTE_CT ?? 0,
      hygienist: d.DC_DENTAL_HYGIENIST_FTE_CT ?? 0,
      appt: s(d.APPOINT_PHONE_NUM),
    };
    if (s(d.UDS_NUM)) dByUds.set(s(d.UDS_NUM), rec);
    dByAddr.set(normAddr(d.SITE_ADDRESS, zip5(d.SITE_ZIP_CD)), rec);
  }

  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  const db = new Database(OUT);
  db.pragma('journal_mode = OFF');

  db.exec(`
    CREATE TABLE clinics (
      id                TEXT PRIMARY KEY,
      uds_num           TEXT,
      name              TEXT NOT NULL,
      address           TEXT, city TEXT, state TEXT, zip TEXT, county TEXT,
      phone             TEXT, admin_phone TEXT, appointment_phone TEXT,
      website           TEXT,
      latitude          REAL, longitude REAL,
      site_type         TEXT,
      hours_per_week    REAL,
      rural             INTEGER DEFAULT 0,
      accepts_uninsured INTEGER DEFAULT 1,
      sliding_scale     INTEGER DEFAULT 1,
      has_dental        INTEGER DEFAULT 0,
      has_dental_hygiene INTEGER DEFAULT 0,
      dental_source     TEXT,
      place_id          TEXT, hours_json TEXT, google_enriched INTEGER DEFAULT 0
    );
    CREATE INDEX idx_clinics_geo    ON clinics(latitude, longitude);
    CREATE INDEX idx_clinics_state  ON clinics(state);
    CREATE INDEX idx_clinics_dental ON clinics(has_dental);
  `);

  const ins = db.prepare(`
    INSERT OR IGNORE INTO clinics
      (id, uds_num, name, address, city, state, zip, county,
       phone, admin_phone, appointment_phone, website,
       latitude, longitude, site_type, hours_per_week, rural,
       has_dental, has_dental_hygiene, dental_source)
    VALUES (@id,@uds_num,@name,@address,@city,@state,@zip,@county,
            @phone,@admin_phone,@appointment_phone,@website,
            @latitude,@longitude,@site_type,@hours_per_week,@rural,
            @has_dental,@has_dental_hygiene,@dental_source)
  `);

  let dentalHits = 0, skipped = 0;

  const load = db.transaction(() => {
    for (const a of sites) {
      const id = s(a.BPHC_SITE_NUM);
      const name = s(a.SITE_NM);
      const lat = a.Y, lng = a.X;
      if (!id || !name || !lat || !lng) { skipped++; continue; }

      const uds = s(a.UDS_NUM);
      const zip = zip5(a.SITE_ZIP_CD);
      const d =
        (uds && dByUds.get(uds)) ||
        dByAddr.get(normAddr(a.SITE_ADDRESS, zip)) ||
        null;
      if (d && d.dentist > 0) dentalHits++;

      ins.run({
        id,
        uds_num: uds,
        name,
        address: s(a.SITE_ADDRESS),
        city: s(a.SITE_CITY),
        state: s(a.SITE_STATE_ABBR),
        zip,
        county: s(a.LIST_BOX_COUNTY_NM),
        phone: s(a.SITE_PHONE_NUM),
        admin_phone: s(a.ADMIN_PHONE_NUM),
        appointment_phone: d?.appt ?? null,
        website: s(a.SITE_URL),
        latitude: lat,
        longitude: lng,
        site_type: s(a.HCC_TYP_DESC) ?? 'Service Delivery Site',
        hours_per_week: a.TOT_OPER_HR_PER_WEEK ?? null,
        rural: /^y/i.test(s(a.RURAL_DESC) ?? '') ? 1 : 0,
        has_dental: d && d.dentist > 0 ? 1 : 0,
        has_dental_hygiene: d && d.hygienist > 0 ? 1 : 0,
        dental_source: d && (d.dentist > 0 || d.hygienist > 0) ? 'nhsc' : null,
      });
    }
  });
  load();

  const n = db.prepare('SELECT COUNT(*) c FROM clinics').get().c;
  const withHours = db.prepare('SELECT COUNT(*) c FROM clinics WHERE hours_per_week > 0').get().c;
  const byState = db
    .prepare(`SELECT state, COUNT(*) c FROM clinics WHERE state IN ('CA','TX','NY','FL','OH','IN') GROUP BY 1 ORDER BY 1`)
    .all();

  console.log(`
clinics ................... ${n}   (было 10429, ожидаем ~16.7k)
  skipped (нет id/гео) .... ${skipped}
  has_dental .............. ${dentalHits}
  hours_per_week заполнен . ${withHours}

контроль по штатам (сверить с HRSA: CA 2516, TX 737, NY 790, FL 695, OH 540, IN 310):`);
  for (const r of byState) console.log(`  ${r.state}  ${r.c}`);
  console.log(`\nwrote ${OUT}`);
  db.close();
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
