## 2026-09-17T03:33:28Z

You are Worker M4 (teamwork_preview_worker_m4_1) for Milestone M4 of the bar catering financial accounting system.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/ORIGINAL_REQUEST.md

Your working directory is:
c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_worker_m4_1

Also read:
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/PROJECT.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/AGENTS.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/docs/core/DESIGN_SYSTEM.md
- Existing backend routes in `src/server/routes/analytics.ts` and `src/server/routes/transactions.ts`
- Existing client context in `src/client/context/FinanceContext.tsx`

EXCLUSIVE WRITE OWNERSHIP:
- `src/client/hooks/useAnalytics.ts`
- `src/client/components/analytics/EventMarginSummary.tsx`
- `src/client/components/analytics/CategoryExpenseBreakdown.tsx`
- `src/client/components/analytics/GeneralBarExpensesCard.tsx`
- `src/client/components/analytics/AnalyticsDashboard.tsx`
- `src/client/components/history/TransactionFilterBar.tsx`
- `src/client/components/history/TransactionRow.tsx`
- `src/client/components/history/TransactionHistory.tsx`
- `src/client/App.tsx` (integrate tabs / sections for Dashboard, Analytics, and History)
- `tests/unit/client_analytics.test.ts`

REQUIREMENTS TO IMPLEMENT:
1. Event Margin Analytics (`src/client/components/analytics/`):
   - Hook `useAnalytics.ts`: fetches `/api/analytics/events` (EventMarginMetrics[]) and `/api/analytics/overview`. Re-fetches when transactions change.
   - `EventMarginSummary.tsx`: Card for each catering event displaying:
     * Event title, date (`ДД.ММ.ГГГГ`), status.
     * Revenue in rubles (`₽`).
     * Direct expenses in rubles (`₽`).
     * Net profit in rubles (`₽`).
     * Margin percentage with color badges (green: >= 40%, yellow: 20–39%, red: < 20% or negative loss).
   - `CategoryExpenseBreakdown.tsx`: Direct expenses grouped by category with visual progress bar showing share of event costs.
   - `GeneralBarExpensesCard.tsx`: Overhead expenses card showing total unlinked bar overhead (rent, inventory where `eventId === null`).
   - `AnalyticsDashboard.tsx`: Assembles overview summary metrics, event margin cards, and general bar expenses.
2. Transaction History Journal (`src/client/components/history/`):
   - `TransactionFilterBar.tsx`: Account filter chips, Event filter dropdown, Type tabs (Все, Расход, Доход, Перевод), text search.
   - `TransactionRow.tsx`: Date/time, amount with color (+ green, - red, transfer blue), accounts, category chip, event badge, and soft-delete/cancellation action button.
   - Cancellation action: Calls `deleteTransaction(id)` from `FinanceContext` (which calls `DELETE /api/transactions/:id`), displaying confirmation and toast on success, with instant balance reversal.
   - `TransactionHistory.tsx`: Filtered list of transactions, sorted descending by date, with empty state and loading state.
3. Integrate into `src/client/App.tsx`:
   - Add view navigation (e.g. Navigation bar or tabs: "Счета и ввод", "Маржинальность", "Журнал операций") so the user can easily switch between them on mobile (375px) and desktop (1440px).
4. Unit tests in `tests/unit/client_analytics.test.ts`:
   - Test margin calculations, color threshold classification, and filter predicates.
5. Verification:
   - Run `npm.cmd run typecheck`
   - Run `npm.cmd run build`
   - Run `npm.cmd test`
   All must pass with 0 errors!

Keep each file clean and modular (<= 120 lines).
Write `changes.md` and `handoff.md` in your working directory and notify parent orchestrator via `send_message` to recipient `32e4f242-4967-45e9-bcfa-d272f28c633a`.
