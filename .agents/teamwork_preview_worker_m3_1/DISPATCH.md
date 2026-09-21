## 2026-09-17T02:46:20Z

You are Worker M3 (teamwork_preview_worker_m3_1) for Milestone M3 of the bar catering financial accounting system.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/ORIGINAL_REQUEST.md

Also read the Explorer blueprints:
- Explorer 1 (UI & Components): c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m3_1/analysis.md and handoff.md
- Explorer 2 (Data Hooks & API): c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m3_2/analysis.md and handoff.md
- Explorer 3 (Fast Command Simulator & Telegram): c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m3_3/analysis.md and handoff.md
- Design system: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/docs/core/DESIGN_SYSTEM.md
- Russian quality guidelines: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/AGENTS.md
- Project blueprint: c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/PROJECT.md

Your working directory is:
c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_worker_m3_1

EXCLUSIVELY OWNED FILES (You have full write ownership):
- src/client/main.tsx
- src/client/App.tsx
- src/client/styles/globals.css
- src/client/utils/formatters.ts
- src/client/api/apiClient.ts
- src/client/api/errors.ts
- src/client/context/FinanceContext.tsx
- src/client/hooks/useAccounts.ts
- src/client/hooks/useTransactions.ts
- src/client/hooks/useCategories.ts
- src/client/hooks/useEvents.ts
- src/client/hooks/useTelegram.ts
- src/client/hooks/useResetDemo.ts
- src/client/components/entry/QuickEntryModal.tsx
- src/client/components/entry/NumericPad.tsx
- src/client/components/entry/CategoryChips.tsx
- src/client/components/entry/AccountChips.tsx
- src/client/components/entry/EventSelector.tsx
- src/client/components/accounts/AccountsGrid.tsx
- src/client/components/accounts/AccountCard.tsx
- src/client/components/accounts/TotalCapitalBanner.tsx
- src/client/components/telegram/FastCommandSimulator.tsx
- src/client/components/telegram/CommandChips.tsx
- src/client/components/telegram/ParsedPreviewCard.tsx
- src/client/components/telegram/TelegramBotStatus.tsx
- src/client/components/common/Header.tsx
- src/client/components/common/Toast.tsx
- src/client/components/common/Badge.tsx
- tests/unit/client_formatters.test.ts (or other client unit tests)

REQUIREMENTS TO IMPLEMENT:
1. Entry Modal (`src/client/components/entry/`):
   - 3-step mobile entry UX: Type (Расход / Доход / Перевод) -> Amount (large number display + numeric pad with quick presets +500, +1000, +5000) -> Account & Category chips (Лёд/продукты, Алкоголь, Персонал, Логистика, Доплата, Чаевые).
   - Event selector with "Общие расходы бара" toggle when not tied to a specific event.
   - Internal transfer between 2 accounts preventing identical source/target account.
   - Optimistic balance update and fast feedback.
2. 5 Accounts overview (`src/client/components/accounts/`):
   - 5 account cards (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы / СБП) showing live balance, type badge, liquidity percentage, Lucide icon.
   - Total capital banner aggregating overall liquidity in rubles (₽).
3. Telegram in-browser simulator & Bot status (`src/client/components/telegram/`):
   - Input field with instant debounced preview via `POST /api/telegram/parse`.
   - Real-time parsed badge preview (amount, type, category, account, event, confidence).
   - Instant execution button via `POST /api/telegram/execute` updating accounts and ledger.
   - Preset catering scenario chips ("3500 лед Корпоратив Т-Банк", "50000 предоплата Свадьба", "-1500 такси нал1").
   - Telegram Bot status badge (`GET /api/telegram/status`) showing mode ('mock' or 'polling') and bot username @TruespaceBarBot.
4. Styling & Locale:
   - Modern pure CSS tokens matching `DESIGN_SYSTEM.md` (milky gray `#f1f1ec`, frosted glass surfaces, soft shadows).
   - Full Russian localization (rubles `₽`, `ДД.ММ.ГГГГ`, 24h format).
   - Responsive layout from 375px mobile to 1440px desktop.

VERIFICATION COMMANDS TO RUN:
- npm.cmd run typecheck
- npm.cmd run build:client
- npm.cmd test
All must pass with 0 errors!
