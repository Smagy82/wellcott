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

- **Офлайн**: 10 429 клиник HRSA в SQLite (`assets/clinics-v3.db`), зашиты в бандл.
  Поиск гео + текст, детали, карта (Apple Maps), Help. Не требует сети.
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

## clinicSearch.ts — API (важно не перепутать)

- `findClinicsNear(db, lat, lng, radiusMiles)` → ближайшие в радиусе + haversine-дистанция.
  Использовать только для радиусного списка и `initialRegion` карты.
- `searchClinicsByText(db, query, limit=100)` → вся база, `LOWER() LIKE`, `ORDER BY name`.
  Вызывается в `index.tsx` при любом непустом `query`; радиус игнорируется.
- `findAllClinicsForMap(db)` → `MapClinic[]` (только 6 полей: id, name, address, city, lat, lng).
  Для карты — вызывать только в `useEffect` после рендера, НЕ синхронно.

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

## Google Places enrichment — ДЕНЬГИ, читать перед любым прогоном

⚠️ ДЕНЬГИ: enrichment платный ($0.04/клиника). Скрипт ОБЯЗАН брать только необогащённые
клиники (WHERE google_enriched IS NULL/0), НИКОГДА не перезапрашивать google_enriched=1 —
это повторная оплата за уже готовое. Уже обогащены: CA/NY/NJ/IL + Fort Wayne (2985 клиник).
Перед любым прогоном проверять фильтр и делать пробный COUNT_ONLY подсчёт стоимости.
Places API в Google Cloud ОТКЛЮЧЁН — включать только осознанно перед прогоном.
