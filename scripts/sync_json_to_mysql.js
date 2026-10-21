/**
 * Скрипт миграции всех данных из data/truespace.json в MySQL базу findoctor
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

async function main() {
  const jsonPath = process.argv[2] || path.resolve(process.cwd(), 'data', 'truespace.json');
  console.log(`[Sync] Reading data from ${jsonPath}...`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`[Sync] Error: File ${jsonPath} does not exist!`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'FindoctorPass2026!',
    database: process.env.DB_NAME || 'findoctor',
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log('[Sync] Connected to MySQL database findoctor successfully.');

  // 1. Убедимся, что таблица company_invites создана
  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_invites (
      id VARCHAR(100) PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      company_id VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      full_name VARCHAR(255),
      invited_by VARCHAR(100),
      created_at VARCHAR(100),
      expires_at VARCHAR(100),
      used_count INT DEFAULT 0,
      max_uses INT DEFAULT 1,
      status VARCHAR(50) DEFAULT 'active'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Компании
  if (Array.isArray(data.companies)) {
    console.log(`[Sync] Migrating ${data.companies.length} companies...`);
    for (const c of data.companies) {
      await connection.query(`
        INSERT INTO companies (id, name, slug, plan, trial_ends_at, paid_until, is_active, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          slug = VALUES(slug),
          plan = VALUES(plan),
          trial_ends_at = VALUES(trial_ends_at),
          paid_until = VALUES(paid_until),
          is_active = VALUES(is_active),
          owner_id = VALUES(owner_id),
          updated_at = VALUES(updated_at)
      `, [
        c.id,
        c.name,
        c.slug || '',
        c.plan || 'pro',
        c.trialEndsAt || null,
        c.paidUntil || null,
        c.isActive !== false ? 1 : 0,
        c.ownerId || null,
        c.createdAt || new Date().toISOString(),
        c.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 3. Пользователи и профили
  if (Array.isArray(data.users)) {
    console.log(`[Sync] Migrating ${data.users.length} users...`);
    for (const u of data.users) {
      await connection.query(`
        INSERT INTO users (id, email, full_name, company_id, company_name, is_super_admin, is_email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          full_name = VALUES(full_name),
          company_id = VALUES(company_id),
          company_name = VALUES(company_name),
          is_super_admin = VALUES(is_super_admin),
          is_email_verified = VALUES(is_email_verified),
          updated_at = VALUES(updated_at)
      `, [
        u.id,
        u.email,
        u.fullName || '',
        u.companyId || null,
        u.companyName || null,
        u.isSuperAdmin ? 1 : 0,
        u.isEmailVerified ? 1 : 0,
        u.createdAt || new Date().toISOString(),
        u.updatedAt || new Date().toISOString(),
      ]);

      await connection.query(`
        INSERT INTO user_profiles (id, email, full_name, company_id, company_name, avatar_url, is_super_admin, is_email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          full_name = VALUES(full_name),
          company_id = VALUES(company_id),
          company_name = VALUES(company_name),
          avatar_url = VALUES(avatar_url),
          is_super_admin = VALUES(is_super_admin),
          is_email_verified = VALUES(is_email_verified),
          updated_at = VALUES(updated_at)
      `, [
        u.id,
        u.email,
        u.fullName || '',
        u.companyId || null,
        u.companyName || null,
        u.avatarUrl || null,
        u.isSuperAdmin ? 1 : 0,
        u.isEmailVerified ? 1 : 0,
        u.createdAt || new Date().toISOString(),
        u.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 4. Членство в компаниях (memberships)
  const memberships = data.memberships || data.companyMembers || [];
  if (Array.isArray(memberships)) {
    console.log(`[Sync] Migrating ${memberships.length} memberships...`);
    for (const m of memberships) {
      await connection.query(`
        INSERT INTO company_members (id, company_id, company_name, user_id, user_email, user_name, role, invited_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          company_name = VALUES(company_name),
          user_email = VALUES(user_email),
          user_name = VALUES(user_name),
          updated_at = VALUES(updated_at)
      `, [
        m.id || `mem_${m.companyId}_${m.userId}`,
        m.companyId,
        m.companyName || null,
        m.userId,
        m.userEmail || null,
        m.userName || null,
        m.role || 'member',
        m.invitedBy || null,
        m.createdAt || new Date().toISOString(),
        m.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 5. Счета (accounts)
  if (Array.isArray(data.accounts)) {
    console.log(`[Sync] Migrating ${data.accounts.length} accounts...`);
    for (const a of data.accounts) {
      await connection.query(`
        INSERT INTO accounts (id, company_id, company_name, name, type, description, initial_balance, current_balance, currency, is_active, color, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          type = VALUES(type),
          description = VALUES(description),
          current_balance = VALUES(current_balance),
          is_active = VALUES(is_active),
          color = VALUES(color),
          icon = VALUES(icon),
          updated_at = VALUES(updated_at)
      `, [
        a.id,
        a.companyId || null,
        a.companyName || null,
        a.name,
        a.type,
        a.description || null,
        a.initialBalance || 0,
        a.currentBalance || 0,
        a.currency || 'RUB',
        a.isActive !== false ? 1 : 0,
        a.color || null,
        a.icon || null,
        a.createdAt || new Date().toISOString(),
        a.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 6. Категории (categories)
  if (Array.isArray(data.categories)) {
    console.log(`[Sync] Migrating ${data.categories.length} categories...`);
    for (const cat of data.categories) {
      await connection.query(`
        INSERT INTO categories (id, company_id, company_name, name, type, direction, color, icon, is_event_specific, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          type = VALUES(type),
          direction = VALUES(direction),
          color = VALUES(color),
          icon = VALUES(icon),
          is_event_specific = VALUES(is_event_specific),
          is_system = VALUES(is_system)
      `, [
        cat.id,
        cat.companyId || null,
        cat.companyName || null,
        cat.name,
        cat.type,
        cat.direction || null,
        cat.color || null,
        cat.icon || null,
        cat.isEventSpecific ? 1 : 0,
        cat.isSystem ? 1 : 0,
        cat.createdAt || new Date().toISOString(),
      ]);
    }
  }

  // 7. Мероприятия (events)
  if (Array.isArray(data.events)) {
    console.log(`[Sync] Migrating ${data.events.length} events...`);
    for (const ev of data.events) {
      await connection.query(`
        INSERT INTO events (id, company_id, company_name, title, client_name, event_date, status, budget, contract_amount, guest_count, location, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          client_name = VALUES(client_name),
          event_date = VALUES(event_date),
          status = VALUES(status),
          budget = VALUES(budget),
          contract_amount = VALUES(contract_amount),
          guest_count = VALUES(guest_count),
          location = VALUES(location),
          notes = VALUES(notes),
          updated_at = VALUES(updated_at)
      `, [
        ev.id,
        ev.companyId || null,
        ev.companyName || null,
        ev.title,
        ev.clientName || null,
        ev.eventDate || '',
        ev.status || 'planned',
        ev.budget || 0,
        ev.contractAmount || 0,
        ev.guestCount || 0,
        ev.location || null,
        ev.notes || null,
        ev.createdAt || new Date().toISOString(),
        ev.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 8. Партнеры (partners)
  if (Array.isArray(data.partners)) {
    console.log(`[Sync] Migrating ${data.partners.length} partners...`);
    for (const p of data.partners) {
      await connection.query(`
        INSERT INTO partners (id, company_id, company_name, name, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          role = VALUES(role),
          is_active = VALUES(is_active),
          updated_at = VALUES(updated_at)
      `, [
        p.id,
        p.companyId || null,
        p.companyName || null,
        p.name,
        p.role || null,
        p.isActive !== false ? 1 : 0,
        p.createdAt || new Date().toISOString(),
        p.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  // 9. Транзакции (transactions)
  if (Array.isArray(data.transactions)) {
    console.log(`[Sync] Migrating ${data.transactions.length} transactions...`);
    for (const tx of data.transactions) {
      await connection.query(`
        INSERT INTO transactions (id, company_id, company_name, type, direction, amount, from_account_id, to_account_id, category_id, event_id, partner_id, partner_name, description, transaction_date, is_deleted, needs_review, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          type = VALUES(type),
          direction = VALUES(direction),
          amount = VALUES(amount),
          from_account_id = VALUES(from_account_id),
          to_account_id = VALUES(to_account_id),
          category_id = VALUES(category_id),
          event_id = VALUES(event_id),
          partner_id = VALUES(partner_id),
          description = VALUES(description),
          is_deleted = VALUES(is_deleted),
          updated_at = VALUES(updated_at)
      `, [
        tx.id,
        tx.companyId || null,
        tx.companyName || null,
        tx.type,
        tx.direction || null,
        tx.amount,
        tx.fromAccountId || null,
        tx.toAccountId || null,
        tx.categoryId || null,
        tx.eventId || null,
        tx.partnerId || null,
        tx.partnerName || null,
        tx.description || null,
        tx.transactionDate,
        tx.isDeleted ? 1 : 0,
        tx.needsReview ? 1 : 0,
        tx.createdBy || null,
        tx.createdAt || new Date().toISOString(),
        tx.updatedAt || new Date().toISOString(),
      ]);
    }
  }

  console.log('[Sync] ✅ All data successfully migrated from JSON to MySQL!');
  
  // Выведем итоговые количества
  const [coRows] = await connection.query('SELECT count(*) as count FROM companies');
  const [uRows] = await connection.query('SELECT count(*) as count FROM users');
  const [accRows] = await connection.query('SELECT count(*) as count FROM accounts');
  const [txRows] = await connection.query('SELECT count(*) as count FROM transactions');

  console.log('[Sync] Current MySQL table records:', {
    companies: coRows[0].count,
    users: uRows[0].count,
    accounts: accRows[0].count,
    transactions: txRows[0].count,
  });

  await connection.end();
}

main().catch((err) => {
  console.error('[Sync] Migration error:', err);
  process.exit(1);
});
