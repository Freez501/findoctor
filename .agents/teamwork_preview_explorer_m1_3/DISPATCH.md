## 2026-09-16T21:57:40Z
You are teamwork_preview_explorer_m1_3.
Your working directory is: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_3
You MUST read:
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/ORIGINAL_REQUEST.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/AGENTS.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/PROJECT.md
- c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_2/handoff.md

Scope: Milestone M1 — Storage Repositories & Seed Generator.
Investigate and design exact specification and blueprint for:
1. `src/server/storage/interfaces.ts`: repository interface `IFinanceStore` defining CRUD for accounts, events, categories, and transactions with soft-delete and atomic balance updates.
2. `src/server/storage/InMemoryStore.ts`: in-memory implementation for deterministic testing.
3. `src/server/storage/JsonFileStore.ts`: local JSON persistence at `data/truespace.json` with directory creation and safe recovery from corrupted state.
4. `src/server/storage/factory.ts`: storage factory selecting provider based on environment.
5. `src/server/data/seed.ts`: pre-seeded demo dataset implementing exactly the 5 accounts, 2 events (Свадьба, Корпоратив), 12 categories, and 21 transactions specified in explorer 2's handoff (total capital 1,166,300 ₽).
6. Unit tests `tests/unit/storage.test.ts` verifying storage CRUD and seed loading.
Write your findings and complete code blueprints to:
`c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_3/handoff.md` and report back.
