# Карта проекта PomidorQA

## Основные файлы

- `CODEX.md` — обязательные правила написания и ревью автотестов.
- `playwright.config.ts` — проекты `unit`, `api`, `e2e`, base URL `https://aiqa.su` и артефакты.
- `eslint.config.mjs` — обязательные Playwright ESLint-правила.
- `package.json` — команды тестов и линтера.
- `.cursor/hooks.json` — pre-push проверка через `.cursor/hooks/pre-push-check.mjs`.

## Тестовые слои

- `tests/unit/` — тесты чистых функций без браузерного контекста (`slots.spec.ts`).
- `tests/api/` — тесты HTTP API и бизнес-правил (`booking-api.spec.ts`).
- `tests/e2e/` — браузерные пользовательские сценарии:
  - `catalog-search.spec.ts` — поиск в каталоге (ДЗ 13–14, Arrange через API);
  - `booking-flow.spec.ts` — профиль и бронь слота;
  - `booking-cancel.spec.ts` — отмена брони;
  - `profile-flow.spec.ts` — поля профиля;
  - `login-error.spec.ts` — ошибка входа, локаторы формы пока в spec.
- `tests/helpers/` — тестовые данные, UI/API-регистрация и очистка.
- `tests/pages/` — Page Object’ы, локаторы и действия на экранах.
- `src/pyramid/` — учебный код для unit/api (`slots.ts`, `mock-booking-api.ts`).

## Существующие строительные блоки

### Helpers

`tests/helpers/user.ts`:

- `ROUTES` — `register`, `profile`;
- `TestUser`;
- `RegisteredParticipant`;
- `makeUser(role, runId)`;
- `registerUser(page, user)` — UI-форма, для тестов самой регистрации;
- `registerUserViaApi(request, user)` — `POST /api/pomidorqa/test/accounts`, статус `201`;
- `deleteUserViaApi(request)` — `DELETE` того же адреса, статус `200`, тот же `APIRequestContext`;
- `cleanupUsersViaApi(contexts)`.

Для Arrange в каталоге (ДЗ 14) используй `registerUserViaApi` и `context.request` того же `BrowserContext`, что и страница. Очистку делай в `finally` или `afterEach` до `context.close()`.

Новый helper добавляй сюда только для ответственности пользователя; остальные домены — в отдельные тематические файлы.

### Page Object

`tests/pages/profile-page.ts` — `ProfilePage`:

- `goto()`, `saveProfile()`;
- `fillProfileName`, `fillProfileTelegram`, `fillProfileTimezone`, `fillProfileBio`;
- `addSkill(tag, type)`, `skillChip(tag)`;
- поля профиля, `canHelpSkills`, `skillChips`.

`tests/pages/booking-page.ts` — `BookingPage`:

- слоты: `gotoSlots()`, `addTomorrowSlot(time)` → `{ date, time }`;
- каталог: `search(skillTag)`, `openPerson(name)`, `cardByName(name)`, `catalogEmpty`;
- бронь: `slotDay(date)`, `slotTime(time?)`, `openSlot(date)`, `confirm()`;
- встречи: `gotoBookings()`, `cancelBooking()`, `meetingByName(name)`.

Файлов `login-page.ts` и `register-page.ts` нет. Для входа и регистрации формы сначала проверь, не появился ли Page Object. Если нет — создай отдельный `<feature>-page.ts`, не копируй локаторы в spec.

## Команды

```bash
npm test
npm run test:unit
npm run test:api
npm run test:e2e
npm run lint
```

Для быстрого цикла запускай конкретный spec с соответствующим `--project`, затем полный `npm run lint`. Изменённый сценарий перед публикацией — `--repeat-each=10`.

## Важная оговорка

Некоторые учебные или старые spec-файлы содержат локаторы, helpers и assertions внутри action steps. Они полезны для понимания сценария, но не являются эталоном структуры. При конфликте всегда применяй актуальный `CODEX.md`.
