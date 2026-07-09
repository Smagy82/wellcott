# ClinicFinder — доступная медпомощь без страховки (US)

Нативное приложение (iOS + Android) для поиска клиник, принимающих пациентов
без страховки или по низким ценам. Работает офлайн — база зашита в приложение.

---

## Стек

- **Expo SDK 54** + expo-router v6, TypeScript
- Expo Go (SDK 54) — для разработки без нативной сборки
- expo-sqlite (офлайн SQLite), expo-location, react-native-maps, react-native-map-clustering

---

## Запуск

```bash
cd ~/Clinic
npx expo start --tunnel --clear
# Открыть Expo Go на телефоне → сканировать QR
```

---

## Структура

```
app/
  (tabs)/
    index.tsx       — список клиник (гео + текстовый поиск, чипы радиуса)
    map.tsx         — карта (Apple Maps, пины, кластеризация)
    help.tsx        — финансовая помощь (2 блока)
  clinic/[id].tsx   — детали клиники
  _layout.tsx
  +not-found.tsx

src/
  lib/
    database.ts         — загрузка clinics-v2.db из assets в SQLite
    clinicSearch.ts     — findClinicsNear, getClinicById, searchClinicsByText
    useNearbyClinics.ts — хук (гео → запрос → статус loading/ready/no-permission/error)
  types/
    clinic.ts           — Clinic, ClinicRow, ClinicWithDistance, rowToClinic
    financialHelp.ts    — FinancialHelpOrg

assets/
  clinics-v2.db         — 10 429 клиник HRSA, обогащено Google Places (Fort Wayne)
  financial-help.json   — 11 организаций финпомощи, статика

# ETL — запускать локально, не входят в бандл
build-clinic-db.mjs       — HRSA API → clinics.db (POST, все штаты)
enrich-clinics-google.mjs — clinics.db + Google Places API (New) → place_id / hours_json
```

---

## Источники данных

### Клиники — HRSA (офлайн)

`build-clinic-db.mjs` делает POST-запросы к HRSA API по каждому штату,
записывает результат в `data/clinics.db`. **10 429 клиник, 50 штатов.**
База бандлится в `assets/clinics-v2.db` и копируется на устройство при первом запуске.
Токен нужен только при сборке базы — в само приложение не попадает.

### Обогащение — Google Places API (New)

`enrich-clinics-google.mjs` добавляет в базу `place_id`, `hours_json`, уточнённые телефон и сайт.

```bash
GOOGLE_API_KEY='...' ONLY_STATE=IN ONLY_CITY='Fort Wayne' node enrich-clinics-google.mjs
```

**Важно:** прогон сделан только по Fort Wayne (15/16 совпадений).
Полный прогон по стране не сделан — стоит ~$130.
Для остальных городов `hours_json = null`; детали клиники показывают «Call to confirm hours».

### Финансовая помощь — статика

`assets/financial-help.json` — 11 организаций, разбиты на 2 блока:
«For you» (незастрахованные) и «If you have insurance».

---

## Что готово (v1.0 в разработке)

- **Список клиник** — гео-поиск, чипы радиуса 10/25/50 mi, текстовый поиск,
  ручной ввод города при отключённой геолокации, все пустые состояния
- **Детали клиники** — адрес, телефон, часы работы (из Google или «Call to confirm»),
  сайт, кнопки Call / Directions, блок финпомощи
- **Help** — 2 блока, рабочие ссылки и кнопки звонка
- **Map** — Apple Maps, PROVIDER_DEFAULT (без API key), маркеры с кластеризацией по zoom

---

## TODO

- [ ] Полный прогон обогащения Google по всей стране (~$130)
- [ ] Прокси «открыто сейчас» — Node/Express на Ubuntu (нужен домен + HTTPS)
- [ ] NAFC — второй источник бесплатных клиник (требует партнёрства)
- [ ] UX: убрать техзаголовок на экране деталей (`clinic/[id]`), иконка, splash
- [ ] Публикация: Apple Developer ($99/год) + Google Play ($25)

---

## Переменные окружения (только build-time ETL)

| Переменная | Где используется |
|---|---|
| `HRSA_TOKEN` | `build-clinic-db.mjs` |
| `GOOGLE_API_KEY` | `enrich-clinics-google.mjs` |

В само приложение секреты не попадают — база зашита статически.

---

## Дисклеймеры

- Информация справочная, не медицинская/юридическая консультация.
- Цены и услуги в клиниках плавающие (sliding scale по доходу) — всегда звонить заранее.
- Все FQHC по закону обязаны принимать независимо от наличия страховки.
