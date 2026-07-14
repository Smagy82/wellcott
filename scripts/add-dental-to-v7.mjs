#!/usr/bin/env node
/**
 * add-dental-to-v7.mjs
 *
 * Добавляет dental-данные из HRSA ArcGIS Layer 25 (NHSC) поверх v7.
 * JOIN по точному нормализованному адресу + ZIP (suite НЕ срезается).
 *
 * Правила матча (молчание лучше вранья):
 *   1. Только точный адрес — suite не срезается, fallback не делается.
 *   2. Если нормализованный адрес встречается у >1 клиники в v7 —
 *      матч отклоняется (неоднозначность, не знаем кто дантист).
 *
 * Выход: assets/clinics-v11.db = копия v7 + колонки:
 *   has_dental INTEGER DEFAULT 0        — 0 = "нет данных", НЕ "нет стоматологии"
 *   has_dental_hygiene INTEGER DEFAULT 0
 *   appointment_phone TEXT
 *   dental_source TEXT                  — 'nhsc' если матч найден, иначе NULL
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';

const BASE =
  'https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/HealthCareFacilities/MapServer';
const V7_SRC = 'assets/clinics-v7.db';
const OUT = 'assets/clinics-v11.db';
const PAGE = 2000;

const DENTAL_FIELDS = [
  'OBJECTID', 'SITE_NM', 'SITE_ADDRESS', 'SITE_ZIP_CD',
  'APPOINT_PHONE_NUM', 'DC_DENTIST_FTE_CT', 'DC_DENTAL_HYGIENIST_FTE_CT',
];

// ── helpers ───────────────────────────────────────────────────────────────────

const s = (v) => {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};
const zip5 = (v) => s(v)?.slice(0, 5) ?? null;

// Full normalization — suite/unit preserved, abbreviations unified.
const normAddrFull = (a, z) =>
  `${(a ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bHIGHWAY\b/g, 'HWY')
    .replace(/\bSUITE\b/g, 'STE')
    .replace(/\bUNIT\b/g, 'STE')
    .replace(/\bAPT\b/g, 'STE')
    .replace(/\s+/g, ' ')
    .trim()}|${z ?? ''}`;

// ── fetch ─────────────────────────────────────────────────────────────────────

async function fetchLayer(layer, fields, orderField = 'OBJECTID') {
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
      `  layer ${layer} page ${pageNum}: +${feats.length} = ${out.length}` +
      (exceeded ? ' [exceededTransferLimit]' : '') + '\n'
    );
    if (!exceeded && feats.length < PAGE) break;
    if (feats.length === 0) break;
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== add-dental-to-v7 (v11, exact-address match) ===');
  console.log('Fetching Layer 25 (NHSC dental)…');
  const dental = await fetchLayer(25, DENTAL_FIELDS, 'OBJECTID');
  console.log(`Layer 25: ${dental.length} records`);

  // Build L25 lookup: normAddrFull → dental record (most dentists wins on collision)
  const dentalByAddr = new Map();
  for (const d of dental) {
    const key = normAddrFull(d.SITE_ADDRESS, zip5(d.SITE_ZIP_CD));
    const existing = dentalByAddr.get(key);
    if (!existing || (d.DC_DENTIST_FTE_CT ?? 0) > (existing.DC_DENTIST_FTE_CT ?? 0)) {
      dentalByAddr.set(key, d);
    }
  }

  // Copy v7 → v11
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  fs.copyFileSync(V7_SRC, OUT);
  console.log(`Copied ${V7_SRC} → ${OUT}`);

  const db = new Database(OUT);
  db.pragma('journal_mode = WAL');

  for (const col of [
    'ADD COLUMN has_dental INTEGER DEFAULT 0',
    'ADD COLUMN has_dental_hygiene INTEGER DEFAULT 0',
    'ADD COLUMN appointment_phone TEXT',
    'ADD COLUMN dental_source TEXT',
  ]) {
    try { db.exec(`ALTER TABLE clinics ${col}`); }
    catch (e) { if (!e.message.includes('duplicate column')) throw e; }
  }

  const clinics = db.prepare('SELECT id, name, address, zip FROM clinics').all();

  // Build v7 uniqueness map: normAddrFull → count of clinics
  // Keys with count > 1 are ambiguous — reject even on exact match.
  const v7KeyCount = new Map();
  for (const c of clinics) {
    const key = normAddrFull(c.address, zip5(c.zip));
    v7KeyCount.set(key, (v7KeyCount.get(key) ?? 0) + 1);
  }

  const upd = db.prepare(`
    UPDATE clinics SET
      has_dental = @has_dental,
      has_dental_hygiene = @has_dental_hygiene,
      appointment_phone = @appointment_phone,
      dental_source = 'nhsc'
    WHERE id = @id
  `);

  let matchedCount = 0;
  let rejectedAmbiguous = 0;
  const matchedDentalKeys = new Set();
  const matchedExamples = [];

  const applyMatches = db.transaction(() => {
    for (const c of clinics) {
      const key = normAddrFull(c.address, zip5(c.zip));
      const d = dentalByAddr.get(key);
      if (!d) continue;

      // Reject if this address key belongs to more than one v7 clinic
      if ((v7KeyCount.get(key) ?? 0) > 1) {
        rejectedAmbiguous++;
        continue;
      }

      upd.run({
        id: c.id,
        has_dental: (d.DC_DENTIST_FTE_CT ?? 0) > 0 ? 1 : 0,
        has_dental_hygiene: (d.DC_DENTAL_HYGIENIST_FTE_CT ?? 0) > 0 ? 1 : 0,
        appointment_phone: s(d.APPOINT_PHONE_NUM),
      });

      matchedCount++;
      matchedDentalKeys.add(key);

      if (matchedExamples.length < 10) {
        matchedExamples.push({
          clinicName: c.name,
          clinicAddr: `${c.address ?? ''}, ${c.zip ?? ''}`,
          dentalName: s(d.SITE_NM) ?? '—',
          dentalAddr: `${s(d.SITE_ADDRESS) ?? ''}, ${zip5(d.SITE_ZIP_CD) ?? ''}`,
        });
      }
    }
  });
  applyMatches();

  const unmatchedDental = dental
    .filter((d) => !matchedDentalKeys.has(normAddrFull(d.SITE_ADDRESS, zip5(d.SITE_ZIP_CD))))
    .slice(0, 10);

  // ── REPORT ────────────────────────────────────────────────────────────────

  const dentalTotal = db.prepare('SELECT COUNT(*) c FROM clinics WHERE has_dental = 1').get().c;

  console.log(`
── РЕЗУЛЬТАТ ДЖОЙНА ──────────────────────────────────────
Layer 25 записей:              ${dental.length}
Сматчилось (точный адрес):     ${matchedCount}
  из них has_dental = 1:       ${dentalTotal}
Отклонено (неоднозначность):   ${rejectedAmbiguous}
Не сматчилось (Layer 25):      ${dental.length - matchedCount - rejectedAmbiguous}
`);

  console.log('── 10 УСПЕШНЫХ МАТЧЕЙ ───────────────────────────────────────');
  for (const m of matchedExamples) {
    console.log(`  [v7]  ${m.clinicName}`);
    console.log(`        ${m.clinicAddr}`);
    console.log(`  [L25] ${m.dentalName}`);
    console.log(`        ${m.dentalAddr}`);
    console.log();
  }

  console.log('── 10 НЕСМАТЧЕННЫХ ИЗ LAYER 25 ─────────────────────────────');
  for (const d of unmatchedDental) {
    const key = normAddrFull(d.SITE_ADDRESS, zip5(d.SITE_ZIP_CD));
    const v7count = v7KeyCount.get(key) ?? 0;
    const reason = v7count > 1 ? `AMBIGUOUS (${v7count} clinics)` : 'no v7 match';
    console.log(`  [L25] ${s(d.SITE_NM) ?? '—'}`);
    console.log(`        raw: "${s(d.SITE_ADDRESS)}", zip="${zip5(d.SITE_ZIP_CD)}"`);
    console.log(`        key: "${key}"  → ${reason}`);
    console.log();
  }

  // ── SPOT-CHECK специфичных случаев ───────────────────────────────────────

  console.log('── SPOT-CHECK (AltaMed + Community Clinic Springdale) ───────');
  const spotNames = [
    'AltaMed Pharmacy - Goodrich',
    'AltaMed PACE - Westlake',
    'AltaMed General Pediatrics - Westlake, 3rd Street',
    'AltaMed Dental Group - Westlake, 3rd Street',
    'Community Clinic Springdale Medical - Pediatrics',
    'Community Clinic Springdale Dental',
  ];
  for (const name of spotNames) {
    const rows = db.prepare(
      `SELECT name, address, has_dental FROM clinics WHERE name = ? LIMIT 2`
    ).all(name);
    if (rows.length === 0) {
      // try partial match
      const row = db.prepare(
        `SELECT name, address, has_dental FROM clinics WHERE name LIKE ? LIMIT 1`
      ).get(`%${name.split(' ').slice(-3).join(' ')}%`);
      if (row) rows.push(row);
    }
    for (const r of rows) {
      const mark = r.has_dental === 1 ? '✗ НЕВЕРНО' : '✓ OK';
      const isDental = name.toLowerCase().includes('dental');
      const expected = isDental ? (r.has_dental === 1 ? '✓ OK' : '⚠ нет бейджа') : mark;
      console.log(`  has_dental=${r.has_dental}  ${isDental ? (r.has_dental === 1 ? '✓' : '⚠') : (r.has_dental === 0 ? '✓' : '✗')}  ${r.name}`);
      console.log(`             ${r.address}`);
    }
  }

  // ── REGRESSION TEST ───────────────────────────────────────────────────────

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
  const mhCount = db.prepare('SELECT COUNT(*) c FROM mh_facilities').get().c;

  console.log('\n── РЕГРЕССИОННЫЙ ТЕСТ ───────────────────────────────────────');
  console.log(`Alliance Health Centers (IN): ${allianceCount} (нужно 10)  ${allianceCount >= 10 ? '✓' : '✗ ПРОВАЛ'}`);
  console.log(`Bowen Center (IN):            ${bowenCount} (нужно 11)  ${bowenCount >= 11 ? '✓' : '✗ ПРОВАЛ'}`);
  console.log(`Fort Wayne 25 миль:           ${fwCount} (нужно ≥24) ${fwCount >= 24 ? '✓' : '✗ ПРОВАЛ'}`);
  console.log(`mh_facilities:                ${mhCount} (нужно 11992) ${mhCount === 11992 ? '✓' : '✗ ПРОВАЛ'}`);

  db.close();

  const passed = allianceCount >= 10 && bowenCount >= 11 && fwCount >= 24 && mhCount === 11992;
  if (!passed) {
    fs.unlinkSync(OUT);
    console.error('\n⛔ РЕГРЕССИОННЫЙ ТЕСТ ПРОВАЛЕН — база отклоняется, приложение на v7');
    process.exit(1);
  }

  console.log(`\n✓ Все тесты пройдены — можно обновлять database.ts на clinics-v11.db`);
  console.log(`  Записано: ${OUT}`);
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
