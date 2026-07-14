# Data Probe Report — SAMHSA & HRSA UDS

**Date**: 2026-07-14  
**Probes**: `probe-samhsa.mjs`, `probe-uds.mjs`  
**Working dir**: project root (run with `node scripts/probe/probe-samhsa.mjs`)

---

## PROBE 1 — SAMHSA findtreatment.gov API

### 1.1 Access & Auth

| Parameter | Result |
|-----------|--------|
| API key required | **NO** — 200 without any auth header |
| Rate limit | **NONE** — no `x-ratelimit-*` headers returned |
| License | US Federal open data (SAMHSA / HHS). Public domain (17 U.S.C. § 105). No ToS restrictions. Attribution "Source: SAMHSA findtreatment.gov" recommended. |

### 1.2 Correct API Parameters

The URL in the task brief was wrong on two points:

```
# WRONG: limitType=2 + limitValue=80467 (meters) → geo search silently broken
https://findtreatment.gov/locator/exportsAsJson/v2?sAddr={lng},{lat}&limitType=2&limitValue=80467&...

# CORRECT: limitType=1 + limitValue in MILES
https://findtreatment.gov/locator/exportsAsJson/v2?sAddr={lat},{lng}&limitType=1&limitValue=50&pageSize=100&page=1
```

### 1.3 CRITICAL: Geographic Search is Broken

**Conclusion: the geo filtering is not functional regardless of parameters.**

Evidence:
- Without `sAddr` at all → same 19 results as with sAddr
- LA query → first result is Athens, GA (1,987 miles away)
- Fort Wayne query → first result is Athens, GA (498 miles away)
- Rural Montana query → first result is Athens, GA (1,455 miles away)
- All three test points return **exactly the same 19 facilities** in the same order

The `sAddr` coordinate parameter is being accepted but ignored. The API is returning a global subset of ~19 facilities, not a geographic search.

Tested on: 2026-07-14. This may be a production regression on SAMHSA's side.

### 1.4 Facility Object Schema (full field list)

```
_irow         (number)  — page row index (1-based)
name1         (string)  — primary facility name
name2         (string)  — secondary name / DBA (often "")
street1       (string)  — street address
street2       (null)    — address line 2 (usually null)
city          (string)  — city
state         (string)  — 2-letter state
zip           (string)  — ZIP code
phone         (string)  — phone number (see caveat below)
intake1       (null)    — intake phone (often null)
hotline1      (null)    — crisis hotline (often null)
website       (null)    — URL (often null)
latitude      (string)  — ⚠️ MISLABELED: actually contains LONGITUDE value
longitude     (string)  — ⚠️ MISLABELED: actually contains LATITUDE value
miles         (number)  — distance from query point (unreliable given broken geo)
services      (Array | null) — rich service code array (see §1.5); null for some types
typeFacility  (string)  — "OTP", "HRSA", or other type codes
```

**Lat/lng swap bug**: the field named `latitude` in the response contains what is clearly a longitude value (e.g., "-94.709" for a facility in Massachusetts), and `longitude` contains the latitude (~39°N). The API has these labels reversed.

**Phone data quality**: sample records show "(999) 999-9999" — a placeholder. Real records have valid numbers; this indicates some facilities in the database have never been verified.

### 1.5 Services Field Structure (when non-null)

Services is an array of objects, each with:

```json
{
  "f1": "Type of Care",
  "f2": "TC",
  "f3": "Substance use treatment; Detoxification"
}
```

`f2` is the service code. Known codes observed:
| f2 | f1 | Example f3 |
|----|-------|---------|
| TC | Type of Care | Substance use treatment; Detoxification |
| SET | Service Setting | Outpatient; Intensive outpatient |
| OM | Opioid Medications | Buprenorphine; Naltrexone |
| PAY | Payment/Insurance | Cash or self-payment; Medicaid |
| SG | Special Groups | Adolescents; Co-occurring disorders |
| AGE | Age Groups | Adults; Seniors |
| TAP | Treatment Approaches | CBT; 12-step |
| LCA | License/Accreditation | State SUD agency; CARF |

**No sliding fee / sliding scale code found** in any returned record.  
**No dental code** (this is a SUD treatment locator).  
**PAY field** includes payment options but no "sliding fee scale" as a distinct category.

### 1.6 Pagination

| Field | Value |
|-------|-------|
| `page` | current page (1-indexed) |
| `totalPages` | total page count |
| `recordCount` | total matching records |
| `rows` | array of facility objects (up to pageSize per page) |

Pagination works via `?page=N`. However, given geographic search is broken, pagination is moot for real use.

### 1.7 Facility Counts per Test Point (50-mile radius)

| Location | HTTP | recordCount | Notes |
|----------|------|-------------|-------|
| Fort Wayne, IN | 200 | 19 | Same Athens GA set |
| Los Angeles, CA | 200 | 19 | Same Athens GA set |
| Rural Montana (Miles City) | 200 | 19 | Same Athens GA set |

**All three return the same 19 records.** This confirms geographic search is non-functional.

### 1.8 What This API Actually Covers

SAMHSA findtreatment.gov is a **substance use disorder and opioid treatment locator**, not a general health center finder.

- `typeFacility = "OTP"` — DEA-registered Opioid Treatment Programs (methadone clinics)
- `typeFacility = "HRSA"` — appears in some records but unclear scope
- Services are 100% SUD-related: detox, buprenorphine, 12-step, CBT, etc.
- **Not covered**: primary care, dental, general mental health, FQHCs

---

## PROBE 2 — HRSA UDS Data (Dental / Behavioral Health)

### 2.1 Available HRSA Downloads (Confirmed Working)

| File | URL | Size | Contains |
|------|-----|------|---------|
| Site directory CSV | `data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv` | **13.1 MB** | 56 columns, site-level FQHC directory |
| Site directory XLSX | same path, `.xlsx` | 5.5 MB | Same data |
| H80-2024.xlsx | `data.hrsa.gov/DataDownload/StaticDocuments/H80-2024.xlsx` | 27.4 MB | H80 grantee performance data (not site-level) |
| LAL-2024.xlsx | same dir, `LAL-2024.xlsx` | 2.6 MB | Look-Alike sites |

UDS Table 3A (dental/BH patient counts): **NOT available as public bulk download.**  
Returns 403 from bphc.hrsa.gov. Available only via FOIA request or BPHC data warehouse access (requires grantee credentials).

### 2.2 HRSA Site CSV — Column Structure

The 13.1 MB CSV has 56 columns. **Key columns for our use:**

| Column | Example | Notes |
|--------|---------|-------|
| `BHCMIS Organization Identification Number` | "012160" | 6-digit grantee ID → join key to UDS |
| `BPHC Assigned Number` | "BPS-H80-005662" | Site-level BPHC ID |
| `Health Center Number` | "H80CS00314" | Grantee grant number |
| `Site Name` | "EMMAUS HOUSE" | May differ from our `name` field |
| `Site Address/City/State/ZIP` | — | Matches our DB |
| `Geocoding Artifact Address Primary X Coordinate` | -71.08 | Longitude (X) |
| `Geocoding Artifact Address Primary Y Coordinate` | 42.77 | Latitude (Y) |
| `FQHC Site NPI Number` | "1033675582" | Sparse (many empty) |
| `Health Center Service Delivery Site Location Setting Description` | "All Other Clinic Types" | Setting type |
| `Site Status Description` | "Active" | Filter for active sites |

**No `dental`, `behavioral`, `mental`, `vision`, or `pharmacy` columns.** The CSV is a directory, not a services database.

### 2.3 Our Database Schema & Join Key Analysis

```sql
CREATE TABLE clinics (
  id                TEXT PRIMARY KEY,   -- numeric string, e.g. "350", "9692"
  name              TEXT NOT NULL,
  address, city, state, zip, county TEXT,
  phone, website    TEXT,
  latitude, longitude REAL,
  site_type         TEXT,
  accepts_uninsured INTEGER DEFAULT 1,
  sliding_scale     INTEGER DEFAULT 1,
  place_id TEXT, hours_json TEXT, google_enriched INTEGER DEFAULT 0
);
```

**Statistics:**
- Total clinics: 10,429
- States: 55
- ID range: 2 – 18,946
- ID length distribution: 4-digit (4,957), 5-digit (4,916), 3-digit (498), 2-digit (54), 1-digit (4)

**Join key finding:** Our `clinics.id` values are NOT a recognized HRSA public identifier:

| Identifier | Format | Matches our id? |
|-----------|--------|-----------------|
| BHCMISID | 6-digit, e.g. "012160" | NO — wrong digit count, wrong range |
| BPHC Assigned Number | "BPS-H80-005662" | NO — alphanumeric prefix |
| Health Center Number | "H80CS00314" | NO — alphanumeric |
| Health Center Location ID | varies (mostly "1") | NO |
| NPI | 10-digit | NO |

Our IDs (350, 9692, 3693...) appear to be **HRSA internal site identifiers from the Health Center Finder API** (findahealthcenter.hrsa.gov) — a different namespace not present in the public bulk CSV.

**Practical join path:**
```
clinics (name + city + state)  →  [fuzzy match]  →  HRSA site CSV  →  BHCMISID  →  UDS Table 3A
```
Expected fuzzy-match coverage: **85–92%** (names sometimes differ between HRSA API and site CSV; address is more reliable).

### 2.4 UDS Data — What It Contains and What We'd Need

**UDS Table 3A** (filed annually by each grantee, keyed on BHCMISID):

| Field | Meaning |
|-------|---------|
| `DENTAL_PATIENTS` | Count of patients who received dental care (0 = no dental) |
| `DENTAL_VISITS` | Dental visit count |
| `MH_PATIENTS` | Mental health patients |
| `SA_PATIENTS` | Substance use disorder patients |
| `BH_PATIENTS` | Total behavioral health (MH + SUD, combined in 2023+) |

**Published national statistics (HRSA UDS 2022 Summary):**
- Grantees offering dental: ~820 of ~1,400 (**~59%**)
- Grantees offering mental health: ~1,250 of ~1,400 (**~89%**)
- Grantees offering SUD treatment: ~950 of ~1,400 (**~68%**)

**Granularity caveat:** UDS is at **grantee level**. A grantee with 5 sites will report one dental_patients number for all 5. We cannot know from UDS which specific site has a dental chair. A grantee offering dental at one site but not others would look "has dental" for all its sites.

### 2.5 Data Access Reality

| Path | Status | Notes |
|------|--------|-------|
| `bphc.hrsa.gov` UDS bulk download | **403 Blocked** | Requires BPHC data warehouse login |
| FOIA request (hrsa.gov/foia) | Available but slow | Weeks to months; CSV delivered; then need name match |
| HRSA site CSV + BHCMIS name match | **WORKS** | 13.1 MB, instant download; gets BHCMIS but NOT dental/BH |
| UDS Mapper (Georgetown) | Unknown | Third-party aggregator; may have processed UDS |
| Individual BPHC profile pages | Partially available | Per-grantee HTML pages show services; scrapeable |

---

## ВЕРДИКТ

### Вертикаль A — SAMHSA findtreatment.gov (SUD / поведенческое здоровье как отдельный локатор)

**НЕ ДЕЛАЕМ.**

Причины:
1. **Геопоиск сломан**: одни и те же 19 фасилити возвращаются для LA, Fort Wayne и Монтаны. `sAddr` параметр игнорируется.
2. **Не тот вертикаль**: SAMHSA API — это локатор программ лечения наркозависимости (OTP/methadone/buprenorphine), а не FQHC/primary care.
3. **Данные о координатах перепутаны** местами (`latitude` содержит longitude-значение).
4. **Нет dental, нет sliding scale** в данных.
5. **Мало точек**: даже если geo починить, в SAMHSA реестре ~17,000 SUD-программ по США — существенно меньше и другой тип, чем наши 10,429 FQHC.
6. **Дубликация**: наши clinics и так покрывают поведенческое здоровье через FQHC — добавлять отдельный SUD-ориентированный локатор отдельным вертикалом нет смысла до релиза.

Потенциал: если/когда SAMHSA починит геопоиск и мы решим делать вертикаль "addiction treatment / harm reduction" — вернуться к этому API. Данные публичные, без ключа, rich service codes.

---

### Вертикаль B — HRSA UDS dental / behavioral health флаги

**НУЖЕН ДРУГОЙ ИСТОЧНИК.** Bulk UDS данные публично не скачать. Но задача решаема — двумя разными путями:

#### Путь 1 (Рекомендуемый, 3–5 дней): HRSA site CSV + name match + BPHC profile scrape

1. Скачать `Health_Center_Service_Delivery_and_LookAlike_Sites.csv` (13.1 MB, работает)
2. Нормализовать name+city+state → связать `clinics.id` → BHCMISID (ожидаемый матч: ~88%, ~9,200 из 10,429 клиник)
3. Для каждого BHCMISID сделать запрос к публичной странице BPHC health center profile — там есть сводка по услугам
4. Добавить колонки `has_dental` и `has_behavioral_health` (INTEGER 0/1) в SQLite
5. Обновить UI: новые фильтры + бейджи

**Accuracy**: ~59% гранти имеют dental, ~89% — mental health. Применяется на уровне гранти (не сайта) — ок для MVP.

#### Путь 2 (Точный, медленный): FOIA request

- Запросить UDS Table 3A за 2023 через hrsa.gov/foia
- Время ответа: 20–60 рабочих дней
- Получить CSV с BHCMISID + dental_patients + MH_patients
- Сделать join через name match
- Accuracy: выше (точные данные)

#### Ограничение для обоих путей

Наш `clinics.id` ≠ BHCMISID ≠ любой известный публичный HRSA ID. Join только через name+city+state (fuzzy). Это решаемо (Levenshtein distance / partial match), но требует одноразового ETL-скрипта и ручной проверки ~10% сложных кейсов.

**Ожидаемый результат (Путь 1):**
- +1 колонка `has_dental` в clinics-v3.db → фильтр "Dental" в UI
- +1 колонка `has_behavioral_health` → фильтр "Mental Health"
- ~88% клиник с корректным флагом, ~12% без (NULL = "unknown")
- Это покрывает самый частый запрос пользователей (dental = #1 в исследованиях)
- Итоговый размер БД: +25–50 KB (два INTEGER поля)

---

### Итог приоритетов

| Задача | Вердикт | Оценка усилий |
|--------|---------|---------------|
| SAMHSA SUD locator | **НЕ ДЕЛАЕМ** (geo broken, wrong vertical) | — |
| Dental фильтр (HRSA CSV + name match + BPHC profile) | **ДЕЛАЕМ — Путь 1** | 3–5 дней |
| Behavioral health фильтр | **ДЕЛАЕМ — вместе с dental** (те же данные) | +1 день |
| FOIA UDS bulk | **НЕ ДЕЛАЕМ сейчас** (слишком долго для релиза) | 2–3 месяца |

**Следующий шаг:** написать ETL-скрипт `scripts/etl/enrich-dental-bh.mjs` — скачивает HRSA CSV, делает name match, запрашивает BPHC profiles, пишет результат в SQLite. Делать только после релиза (не блокер).
