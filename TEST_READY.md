# Test Suite Readiness Certificate (TEST_READY.md)

**Project:** Truespace — Financial Accounting for Bar Catering & Event Business  
**Author:** teamwork_preview_test_writer_mtest_1 (E2E Testing Track Lead)  
**Date:** 2026-09-17  
**Status:** READY  
**Test Runner:** Vitest (`npx vitest run tests/e2e` / `npm test`)  
**Suite Architecture:** Opaque-Box Requirement-Driven E2E Suite (Tiers 1–4)

---

## 1. Test Execution Command

```bash
# Run the complete test suite
npm test

# Alternatively, run tests using Vitest directly:
npx vitest run tests/e2e

# Windows PowerShell specific (if execution policy applies):
npx.cmd vitest run tests/e2e

# Run with verbose reporting:
npx.cmd vitest run tests/e2e --reporter=verbose
```

---

## 2. Test Suite Tier Summary & Test Counts

| Tier | Focus | Test Files | Total Test Cases | Status |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage (F01–F26) | `tier1_features_f01_f05.test.ts`<br>`tier1_features_f06_f09.test.ts`<br>`tier1_features_f10_f14.test.ts`<br>`tier1_features_f15_f18.test.ts`<br>`tier1_features_f19_f21.test.ts`<br>`tier1_features_f22_f26.test.ts` | **130** (>=5 per feature) | **READY** |
| **Tier 2** | Boundary & Corner Cases | `tier2_boundary_corner_cases.test.ts` | **30** (>=5 per edge category) | **READY** |
| **Tier 3** | Cross-Feature Combinations | `tier3_cross_feature_combinations.test.ts` | **25** (5 multi-step workflows) | **READY** |
| **Tier 4** | Real-World Workload Lifecycles | `tier4_real_world_workloads.test.ts` | **15** (3 end-to-end scenarios) | **READY** |
| **TOTAL** | **Full Opaque-Box E2E Suite** | **9 Test Files + 3 Helpers** | **200 Test Cases** | **READY** |

---

## 3. Feature Inventory Coverage Checklist (F01–F26)

Every feature in the `PROJECT.md` Feature Inventory is validated by at least 5 independent, authoritative test cases:

- [x] **F01: 5-Account Balance Tracking** (5 tests in `tier1_features_f01_f05.test.ts`)
  - F01-1: All 5 accounts returned (`cash_1`, `cash_2`, `bank_1`, `bank_2`, `card_sbp`).
  - F01-2: Distinct account types verified (`cash`, `bank`, `card_transfer`).
  - F01-3: Currency strictly `RUB`, valid ISO `updatedAt` timestamps.
  - F01-4: Independent balance tracking without cross-account contamination.
  - F01-5: Domain-accurate descriptions present for bar catering pockets.

- [x] **F02: Expense Logging** (5 tests in `tier1_features_f01_f05.test.ts`)
  - F02-1: Balance debited by exact expense amount.
  - F02-2: Event attribution (`event_wedding`).
  - F02-3: General bar expenses (`eventId: null`).
  - F02-4: Rejection of expense missing source account.
  - F02-5: Support for Russian text and special characters in descriptions.

- [x] **F03: Income Logging** (5 tests in `tier1_features_f01_f05.test.ts`)
  - F03-1: Target account balance credited by exact income amount.
  - F03-2: Income event attribution (`event_corporate`).
  - F03-3: QR-code tips to personal card (`card_sbp`).
  - F03-4: Rejection of income missing target account.
  - F03-5: Cumulative balance accuracy over sequential incomes.

- [x] **F04: Inter-Account Transfer** (5 tests in `tier1_features_f01_f05.test.ts`)
  - F04-1: Exact debit on source and credit on destination.
  - F04-2: Law of Capital Conservation: total liquidity remains constant.
  - F04-3: Strict rejection of self-transfer (`source === target`).
  - F04-4: SBP transfer collection to main checking account.
  - F04-5: Transfers do not alter event P&L / margins.

- [x] **F05: Total Liquidity Aggregation** (5 tests in `tier1_features_f01_f05.test.ts`)
  - F05-1: Total balance matches sum of accounts.
  - F05-2: Total balance increases upon income.
  - F05-3: Total balance decreases upon expense.
  - F05-4: Capital conservation holds across complex batches.
  - F05-5: Zero IEEE-754 floating-point rounding errors.

- [x] **F06: 3-Step 5-Second Mobile Modal** (5 tests in `tier1_features_f06_f09.test.ts`)
  - F06-1: Rapid 3-step payload processing (Type -> Amount -> Account/Category).
  - F06-2: Clean normalization of string amounts with spaces/commas.
  - F06-3: Default category and ISO timestamp assignment.
  - F06-4: Atomic response payload with transaction and updated accounts.
  - F06-5: Sub-second execution conforming to 5-second mobile rule.

- [x] **F07: Quick Category Selectors** (5 tests in `tier1_features_f06_f09.test.ts`)
  - F07-1: All catering domain categories available.
  - F07-2: Separation of expense vs income categories.
  - F07-3: Hex color tokens for UI chip rendering.
  - F07-4: Transaction linkage to category ID.
  - F07-5: Event-specific vs general bar category classification.

- [x] **F08: Quick Account Chips** (5 tests in `tier1_features_f06_f09.test.ts`)
  - F08-1: Fast source account switching across all 5 accounts.
  - F08-2: Fast target account switching for incoming funds.
  - F08-3: Live balance update on chips immediately reflects mutations.
  - F08-4: Graceful rejection of invalid account chip ID.
  - F08-5: Standard canonical display ordering (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы).

- [x] **F09: General Bar Expenses Toggle** (5 tests in `tier1_features_f06_f09.test.ts`)
  - F09-1: Explicit setting of `eventId: null`.
  - F09-2: Zero inflation of specific event direct expenses.
  - F09-3: Correct increment of overview `generalExpensesTotal`.
  - F09-4: Isolation in journal query via `eventId: null`.
  - F09-5: Proper debiting of the selected account.

- [x] **F10: Event Margin Dashboard** (5 tests in `tier1_features_f10_f14.test.ts`)
  - F10-1: Margin metrics retrieved for all active events.
  - F10-2: Revenue = Sum(event income).
  - F10-3: Direct Expenses = Sum(event expense).
  - F10-4: Net Profit = Revenue - Direct Expenses.
  - F10-5: Margin % = (Net Profit / Revenue) * 100.

- [x] **F11: Expense Category Breakdown** (5 tests in `tier1_features_f10_f14.test.ts`)
  - F11-1: `expensesByCategory` returned per event.
  - F11-2: Sum of category amounts matches direct expenses.
  - F11-3: Sum of category percentages equals 100.0%.
  - F11-4: Alcohol identified as largest cost driver in wedding catering.
  - F11-5: Dynamic re-calculation upon adding new expense.

- [x] **F12: General Bar Expenses Summary** (5 tests in `tier1_features_f10_f14.test.ts`)
  - F12-1: Accurate `generalExpensesTotal` reported in overview.
  - F12-2: Overhead expense increases total.
  - F12-3: Overhead expense deletion decreases total.
  - F12-4: Event expense does not affect general overhead total.
  - F12-5: Active events count reported.

- [x] **F13: Filterable Transaction Journal** (5 tests in `tier1_features_f10_f14.test.ts`)
  - F13-1: Query all active transactions.
  - F13-2: Filter by `accountId`.
  - F13-3: Filter by `eventId`.
  - F13-4: Filter by `type` (expense / income / transfer).
  - F13-5: Multi-parameter filter combinations.

- [x] **F14: Transaction Reversal & Deletion** (5 tests in `tier1_features_f10_f14.test.ts`)
  - F14-1: Expense deletion refunds source account.
  - F14-2: Income deletion debits target account.
  - F14-3: Transfer deletion restores both accounts.
  - F14-4: Deleting event expense recalculates profit and margin %.
  - F14-5: Graceful error on deleting already deleted transaction.

- [x] **F15: Repository Pattern Abstraction** (5 tests in `tier1_features_f15_f18.test.ts`)
  - F15-1: Standard asynchronous CRUD signatures.
  - F15-2: Strongly typed DTO/Entity returns without leaking raw SQL.
  - F15-3: Encapsulated transaction creation.
  - F15-4: Multi-account atomic transfer orchestration.
  - F15-5: Repository query filtering support.

- [x] **F16: Local JSON & InMemory Storage** (5 tests in `tier1_features_f15_f18.test.ts`)
  - F16-1: Autonomous zero-dependency boot.
  - F16-2: Session in-memory state persistence.
  - F16-3: Pristine state restoration upon reset.
  - F16-4: Concurrency and race-condition safety.
  - F16-5: Isolated client instance states.

- [x] **F17: Supabase-Ready Schema** (5 tests in `tier1_features_f15_f18.test.ts`)
  - F17-1: Conformance to PostgreSQL `accounts` table definition.
  - F17-2: Conformance to PostgreSQL `events` table definition.
  - F17-3: Conformance to PostgreSQL `categories` table definition.
  - F17-4: Conformance to PostgreSQL `transactions` table definition.
  - F17-5: Foreign key integrity satisfaction across entities.

- [x] **F18: Seed Demo Data Generator** (5 tests in `tier1_features_f15_f18.test.ts`)
  - F18-1: Exactly 5 accounts seeded.
  - F18-2: 2 real catering cases seeded (Wedding & Corporate).
  - F18-3: Standard categories seeded.
  - F18-4: Reset idempotency verified.
  - F18-5: Realistic starting capital established.

- [x] **F19: Financial Math Test Suite** (5 tests in `tier1_features_f19_f21.test.ts`)
  - F19-1: 2-decimal kopeck precision rounding.
  - F19-2: Account balance summation invariant.
  - F19-3: Transfer zero-sum game proof.
  - F19-4: Reversible transaction idempotency invariant.
  - F19-5: Capital conservation formula.

- [x] **F20: Russian Locale & Design System** (5 tests in `tier1_features_f19_f21.test.ts`)
  - F20-1: Currency formatted as `150 000 ₽`.
  - F20-2: Negative amounts formatted with minus sign `-4 500 ₽`.
  - F20-3: Dates formatted as `ДД.ММ.ГГГГ` (`20.09.2026`).
  - F20-4: 24-hour time format `ЧЧ:ММ` (`18:30`).
  - F20-5: Entity labels in Russian: Расход, Доход, Перевод.

- [x] **F21: Dev Runner & Build Pipeline** (5 tests in `tier1_features_f19_f21.test.ts`)
  - F21-1: Ports 3001 and 5173 defined.
  - F21-2: `/api` prefix routing contract.
  - F21-3: `lang="ru"` HTML root attribute.
  - F21-4: Vitest runner configuration.
  - F21-5: `--host` LAN preview flag support.

- [x] **F22: Opaque-Box E2E Test Suite** (5 tests in `tier1_features_f22_f26.test.ts`)
  - F22-1: Pure public interface testing.
  - F22-2: Deterministic repeatability.
  - F22-3: Self-contained test isolation.
  - F22-4: Requirements-derived expected outputs.
  - F22-5: Sub-second response times.

- [x] **F23: Adversarial Coverage Hardening** (5 tests in `tier1_features_f22_f26.test.ts`)
  - F23-1: Extreme length description inputs (4000 chars).
  - F23-2: Unicode emoji preservation (🍸, 🧊, 🍋).
  - F23-3: SQL/XSS injection resilience.
  - F23-4: Sub-ruble minimum boundary amounts (0.01 ₽).
  - F23-5: Multi-million ruble amounts (15 000 000 ₽).

- [x] **F24: Fast Command & NLP Parser** (5 tests in `tier1_features_f22_f26.test.ts`)
  - F24-1: "3500 лед Корпоратив Т-Банк" parsed into amount, expense, ice, corporate, card.
  - F24-2: "50000 предоплата Свадьба" parsed as income, wedding.
  - F24-3: "-1500 такси нал1" parsed as expense, logistics, cash_1.
  - F24-4: "12000 алкоголь джин нал2" parsed into cash_2.
  - F24-5: Fallback to `eventId: null` when no event specified.

- [x] **F25: Telegram Bot Integration** (5 tests in `tier1_features_f22_f26.test.ts`)
  - F25-1: Bot status reports active mode.
  - F25-2: Bot username reports `@TruespaceBarBot`.
  - F25-3: Execution of command directly creates transaction.
  - F25-4: Decrement of account balance upon Telegram expense.
  - F25-5: Event margin update from Telegram expense.

- [x] **F26: Web Fast Simulator & Bot Status** (5 tests in `tier1_features_f22_f26.test.ts`)
  - F26-1: Non-mutating preview via `/api/telegram/parse`.
  - F26-2: High confidence score (>=0.8) for recognized commands.
  - F26-3: Command execution on user confirmation.
  - F26-4: Rejection of empty string with clear message.
  - F26-5: Rejection of command without amount.

---

## 4. Tier 2 Edge Cases & Boundary Conditions (30 tests)

- [x] **Zero Revenue Division:** 0 revenue / 0 expense; 0 revenue / prep expense; prep to post-payment transition; category breakdown with 0 revenue; display protection against `NaN`/`Infinity`.
- [x] **Negative Account Balances:** Emergency cash overdraft; replenishment recovery; negative balance inclusion in total capital; Russian currency negative formatting; sequential negative accrual.
- [x] **Self-Transfer Rejection:** Same account ID rejection; identical bank accounts rejection; missing target account rejection; missing source account rejection; invariant balance retention.
- [x] **Invalid Amounts & Extreme Values:** Zero amount rejected; negative amount rejected; NaN rejected; 3-decimal rounding normalization; 100M ₽ extreme value support.
- [x] **Rapid Double Submit & Concurrency:** Concurrent submits handled cleanly; distinct transaction IDs; batch of 5 concurrent operations; double delete balance restoration; chronological ordering preservation.
- [x] **NLP Parsing Ambiguities:** Punctuation delimiters; uppercase commands; spaced thousands; bar colloquialisms ("бухло", "джин"); SBP bank mentions ("тинькофф", "т-банк").

---

## 5. Tier 3 Cross-Feature Combinations (25 tests)

- [x] **Workflow 1:** Transfer -> Expense pipeline: balance reconciliation across accounts, margin deduction, journal categorization, capital conservation, selective expense reversal.
- [x] **Workflow 2:** Erroneous expense creation -> margin drop -> transaction deletion -> 100% margin and balance restoration, journal cleanup, category percentage reset.
- [x] **Workflow 3:** Telegram NLP fast command -> auto-logging -> event attribution -> balance debit -> journal audit trail.
- [x] **Workflow 4:** General expenses vs event margin isolation: overhead decreases capital without touching event margin; overview tracking; general-only journal filter; overhead deletion.
- [x] **Workflow 5:** Complex 8-operation multi-account batch -> `/api/system/reset-demo` -> pristine canonical state restoration, transaction count restoration, canary cleanup.

---

## 6. Tier 4 Real-World Workloads (15 tests)

- [x] **Scenario 1: Wedding Catering Lifecycle («Свадьба Анны и Дмитрия»):** Prepayment booking (250k) -> wholesale alcohol (110k) and glass rental (18k) -> on-site ice (12k) and logistics (10k) -> bartenders payout (45k) and cash final settlement (50k) -> Final P&L: 300k revenue, 195k expenses, 105k profit, 35.0% margin.
- [x] **Scenario 2: Corporate Event Lifecycle («Корпоратив IT-компании TechCorp»):** PO advance (420k) -> premium spirits (160k) and bar counter rental (20k) -> dry ice on site (25k) -> team wages (60k) and SBP QR tips (15k) -> Final P&L: 435k revenue, 265k expenses, 170k profit, 39.08% margin.
- [x] **Scenario 3: Emergency On-Site Supplies Purchase:** Ice depletion at 22:30 -> emergency order 5,500 ₽ exceeding floor cash -> temporary negative balance (-3,500 ₽) -> manager SBP transfer (10,000 ₽) restoring account to +6,500 ₽ -> full audit journal log -> supplier refund capability.

---

## 7. Ready for Verification

The E2E test suite is fully implemented, self-contained, documented, and ready for continuous execution during Milestone M1–M5 development and final acceptance.
