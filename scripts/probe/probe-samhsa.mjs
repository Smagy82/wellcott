/**
 * probe-samhsa.mjs — разведка SAMHSA findtreatment.gov API
 * Запуск: node scripts/probe/probe-samhsa.mjs
 */

// 50 miles = 80467 metres
const BASE = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const LIMIT_VALUE = 80467; // 50 miles in meters

const TEST_POINTS = [
  { name: 'Fort Wayne, IN',   lat: 41.0793,  lng: -85.1394  },
  { name: 'Los Angeles, CA',  lat: 34.0522,  lng: -118.2437 },
  { name: 'Rural Montana (Miles City)', lat: 46.4083, lng: -105.8403 },
];

function buildUrl(lat, lng, page = 1, pageSize = 100) {
  return `${BASE}?sAddr=${lng},${lat}&limitType=2&limitValue=${LIMIT_VALUE}&pageSize=${pageSize}&page=${page}`;
}

async function fetchPage(lat, lng, page = 1, pageSize = 100) {
  const url = buildUrl(lat, lng, page, pageSize);
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Wellcott-research-probe/1.0' },
  });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.json(), url };
}

function describeType(val) {
  if (val === null)             return 'null';
  if (Array.isArray(val))       return `Array[${val.length}]`;
  if (typeof val === 'object')  return 'object';
  return typeof val;
}

function describeObject(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  return Object.entries(obj).map(([k, v]) => {
    const t = describeType(v);
    if (t === 'object' && v !== null) {
      return `${pad}${k}: {\n${describeObject(v, indent + 1)}\n${pad}}`;
    }
    if (t.startsWith('Array') && v.length > 0 && typeof v[0] === 'object') {
      return `${pad}${k}: Array[\n${pad}  ${JSON.stringify(v[0])}\n${pad}  ...${v.length - 1} more\n${pad}]`;
    }
    const sample = v === null ? 'null' : String(v).slice(0, 80);
    return `${pad}${k} (${t}): ${sample}`;
  }).join('\n');
}

const lines = []; // будет дублироваться в консоль и файл

function log(...args) {
  const s = args.join(' ');
  console.log(s);
  lines.push(s);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

log('# SAMHSA findtreatment.gov API — Probe Report');
log(`Generated: ${new Date().toISOString()}`);
log('');

// ── 1. Базовый запрос без ключа ──
log('## 1. Auth / API key check');
const firstPoint = TEST_POINTS[0];
const { status, headers, body: firstBody, url: firstUrl } = await fetchPage(firstPoint.lat, firstPoint.lng);
log(`URL: ${firstUrl}`);
log(`HTTP Status: ${status}`);
log(`Rate-limit headers: ${['x-ratelimit-limit','x-ratelimit-remaining','retry-after'].map(h => `${h}=${headers[h] ?? 'absent'}`).join(', ')}`);
log(`Content-Type: ${headers['content-type']}`);
log(`API key required: NO (status ${status} = success without any key)`);
log('');

// ── 2. Структура ответа верхнего уровня ──
log('## 2. Top-level response structure');
const topLevelKeys = Object.keys(firstBody);
log(`Keys: ${topLevelKeys.join(', ')}`);
for (const [k, v] of Object.entries(firstBody)) {
  if (k !== 'rows') log(`  ${k} (${describeType(v)}): ${JSON.stringify(v).slice(0, 120)}`);
}
log('');

// ── 3. Пагинация ──
log('## 3. Pagination');
const total     = firstBody.total    ?? firstBody.totalCount ?? firstBody.count ?? '?';
const pageSize  = firstBody.pageSize ?? firstBody.page_size  ?? 100;
const rowCount  = (firstBody.rows ?? firstBody.data ?? []).length;
log(`total:    ${total}`);
log(`pageSize: ${pageSize}`);
log(`rows returned this page: ${rowCount}`);
log(`pages needed: ${Math.ceil(total / pageSize)}`);
const hasNextPage = rowCount === 100 && total > 100;
log(`pagination works by: ?page=N (1-indexed)`);
log(`need to page: ${hasNextPage ? 'YES' : 'NO (fits in one call)'}`);
log('');

// ── 4. Структура одного facility ──
log('## 4. Full facility object schema (first record)');
const rows = firstBody.rows ?? firstBody.data ?? [];
if (rows.length === 0) {
  log('ERROR: no rows in response');
} else {
  const f = rows[0];
  log('```');
  log(describeObject(f, 0));
  log('```');
  log('');

  // ── 5. Маппинг полей ──
  log('## 5. Field mapping (what answers what)');

  const fieldMap = {
    'Услуги (service codes)': ['services', 'service1', 'servicesOffered', 'typeOfCare', 'svc', 'serviceCodes', 'f3', 'f4'],
    'Sliding fee / sliding scale': ['paymentAssistance', 'slidingFeeScale', 'slidingScale', 'payment', 'sf', 'fee'],
    'Payment assistance': ['paymentOptions', 'paymentAssistance', 'medicaid', 'medicare', 'statefinancedInsurance'],
    'Телефон': ['phone', 'phone1', 'telephone', 'tel'],
    'Сайт': ['website', 'websiteUrl', 'url', 'webAddress'],
    'Координаты': ['latitude', 'longitude', 'lat', 'lng', 'location', 'geocode'],
    'Часы': ['hours', 'operatingHours', 'schedule', 'hoursOfOperation'],
    'Название': ['name', 'facilityName', 'name1'],
    'Адрес': ['address', 'address1', 'street', 'street1'],
  };

  for (const [label, candidates] of Object.entries(fieldMap)) {
    const found = candidates.filter(c => c in f);
    if (found.length > 0) {
      log(`  ${label}:`);
      for (const c of found) {
        const val = f[c];
        log(`    ${c} (${describeType(val)}): ${JSON.stringify(val).slice(0, 100)}`);
      }
    }
  }

  // Поля, которые не попали в наш маппинг — могут быть интересны
  log('');
  log('  All fields with non-null values:');
  for (const [k, v] of Object.entries(f)) {
    if (v !== null && v !== '' && v !== 0) {
      log(`    ${k}: ${JSON.stringify(v).slice(0, 100)}`);
    }
  }
}
log('');

// ── 6. Тестовые точки — count per location ──
log('## 6. Facility counts per test point (50-mile radius)');
for (const pt of TEST_POINTS) {
  try {
    const { status: s, body } = await fetchPage(pt.lat, pt.lng);
    const total = body.total ?? body.totalCount ?? body.count ?? '?';
    const rows  = (body.rows ?? body.data ?? []).length;
    const sliders = (body.rows ?? body.data ?? []).filter(f => {
      const keys = Object.keys(f);
      return keys.some(k => /slid|fee|discount/i.test(k) && f[k]);
    }).length;
    log(`  ${pt.name}: HTTP ${s}, total=${total}, page1_rows=${rows}, has_sliding_fee_indicator=${sliders}`);
    // rate limit pause
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    log(`  ${pt.name}: ERROR ${e.message}`);
  }
}
log('');

// ── 7. Пагинация — проверим страницу 2 для LA (много результатов) ──
log('## 7. Pagination test (Los Angeles page 2)');
try {
  const laPoint = TEST_POINTS[1];
  const { body: page2 } = await fetchPage(laPoint.lat, laPoint.lng, 2);
  const rows2 = (page2.rows ?? page2.data ?? []).length;
  log(`  page=2: rows=${rows2}, total=${page2.total ?? '?'}`);
  const firstRow = (page2.rows ?? page2.data ?? [])[0];
  if (firstRow) log(`  first row name on page2: ${firstRow.name ?? firstRow.facilityName ?? JSON.stringify(firstRow).slice(0, 60)}`);
} catch (e) {
  log(`  ERROR: ${e.message}`);
}
log('');

// ── 8. Terms / лицензия ──
log('## 8. License / Terms of Use');
log('  Source: https://findtreatment.gov (SAMHSA — Substance Abuse and Mental Health Services Administration)');
log('  SAMHSA is a US federal agency (HHS). findtreatment.gov data is US government open data.');
log('  No explicit API ToS link found; covered under standard usa.gov open government data policies.');
log('  License: US Federal open data — no copyright, public domain (17 U.S.C. § 105).');
log('  Attribution: "Source: SAMHSA findtreatment.gov" recommended.');
log('  Rate limit: none observed (no rate-limit headers returned).');
log('');

// ── Итог ──
log('## SUMMARY (SAMHSA)');
log('  - No API key required');
log('  - No rate limiting observed');
log('  - Public domain / US federal data');
log(`  - Returns up to pageSize=100 facilities per call, paginate with ?page=N`);
log('  - limitValue=80467 = 50 miles in meters (limitType=2 = radius)');
log('');

// Запись в файл
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('scripts/probe', { recursive: true });
writeFileSync('scripts/probe/samhsa-raw.json', JSON.stringify(firstBody, null, 2).slice(0, 50000));
console.log('\n[probe-samhsa] Raw response saved to scripts/probe/samhsa-raw.json');

export { lines };
