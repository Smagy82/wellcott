# SAMHSA findtreatment.gov API — Подтверждённые параметры

## Рабочий endpoint

```
GET https://findtreatment.gov/locator/exportsAsJson/v2?{querystring}
```

## Параметры (проверено 2026-07-14)

| Параметр | Формат | Пример | Описание |
|----------|--------|--------|----------|
| `sAddr` | `{lat},{lng}` — **ШИРОТА ПЕРВОЙ** | `34.0522,-118.2437` | Центр поиска. ⚠️ Table 2 в PDF пишет `{lng},{lat}` — это опечатка. Все URL-примеры в doc и живые тесты подтверждают lat,lng. |
| `limitType` | 0 / 1 / 2 | `2` | 0=по штату, 1=по county, 2=по радиусу в метрах |
| `limitValue` | число | `80467` | Смысл зависит от limitType. Для 2: метры. 80467=50 миль, 16093=10 миль |
| `sType` | `sa` / `mh` / `both` | `mh` | Тип услуг. **mh** = только mental health. Без параметра — все типы (SA+MH+HRSA+OTP) |
| `sCodes` | `XX,YY` | `OTP,BU` | Фильтр по кодам услуг внутри выбранного sType |
| `pageSize` | целое, max 2000 | `100` | Записей на страницу. Для bulk: 2000 |
| `page` | целое, от 1 | `1` | Номер страницы. Итерировать до `totalPages` |
| `sort` | 0–3 | `0` | 0=по расстоянию (default), 1=обратный, 2=по name1, 3=по name2 |
| `stateCode` | 2-буквенный | `CA` | Фильтр по штату, можно комбинировать с limitType=2 |
| `filterFPhone` | строка | `213` | Фильтр по подстроке телефона |
| `filterFName` | строка | `Clinic` | Фильтр по имени |
| `cut` | `NIAAA` | `NIAAA` | Переопределяет sType; только SA-программы без DU/DUO |

## Sanity-check (sType=mh, limitType=2, limitValue=80467 — 50 миль)

| Точка | recordCount | totalPages | PYAS | sliding_text |
|-------|-------------|------------|------|--------------|
| Los Angeles CA (34.0522,-118.2437) | **471** | 5 | 39/100 | 18/100 |
| Fort Wayne IN (41.0793,-85.1394) | **57** | 1 | 35/57 | 30/57 |
| Rural Montana / Miles City (46.4083,-105.8403) | **2** | 1 | 2/2 | 2/2 |

LA >> Montana → геопоиск работает корректно.

## Service codes (MH)

| Код | Полное название | Примечание |
|-----|-----------------|------------|
| TC | Type of Care | Mental health treatment services |
| SET | Service Setting | Outpatient, Residential, etc. |
| TAP | Treatment Approaches | CBT, DBT, etc. |
| PAY | Payment/Insurance/Funding Accepted | Medicaid, Cash, etc. |
| **PYAS** | **Payment Assistance Available** | ⚠️ НЕ равно "sliding scale fee". Текст: "Payment assistance (check with facility for details)". Отдельный конкретный sliding fee код — `PYAS.f3` содержит "Sliding fee scale" у части объектов (~40% из имеющих PYAS). |
| EMS | Emergency Mental Health Services | Crisis intervention team |
| FOP | Facility Operation | Private, Public |
| SG | Special Programs/Groups | Veterans, SMI, co-occurring |
| AGE | Age Groups Accepted | Adults, Children, Seniors |
| FT | Facility Type | |
| PHR | Pharmacotherapies | Antipsychotics, SSRIs, etc. |
| LCA | License/Certification/Accreditation | |
| RSS | Recovery Support Services | Peer support |
| SCR | Testing/Screening | |
| AS | Ancillary Services | Case management |
| SL | Language Services | Spanish, ASL |
| OL | Other Languages | |
| ECS | Education and Counseling Services | |
| FVP | Facility Vaping Policy | |
| SMP | Facility Smoking Policy | |

## Структура ответа

```json
{
  "page": 1,
  "totalPages": 5,
  "recordCount": 471,
  "rows": [
    {
      "_irow": 1,
      "name1": "...",
      "name2": "...",
      "street1": "...", "street2": null,
      "city": "...", "state": "CA", "zip": "...",
      "phone": "...",
      "intake1": null, "hotline1": null,
      "website": "...",
      "latitude": "34.044...",   ← строка, НЕ число
      "longitude": "-118.24...", ← строка
      "miles": 0.5,
      "type_facility": "MH",    ← в sample response; в реальном иногда "typeFacility"
      "services": [
        { "f1": "Type of Care", "f2": "TC", "f3": "Mental health treatment services" },
        { "f1": "Payment Assistance Available", "f2": "PYAS", "f3": "Sliding fee scale (fee is based on income and other factors)" }
      ]
    }
  ]
}
```

## Закрытые вопросы (2026-07-13)

- [x] **ToU**: US Federal public domain (17 U.S.C. § 105). Офлайн кэш и бандлинг разрешены. Attribution: "Source: SAMHSA findtreatment.gov".
- [x] **Всего MH-facilities по США**: **12,427** (запрошено через `limitType=0` по всем 50 штатам + DC).
- [x] **Bulk download**: **НЕТ.** N-SUMHSS PUF URL → 404. API — единственный публичный источник.
