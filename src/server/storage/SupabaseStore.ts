/**
 * Truespace — Барный кейтеринг и финансы
 * Supabase Storage Implementation (`src/server/storage/SupabaseStore.ts`)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  UserRole,
} from '../../shared/types.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import { createInitialDatabaseState, DatabaseState } from '../data/seed.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

const round2 = (n: number | string | undefined | null): number => Math.round((Number(n) || 0) * 100) / 100;

export class SupabaseStore implements IFinanceStore {
  private client: SupabaseClient;

  constructor(supabaseUrl?: string, supabaseKey?: string, customClient?: SupabaseClient) {
    if (customClient) {
      this.client = customClient;
      return;
    }
    const url = supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key =
      supabaseKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';
    if (!url || !key) {
      throw new Error('Supabase URL и ключ обязательны для инициализации SupabaseStore');
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  private mapCompany(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan || 'free',
      trialEndsAt: row.trial_ends_at || undefined,
      paidUntil: row.paid_until || undefined,
      isActive: row.is_active ?? true,
      ownerId: row.owner_id || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private mapUser(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name || row.email?.split('@')[0] || '',
      avatarUrl: row.avatar_url || undefined,
      isSuperAdmin: Boolean(row.is_super_admin),
      isEmailVerified: Boolean(row.is_email_verified),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private mapAccount(row: any): Account {
    return {
      id: row.id,
      companyId: row.company_id || DEFAULT_COMPANY_ID,
      name: row.name,
      type: row.type,
      initialBalance: round2(row.initial_balance),
      currentBalance: round2(row.current_balance),
      currency: 'RUB',
      description: row.description || '',
      color: row.color || undefined,
      icon: row.icon || undefined,
      isActive: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private mapPartner(row: any): Partner {
    return {
      id: row.id,
      companyId: row.company_id || DEFAULT_COMPANY_ID,
      name: row.name,
      role: row.role || undefined,
      isActive: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private mapEvent(row: any): CateringEvent {
    return {
      id: row.id,
      companyId: row.company_id || DEFAULT_COMPANY_ID,
      title: row.title,
      clientName: row.client_name || undefined,
      eventDate: row.event_date,
      status: row.status || 'planned',
      budget: row.budget != null ? round2(row.budget) : undefined,
      contractAmount: row.contract_amount != null ? round2(row.contract_amount) : undefined,
      guestCount: row.guest_count != null ? Number(row.guest_count) : undefined,
      location: row.location || undefined,
      notes: row.notes || undefined,
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private mapCategory(row: any): Category {
    return {
      id: row.id,
      companyId: row.company_id || DEFAULT_COMPANY_ID,
      name: row.name,
      type: row.type,
      direction: row.direction || undefined,
      color: row.color || undefined,
      icon: row.icon || undefined,
      isEventSpecific: row.is_event_specific ?? true,
      isSystem: row.is_system ?? false,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  private mapTransaction(row: any): Transaction {
    return {
      id: row.id,
      companyId: row.company_id || DEFAULT_COMPANY_ID,
      type: row.type,
      direction: row.direction || undefined,
      amount: round2(row.amount),
      fromAccountId: row.from_account_id ?? null,
      toAccountId: row.to_account_id ?? null,
      categoryId: row.category_id,
      eventId: row.event_id ?? null,
      partnerId: row.partner_id ?? null,
      partnerName: row.partner_name ?? null,
      description: row.description || '',
      transactionDate: row.transaction_date,
      isDeleted: Boolean(row.is_deleted),
      needsReview: Boolean(row.needs_review),
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  // =========================================================================
  // COMPANIES
  // =========================================================================

  public async getCompanies(): Promise<Company[]> {
    const { data, error } = await this.client.from('companies').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map((r) => this.mapCompany(r));
  }

  public async getCompanyById(id: string): Promise<Company | null> {
    const { data, error } = await this.client.from('companies').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapCompany(data) : null;
  }

  public async createCompany(companyInput: Partial<Company> & { name: string }): Promise<Company> {
    const now = new Date().toISOString();
    const row = {
      id: companyInput.id || `company_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: companyInput.name.trim(),
      slug: companyInput.slug || companyInput.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      plan: companyInput.plan || 'free',
      trial_ends_at: companyInput.trialEndsAt ?? null,
      paid_until: companyInput.paidUntil ?? null,
      is_active: companyInput.isActive ?? true,
      owner_id: companyInput.ownerId ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client.from('companies').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapCompany(data || row);
  }

  public async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.slug !== undefined) payload.slug = updates.slug;
    if (updates.plan !== undefined) payload.plan = updates.plan;
    if (updates.trialEndsAt !== undefined) payload.trial_ends_at = updates.trialEndsAt;
    if (updates.paidUntil !== undefined) payload.paid_until = updates.paidUntil;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.ownerId !== undefined) payload.owner_id = updates.ownerId;

    const { data, error } = await this.client
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Компания не найдена: ${id}`);
    return this.mapCompany(data);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    const existing = await this.getCompanyById(id);
    if (!existing) return false;
    const { error } = await this.client.from('companies').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // =========================================================================
  // USERS & MEMBERSHIPS
  // =========================================================================

  public async getUsers(): Promise<UserProfile[]> {
    const { data, error } = await this.client.from('user_profiles').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map((r) => this.mapUser(r));
  }

  public async getUserById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.client.from('user_profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapUser(data) : null;
  }

  public async saveUserProfile(userInput: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const now = new Date().toISOString();
    const row = {
      id: userInput.id,
      email: userInput.email,
      full_name: userInput.fullName || userInput.email.split('@')[0],
      avatar_url: userInput.avatarUrl ?? null,
      is_super_admin: userInput.isSuperAdmin ?? false,
      is_email_verified: userInput.isEmailVerified ?? false,
      updated_at: now,
    };
    const { data, error } = await this.client.from('user_profiles').upsert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapUser(data || row);
  }

  public async getCompanyMembers(companyId: string): Promise<{ membership: CompanyMembership; user?: UserProfile }[]> {
    const { data: memRows, error } = await this.client
      .from('company_members')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw new Error(error.message);
    const users = await this.getUsers();
    return (memRows || []).map((m: any) => ({
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
    const row = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      company_id: dataInput.companyId,
      user_id: dataInput.userId,
      role: dataInput.role,
      invited_by: dataInput.invitedBy ?? null,
      created_at: now,
    };
    const { data, error } = await this.client.from('company_members').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    const r = data || row;
    return {
      id: r.id,
      companyId: r.company_id,
      userId: r.user_id,
      role: r.role as UserRole,
      invitedBy: r.invited_by || undefined,
      createdAt: r.created_at || now,
    };
  }

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  public async getAccounts(companyId?: string): Promise<Account[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    const { data, error } = await this.client.from('accounts').select('*').eq('company_id', target);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => this.mapAccount(r));
  }

  public async getAccountById(id: string): Promise<Account | null> {
    const { data, error } = await this.client.from('accounts').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapAccount(data) : null;
  }

  public async updateAccountBalance(id: string, newBalance: number): Promise<Account> {
    const rounded = round2(newBalance);
    const { data, error } = await this.client
      .from('accounts')
      .update({ current_balance: rounded, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Счёт не найден: ${id}`);
    return this.mapAccount(data);
  }

  public async adjustAccountBalance(id: string, delta: number): Promise<Account> {
    const roundedDelta = round2(delta);
    const rpcResult = await this.client.rpc('truespace_adjust_account_balance', {
      p_account_id: id,
      p_delta: roundedDelta,
    });
    if (!rpcResult.error && rpcResult.data !== null && rpcResult.data !== undefined) {
      const updated = await this.getAccountById(id);
      if (!updated) throw new Error(`Счёт не найден: ${id}`);
      return updated;
    }
    const existing = await this.getAccountById(id);
    if (!existing) throw new Error(`Счёт не найден: ${id}`);
    return this.updateAccountBalance(id, round2(existing.currentBalance + roundedDelta));
  }

  public async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (accountInput.name !== undefined) payload.name = accountInput.name;
    if (accountInput.type !== undefined) payload.type = accountInput.type;
    if (accountInput.description !== undefined) payload.description = accountInput.description;
    if (accountInput.isActive !== undefined) payload.is_active = accountInput.isActive;
    if (accountInput.color !== undefined) payload.color = accountInput.color;
    if (accountInput.icon !== undefined) payload.icon = accountInput.icon;
    if (accountInput.currentBalance !== undefined) payload.current_balance = round2(accountInput.currentBalance);
    if (accountInput.initialBalance !== undefined) payload.initial_balance = round2(accountInput.initialBalance);

    const { data, error } = await this.client
      .from('accounts')
      .update(payload)
      .eq('id', accountInput.id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Счёт не найден: ${accountInput.id}`);
    return this.mapAccount(data);
  }

  public async createAccount(accountInput: Partial<Account> & { name: string }): Promise<Account> {
    const now = new Date().toISOString();
    const initBal = round2(accountInput.initialBalance || 0);
    const row = {
      id: accountInput.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      company_id: accountInput.companyId || DEFAULT_COMPANY_ID,
      name: accountInput.name,
      type: accountInput.type || 'cash',
      initial_balance: initBal,
      current_balance: initBal,
      currency: 'RUB',
      description: accountInput.description || '',
      color: accountInput.color ?? null,
      icon: accountInput.icon ?? null,
      is_active: accountInput.isActive ?? true,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client.from('accounts').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapAccount(data || row);
  }

  public async deleteAccount(id: string): Promise<boolean> {
    const existing = await this.getAccountById(id);
    if (!existing) return false;
    const { error } = await this.client.from('accounts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // =========================================================================
  // PARTNERS
  // =========================================================================

  public async getPartners(companyId?: string): Promise<Partner[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    const { data, error } = await this.client.from('partners').select('*').eq('company_id', target);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => this.mapPartner(r));
  }

  public async getPartnerById(id: string): Promise<Partner | null> {
    const { data, error } = await this.client.from('partners').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapPartner(data) : null;
  }

  public async savePartner(partnerInput: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    const now = new Date().toISOString();
    const row = {
      id: partnerInput.id || `partner_${Date.now()}`,
      company_id: partnerInput.companyId || DEFAULT_COMPANY_ID,
      name: partnerInput.name,
      role: partnerInput.role ?? null,
      is_active: partnerInput.isActive ?? true,
      updated_at: now,
    };
    const { data, error } = await this.client.from('partners').upsert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapPartner(data || row);
  }

  public async deletePartner(id: string): Promise<boolean> {
    const existing = await this.getPartnerById(id);
    if (!existing) return false;
    const { error } = await this.client.from('partners').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  public async getEvents(companyId?: string): Promise<CateringEvent[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    const { data, error } = await this.client.from('events').select('*').eq('company_id', target);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => this.mapEvent(r));
  }

  public async getEventById(id: string): Promise<CateringEvent | null> {
    const { data, error } = await this.client.from('events').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapEvent(data) : null;
  }

  public async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const now = new Date().toISOString();
    const eventId =
      'id' in eventInput && eventInput.id
        ? eventInput.id
        : `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const row = {
      id: eventId,
      company_id: (eventInput as any).companyId || DEFAULT_COMPANY_ID,
      title: eventInput.title,
      client_name: eventInput.clientName ?? null,
      event_date: eventInput.eventDate,
      status: eventInput.status || 'planned',
      budget: eventInput.budget != null ? round2(eventInput.budget) : 0,
      contract_amount: eventInput.contractAmount != null ? round2(eventInput.contractAmount) : 0,
      guest_count: eventInput.guestCount ?? 0,
      location: eventInput.location ?? null,
      notes: eventInput.notes ?? null,
      created_by: (eventInput as any).createdBy ?? null,
      updated_by: (eventInput as any).updatedBy ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client.from('events').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapEvent(data || row);
  }

  public async updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.clientName !== undefined) payload.client_name = updates.clientName;
    if (updates.eventDate !== undefined) payload.event_date = updates.eventDate;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.budget !== undefined) payload.budget = round2(updates.budget);
    if (updates.contractAmount !== undefined) payload.contract_amount = round2(updates.contractAmount);
    if (updates.guestCount !== undefined) payload.guest_count = updates.guestCount;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.updatedBy !== undefined) payload.updated_by = updates.updatedBy;

    const { data, error } = await this.client
      .from('events')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Мероприятие с id "${id}" не найдено`);
    return this.mapEvent(data);
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const existing = await this.getEventById(id);
    if (!existing) return false;
    const { error } = await this.client.from('events').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  public async getCategories(companyId?: string): Promise<Category[]> {
    const { data, error } = await this.client.from('categories').select('*');
    if (error) throw new Error(error.message);
    const all = (data || []).map((r) => this.mapCategory(r));
    if (companyId) {
      return all.filter((c) => !c.companyId || c.companyId === companyId || c.isSystem);
    }
    return all;
  }

  public async getCategoryById(id: string): Promise<Category | null> {
    const { data, error } = await this.client.from('categories').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapCategory(data) : null;
  }

  public async saveCategory(catInput: Partial<Category> & { id: string }): Promise<Category> {
    const existing = await this.getCategoryById(catInput.id);
    const row = {
      id: catInput.id,
      company_id: catInput.companyId || existing?.companyId || DEFAULT_COMPANY_ID,
      name: catInput.name || existing?.name || 'Статья',
      type: catInput.type || existing?.type || 'expense',
      direction: catInput.direction || existing?.direction || 'operational',
      color: catInput.color || existing?.color || '#64748b',
      icon: catInput.icon || existing?.icon || null,
      is_event_specific: catInput.isEventSpecific ?? existing?.isEventSpecific ?? true,
      is_system: catInput.isSystem ?? existing?.isSystem ?? false,
    };
    const { data, error } = await this.client.from('categories').upsert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapCategory(data || row);
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const existing = await this.getCategoryById(id);
    if (!existing) return false;
    const { error } = await this.client.from('categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================

  public async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let query = this.client.from('transactions').select('*');
    if (!filter?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    if (filter?.companyId) {
      query = query.eq('company_id', filter.companyId);
    }
    if (filter?.type) {
      query = query.eq('type', filter.type);
    }
    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }
    if (filter?.partnerId) {
      query = query.eq('partner_id', filter.partnerId);
    }
    if (filter?.direction) {
      query = query.eq('direction', filter.direction);
    }
    if (filter?.startDate) {
      query = query.gte('transaction_date', filter.startDate);
    }
    if (filter?.endDate) {
      query = query.lte('transaction_date', filter.endDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = (data || []).map((r) => this.mapTransaction(r));
    if (filter?.accountId) {
      result = result.filter(
        (tx) => tx.fromAccountId === filter.accountId || tx.toAccountId === filter.accountId
      );
    }
    if (filter && filter.eventId !== undefined) {
      result = result.filter((tx) => tx.eventId === filter.eventId);
    }

    return result.sort((a, b) => {
      const timeDiff = Date.parse(b.transactionDate) - Date.parse(a.transactionDate);
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });
  }

  public async getTransactionById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.client.from('transactions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapTransaction(data) : null;
  }

  public async createTransaction(txInput: NewTransactionInput): Promise<Transaction> {
    const now = new Date().toISOString();
    const txId =
      'id' in txInput && txInput.id
        ? txInput.id
        : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const row = {
      id: txId,
      company_id: (txInput as any).companyId || DEFAULT_COMPANY_ID,
      type: txInput.type,
      direction: (txInput as any).direction ?? null,
      amount: round2(txInput.amount),
      from_account_id: txInput.fromAccountId ?? null,
      to_account_id: txInput.toAccountId ?? null,
      category_id: txInput.categoryId || 'cat_other_expense',
      event_id: txInput.eventId ?? null,
      partner_id: (txInput as any).partnerId ?? null,
      partner_name: (txInput as any).partnerName ?? null,
      description: txInput.description ?? '',
      transaction_date: txInput.transactionDate || now,
      is_deleted: false,
      needs_review: (txInput as any).needsReview ?? false,
      created_by: (txInput as any).createdBy ?? null,
      updated_by: (txInput as any).updatedBy ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client.from('transactions').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return this.mapTransaction(data || row);
  }

  public async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.direction !== undefined) payload.direction = updates.direction;
    if (updates.amount !== undefined) payload.amount = round2(updates.amount);
    if (updates.fromAccountId !== undefined) payload.from_account_id = updates.fromAccountId;
    if (updates.toAccountId !== undefined) payload.to_account_id = updates.toAccountId;
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
    if (updates.eventId !== undefined) payload.event_id = updates.eventId;
    if (updates.partnerId !== undefined) payload.partner_id = updates.partnerId;
    if (updates.partnerName !== undefined) payload.partner_name = updates.partnerName;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.transactionDate !== undefined) payload.transaction_date = updates.transactionDate;
    if (updates.needsReview !== undefined) payload.needs_review = updates.needsReview;
    if (updates.updatedBy !== undefined) payload.updated_by = updates.updatedBy;
    if (updates.isDeleted !== undefined) payload.is_deleted = updates.isDeleted;

    const { data, error } = await this.client
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Транзакция с ID ${id} не найдена`);
    return this.mapTransaction(data);
  }

  public async softDeleteTransaction(id: string): Promise<Transaction> {
    const { data, error } = await this.client
      .from('transactions')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Транзакция не найдена: ${id}`);
    return this.mapTransaction(data);
  }

  // =========================================================================
  // STATE MAINTENANCE
  // =========================================================================

  public async resetToSeed(): Promise<void> {
    const seed = createInitialDatabaseState();
    await this.importState(seed);
  }

  public async importState(state: Partial<DatabaseState>): Promise<void> {
    if (state.companies?.length) {
      await this.client.from('companies').upsert(
        state.companies.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          plan: c.plan || 'free',
          trial_ends_at: c.trialEndsAt ?? null,
          paid_until: c.paidUntil ?? null,
          is_active: c.isActive ?? true,
          owner_id: c.ownerId ?? null,
        }))
      );
    }
    if (state.users?.length) {
      await this.client.from('user_profiles').upsert(
        state.users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.fullName ?? null,
          avatar_url: u.avatarUrl ?? null,
          is_super_admin: u.isSuperAdmin ?? false,
          is_email_verified: u.isEmailVerified ?? false,
        }))
      );
    }
    if (state.memberships?.length) {
      await this.client.from('company_members').upsert(
        state.memberships.map((m) => ({
          id: m.id,
          company_id: m.companyId,
          user_id: m.userId,
          role: m.role,
          invited_by: m.invitedBy ?? null,
        }))
      );
    }
    if (state.accounts?.length) {
      await this.client.from('accounts').upsert(
        state.accounts.map((a) => ({
          id: a.id,
          company_id: a.companyId || DEFAULT_COMPANY_ID,
          name: a.name,
          type: a.type,
          initial_balance: round2(a.initialBalance),
          current_balance: round2(a.currentBalance),
          currency: a.currency || 'RUB',
          description: a.description || '',
          color: a.color ?? null,
          icon: a.icon ?? null,
          is_active: a.isActive ?? true,
        }))
      );
    }
    if (state.partners?.length) {
      await this.client.from('partners').upsert(
        state.partners.map((p) => ({
          id: p.id,
          company_id: p.companyId || DEFAULT_COMPANY_ID,
          name: p.name,
          role: p.role ?? null,
          is_active: p.isActive ?? true,
        }))
      );
    }
    if (state.categories?.length) {
      await this.client.from('categories').upsert(
        state.categories.map((c) => ({
          id: c.id,
          company_id: c.companyId || DEFAULT_COMPANY_ID,
          name: c.name,
          type: c.type,
          direction: c.direction || 'operational',
          color: c.color || '#64748b',
          icon: c.icon ?? null,
          is_event_specific: c.isEventSpecific ?? true,
          is_system: c.isSystem ?? false,
        }))
      );
    }
    if (state.events?.length) {
      await this.client.from('events').upsert(
        state.events.map((e) => ({
          id: e.id,
          company_id: e.companyId || DEFAULT_COMPANY_ID,
          title: e.title,
          client_name: e.clientName ?? null,
          event_date: e.eventDate,
          status: e.status || 'planned',
          budget: round2(e.budget || 0),
          contract_amount: round2(e.contractAmount || 0),
          guest_count: e.guestCount ?? 0,
          location: e.location ?? null,
          notes: e.notes ?? null,
        }))
      );
    }
    if (state.transactions?.length) {
      await this.client.from('transactions').upsert(
        state.transactions.map((t) => ({
          id: t.id,
          company_id: t.companyId || DEFAULT_COMPANY_ID,
          type: t.type,
          direction: t.direction ?? null,
          amount: round2(t.amount),
          from_account_id: t.fromAccountId ?? null,
          to_account_id: t.toAccountId ?? null,
          category_id: t.categoryId,
          event_id: t.eventId ?? null,
          partner_id: t.partnerId ?? null,
          partner_name: t.partnerName ?? null,
          description: t.description ?? '',
          transaction_date: t.transactionDate,
          is_deleted: t.isDeleted ?? false,
          needs_review: t.needsReview ?? false,
        }))
      );
    }
  }
}
