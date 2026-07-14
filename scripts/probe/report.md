# Data Probe Report — SAMHSA & HRSA UDS

**Date**: 2026-07-13  
**Probes**: `probe-samhsa.mjs`, `probe-uds.mjs`, ручные curl-тесты  
**Working dir**: project root

---

## PROBE 1 — SAMHSA findtreatment.gov API

### 1.1 Access & Auth

| Parameter | Result |
|-----------|--------|
| API key required | **NO** — 200 без auth header |
| Rate limit | **NONE** — нет `x-ratelimit-*` headers |
| License | US Federal open data (SAMHSA / HHS). Public domain (17 U.S.C. § 105). Offline кэш и бандлинг в приложении **разрешены**. Рекомендуется attribution: "Source: SAMHSA findtreatment.gov". |

### 1.2 Правильные параметры API

```
GET https://findtreatment.gov/locator/exportsAsJson/v2
  ?sAddr={lat},{lng}    ← ШИРОТА ПЕРВОЙ (PDF Table 2 содержит опечатку — lng,lat)
  &limitType=2          ← 0=штат, 1=county, 2=радиус в метрах
  &limitValue=80467     ← 50 миль в метрах (16093=10 миль)
  &sType=mh             ← только mental health; без параметра — все типы (SUD+MH)
  &pageSize=100         ← max 2000
  &page=1               ← 1-indexed
```

⚠️ **Баг в начальном зонде**: первая версия probe-samhsa.mjs использовала `sAddr={lng},{lat}` — перепутаны координаты. Все три точки возвращали одни и те же 19 объектов (дефолтный регион API). **Зонд был сломан, а не источник.**

### 1.3 Подтверждённый геопоиск (50-миль радиус, sType=mh)

| Точка | recordCount | totalPages | PYAS (payment assist) | из них sliding scale |
|-------|-------------|------------|----------------------|----------------------|
| Los Angeles, CA (34.0522, −118.2437) | **471** | 5 | 39/100 | 18/100 |
| Fort Wayne, IN (41.0793, −85.1394) | **57** | 1 | 35/57 | 30/57 |
| Rural Montana / Miles City (46.4083, −105.8403) | **2** | 1 | 2/2 | 2/2 |

LA >> Montana → геопоиск работает корректно.

### 1.4 Национальный охват (sType=mh, все штаты + DC)

Все 51 запрос выполнен с `limitType=0` (по штату):

| Метрика | Значение |
|---------|---------|
| **Всего MH-facilities по США** | **12,427** |
| Крупнейшие штаты | CA=1007, NY=834, OH=664, FL=559, IL=474, PA=455 |
| Малонаселённые | WY=43, ND=45, SD=37, VT=61, HI=22 |

Это только `sType=mh` (mental health). С добавлением `sType=sa` (SUD) и `sType=both` цифра будет больше. SAMHSA говорит о ~17,000 суммарно по обоим типам.

### 1.5 Sliding Fee — как это работает

`PYAS` ("Payment Assistance Available") ≠ "sliding fee scale".  
- `PYAS` означает "уточни у facility" — общий флаг payment assistance.  
- ~40% объектов с `PYAS` содержат в поле `f3` строку "Sliding fee scale" — это реальный sliding scale.
- Фильтр sliding scale в UI: `services[].f2 === 'PYAS' && services[].f3?.includes('Sliding fee scale')`.

### 1.6 Bulk Download

`N-SUMHSS` (National Survey of Mental Health and Substance Use Treatment Services) — ежегодный опрос SAMHSA. **Bulk PUF (Public Use File) не доступен**: все протестированные URL возвращают 404. Единственный публичный путь к данным — `findtreatment.gov` API.

### 1.7 Структура facility-объекта

```json
{
  "name1": "...",       "name2": "...",
  "street1": "...",     "city": "...", "state": "CA", "zip": "...",
  "phone": "...",
  "website": "...",
  "latitude": "34.044...",    ← строка, НЕ число
  "longitude": "-118.24...",
  "miles": 0.5,
  "typeFacility": "MH",
  "services": [
    { "f1": "Type of Care",              "f2": "TC",   "f3": "Mental health treatment services" },
    { "f1": "Payment Assistance Avail.", "f2": "PYAS", "f3": "Sliding fee scale (fee is based on income and other factors)" }
  ]
}
```

Поля `latitude` / `longitude` — строки, нужно `parseFloat()`. `services` может быть `null` для некоторых facility-типов.

---

## PROBE 2 — HRSA Dental / Behavioral Health Data

### 2.1 Доступные публичные файлы HRSA

| Файл | Размер | Содержит |
|------|--------|---------|
| `Health_Center_Service_Delivery_and_LookAlike_Sites.csv` | 13.1 MB | 56 колонок, directory сайтов, **содержит BHCMISID**, но **нет dental/BH** |
| `SITE_DASHBOARD.csv` (через data.hrsa.gov) | 38 MB | 18 колонок: имя, адрес, тип сайта, Grant Number; **нет dental/BH** |
| `H80-2024.xlsx` | 27.4 MB | H80 grantee performance, не по сайтам |
| `BCD_HC.zip` (заявленный crosswalk BCD_ID→BHCMISID) | **404** | **Не существует** публично |

### 2.2 Join Key — Полный анализ

**Наш `clinics.id`** = `HCC_FCT_ID` из HRSA HDW API.

Из исходника `build-clinic-db.mjs`:
```javascript
id: String(r.HCC_FCT_ID ?? `${r.SITE_NM}|${r.SITE_ZIP_CD}`),
```

Из HRSA developer guide (`DeveloperGuide.pdf`): `HCC_FCT_ID` = "Health Center Site Fact Identification Number; One-up incremental counter for new entities."

**Полный список полей HRSA HDW API** (из developer guide):  
`ROW_ID`, `SITE_NM`, `SITE_URL`, `HCC_FCT_ID`, `SITE_ADDRESS`, `SITE_CITY`, `STATE_NM`, `SITE_STATE_ABBR`, `SITE_ZIP_CD`, `SITE_PHONE_NUM`, `HCC_LOC_DESC`, `HCC_TYP_DESC`, `DW_RECORD_CREATE_DT`, `APPROX_VALUE_CD`, `LAT_LON`, `Distance`

**`BHCMISID` в API отсутствует** — не просто не сохранялся в ETL, его нет в ответе API вообще.

**Матрица публичных идентификаторов HRSA:**

| Источник | HCC_FCT_ID | BHCMISID | Dental/BH |
|----------|-----------|----------|-----------|
| HRSA HDW API (наш источник) | ✅ | ❌ | ❌ |
| Публичный site CSV (13.1 MB) | ❌ | ✅ | ❌ |
| SITE_DASHBOARD.csv (38 MB) | ❌ | ❌ | ❌ |
| BCD_HC.zip (crosswalk) | — | — | — (404) |
| UDS Table 5 (dental FTE, BH FTE) | ❌ | ✅ (ключ) | ✅ (но нет bulk download) |

**Вывод**: детерминированный join `HCC_FCT_ID` → `BHCMISID` **невозможен** через публичные данные. Единственный мост — адресный match (name+city+state), который отклонён.

### 2.3 UDS Данные — Что содержит, что доступно

**UDS Table 3A** ("Services Rendered") — количество пациентов по типам услуг на уровне grantee:  
`dental_patients`, `medical_patients`, `BH_patients`, `enabling_services_patients`

**UDS Table 5** ("Staffing & Utilization") — FTE персонала:  
`dental_FTE`, `BH_FTE` (LCSW, psychiatrist, etc.)

Оба — **на уровне grantee, не сайта**. Один grantee может иметь 1–20+ сайтов.

**Доступность**:
- `bphc.hrsa.gov` bulk download → **403** (требует BPHC data warehouse login)
- FOIA запрос → доступен, но 20–60 рабочих дней; CSV с BHCMISID + dental_patients
- BPHC profile pages (по grantee) → **403 CDN (Akamai)** блокирует bot requests

Из HRSA UDS 2022 Summary (опубликованная агрегированная статистика):
- Grantees с dental: **~820 из ~1,400 (~59%)**
- Grantees с MH: **~1,250 из ~1,400 (~89%)**
- Grantees с SUD: **~950 из ~1,400 (~68%)**

---

## ВЕРДИКТ

### Вертикаль A — SAMHSA MH Locator

**ИСТОЧНИК ВАЛИДЕН. ДЕЛАЕМ — но не сейчас.**

Причины отложить:
- Текущий app — FQHC/primary care locator. MH-вертикаль потребует отдельного UX.
- SAMHSA покрывает outpatient MH programs, residential SUD, OTP (methadone) — другой профиль, чем FQHC.
- Нет пересечения с нашими 10,429 сайтами (разные организации).

Причины вернуться:
- 12,427 MH facilities, geosearch работает, PYAS+sliding фильтруется, без ключа, public domain.
- "MH + no insurance" — реальный запрос наших пользователей.
- API готов к интеграции без ETL: live-запросы по координатам, пагинация, sliding scale фильтр.

**Следующий шаг (когда решим делать MH-вертикаль):** новый экран "Mental Health Resources" с live API call — никакого ETL не нужно.

---

### Вертикаль B — Dental/BH флаги в FQHC базе

**ТУПИК — публичного пути нет.**

Цепочка блокировок:
1. `HCC_FCT_ID` → `BHCMISID`: нет публичного crosswalk (`BCD_HC.zip` = 404)
2. `BHCMISID` → UDS dental/BH: нет bulk download (bphc.hrsa.gov = 403)
3. BPHC profile pages: CDN Akamai возвращает 403 на bot requests
4. Fuzzy address match: отклонён (неприемлемо для медицинских данных)

**Единственные оставшиеся пути:**
| Путь | Реалистичность |
|------|---------------|
| FOIA request (hrsa.gov/foia) | Да, но 20–60 рабочих дней + нужен join через адрес |
| Ручное обогащение топ-100 клиник (Google, сайты) | Да, для MVP dental фильтра по крупным рынкам |
| Ждать HRSA STAR initiative (site-level данные, 2024+) | Вероятно через 1–2 года станет публичным |

**Практическая рекомендация**: для dental фильтра в MVP — ручное обогащение 500–1000 ключевых клиник через scraping их собственных сайтов (clinic.website URL уже есть в нашей БД). Это не требует HRSA данных вообще.

---

### Итог приоритетов

| Задача | Вердикт | Следующий шаг |
|--------|---------|---------------|
| SAMHSA MH locator — источник | ✅ ВАЛИДЕН | Строить когда решим MH-вертикаль |
| Dental флаг через HRSA/UDS | ❌ ТУПИК (публичных данных нет) | FOIA или scraping clinic websites |
| BH флаг через HRSA/UDS | ❌ ТУПИК (тот же join key path) | Вместе с dental |
| SAMHSA sliding scale фильтр | ✅ ДЕЛАЕМ при MH-вертикали | PYAS.f3 contains "Sliding fee scale" |
