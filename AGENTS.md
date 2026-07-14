# ClinicFinder — памятка для Claude Code

## Версия Expo — ВАЖНО

Проект на **Expo SDK 54** (expo-router v6). Перед написанием кода читай
версионные доки под именно эту версию: https://docs.expo.dev/versions/v54.0.0/
Не подставляй API из других версий — Expo часто меняет API между SDK.

Проверить фактическую версию: `npx expo --version` и `"expo"` в package.json.
Если версия в проекте отличается от указанной здесь — обнови эту строку.

## Запуск

```bash
cd ~/Clinic
npx expo start --tunnel --clear
```
Тестируется в Expo Go на телефоне. Переменные EXPO_PUBLIC_* из .env
подхватываются только при рестарте Metro.

## Архитектура (кратко)

Гибрид: **офлайн-справочник + онлайн-кабинет**.

- **Офлайн**: 10 429 клиник HRSA + 11 992 MH-учреждений SAMHSA в SQLite (`assets/clinics-v6.db`),
  зашиты в бандл. Две таблицы: `clinics` (HRSA) и `mh_facilities` (SAMHSA).
  Поиск гео + текст, детали, карта, Help. Не требует сети.
  Статистика: 10 429 клиник | google_enriched 2 985 | hours_json 2 702.
  dental_signal: strong+medium ≈ 5 400 клиник (organization-level, ~2 261 сайтов проверено).
  ⚠️ dental_signal — ORGANIZATION-LEVEL: один сайт = все адреса организации.
  "Dental mentioned on website" ≠ "дантист есть в конкретной точке". UI ОБЯЗАН это отражать.
- **Онлайн**: Supabase (auth email+пароль, Postgres, Storage). Личный кабинет —
  избранное, визиты, траты с фото чеков. Всё с RLS (юзер видит только своё).

## Правила стиля

- Единый стиль — **только через `src/theme.ts`** (цвета, шрифт Poppins, радиусы, тени).
  Никаких хардкод-цветов в экранах. Акцент — голубой `#4A90D9`.
- Тексты — через обёртку `src/components/Text.tsx` (Poppins по умолчанию).

## ШРИФТ — КРИТИЧНО
ВЕСЬ текст в приложении — ТОЛЬКО Poppins (через src/theme.ts font.* и обёртку src/components/Text.tsx).
- НИКОГДА не импортировать Text напрямую из 'react-native' — только обёртку src/components/Text.tsx.
- Заголовки экранов навигации (headerTitleStyle) ОБЯЗАТЕЛЬНО с fontFamily Poppins — задано глобально в корневом _layout.
- Любой новый экран/компонент: проверить что заголовок хедера и все тексты идут Poppins.
- Запрещён системный/дефолтный шрифт где-либо в UI.
Перед завершением любой задачи с UI — grep -rn "from 'react-native'" на предмет прямого импорта Text.
- src/components/Text.tsx ОБЯЗАН быть реальным компонентом, подставляющим fontFamily
  из theme.ts. Простой re-export (`export { Text } from 'react-native'`) ЗАПРЕЩЁН —
  он формально проходит grep-проверку, но не даёт никакой гарантии шрифта.
  Проверка перед сдачей задачи: cat src/components/Text.tsx — там должен быть компонент.

## i18n — правила

Весь UI-текст только через `useTranslation()` + `t('section.key')`. Добавляя строку:
1. Добавить ключ в `src/i18n/locales/en.json` (source of truth).
2. Добавить пустой ключ в `es.json` — машинный перевод запрещён, Иван заполняет сам.
3. Использовать `t()` в компоненте, не хардкодить текст.

- `setLanguage('es'|'en')` из `src/i18n/index.ts` — сохраняет в AsyncStorage `app_language`.
- `initLanguage()` вызывается в `_layout.tsx` до рендера (ждать `langReady`).
- В i18next обязательны `fallbackLng: 'en'` + `returnEmptyString: false` — иначе пустой
  стаб в es.json рендерится пустой строкой вместо английского текста.

## ЗАПРЕЩЁННЫЕ СЛОВА — КРИТИЧНО, читать перед любым текстом в UI

### `coverage` / `covered` / `covers` — ЗАПРЕЩЕНЫ ВСЕГДА
В США читается как «страховое покрытие». У нашего юзера страховки НЕТ.
Sliding scale — скидка от прайса клиники, а не покрытие.
Замены: "what you pay", "what the discount includes", "what this program pays for",
"services offered", "included in the fee", "government health insurance".
Ловушка: слово проскакивает в начале предложения — "Covers exams and x-rays."
Нарушение. Писать: "Includes exams and x-rays."
Запрет действует и на имена полей в данных (assets/*.json), не только на UI-текст.

### `FREE` — запрещён ПО УМОЛЧАНИЮ, разрешён точечно
ЗАПРЕЩЁН для всего из таблицы `clinics` (HRSA/FQHC). FQHC = sliding scale.
При низком доходе часто $0, но клиника ВПРАВЕ взять nominal charge ($5–20).
Честно: "often free or a small flat fee".

РАЗРЕШЁН там, где фактически верно:
- Кризисные линии (988, Crisis Text Line, SAMHSA Helpline) — реально $0
- Mission of Mercy / ADCF, Remote Area Medical (RAM) — без ID/страховки/проверки дохода
- Donated Dental Services — бесплатно, но жёсткий eligibility (65+/инвалидность/
  medically fragile) → рядом с FREE ОБЯЗАН стоять фильтр
- NAFC free & charitable clinics
- Good Faith Estimate ("free to request") — бесплатен по закону

Партнёрские/монетизированные блоки (SingleCare и будущие):
FREE допустим ТОЛЬКО про сам инструмент (карта), НИКОГДА про результат (лекарство).
Запрещены обещания размера выгоды из маркетинга партнёра ("up to 80% off").
Обязательна оговорка о вариативности цены.

Сомневаешься → не пиши FREE.

### Динамические i18n-ключи — grep их НЕ находит
Ключи вида t(`help.cat_${org.category}`), t(`help.org.${org.id}.name`) собираются в рантайме.
Grep по имени ключа их НЕ найдёт → «неиспользуемый» ключ может быть живым.
Искать по ПРЕФИКСУ: grep -rn "help.org\." app/ src/
defaultValue маскирует пропущенный ключ: в UI покажется сырое значение
("copay_disease_specific") вместо текста. Не падает — тихо портит UI.

### Проверка перед сдачей любой задачи с текстом
```bash
grep -rni "coverage\|covered\|covers" src/ app/ assets/*.json
grep -rni "free" src/i18n/locales/en.json   # каждое вхождение сверить со списком выше
```

## clinicSearch.ts — API (важно не перепутать)

- `findClinicsNear(db, lat, lng, radiusMiles)` → ближайшие в радиусе + haversine-дистанция.
  Использовать только для радиусного списка и `initialRegion` карты.
- `searchClinicsByText(db, query, limit=100)` → вся база, `LOWER() LIKE`, `ORDER BY name`.
  Вызывается в `index.tsx` при любом непустом `query`; радиус игнорируется.
- `findAllClinicsForMap(db)` → `MapClinic[]` (только 6 полей: id, name, address, city, lat, lng).
  Для карты — вызывать только в `useEffect` после рендера, НЕ синхронно.

## mentalHealthSearch.ts — API (важно не перепутать с clinicSearch.ts)

- `findMhNear(db, lat, lng, radiusMiles, limit?, slidingFeeOnly?)` → MH-объекты в радиусе + haversine-дистанция.
  Только записи **С координатами** (`latitude IS NOT NULL`). Для списка и карты.
- `searchMhByText(db, query, limit?, slidingFeeOnly?)` → вся таблица `mh_facilities`, `LOWER() LIKE` по `name1+name2+city`.
  Включает записи **БЕЗ координат** — в этом смысл: 1 040 объектов найдутся текстом, но не геопоиском.
- `findAllMhForMap(db)` → `MapMhFacility[]` (id, name1, city, latitude, longitude, hasSlidingFee).
  Только с координатами. Вызывать **только в useEffect**, не синхронно (~11k строк).
- `getMhById(db, id)` → `MhFacility | null`.
- `slidingFeeOnly=true` → добавляет `AND has_sliding_fee = 1` к `findMhNear` и `searchMhByText`.

Типы: `src/types/mentalHealth.ts` — `MhFacility`, `MhRow`, `MhWithDistance`, `rowToMh`.

## Бандл-база — грабли (уже пройдены, не повторять)

- При обновлении `assets/clinics-v*.db` **ОБЯЗАТЕЛЬНО бампать имя файла** (v2→v3 и т.д.),
  иначе Expo не перекопирует базу на устройство: `expo-sqlite` копирует файл из assets
  только если файла с таким именем ещё нет в документах устройства.
- После бампа обновить **обе** ссылки в `src/lib/database.ts`
  (константа имени файла + путь к ассету).
- На симуляторе/устройстве после переименования — удалить приложение и установить заново
  (или `expo start --clear`), иначе старый файл остаётся в документах.

## Supabase — грабли (уже пройдены, не повторять)

- RLS: политики раздельные (select/insert/update/delete), НЕ `for all` —
  общая `for all` роняет insert с «violates row-level security».
- Загрузка фото в Storage: через `fetch(uri).arrayBuffer()`, НЕ `.blob()`
  (blob в Expo грузит пустой файл 0 байт).
- Приватный bucket → показ фото только через `createSignedUrl`.

## Секреты

- `.env`: EXPO_PUBLIC_SUPABASE_URL / KEY (publishable key безопасен для клиента).
- НИКОГДА в git/приложение: service_role key, Database Password, HRSA_TOKEN, GOOGLE_API_KEY.

Полное описание — в README.md.

## Тестовые прогоны — ЗАПРЕТ НА САМОДЕЯТЕЛЬНОСТЬ

⚠️ Если пользователь задаёт ограничение (ONLY_STATES=IN,WY, LIMIT=10, COUNT_ONLY=1,
MAX_REQUESTS=5 или любое другое) — запускать СТРОГО только его.
Полный прогон без явного разрешения ЗАПРЕЩЁН.
На платных API (Google Places, SAMHSA с ключом, OpenAI) несанкционированный полный
прогон = реальные деньги. Даже на бесплатных API — нарушение условий использования
и/или DoS без намерения.
Правило нарушено: build-samhsa-db.mjs прогнан по всем 51 штату вместо ONLY_STATES=IN,WY
при валидации STATE_MAP (коммит 96fc1a2, 2026-07-14).

## Google Places enrichment — ДЕНЬГИ, читать перед любым прогоном

⚠️ ДЕНЬГИ: enrichment платный ($0.04/клиника). Скрипт ОБЯЗАН брать только необогащённые
клиники (WHERE google_enriched IS NULL/0), НИКОГДА не перезапрашивать google_enriched=1 —
это повторная оплата за уже готовое. Уже обогащены: CA/NY/NJ/IL + Fort Wayne (2985 клиник).
Перед любым прогоном проверять фильтр и делать пробный COUNT_ONLY подсчёт стоимости.
Places API в Google Cloud ОТКЛЮЧЁН — включать только осознанно перед прогоном.

## Уроки из реализации

### Цвета — только из src/theme.ts
Хардкод цветовых литералов (`#hex`, `rgba(...)`) в экранах запрещён — в том числе правки,
пришедшие из внешних дизайн-инструментов. Переносить в токены, значения не менять.
Перед добавлением нового токена проверить theme.ts: возможно, цвет уже есть под другим именем.
Не плодить токены с визуально неразличимой разницей (alpha 0.07 vs 0.08 → один `border`).

### i18n — проверка ключей (обязательно при новых экранах)

**Обязательно перед завершением любой задачи, в которой добавлен новый экран или новые строки UI.** Также — перед каждым релизом:

```bash
node scripts/check-i18n.mjs
```

Скрипт выдаёт три списка:
1. **MISSING FROM en.json** — ключи используются в коде, но отсутствуют в JSON → рендерятся сырым ключом (баг). Выход с кодом 1. Чинить немедленно.
2. **UNUSED IN CODE** — ключи есть в en.json, но не найдены grep'ом. **Осторожно**: скрипт не видит динамические ключи вида `` t(`section.${variable}`) `` или `t(cond ? 'a' : 'b')`. Прежде чем удалять — убедиться что ключ действительно мёртвый.
3. **MISSING FROM es.json** — ключ есть в en, но нет даже пустого стаба в es → испанский пользователь видит пустоту вместо английского фоллбека (если пуст стаб, `returnEmptyString:false` спасёт; если нет ключа вообще — нет).

Добавляя новый экран:
- Добавить все `t('...')` ключи в `en.json` ДО коммита.
- Добавить пустые стабы в `es.json` (машинный перевод ЗАПРЕЩЁН).
- Прогнать `node scripts/check-i18n.mjs` — должен вернуть 0 ошибок в списке 1.

### i18n — дубликаты молчат
При правке ключа — удалить старое объявление. Дублирующиеся ключи в JSON и в StyleSheet
молча затирают предыдущее значение; `tsc` их не ловит.

### Чек-листы: формулировки FQHC
FQHC обязаны принимать пациентов независимо от наличия документов, жилья и иммиграционного
статуса. Формулировки чек-листа НЕ должны намекать, что без документа не примут.
Правильная форма: «нет документа? — клиника всё равно примет, спроси что подойдёт».
Иммиграционный статус прямым текстом не упоминать — риск при ревью сторов.

### Sliding fee — весь доход домохозяйства
Sliding fee считается от дохода относительно размера домохозяйства (FPG-таблица). Любой текст
про proof of income должен упоминать: если кто-то ещё в домохозяйстве работает — его доход
тоже учитывается при расчёте.
