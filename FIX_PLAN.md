# ПЛАН ИСПРАВЛЕНИЙ — TRUESPACE AUDIT

## 🔴 P0 — КРИТИЧНО (до первых пользователей)

### FIX-01: RLS политики Supabase
**Проблема:** Все таблицы `USING (true)` — открыты для всех.
**Что делать:** В Supabase SQL Editor выполнить политики с проверкой `auth.uid()`.

### FIX-02: RBAC bypass при удалении компании
**Файл:** `src/server/routes/companies.ts` строки 138-140
**Проблема:** `if (callingUserId) { ... } else { isAllowed = true; }`
**Фикс:** Убрать `else` блок, заменить на `return res.status(401).json({ error: 'Unauthorized' })`.

### FIX-03: batch-delete без проверки ролей
**Файл:** `src/server/routes/transactions.ts` строки 114-133
**Фикс:** Добавить проверку роли перед выполнением batch-delete.

### FIX-04: reset-balances без RBAC и без фильтра компании
**Файл:** `src/server/routes/accounts.ts` строки 62-69
**Фикс:** Добавить проверку роли owner/admin + фильтрацию по companyId.

### FIX-05: Cross-tenant перевод (чужие счета)
**Файл:** `src/server/services/FinanceService.ts` метод `executeTransfer`
**Фикс:** После `getAccountById` добавить проверку `if (source.companyId !== params.companyId) throw Error`.

### FIX-06: AnalyticsService игнорирует companyId
**Файл:** `src/server/services/AnalyticsService.ts`
**Фикс:** Передавать `companyId` во все методы `getEvents`, `getAccounts`, `getTransactions`.

### FIX-07: updateTransaction не валидирует отрицательные суммы
**Файл:** `src/server/services/FinanceService.ts` метод `updateTransaction`
**Фикс:** Добавить `if (amount !== undefined && amount <= 0) throw Error('Amount must be positive')`.

---

## 🟡 P1 — ВАЖНО (до платных тарифов)

### FIX-08: Race condition при записи баланса
**Файл:** `src/server/services/FinanceService.ts`
**Фикс:** Заменить чтение+запись баланса на атомарный SQL UPDATE с инкрементом.

### FIX-09: paid_until тип TEXT в Supabase
**Фикс:** `ALTER TABLE companies ALTER COLUMN paid_until TYPE TIMESTAMPTZ USING paid_until::TIMESTAMPTZ;`

### FIX-10: Индексы по company_id
**Фикс:** Добавить составные индексы:
```sql
CREATE INDEX idx_transactions_company_date ON transactions(company_id, transaction_date);
CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_events_company ON events(company_id);
```

### FIX-11: Утечка стейта при logout
**Файл:** `src/client/context/FinanceContext.tsx`
**Фикс:** При logout сначала очищать массивы (`setTransactions([])`, `setAccounts([])`, `setEvents([])`), затем перенаправлять.

### FIX-12: cloudMirror без retry-очереди
**Файл:** `src/server/storage/cloudMirror.ts`
**Фикс:** Добавить простую localStorage-очередь неудачных операций с retry при следующем запуске.

### FIX-13: created_by/updated_by без FK
**Фикс:** Изменить тип на UUID и добавить FOREIGN KEY на `user_profiles(id) ON DELETE SET NULL`.

---

## 🟢 P2 — КОСМЕТИКА (полировка UX)

### FIX-14: Touch targets < 44x44px
**Файлы:** `TransactionRow.tsx` стр.165, `EventsView.tsx` стр.427, 455
**Фикс:** Увеличить padding кнопок-иконок до `padding: '12px'` или обернуть в `min-width: 44px; min-height: 44px`.

### FIX-15: Hardcoded цвета в компонентах
**Файлы:** `TransactionRow.tsx` стр.45, `EventsView.tsx` стр.236-258, `SuperAdminView.tsx` стр.669
**Фикс:** Заменить `#059669` → `var(--color-success)`, `#dc2626` → `var(--color-destructive)`, `#2563eb` → `var(--color-accent)`.

### FIX-16: Hardcode 'Никита' в fallback
**Файл:** `QuickEntryModal.tsx` стр.185
**Фикс:** Заменить `|| 'Никита'` на `|| 'Пользователь'`.

### FIX-17: Контрастность muted текста
**Проблема:** `--color-text-muted` (#8a8580) на сером фоне — контраст ~3.9:1, ниже WCAG AA.
**Фикс:** Изменить значение переменной на `#6b7280` (контраст 4.6:1).

### FIX-18: Inline-стили → CSS классы
**Файлы:** `AuthView.tsx` (20+ мест), `SuperAdminView.tsx` (десятки мест)
**Фикс:** Вынести повторяющиеся inline-стили в CSS-классы в globals.css.

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. FIX-02, FIX-03, FIX-04 (RBAC bypass — 30 мин)
2. FIX-05, FIX-06, FIX-07 (tenant isolation + валидация — 45 мин)
3. FIX-01 (RLS Supabase — 20 мин)
4. FIX-09, FIX-10, FIX-13 (SQL schema — 15 мин)
5. FIX-11 (logout state — 20 мин)
6. FIX-08 (race condition — 30 мин)
7. FIX-12 (retry queue — 40 мин)
8. FIX-14..FIX-18 (UI polish — 60 мин)
