# ClinicFinder — доступная медпомощь без страховки (US)

Нативное приложение (iOS + Android) для поиска клиник, принимающих пациентов
без страховки или по низким ценам. Справочник клиник работает офлайн (база зашита
в приложение); личный кабинет — онлайн через Supabase.

---

## Стек

- **Expo SDK 54** + expo-router v6, TypeScript
- Expo Go (SDK 54) — для разработки без нативной сборки
- expo-sqlite (офлайн SQLite), expo-location, react-native-maps, react-native-map-clustering
- **Supabase** (@supabase/supabase-js) — auth, Postgres, Storage (онлайн-кабинет)
- @react-native-async-storage/async-storage — хранение сессии
- expo-image-picker — фото чеков
- @react-native-community/datetimepicker — выбор дат
- **@expo-google-fonts/poppins** — шрифт всего приложения
- **i18next + react-i18next + expo-localization** — i18n (EN default + ES stub)

---

## Запуск

```bash
cd ~/Clinic
npx expo start --tunnel --clear
# Открыть Expo Go на телефоне → сканировать QR
# Переменные EXPO_PUBLIC_* из .env подхватываются только при рестарте Metro
```

---

## Дизайн

Единый визуальный стиль вдохновлён референсом (округлый карточный дизайн).
Всё управляется из одного файла — **`src/theme.ts`** (цвета, шрифт, радиусы, тени, отступы).
Поменять акцентный цвет или шрифт на весь app = правка одного файла.

- Палитра «Небо и солнце»: основной голубой `#4A90D9` + мягкие плашки
  (жёлтая, голубая, персиковая, мятная, лиловая) под иконки
- Шрифт **Poppins** (400/500/600/700) на всё приложение
- Карточки: радиус 20, мягкая тень, много воздуха
- Старый зелёный (`#2f6b52`) полностью вычищен

---

## Структура

```
app/
  (tabs)/
    index.tsx       — список клиник (гео + текстовый поиск, чипы радиуса)
    map.tsx         — карта (Apple Maps, пины, кластеризация)
    help.tsx        — финансовая помощь (2 блока)
    profile.tsx     — личный кабинет (шапка + карточки + Sign out)
  clinic/[id].tsx   — детали клиники (+ кнопка-сердце «в избранное»)
  auth.tsx          — экран входа/регистрации (email + пароль)
  favorites.tsx     — список сохранённых клиник
  visits.tsx        — список визитов
  visit-add.tsx     — форма добавления визита (modal)
  bills.tsx         — траты (Total spent + список с фото)
  bill-add.tsx      — форма добавления билла с фото (modal)
  _layout.tsx       — гейт по сессии (нет сессии → /auth), загрузка шрифтов
  +not-found.tsx

src/
  theme.ts              — единый источник стиля (цвета/шрифт/радиусы/тени)
  components/
    Text.tsx            — обёртка над RN Text с Poppins по умолчанию
  i18n/
    index.ts            — i18next init, initLanguage(), setLanguage('en'|'es')
    locales/en.json     — все UI-строки (source of truth)
    locales/es.json     — испанский (пустые заглушки — заполняется вычитанным, не машинно)
  config/
    partners.ts         — SINGLECARE_URL, openPrescriptionSavings()
  components/
    PrescriptionSavingsBanner.tsx — компактный баннер (список клиник)
    PrescriptionSavingsCard.tsx   — полная карточка (детали клиники)
  lib/
    database.ts         — загрузка clinics-v3.db из assets в SQLite
    clinicSearch.ts     — findClinicsNear, getClinicById, searchClinicsByText (полная база), findAllClinicsForMap
    useNearbyClinics.ts — хук (гео → запрос → статус loading/ready/...)
    supabase.ts         — клиент Supabase (AsyncStorage-сессия)
    useAuth.ts          — хук сессии (session, loading, onAuthStateChange)
    useFavorites.ts     — избранное (isFavorite, toggleFavorite, reload)
    useVisits.ts        — визиты (addVisit, deleteVisit, reload)
    useBills.ts         — траты (addBill, deleteBill, totalSpent, reload)
    uploadPhoto.ts      — uploadBillPhoto (arrayBuffer→Storage), getSignedUrl
  types/
    clinic.ts           — Clinic, ClinicRow, ClinicWithDistance, rowToClinic
    financialHelp.ts    — FinancialHelpOrg

assets/
  clinics-v3.db         — 10 429 клиник HRSA, обогащено Google Places (CA/NY/NJ/IL + Fort Wayne)
  financial-help.json   — 11 организаций финпомощи, статика

# ETL — запускать локально, не входят в бандл
build-clinic-db.mjs       — HRSA API → clinics.db (POST, все штаты)
enrich-clinics-google.mjs — clinics.db + Google Places API (New) → place_id / hours_json
```

---

## Онлайн-кабинет (Supabase)

Проект Supabase: **clinicfinder** (регион East US).
Клиент настроен в `src/lib/supabase.ts`, сессия хранится в AsyncStorage
(persistSession), автологин при перезапуске приложения.

### Аутентификация

- Email + пароль через `supabase.auth`. Регистрация с `full_name` в user_metadata.
- Гейт в `app/_layout.tsx`: нет сессии → редирект на `/auth`; есть → в `(tabs)`.
- Триггер `handle_new_user()` создаёт строку в `profiles` при регистрации.
- **Confirm email сейчас ВЫКЛЮЧЕН** (для разработки). Перед публикацией включить
  обратно + настроить свой SMTP (Resend), иначе письма Supabase почти не доходят.

### Таблицы (все с RLS — юзер видит только свои строки)

- `profiles` — id (=auth.users), full_name
- `favorites` — clinic_id, clinic_name, clinic_address (денормализация из офлайн-базы)
- `visits` — clinic_id/name (nullable), visit_date, reason, note
- `bills` — amount, category, bill_date, merchant, photo_path, note, visit_id (nullable)

RLS-политики раздельные (select/insert/update/delete), не `for all` —
общая `for all` капризничала на insert (ошибка «violates row-level security»).
Каждая политика: `auth.uid() = user_id`.

### Storage

- Приватный bucket **`bills`** для фото чеков.
- Путь файла: `{user_id}/{timestamp}.jpg`. Policy изолирует по первой папке (user_id).
- Загрузка через `fetch(uri).arrayBuffer()` → `storage.upload` (blob() в Expo
  грузит пустой файл — использовать arrayBuffer!).
- Показ фото — через `createSignedUrl(path, 3600)` (bucket приватный).

---

## Источники данных

### Клиники — HRSA (офлайн)

`build-clinic-db.mjs` делает POST-запросы к HRSA API по каждому штату.
**10 429 клиник, 50 штатов.** База бандлится в `assets/clinics-v3.db`
и копируется на устройство при первом запуске.
Токен нужен только при сборке базы — в само приложение не попадает.

### Обогащение — Google Places API (New)

`enrich-clinics-google.mjs` добавляет `place_id`, `hours_json`, уточнённые телефон и сайт.
Двухшаговый биллинг: Text Search (дешёвый SKU) → Place Details (Pro, только нужные поля).

```bash
# Прогон по нескольким штатам с лимитом
GOOGLE_API_KEY='...' ONLY_STATES=CA,NY,NJ,IL MAX_REQUESTS=4900 node enrich-clinics-google.mjs

# Подсчёт без вызовов API
COUNT_ONLY=1 node enrich-clinics-google.mjs
```

**Статус на clinics-v3.db:**
- Всего клиник: 10 429 | google_enriched: 2 985 | с hours_json: 2 702
- Прогнаны: CA, NY, NJ, IL + ранее Fort Wayne (IN). Последний прогон ~$108.60.
- Остальные штаты не прогнаны — детали показывают «Call to confirm hours».
- Полный прогон по стране: оценка ~$130–$140 (зависит от hit rate).

### Финансовая помощь — статика

`assets/financial-help.json` — 11 организаций, 2 блока:
«For you» (незастрахованные) и «If you have insurance».

---

## Что готово

**Справочник (офлайн):**
- Список клиник — гео-поиск, чипы радиуса 10/25/50 mi; если поиск непустой — полная база без радиуса (name+city, регистронезависимо, LIMIT 100)
- Детали клиники — адрес, телефон, часы, сайт, Call / Directions, блок финпомощи
- Help — 2 блока, рабочие ссылки и звонки
- Map — Apple Maps, все 10 429 клиник (findAllClinicsForMap, асинхронно после рендера), кластеризация react-native-map-clustering; tracksViewChanges=false
- Баннер «Save on prescriptions» (SingleCare, заглушка) в списке и деталях клиники

**i18n:**
- Все UI-строки через `t('section.key')`. Языки: EN (полный) + ES (заглушки, машинный перевод запрещён в медтекстах).
- Автоопределение из `expo-localization`, override через AsyncStorage key `app_language`.

**Онлайн-кабинет (Supabase):**
- Регистрация / вход (email + пароль), сессия сохраняется между запусками
- Профиль — шапка (аватар с инициалами, приветствие, дата), карточки, Sign out
- Saved clinics — избранное (сердечко на детали клиники → список в кабинете)
- Visit history — визиты (клиника из сохранённых / вручную / без клиники, дата, повод)
- Expenses — траты с фото чека, категории, подсчёт Total spent

**Дизайн:**
- Единая тема `src/theme.ts`, шрифт Poppins на весь app, карточный стиль

---

## Веб (лендинг + Privacy Policy)

Домен **wellcott.app** (Cloudflare Registrar). Лендинг и политика захостены на Cloudflare
(проект `wellcott`, статик-ассеты), SSL active.
- https://wellcott.app — лендинг
- https://wellcott.app/privacy — Privacy Policy (URL для App Store / Google Play)

Исходники в `SITE wellcott/`: `index.html` (лендинг) + `privacy/index.html` (политика).
Стиль совпадает с приложением (палитра «Небо и солнце», Poppins).
Обновление: Cloudflare Dashboard → Workers & Pages → wellcott → New deployment →
перетащить папку `SITE wellcott` целиком (важно: папку, чтобы сохранилась вложенность privacy/).

---

## TODO

**Кабинет / онлайн:**
- [ ] Splash-заставка с логотипом (не зависит от бэкенда, сделать первой)
- [ ] Включить Confirm email + настроить Resend SMTP (перед публикацией)
- [ ] Связь билла с визитом (`visit_id` сейчас всегда null — дать выбор в форме)
- [ ] Удалять фото из Storage при удалении билла (сейчас остаётся файл)
- [ ] OCR суммы/даты с фото чека (Google Vision) — итерация 2
- [ ] Медпрофиль (аллергии, лекарства, экстренный контакт) — расширение «досье»

**Данные / инфра:**
- [ ] Полный прогон обогащения Google по стране (~$130–$140) — CA/NY/NJ/IL готово, остальные штаты не прогнаны
- [ ] Прокси «открыто сейчас» — Node/Express на Ubuntu (домен + HTTPS)
- [ ] NAFC — второй источник бесплатных клиник (партнёрство)

**Публикация:**
- [ ] Иконка приложения, splash
- [x] Privacy Policy URL — https://wellcott.app/privacy (задеплоена)
- [ ] Apple Developer ($99/год) + Google Play ($25)

---

## Переменные окружения

**Runtime (в .env, в git не коммитить — уже в .gitignore):**

| Переменная | Где используется |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_KEY` | `src/lib/supabase.ts` (publishable key, безопасен для клиента, защита — RLS) |

**Build-time ETL (только при сборке базы, в приложение не попадают):**

| Переменная | Где используется |
|---|---|
| `HRSA_TOKEN` | `build-clinic-db.mjs` |
| `GOOGLE_API_KEY` | `enrich-clinics-google.mjs` |

⚠️ service_role key и Database Password Supabase — НИКОГДА в приложение/git.

---

## Дисклеймеры

- Информация справочная, не медицинская/юридическая консультация.
- Цены плавающие (sliding scale по доходу) — всегда звонить заранее.
- Все FQHC по закону обязаны принимать независимо от наличия страховки.
