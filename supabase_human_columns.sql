-- ============================================================================
-- FinDoctor — Человекочитаемые колонки company_name и user_name в Supabase
--
-- Что делает этот скрипт:
-- 1. Добавляет колонку company_name во все таблицы:
--    company_members, accounts, transactions, events, categories, partners.
-- 2. В company_members также добавляет user_name и user_email, чтобы сразу
--    видеть кто в какой компании состоит без чтения сложных ID.
-- 3. Заполняет названия для всех уже существующих записей.
-- 4. Включает авто-триггеры: при создании любой новой записи (счёта,
--    транзакции, мероприятия, категории, партнёра, участника) или при
--    переименовании компании название подставится автоматически!
-- ============================================================================

-- 1. Добавляем колонки
ALTER TABLE IF EXISTS company_members ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE IF EXISTS company_members ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE IF EXISTS company_members ADD COLUMN IF NOT EXISTS user_email TEXT;

ALTER TABLE IF EXISTS accounts ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE IF EXISTS events ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE IF EXISTS partners ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 2. Заполняем названия для всех текущих строк в базе
UPDATE company_members cm
SET
  company_name = c.name,
  user_name = u.full_name,
  user_email = u.email
FROM companies c, user_profiles u
WHERE cm.company_id = c.id AND cm.user_id = u.id;

UPDATE accounts a
SET company_name = c.name
FROM companies c
WHERE a.company_id = c.id;

UPDATE transactions t
SET company_name = c.name
FROM companies c
WHERE t.company_id = c.id;

UPDATE events e
SET company_name = c.name
FROM companies c
WHERE e.company_id = c.id;

UPDATE categories cat
SET company_name = c.name
FROM companies c
WHERE cat.company_id = c.id;

UPDATE partners p
SET company_name = c.name
FROM companies c
WHERE p.company_id = c.id;

-- 3. Триггерная функция: автоматически подставляет company_name при вставке/обновлении
CREATE OR REPLACE FUNCTION findoctor_autofill_company_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT name INTO NEW.company_name FROM companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция специально для company_members (подставляет и компанию, и имя/почту юзера)
CREATE OR REPLACE FUNCTION findoctor_autofill_member_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT name INTO NEW.company_name FROM companies WHERE id = NEW.company_id;
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT full_name, email INTO NEW.user_name, NEW.user_email FROM user_profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Навешиваем триггеры на все таблицы
DROP TRIGGER IF EXISTS trg_company_members_names ON company_members;
CREATE TRIGGER trg_company_members_names
BEFORE INSERT OR UPDATE ON company_members
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_member_names();

DROP TRIGGER IF EXISTS trg_accounts_company_name ON accounts;
CREATE TRIGGER trg_accounts_company_name
BEFORE INSERT OR UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_company_name();

DROP TRIGGER IF EXISTS trg_transactions_company_name ON transactions;
CREATE TRIGGER trg_transactions_company_name
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_company_name();

DROP TRIGGER IF EXISTS trg_events_company_name ON events;
CREATE TRIGGER trg_events_company_name
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_company_name();

DROP TRIGGER IF EXISTS trg_categories_company_name ON categories;
CREATE TRIGGER trg_categories_company_name
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_company_name();

DROP TRIGGER IF EXISTS trg_partners_company_name ON partners;
CREATE TRIGGER trg_partners_company_name
BEFORE INSERT OR UPDATE ON partners
FOR EACH ROW EXECUTE FUNCTION findoctor_autofill_company_name();

-- 4. Если компания переименовалась — автоматически обновить имя во всех таблицах
CREATE OR REPLACE FUNCTION findoctor_sync_company_rename()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE company_members SET company_name = NEW.name WHERE company_id = NEW.id;
    UPDATE accounts SET company_name = NEW.name WHERE company_id = NEW.id;
    UPDATE transactions SET company_name = NEW.name WHERE company_id = NEW.id;
    UPDATE events SET company_name = NEW.name WHERE company_id = NEW.id;
    UPDATE categories SET company_name = NEW.name WHERE company_id = NEW.id;
    UPDATE partners SET company_name = NEW.name WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_sync_rename ON companies;
CREATE TRIGGER trg_companies_sync_rename
AFTER UPDATE OF name ON companies
FOR EACH ROW EXECUTE FUNCTION findoctor_sync_company_rename();
