-- ============================================================================
-- Truespace Event Pro Suite — Migration for Supabase
-- Run this script in your Supabase Project -> SQL Editor
-- ============================================================================

-- 1. Create table: event_payment_milestones (График оплат от заказчика)
CREATE TABLE IF NOT EXISTS event_payment_milestones (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'overdue')) DEFAULT 'pending',
    paid_amount NUMERIC(12, 2) DEFAULT NULL,
    paid_date DATE DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create table: event_budget_items (Смета мероприятия: План vs Факт)
CREATE TABLE IF NOT EXISTS event_budget_items (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    planned_amount NUMERIC(12, 2) NOT NULL CHECK (planned_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create table: event_vendors (Подрядчики и команда на мероприятии)
CREATE TABLE IF NOT EXISTS event_vendors (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL DEFAULT 'company_truespace_default' REFERENCES companies(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    agreed_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (agreed_fee >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (remaining_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Add vendor columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_id TEXT REFERENCES event_vendors(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- 5. Updated_at Triggers
DROP TRIGGER IF EXISTS trg_event_milestones_updated_at ON event_payment_milestones;
CREATE TRIGGER trg_event_milestones_updated_at
    BEFORE UPDATE ON event_payment_milestones
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_event_budget_items_updated_at ON event_budget_items;
CREATE TRIGGER trg_event_budget_items_updated_at
    BEFORE UPDATE ON event_budget_items
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_event_vendors_updated_at ON event_vendors;
CREATE TRIGGER trg_event_vendors_updated_at
    BEFORE UPDATE ON event_vendors
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

-- 6. Enable Row Level Security (RLS) & Policies
ALTER TABLE event_payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their company milestones" ON event_payment_milestones;
CREATE POLICY "Users can access their company milestones" ON event_payment_milestones
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

DROP POLICY IF EXISTS "Users can access their company budget items" ON event_budget_items;
CREATE POLICY "Users can access their company budget items" ON event_budget_items
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

DROP POLICY IF EXISTS "Users can access their company vendors" ON event_vendors;
CREATE POLICY "Users can access their company vendors" ON event_vendors
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- 7. Ensure Catering Categories exist
INSERT INTO categories (id, name, type, color, icon, is_event_specific, is_system) VALUES
('staff_dishwasher', 'Посудомойщица', 'expense', '#06b6d4', 'sparkles', true, false),
('staff_loader', 'Грузчик', 'expense', '#f59e0b', 'truck', true, false),
('staff_meals', 'Стафпитание (обеды, кофе)', 'expense', '#f59e0b', 'utensils', true, true),
('transport', 'Транспорт и платные дороги', 'expense', '#3b82f6', 'car', true, true)
ON CONFLICT (id) DO NOTHING;
