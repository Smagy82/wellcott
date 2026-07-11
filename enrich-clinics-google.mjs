// enrich-clinics-google.mjs
//
// Enriches clinics-v2.db with Google Places API (New).
// Two-step per clinic: Text Search (cheap, id only) → Place Details (Pro tier).
//
// Usage:
//   COUNT_ONLY=1 ONLY_STATES=CA,NY,NJ,IL node enrich-clinics-google.mjs
//   GOOGLE_API_KEY="<key>" ONLY_STATES=CA,NY,NJ,IL MAX_REQUESTS=4900 node enrich-clinics-google.mjs
//   GOOGLE_API_KEY="<key>" ONLY_STATE=IN ONLY_CITY="Fort Wayne" node enrich-clinics-google.mjs  (legacy)
//
// Billing:
//   Text Search  field mask → places.id,places.displayName  (~$2-5/1000, Ids-only/Basic SKU)
//   Place Details field mask → id,displayName,formattedAddress,location,
//                              nationalPhoneNumber,websiteUri,regularOpeningHours (~$32/1000, Pro)
//   NOT included (Enterprise $35-40/1000): rating, reviews, priceLevel, photos

import Database from 'better-sqlite3';

const KEY          = process.env.GOOGLE_API_KEY ?? null;
const DB_PATH      = process.env.DB_PATH        ?? 'assets/clinics-v2.db';
const ONLY_STATE   = process.env.ONLY_STATE     ?? null;   // legacy single-state
const ONLY_CITY    = process.env.ONLY_CITY      ?? null;
const ONLY_STATES  = process.env.ONLY_STATES    ?? null;   // new: comma-separated, e.g. CA,NY,NJ,IL
const MAX_REQUESTS = parseInt(process.env.MAX_REQUESTS ?? '5000', 10);
const COUNT_ONLY   = process.env.COUNT_ONLY === '1';

const SEARCH_ENDPOINT  = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_ENDPOINT = 'https://places.googleapis.com/v1/places';

// Text Search: only IDs → cheapest billing tier
const SEARCH_MASK = 'places.id,places.displayName';

// Place Details: strictly Pro tier — NO rating/reviews/priceLevel/photos
const DETAILS_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── DB ────────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── State filter builder ──────────────────────────────────────────────────────

function buildStateFilter() {
  if (ONLY_STATES) {
    const states = ONLY_STATES.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    return { sql: `state IN (${states.map(() => '?').join(',')})`, params: states, states };
  }
  if (ONLY_STATE) {
    const s = ONLY_STATE.trim().toUpperCase();
    return { sql: 'state = ?', params: [s], states: [s] };
  }
  return { sql: null, params: [], states: [] };
}

const stateFilter = buildStateFilter();
const stateLabel  = ONLY_STATES ?? ONLY_STATE ?? 'ALL';

// ── COUNT_ONLY ────────────────────────────────────────────────────────────────

if (COUNT_ONLY) {
  const targets = stateFilter.states.length > 0
    ? stateFilter.states
    : db.prepare('SELECT DISTINCT state FROM clinics ORDER BY state').all().map((r) => r.state);

  console.log('\nНеобогащённые клиники (google_enriched IS NULL OR = 0):\n');
  console.log('State | Count');
  console.log('------+------');

  let total = 0;
  for (const st of targets) {
    const { n } = db.prepare(
      'SELECT COUNT(*) AS n FROM clinics WHERE (google_enriched IS NULL OR google_enriched = 0) AND state = ?'
    ).get(st);
    console.log(`${st.padEnd(5)} | ${n}`);
    total += n;
  }

  console.log('------+------');
  console.log(`TOTAL | ${total}`);

  // Cost estimate (worst case: 100% match, both calls fired for every clinic)
  const matchEst = Math.round(total * 0.75); // ~75% typical match rate
  const costSearchAll  = (total   / 1000 * 5).toFixed(2);   // Text Search ~$5/1000 est.
  const costDetailsEst = (matchEst / 1000 * 32).toFixed(2); // Place Details $32/1000 (matched only)
  const costTotalEst   = (total   / 1000 * 5 + matchEst / 1000 * 32).toFixed(2);

  console.log(`\nОценка стоимости (75% match rate):`);
  console.log(`  Text Search   ${total} вызовов   @ ~$5/1000  → ~$${costSearchAll}`);
  console.log(`  Place Details ${matchEst} вызовов @ ~$32/1000 → ~$${costDetailsEst}`);
  console.log(`  ИТОГО ~$${costTotalEst}`);

  const capCost = ((Math.min(total, MAX_REQUESTS) * 0.75 / 1000 * 32 + Math.min(total, MAX_REQUESTS) / 1000 * 5)).toFixed(2);
  console.log(`\nПри MAX_REQUESTS=${MAX_REQUESTS}: один прогон ~$${capCost}`);

  db.close();
  process.exit(0);
}

// ── Normal run ────────────────────────────────────────────────────────────────

if (!KEY) throw new Error('Задай GOOGLE_API_KEY');

const existingCols = db.pragma('table_info(clinics)').map((r) => r.name);
if (!existingCols.includes('place_id'))
  db.exec('ALTER TABLE clinics ADD COLUMN place_id TEXT');
if (!existingCols.includes('hours_json'))
  db.exec('ALTER TABLE clinics ADD COLUMN hours_json TEXT');
if (!existingCols.includes('google_enriched'))
  db.exec('ALTER TABLE clinics ADD COLUMN google_enriched INTEGER DEFAULT 0');

// ── Build SELECT ──────────────────────────────────────────────────────────────

let selectSql = 'SELECT id, name, address, city, state, zip, phone, website FROM clinics WHERE (google_enriched IS NULL OR google_enriched = 0)';
const selectParams = [];

if (stateFilter.sql) {
  selectSql += ` AND ${stateFilter.sql}`;
  selectParams.push(...stateFilter.params);
}
if (ONLY_CITY) {
  selectSql += ' AND city = ?';
  selectParams.push(ONLY_CITY);
}

selectSql += ` LIMIT ${MAX_REQUESTS}`;

const rows = db.prepare(selectSql).all(...selectParams);

console.log(`\nКлиник для обогащения: ${rows.length} (states=${stateLabel}, cap=${MAX_REQUESTS})`);
if (rows.length === 0) { db.close(); process.exit(0); }

// ── Prepared statements ───────────────────────────────────────────────────────

const updateMatched = db.prepare(`
  UPDATE clinics SET
    place_id        = ?,
    hours_json      = ?,
    phone           = CASE WHEN (phone IS NULL OR phone = '') THEN ? ELSE phone END,
    website         = CASE WHEN (website IS NULL OR website = '') THEN ? ELSE website END,
    google_enriched = 1
  WHERE id = ?
`);

const updateNoMatch = db.prepare('UPDATE clinics SET google_enriched = 1 WHERE id = ?');

// ── Main loop ─────────────────────────────────────────────────────────────────

let matched = 0, noMatch = 0, errors = 0, withHours = 0;
let textSearchCalls = 0, detailsCalls = 0;

for (let i = 0; i < rows.length; i++) {
  const { id, name, address, city, state, zip } = rows[i];
  const textQuery = `${name} ${address} ${city} ${state} ${zip}`;

  process.stdout.write(`[${i + 1}/${rows.length}] ${name.slice(0, 46).padEnd(46)} `);

  try {
    // Step 1 — Text Search: get place ID (cheap SKU)
    const searchRes = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': SEARCH_MASK,
      },
      body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    });
    textSearchCalls++;

    if (!searchRes.ok) {
      const txt = await searchRes.text();
      throw new Error(`Search ${searchRes.status}: ${txt.slice(0, 100)}`);
    }

    const searchJson = await searchRes.json();
    const hit = searchJson.places?.[0];

    if (!hit) {
      updateNoMatch.run(id);
      noMatch++;
      console.log('— no match');
    } else {
      // Step 2 — Place Details: Pro fields
      await sleep(60);

      const detailsRes = await fetch(`${DETAILS_ENDPOINT}/${hit.id}`, {
        headers: {
          'X-Goog-Api-Key':   KEY,
          'X-Goog-FieldMask': DETAILS_MASK,
        },
      });
      detailsCalls++;

      if (!detailsRes.ok) {
        const txt = await detailsRes.text();
        throw new Error(`Details ${detailsRes.status}: ${txt.slice(0, 100)}`);
      }

      const detail = await detailsRes.json();
      const hoursJson = detail.regularOpeningHours?.weekdayDescriptions
        ? JSON.stringify(detail.regularOpeningHours.weekdayDescriptions)
        : null;
      const newPhone   = detail.nationalPhoneNumber ?? null;
      const newWebsite = detail.websiteUri ?? null;

      updateMatched.run(hit.id, hoursJson, newPhone, newWebsite, id);
      matched++;
      if (hoursJson) withHours++;
      console.log(`✓ ${(detail.displayName?.text ?? hit.displayName?.text ?? hit.id).slice(0, 60)}`);
    }
  } catch (e) {
    console.log(`ERR ${e.message}`);
    errors++;
  }

  // Progress report every 100
  if ((i + 1) % 100 === 0 || i === rows.length - 1) {
    const pct         = (((i + 1) / rows.length) * 100).toFixed(1);
    const costSearch  = (textSearchCalls / 1000 * 5).toFixed(2);
    const costDetails = (detailsCalls    / 1000 * 32).toFixed(2);
    const costTotal   = (textSearchCalls / 1000 * 5 + detailsCalls / 1000 * 32).toFixed(2);
    console.log(
      `\n── [${i + 1}/${rows.length} = ${pct}%] matched=${matched} noMatch=${noMatch} hours=${withHours} err=${errors}` +
      ` | search ~$${costSearch} + details ~$${costDetails} = ~$${costTotal} ──\n`
    );
  }

  if (i < rows.length - 1) await sleep(120);
}

// Remaining after this run
const remainSql = 'SELECT COUNT(*) AS n FROM clinics WHERE (google_enriched IS NULL OR google_enriched = 0)' +
  (stateFilter.sql ? ` AND ${stateFilter.sql}` : '');
const { n: remaining } = db.prepare(remainSql).get(...stateFilter.params);

db.close();

console.log('\n══ Готово ══');
console.log(`Обработано : ${rows.length} | matched=${matched} | no match=${noMatch} | errors=${errors}`);
console.log(`С часами   : ${withHours}`);
console.log(`API-вызовы : textSearch=${textSearchCalls}, details=${detailsCalls}`);
console.log(`Стоимость  : ~$${(textSearchCalls / 1000 * 5 + detailsCalls / 1000 * 32).toFixed(2)}`);
console.log(`Осталось (${stateLabel}): ${remaining}`);
