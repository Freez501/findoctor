## 2026-09-16T22:08:07Z
You are teamwork_preview_worker_m1_1, implementing Milestone M1 (Foundation, Storage & Seed).
Your working directory is: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_worker_m1_1

You MUST read:
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/ORIGINAL_REQUEST.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/AGENTS.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/PROJECT.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_1/handoff.md (exact blueprints for package.json, tsconfig.json, tsconfig.server.json, vite.config.ts, index.html)
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_2/types_blueprint.ts
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_2/constants_blueprint.ts
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_2/dto_blueprint.ts
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_2/supabase_blueprint.sql
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_1/handoff.md (storage interfaces & JsonFileStore design)
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_2/handoff.md (exact 5 accounts, 12 categories, 2 events, 21 transactions demo seed)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive File Write Ownership:
- `package.json`
- `tsconfig.json`
- `tsconfig.server.json`
- `vite.config.ts`
- `index.html`
- `src/shared/types.ts`
- `src/shared/constants.ts`
- `src/shared/dto.ts`
- `src/server/storage/interfaces.ts`
- `src/server/storage/InMemoryStore.ts`
- `src/server/storage/JsonFileStore.ts`
- `src/server/storage/factory.ts`
- `src/server/data/seed.ts`
- `src/server/data/supabase.sql`
- `tests/unit/storage.test.ts`
- `tests/unit/finance.test.ts`

Tasks:
1. Implement the foundation files (`package.json`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `index.html`) using the blueprints in `teamwork_preview_explorer_m1_1/handoff.md`.
2. Run `npm.cmd install` on Windows to install all dependencies cleanly.
3. Implement `src/shared/types.ts`, `src/shared/constants.ts`, `src/shared/dto.ts`, and `src/server/data/supabase.sql` from `teamwork_preview_explorer_m1_2/`.
4. Implement `src/server/storage/interfaces.ts`, `InMemoryStore.ts`, `JsonFileStore.ts` (persisting to `data/truespace.json` with safe fallback), `factory.ts`, and `src/server/data/seed.ts` (with 5 accounts totaling 840,000 ₽ initial capital, 2 events: Свадьба and Корпоратив, 12 categories, and 21 transactions resulting in exactly 1,166,300 ₽ final capital).
5. Implement unit tests in `tests/unit/storage.test.ts` and `tests/unit/finance.test.ts`.
6. Run `npm.cmd run typecheck`, `npm.cmd test`, and `npx.cmd vitest run tests/e2e`. Verify all tests pass!
7. Document all commands, file changes, and verification output in `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_worker_m1_1/handoff.md` and report back when complete.
