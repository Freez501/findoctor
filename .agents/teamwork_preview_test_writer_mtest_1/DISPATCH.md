## 2026-09-16T21:57:40Z
You are teamwork_preview_test_writer_mtest_1, leading the E2E Testing Track for the project.
Your working directory is: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_test_writer_mtest_1
You MUST read:
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/ORIGINAL_REQUEST.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/AGENTS.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/PROJECT.md

Scope: E2E Testing Track (Opaque-Box Requirement-Driven Suite).
Your mission:
1. Formulate `TEST_INFRA.md` at project root using the standard template in project instructions.
2. Design and implement the complete E2E test suite in `tests/e2e/`:
   - Tier 1: Feature Coverage (>=5 test cases per feature for all features in Feature Inventory F01-F26).
   - Tier 2: Boundary & Corner Cases (>=5 test cases per feature for edge cases: zero revenue margin, negative balance warning, self-transfer rejection, invalid amounts, rapid double submit, NLP parsing ambiguities).
   - Tier 3: Cross-Feature Combinations (pairwise interactions: transfer followed by expense, expense deletion updating event margin, fast command NLP logging with event attribution and balance recalculation).
   - Tier 4: Real-World Workload Application Scenarios (full wedding catering lifecycle, corporate event lifecycle, emergency on-site supplies purchase).
3. The tests must be executable via `npm test` or a dedicated script e.g. `npx vitest run tests/e2e`.
4. When the test suite files are created, publish `TEST_READY.md` at project root summarizing the runner command, tier counts, and feature checklist.
5. Report back with your handoff report in your working directory.
