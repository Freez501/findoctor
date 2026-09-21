# Empirical Challenge Report: Milestone M2 (ParserService & TelegramBotService)

**Agent**: `teamwork_preview_challenger_m2_1`  
**Milestone**: Milestone M2 (Financial Engine, Parser & Backend API)  
**Working Directory**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_challenger_m2_1`  
**Date**: 2026-09-17  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Observation

We designed and executed an extensive empirical stress and adversarial suite targeting `ParserService` (`src/server/services/ParserService.ts`), `TelegramBotService` (`src/server/telegram/TelegramBotService.ts`), and `FinanceService` (`src/server/services/FinanceService.ts`). The test suite is implemented in:
`tests/unit/m2_parser_telegram_stress.test.ts` (55 test cases across 13 challenge dimensions).

### 1.1 Empirical Verification Test Run
- **Command**: `npx.cmd vitest run tests/unit/m2_parser_telegram_stress.test.ts`
- **Output**:
  ```
   RUN  v2.1.9 C:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace

   ✓ tests/unit/m2_parser_telegram_stress.test.ts (55 tests) 284ms

   Test Files  1 passed (1)
        Tests  55 passed (55)
     Duration  874ms
  ```
- **Full Test Suite Run**: `npm.cmd test` (16 test files passed, 371 tests passed in 1.75s).
- **TypeScript Typecheck**: `npm.cmd run typecheck` (Exit code 0, 0 errors across server and client).

---

### 1.2 Observed Defects & Empirical Discrepancies

#### Defect 1: Race Condition & Lost Balance Updates Under Concurrent Execution
- **Location**: `src/server/services/FinanceService.ts:167-173` and `src/server/services/FinanceService.ts:182-187`
- **Observation**:
  `FinanceService.createTransaction` executes:
  ```typescript
  const currentSource = await this.store.getAccountById(sourceAccountId);
  // ...
  const newSourceBalance = round2(currentSource.currentBalance - amount);
  const updatedSource = await this.store.updateAccountBalance(sourceAccountId, newSourceBalance);
  ```
  When 20 concurrent transactions (`100 лед нал1`) are executed via `Promise.all`:
  - 20 transaction records are successfully logged to storage.
  - All 20 calls concurrently read `currentSource.currentBalance = 6300`.
  - All 20 compute `6300 - 100 = 6200` and write `6200`.
  - **Empirical result**: Final balance is `6200` ₽ instead of expected `4300` ₽ (`6300 - 2000`).
  - Exactly **1,900 ₽ of balance mutations are silently lost**.
  - In sequential execution (`for ... await`), balance reconciliation is 100% accurate (final balance: `4300` ₽).

#### Defect 2: Cyrillic Declension Bug Causing Incomes to be Logged as Expenses
- **Location**: `src/server/services/ParserService.ts:59-72` vs `src/server/services/ParserService.ts:133-145`
- **Observation**:
  In `ParserService.ts` line 61, transaction type detection tests:
  ```typescript
  lower.includes('предоплата') || lower.includes('доплата') || ...
  ```
  In Russian, users commonly use inflected cases:
  - Accusative: `"50000 предоплату Свадьба"` ("внести предоплату") -> `lower.includes('предоплата')` is `false`.
  - Genitive: `"50000 часть предоплаты Свадьба"` -> `lower.includes('предоплата')` is `false`.
  - Accusative: `"20000 доплату Корпоратив"` -> `lower.includes('доплата')` is `false`.
  - Genitive: `"5000 чаевых нал1"` -> `lower.includes('чаевые')` is `false`.
  
  However, category detection on line 133 uses the stem: `lower.includes('предоплат')`, which is `true`.
  - **Empirical result**: `"50000 предоплату Свадьба"` is parsed as `{ type: 'expense', categoryId: 'cat_prepayment' }`!
  - **Impact**: A 50,000 ₽ contract prepayment is recorded as an operational **EXPENSE** instead of an **INCOME**!

#### Defect 3: Cross-Module Event ID Divergence (`event_wedding` vs `event-wedding`)
- **Location**: `src/server/services/ParserService.ts:159,169` vs `src/shared/constants.ts:245-248` and `src/server/data/supabase.sql:259-261`
- **Observation**:
  In `constants.ts`, canonical event IDs use hyphens:
  ```typescript
  export const EVENT_IDS = { WEDDING: 'event-wedding', CORPORATE: 'event-corporate' }
  ```
  In `ParserService.ts`, event IDs are hardcoded with underscores:
  ```typescript
  eventId = 'event_wedding';
  // ...
  eventId = 'event_corporate';
  ```
  - When transactions are created through Telegram (`bot.executeCommand('50000 предоплата Свадьба')`), `tx.eventId` is stored as `'event_wedding'`.
  - When querying `/api/transactions?eventId=event-wedding`, `InMemoryStore:118` does a strict comparison (`tx.eventId === filter.eventId`), returning **0 matching transactions**.
  - In PostgreSQL / Supabase, table `events` contains `id = 'event-wedding'`. Inserting `'event_wedding'` violates foreign key constraint `event_id REFERENCES events(id)`.
  - While `AnalyticsService` was patched with a custom string replacement bridge (`replace(/-/g, '_')`), the underlying storage filter and data contracts remain broken.

#### Defect 4: Greedy Grouping Regex Anomaly in Multi-Number Inputs
- **Location**: `src/server/services/ParserService.ts:38`
- **Observation**:
  Regex `/-?\d+(?:[\s_]\d{3})*(?:[.,]\d+)?/` treats spaces as thousand separators.
  When input has a number followed by a space and an amount, e.g.:
  `"Свадьба 2 50000 предоплата"` (Event #2, 50,000 ₽):
  - The regex matches `"2 "` followed by `"500"`, capturing `"2 500"` = **2,500 ₽**!
  - The trailing `"00"` is discarded. A 50,000 ₽ payment is recorded as 2,500 ₽.
  When input is `"2 ящика водки 10000 р"`, it matches `"2"` as the amount because it captures the first numeric token greedily.

#### Defect 5: `accountName` Desynchronization when `defaultAccountId` is Passed
- **Location**: `src/server/services/ParserService.ts:174-175`
- **Observation**:
  ```typescript
  let accountId = options?.defaultAccountId || 'cash_1';
  let accountName = 'Нал 1 (Касса на площадке)';
  ```
  When `options.defaultAccountId = 'bank_1'` is passed and the text contains no account keywords, `result.accountId` is `'bank_1'`, but `result.accountName` is still `'Нал 1 (Касса на площадке)'`.

#### Defect 6: Substring Collisions in Russian Vocabulary
- **Location**: `src/server/services/ParserService.ts:88,99,198`
- **Observation**:
  - `"10000 половина предоплаты Свадьба"`: word `"половина"` contains `"вин"`, matching `lower.includes('вин')` -> classified as `cat_alcohol` (Alcohol).
  - `"2000 высокий бокал"`: word `"высокий"` contains `"сок"`, matching `lower.includes('сок')` -> classified as `cat_ice` (Ice) rather than `cat_logistics` (Logistics/Glassware).
  - `"5000 барбекю"`: contains `"бар"`, matching `lower.includes('бар')` -> routed to `cash_1` (Bar Cash).

---

### 1.3 Verified Robust Capabilities (No Regressions)
- **Batch Throughput**: Parsed 10,000 commands in **78ms** (>10,000 ops/sec).
- **ReDoS Resistance**: Tested with hostile 20,000-character repeating inputs (`"1" + " 000"*5000`, `"a"*20000 + " 5000"`); all completed in under **5ms**.
- **Exception Safety & Crash Resistance**: Fuzzed across 1,000 randomized chaotic inputs; 0 unhandled exceptions, 0 NaN values, all invalid inputs threw clean Russian `Error` instances.
- **Sequential Reversibility**: Reversal of 50 sequential Telegram transactions completely restored initial capital (1,166,300 ₽) and account balances with zero floating-point drift.
- **Cyrillic Typography**: Resilient against ALL-CAPS, MiXeD-cAsE, and letter "Ё" vs "Е".
- **Whitespace & Formatting**: Handles non-breaking spaces (`\u00A0`, `\u202F`), quotes («», “”, ""), parentheses, and currency symbols (₽, руб).

---

## 2. Logic Chain

1. **Financial Integrity & Invariants (Observation 1.2, Defect 1)**:
   - Double-entry accounting requires that every transaction strictly updates the account balance without loss.
   - Because `FinanceService.createTransaction` separates reading an account and writing its balance across an `await` tick, concurrent transactions execute on stale snapshots, causing lost updates (e.g. 19 out of 20 updates lost in our stress test).
   - In a production bar catering environment where multiple transactions can be posted rapidly via Telegram webhook or web simulator, this leads directly to financial ledger discrepancy.

2. **Semantic Accuracy of the Core Telegram Killer-Feature (Observation 1.2, Defect 2 & Defect 3)**:
   - The user prompt states: *"Ключевая киллер-фича системы — полноценная интеграция с Telegram для ввода прямо из чата! ... Система парсит это сообщение и автоматически добавляет операцию в кэш-флоу в нужное мероприятие с правильным счётом... и категорией."*
   - Because `ParserService` uses dictionary forms (`'предоплата'`, `'доплата'`) instead of word stems (`'предоплат'`, `'доплат'`), natural Russian phrases such as `"50000 предоплату Свадьба"` or `"20000 доплату"` flip the transaction type from INCOME to EXPENSE.
   - Recording an incoming client payment as an expense inverts cash flow calculations and devastates event profitability metrics.
   - Furthermore, hardcoding event IDs with underscores (`'event_wedding'`) while storage and seed use hyphens (`'event-wedding'`) causes Telegram-created transactions to vanish from `/api/transactions?eventId=event-wedding` filters and breaks Supabase relational integrity.

3. **Input Ambiguity and Number Extraction (Observation 1.2, Defect 4, 5, 6)**:
   - When quantity or numbering precedes the amount (`"Свадьба 2 50000"`), greedy digit grouping miscalculates 50,000 ₽ as 2,500 ₽.
   - Short substring matching (`'вин'`, `'сок'`, `'бар'`) without word-boundary checks causes false positive categorization on everyday words (`'половина'`, `'высокий'`, `'барбекю'`).

4. **Conclusion**:
   - Although the architecture, mock bot, and basic happy-path cases are well-structured, Defect 1 (concurrency race condition), Defect 2 (income inverted to expense on natural declensions), and Defect 3 (event ID mismatch breaking transaction filtering) prevent safe deployment for real catering operations.

---

## 3. Caveats

1. **Sequential Telegram Usage**:
   - If operations are submitted strictly sequentially with at least 50ms interval between calls, the race condition in Defect 1 does not manifest.
2. **Standard Nominative Casing**:
   - If users write strictly nominative Russian (`"предоплата"`, `"доплата"`), Defect 2 does not manifest. It manifests only on inflections (`"предоплату"`, `"предоплаты"`, `"доплату"`).
3. **Mock Mode Execution**:
   - All tests were conducted against `InMemoryStore` and `JsonFileStore` in mock bot mode without an active Telegram Bot API token.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

Milestone M2 is fundamentally well-engineered, fast, and passes 371 existing tests. However, before proceeding to Milestone M3, the worker must address the following required fixes:

### Required Action Items for Worker:

1. **Fix Concurrency / Race Condition in `FinanceService`**:
   - Implement an async queue or per-account mutex lock in `FinanceService.createTransaction` (or atomic balance increment in storage) so that concurrent transactions on the same account do not overwrite each other's balances.
2. **Fix Cyrillic Declensions in `ParserService` (Income Type Detection)**:
   - In `src/server/services/ParserService.ts:61-69`, change:
     ```typescript
     lower.includes('предоплат') || // covers предоплата, предоплату, предоплаты
     lower.includes('доплат') ||    // covers доплата, доплату, доплаты
     lower.includes('аванс') ||
     lower.includes('приход') ||
     lower.includes('доход') ||
     lower.includes('чаев') ||      // covers чаевые, чаевых
     lower.includes('чай') ||
     lower.includes('получено') ||
     lower.includes('+')
     ```
3. **Harmonize Event IDs Across Parser and Constants**:
   - In `src/server/services/ParserService.ts:159,169`, use `EVENT_IDS.WEDDING` (`'event-wedding'`) and `EVENT_IDS.CORPORATE` (`'event-corporate'`) instead of underscore literals. Ensure `/api/transactions?eventId=event-wedding` correctly returns Telegram-logged transactions.
4. **Fix `accountName` Synchronization on Default Override**:
   - In `src/server/services/ParserService.ts:174-175`, lookup the `accountName` corresponding to `options?.defaultAccountId` rather than hardcoding `'Нал 1'`.
5. **Improve Substring Boundary Matching (Word Boundaries)**:
   - Avoid naked 3-letter substrings (`'вин'`, `'сок'`) matching inside unrelated words (`'половина'`, `'высокий'`) by using regex word boundaries `\b` or Cyrillic token splitting (`lower.split(/\s+/)`).

---

## 5. Verification Method

To independently reproduce and verify all findings:

1. **Run the M2 Empirical Stress Test Harness**:
   ```powershell
   npx.cmd vitest run tests/unit/m2_parser_telegram_stress.test.ts
   ```
   *Expected output*: 55 tests pass, documenting and empirically verifying all 13 challenge dimensions.

2. **Verify Full Test Suite & Zero Type Errors**:
   ```powershell
   npm.cmd test
   npm.cmd run typecheck
   ```
   *Expected output*: 16 test files pass, 371 tests pass, 0 type errors.

3. **Inspect Defect 1 (Concurrency Race Condition)**:
   - Review `tests/unit/m2_parser_telegram_stress.test.ts` lines 685–715 (Challenge 13).
   - Notice that 20 parallel transactions of 100 ₽ yield balance `6200` instead of `4300`.

4. **Inspect Defect 2 (Declension Bug Inverting Income to Expense)**:
   - Review `tests/unit/m2_parser_telegram_stress.test.ts` lines 640–665 (Challenge 12).
   - Observe `parser.parse('50000 предоплату Свадьба')` yielding `type: 'expense'`.

5. **Inspect Defect 3 (Event ID Filtering Divergence)**:
   - Review `tests/unit/m2_parser_telegram_stress.test.ts` lines 580–615 (Challenge 10).
   - Observe that transactions saved with `'event_wedding'` are omitted when filtering with canonical `'event-wedding'`.
