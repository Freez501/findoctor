-- ============================================================================
-- Truespace — Барный кейтеринг и финансы
-- PostgreSQL / Supabase Production DDL & Migration (`src/server/data/supabase.sql`)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TRIGGER FUNCTION FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION truespace_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1.5. MULTI-TENANT SAAS: COMPANIES, USERS & MEMBERSHIPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

CREATE TABLE IF NOT EXISTS company_members (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'owner', 'admin', 'staff')),
    invited_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, user_id)
);

-- ============================================================================
-- 2. TABLE: ACCOUNTS (5 счетов ликвидности кейтеринга)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'card')),
    description TEXT,
    color TEXT,
    icon TEXT,
    initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE accounts IS '5 обособленных расчётных узлов (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы)';
COMMENT ON COLUMN accounts.initial_balance IS 'Стартовый остаток на момент начала учёта';
COMMENT ON COLUMN accounts.current_balance IS 'Текущий актуальный баланс счёта с учётом всех транзакций';

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

-- ============================================================================
-- 3. TABLE: PARTNERS (Партнёры и сооснователи)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. TABLE: EVENTS (Мероприятия и банкеты)
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_name TEXT,
    event_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'planned',
    budget NUMERIC(12, 2) DEFAULT 0.00 CHECK (budget >= 0),
    contract_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (contract_amount >= 0),
    guest_count INTEGER DEFAULT 0 CHECK (guest_count >= 0),
    location TEXT,
    notes TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Кейтеринговые мероприятия (свадьбы, корпоративы, банкеты) для расчёта маржинальности';

CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

-- ============================================================================
-- 5. TABLE: CATEGORIES (Категории доходов и расходов)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both', 'transfer')),
    direction TEXT CHECK (direction IN ('income', 'expense', 'transfer')),
    color TEXT NOT NULL DEFAULT '#64748b',
    icon TEXT,
    is_event_specific BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categories IS 'Справочник категорий: прямые производственные расходы, общехозяйственные и доходы';
COMMENT ON COLUMN categories.is_event_specific IS 'true = прямые расходы/доходы ивента; false = общехозяйственные расходы бара';

-- ============================================================================
-- 6. TABLE: TRANSACTIONS (Финансовые операции)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    direction TEXT CHECK (direction IN ('income', 'expense', 'transfer')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    from_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
    partner_id TEXT REFERENCES partners(id) ON DELETE SET NULL,
    partner_name TEXT,
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Double-entry and transaction integrity constraints
    CONSTRAINT check_income_structure CHECK (
        (type = 'income' AND to_account_id IS NOT NULL AND from_account_id IS NULL) OR
        (type != 'income')
    ),
    CONSTRAINT check_expense_structure CHECK (
        (type = 'expense' AND from_account_id IS NOT NULL AND to_account_id IS NULL) OR
        (type != 'expense')
    ),
    CONSTRAINT check_transfer_structure CHECK (
        (type = 'transfer' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id <> to_account_id) OR
        (type != 'transfer')
    )
);

COMMENT ON TABLE transactions IS 'Атомарные транзакции с привязкой к автору и компании';

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

-- ============================================================================
-- 6. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_date_desc ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_active ON transactions(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_from_acc ON transactions(from_account_id) WHERE from_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_to_acc ON transactions(to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_events_date_desc ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active) WHERE is_active = true;

-- ============================================================================
-- 7. ANALYTICAL VIEWS
-- ============================================================================

-- View: Event Margin Analytics (Маржинальность мероприятий)
CREATE OR REPLACE VIEW v_event_margin_analytics AS
WITH event_revenue AS (
    SELECT 
        event_id,
        COALESCE(SUM(amount), 0.00) AS total_revenue
    FROM transactions
    WHERE is_deleted = false AND type = 'income' AND event_id IS NOT NULL
    GROUP BY event_id
),
event_expenses AS (
    SELECT 
        event_id,
        COALESCE(SUM(amount), 0.00) AS total_direct_expenses
    FROM transactions
    WHERE is_deleted = false AND type = 'expense' AND event_id IS NOT NULL
    GROUP BY event_id
)
SELECT 
    e.id AS event_id,
    e.title AS event_title,
    e.event_date,
    e.status,
    COALESCE(r.total_revenue, 0.00) AS revenue,
    COALESCE(x.total_direct_expenses, 0.00) AS direct_expenses,
    (COALESCE(r.total_revenue, 0.00) - COALESCE(x.total_direct_expenses, 0.00)) AS net_profit,
    CASE 
        WHEN COALESCE(r.total_revenue, 0.00) > 0 THEN 
            ROUND(((COALESCE(r.total_revenue, 0.00) - COALESCE(x.total_direct_expenses, 0.00)) / r.total_revenue) * 100.0, 2)
        ELSE 0.00 
    END AS margin_percentage
FROM events e
LEFT JOIN event_revenue r ON e.id = r.event_id
LEFT JOIN event_expenses x ON e.id = x.event_id;

-- View: Account Balances Live Reconciliation
CREATE OR REPLACE VIEW v_account_balances_reconciliation AS
WITH credits AS (
    SELECT to_account_id AS account_id, COALESCE(SUM(amount), 0.00) AS total_credited
    FROM transactions
    WHERE is_deleted = false AND to_account_id IS NOT NULL
    GROUP BY to_account_id
),
debits AS (
    SELECT from_account_id AS account_id, COALESCE(SUM(amount), 0.00) AS total_debited
    FROM transactions
    WHERE is_deleted = false AND from_account_id IS NOT NULL
    GROUP BY from_account_id
)
SELECT 
    a.id AS account_id,
    a.name AS account_name,
    a.type,
    a.initial_balance,
    COALESCE(c.total_credited, 0.00) AS total_inflow,
    COALESCE(d.total_debited, 0.00) AS total_outflow,
    (a.initial_balance + COALESCE(c.total_credited, 0.00) - COALESCE(d.total_debited, 0.00)) AS calculated_balance,
    a.current_balance AS stored_balance,
    ((a.initial_balance + COALESCE(c.total_credited, 0.00) - COALESCE(d.total_debited, 0.00)) - a.current_balance) AS discrepancy
FROM accounts a
LEFT JOIN credits c ON a.id = c.account_id
LEFT JOIN debits d ON a.id = d.account_id;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Baseline permissive policies for authenticated and anon users (for prototype & API access)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Allow all access to accounts') THEN
        CREATE POLICY "Allow all access to accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Allow all access to events') THEN
        CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all access to categories') THEN
        CREATE POLICY "Allow all access to categories" ON categories FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions') THEN
        CREATE POLICY "Allow all access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 9. PRE-SEEDED DEMO DATA (Организация, Пользователи, 5 Счетов, 2 Ивента, 21 tx)
-- ============================================================================

-- 9.0 Organization, Users & Memberships
INSERT INTO companies (id, name, slug, plan, is_active, owner_id) VALUES
('company_truespace_default', 'Truespace Catering', 'truespace', 'pro', true, 'user_nikita')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (id, email, full_name, is_super_admin) VALUES
('user_nikita', 'nikita@truespace.ru', 'Никита', true),
('user_vlad', 'vlad@truespace.ru', 'Влад', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO company_members (id, company_id, user_id, role) VALUES
('mem_nikita', 'company_truespace_default', 'user_nikita', 'super_admin'),
('mem_vlad', 'company_truespace_default', 'user_vlad', 'owner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO partners (id, company_id, name, role, is_active) VALUES
('partner_nikita', 'company_truespace_default', 'Никита', 'Управляющий партнёр', true),
('partner_vlad', 'company_truespace_default', 'Влад', 'Шеф-бармен / Сооснователь', true)
ON CONFLICT (id) DO NOTHING;

-- 9.1 Accounts (Initial: 840 000 ₽, Final after 21 tx: 1 166 300 ₽)
INSERT INTO accounts (id, company_id, name, type, description, initial_balance, current_balance, currency, is_active, color, icon, updated_at) VALUES
('cash_1', 'company_truespace_default', 'Нал 1 (Касса на площадке)', 'cash', 'Разменная касса барменов на площадке, чаевые, мелкие чеки (лёд, мята)', 25000.00, 6300.00, 'RUB', true, '#10b981', 'wallet', '2026-09-16T23:30:00Z'),
('cash_2', 'company_truespace_default', 'Нал 2 (Сейф / Владелец)', 'cash', 'Сейф в офисе: расчёты наличными, гонорары барменов, резерв наличных', 180000.00, 199000.00, 'RUB', true, '#059669', 'vault', '2026-09-16T23:30:00Z'),
('bank_1', 'company_truespace_default', 'Безнал 1 (Основной р/с)', 'bank', 'Расчётный счёт кейтеринга в банке (договоры с юрлицами, оптовые закупки алкоголя)', 450000.00, 814000.00, 'RUB', true, '#3b82f6', 'landmark', '2026-09-16T23:30:00Z'),
('bank_2', 'company_truespace_default', 'Безнал 2 (Резерв / Эквайринг)', 'bank', 'Торговый эквайринг на выезде (терминал на стойке) и резервный расчётный счёт', 120000.00, 112000.00, 'RUB', true, '#6366f1', 'credit-card', '2026-09-16T23:30:00Z'),
('card_sbp', 'company_truespace_default', 'Переводы (Карта СБП)', 'card', 'Личная карта шеф-бармена для мгновенных оплат по СБП и срочных оплат такси', 65000.00, 35000.00, 'RUB', true, '#8b5cf6', 'smartphone', '2026-09-16T23:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- 9.2 Categories (12 категорий)
INSERT INTO categories (id, name, type, color, icon, is_event_specific, is_system) VALUES
('contract_prepayment', 'Предоплата по договору', 'income', '#10b981', 'file-check', true, true),
('contract_final', 'Финальная оплата', 'income', '#059669', 'badge-check', true, true),
('onsite_sales', 'Продажи на площадке / Доплата', 'income', '#0ea5e9', 'credit-card', true, true),
('tips', 'Чаевые команды', 'income', '#8b5cf6', 'sparkles', true, true),
('alcohol', 'Алкоголь и напитки', 'expense', '#ef4444', 'wine', true, true),
('staff', 'Персонал и гонорары', 'expense', '#f97316', 'users', true, true),
('logistics', 'Логистика и транспорт', 'expense', '#eab308', 'truck', true, true),
('supplies', 'Лёд и продукты', 'expense', '#06b6d4', 'snowflake', true, true),
('equipment', 'Аренда оборудования', 'expense', '#a855f7', 'box', true, true),
('overhead', 'Аренда склада / Общехозяйственные', 'expense', '#64748b', 'warehouse', false, true),
('inventory', 'Инвентарь и хозтовары', 'expense', '#475569', 'wrench', false, true),
('transfer_internal', 'Внутренний перевод', 'transfer', '#6366f1', 'arrow-left-right', false, true)
ON CONFLICT (id) DO NOTHING;

-- 9.3 Events (Свадьба и Корпоратив)
INSERT INTO events (id, title, event_date, status, budget, guest_count, location, notes, updated_at) VALUES
('event-wedding', 'Свадьба Артёма и Анны', '2026-09-20', 'active', 290000.00, 60, 'Усадьба «Лесной Берег», шатёр у озера', 'Авторский коктейльный бар, 350 порций коктейлей, горка шампанского', '2026-09-16T23:30:00Z'),
('event-corporate', 'Летний корпоратив NexaTech', '2026-09-25', 'planned', 420000.00, 120, 'Лофт «Красный Октябрь», зал «Сфера»', 'Тематический интерактивный бар + велком-зона, брендированные коктейли', '2026-09-16T23:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- 9.4 Transactions (21 операция: 5 доходов, 11 расходов, 5 переводов)
INSERT INTO transactions (id, type, amount, from_account_id, to_account_id, category_id, event_id, description, transaction_date, is_deleted) VALUES
('tx-001', 'income', 130000.00, NULL, 'bank_1', 'contract_prepayment', 'event-wedding', 'Предоплата 50% по договору №24-СВ от жениха', '2026-09-10T11:00:00Z', false),
('tx-002', 'expense', 48000.00, 'bank_1', NULL, 'alcohol', 'event-wedding', 'Оптовая закупка джина, рома, вермута и просекко в SimpleWine', '2026-09-12T14:30:00Z', false),
('tx-003', 'income', 294000.00, NULL, 'bank_1', 'contract_prepayment', 'event-corporate', 'Аванс 70% от ООО «НексаТек» по счёту №88', '2026-09-13T16:00:00Z', false),
('tx-004', 'expense', 85000.00, 'bank_1', NULL, 'alcohol', 'event-corporate', 'Закупка премиального виски, бурбона и тоников под бренд-коктейли', '2026-09-14T10:00:00Z', false),
('tx-005', 'transfer', 30000.00, 'cash_2', 'cash_1', 'transfer_internal', NULL, 'Пополнение кассы площадки разменными купюрами перед уикендом', '2026-09-15T11:30:00Z', false),
('tx-006', 'expense', 22000.00, 'bank_1', NULL, 'equipment', 'event-corporate', 'Аренда дизайнерской светящейся стойки и бокалов шале в RentBar', '2026-09-15T12:00:00Z', false),
('tx-007', 'expense', 35000.00, 'bank_1', NULL, 'overhead', NULL, 'Ежемесячная аренда заготовочного цеха и склада инвентаря', '2026-09-15T15:30:00Z', false),
('tx-008', 'expense', 16000.00, 'cash_2', NULL, 'staff', 'event-wedding', 'Аванс шеф-бармену и бартендеру наличными из сейфа', '2026-09-15T17:00:00Z', false),
('tx-009', 'expense', 8500.00, 'card_sbp', NULL, 'logistics', 'event-wedding', 'Грузовое такси: перевозка стойки и стекла в усадьбу «Лесной Берег»', '2026-09-15T18:30:00Z', false),
('tx-010', 'transfer', 50000.00, 'bank_1', 'cash_2', 'transfer_internal', NULL, 'Снятие наличных со счёта в сейф на зарплатный фонд команды', '2026-09-16T09:30:00Z', false),
('tx-011', 'expense', 9500.00, 'card_sbp', NULL, 'supplies', 'event-corporate', 'Заказ 200 прозрачных ледяных сфер в термобоксах (LumiIce)', '2026-09-16T11:00:00Z', false),
('tx-012', 'expense', 12500.00, 'cash_1', NULL, 'supplies', 'event-wedding', 'Покупка ягод, маракуйи, свежей мяты и пищевого льда на Фуд-Сити', '2026-09-16T13:00:00Z', false),
('tx-013', 'expense', 4200.00, 'cash_1', NULL, 'inventory', NULL, 'Новые джиггеры, гейзеры и запас салфеток для бара', '2026-09-16T15:00:00Z', false),
('tx-014', 'expense', 7000.00, 'cash_1', NULL, 'logistics', 'event-corporate', 'Грузовой каршеринг и грузчики для заезда в лофт Красный Октябрь', '2026-09-16T16:30:00Z', false),
('tx-015', 'income', 130000.00, NULL, 'bank_1', 'contract_final', 'event-wedding', 'Окончательный платёж 50% по договору №24-СВ перед мероприятием', '2026-09-16T17:00:00Z', false),
('tx-016', 'income', 18000.00, NULL, 'card_sbp', 'onsite_sales', 'event-wedding', 'Доплата заказчика через СБП за продление работы бара на 1 час', '2026-09-16T19:30:00Z', false),
('tx-017', 'income', 12000.00, NULL, 'bank_2', 'onsite_sales', 'event-wedding', 'Оплата гостями шотов через выездной эквайринг-терминал', '2026-09-16T21:00:00Z', false),
('tx-018', 'expense', 10000.00, 'cash_1', NULL, 'staff', 'event-wedding', 'Финальный расчёт помощников бармена и барбэка наличными', '2026-09-16T22:00:00Z', false),
('tx-019', 'transfer', 30000.00, 'card_sbp', 'bank_1', 'transfer_internal', NULL, 'Перевод накопленных клиентских платежей с личной карты на р/с', '2026-09-16T22:30:00Z', false),
('tx-020', 'transfer', 20000.00, 'bank_2', 'bank_1', 'transfer_internal', NULL, 'Перечисление выручки с терминала эквайринга на основной счёт', '2026-09-16T23:00:00Z', false),
('tx-021', 'transfer', 15000.00, 'cash_1', 'cash_2', 'transfer_internal', NULL, 'Инкассация остатка наличных с площадки в сейф владельца', '2026-09-16T23:30:00Z', false)
ON CONFLICT (id) DO NOTHING;
