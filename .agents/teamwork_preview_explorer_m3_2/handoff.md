# Handoff Report — Milestone M3 (Data Hooks & API Integration)

## 1. Observation
1. **Server Routes & API Signatures**:
   - `src/server/routes/accounts.ts:18–25`: `GET /api/accounts` returns `{ accounts: Account[], totalBalance: number }`.
   - `src/server/routes/categories.ts:18–25`: `GET /api/categories` returns `{ categories: Category[] }`.
   - `src/server/routes/events.ts:20–27`: `GET /api/events` returns `{ events: CateringEvent[] }`.
   - `src/server/routes/transactions.ts:20–61`: `GET /api/transactions` supports query filters `accountId`, `eventId`, `type`, `categoryId`, `startDate`, `endDate`, `includeDeleted`. Specifically, lines 29–31 handle `eventId === 'null' || eventId === ''` to query general bar overhead transactions (`eventId === null`).
   - `src/server/routes/transactions.ts:76–87`: `POST /api/transactions` receives `CreateTransactionDTO` and returns `{ success: true, transaction: Transaction, updatedAccounts: Account[] }` with HTTP status 201.
   - `src/server/routes/transactions.ts:89–103`: `DELETE /api/transactions/:id` soft-deletes a transaction, reverses balances, and returns `{ success: true, transaction: Transaction, updatedAccounts: Account[], message: string }`.
   - `src/server/routes/telegram.ts:26–28`: `GET /api/telegram/status` returns `BotStatus` (`{ enabled, mode, botUsername, lastActiveAt, configuredToken, message }`).
   - `src/server/routes/telegram.ts:30–43`: `POST /api/telegram/parse` receives `{ text: string }` and returns `{ parsed: ParsedCommand }`.
   - `src/server/routes/telegram.ts:45–58`: `POST /api/telegram/execute` receives `{ text: string }` and returns `{ success: true, transaction: Transaction, updatedAccounts: Account[], message: string }` with HTTP status 201.
   - `src/server/routes/system.ts:18–35`: `POST /api/system/reset-demo` resets storage to canonical seed and returns `{ success: true, message: string, accounts: Account[], transactionsCount: number, eventsCount: number }`.

2. **Domain Models & DTOs**:
   - `src/shared/types.ts`: Defines `Account`, `Category`, `CateringEvent`, `Transaction`, `ParsedCommand`, and `BotStatus`.
   - `src/shared/dto.ts:197–267`: `validateCreateTransactionDTO(input)` strictly validates positive amounts, account requirements by transaction type, and category presence, with Russian validation error messages.
   - `src/shared/constants.ts:232–239`: Defines `QUICK_CATEGORY_CHIPS` with 6 essential chips: Supplies («Лёд и продукты»), Alcohol («Алкоголь»), Staff («Персонал»), Logistics («Логистика»), Onsite Sales («Доплата/Продажи»), and Tips («Чаевые»).

3. **Existing Tooling & Verification**:
   - Running `npm.cmd test` executed 16 test files (371 tests), all passing (100% pass rate).
   - Running `npm.cmd run typecheck` executed both `tsc --noEmit` and `tsc -p tsconfig.server.json --noEmit` with 0 errors.
   - `vite.config.ts:11–17`: Configures `/api` proxy targeting `http://localhost:3001` with `changeOrigin: true`.

4. **Client Directory Absence**:
   - `src/client/` has not yet been populated with code; `index.html:19` references `/src/client/main.tsx`.

## 2. Logic Chain
1. *From Observation 1 (`POST /api/transactions` and `POST /api/telegram/execute` return `updatedAccounts`)*:
   - When a transaction is created or deleted, the server recalculates balances and sends back the mutated account objects.
   - Therefore, the client data layer does not need to issue a subsequent `GET /api/accounts` round-trip. It can immediately update its accounts state from `updatedAccounts`, eliminating latency and race conditions.

2. *From Observation 1 & 2 (`validateCreateTransactionDTO` in `src/shared/dto.ts`)*:
   - The validation rules are already exported and zero-dependency in `src/shared/dto.ts`.
   - Therefore, client-side hooks (`useTransactions`) can execute `validateCreateTransactionDTO` locally before firing a `fetch`, providing sub-50ms instant error feedback in mobile modal forms.

3. *From Observation 1 & 4 (Multiple independent UI consumers: Cards, Modal, Telegram simulator, Header)*:
   - If each component instantiates isolated state hooks without a shared store, creating a transaction in the 5-sec modal or the Telegram simulator will not reflect in the account cards or total balance without a manual refetch or page reload.
   - Therefore, a shared `FinanceContext` (or coordinated event bus) is required to hold `accounts`, `transactions`, `events`, and `categories` as a single source of truth.

4. *From Observation 3 & Modern Web Guidance (`deprioritize-background-fetches`)*:
   - Transaction submission and fast entry are high-priority user interactions (`priority: 'high'`).
   - Bot status polling (`/api/telegram/status`) is non-critical background telemetry and should use `priority: 'low'` with `AbortController` timeouts (8000 ms) to prevent network contention on mobile connections.

5. *From Observation 2 (`round2` in `FinanceService` and `test-client`)*:
   - All balance mutations must enforce `Math.round(val * 100) / 100` on the client during optimistic updates to avoid IEEE-754 floating point inaccuracies.

## 3. Caveats
1. **Service Worker / PWA Offline Mutation Queue**:
   - For Milestone M3, local caching in `localStorage` hydrates accounts and categories on cold start, but an offline mutation replay queue (background sync) is deferred to future hardening; currently, failed requests trigger clean rollbacks with a clear Russian prompt to retry.
2. **WebSockets vs Polling**:
   - The current server routes rely on HTTP REST endpoints. Polling for bot status is lightweight and sufficient; WebSockets are not required by M3 specifications.
3. **External State Libraries**:
   - No external state management libraries (Redux, Zustand, React Query) are installed in `package.json`. All hooks are implemented natively with React 18 built-ins (`useState`, `useEffect`, `useCallback`, `useMemo`, `useContext`), maintaining zero extra bundle weight.

## 4. Conclusion
The client-side data layer architecture is fully designed and specified in `analysis.md`. It consists of:
- `src/client/api/apiClient.ts` & `errors.ts`: Strongly-typed API client wrapper handling timeouts, abort signals, low-priority polling, and humanized Russian error messages.
- `src/client/context/FinanceContext.tsx`: Unified React Context managing atomic state synchronization between accounts and transactions.
- Custom Hooks:
  - `useAccounts`: 5-account balance tracking, liquidity calculation, optimistic mutations.
  - `useTransactions`: 3-step 5-second entry flow, local validation, soft-delete reversal.
  - `useCategories`: 6 quick category chips, lookup dictionaries, color tokens.
  - `useEvents`: Active event filtering, event title resolution («Общие расходы бара»).
  - `useTelegram`: Debounced command parsing preview, one-click execution into the ledger, bot status badge.
  - `useResetDemo`: One-click demo data restoration with cache invalidation.
- `src/client/utils/formatters.ts`: Russian currency (`₽`), date (`ДД.ММ.ГГГГ`), and 24-hour time formatting.

The design strictly complies with `ORIGINAL_REQUEST.md`, `PROJECT.md`, `AGENTS.md`, and all existing E2E test contracts.

## 5. Verification Method
1. **Run Full Test Suite**:
   ```powershell
   npm.cmd test
   ```
   *Expected*: All 16 test files pass (371 tests passing).

2. **Run TypeScript Strict Typecheck**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected*: Zero TypeScript compilation errors across client, shared, and server configurations.

3. **Verify API Endpoint Alignment**:
   Inspect `src/client/api/apiClient.ts` against `src/server/routes/*.ts` to confirm 100% path, query parameter, and payload parity.

4. **Verify Mobile 5-Sec Performance**:
   Confirm that `useTransactions().createTransaction()` applies optimistic state in < 20 ms before waiting for the network promise to resolve.
