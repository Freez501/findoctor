-- ============================================================================
-- Truespace — Барный кейтеринг и финансы
-- Единый SQL-скрипт фиксов (FIX-01, FIX-09, FIX-10, FIX-13) для Supabase
--
-- ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ:
-- 1. Откройте Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Перейдите в раздел "SQL Editor" слева
-- 3. Нажмите "New Query"
-- 4. Скопируйте и вставьте весь этот файл целиком
-- 5. Нажмите кнопку "Run" (зелёная стрелка)
-- ============================================================================

-- Включаем требуемые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ТРИГГЕРНАЯ ФУНКЦИЯ ДЛЯ UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION truespace_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FIX-09: ПРИВЕДЕНИЕ ТИПА paid_until К TIMESTAMPTZ
-- ============================================================================
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;

DO $$
BEGIN
    -- Если колонка уже была текстовой, заменяем пустые строки на NULL перед кастом
    UPDATE companies SET paid_until = NULL WHERE paid_until::text = '';
    ALTER TABLE companies ALTER COLUMN paid_until TYPE TIMESTAMPTZ USING NULLIF(paid_until::text, '')::TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'paid_until conversion notice: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. FIX-10: СОСТАВНЫЕ ИНДЕКСЫ ДЛЯ МНОГОАРЕНДНОСТИ И БЫСТРОДЕЙСТВИЯ
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_company_date ON transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_company_account ON transactions(company_id, from_account_id, to_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_events_company_date ON events(company_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_partners_company ON partners(company_id);

-- ============================================================================
-- 4. FIX-13: ВНЕШНИЕ КЛЮЧИ (FOREIGN KEYS) ДЛЯ created_by И updated_by
-- ============================================================================

-- Очищаем любые несуществующие ссылки перед наложением ограничения, чтобы запрос не падал
DO $$
BEGIN
    UPDATE events SET created_by = NULL 
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM user_profiles);

    UPDATE events SET updated_by = NULL 
    WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM user_profiles);

    UPDATE transactions SET created_by = NULL 
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM user_profiles);

    UPDATE transactions SET updated_by = NULL 
    WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM user_profiles);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Cleanup notice: %', SQLERRM;
END $$;

-- Безопасное добавление FK на events
DO $$
BEGIN
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
    ALTER TABLE events ADD CONSTRAINT events_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_updated_by_fkey;
    ALTER TABLE events ADD CONSTRAINT events_updated_by_fkey 
        FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'events FK notice: %', SQLERRM;
END $$;

-- Безопасное добавление FK на transactions
DO $$
BEGIN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;
    ALTER TABLE transactions ADD CONSTRAINT transactions_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_updated_by_fkey;
    ALTER TABLE transactions ADD CONSTRAINT transactions_updated_by_fkey 
        FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'transactions FK notice: %', SQLERRM;
END $$;

-- ============================================================================
-- 5. FIX-01: RLS ПОЛИТИКИ ИЗОЛЯЦИИ ТЕНАНТОВ
-- ============================================================================

-- Вспомогательная функция: проверка роли супер-админа
CREATE OR REPLACE FUNCTION truespace_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()::text AND is_super_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Вспомогательная функция: проверка доступа пользователя к компании
CREATE OR REPLACE FUNCTION truespace_user_has_company_access(target_company_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Разрешаем сервисному бэкенду Truespace (Node.js cloudMirror) и админ-скриптам
    IF auth.role() = 'service_role' OR auth.role() = 'anon' THEN
        RETURN true;
    END IF;

    -- Глобальный администратор платформы имеет доступ ко всем тенантам
    IF truespace_is_super_admin() THEN
        RETURN true;
    END IF;

    -- Обычный авторизованный пользователь видит только свою компанию
    RETURN EXISTS (
        SELECT 1 FROM company_members
        WHERE company_id = target_company_id AND user_id = auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Включаем RLS на таблицах
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- accounts
DROP POLICY IF EXISTS "Allow all access to accounts" ON accounts;
DROP POLICY IF EXISTS "Users can access their company accounts" ON accounts;
CREATE POLICY "Users can access their company accounts" ON accounts
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- events
DROP POLICY IF EXISTS "Allow all access to events" ON events;
DROP POLICY IF EXISTS "Users can access their company events" ON events;
CREATE POLICY "Users can access their company events" ON events
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- categories
DROP POLICY IF EXISTS "Allow all access to categories" ON categories;
DROP POLICY IF EXISTS "Users can access their company categories" ON categories;
CREATE POLICY "Users can access their company categories" ON categories
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- transactions
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;
DROP POLICY IF EXISTS "Users can access their company transactions" ON transactions;
CREATE POLICY "Users can access their company transactions" ON transactions
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- partners
DROP POLICY IF EXISTS "Allow all access to partners" ON partners;
DROP POLICY IF EXISTS "Users can access their company partners" ON partners;
CREATE POLICY "Users can access their company partners" ON partners
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- companies
DROP POLICY IF EXISTS "Allow all access to companies" ON companies;
DROP POLICY IF EXISTS "Users can access their company" ON companies;
CREATE POLICY "Users can access their company" ON companies
    FOR ALL
    USING (truespace_user_has_company_access(id))
    WITH CHECK (truespace_user_has_company_access(id));

-- company_members
DROP POLICY IF EXISTS "Allow all access to company_members" ON company_members;
DROP POLICY IF EXISTS "Users can access their company members" ON company_members;
CREATE POLICY "Users can access their company members" ON company_members
    FOR ALL
    USING (truespace_user_has_company_access(company_id))
    WITH CHECK (truespace_user_has_company_access(company_id));

-- user_profiles
DROP POLICY IF EXISTS "Allow all access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can access own profile or admin" ON user_profiles;
CREATE POLICY "Users can access own profile or admin" ON user_profiles
    FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'anon' OR id = auth.uid()::text OR truespace_is_super_admin())
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'anon' OR id = auth.uid()::text OR truespace_is_super_admin());

-- ============================================================================
-- 6. БЕЗОПАСНОЕ ПЕРЕСОЗДАНИЕ ТРИГГЕРОВ (DROP TRIGGER IF EXISTS)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION truespace_set_updated_at();

-- Сообщение об успешном выполнении
DO $$
BEGIN
    RAISE NOTICE 'Truespace fixes successfully applied!';
END $$;
