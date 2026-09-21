# Handoff Report: Specification Mining & Requirements Inventory

**Agent:** teamwork_preview_spec_miner_1  
**Archetype:** specification_miner  
**Workspace:** `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_spec_miner_1`  
**Date:** 2026-09-17  

---

## 1. Observation

Direct observations from the authoritative specification files in the workspace:

### 1.1 From `ORIGINAL_REQUEST.md` (Lines 9–56)
- **Line 9:** `"Система учёта финансов для барного кейтеринга и ивент-бизнеса с раздельным учётом по 5 счетам (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы), 5-секундным вводом операций с площадки и аналитикой маржинальности мероприятий. Чистая масштабируемая архитектура на React + TypeScript + Node.js с демонстрационными данными и схемой, готовой к Supabase."`
- **Lines 16–23 (R1):**
  ```markdown
  ### R1. Мультивалютный учёт по 5 счетам и операции
  Система ведёт раздельные балансы по счетам:
  - «Нал 1» (Касса бара на площадке — размен, чаевые, лёд)
  - «Нал 2» (Сейф / Владелец — крупные расчеты наличными, гонорары)
  - «Безнал 1» (Основной р/с кейтеринга — предоплаты по договору)
  - «Безнал 2» (Резервный р/с / Эквайринг на выезде)
  - «Переводы» (Личная карта — переводы СБП от гостей и клиентов)
  Поддерживаются 3 вида операций: Расход, Доход и Перевод между счетами (инкассация/снятие наличных) с пересчётом балансов в реальном времени.
  ```
- **Lines 25–30 (R2):**
  ```markdown
  ### R2. Мобильный интерфейс оперативного ввода (5 секунд)
  Адаптивный интерфейс (от 375px на смартфоне до десктопа) для мгновенной фиксации операции:
  - Быстрый выбор типа (Расход / Доход / Внутренний перевод).
  - Крупный цифровой ввод суммы.
  - Выбор счёта списания/зачисления и категории (Лёд/продукты, Алкоголь, Персонал, Логистика, Доплата, Чаевые).
  - Привязка к мероприятию или отметка «Общие расходы бара».
  ```
- **Lines 32–34 (R3):**
  ```markdown
  ### R3. Аналитика маржинальности и история операций
  - Сводная панель по мероприятиям: суммарная выручка, прямые расходы, чистая прибыль и маржинальность ивента.
  - Журнал транзакций с фильтром по счетам и мероприятиям, а также возможностью отмены/удаления ошибочных записей.
  ```
- **Lines 36–41 (R4):**
  ```markdown
  ### R4. Масштабируемая архитектура и готовность к Supabase
  - Единая модульная структура проекта на TypeScript:
    - Frontend: React + Vite + TypeScript с разделением на компоненты, хуки и модели.
    - Backend: Node.js (Express) + TypeScript с модульными роутами и сервисами.
  - Схема данных строго повторяет таблицы PostgreSQL / Supabase (`accounts`, `events`, `categories`, `transactions`). Локальное хранилище данных работает автономно из коробки, но предоставляет абстракцию хранилища (Repository pattern) для подключения клиента Supabase без переписывания бизнес-логики.
  - Проект поставляется с предзаполненными демо-данными (5 счетов, 2 реальных кейса мероприятий: свадьба и корпоратив) для моментального тестирования.
  ```
- **Lines 45–55 (Acceptance Criteria):**
  ```markdown
  ### Финансовая корректность и тесты
  - [ ] Наличие автоматических unit/integration тестов финансового ядра (проверка операций дохода, расхода, перевода между счетами и корректности итоговых остатков). Тесты запускаются командой `npm test` и завершаются успешно.
  - [ ] TypeScript компилируется без ошибок (`npm run build` / `npx tsc --noEmit`).

  ### Пользовательский интерфейс и адаптивность
  - [ ] Интерфейс полностью функционален на экранах от 375px (смартфон) до 1440px (десктоп) без горизонтального скролла и съезжающих элементов.
  - [ ] Сценарий внесения расхода с мобильного занимает не более 3 простых действий.

  ### Запуск и документация
  - [ ] Приложение запускается одной командой (например, `npm run dev` или `npm start`) по инструкции в README.
  - [ ] README.md содержит точные инструкции по установке, запуску локально и шаги для будущего подключения Supabase.
  ```

### 1.2 From `PROJECT.md` (Lines 9–25)
- **Lines 10–19:**
  ```markdown
  - Человек: владелец и партнёр барного кейтеринга (ивент-бизнес).
  - Момент: прямо на мероприятии или во время закупки, когда происходят движения денег по разным карманам и счетам.
  - Сейчас вместо: заброшенная Google-таблица, в которой невозможно уследить за реальным распределением денег.
  - Одно действие: за 5 секунд внести операцию (приход, расход или перевод между счетами) с указанием счёта списания/зачисления и сразу видеть точные остатки по всем счетам.
  - Чего не будет в первой версии: банковских интеграций по API, кассовых чеков (54-ФЗ), сложного складского списания граммов алкоголя.
  ```
- **Lines 23–25:**
  ```markdown
  - Стек: Node.js + TypeScript + React (Vite).
  - Причина выбора: TypeScript защитит финансовую математику от ошибок округления и опечаток в типах; React обеспечит плавный и быстрый мобильный интерфейс; Node.js объединяет веб-сервер и Telegram-бота.
  - База данных и Supabase: проектируется схема таблиц, на 100% совместимая с PostgreSQL / Supabase (`accounts`, `events`, `categories`, `transactions`). Для мгновенного и надёжного локального старта используется локальное структурированное хранилище, готовое к переносу в Supabase при выходе на облачный хостинг.
  ```

### 1.3 From `AGENTS.md` (Lines 188–254)
- **Lines 189:** `"Используй настоящий русский текст из сценария вместо Lorem ipsum."`
- **Lines 195–201:**
  ```markdown
  Избегай типичных признаков безликого AI-интерфейса:
  - бессмысленного градиента и свечения почти на каждом элементе;
  - огромного шаблонного заголовка без полезного действия на первом экране;
  - множества одинаковых карточек, вложенных друг в друга;
  - чрезмерных скруглений, плашек и декоративных «статусов»;
  - вымышленных отзывов, цифр, партнёров и преимуществ;
  - поясняющего текста там, где элемент можно сделать понятным сам по себе.
  ```
- **Lines 207–210:**
  ```markdown
  Для каждого основного экрана предусмотрены состояния: начальное, загрузка, успех, пустой результат, понятная ошибка и повторная попытка. Для необратимого действия должно быть ясное предупреждение или возможность отмены.
  ```
- **Lines 216–222 (Visual check):** Viewport range: 375px (mobile) to 1440px (desktop), no horizontal scroll, visible buttons, contrast.
- **Lines 247–254 (Russian locale defaults):**
  ```markdown
  - Интерфейс по умолчанию на русском языке, без технического жаргона.
  - Сначала проектируй для телефона, затем для большого экрана.
  - Используй читаемый размер текста, заметный фокус, понятные подписи и состояния загрузки, пустого результата и ошибки.
  - Не полагайся только на цвет; сохраняй доступность клавиатурой и контрастность.
  - По умолчанию показывай даты как `ДД.ММ.ГГГГ`, время в 24-часовом формате, денежные суммы в рублях и часовой пояс пользователя.
  ```

### 1.4 From `docs/core/DESIGN_SYSTEM.md` (Lines 16–83)
- Allowed UI dependencies: `lucide-react`, `motion` (imported via `motion/react`).
- CSS variable tokens:
  - Background: `--color-bg: #f1f1ec;`
  - Surfaces: `--color-surface: rgba(255, 255, 255, 0.68);`, `--color-surface-strong: rgba(255, 255, 255, 0.88);`
  - Border: `--color-border: rgba(255, 255, 255, 0.78);`
  - Text: `--color-text: #172019;`, `--color-text-muted: #657069;`
  - Accents: `--color-accent: #5f7c67;`, `--color-accent-strong: #46614e;`
  - Radii: `--radius-sm: 12px;`, `--radius-md: 18px;`, `--radius-lg: 28px;`
  - System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

---

## 2. Logic Chain

1. **Premise 1 (Domain & Context):** The user operates a bar catering and event business. When working at an event or buying supplies at 2 AM, the owner/bartender cannot use a bloated accounting system or messy spreadsheets.
2. **Premise 2 (Core Action):** The single pivotal action is recording an operation (expense, income, or transfer) within 5 seconds in at most 3 mobile gestures/taps, with immediate balance recalculation across 5 specific accounts.
3. **Premise 3 (Separation of Accounts):** The 5 accounts represent distinct physical and digital pockets:
   - `Нал 1`: Site bar cash register (change fund, guest cash tips, quick ice/lime purchases).
   - `Нал 2`: Owner's safe/pocket (large cash payments, staff wages/honorariums).
   - `Безнал 1`: Main legal entity bank account (formal client contract deposits).
   - `Безнал 2`: Secondary bank account / mobile acquiring terminal at the event.
   - `Переводы`: Personal bank card (SBP transfers from guests or private client prepayments).
4. **Premise 4 (Mathematical & State Invariants):**
   - Income adds funds to destination account.
   - Expense subtracts funds from source account.
   - Transfer transfers funds from source to destination account (`from != to`); total system money stays constant.
   - Transaction deletion/reversal must undo the exact debit/credit amounts.
   - Event margins require: Revenue = Sum(event income), Expenses = Sum(event expenses), Net Profit = Revenue - Expenses, Margin % = (Net Profit / Revenue) * 100%. Edge cases where Revenue == 0 must not throw `ZeroDivisionError`.
5. **Premise 5 (Supabase & Repository Architecture):**
   - Must expose a repository interface (`FinancialRepository`) separating domain operations from persistence.
   - Schema must strictly correspond to PostgreSQL tables: `accounts`, `events`, `categories`, `transactions`.
   - Primary keys must be UUIDs, numeric fields must avoid floating-point rounding bugs (`NUMERIC(14,2)` or integer kopecks).
   - Local adapter runs out of the box with zero external setup, pre-seeded with 5 accounts and 2 event cases («Свадьба Анны и Дмитрия» and «Корпоратив IT-компании TechCorp»).
6. **Premise 6 (UI Quality & Compliance):**
   - Mobile-first (375px) to desktop (1440px), Russian language only, dates `ДД.ММ.ГГГГ`, 24h clock, rubles `₽`, Lucide icons, Motion transitions.

---

## 3. Discovered Specifications & Requirements

### 3.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Accounts | 5-Account Real-Time Tracking | Independent balance tracking for Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы | Account ID | Current balance, currency, metadata, initial balance | Return 404 if account not found | ORIGINAL_REQUEST.md §R1 |
| 2 | R1: Operations | Expense Logging («Расход») | Records an expense, debits source account, links to category and event (or General) | `source_account_id`, `category_id`, `amount`, optional `event_id`, `description`, `date` | New transaction, updated source balance | Reject non-positive amounts, invalid account ID | ORIGINAL_REQUEST.md §R1, R2 |
| 3 | R1: Operations | Income Logging («Доход») | Records an income, credits target account, links to category and event (or General) | `target_account_id`, `category_id`, `amount`, optional `event_id`, `description`, `date` | New transaction, updated target balance | Reject non-positive amounts, invalid account ID | ORIGINAL_REQUEST.md §R1, R2 |
| 4 | R1: Operations | Inter-Account Transfer («Перевод») | Atomically transfers money from source to destination account | `source_account_id`, `target_account_id`, `amount`, `description`, `date` | New transfer transaction, updated source & target balances | Reject if `source == target`, or amount <= 0 | ORIGINAL_REQUEST.md §R1, R2 |
| 5 | R1: Accounts | Total Balance Aggregation | Calculates total liquidity across all 5 accounts | None | Sum of all account balances in RUB | Handle empty state gracefully (0 ₽) | ORIGINAL_REQUEST.md §R1 |
| 6 | R2: UI / Fast Entry | 3-Step 5-Second Mobile Modal | Optimized mobile form: 1) Op Type -> 2) Big Amount -> 3) Account/Category & Save | User taps / keypresses | Validated transaction submitted in <= 3 actions | Visual validation highlights, button disable on submission | ORIGINAL_REQUEST.md §R2, Acceptance Criteria |
| 7 | R2: UI / Fast Entry | Quick Category Selectors | Preset buttons/chips for event catering: Лёд/продукты, Алкоголь, Персонал, Логистика, Доплата, Чаевые | Category click | Selected category ID in state | Fallback to "Прочее" if unselected | ORIGINAL_REQUEST.md §R2 |
| 8 | R2: UI / Fast Entry | Quick Account Chips | Instant toggle between the 5 accounts for source/target | Account chip click | Selected account ID in state | Clear visual active border/pill | ORIGINAL_REQUEST.md §R2 |
| 9 | R2: UI / Fast Entry | "Общие расходы бара" Toggle | 1-tap assignment when expense is not tied to a specific event (e.g. general bar supplies) | Toggle / checkbox | `event_id = null` | Clears selected event cleanly | ORIGINAL_REQUEST.md §R2 |
| 10 | R3: Analytics | Event Margin Dashboard | Shows cards/table for each event: Revenue, Direct Expenses, Net Profit, Margin % | Event ID or All Events | Metric totals, margin %, profit indicator | Handles 0 revenue without NaN or Infinity | ORIGINAL_REQUEST.md §R3 |
| 11 | R3: Analytics | Expense Category Breakdown | Chart / list of direct expense distribution per event (alcohol, staff, ice, logistics) | `event_id` | Grouped sum per category | Shows "Нет расходов" if empty | ORIGINAL_REQUEST.md §R3 |
| 12 | R3: Analytics | General Bar Expenses Summary | Aggregates all expenses marked as "Общие расходы бара" | None | Total sum and breakdown of general expenses | 0 ₽ if no general expenses | ORIGINAL_REQUEST.md §R3 |
| 13 | R3: History | Filterable Transaction Journal | Chronological list of transactions with instant filters | Filters: account, event, type, date range | Filtered transaction list | Empty state "Операций не найдено" | ORIGINAL_REQUEST.md §R3 |
| 14 | R3: History | Transaction Reversal / Deletion | Reverts a transaction, re-adjusts account balance(s) and updates event analytics | `transaction_id` | Confirmation modal, balance restored, transaction deleted | 404 if transaction missing; safe undo | ORIGINAL_REQUEST.md §R3 |
| 15 | R4: Architecture | Repository Pattern Abstraction | Interface `FinancialRepository` abstracting DB calls from domain controllers/hooks | Domain DTOs | Entity models | Strict TypeScript typed exceptions | ORIGINAL_REQUEST.md §R4 |
| 16 | R4: Architecture | In-Memory / Local Storage Provider | Autonomous zero-dependency implementation of `FinancialRepository` | Read/write calls | In-memory / persisted JSON state | Safe fallback to demo data if corrupted | ORIGINAL_REQUEST.md §R4 |
| 17 | R4: Architecture | Supabase-Ready PostgreSQL Schema | Standard SQL DDL (`accounts`, `events`, `categories`, `transactions`) with constraints | SQL Migration file | Postgres tables with indexes and checks | Compatible with Supabase JS client | ORIGINAL_REQUEST.md §R4 |
| 18 | R4: Architecture | Seed / Demo Data Generator | Populates 5 accounts, 2 realistic events (Wedding, Corporate), and initial transactions | Reset trigger or cold boot | Ready-to-demo state | Idempotent generation | ORIGINAL_REQUEST.md §R4 |
| 19 | R4: Testing | Automated Core Math Test Suite | Integration/unit tests verifying financial invariants under all transaction types | Test runner (`npm test`) | Test results and assertions | Fails on any arithmetic or balance mismatch | ORIGINAL_REQUEST.md §Acceptance Criteria |
| 20 | UI / Styling | Design System Compliance | Glassmorphism surfaces, soft shadows, `#f1f1ec` background, Lucide icons, Motion feedback | CSS variables / tokens | Consistent mobile-to-desktop theme | Fallback for `prefers-reduced-motion` | docs/core/DESIGN_SYSTEM.md |
| 21 | UI / Formatting | Russian Localization Formatter | Formats rubles (`125 000 ₽`), dates (`ДД.ММ.ГГГГ`), 24-hour time (`ЧЧ:ММ`) | Numbers, ISO dates | Formatted strings in Russian | Handles null/undefined inputs safely | AGENTS.md Lines 252–254 |

---

### 3.2 Edge Cases

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Margin Calculation | Event has 25 000 ₽ direct expenses, but 0 ₽ revenue (e.g. prep phase) | Formula `(Net Profit / Revenue) * 100` would divide by zero. Spec: Revenue = 0 ₽, Expenses = 25 000 ₽, Net Profit = -25 000 ₽, Margin % displayed as `0.0%` or `—` (loss marked in red, no `NaN` or `Infinity`). |
| 2 | Inter-Account Transfer | Source account == Target account (e.g. Нал 1 -> Нал 1) | Validation error: Reject submission with message «Счёт списания и счёт зачисления должны отличаться». |
| 3 | Invalid Amounts | Amount is `0`, `-500`, or non-numeric (`abc`, `12.345`) | Validation error: Reject with message «Сумма должна быть больше нуля». Round / normalize to 2 decimal places. |
| 4 | Negative Account Balance | Bar register (`Нал 1`) has 1 500 ₽, expense is 3 000 ₽ for emergency ice | Allowed (cash on site can temporarily go into negative before replenishment/tips), but UI highlights balance in warning/alert state (`-1 500 ₽` in red/badge). |
| 5 | Deletion of Transaction | User deletes an old 10 000 ₽ expense on «Безнал 1» tied to «Свадьба» | Account `Безнал 1` balance increases by +10 000 ₽, «Свадьба» direct expenses decrease by -10 000 ₽, net profit increases by +10 000 ₽, margin % re-evaluated. Requires confirmation dialog. |
| 6 | Mobile Viewport (375px) | Opening quick entry on iPhone SE (375px) with large text/amount | Must not trigger horizontal scrolling (`overflow-x: hidden`), numpad and buttons must remain within touch targets (min 44x44px), sticky bottom save button visible above fold. |
| 7 | Rapid Double Tapping | User furiously taps «Сохранить» button twice within 200ms on mobile | Submit button enters disabled/loading state on first click; prevents duplicate transaction creation. |
| 8 | Event Deletion / Cascade | An event with 10 existing transactions is deleted | Database constraint: Set `event_id = NULL` on existing transactions (converting them to "Общие расходы") OR prevent deletion with warning. Safe default: prevent event deletion if active transactions exist, or archive event (`status = 'cancelled'`). |
| 9 | Corrupted Local Storage | `localStorage` data corrupted or empty JSON | Safe error handler catches JSON parse exception, logs warning, and auto-initializes with standard Demo Data so the app never crashes to a white screen. |
| 10 | High Volume Display | Large numbers (e.g. 15 000 000 ₽) and long event titles (e.g. 100 chars) | Text truncation with ellipsis (`text-overflow: ellipsis`) for event titles, proper thousand grouping (`15 000 000 ₽`) without wrapping currency symbol to next line. |

---

## 4. Data Entities & Schema Specification

The data model is engineered for full compatibility with PostgreSQL and Supabase.

### 4.1 Relational Schema (PostgreSQL / Supabase DDL)

```sql
-- 1. Accounts Table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('cash', 'bank', 'card_transfer')),
    description TEXT,
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    event_date DATE NOT NULL,
    location VARCHAR(255),
    guest_count INTEGER CHECK (guest_count >= 0),
    budget NUMERIC(14, 2) DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('expense', 'income', 'both')),
    icon VARCHAR(50),
    color VARCHAR(30),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    source_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    target_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transaction_accounts CHECK (
        (type = 'expense' AND source_account_id IS NOT NULL) OR
        (type = 'income' AND target_account_id IS NOT NULL) OR
        (type = 'transfer' AND source_account_id IS NOT NULL AND target_account_id IS NOT NULL AND source_account_id != target_account_id)
    )
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_event ON transactions(event_id);
CREATE INDEX idx_transactions_source ON transactions(source_account_id);
CREATE INDEX idx_transactions_target ON transactions(target_account_id);
```

### 4.2 TypeScript Domain Models

```typescript
export type AccountType = 'cash' | 'bank' | 'card_transfer';

export interface Account {
  id: string;
  name: string; // 'Нал 1' | 'Нал 2' | 'Безнал 1' | 'Безнал 2' | 'Переводы'
  type: AccountType;
  description: string;
  initialBalance: number;
  currentBalance: number;
  currency: string; // 'RUB'
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface CateringEvent {
  id: string;
  name: string;
  clientName?: string;
  eventDate: string; // 'YYYY-MM-DD'
  location?: string;
  guestCount?: number;
  budget?: number;
  status: EventStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType = 'expense' | 'income' | 'both';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  isDefault?: boolean;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  sourceAccountId?: string; // required for expense & transfer
  targetAccountId?: string; // required for income & transfer
  categoryId?: string;
  eventId?: string | null; // null represents 'Общие расходы бара'
  description?: string;
  transactionDate: string; // ISO string
  createdAt: string;
}

export interface EventFinancials {
  eventId: string;
  eventName: string;
  revenue: number;
  directExpenses: number;
  netProfit: number;
  marginPercentage: number; // (netProfit / revenue) * 100
  expenseBreakdown: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }[];
}
```

### 4.3 Mandatory Demo Data Entities

1. **5 Standard Accounts:**
   - `acc-1`: «Нал 1» (Касса бара на площадке — размен, чаевые, лёд). Initial: 15 000 ₽.
   - `acc-2`: «Нал 2» (Сейф / Владелец — крупные расчеты наличными, гонорары). Initial: 180 000 ₽.
   - `acc-3`: «Безнал 1» (Основной р/с кейтеринга — предоплаты по договору). Initial: 450 000 ₽.
   - `acc-4`: «Безнал 2» (Резервный р/с / Эквайринг на выезде). Initial: 85 000 ₽.
   - `acc-5`: «Переводы» (Личная карта — переводы СБП от гостей и клиентов). Initial: 42 000 ₽.

2. **Standard Preset Categories:**
   - Expenses:
     - «Лёд и расходники» (Icon: Sparkles / Box)
     - «Алкоголь» (Icon: Wine)
     - «Персонал (бармены/официанты)» (Icon: Users)
     - «Логистика и аренда посуды» (Icon: Truck)
     - «Хозтовары бара» (Icon: ShoppingBag)
   - Incomes:
     - «Предоплата по договору» (Icon: Receipt)
     - «Доплата / Финальный расчет» (Icon: CheckCircle)
     - «Чаевые команды» (Icon: HeartHandshake)
     - «Продажи на стойке» (Icon: GlassWater)

3. **2 Real Catering Event Scenarios:**
   - **Event A: «Свадьба Анны и Дмитрия»**
     - Date: 2026-09-20, Location: «Загородный клуб "Лесное"», Guests: 80.
     - Income: 250 000 ₽ (Предоплата на «Безнал 1») + 50 000 ₽ (Доплата наличными на «Нал 2»). Total Revenue: 300 000 ₽.
     - Direct Expenses:
       - 110 000 ₽ (Алкоголь — списание с «Безнал 1»)
       - 45 000 ₽ (Персонал — 3 бармена с «Нал 2»)
       - 18 000 ₽ (Аренда посуды и стекла — с «Безнал 1»)
       - 12 000 ₽ (Лёд краш/глыбы и фрукты — с «Нал 1»)
       - 10 000 ₽ (Логистика — с «Нал 1»)
     - Net Profit: 105 000 ₽. Margin: 35.0%.
   - **Event B: «Корпоратив IT-компании TechCorp»**
     - Date: 2026-09-26, Location: «Лофт "Красный Октябрь"», Guests: 150.
     - Income: 420 000 ₽ (Безнал 1) + 15 000 ₽ (Чаевые на Переводы). Total Revenue: 435 000 ₽.
     - Direct Expenses:
       - 160 000 ₽ (Премиальный алкоголь с «Безнал 1»)
       - 60 000 ₽ (Персонал 4 бармена + шеф-бартендер с «Нал 2»)
       - 25 000 ₽ (Сухой лед, глыбы, специи с «Нал 1»)
       - 20 000 ₽ (Транспорт и монтаж барной стойки с «Переводы»)
     - Net Profit: 170 000 ₽. Margin: 39.08%.

---

## 5. UI Requirements & AGENTS.md Compliance Checklist

| Rule / Principle | Requirement | Implementation Specification |
|---|---|---|
| **Language** | Russian language throughout | All labels, headers, action buttons, tooltips, validation errors in clear Russian (e.g. «Внести операцию», «Счёт списания», «Сумма в рублях», «Отмена»). |
| **Tone & Accessibility** | No technical jargon | Avoid database/technical terms like "NULL", "foreign key", "payload", "UUID". Use «Счёт не выбран», «Ошибка сохранения». |
| **No Lorem Ipsum** | 100% domain-accurate content | Real cocktail & event catering terms: «Закупка джина и тоника», «Выплата бармену за смену», «Чаевые за коктейльный сет». |
| **Responsive Range** | 375px to 1440px | Tested mobile layout (single column, sticky bottom actions, large touch targets >= 44px) to widescreen desktop grid (multi-column dashboard, side-by-side analytics). |
| **Horizontal Scroll** | 0px overflow | Strict CSS containment (`overflow-x: hidden`), flex/grid wrapping, responsive tables/lists. |
| **Date Format** | `ДД.ММ.ГГГГ` | Formatted via `Intl.DateTimeFormat('ru-RU')` (e.g. `20.09.2026`). |
| **Time Format** | 24-hour `ЧЧ:ММ` | `18:30` (never AM/PM). |
| **Currency** | Russian Ruble (`₽`) | Numbers formatted with thin space separator (`150 000 ₽`), never `RUB` or `RUR`. |
| **Speed (5-sec entry)** | <= 3 user steps | Quick entry modal: 1) Op Type toggle -> 2) Amount numpad/input -> 3) Account & Category chip tap -> Save. |
| **Visual Design** | DESIGN_SYSTEM.md standard | Background `--color-bg: #f1f1ec;`, surface card `--color-surface: rgba(255, 255, 255, 0.68);`, Lucide icons, Motion tap feedback. |
| **Anti-Patterns** | No AI cliches | No rainbow gradients, no excessive glows, no nested card clutter, no fake testimonials. |

---

## 6. Caveats

- **No Live Database in Phase 0:** Supabase is not connected in this local development phase; the repository pattern must provide an autonomous local adapter (in-memory + local persistence) that accurately reproduces all PostgreSQL constraints and behavior.
- **Out of Scope (per PROJECT.md):** No bank API webhooks, no 54-FZ fiscal register/cash receipt printers, and no gram-level inventory management in version 1.
- **Future Telegram Mini App:** Architecture should maintain clean separation so the mobile web app can be wrapped in a Telegram WebApp container later without redesign.

---

## 7. Conclusion

The specification for the Bar Catering Financial Accounting System is fully articulated, self-consistent, and grounded in the authoritative requirements from `ORIGINAL_REQUEST.md`, `PROJECT.md`, `AGENTS.md`, and `docs/core/DESIGN_SYSTEM.md`. 

The system decomposes into four well-defined subsystems:
1. **Financial Core & Multi-Account Engine:** Real-time state management across 5 accounts (`Нал 1`, `Нал 2`, `Безнал 1`, `Безнал 2`, `Переводы`) with strict atomic balance recalculation for Expenses, Incomes, and Transfers.
2. **Mobile Quick-Entry Subsystem:** Ergonomic 3-step interface optimized for 375px screens under active bar floor conditions (5-second rule).
3. **Event Margin & History Subsystem:** Revenue, direct expenses, net profit, margin % calculations per event with division-by-zero protection and reversible audit log.
4. **Clean Scalable Repository Layer:** Ready-to-go local autonomous storage with standard PostgreSQL DDL for Supabase migration.

---

## 8. Verification Method

To verify these specifications independently during implementation and acceptance:

1. **Financial Math & State Invariant Tests:**
   ```bash
   npm test
   ```
   Must execute automated unit tests verifying:
   - Expense decreases source account balance by exact amount.
   - Income increases target account balance by exact amount.
   - Transfer transfers exact amount between different accounts without changing total liquidity.
   - Transaction deletion restores previous balances.
   - Event margin formula handles zero revenue gracefully.

2. **TypeScript Compilation & Static Types:**
   ```bash
   npm run build
   # or
   npx tsc --noEmit
   ```
   Must compile cleanly with zero type errors.

3. **Responsive UI & Visual Verification:**
   - Open application in browser at viewport 375px x 667px (mobile) and 1440px x 900px (desktop).
   - Check that no horizontal scroll bar appears.
   - Check Russian currency symbol `₽`, date format `ДД.ММ.ГГГГ`, 24-hour time.
   - Measure number of interactions to log an expense: Op Type -> Amount -> Account & Category -> Save (<= 3 clicks).
