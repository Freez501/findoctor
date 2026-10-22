# Project: Truespace — Барный кейтеринг и финансы

- **Статус:** `stage_production_deployed` (Проект опубликован на сервере FirstVDS: база MySQL `findoctor` является основной боевой базой; экран «Справочники и настройки» полностью переведён на стильную 2-колоночную архитектуру Linear/Stripe с боковым меню, представительской карточкой бренда, точным бейджем тарифа PRO VIP, аккуратной карточкой параметров компании и списком команды без пустых зон и нагромождений)
- **Боевая версия (Production):** `http://shved4656.fvds.ru` (IP: `153.76.170.74`)
- **Интерактивное превью настроек:** `http://localhost:3333` и `http://192.168.100.82:3333` (сервер предпросмотра)
- **Локальная версия (Dev):** `http://localhost:5173/` (бэкенд API: `http://localhost:3001/api`)
- **GitHub репозиторий:** `https://github.com/Freez501/findoctor.git` (ветка `main`, CI/CD готов)
- **Тесты:** 589 / 589 passed (100% green, 34 тест-сьюта)
- **Сборка:** Typecheck & Vite Build 100% green (0 errors)

## Architecture
Единая масштабируемая модульная fullstack-архитектура на TypeScript:
- **Shared Layer (`src/shared/`)**: доменные типы, контракты DTO, константы счетов и категорий, математические интерфейсы, типы для Telegram/парсера быстрых команд.
- **Server Layer (`src/server/`)**: Node.js + Express REST API:
  - `storage/`: паттерн Репозиторий (`IFinanceStore`) с полноценной боевой реализацией `MySqlStore` (прямая работа с СУБД MySQL `findoctor` на сервере FirstVDS), а также адаптерами `JsonFileStore` и `InMemoryStore`.
  - `data/`: SQL-миграция для PostgreSQL/Supabase (`supabase.sql`) и предзаполненный демо-набор (`seed.ts`).
  - `services/`:
    - `FinanceService`: пересчёт балансов, атомарные переводы, отмена транзакций, расчёт копеек.
    - `AnalyticsService`: маржинальность мероприятий, структура себестоимости, деление на ноль.
    - `ParserService`: парсинг естественного языка и быстрых команд ("3500 лед Корпоратив Т-Банк", "50000 предоплата Свадьба", "-1500 такси нал1").
  - `telegram/`: модуль Telegram-бота (`TelegramBotService`) с поддержкой Bot API (long polling/webhook) и безопасным мок-режимом при отсутствии `BOT_TOKEN`.
  - `routes/`: модульные маршруты `/api/accounts`, `/api/events`, `/api/categories`, `/api/transactions`, `/api/analytics`, `/api/telegram` (симулятор и статус).
- **Client Layer (`src/client/`)**: React 18 + Vite + TypeScript:
  - `components/entry/`: мобильный быстрый ввод за 5 секунд (выбор типа, цифровой ввод, выбор счёта и категории, привязка к мероприятию или «Общие расходы»).
  - `components/telegram/`: статус Telegram-бота и симулятор командной строки прямо в браузере (быстрый ввод текстовых команд с мгновенным разбором).
  - `components/accounts/`: карточки 5 счетов с балансами в рублях и индикаторами ликвидности.
  - `components/analytics/`: сводная панель маржинальности мероприятий, структура прямых расходов, цветовые пороги.
  - `components/history/`: журнал транзакций с фильтрами и возможностью отмены/удаления.
  - `hooks/`: кастомные хуки данных (`useAccounts`, `useTransactions`, `useEvents`, `useAnalytics`, `useTelegramSimulator`).
  - `styles/`: токены дизайн-системы (`DESIGN_SYSTEM.md`), мобильная адаптивность 375px–1440px.
- **Testing & Tooling**:
  - `tests/unit/`: тесты финансового ядра, парсера быстрых команд и математических инвариантов (`vitest`).
  - `tests/e2e/`: независимый тестовый E2E-контур (Tiers 1–4, Opaque-Box).
  - Dev runner: `npm run dev` (`concurrently` запускает сервер на `:3001` и Vite на `:5173` с `--host` для LAN-доступа).

## Code Layout
- `src/shared/` — типы (`types.ts`, `dto.ts`, `constants.ts`) — владелец: M1 (DONE)
- `src/server/storage/` — абстракция репозитория (`interfaces.ts`, `InMemoryStore.ts`, `JsonFileStore.ts`, `factory.ts`) — владелец: M1 (DONE)
- `src/server/data/` — DDL Supabase (`supabase.sql`) и сиды (`seed.ts`) — владелец: M1 (DONE)
- `src/server/services/` — `FinanceService.ts`, `AnalyticsService.ts`, `ParserService.ts` — владелец: M2 (IN_PROGRESS)
- `src/server/telegram/` — `TelegramBotService.ts` — владелец: M2 (IN_PROGRESS)
- `src/server/routes/` — роуты API (`accounts.ts`, `events.ts`, `transactions.ts`, `telegram.ts`, etc.) — владелец: M2 (IN_PROGRESS)
- `src/server/app.ts`, `src/server/index.ts` — запуск бэкенда — владелец: M2 (IN_PROGRESS)
- `src/client/components/entry/`, `src/client/components/accounts/`, `src/client/components/telegram/` — быстрый ввод, счета, статус бота и симулятор — владелец: M3
- `src/client/components/analytics/`, `src/client/components/history/` — маржинальность и история — владелец: M4
- `src/client/App.tsx`, `src/client/main.tsx` — интеграция интерфейса — владелец: M3/M4
- `tests/e2e/` — сквозной тестовый набор — владелец: M-TEST (DONE)
- `tests/unit/` — модульные тесты ядра и парсера — владелец: M1 (DONE), M2

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F01 | 5-Account Balance Tracking | Раздельный учёт остатков по 5 счетам (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы) | M1, M2, M3 | ORIGINAL_REQUEST §R1 |
| F02 | Expense Logging | Внесение расхода с дебетованием счёта, категорией и привязкой к ивенту | M1, M2, M3 | ORIGINAL_REQUEST §R1, R2 |
| F03 | Income Logging | Внесение дохода с кредитованием счёта, категорией и привязкой к ивенту | M1, M2, M3 | ORIGINAL_REQUEST §R1, R2 |
| F04 | Inter-Account Transfer | Внутренний перевод между счетами без изменения суммарного капитала | M1, M2, M3 | ORIGINAL_REQUEST §R1, R2 |
| F05 | Total Liquidity Aggregation | Расчёт общего капитала и суммарной ликвидности кейтеринга | M1, M2, M3 | ORIGINAL_REQUEST §R1 |
| F06 | 3-Step 5-Second Mobile Modal | Эргономичный мобильный ввод за 3 действия (Тип -> Сумма -> Счёт/Категория) | M3 | ORIGINAL_REQUEST §R2 |
| F07 | Quick Category Selectors | Быстрый выбор категорий (Алкоголь, Персонал, Логистика, Лёд, Доплата, Чаевые) | M3 | ORIGINAL_REQUEST §R2 |
| F08 | Quick Account Chips | Мгновенный выбор счетов списания/зачисления кнопками-чипами | M3 | ORIGINAL_REQUEST §R2 |
| F09 | General Bar Expenses Toggle | Переключатель «Общие расходы бара» при отсутствии привязки к ивенту | M3 | ORIGINAL_REQUEST §R2 |
| F10 | Event Margin Dashboard | Выручка, прямые расходы, чистая прибыль и маржинальность (%) по ивентам | M2, M4 | ORIGINAL_REQUEST §R3 |
| F11 | Expense Category Breakdown | Структура прямых расходов мероприятия по категориям | M2, M4 | ORIGINAL_REQUEST §R3 |
| F12 | General Bar Expenses Summary | Сводка общехозяйственных расходов бара (аренда склада, инвентарь) | M2, M4 | ORIGINAL_REQUEST §R3 |
| F13 | Filterable Transaction Journal | Журнал операций с мгновенной фильтрацией по счетам, ивентам и типам | M2, M4 | ORIGINAL_REQUEST §R3 |
| F14 | Transaction Reversal & Deletion | Отмена/удаление операции со строгим пересчётом балансов и маржи | M2, M4 | ORIGINAL_REQUEST §R3 |
| F15 | Repository Pattern Abstraction | Интерфейс IFinanceStore, изолирующий БД от бизнес-логики | M1 | ORIGINAL_REQUEST §R4 |
| F16 | Local JSON & InMemory Storage | Автономное хранилище без внешних СУБД с автовосстановлением | M1 | ORIGINAL_REQUEST §R4 |
| F17 | Supabase-Ready Schema | DDL SQL для таблиц accounts, events, categories, transactions в Supabase | M1 | ORIGINAL_REQUEST §R4 |
| F18 | Seed Demo Data Generator | Предзаполненные 5 счетов, 2 ивента (Свадьба, Корпоратив) и 21 транзакция | M1 | ORIGINAL_REQUEST §R4 |
| F19 | Financial Math Test Suite | Автоматические юнит-тесты формул и балансовых инвариантов (npm test) | M1, M2 | ORIGINAL_REQUEST Acceptance |
| F20 | Russian Locale & Design System | Полная русификация, формат ДД.ММ.ГГГГ, 24ч, рубли ₽, палитра «Шампань и Бордо», адаптивность | M3, M4 | AGENTS.md, DESIGN_SYSTEM.md |
| F21 | Dev Runner & Build Pipeline | Скрипты npm run dev, npm run build, npm test, LAN host preview | M1 | AGENTS.md, ORIGINAL_REQUEST |
| F22 | Opaque-Box E2E Test Suite | Комплексный тестовый контур Tiers 1-4 по всем требованиям | M-TEST | Project Pattern Dual Track |
| F23 | Adversarial Coverage Hardening | White-box тестирование граничных случаев и стресс-тесты (Tier 5) | M5 | Project Pattern Final Milestone |
| F24 | Fast Command & NLP Parser | Парсер быстрых текстовых строк (сумма, категория, ивент, счёт) | M2 | ORIGINAL_REQUEST 21:56:51Z |
| F25 | Telegram Bot Integration | Модуль бота Bot API (long polling / webhook) с автопостингом | M2 | ORIGINAL_REQUEST 21:56:51Z |
| F26 | Web Fast Simulator & Bot Status | Веб-симулятор быстрой строки Telegram и индикатор статуса бота | M3 | ORIGINAL_REQUEST 21:56:51Z |
| F27 | SaaS Directory Customization | Управление счетами, соучредителями/партнёрами и статьями расходов | M5 | USER_REQUEST 21.09 |
| F28 | Catering Events & Receivables | Учёт договоров, оплат, дебиторки и расходов по выездным барам | M5 | USER_REQUEST 21.09 |
| F29 | Keyboard Input & Inline Category | Ввод с клавиатуры в NumericPad (0-9, Backspace, Esc) и inline-создание статей | M5 | USER_REQUEST 21.09 |
| F30 | Modern Staff Invite Links & QR | Приглашение сотрудников по ссылке, QR-коду, Telegram/WhatsApp и онбординг-экран за 5 секунд | M5 | USER_REQUEST 18.10 |
| F31 | Executive Admin UI & 2-Step Auth | Редизайн админки (баннер Quiet Luxury, таблица команды, 2-колоночное модальное окно профиля, двухфакторная смена email и пароля) | M5 | USER_REQUEST 21.10 |
| F32 | Linear/Stripe Executive Settings Layout | Лаконичный 2-колоночный интерфейс настроек организации с карточкой бренда, строками команды и безопасной зоной удаления | M5 | USER_REQUEST 22.10 |
| F33 | Localhost Environment Visual Distinction | Автоматическое переключение favicon на красный и префикс [LOCAL] во вкладке браузера при запуске на localhost / 127.0.0.1 | M5 | USER_REQUEST 22.10 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M-TEST | E2E Testing Suite Track | Создание независимого тест-раннера и тестов Tiers 1-4, включая парсер и быстрый ввод (TEST_READY.md) | none | DONE |
| M1 | Foundation, Storage & Seed | Структура проекта, package.json, TypeScript, IFinanceStore, JsonFileStore, Supabase DDL, 21-транзакционный сид | none | DONE |
| M2 | Financial Engine, Parser & Backend API | FinanceService, AnalyticsService, ParserService, TelegramBotService, REST API маршруты, отмена операций | M1 | DONE |
| M3 | Mobile 5-Sec Entry, Accounts & Bot Simulator | Карточки 5 счетов, мобильный ввод за 3 действия, симулятор быстрой строки Telegram, статус бота | M1, M2 | DONE |
| M4 | Event Margin Analytics & History | Дашборд маржинальности мероприятий, фильтруемый журнал транзакций, отмена операций | M2, M3 | DONE |
| M5 | Final Acceptance & Design Overhaul | 100% прохождение тестов (504/504), стиль Шампань & Бордо, вкладка Мероприятия, компактный журнал, справочники | M-TEST, M4 | DONE |

## Interface Contracts

### Shared Types & Models (`src/shared/types.ts`)
- `Account`: `{ id: string, name: string, type: 'cash'|'bank'|'card', initialBalance: number, currentBalance: number, currency: 'RUB', description: string, updatedAt: string }`
- `CateringEvent`: `{ id: string, title: string, clientName?: string, eventDate: string, status: 'planned'|'active'|'completed'|'cancelled', budget?: number, contractAmount?: number, guestCount?: number, location?: string, notes?: string }`
- `Category`: `{ id: string, name: string, type: 'income'|'expense'|'both', direction?: 'operational'|'business'|'dividends'|'transfer'|'all', color?: string, isEventSpecific: boolean }`
- `Partner`: `{ id: string, name: string, isActive: boolean, createdAt?: string, updatedAt?: string }`
- `Transaction`: `{ id: string, type: 'income'|'expense'|'transfer', amount: number, fromAccountId?: string, toAccountId?: string, categoryId: string, eventId?: string|null, partnerId?: string, description?: string, transactionDate: string, isDeleted: boolean }`
- `EventMarginMetrics`: `{ eventId: string, eventTitle: string, eventDate: string, revenue: number, directExpenses: number, netProfit: number, marginPercentage: number, expensesByCategory: Array<{ categoryId: string, categoryName: string, amount: number, percentage: number }> }`
- `ParsedCommand`: `{ amount: number, type: 'income'|'expense', categoryId?: string, eventId?: string|null, accountId: string, description: string, rawText: string, confidence: number }`
- `BotStatus`: `{ enabled: boolean, mode: 'polling'|'webhook'|'mock', botUsername?: string, lastActiveAt?: string }`

### REST API Endpoints (`src/server/routes/`)
- `GET /api/accounts` -> `{ accounts: Account[], totalBalance: number }`
- `POST /api/accounts`, `PUT /api/accounts/:id` -> управление счетами
- `GET /api/events` -> `{ events: CateringEvent[] }`
- `POST /api/events`, `PUT /api/events/:id`, `DELETE /api/events/:id` -> управление мероприятиями
- `GET /api/partners`, `POST /api/partners`, `PUT /api/partners/:id` -> управление партнёрами
- `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id` -> классификатор статей
- `GET /api/transactions` -> `{ transactions: Transaction[] }` (фильтры: `accountId`, `eventId`, `type`)
- `POST /api/transactions` -> `{ transaction: Transaction, updatedAccounts: Account[] }`
- `DELETE /api/transactions/:id` -> `{ success: boolean, transaction: Transaction, updatedAccounts: Account[] }`
- `GET /api/analytics/events` -> `{ analytics: EventMarginMetrics[] }`
- `GET /api/analytics/partners` -> сводка выплат соучредителям
- `POST /api/telegram/parse`, `POST /api/telegram/execute`, `GET /api/telegram/status` -> парсер и бот
- `POST /api/system/reset-demo` -> сброс к эталонному демо-состоянию

---

## Полная памятка проекта (Контекст для новых сессий)

### 1. Инфраструктура и боевой сервер (Production)
- **Хостинг и ОС:** VDS сервер FirstVDS (`153.76.170.74`), Ubuntu 24.04 LTS (2 ГБ RAM + 3 ГБ Swap).
- **Боевой домен:** `http://shved4656.fvds.ru`
- **SSH-подключение:** ключ `beget_deploy` лежит в корне рабочей папки проекта (`ssh -i beget_deploy root@153.76.170.74`).
- **Папка проекта на сервере:** `/var/www/findoctor` (права `www-root:www-root`).
- **Управление процессом:** системный сервис `systemd` — `findoctor.service` (порт `3001`), веб-сервер `Caddy` проксирует порты `80/443` на `127.0.0.1:3001`.
- **База данных:** Боевая СУБД **MySQL 8.0** на локальном интерфейсе сервера (`127.0.0.1:3306`), имя базы — `findoctor` (строго строчными буквами). В `.env` на сервере задан `STORAGE_MODE=mysql`. Учетные данные хранятся только в `/var/www/findoctor/.env` на сервере.
- **Веб-интерфейс базы данных (NocoDB):** развёрнут в Docker-контейнере `nocodb` (`--restart always --network host`) на порту `8085` (`http://shved4656.fvds.ru:8085`). Хранилище метаданных: `/var/lib/nocodb`. Включён флаг `NC_ALLOW_LOCAL_EXTERNAL_DBS=true`.
- **Автоматические бэкапы базы:** скрипт `/root/backup_findoctor.sh` запускается через `cron` каждые 6 часов (`0 */6 * * *`), сохраняя сжатые дампы `.sql.gz` в `/var/backups/findoctor/` с ротацией за последние 14 дней.

### 2. Регламент разработки и деплоя
1. **Локальная работа:** Все изменения кода сначала выполняются и проверяются локально. Сообщения коммитов в Git пишутся **строго на русском языке** простыми и понятными словами.
2. **Запрет на самовольный пуш:** Никогда не выполнять `git push` или деплой на сервер без явной команды владельца продукта.
3. **Проверка перед коммитом:**
   - `npm run typecheck` (0 ошибок TypeScript)
   - `npm test` (все 589 тестов в 34 тест-сьютах должны проходить успешно)
   - `npm run build` (успешная сборка клиента и сервера)
4. **Команды выкатки на боевой сервер (после подтверждения пользователя):**
   ```bash
   git push origin main
   ssh -i beget_deploy root@153.76.170.74 "cd /var/www/findoctor && git fetch origin && git reset --hard origin/main && npm run build && chown -R www-root:www-root /var/www/findoctor && systemctl restart findoctor"
   ```

### 3. Ключевые продуктовые и дизайнерские решения
- **Визуальный стиль:** «Quiet Luxury / Шампань и Бордо» + строгая архитектура **Linear / Stripe**. Светлый тёплый фон (`#f8f7f5`), чистые белые карточки (`#ffffff`), графитовый акцент (`#2b2724`), янтарный (`#d97706`) и изумрудный (`#059669`).
- **Разделение сред (Localhost vs Сервер):** На `localhost` / `127.0.0.1` в браузере автоматически включается ярко-красный значок `/favicon-dev.svg` и префикс `[LOCAL]` в заголовке вкладки, чтобы никогда не путать локальную вкладку с боевым сервером.
- **Безопасность профиля и компании:**
  - Смена email и пароля работает по взрослому двухфакторному сценарию через подтверждение 6-значным кодом на почту (без предзаполненных кодов).
  - При закрытии модального окна настроек все развёрнутые формы безопасности автоматически сворачиваются.
  - Имя/фамилия и должность — две отдельные графы.
  - Тарифный статус компании (`paidUntil` до 2126 года -> `PRO • Бессрочный доступ (VIP)`, `trialEndsAt` -> расчёт оставшихся дней триала) синхронизирован между админ-панелью и настройками компании.
  - В базе данных у всех компаний прописаны латинские `slug` (включая транслитерацию кириллицы).

### 4. Текущий фокус и следующие шаги
- Провести ревизию остальных вкладок интерфейса (**«Мероприятия»**, **«Журнал операций»**, **«Аналитика»**, **«Отчёты»**, **«Счета»**), выявить устаревшие или неровные элементы вёрстки и привести их к единому уровню качества Linear/Stripe.
