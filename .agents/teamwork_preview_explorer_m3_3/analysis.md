# Milestone M3: Fast Command Simulator & Telegram Bot Integration Analysis

**Author**: Explorer 3 (Fast Command Simulator & Telegram Integration)  
**Target Milestone**: M3 (Mobile 5-Sec Entry, Accounts & Bot Simulator)  
**Date**: 2026-09-17  
**Scope**: `src/client/components/telegram/`, `src/client/hooks/useTelegramSimulator.ts`, `src/client/hooks/useTelegramStatus.ts`, and main screen layout integration.

---

## 1. Executive Summary & Objective

The Telegram integration is the key "killer feature" of Truespace (ORIGINAL_REQUEST 21:56:51Z). On-site bar catering managers, head bartenders, and partners frequently need to record operations on the go in 5 seconds without navigating nested form fields.

While the backend Telegram bot (`TelegramBotService.ts`) supports real-time operations via Telegram Bot API (polling or webhook), the web application must provide:
1. **Telegram Bot Status Badge (`TelegramBotStatus.tsx`)**: Real-time indicator displaying bot handle `@TruespaceBarBot`, operational mode (`mock` or `polling`/`webhook`), and health status.
2. **In-Browser Fast Command Line Simulator (`FastCommandSimulator.tsx`)**: Interactive input mimicking the Telegram chat experience directly in the browser, enabling instant team testing without requiring a private bot token:
   - Real-time debounced parsing preview (`POST /api/telegram/parse`) displaying extracted amount, operation type, category chip, account chip, event chip, and confidence score.
   - One-click confirmation and execution (`POST /api/telegram/execute`) that atomically writes transactions into the ledger and updates account balances.
   - Quick example chips for sample catering operations ("3500 лед Корпоратив Т-Банк", "50000 предоплата Свадьба", "-1500 такси нал1", etc.).
3. **Seamless Screen Integration**: Clear desktop (1024px–1440px) and mobile (375px–768px) layout placement alongside the 5 account cards and manual 5-second entry modal.

All backend endpoints (`/api/telegram/status`, `/api/telegram/parse`, `/api/telegram/execute`) and ParserService logic are already implemented, tested with 55 unit/stress tests, and 100% passing. This analysis provides the concrete, drop-in architecture for the frontend layer.

---

## 2. API Contracts & Backend Verification

### 2.1 GET `/api/telegram/status`
- **Route**: `src/server/routes/telegram.ts:26-28`
- **Contract Type**: `BotStatus` (`src/shared/types.ts:225-238`)
- **Sample Payload**:
```json
{
  "enabled": true,
  "mode": "mock",
  "botUsername": "@TruespaceBarBot",
  "lastActiveAt": "2026-09-17T02:40:00.000Z",
  "configuredToken": false,
  "message": "Работа в режиме симулятора (без токена)"
}
```
- **Modes**:
  - `mock`: Safe development/demo mode without token; commands work via web simulator.
  - `polling`: Long-polling active with Telegram Bot API (when `BOT_TOKEN` is in `.env`).
  - `webhook`: Webhook mode for production HTTPS deployments.

### 2.2 POST `/api/telegram/parse`
- **Route**: `src/server/routes/telegram.ts:30-43`
- **Input**: `{ "text": string }`
- **Behavior**: Non-mutating analysis via `ParserService.parse(text)`.
- **Success (200 OK)**:
```json
{
  "parsed": {
    "amount": 3500,
    "type": "expense",
    "categoryId": "cat_ice",
    "categoryName": "Лёд и расходники",
    "eventId": "event_corporate",
    "eventTitle": "Корпоратив IT-компании TechCorp",
    "accountId": "card_sbp",
    "accountName": "Переводы (Личная карта)",
    "description": "3500 лед Корпоратив Т-Банк",
    "rawText": "3500 лед Корпоратив Т-Банк",
    "confidence": 0.95,
    "isGeneralExpense": false
  }
}
```
- **Validation Errors (400 Bad Request)**:
  - `{ "error": "Пустая команда", "statusCode": 400 }`
  - `{ "error": "В команде не указана сумма", "statusCode": 400 }`
  - `{ "error": "Сумма должна быть больше нуля", "statusCode": 400 }`

### 2.3 POST `/api/telegram/execute`
- **Route**: `src/server/routes/telegram.ts:45-58`
- **Input**: `{ "text": string }`
- **Behavior**: Parses command, creates atomic transaction in `FinanceService` with description `"[Telegram] <rawText>"`, adjusts account balances, and returns result.
- **Success (201 Created)**:
```json
{
  "success": true,
  "transaction": {
    "id": "tx-1694918239000-1234",
    "type": "expense",
    "amount": 3500,
    "fromAccountId": "card_sbp",
    "toAccountId": null,
    "categoryId": "cat_ice",
    "eventId": "event_corporate",
    "description": "[Telegram] 3500 лед Корпоратив Т-Банк",
    "transactionDate": "2026-09-17T02:40:00.000Z",
    "isDeleted": false
  },
  "updatedAccounts": [ ... ],
  "message": "Операция успешно проведена через Telegram"
}
```

---

## 3. Frontend Architecture & Component Breakdown

Directory structure:
```
src/client/
├── components/
│   └── telegram/
│       ├── FastCommandSimulator.tsx    # Main container: input, examples, live preview card, submit
│       ├── TelegramBotStatus.tsx       # Status badge with health indicator & details popover
│       ├── CommandChips.tsx            # Horizontal scrollable sample scenario chips
│       └── ParsedPreviewCard.tsx       # Live breakdown: Amount, Type, Category, Account, Event, Confidence
├── hooks/
│   ├── useTelegramSimulator.ts         # Debounce parsing, execution state, error management
│   └── useTelegramStatus.ts            # Bot status polling & health monitoring
```

### 3.1 Component Specifications

#### A. `TelegramBotStatus.tsx`
- **Role**: Compact status indicator displayed in header and simulator panel.
- **Features**:
  - Live pulsing status dot:
    - **Green (`#10b981`)**: Enabled with active Telegram token (`mode === 'polling' || 'webhook'`).
    - **Cyan/Sky (`#0284c7`)**: Mock mode (`mode === 'mock'`) indicating in-browser simulator readiness.
    - **Gray (`#94a3b8`)**: Inactive or disconnected.
  - Text badge: `Бот: @TruespaceBarBot` (or `Бот: Симулятор`).
  - Interactive Tooltip/Popover:
    - Clicking/hovering reveals a card showing:
      * Current mode: `Mock (Веб-симулятор)` / `Long Polling`
      * Bot handle: `@TruespaceBarBot`
      * Last ping/active timestamp (Russian 24h format, e.g. `14:23:05`)
      * Helper note: "Команды из чата автоматически записываются в кассу. Для тестирования используйте строку симулятора ниже."

#### B. `FastCommandSimulator.tsx`
- **Role**: Prominent command center for fast text entry.
- **Features**:
  - Semantic `<form>` with single-line `<input>` or auto-sizing `<textarea>`.
  - Placeholder: `"Например: 3500 лед Корпоратив Т-Банк или -1500 такси нал1..."`.
  - IME-safe submit listener:
    - Supports `Enter` key to execute without submitting incomplete Cyrillic composition (following `modern-web-guidance/ime-safe-enter-submit`).
    - `Ctrl+Enter` or explicit button click for mobile/tablet.
  - Clear button (`×`) when input is non-empty.
  - Quick example chips (`CommandChips`) above or below the input field.
  - Debounced real-time preview (`ParsedPreviewCard`):
    - Automatically updates ~250ms after typing stops.
    - Shows loading spinner during in-flight debounced parse.
  - Error state handling:
    - Suppresses error display when input is empty.
    - Shows gentle hint when text lacks numeric amount: `"💡 Укажите сумму цифрами, например: 3500 лед нал1"`.
  - One-click confirmation button:
    - `✓ Записать в кассу (Enter)`
    - Disabled when text is empty, invalid, or during execution (`isExecuting`).
  - Success feedback:
    - Shows temporary success banner: `"✓ Операция на 3 500 ₽ успешно записана в кассу!"` and automatically resets input after execution.

#### C. `CommandChips.tsx`
- **Role**: Preset chips showcasing realistic bar catering scenarios for 1-click testing.
- **Preset Data**:
```ts
export interface SampleCommand {
  label: string;
  command: string;
  categoryHint: string;
  type: 'expense' | 'income';
}

export const SAMPLE_COMMANDS: SampleCommand[] = [
  {
    label: '🧊 Лёд (Корпоратив)',
    command: '3500 лед Корпоратив Т-Банк',
    categoryHint: 'Лёд и расходники • Корпоратив • Переводы',
    type: 'expense',
  },
  {
    label: '💍 Предоплата (Свадьба)',
    command: '50000 предоплата Свадьба',
    categoryHint: 'Предоплата • Свадьба • Нал 1',
    type: 'income',
  },
  {
    label: '🚕 Такси (Бар)',
    command: '-1500 такси нал1',
    categoryHint: 'Логистика • Общие расходы • Нал 1',
    type: 'expense',
  },
  {
    label: '🍸 Джин (Сейф)',
    command: '12000 алкоголь джин нал2',
    categoryHint: 'Алкоголь • Сейф Нал 2',
    type: 'expense',
  },
  {
    label: '👔 Бармен (Свадьба)',
    command: '8000 ставка бармена Свадьба нал2',
    categoryHint: 'Персонал • Свадьба • Нал 2',
    type: 'expense',
  },
  {
    label: '💰 Чаевые кассы',
    command: '2500 чай бар нал1',
    categoryHint: 'Чаевые • Нал 1',
    type: 'income',
  },
];
```

#### D. `ParsedPreviewCard.tsx`
- **Role**: Visual breakdown of parsed entities before confirmation.
- **Visual Presentation**:
  - Amount Display:
    - Large formatted typography: `3 500 ₽` or `50 000 ₽` (using Russian `Intl.NumberFormat('ru-RU')`).
  - Type Pill:
    - `Расход` (soft rose badge: `background: rgba(225, 29, 72, 0.1); color: #be123c`)
    - `Приход` (soft emerald badge: `background: rgba(16, 185, 129, 0.1); color: #047857`)
  - Entity Chips Grid:
    - **Category**: `🧊 Лёд и расходники` / `🍸 Алкоголь` / `👔 Персонал`
    - **Account**: `💳 Переводы (Личная карта)` / `💵 Нал 1 (Касса на площадке)` / `💼 Безнал 1 (Основной р/с)`
    - **Event**: `🎉 Корпоратив IT-компании TechCorp` / `💍 Свадьба Анны и Дмитрия` / `🏢 Общие расходы бара`
  - Confidence Indicator:
    - E.g. `Точность распознавания: 95%` (badge with check icon).

---

## 4. Hook Architecture & Implementation Details

### 4.1 `useTelegramSimulator.ts`
```ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { ParsedCommand, Transaction, Account } from '../../shared/types.js';

export interface UseTelegramSimulatorOptions {
  onSuccess?: (result: { transaction: Transaction; updatedAccounts: Account[] }) => void;
  debounceMs?: number;
}

export interface UseTelegramSimulatorReturn {
  inputText: string;
  setInputText: (text: string) => void;
  parsed: ParsedCommand | null;
  isParsing: boolean;
  isExecuting: boolean;
  parseError: string | null;
  executeError: string | null;
  lastSuccessMessage: string | null;
  execute: (overrideText?: string) => Promise<boolean>;
  selectExample: (commandText: string) => void;
  clear: () => void;
}
```

**Key Internal Mechanisms**:
1. **Debounce + AbortController**:
   - Maintains `abortControllerRef` to cancel stale in-flight `/api/telegram/parse` requests.
   - Triggers `POST /api/telegram/parse` 250ms after user pauses typing.
   - Clears preview immediately if `inputText.trim() === ''`.
2. **Execution Flow**:
   - `POST /api/telegram/execute` with `{ text: trimmedText }`.
   - On 201: calls `onSuccess` to trigger automatic re-fetch of account balances and transaction journals across the app.
   - Sets temporary `lastSuccessMessage`, clears `inputText` and `parsed`.
3. **IME and Keyboard Handling**:
   - Supports form submission on `Enter`.

### 4.2 `useTelegramStatus.ts`
```ts
import { useState, useEffect, useCallback } from 'react';
import { BotStatus } from '../../shared/types.js';

export interface UseTelegramStatusReturn {
  status: BotStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

**Key Internal Mechanisms**:
- Fetches `GET /api/telegram/status` on mount.
- Polls every 15,000ms (15s) with background silence.
- Exposes `refetch()` so simulator execution immediately refreshes the `lastActiveAt` timestamp.

---

## 5. UX, Accessibility & Russian Locale Standards

Per `AGENTS.md` and `docs/core/DESIGN_SYSTEM.md`:

1. **Russian Typography**:
   - Currency formatted as `3 500 ₽` (with non-breaking space `\u00A0`).
   - Russian labels: `Расход`, `Приход`, `Счёт списания`, `Счёт зачисления`, `Категория`, `Мероприятие`.
   - Timestamps displayed in 24-hour Russian standard (`14:30`, `14:30:15`).

2. **Design Tokens & Aesthetic (`DESIGN_SYSTEM.md`)**:
   - Background: `--color-bg: #f1f1ec;`
   - Surface cards: `--color-surface: rgba(255, 255, 255, 0.68);` with `backdrop-filter: blur(12px)`.
   - Border: `--color-border: rgba(255, 255, 255, 0.78);`
   - Accent button: `--color-accent: #5f7c67;` (Catering Sage Green), `--color-accent-strong: #46614e;`
   - Shadow: soft multi-layered `--shadow-soft`.
   - Radius: `--radius-md: 18px;`, `--radius-sm: 12px;`.
   - Icons: Lucide React icons only (`Send`, `Sparkles`, `CheckCircle2`, `Bot`, `X`, `ArrowRight`, `Clock`).

3. **Mobile Ergonomics (375px–768px)**:
   - Example chips have horizontal touch scrolling with no layout break.
   - Touch hit targets are at least 44px × 44px.
   - No horizontal page scroll (`overflow-x: hidden` on viewport).
   - Input fields use font size >= 16px to prevent iOS auto-zoom.

---

## 6. Main Screen Layout Integration (`src/client/App.tsx`)

### 6.1 Desktop Layout (1024px – 1440px)
```
+-------------------------------------------------------------------------------+
| Truespace [Logo] | Капитал: 1 166 300 ₽ | [Telegram Бот: Симулятор 🟢] | [Сброс] |
+-------------------------------------------------------------------------------+
| КАРТОЧКИ 5 СЧЕТОВ:                                                            |
| [Нал 1: 34 500 ₽] [Нал 2: 120 000 ₽] [Безнал 1: 850 000 ₽] ...               |
+-------------------------------------------------------------------------------+
| БЫСТРЫЙ ВВОД ОПЕРАЦИЙ (Киллер-фича):                                          |
| +---------------------------------------------------------------------------+ |
| | [Командная строка: "3500 лед Корпоратив Т-Банк              "] [Выполнить] | |
| | Примеры: [3500 лед Корпоратив] [50000 предоплата Свадьба] [-1500 такси]... | |
| | +-----------------------------------------------------------------------+ | |
| | | Предпросмотр: -3 500 ₽ (Расход) | 🧊 Лёд | 💳 Переводы | 🎉 Корпоратив | | |
| | | [✓ Подтвердить и записать в кассу (Enter)]                            | | |
| | +-----------------------------------------------------------------------+ | |
| +---------------------------------------------------------------------------+ |
| Или: [+ Внести операцию вручную (5 секунд)] -> открывает 3-шаговое модальное окно|
+-------------------------------------------------------------------------------+
| [Дашборд маржинальности мероприятий M4] | [Журнал последних транзакций M4]     |
+-------------------------------------------------------------------------------+
```

### 6.2 Mobile Layout (375px – 430px)
```
+--------------------------------------------+
| Truespace           [Бот: Симулятор 🟢]     |
| Суммарный капитал: 1 166 300 ₽             |
+--------------------------------------------+
| Счета (горизонтальный свайп / стек):       |
| [Нал 1: 34.5k ₽] [Нал 2: 120k ₽] ...       |
+--------------------------------------------+
| Быстрый ввод Telegram:                     |
| [Текстовая строка ввода...     ] [Ввод]    |
| Чипы: [3500 лед] [50к Свадьба] [-1.5к] ... |
|                                            |
| [ Предпросмотр парсинга с чипами ]         |
| [ ✓ Записать в кассу ]                     |
+--------------------------------------------+
| Журнал операций (последние 5 записей)      |
+--------------------------------------------+
| [FAB: + Быстрый ручной ввод (5 сек)]       |
+--------------------------------------------+
```

---

## 7. Concrete Implementation Blueprints

### 7.1 `src/client/components/telegram/FastCommandSimulator.tsx`
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTelegramSimulator } from '../../hooks/useTelegramSimulator';
import { TelegramBotStatus } from './TelegramBotStatus';
import { CommandChips } from './CommandChips';
import { ParsedPreviewCard } from './ParsedPreviewCard';

interface FastCommandSimulatorProps {
  onTransactionCreated?: () => void;
  className?: string;
}

export const FastCommandSimulator: React.FC<FastCommandSimulatorProps> = ({
  onTransactionCreated,
  className = '',
}) => {
  const {
    inputText,
    setInputText,
    parsed,
    isParsing,
    isExecuting,
    parseError,
    executeError,
    lastSuccessMessage,
    execute,
    selectExample,
    clear,
  } = useTelegramSimulator({
    onSuccess: () => {
      onTransactionCreated?.();
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed && !isExecuting) {
      execute();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME composition safety check per modern-web-guidance
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (parsed && !isExecuting) {
        e.preventDefault();
        execute();
      }
    }
  };

  return (
    <div
      className={`relative rounded-2xl border p-5 shadow-sm transition-all ${className}`}
      style={{
        background: 'var(--color-surface, rgba(255, 255, 255, 0.72))',
        borderColor: 'var(--color-border, rgba(255, 255, 255, 0.8))',
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: 'var(--color-accent, #5f7c67)' }}
          >
            <Sparkles size={16} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 leading-tight">
              Быстрый ввод из чата Telegram
            </h3>
            <p className="text-xs text-slate-500">
              Пишите операцию свободной фразой или нажимайте примеры
            </p>
          </div>
        </div>
        <TelegramBotStatus />
      </div>

      {/* Preset Chips */}
      <div className="mb-3">
        <CommandChips onSelect={selectExample} activeCommand={inputText} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative mb-3">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Например: 3500 лед Корпоратив Т-Банк или -1500 такси нал1..."
            className="w-full rounded-xl border px-4 py-3 pr-24 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              borderColor: parseError && inputText ? '#f43f5e' : 'rgba(0,0,0,0.1)',
            }}
            disabled={isExecuting}
            aria-label="Текст быстрой команды Telegram"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {inputText && (
              <button
                type="button"
                onClick={clear}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                title="Очистить поле"
                aria-label="Очистить поле"
              >
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              disabled={!parsed || isExecuting || isParsing}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent, #5f7c67)' }}
              title="Записать операцию в кассу"
            >
              {isExecuting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <span>Ввод</span>
                  <Send size={12} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic inline guidance */}
        {parseError && inputText.trim() !== '' && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-600">
            <AlertCircle size={13} />
            <span>{parseError}</span>
          </div>
        )}
      </form>

      {/* Success banner */}
      {lastSuccessMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 animate-fade-in">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <span>{lastSuccessMessage}</span>
        </div>
      )}

      {/* Parsed Preview Card */}
      {parsed && (
        <ParsedPreviewCard
          parsed={parsed}
          isExecuting={isExecuting}
          onConfirm={() => execute()}
        />
      )}
    </div>
  );
};
```

### 7.2 `src/client/components/telegram/TelegramBotStatus.tsx`
```tsx
import React, { useState } from 'react';
import { Bot, CheckCircle, ExternalLink, HelpCircle, RefreshCw } from 'lucide-react';
import { useTelegramStatus } from '../../hooks/useTelegramStatus';

export const TelegramBotStatus: React.FC = () => {
  const { status, isLoading, refetch } = useTelegramStatus();
  const [showPopover, setShowPopover] = useState(false);

  const isMock = status?.mode === 'mock';
  const isPolling = status?.mode === 'polling';
  const isOnline = status?.enabled;

  const modeBadgeColor = isPolling
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-sky-100 text-sky-800 border-sky-200';

  const dotColor = isPolling ? 'bg-emerald-500' : 'bg-sky-500';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition hover:shadow-sm ${modeBadgeColor}`}
        title="Информация о статусе Telegram-бота"
      >
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <Bot size={13} className="shrink-0" />
        <span>{isMock ? 'Симулятор Telegram' : '@TruespaceBarBot'}</span>
      </button>

      {/* Detail Popover */}
      {showPopover && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowPopover(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-30 w-72 rounded-2xl border bg-white p-4 shadow-xl text-slate-800 text-xs"
            style={{
              borderColor: 'var(--color-border, rgba(0,0,0,0.1))',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-2 mb-2.5">
              <span className="font-semibold text-slate-900">Интеграция Telegram</span>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="text-slate-400 hover:text-slate-600 transition p-1"
                title="Обновить статус"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Режим:</span>
                <span className="font-medium font-mono">
                  {status?.mode === 'mock'
                    ? 'Mock (Web Simulator)'
                    : status?.mode === 'polling'
                    ? 'Long Polling'
                    : 'Webhook'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Бот в Telegram:</span>
                <a
                  href={`https://t.me/${(status?.botUsername || 'TruespaceBarBot').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                >
                  {status?.botUsername || '@TruespaceBarBot'}
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Статус:</span>
                <span className="font-medium text-emerald-700">
                  {status?.enabled ? 'Готов к приёму' : 'Отключен'}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 border-t pt-2">
              {status?.message ||
                'Команды, отправленные в Telegram или симулятор, автоматически разносятся по счетам и статьям расходов.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
```

### 7.3 `src/client/components/telegram/ParsedPreviewCard.tsx`
```tsx
import React from 'react';
import { Check, ArrowRight, Wallet, Calendar, Tag, ShieldCheck } from 'lucide-react';
import { ParsedCommand } from '../../shared/types';

interface ParsedPreviewCardProps {
  parsed: ParsedCommand;
  isExecuting: boolean;
  onConfirm: () => void;
}

export const ParsedPreviewCard: React.FC<ParsedPreviewCardProps> = ({
  parsed,
  isExecuting,
  onConfirm,
}) => {
  const isIncome = parsed.type === 'income';

  const formattedAmount = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(parsed.amount);

  const confidencePercent = Math.round(parsed.confidence * 100);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm animate-fade-in">
      {/* Top summary row: Amount & Type */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`text-lg font-bold tracking-tight ${
              isIncome ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {isIncome ? `+${formattedAmount}` : `-${formattedAmount}`}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isIncome
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {isIncome ? 'Приход' : 'Расход'}
          </span>
        </div>

        {/* Confidence score */}
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Точность: {confidencePercent}%</span>
        </div>
      </div>

      {/* Entity Chips Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-3 text-xs">
        {/* Category */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100">
          <Tag size={14} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Статья
            </span>
            <span className="block font-medium text-slate-700 truncate" title={parsed.categoryName}>
              {parsed.categoryName || 'Хозтовары бара'}
            </span>
          </div>
        </div>

        {/* Account */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100">
          <Wallet size={14} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              {isIncome ? 'Счёт зачисления' : 'Счёт списания'}
            </span>
            <span className="block font-medium text-slate-700 truncate" title={parsed.accountName}>
              {parsed.accountName || 'Нал 1 (Касса)'}
            </span>
          </div>
        </div>

        {/* Event */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Мероприятие
            </span>
            <span className="block font-medium text-slate-700 truncate" title={parsed.eventTitle || 'Общие расходы бара'}>
              {parsed.eventTitle || 'Общие расходы бара'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isExecuting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent, #5f7c67)' }}
        >
          <Check size={14} />
          <span>Подтвердить и записать в кассу (Enter)</span>
        </button>
      </div>
    </div>
  );
};
```

---

## 8. Test Alignment Matrix & Verification

| Requirement ID | Test Case | Target Assertion | Verification Status |
|---|---|---|---|
| F24-1 | Fast Command entity parse | `3500 лед Корпоратив Т-Банк` -> `3500`, `expense`, `cat_ice`, `event_corporate`, `card_sbp` | Verified in unit & E2E tests |
| F24-2 | Income keyword parse | `50000 предоплата Свадьба` -> `50000`, `income`, `cat_prepayment`, `event_wedding` | Verified |
| F24-3 | Negative amount prefix | `-1500 такси нал1` -> `1500`, `expense`, `cat_logistics`, `cash_1` | Verified |
| F25-1 | Bot status endpoint | `GET /api/telegram/status` -> `{ enabled: true, mode: 'mock'|'polling' }` | Verified |
| F25-3 | Execution via Telegram | `POST /api/telegram/execute` -> writes transaction with `[Telegram]` prefix | Verified |
| F26-1 | Non-mutating preview | `POST /api/telegram/parse` does NOT alter account balances | Verified in `tier1_features_f22_f26.test.ts:210` |
| F26-2 | High confidence preview | Recognized commands have confidence >= 0.8 | Verified |
| F26-4 | Empty input error | Empty string returns 400 with "Пустая команда" | Verified |
| F26-5 | Missing amount error | String without number returns 400 with "не указана сумма" | Verified |

---

## 9. Conclusion & Worker Implementation Checklist

The Telegram Fast Simulator and Bot Status badge are ready for implementation in Milestone M3:
- [ ] Create `src/client/hooks/useTelegramStatus.ts`
- [ ] Create `src/client/hooks/useTelegramSimulator.ts`
- [ ] Create `src/client/components/telegram/CommandChips.tsx`
- [ ] Create `src/client/components/telegram/ParsedPreviewCard.tsx`
- [ ] Create `src/client/components/telegram/TelegramBotStatus.tsx`
- [ ] Create `src/client/components/telegram/FastCommandSimulator.tsx`
- [ ] Export components and wire into `App.tsx` (desktop & mobile responsive layout).
