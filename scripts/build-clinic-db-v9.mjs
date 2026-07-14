#!/usr/bin/env node
/**
 * build-clinic-db-v9.mjs
 *
 * Исправляет провал v8: ArcGIS-пагинация БЕЗ orderByFields давала
 * недетерминированный порядок страниц → дубли + пропуски.
 * INSERT OR IGNORE глотал дубли молча; реальные клиники терялись.
 *
 * Фиксы:
 *   1. orderByFields: BPHC_SITE_NUM ASC / OBJECTID ASC на каждой странице
 *   2. Проверяем exceededTransferLimit, не только feats.length < PAGE
 *   3. INSERT (без IGNORE) — конфликты считаем и логируем
 *   4. Подробный лог: страница, кол-во записей, уникальных id всего
 *
 * Выход: assets/clinics-v9.db
 * НЕ менять database.ts пока регрессионный тест не зелёный.
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';

const BASE =
  'https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/HealthCareFacilities/MapServer';
const OUT = 'assets/clinics-v9.db';
const V7_SRC = 'assets/clinics-v7.db';
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

async function fetchLayer(layer, fields, orderField) {
  const out = [];
  let pageNum = 0;
  for (let offset = 0; ; offset += PAGE) {
    pageNum++;
    const p = new URLSearchParams({
      where: '1=1',
      outFields: fields.join(','),
      orderByFields: `${orderField} ASC`,
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

    const exceeded = j.exceededTransferLimit === true;
    process.stderr.write(
      `  layer ${layer} page ${pageNum}: +${feats.length} records = ${out.length} total` +
      (exceeded ? ' [exceededTransferLimit]' : '') + '\n'
    );

    if (!exceeded && feats.length < PAGE) break;
    if (feats.length === 0) break;
  }
  process.stderr.write(`  layer ${layer}: ${pageNum} pages, ${out.length} records total\n`);
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
  console.log('=== build-clinic-db-v9 ===');
  console.log('Fetching HRSA layers (with orderByFields — fixed pagination)…');

  const [sites, dental] = await Promise.all([
    fetchLayer(18, SITE_FIELDS, 'BPHC_SITE_NUM'),
    fetchLayer(25, DENTAL_FIELDS, 'OBJECTID'),
  ]);

  // dental lookup maps
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
    INSERT INTO clinics
      (id, uds_num, name, address, city, state, zip, county,
       phone, admin_phone, appointment_phone, website,
       latitude, longitude, site_type, hours_per_week, rural,
       has_dental, has_dental_hygiene, dental_source)
    VALUES (@id,@uds_num,@name,@address,@city,@state,@zip,@county,
            @phone,@admin_phone,@appointment_phone,@website,
            @latitude,@longitude,@site_type,@hours_per_week,@rural,
            @has_dental,@has_dental_hygiene,@dental_source)
  `);

  let dentalHits = 0, skipped = 0, dupCount = 0;

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

      try {
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
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || (e.message && e.message.includes('UNIQUE constraint'))) {
          dupCount++;
          process.stderr.write(`  DUP id=${id} name="${name}"\n`);
        } else {
          throw e;
        }
      }
    }
  });
  load();

  // copy mh_facilities from v7 (SAMHSA data, not affected by this ETL)
  if (fs.existsSync(V7_SRC)) {
    process.stderr.write(`\nCopying mh_facilities from ${V7_SRC}…\n`);
    const v7 = new Database(V7_SRC, { readonly: true });

    const createSql = v7.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='mh_facilities'`
    ).get()?.sql;
    if (!createSql) throw new Error('mh_facilities schema not found in v7');
    db.exec(createSql);

    const mhRows = v7.prepare('SELECT * FROM mh_facilities').all();
    if (mhRows.length > 0) {
      const colNames = Object.keys(mhRows[0]);
      const placeholders = colNames.map((c) => `@${c}`).join(', ');
      const mhIns = db.prepare(`INSERT INTO mh_facilities (${colNames.join(', ')}) VALUES (${placeholders})`);
      const mhLoad = db.transaction(() => { for (const r of mhRows) mhIns.run(r); });
      mhLoad();
    }
    v7.close();

    const mhCount = db.prepare('SELECT COUNT(*) c FROM mh_facilities').get().c;
    process.stderr.write(`  mh_facilities: ${mhCount} rows copied\n`);
  } else {
    process.stderr.write(`  WARN: ${V7_SRC} not found — mh_facilities not copied\n`);
  }

  const n = db.prepare('SELECT COUNT(*) c FROM clinics').get().c;
  const withHours = db.prepare('SELECT COUNT(*) c FROM clinics WHERE hours_per_week > 0').get().c;
  const byState = db
    .prepare(`SELECT state, COUNT(*) c FROM clinics WHERE state IN ('CA','TX','NY','FL','OH','IN') GROUP BY 1 ORDER BY 1`)
    .all();

  console.log(`
clinics ................... ${n}   (v7=10429, v8_broken=13k dups)
  skipped (нет id/гео) .... ${skipped}
  duplicates (id конфликт) . ${dupCount}  ← должно быть 0 при правильной пагинации
  has_dental .............. ${dentalHits}
  hours_per_week заполнен . ${withHours}

контроль по штатам (HRSA ref: CA 2516, TX 737, NY 790, FL 695, OH 540, IN 310):`);
  for (const r of byState) console.log(`  ${r.state}  ${r.c}`);

  // === REGRESSION TEST ===
  const allianceCount = db.prepare(
    `SELECT COUNT(*) c FROM clinics WHERE name LIKE '%Alliance Health Center%' AND state='IN'`
  ).get().c;
  const bowenCount = db.prepare(
    `SELECT COUNT(*) c FROM clinics WHERE name LIKE '%Bowen Center%' AND state='IN'`
  ).get().c;
  const fwCount = db.prepare(`
    SELECT COUNT(*) c FROM clinics
    WHERE (6371 * acos(
      cos(radians(41.0793)) * cos(radians(latitude)) * cos(radians(longitude) - radians(-85.1394)) +
      sin(radians(41.0793)) * sin(radians(latitude))
    )) * 0.621371 <= 25
  `).get().c;

  console.log('\n=== РЕГРЕССИОННЫЙ ТЕСТ ===');
  console.log(`Alliance Health Centers (IN): ${allianceCount} (нужно ≥8)  ${allianceCount >= 8 ? '✓' : '✗ ПРОВАЛ'}`);
  console.log(`Bowen Center (IN):            ${bowenCount} (нужно ≥3)  ${bowenCount >= 3 ? '✓' : '✗ ПРОВАЛ'}`);
  console.log(`Fort Wayne 25 миль:           ${fwCount} (нужно ≥25) ${fwCount >= 25 ? '✓' : '✗ ПРОВАЛ'}`);

  db.close();

  const passed = allianceCount >= 8 && bowenCount >= 3 && fwCount >= 25;
  if (!passed) {
    console.error('\n⛔ ТЕСТ НЕ ПРОЙДЕН — база отклоняется, приложение остаётся на v7');
    process.exit(1);
  }
  console.log(`\n✓ Регрессионный тест пройден — можно обновлять database.ts на clinics-v9.db`);
  console.log(`  Записано: ${OUT}`);
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
