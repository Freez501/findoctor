# BRIEFING — 2026-09-17T01:28:00+03:00

## Mission
Remediate Milestone M2 findings: Concurrency race hazard in FinanceService, Cyrillic declensions & word boundaries & canonical event IDs in ParserService, accountName sync, input validation, and verify all tests pass.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_worker_m2_2
- Original parent: 87f3b631-bafe-40ae-bd4a-ff896ab52fdb
- Milestone: Milestone M2 Remediation

## 🔒 Key Constraints
- Exclusive write ownership:
  - `src/server/services/FinanceService.ts`
  - `src/server/services/AnalyticsService.ts`
  - `src/server/services/ParserService.ts`
  - `src/server/telegram/TelegramBotService.ts`
  - `src/server/routes/`
  - `tests/unit/`
  - `.agents/teamwork_preview_worker_m2_2/`
- DO NOT CHEAT: No hardcoded test results, genuine implementations only.
- Strict accounting integrity: No lost updates, 100% kopeck precision.

## Current Parent
- Conversation ID: 87f3b631-bafe-40ae-bd4a-ff896ab52fdb
- Updated: not yet

## Task Summary
- **What to build**: Concurrency serialization in `FinanceService`, declension fixes & word boundary checks & event ID harmonization & accountName synchronization in `ParserService`, amount validation hardening.
- **Success criteria**:
  1. Concurrency test in `tests/unit/m2_parser_telegram_stress.test.ts` passes with 0 lost updates under parallel `Promise.all`.
  2. Russian declensions ("50000 предоплату Свадьба", "20000 доплату", etc.) recognized as `income`.
  3. Canonical event IDs (`event-wedding`, `event-corporate`) used and queryable via `/api/transactions?eventId=event-wedding`.
  4. `accountName` correctly synchronized when `defaultAccountId` is passed.
  5. Word boundary protection for short stems (`половина` doesn't match wine, `высокий` doesn't match juice, `барбекю` doesn't route to bar cash).
  6. Reject `Infinity` and sub-kopeck (< 0.01) amounts.
  7. All 371+ tests pass, 0 type errors.
- **Interface contracts**: `PROJECT.md`, `src/shared/`
- **Code layout**: `PROJECT.md § Code Layout`

## Key Decisions Made
- Use an async promise serialization mechanism (queue/mutex per account or mutex on transaction creation/deletion) in `FinanceService` to serialize critical sections affecting account balances.
- Ensure event IDs match `EVENT_IDS` from `src/shared/constants.ts` and storage consistency.

## Artifact Index
- `.agents/teamwork_preview_worker_m2_2/DISPATCH.md` — Dispatch message
- `.agents/teamwork_preview_worker_m2_2/BRIEFING.md` — Situational awareness
- `.agents/teamwork_preview_worker_m2_2/progress.md` — Heartbeat and progress

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: Implement 6 remediation items

## Quality Status
- **Build/test result**: Untested
- **Lint status**: 0
- **Tests added/modified**: TBD

## Loaded Skills
- None
