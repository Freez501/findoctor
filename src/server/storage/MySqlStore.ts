/**
 * Truespace / Findoctor — Барный кейтеринг и финансы
 * MySQL Storage Implementation (`src/server/storage/MySqlStore.ts`)
 *
 * Direct persistent relational storage for production MySQL database findoctor.
 */

import mysql from 'mysql2/promise';
import {
  Account,
  CateringEvent,
  Category,
  Transaction,
  TransactionFilter,
  Partner,
  Company,
  UserProfile,
  CompanyMembership,
  CompanyInvite,
  UserRole,
  EventPaymentMilestone,
  EventBudgetItem,
  EventVendor,
} from '../../shared/types.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import { DatabaseState, createInitialDatabaseState } from '../data/seed.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

const round2 = (n: number | string | undefined | null): number => Math.round((Number(n) || 0) * 100) / 100;

export interface MySqlStoreConfig {
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  port?: number;
}

export class MySqlStore implements IFinanceStore {
  private pool: mysql.Pool;

  constructor(config?: MySqlStoreConfig) {
    this.pool = mysql.createPool({
      host: config?.host || process.env.DB_HOST || '127.0.0.1',
      user: config?.user || process.env.DB_USER || 'root',
      password: config?.password || process.env.DB_PASSWORD || process.env.DB_PASS || 'FindoctorPass2026!',
      database: config?.database || process.env.DB_NAME || 'findoctor',
      port: Number(config?.port || process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }

  // =========================================================================
  // COMPANIES (Tenants)
  // =========================================================================

  public async getCompanies(): Promise<Company[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM companies ORDER BY created_at DESC');
    return (rows || []).map((r: any) => this.mapCompany(r));
  }

  public async getCompanyById(id: string): Promise<Company | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapCompany(rows[0]) : null;
  }

  public async createCompany(companyInput: Partial<Company> & { name: string }): Promise<Company> {
    const now = new Date().toISOString();
    const id = companyInput.id || `company_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const comp: Company = {
      id,
      name: companyInput.name.trim(),
      slug: companyInput.slug || companyInput.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `co-${Date.now()}`,
      plan: companyInput.plan || 'pro',
      trialEndsAt: companyInput.trialEndsAt,
      paidUntil: companyInput.paidUntil ?? null,
      isActive: companyInput.isActive ?? true,
      ownerId: companyInput.ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
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
      comp.id,
      comp.name,
      comp.slug,
      comp.plan,
      comp.trialEndsAt || null,
      comp.paidUntil || null,
      comp.isActive ? 1 : 0,
      comp.ownerId || null,
      comp.createdAt,
      comp.updatedAt,
    ]);

    return comp;
  }

  public async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const existing = await this.getCompanyById(id);
    if (!existing) throw new Error(`Компания не найдена: ${id}`);
    const updated: Company = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.pool.query(`
      UPDATE companies
      SET name = ?, slug = ?, plan = ?, trial_ends_at = ?, paid_until = ?, is_active = ?, owner_id = ?, updated_at = ?
      WHERE id = ?
    `, [
      updated.name,
      updated.slug,
      updated.plan,
      updated.trialEndsAt !== undefined ? updated.trialEndsAt : existing.trialEndsAt || null,
      updated.paidUntil !== undefined ? updated.paidUntil : existing.paidUntil || null,
      updated.isActive ? 1 : 0,
      updated.ownerId || null,
      updated.updatedAt,
      id,
    ]);

    return updated;
  }

  public async deleteCompany(id: string): Promise<boolean> {
    const existing = await this.getCompanyById(id);
    if (!existing) return false;

    await this.pool.query('DELETE FROM transactions WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM accounts WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM events WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM categories WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM partners WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM company_members WHERE company_id = ?', [id]);
    await this.pool.query('DELETE FROM companies WHERE id = ?', [id]);

    return true;
  }

  // =========================================================================
  // USERS & MEMBERSHIPS
  // =========================================================================

  public async getUsers(): Promise<UserProfile[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM user_profiles');
    return (rows || []).map((r: any) => this.mapUser(r));
  }

  public async getUserById(id: string): Promise<UserProfile | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM user_profiles WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapUser(rows[0]) : null;
  }

  public async saveUserProfile(userInput: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const now = new Date().toISOString();
    const companyId = (userInput as any).companyId || null;
    const companyName = (userInput as any).companyName || null;

    const user: UserProfile = {
      id: userInput.id,
      email: userInput.email.toLowerCase().trim(),
      fullName: userInput.fullName?.trim() || userInput.email.split('@')[0],
      avatarUrl: userInput.avatarUrl,
      isSuperAdmin: userInput.isSuperAdmin ?? false,
      isEmailVerified: userInput.isEmailVerified ?? false,
      createdAt: userInput.createdAt || now,
      updatedAt: now,
    };

    await this.pool.query(`
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
      user.id,
      user.email,
      user.fullName,
      companyId,
      companyName,
      user.avatarUrl || null,
      user.isSuperAdmin ? 1 : 0,
      user.isEmailVerified ? 1 : 0,
      user.createdAt,
      user.updatedAt,
    ]);

    await this.pool.query(`
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
      user.id,
      user.email,
      user.fullName,
      companyId,
      companyName,
      user.isSuperAdmin ? 1 : 0,
      user.isEmailVerified ? 1 : 0,
      user.createdAt,
      user.updatedAt,
    ]);

    return user;
  }

  public async setUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    await this.pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await this.pool.query('UPDATE user_profiles SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    return true;
  }

  public async getUserPasswordHash(userId: string): Promise<string | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
    return rows.length > 0 && rows[0].password_hash ? rows[0].password_hash : null;
  }

  public async getCompanyMembers(companyId: string): Promise<{ membership: CompanyMembership; user?: UserProfile }[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM company_members WHERE company_id = ?', [companyId]);
    const users = await this.getUsers();

    return (rows || []).map((m: any) => ({
      membership: {
        id: m.id,
        companyId: m.company_id,
        userId: m.user_id,
        role: m.role as UserRole,
        invitedBy: m.invited_by || undefined,
        createdAt: m.created_at || new Date().toISOString(),
      },
      user: users.find((u) => u.id === m.user_id),
    }));
  }

  public async addCompanyMember(dataInput: {
    companyId: string;
    userId: string;
    role: UserRole;
    invitedBy?: string;
  }): Promise<CompanyMembership> {
    const now = new Date().toISOString();
    const membership: CompanyMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: dataInput.companyId,
      userId: dataInput.userId,
      role: dataInput.role,
      invitedBy: dataInput.invitedBy,
      createdAt: now,
    };

    const user = await this.getUserById(dataInput.userId);
    const company = await this.getCompanyById(dataInput.companyId);

    await this.pool.query(`
      INSERT INTO company_members (id, company_id, company_name, user_id, user_email, user_name, role, invited_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        role = VALUES(role),
        company_name = VALUES(company_name),
        user_email = VALUES(user_email),
        user_name = VALUES(user_name),
        updated_at = VALUES(updated_at)
    `, [
      membership.id,
      membership.companyId,
      company?.name || null,
      membership.userId,
      user?.email || null,
      user?.fullName || null,
      membership.role,
      membership.invitedBy || null,
      membership.createdAt,
      now,
    ]);

    return membership;
  }

  // =========================================================================
  // COMPANY INVITES
  // =========================================================================

  public async getCompanyInvites(companyId?: string): Promise<CompanyInvite[]> {
    let sql = 'SELECT * FROM company_invites';
    const params: any[] = [];
    if (companyId) {
      sql += ' WHERE company_id = ?';
      params.push(companyId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapInvite(r));
  }

  public async getInviteByToken(token: string): Promise<CompanyInvite | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM company_invites WHERE token = ? LIMIT 1', [token]);
    return rows.length > 0 ? this.mapInvite(rows[0]) : null;
  }

  public async createCompanyInvite(inviteInput: Partial<CompanyInvite> & { companyId: string; role: UserRole }): Promise<CompanyInvite> {
    const now = new Date().toISOString();
    const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const id = inviteInput.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const invite: CompanyInvite = {
      id,
      token,
      companyId: inviteInput.companyId,
      role: inviteInput.role,
      email: inviteInput.email,
      fullName: inviteInput.fullName,
      invitedBy: inviteInput.invitedBy,
      createdAt: now,
      expiresAt: inviteInput.expiresAt,
      usedCount: 0,
      maxUses: inviteInput.maxUses || 1,
      status: 'active',
    };

    await this.pool.query(`
      INSERT INTO company_invites (id, token, company_id, role, email, full_name, invited_by, created_at, expires_at, used_count, max_uses, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invite.id,
      invite.token,
      invite.companyId,
      invite.role,
      invite.email || null,
      invite.fullName || null,
      invite.invitedBy || null,
      invite.createdAt,
      invite.expiresAt || null,
      invite.usedCount,
      invite.maxUses || 1,
      invite.status,
    ]);

    return invite;
  }

  public async revokeCompanyInvite(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('UPDATE company_invites SET status = "revoked" WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  public async acceptCompanyInvite(token: string, userId: string): Promise<{ company: Company; membership: CompanyMembership; invite: CompanyInvite }> {
    const invite = await this.getInviteByToken(token);
    if (!invite) throw new Error('Приглашение не найдено');
    if (invite.status !== 'active') throw new Error('Приглашение недействительно');

    const company = await this.getCompanyById(invite.companyId);
    if (!company) throw new Error('Компания не найдена');

    const membership = await this.addCompanyMember({
      companyId: invite.companyId,
      userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });

    const newUsedCount = invite.usedCount + 1;
    const isExhausted = invite.maxUses && newUsedCount >= invite.maxUses;
    const newStatus = isExhausted ? 'expired' : 'active';

    await this.pool.query('UPDATE company_invites SET used_count = ?, status = ? WHERE id = ?', [
      newUsedCount,
      newStatus,
      invite.id,
    ]);

    return { company, membership, invite: { ...invite, usedCount: newUsedCount, status: newStatus } };
  }

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  public async getAccounts(companyId?: string): Promise<Account[]> {
    let sql = 'SELECT * FROM accounts WHERE is_active = 1';
    const params: any[] = [];
    if (companyId) {
      sql += ' AND company_id = ?';
      params.push(companyId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapAccount(r));
  }

  public async getAccountById(id: string): Promise<Account | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM accounts WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapAccount(rows[0]) : null;
  }

  public async updateAccountBalance(id: string, newBalance: number): Promise<Account> {
    const rounded = round2(newBalance);
    const now = new Date().toISOString();
    await this.pool.query('UPDATE accounts SET current_balance = ?, updated_at = ? WHERE id = ?', [rounded, now, id]);
    const updated = await this.getAccountById(id);
    if (!updated) throw new Error(`Счёт не найден: ${id}`);
    return updated;
  }

  public async adjustAccountBalance(id: string, delta: number): Promise<Account> {
    const existing = await this.getAccountById(id);
    if (!existing) throw new Error(`Счёт не найден: ${id}`);
    const newBal = round2(existing.currentBalance + delta);
    return this.updateAccountBalance(id, newBal);
  }

  public async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const existing = await this.getAccountById(accountInput.id);
    if (!existing) throw new Error(`Счёт не найден: ${accountInput.id}`);
    const now = new Date().toISOString();
    const updated: Account = {
      ...existing,
      ...accountInput,
      updatedAt: now,
    };

    await this.pool.query(`
      UPDATE accounts
      SET name = ?, type = ?, description = ?, initial_balance = ?, current_balance = ?, color = ?, icon = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `, [
      updated.name,
      updated.type,
      updated.description || null,
      updated.initialBalance,
      updated.currentBalance,
      updated.color || null,
      updated.icon || null,
      updated.isActive ? 1 : 0,
      updated.updatedAt,
      updated.id,
    ]);

    return updated;
  }

  public async createAccount(accountInput: Partial<Account> & { name: string }): Promise<Account> {
    const now = new Date().toISOString();
    const initBal = round2(accountInput.initialBalance || 0);
    const acc: Account = {
      id: accountInput.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: accountInput.companyId || DEFAULT_COMPANY_ID,
      name: accountInput.name,
      type: accountInput.type || 'cash',
      initialBalance: initBal,
      currentBalance: initBal,
      currency: 'RUB',
      description: accountInput.description || '',
      color: accountInput.color,
      icon: accountInput.icon,
      isActive: accountInput.isActive ?? true,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO accounts (id, company_id, name, type, description, initial_balance, current_balance, currency, is_active, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      acc.id,
      acc.companyId,
      acc.name,
      acc.type,
      acc.description || null,
      acc.initialBalance,
      acc.currentBalance,
      acc.currency,
      acc.isActive ? 1 : 0,
      acc.color || null,
      acc.icon || null,
      now,
      acc.updatedAt,
    ]);

    return acc;
  }

  public async deleteAccount(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('UPDATE accounts SET is_active = 0 WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // PARTNERS
  // =========================================================================

  public async getPartners(companyId?: string): Promise<Partner[]> {
    let sql = 'SELECT * FROM partners WHERE is_active = 1';
    const params: any[] = [];
    if (companyId) {
      sql += ' AND company_id = ?';
      params.push(companyId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapPartner(r));
  }

  public async getPartnerById(id: string): Promise<Partner | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM partners WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapPartner(rows[0]) : null;
  }

  public async savePartner(partnerInput: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    const now = new Date().toISOString();
    const id = partnerInput.id || `partner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const p: Partner = {
      id,
      companyId: partnerInput.companyId || DEFAULT_COMPANY_ID,
      name: partnerInput.name,
      role: partnerInput.role,
      isActive: partnerInput.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO partners (id, company_id, name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = VALUES(role),
        is_active = VALUES(is_active),
        updated_at = VALUES(updated_at)
    `, [
      p.id,
      p.companyId,
      p.name,
      p.role || null,
      p.isActive ? 1 : 0,
      p.createdAt,
      p.updatedAt,
    ]);

    return p;
  }

  public async deletePartner(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('UPDATE partners SET is_active = 0 WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  public async getEvents(companyId?: string): Promise<CateringEvent[]> {
    let sql = 'SELECT * FROM events';
    const params: any[] = [];
    if (companyId) {
      sql += ' WHERE company_id = ?';
      params.push(companyId);
    }
    sql += ' ORDER BY event_date DESC';
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapEvent(r));
  }

  public async getEventById(id: string): Promise<CateringEvent | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapEvent(rows[0]) : null;
  }

  public async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const now = new Date().toISOString();
    const id = ('id' in eventInput && eventInput.id) || `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ev: CateringEvent = {
      id,
      companyId: eventInput.companyId || DEFAULT_COMPANY_ID,
      title: eventInput.title,
      clientName: eventInput.clientName,
      eventDate: eventInput.eventDate,
      status: eventInput.status || 'planned',
      budget: round2(eventInput.budget || 0),
      contractAmount: round2(eventInput.contractAmount || 0),
      guestCount: eventInput.guestCount || 0,
      location: eventInput.location,
      notes: eventInput.notes,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO events (id, company_id, title, client_name, event_date, status, budget, contract_amount, guest_count, location, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ev.id,
      ev.companyId,
      ev.title,
      ev.clientName || null,
      ev.eventDate,
      ev.status,
      ev.budget,
      ev.contractAmount,
      ev.guestCount,
      ev.location || null,
      ev.notes || null,
      ev.createdAt,
      ev.updatedAt,
    ]);

    return ev;
  }

  public async updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent> {
    const existing = await this.getEventById(id);
    if (!existing) throw new Error(`Мероприятие не найдено: ${id}`);
    const now = new Date().toISOString();
    const updated: CateringEvent = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await this.pool.query(`
      UPDATE events
      SET title = ?, client_name = ?, event_date = ?, status = ?, budget = ?, contract_amount = ?, guest_count = ?, location = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      updated.title,
      updated.clientName || null,
      updated.eventDate,
      updated.status,
      updated.budget,
      updated.contractAmount,
      updated.guestCount,
      updated.location || null,
      updated.notes || null,
      now,
      id,
    ]);

    return updated;
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('DELETE FROM events WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // EVENT PAYMENT MILESTONES
  // =========================================================================

  public async getMilestones(companyId?: string, eventId?: string): Promise<EventPaymentMilestone[]> {
    let sql = 'SELECT * FROM event_payment_milestones WHERE 1=1';
    const params: any[] = [];
    if (companyId) {
      sql += ' AND company_id = ?';
      params.push(companyId);
    }
    if (eventId) {
      sql += ' AND event_id = ?';
      params.push(eventId);
    }
    sql += ' ORDER BY due_date ASC';
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      eventId: r.event_id,
      title: r.title,
      dueDate: r.due_date,
      amount: round2(r.amount),
      status: r.status,
      paidAmount: r.paid_amount ? round2(r.paid_amount) : undefined,
      paidDate: r.paid_date || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public async getMilestoneById(id: string): Promise<EventPaymentMilestone | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM event_payment_milestones WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      eventId: r.event_id,
      title: r.title,
      dueDate: r.due_date,
      amount: round2(r.amount),
      status: r.status,
      paidAmount: r.paid_amount ? round2(r.paid_amount) : undefined,
      paidDate: r.paid_date || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async saveMilestone(mInput: Omit<EventPaymentMilestone, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventPaymentMilestone> {
    const now = new Date().toISOString();
    const id = mInput.id || `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const m: EventPaymentMilestone = {
      id,
      companyId: mInput.companyId || DEFAULT_COMPANY_ID,
      eventId: mInput.eventId,
      title: mInput.title,
      dueDate: mInput.dueDate,
      amount: round2(mInput.amount),
      status: mInput.status || 'pending',
      paidAmount: mInput.paidAmount ? round2(mInput.paidAmount) : undefined,
      paidDate: mInput.paidDate,
      notes: mInput.notes,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO event_payment_milestones (id, company_id, event_id, title, due_date, amount, status, paid_amount, paid_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        due_date = VALUES(due_date),
        amount = VALUES(amount),
        status = VALUES(status),
        paid_amount = VALUES(paid_amount),
        paid_date = VALUES(paid_date),
        notes = VALUES(notes),
        updated_at = VALUES(updated_at)
    `, [
      m.id,
      m.companyId,
      m.eventId,
      m.title,
      m.dueDate,
      m.amount,
      m.status,
      m.paidAmount || null,
      m.paidDate || null,
      m.notes || null,
      m.createdAt,
      m.updatedAt,
    ]);

    return m;
  }

  public async deleteMilestone(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('DELETE FROM event_payment_milestones WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // EVENT BUDGET ITEMS
  // =========================================================================

  public async getBudgetItems(companyId?: string, eventId?: string): Promise<EventBudgetItem[]> {
    let sql = 'SELECT * FROM event_budget_items WHERE 1=1';
    const params: any[] = [];
    if (companyId) {
      sql += ' AND company_id = ?';
      params.push(companyId);
    }
    if (eventId) {
      sql += ' AND event_id = ?';
      params.push(eventId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      eventId: r.event_id,
      categoryId: r.category_id,
      plannedAmount: round2(r.planned_amount),
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public async saveBudgetItem(bInput: Omit<EventBudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventBudgetItem> {
    const now = new Date().toISOString();
    const id = bInput.id || `bgt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const b: EventBudgetItem = {
      id,
      companyId: bInput.companyId || DEFAULT_COMPANY_ID,
      eventId: bInput.eventId,
      categoryId: bInput.categoryId,
      plannedAmount: round2(bInput.plannedAmount),
      notes: bInput.notes,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO event_budget_items (id, company_id, event_id, category_id, planned_amount, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        planned_amount = VALUES(planned_amount),
        notes = VALUES(notes),
        updated_at = VALUES(updated_at)
    `, [
      b.id,
      b.companyId,
      b.eventId,
      b.categoryId,
      b.plannedAmount,
      b.notes || null,
      b.createdAt,
      b.updatedAt,
    ]);

    return b;
  }

  public async deleteBudgetItem(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('DELETE FROM event_budget_items WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // EVENT VENDORS
  // =========================================================================

  public async getVendors(companyId?: string, eventId?: string): Promise<EventVendor[]> {
    let sql = 'SELECT * FROM event_vendors WHERE 1=1';
    const params: any[] = [];
    if (companyId) {
      sql += ' AND company_id = ?';
      params.push(companyId);
    }
    if (eventId) {
      sql += ' AND event_id = ?';
      params.push(eventId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      eventId: r.event_id,
      name: r.name,
      role: r.role,
      phone: r.phone || undefined,
      agreedFee: round2(r.agreed_fee),
      paidAmount: round2(r.paid_amount),
      remainingAmount: round2(r.remaining_amount),
      status: r.status,
      dueDate: r.due_date || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public async getVendorById(id: string): Promise<EventVendor | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM event_vendors WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      eventId: r.event_id,
      name: r.name,
      role: r.role,
      phone: r.phone || undefined,
      agreedFee: round2(r.agreed_fee),
      paidAmount: round2(r.paid_amount),
      remainingAmount: round2(r.remaining_amount),
      status: r.status,
      dueDate: r.due_date || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async saveVendor(vInput: Omit<EventVendor, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventVendor> {
    const now = new Date().toISOString();
    const id = vInput.id || `vnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const agreedFee = round2(vInput.agreedFee);
    const paidAmount = round2(vInput.paidAmount || 0);
    const remainingAmount = round2(vInput.remainingAmount !== undefined ? vInput.remainingAmount : Math.max(0, agreedFee - paidAmount));
    const status = vInput.status || (paidAmount >= agreedFee && agreedFee > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending');

    const v: EventVendor = {
      id,
      companyId: vInput.companyId || DEFAULT_COMPANY_ID,
      eventId: vInput.eventId,
      name: vInput.name,
      role: vInput.role,
      phone: vInput.phone,
      agreedFee,
      paidAmount,
      remainingAmount,
      status,
      dueDate: vInput.dueDate,
      notes: vInput.notes,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO event_vendors (id, company_id, event_id, name, role, phone, agreed_fee, paid_amount, remaining_amount, status, due_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = VALUES(role),
        phone = VALUES(phone),
        agreed_fee = VALUES(agreed_fee),
        paid_amount = VALUES(paid_amount),
        remaining_amount = VALUES(remaining_amount),
        status = VALUES(status),
        due_date = VALUES(due_date),
        notes = VALUES(notes),
        updated_at = VALUES(updated_at)
    `, [
      v.id,
      v.companyId,
      v.eventId,
      v.name,
      v.role,
      v.phone || null,
      v.agreedFee,
      v.paidAmount,
      v.remainingAmount,
      v.status,
      v.dueDate || null,
      v.notes || null,
      v.createdAt,
      v.updatedAt,
    ]);

    return v;
  }

  public async deleteVendor(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('DELETE FROM event_vendors WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  public async getCategories(companyId?: string): Promise<Category[]> {
    let sql = 'SELECT * FROM categories';
    const params: any[] = [];
    if (companyId) {
      sql += ' WHERE company_id = ? OR is_system = 1 OR company_id IS NULL';
      params.push(companyId);
    }
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapCategory(r));
  }

  public async getCategoryById(id: string): Promise<Category | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM categories WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapCategory(rows[0]) : null;
  }

  public async saveCategory(catInput: Partial<Category> & { id: string }): Promise<Category> {
    const now = new Date().toISOString();
    const existing = await this.getCategoryById(catInput.id);
    const cat: Category = {
      id: catInput.id,
      companyId: catInput.companyId || existing?.companyId || DEFAULT_COMPANY_ID,
      name: catInput.name || existing?.name || catInput.id,
      type: catInput.type || existing?.type || 'expense',
      direction: catInput.direction || existing?.direction,
      color: catInput.color || existing?.color || '#6366f1',
      icon: catInput.icon || existing?.icon,
      isEventSpecific: catInput.isEventSpecific ?? existing?.isEventSpecific ?? true,
      isSystem: catInput.isSystem ?? existing?.isSystem ?? false,
    };

    await this.pool.query(`
      INSERT INTO categories (id, company_id, name, type, direction, color, icon, is_event_specific, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      cat.companyId,
      cat.name,
      cat.type,
      cat.direction || null,
      cat.color || null,
      cat.icon || null,
      cat.isEventSpecific ? 1 : 0,
      cat.isSystem ? 1 : 0,
      now,
    ]);

    return cat;
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const [res]: any = await this.pool.query('DELETE FROM categories WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================

  public async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (!filter?.includeDeleted) {
      sql += ' AND is_deleted = 0';
    }
    if (filter?.companyId) {
      sql += ' AND company_id = ?';
      params.push(filter.companyId);
    }
    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.categoryId) {
      sql += ' AND category_id = ?';
      params.push(filter.categoryId);
    }
    if (filter?.partnerId) {
      sql += ' AND partner_id = ?';
      params.push(filter.partnerId);
    }
    if (filter?.direction) {
      sql += ' AND direction = ?';
      params.push(filter.direction);
    }
    if (filter?.startDate) {
      sql += ' AND transaction_date >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      sql += ' AND transaction_date <= ?';
      params.push(filter.endDate);
    }
    if (filter?.accountId) {
      sql += ' AND (from_account_id = ? OR to_account_id = ?)';
      params.push(filter.accountId, filter.accountId);
    }
    if (filter && filter.eventId !== undefined) {
      if (filter.eventId === null) {
        sql += ' AND event_id IS NULL';
      } else {
        sql += ' AND event_id = ?';
        params.push(filter.eventId);
      }
    }

    sql += ' ORDER BY transaction_date DESC, id DESC';
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows || []).map((r: any) => this.mapTransaction(r));
  }

  public async getTransactionById(id: string): Promise<Transaction | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM transactions WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? this.mapTransaction(rows[0]) : null;
  }

  public async createTransaction(txInput: NewTransactionInput): Promise<Transaction> {
    const now = new Date().toISOString();
    const txId = ('id' in txInput && txInput.id) || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tx: Transaction = {
      id: txId,
      companyId: (txInput as any).companyId || DEFAULT_COMPANY_ID,
      type: txInput.type,
      direction: (txInput as any).direction,
      amount: round2(txInput.amount),
      fromAccountId: txInput.fromAccountId,
      toAccountId: txInput.toAccountId,
      categoryId: txInput.categoryId || 'overhead',
      eventId: txInput.eventId ?? null,
      partnerId: (txInput as any).partnerId,
      partnerName: (txInput as any).partnerName,
      vendorId: (txInput as any).vendorId,
      vendorName: (txInput as any).vendorName,
      description: txInput.description || '',
      transactionDate: txInput.transactionDate || now,
      isDeleted: false,
      needsReview: (txInput as any).needsReview ?? false,
      createdBy: (txInput as any).createdBy,
      updatedBy: (txInput as any).updatedBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(`
      INSERT INTO transactions (id, company_id, type, direction, amount, from_account_id, to_account_id, category_id, event_id, partner_id, partner_name, description, transaction_date, is_deleted, needs_review, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tx.id,
      tx.companyId,
      tx.type,
      tx.direction || null,
      tx.amount,
      tx.fromAccountId || null,
      tx.toAccountId || null,
      tx.categoryId,
      tx.eventId || null,
      tx.partnerId || null,
      tx.partnerName || null,
      tx.description || '',
      tx.transactionDate,
      0,
      tx.needsReview ? 1 : 0,
      typeof tx.createdBy === 'object' ? (tx.createdBy as any).id : tx.createdBy || null,
      tx.createdAt,
      tx.updatedAt,
    ]);

    return tx;
  }

  public async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const existing = await this.getTransactionById(id);
    if (!existing) throw new Error(`Транзакция не найдена: ${id}`);
    const now = new Date().toISOString();
    const updated: Transaction = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await this.pool.query(`
      UPDATE transactions
      SET type = ?, direction = ?, amount = ?, from_account_id = ?, to_account_id = ?, category_id = ?, event_id = ?, partner_id = ?, partner_name = ?, description = ?, transaction_date = ?, is_deleted = ?, needs_review = ?, updated_at = ?
      WHERE id = ?
    `, [
      updated.type,
      updated.direction || null,
      updated.amount,
      updated.fromAccountId || null,
      updated.toAccountId || null,
      updated.categoryId,
      updated.eventId || null,
      updated.partnerId || null,
      updated.partnerName || null,
      updated.description || '',
      updated.transactionDate,
      updated.isDeleted ? 1 : 0,
      updated.needsReview ? 1 : 0,
      now,
      id,
    ]);

    return updated;
  }

  public async softDeleteTransaction(id: string): Promise<Transaction> {
    const existing = await this.getTransactionById(id);
    if (!existing) throw new Error(`Транзакция не найдена: ${id}`);
    const now = new Date().toISOString();
    await this.pool.query('UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, id]);
    return { ...existing, isDeleted: true, updatedAt: now };
  }

  // =========================================================================
  // STATE MAINTENANCE
  // =========================================================================

  public async resetToSeed(): Promise<void> {
    const seed = createInitialDatabaseState();
    await this.importState(seed);
  }

  public async importState(state: Partial<DatabaseState>): Promise<void> {
    if (state.companies) {
      for (const c of state.companies) await this.createCompany(c);
    }
    if (state.users) {
      for (const u of state.users) await this.saveUserProfile(u);
    }
    if (state.accounts) {
      for (const a of state.accounts) {
        const existing = await this.getAccountById(a.id);
        if (existing) await this.saveAccount(a);
        else await this.createAccount(a);
      }
    }
    if (state.categories) {
      for (const cat of state.categories) await this.saveCategory(cat);
    }
    if (state.events) {
      for (const ev of state.events) {
        const existing = await this.getEventById(ev.id);
        if (existing) await this.updateEvent(ev.id, ev);
        else await this.createEvent(ev);
      }
    }
    if (state.partners) {
      for (const p of state.partners) await this.savePartner(p);
    }
    if (state.transactions) {
      for (const tx of state.transactions) {
        const existing = await this.getTransactionById(tx.id);
        if (existing) await this.updateTransaction(tx.id, tx);
        else await this.createTransaction(tx);
      }
    }
  }

  // =========================================================================
  // MAPPERS
  // =========================================================================

  private mapCompany(r: any): Company {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan || 'pro',
      trialEndsAt: r.trial_ends_at || undefined,
      paidUntil: r.paid_until || null,
      isActive: Boolean(r.is_active),
      ownerId: r.owner_id || undefined,
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
    };
  }

  private mapUser(r: any): UserProfile {
    return {
      id: r.id,
      email: r.email,
      fullName: r.full_name || r.email.split('@')[0],
      avatarUrl: r.avatar_url || undefined,
      isSuperAdmin: Boolean(r.is_super_admin),
      isEmailVerified: Boolean(r.is_email_verified),
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
    };
  }

  private mapInvite(r: any): CompanyInvite {
    return {
      id: r.id,
      token: r.token,
      companyId: r.company_id,
      role: r.role as UserRole,
      email: r.email || undefined,
      fullName: r.full_name || undefined,
      invitedBy: r.invited_by || undefined,
      createdAt: r.created_at || new Date().toISOString(),
      expiresAt: r.expires_at || undefined,
      usedCount: Number(r.used_count) || 0,
      maxUses: r.max_uses ? Number(r.max_uses) : undefined,
      status: r.status || 'active',
    };
  }

  private mapAccount(r: any): Account {
    return {
      id: r.id,
      companyId: r.company_id || DEFAULT_COMPANY_ID,
      name: r.name,
      type: r.type,
      description: r.description || '',
      initialBalance: round2(r.initial_balance),
      currentBalance: round2(r.current_balance),
      currency: r.currency || 'RUB',
      isActive: Boolean(r.is_active),
      color: r.color || undefined,
      icon: r.icon || undefined,
      updatedAt: r.updated_at || new Date().toISOString(),
    };
  }

  private mapPartner(r: any): Partner {
    return {
      id: r.id,
      companyId: r.company_id || DEFAULT_COMPANY_ID,
      name: r.name,
      role: r.role || undefined,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapEvent(r: any): CateringEvent {
    return {
      id: r.id,
      companyId: r.company_id || DEFAULT_COMPANY_ID,
      title: r.title,
      clientName: r.client_name || undefined,
      eventDate: r.event_date || '',
      status: r.status || 'planned',
      budget: round2(r.budget),
      contractAmount: round2(r.contract_amount),
      guestCount: Number(r.guest_count) || 0,
      location: r.location || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapCategory(r: any): Category {
    return {
      id: r.id,
      companyId: r.company_id || DEFAULT_COMPANY_ID,
      name: r.name,
      type: r.type,
      direction: r.direction || undefined,
      color: r.color || '#6366f1',
      icon: r.icon || undefined,
      isEventSpecific: Boolean(r.is_event_specific),
      isSystem: Boolean(r.is_system),
    };
  }

  private mapTransaction(r: any): Transaction {
    return {
      id: r.id,
      companyId: r.company_id || DEFAULT_COMPANY_ID,
      type: r.type,
      direction: r.direction || undefined,
      amount: round2(r.amount),
      fromAccountId: r.from_account_id || undefined,
      toAccountId: r.to_account_id || undefined,
      categoryId: r.category_id || 'overhead',
      eventId: r.event_id || null,
      partnerId: r.partner_id || undefined,
      partnerName: r.partner_name || undefined,
      description: r.description || '',
      transactionDate: r.transaction_date || r.created_at,
      isDeleted: Boolean(r.is_deleted),
      needsReview: Boolean(r.needs_review),
      createdBy: r.created_by || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
