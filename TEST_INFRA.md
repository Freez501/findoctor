# Test Infrastructure Specification (TEST_INFRA.md)

**Project:** Truespace — Financial Accounting for Bar Catering & Event Business  
**Author:** teamwork_preview_test_writer_mtest_1 (E2E Testing Track)  
**Status:** Active  
**Test Framework:** Vitest (with TypeScript)  
**Execution Scope:** Opaque-Box Requirement-Driven E2E Suite (Tiers 1–4)

---

## 1. Overview & Strategy

The E2E test infrastructure implements an **Opaque-Box Requirement-Driven** test suite. The suite validates system behavior exclusively against documented requirements from `ORIGINAL_REQUEST.md`, `PROJECT.md`, `AGENTS.md`, and `docs/core/DESIGN_SYSTEM.md`.

### Core Testing Principles:
1. **Opaque-Box Testing:** Tests interact strictly through external contracts (REST API endpoints `/api/*`, domain DTOs, and interface contracts specified in `PROJECT.md`), without depending on internal implementation details.
2. **Deterministic Independence:** Each test sets up its own isolated state via `POST /api/system/reset-demo` or isolated store instances, guaranteeing tests can be run in any order or in parallel.
3. **Strict Financial Invariants:** Assertions enforce double-entry conservation of capital, atomic transfers, reversible transaction logs, and safe division-by-zero handling.
4. **Progressive Testability:** Tests are designed to exercise the contract interfaces. An integrated lightweight test adapter allows tests to execute and verify contract compliance at all stages of development.
5. **No Facades:** Every test performs genuine assertions on data structures, calculations, status codes, and invariant preservation.

---

## 2. Test Suite Architecture (Tiers 1–4)

The test suite is organized into 4 hierarchical tiers in `tests/e2e/`:

```
tests/e2e/
├── helpers/
│   ├── test-client.ts           # Unified test client abstraction (HTTP API / Contract Engine)
│   ├── financial-invariants.ts  # Verification helpers for math and liquidity laws
│   └── fixtures.ts              # Canonical fixtures for accounts, events, and categories
├── tier1_features_f01_f05.test.ts # F01–F05: 5-Account tracking, Expense, Income, Transfer, Total Liquidity (>=5 tests/feature)
├── tier1_features_f06_f09.test.ts # F06–F09: 3-step 5-sec input, Category selectors, Account chips, General expenses toggle (>=5 tests/feature)
├── tier1_features_f10_f14.test.ts # F10–F14: Event margin, Category breakdown, General summary, Journal, Reversals (>=5 tests/feature)
├── tier1_features_f15_f18.test.ts # F15–F18: Repository pattern, Local/InMemory store, Supabase DDL, Demo seed (>=5 tests/feature)
├── tier1_features_f19_f21.test.ts # F19–F21: Financial math formulas, Russian locale & design tokens, Build pipeline (>=5 tests/feature)
├── tier1_features_f22_f26.test.ts # F22–F26: E2E suite contracts, Hardening readiness, NLP parser, Telegram bot, Web simulator (>=5 tests/feature)
├── tier2_boundary_corner_cases.test.ts # Edge cases: zero revenue margin, negative balance, self-transfer, invalid amounts, rapid submits, NLP ambiguities (>=5 tests/category)
├── tier3_cross_feature_combinations.test.ts # Pairwise interactions: transfer -> expense, expense deletion -> margin recalc, NLP fast command -> event attribution -> balance recalc
└── tier4_real_world_workloads.test.ts # Comprehensive real-world catering lifecycles (Wedding, Corporate event, Emergency on-site supplies)
```

---

## 3. Feature Coverage Matrix (Tier 1: F01–F26)

Every feature in `PROJECT.md` Feature Inventory has at least 5 independent, targeted E2E test cases:

| Feature ID | Feature Name | Test File | Minimum Tests |
|---|---|---|---|
| **F01** | 5-Account Balance Tracking | `tier1_features_f01_f05.test.ts` | 5 |
| **F02** | Expense Logging | `tier1_features_f01_f05.test.ts` | 5 |
| **F03** | Income Logging | `tier1_features_f01_f05.test.ts` | 5 |
| **F04** | Inter-Account Transfer | `tier1_features_f01_f05.test.ts` | 5 |
| **F05** | Total Liquidity Aggregation | `tier1_features_f01_f05.test.ts` | 5 |
| **F06** | 3-Step 5-Second Mobile Modal | `tier1_features_f06_f09.test.ts` | 5 |
| **F07** | Quick Category Selectors | `tier1_features_f06_f09.test.ts` | 5 |
| **F08** | Quick Account Chips | `tier1_features_f06_f09.test.ts` | 5 |
| **F09** | General Bar Expenses Toggle | `tier1_features_f06_f09.test.ts` | 5 |
| **F10** | Event Margin Dashboard | `tier1_features_f10_f14.test.ts` | 5 |
| **F11** | Expense Category Breakdown | `tier1_features_f10_f14.test.ts` | 5 |
| **F12** | General Bar Expenses Summary | `tier1_features_f10_f14.test.ts` | 5 |
| **F13** | Filterable Transaction Journal | `tier1_features_f10_f14.test.ts` | 5 |
| **F14** | Transaction Reversal & Deletion | `tier1_features_f10_f14.test.ts` | 5 |
| **F15** | Repository Pattern Abstraction | `tier1_features_f15_f18.test.ts` | 5 |
| **F16** | Local JSON & InMemory Storage | `tier1_features_f15_f18.test.ts` | 5 |
| **F17** | Supabase-Ready Schema | `tier1_features_f15_f18.test.ts` | 5 |
| **F18** | Seed Demo Data Generator | `tier1_features_f15_f18.test.ts` | 5 |
| **F19** | Financial Math Test Suite | `tier1_features_f19_f21.test.ts` | 5 |
| **F20** | Russian Locale & Design System | `tier1_features_f19_f21.test.ts` | 5 |
| **F21** | Dev Runner & Build Pipeline | `tier1_features_f19_f21.test.ts` | 5 |
| **F22** | Opaque-Box E2E Test Suite | `tier1_features_f22_f26.test.ts` | 5 |
| **F23** | Adversarial Coverage Hardening | `tier1_features_f22_f26.test.ts` | 5 |
| **F24** | Fast Command & NLP Parser | `tier1_features_f22_f26.test.ts` | 5 |
| **F25** | Telegram Bot Integration | `tier1_features_f22_f26.test.ts` | 5 |
| **F26** | Web Fast Simulator & Bot Status | `tier1_features_f22_f26.test.ts` | 5 |

*Total Tier 1 Target:* >= 130 tests.

---

## 4. Tier 2: Boundary & Corner Cases

Target: >=5 test cases per edge category in `tier2_boundary_corner_cases.test.ts`:
1. **Zero Revenue Division:** Margin % calculation when revenue is 0 with positive expenses, ensuring no `NaN` or `Infinity`.
2. **Negative Account Balances:** Handling on-site cash overdrafts (`Нал 1 < 0`) with warning status and balance tracking integrity.
3. **Self-Transfer Rejection:** Immediate validation error when `fromAccountId === toAccountId`.
4. **Invalid Amounts & Extreme Values:** Rejection of negative amounts, zero amounts, non-numeric values, fractional kopecks rounding, and extreme values (e.g. 100,000,000 ₽).
5. **Rapid Double Submit:** Idempotency and double-submission protection in quick entry workflows.
6. **NLP / Fast Command Ambiguities:** Partial text, missing parameters, ambiguous account or category names, and negative amount prefixes (`-1500 такси нал1`).

---

## 5. Tier 3: Cross-Feature Combinations

Validates end-to-end multi-step pipelines in `tier3_cross_feature_combinations.test.ts`:
1. **Transfer followed by Expense:** Inter-account transfer replenishes `Нал 1`, followed immediately by an event expense from `Нал 1`, verifying balances across both accounts and event margin.
2. **Expense Deletion Updating Event Margin:** Adding an expense, verifying degraded margin, deleting the expense, and verifying complete restoration of account balance and event profit.
3. **Fast Command NLP Logging -> Event Margin -> Journal Audit:** Parsing a Russian quick command ("4500 лед Свадьба нал1"), executing it, verifying direct expense attribution to the wedding, and verifying the record in the transaction journal.
4. **General Expense vs Event Expense Separation:** Verifying that "Общие расходы бара" decrease total business capital without corrupting specific event margin metrics.
5. **Full Seed Reset with Active State Invalidation:** Executing complex transactions, triggering `/api/system/reset-demo`, and verifying clean restoration to standard demo state.

---

## 6. Tier 4: Real-World Workload Application Scenarios

Full lifecycle simulations in `tier4_real_world_workloads.test.ts`:
1. **Scenario 1: Full Wedding Catering Lifecycle («Свадьба Анны и Дмитрия»)**
   - Prepayment contract deposit via `Безнал 1`
   - Wholesale alcohol purchase from `Безнал 1`
   - Cash withdrawal / transfer to `Нал 2` for bartender wages
   - On-site ice & fresh mint purchases via `Нал 1`
   - Final cash payment upon completion via `Нал 2`
   - Final margin verification (~35.0%)
2. **Scenario 2: Corporate Event Lifecycle («Корпоратив IT-компании TechCorp»)**
   - Contract advance on `Безнал 1`
   - Premium alcohol and bar counter rental logistics on `Безнал 1` & `Переводы`
   - Mobile terminal cocktail sales on `Безнал 2`
   - Bartenders payout and QR-code tips on `Переводы`
   - Audit journal inspection and profit verification (~39.1%)
3. **Scenario 3: Emergency On-Site Supplies Purchase**
   - Bar runs out of ice during peak service
   - Fast Telegram/simulator command entry: `3500 лед нал1`
   - Register temporarily drops, manager transfers funds from `Переводы` to `Нал 1`
   - Final accounts reconciliate to the kopeck

---

## 7. How to Run the Tests

```bash
# Run the complete test suite
npm test

# Run only E2E tests
npx vitest run tests/e2e

# Run tests with verbose output
npx vitest run tests/e2e --reporter=verbose

# Run a specific tier
npx vitest run tests/e2e/tier1_features_f01_f05.test.ts
npx vitest run tests/e2e/tier2_boundary_corner_cases.test.ts
npx vitest run tests/e2e/tier3_cross_feature_combinations.test.ts
npx vitest run tests/e2e/tier4_real_world_workloads.test.ts
```

---

## 8. Defect Escalation Protocol

As the QA Test Writer, only test code and test documentation are authored by this track. When an implementation bug or contract violation is detected during execution:
1. The failing test case is preserved with exact assertions matching `ORIGINAL_REQUEST.md`.
2. A defect ticket is documented in the handoff report and escalated to the relevant implementing agent (`M1`, `M2`, `M3`, or `M4`).
3. Under no circumstances should test assertions be relaxed or faked to force a green pass.
