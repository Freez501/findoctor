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
  CompanyInvite,
  UserRole,
  EventPaymentMilestone,
  EventBudgetItem,
  EventVendor,
} from '../../shared/types.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import { createInitialDatabaseState, DatabaseState } from '../data/seed.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

const round2 = (n: number | string | undefined | null): number => Math.round((Number(n) || 0) * 100) / 100;

export class SupabaseStore implements IFinanceStore {
  private client: SupabaseClient;
  private fallbackMilestones: EventPaymentMilestone[] = [];
  private fallbackBudgetItems: EventBudgetItem[] = [];
  private fallbackVendors: EventVendor[] = [];
  private fallbackInvites: CompanyInvite[] = [];

  private isResilientFallbackNeeded(error: any): boolean {
    if (!error) return false;
    const msg = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '');
    return (
      code === 'PGRST205' ||
      code === '42P01' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      msg.includes('could not find the table') ||
      msg.includes('relation') ||
      msg.includes('does not exist') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('abort')
    );
  }

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
      taxSystem: row.tax_system || (row as any).taxSystem || undefined,
      taxRate: row.tax_rate !== null && row.tax_rate !== undefined ? Number(row.tax_rate) : (row as any).taxRate !== undefined ? Number((row as any).taxRate) : undefined,
      taxSettings: row.tax_settings ? (typeof row.tax_settings === 'string' ? JSON.parse(row.tax_settings) : row.tax_settings) : (row as any).taxSettings || undefined,
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
      isTaxable: row.is_taxable !== null && row.is_taxable !== undefined ? Boolean(row.is_taxable) : (row as any).isTaxable !== undefined ? Boolean((row as any).isTaxable) : true,
      taxSystem: row.tax_system || (row as any).taxSystem || undefined,
      taxRate: row.tax_rate !== null && row.tax_rate !== undefined ? Number(row.tax_rate) : (row as any).taxRate !== undefined ? Number((row as any).taxRate) : undefined,
      legalEntity: row.legal_entity || (row as any).legalEntity || undefined,
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
      vendorId: row.vendor_id ?? null,
      vendorName: row.vendor_name ?? null,
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
    if (updates.taxSystem !== undefined) payload.tax_system = updates.taxSystem;
    if (updates.taxRate !== undefined) payload.tax_rate = updates.taxRate;
    if (updates.taxSettings !== undefined) payload.tax_settings = typeof updates.taxSettings === 'object' ? JSON.stringify(updates.taxSettings) : updates.taxSettings;

    let { data, error } = await this.client
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error && (error.message?.includes('tax_system') || error.message?.includes('tax_rate') || error.message?.includes('tax_settings') || error.message?.includes('schema cache'))) {
      delete payload.tax_system;
      delete payload.tax_rate;
      delete payload.tax_settings;
      const retry = await this.client
        .from('companies')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Компания не найдена: ${id}`);
    if (updates.taxSystem !== undefined) (data as any).taxSystem = updates.taxSystem;
    if (updates.taxRate !== undefined) (data as any).taxRate = updates.taxRate;
    if (updates.taxSettings !== undefined) (data as any).taxSettings = updates.taxSettings;
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
  // COMPANY INVITES (LINKS & QR)
  // =========================================================================

  public async getCompanyInvites(companyId?: string): Promise<CompanyInvite[]> {
    try {
      let query = this.client.from('company_invites').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error && this.isResilientFallbackNeeded(error)) {
        return this.fallbackInvites.filter((i) => !companyId || i.companyId === companyId);
      }
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        token: row.token,
        companyId: row.company_id,
        role: row.role,
        email: row.email,
        fullName: row.full_name,
        invitedBy: row.invited_by,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        usedCount: Number(row.used_count) || 0,
        maxUses: row.max_uses ? Number(row.max_uses) : undefined,
        status: row.status || 'active',
      }));
    } catch {
      return this.fallbackInvites.filter((i) => !companyId || i.companyId === companyId);
    }
  }

  public async getInviteByToken(token: string): Promise<CompanyInvite | null> {
    try {
      const { data, error } = await this.client.from('company_invites').select('*').eq('token', token).maybeSingle();
      if (error && this.isResilientFallbackNeeded(error)) {
        return this.fallbackInvites.find((i) => i.token === token) || null;
      }
      if (error || !data) {
        return this.fallbackInvites.find((i) => i.token === token) || null;
      }
      return {
        id: data.id,
        token: data.token,
        companyId: data.company_id,
        role: data.role,
        email: data.email,
        fullName: data.full_name,
        invitedBy: data.invited_by,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        usedCount: Number(data.used_count) || 0,
        maxUses: data.max_uses ? Number(data.max_uses) : undefined,
        status: data.status || 'active',
      };
    } catch {
      return this.fallbackInvites.find((i) => i.token === token) || null;
    }
  }

  public async createCompanyInvite(inviteInput: Partial<CompanyInvite> & { companyId: string; role: UserRole }): Promise<CompanyInvite> {
    const token = `inv_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const invite: CompanyInvite = {
      id: inviteInput.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      token: inviteInput.token || token,
      companyId: inviteInput.companyId,
      role: inviteInput.role,
      email: inviteInput.email?.trim().toLowerCase(),
      fullName: inviteInput.fullName?.trim(),
      invitedBy: inviteInput.invitedBy,
      createdAt: new Date().toISOString(),
      expiresAt: inviteInput.expiresAt,
      usedCount: 0,
      maxUses: inviteInput.maxUses,
      status: 'active',
    };
    try {
      const { error } = await this.client.from('company_invites').insert({
        id: invite.id,
        token: invite.token,
        company_id: invite.companyId,
        role: invite.role,
        email: invite.email,
        full_name: invite.fullName,
        invited_by: invite.invitedBy,
        created_at: invite.createdAt,
        expires_at: invite.expiresAt,
        used_count: invite.usedCount,
        max_uses: invite.maxUses,
        status: invite.status,
      });
      if (error) {
        this.fallbackInvites.push(invite);
      }
    } catch {
      this.fallbackInvites.push(invite);
    }
    return invite;
  }

  public async revokeCompanyInvite(id: string): Promise<boolean> {
    try {
      await this.client.from('company_invites').update({ status: 'revoked' }).or(`id.eq.${id},token.eq.${id}`);
    } catch {}
    const local = this.fallbackInvites.find((i) => i.id === id || i.token === id);
    if (local) local.status = 'revoked';
    return true;
  }

  public async acceptCompanyInvite(token: string, userId: string): Promise<{ company: Company; membership: CompanyMembership; invite: CompanyInvite }> {
    const invite = await this.getInviteByToken(token);
    if (!invite) throw new Error('Приглашение не найдено или ссылка недействительна');
    if (invite.status === 'revoked') throw new Error('Это приглашение было отозвано организатором');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) throw new Error('Срок действия этого приглашения истёк');
    if (invite.maxUses && invite.usedCount >= invite.maxUses) throw new Error('Лимит использований этой ссылки исчерпан');

    const company = await this.getCompanyById(invite.companyId);
    if (!company) throw new Error('Организация не найдена');

    const members = await this.getCompanyMembers(invite.companyId);
    let membership = members.find((m) => m.membership.userId === userId)?.membership;
    if (!membership) {
      membership = await this.addCompanyMember({
        companyId: invite.companyId,
        userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });
    }

    invite.usedCount += 1;
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      invite.status = 'expired';
    }

    try {
      await this.client.from('company_invites').update({
        used_count: invite.usedCount,
        status: invite.status,
      }).eq('id', invite.id);
    } catch {}

    return { company, membership, invite };
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

  private sanitizeUserIdRef(val: unknown): string | null {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Valid user_profiles IDs in our schema start with 'user_' or UUID format
    if (trimmed.startsWith('user_') || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  public async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const now = new Date().toISOString();
    const eventId =
      'id' in eventInput && eventInput.id
        ? eventInput.id
        : `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isTaxable = (eventInput as any).isTaxable !== undefined ? Boolean((eventInput as any).isTaxable) : true;
    const taxSystem = (eventInput as any).taxSystem ?? null;
    const taxRate = (eventInput as any).taxRate !== undefined ? Number((eventInput as any).taxRate) : null;
    const legalEntity = (eventInput as any).legalEntity ?? null;

    const row: any = {
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
      is_taxable: isTaxable,
      tax_system: taxSystem,
      tax_rate: taxRate,
      legal_entity: legalEntity,
      created_by: this.sanitizeUserIdRef((eventInput as any).createdBy),
      updated_by: this.sanitizeUserIdRef((eventInput as any).updatedBy),
      created_at: now,
      updated_at: now,
    };
    let { data, error } = await this.client.from('events').insert(row).select('*').single();
    if (error && (error.message?.includes('is_taxable') || error.message?.includes('tax_system') || error.message?.includes('schema cache'))) {
      delete row.is_taxable;
      delete row.tax_system;
      delete row.tax_rate;
      delete row.legal_entity;
      const retry = await this.client.from('events').insert(row).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error && error.message?.includes('foreign key constraint')) {
      row.created_by = null;
      row.updated_by = null;
      const retry = await this.client.from('events').insert(row).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const resultObj = data || row;
    resultObj.isTaxable = isTaxable;
    resultObj.taxSystem = taxSystem;
    resultObj.taxRate = taxRate;
    resultObj.legalEntity = legalEntity;
    return this.mapEvent(resultObj);
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
    if (updates.isTaxable !== undefined) payload.is_taxable = updates.isTaxable;
    if (updates.taxSystem !== undefined) payload.tax_system = updates.taxSystem;
    if (updates.taxRate !== undefined) payload.tax_rate = updates.taxRate;
    if (updates.legalEntity !== undefined) payload.legal_entity = updates.legalEntity;
    if (updates.updatedBy !== undefined) payload.updated_by = this.sanitizeUserIdRef(updates.updatedBy);

    let { data, error } = await this.client
      .from('events')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error && (error.message?.includes('is_taxable') || error.message?.includes('tax_system') || error.message?.includes('schema cache'))) {
      delete payload.is_taxable;
      delete payload.tax_system;
      delete payload.tax_rate;
      delete payload.legal_entity;
      const retry = await this.client
        .from('events')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Мероприятие с id "${id}" не найдено`);
    if (updates.isTaxable !== undefined) (data as any).isTaxable = updates.isTaxable;
    if (updates.taxSystem !== undefined) (data as any).taxSystem = updates.taxSystem;
    if (updates.taxRate !== undefined) (data as any).taxRate = updates.taxRate;
    if (updates.legalEntity !== undefined) (data as any).legalEntity = updates.legalEntity;
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
  // EVENT PAYMENT MILESTONES (График оплат от заказчика)
  // =========================================================================

  public async getMilestones(companyId?: string, eventId?: string): Promise<EventPaymentMilestone[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    try {
      let query = this.client.from('event_payment_milestones').select('*').eq('company_id', target);
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query.order('due_date', { ascending: true });
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.fallbackMilestones.filter((m) => (!eventId || m.eventId === eventId) && (m.companyId || DEFAULT_COMPANY_ID) === target);
        }
        console.warn('[SupabaseStore] getMilestones error, fallback empty:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        eventId: row.event_id,
        title: row.title,
        dueDate: row.due_date,
        amount: round2(row.amount),
        status: row.status,
        paidAmount: row.paid_amount ? round2(row.paid_amount) : undefined,
        paidDate: row.paid_date || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.fallbackMilestones.filter((m) => (!eventId || m.eventId === eventId) && (m.companyId || DEFAULT_COMPANY_ID) === target);
      }
      console.warn('[SupabaseStore] getMilestones network exception, using fallback:', err.message || err);
      return [];
    }
  }

  public async getMilestoneById(id: string): Promise<EventPaymentMilestone | null> {
    try {
      const { data, error } = await this.client.from('event_payment_milestones').select('*').eq('id', id).maybeSingle();
      if (error && this.isResilientFallbackNeeded(error)) {
        return this.fallbackMilestones.find((m) => m.id === id) || null;
      }
      if (error || !data) {
        return this.fallbackMilestones.find((m) => m.id === id) || null;
      }
      return {
        id: data.id,
        companyId: data.company_id,
        eventId: data.event_id,
        title: data.title,
        dueDate: data.due_date,
        amount: round2(data.amount),
        status: data.status,
        paidAmount: data.paid_amount ? round2(data.paid_amount) : undefined,
        paidDate: data.paid_date || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err: any) {
      return this.fallbackMilestones.find((m) => m.id === id) || null;
    }
  }

  public async saveMilestone(mInput: Omit<EventPaymentMilestone, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventPaymentMilestone> {
    const id = mInput.id || `ms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const row = {
      id,
      company_id: mInput.companyId || DEFAULT_COMPANY_ID,
      event_id: mInput.eventId,
      title: mInput.title,
      due_date: mInput.dueDate,
      amount: round2(mInput.amount),
      status: mInput.status || 'pending',
      paid_amount: mInput.paidAmount ? round2(mInput.paidAmount) : null,
      paid_date: mInput.paidDate || null,
      notes: mInput.notes || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await this.client.from('event_payment_milestones').upsert(row).select().single();
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.saveMilestoneFallback(id, mInput);
        }
        throw new Error(`Ошибка сохранения этапа оплаты: ${error.message}`);
      }
      return {
        id: data.id,
        companyId: data.company_id,
        eventId: data.event_id,
        title: data.title,
        dueDate: data.due_date,
        amount: round2(data.amount),
        status: data.status,
        paidAmount: data.paid_amount ? round2(data.paid_amount) : undefined,
        paidDate: data.paid_date || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.saveMilestoneFallback(id, mInput);
      }
      throw new Error(`Ошибка сохранения этапа оплаты: ${err.message || err}`);
    }
  }

  private saveMilestoneFallback(id: string, mInput: any): EventPaymentMilestone {
    console.warn('[SupabaseStore] Using local memory cache for event_payment_milestones');
    const existingIdx = this.fallbackMilestones.findIndex((m) => m.id === id);
    const item: EventPaymentMilestone = {
      id,
      companyId: mInput.companyId || DEFAULT_COMPANY_ID,
      eventId: mInput.eventId,
      title: mInput.title,
      dueDate: mInput.dueDate,
      amount: round2(mInput.amount),
      status: mInput.status || 'pending',
      paidAmount: mInput.paidAmount ? round2(mInput.paidAmount) : undefined,
      paidDate: mInput.paidDate || undefined,
      notes: mInput.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      this.fallbackMilestones[existingIdx] = { ...this.fallbackMilestones[existingIdx], ...item };
      return this.fallbackMilestones[existingIdx];
    }
    this.fallbackMilestones.push(item);
    return item;
  }

  public async deleteMilestone(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('event_payment_milestones').delete().eq('id', id);
      if (error && this.isResilientFallbackNeeded(error)) {
        const idx = this.fallbackMilestones.findIndex((m) => m.id === id);
        if (idx !== -1) this.fallbackMilestones.splice(idx, 1);
        return true;
      }
      return !error;
    } catch {
      const idx = this.fallbackMilestones.findIndex((m) => m.id === id);
      if (idx !== -1) this.fallbackMilestones.splice(idx, 1);
      return true;
    }
  }

  // =========================================================================
  // EVENT BUDGET ITEMS (Смета мероприятия: План-Факт)
  // =========================================================================

  public async getBudgetItems(companyId?: string, eventId?: string): Promise<EventBudgetItem[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    try {
      let query = this.client.from('event_budget_items').select('*').eq('company_id', target);
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query;
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.fallbackBudgetItems.filter((b) => (!eventId || b.eventId === eventId) && (b.companyId || DEFAULT_COMPANY_ID) === target);
        }
        console.warn('[SupabaseStore] getBudgetItems error, fallback empty:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        eventId: row.event_id,
        categoryId: row.category_id,
        plannedAmount: round2(row.planned_amount),
        notes: row.notes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.fallbackBudgetItems.filter((b) => (!eventId || b.eventId === eventId) && (b.companyId || DEFAULT_COMPANY_ID) === target);
      }
      console.warn('[SupabaseStore] getBudgetItems network error, fallback:', err.message || err);
      return [];
    }
  }

  public async saveBudgetItem(bInput: Omit<EventBudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventBudgetItem> {
    const id = bInput.id || `bgt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const row = {
      id,
      company_id: bInput.companyId || DEFAULT_COMPANY_ID,
      event_id: bInput.eventId,
      category_id: bInput.categoryId,
      planned_amount: round2(bInput.plannedAmount),
      notes: bInput.notes || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await this.client.from('event_budget_items').upsert(row).select().single();
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.saveBudgetItemFallback(id, bInput);
        }
        throw new Error(`Ошибка сохранения позиции сметы: ${error.message}`);
      }
      return {
        id: data.id,
        companyId: data.company_id,
        eventId: data.event_id,
        categoryId: data.category_id,
        plannedAmount: round2(data.planned_amount),
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.saveBudgetItemFallback(id, bInput);
      }
      throw new Error(`Ошибка сохранения позиции сметы: ${err.message || err}`);
    }
  }

  private saveBudgetItemFallback(id: string, bInput: any): EventBudgetItem {
    console.warn('[SupabaseStore] Using local memory cache for event_budget_items');
    const existingIdx = this.fallbackBudgetItems.findIndex(
      (b) => b.id === id || (b.eventId === bInput.eventId && b.categoryId === bInput.categoryId)
    );
    const item: EventBudgetItem = {
      id,
      companyId: bInput.companyId || DEFAULT_COMPANY_ID,
      eventId: bInput.eventId,
      categoryId: bInput.categoryId,
      plannedAmount: round2(bInput.plannedAmount),
      notes: bInput.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      this.fallbackBudgetItems[existingIdx] = { ...this.fallbackBudgetItems[existingIdx], ...item };
      return this.fallbackBudgetItems[existingIdx];
    }
    this.fallbackBudgetItems.push(item);
    return item;
  }

  public async deleteBudgetItem(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('event_budget_items').delete().eq('id', id);
      if (error && this.isResilientFallbackNeeded(error)) {
        const idx = this.fallbackBudgetItems.findIndex((b) => b.id === id);
        if (idx !== -1) this.fallbackBudgetItems.splice(idx, 1);
        return true;
      }
      return !error;
    } catch {
      const idx = this.fallbackBudgetItems.findIndex((b) => b.id === id);
      if (idx !== -1) this.fallbackBudgetItems.splice(idx, 1);
      return true;
    }
  }

  // =========================================================================
  // EVENT VENDORS & CREW (Подрядчики и команда на мероприятии)
  // =========================================================================

  public async getVendors(companyId?: string, eventId?: string): Promise<EventVendor[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    try {
      let query = this.client.from('event_vendors').select('*').eq('company_id', target);
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query;
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.fallbackVendors.filter((v) => (!eventId || v.eventId === eventId) && (v.companyId || DEFAULT_COMPANY_ID) === target);
        }
        console.warn('[SupabaseStore] getVendors error, fallback empty:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        eventId: row.event_id,
        name: row.name,
        role: row.role,
        phone: row.phone || undefined,
        agreedFee: round2(row.agreed_fee),
        paidAmount: round2(row.paid_amount),
        remainingAmount: round2(row.remaining_amount),
        status: row.status,
        dueDate: row.due_date || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.fallbackVendors.filter((v) => (!eventId || v.eventId === eventId) && (v.companyId || DEFAULT_COMPANY_ID) === target);
      }
      console.warn('[SupabaseStore] getVendors network error, fallback:', err.message || err);
      return [];
    }
  }

  public async getVendorById(id: string): Promise<EventVendor | null> {
    try {
      const { data, error } = await this.client.from('event_vendors').select('*').eq('id', id).maybeSingle();
      if (error && this.isResilientFallbackNeeded(error)) {
        return this.fallbackVendors.find((v) => v.id === id) || null;
      }
      if (error || !data) {
        return this.fallbackVendors.find((v) => v.id === id) || null;
      }
      return {
        id: data.id,
        companyId: data.company_id,
        eventId: data.event_id,
        name: data.name,
        role: data.role,
        phone: data.phone || undefined,
        agreedFee: round2(data.agreed_fee),
        paidAmount: round2(data.paid_amount),
        remainingAmount: round2(data.remaining_amount),
        status: data.status,
        dueDate: data.due_date || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.fallbackVendors.find((v) => v.id === id) || null;
    }
  }

  public async saveVendor(vInput: Omit<EventVendor, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventVendor> {
    const id = vInput.id || `vnd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const agreedFee = round2(vInput.agreedFee);
    const paidAmount = round2(vInput.paidAmount);
    const remainingAmount = Math.max(0, round2(agreedFee - paidAmount));
    const status = paidAmount >= agreedFee && agreedFee > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

    const row = {
      id,
      company_id: vInput.companyId || DEFAULT_COMPANY_ID,
      event_id: vInput.eventId,
      name: vInput.name,
      role: vInput.role,
      phone: vInput.phone || null,
      agreed_fee: agreedFee,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      status: vInput.status || status,
      due_date: vInput.dueDate || null,
      notes: vInput.notes || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await this.client.from('event_vendors').upsert(row).select().single();
      if (error) {
        if (this.isResilientFallbackNeeded(error)) {
          return this.saveVendorFallback(id, vInput, agreedFee, paidAmount, remainingAmount, status);
        }
        throw new Error(`Ошибка сохранения подрядчика: ${error.message}`);
      }
      return {
        id: data.id,
        companyId: data.company_id,
        eventId: data.event_id,
        name: data.name,
        role: data.role,
        phone: data.phone || undefined,
        agreedFee: round2(data.agreed_fee),
        paidAmount: round2(data.paid_amount),
        remainingAmount: round2(data.remaining_amount),
        status: data.status,
        dueDate: data.due_date || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err: any) {
      if (this.isResilientFallbackNeeded(err)) {
        return this.saveVendorFallback(id, vInput, agreedFee, paidAmount, remainingAmount, status);
      }
      throw new Error(`Ошибка сохранения подрядчика: ${err.message || err}`);
    }
  }

  private saveVendorFallback(id: string, vInput: any, agreedFee: number, paidAmount: number, remainingAmount: number, status: any): EventVendor {
    console.warn('[SupabaseStore] Using local memory cache for event_vendors');
    const existingIdx = this.fallbackVendors.findIndex((v) => v.id === id);
    const item: EventVendor = {
      id,
      companyId: vInput.companyId || DEFAULT_COMPANY_ID,
      eventId: vInput.eventId,
      name: vInput.name,
      role: vInput.role,
      phone: vInput.phone || undefined,
      agreedFee,
      paidAmount,
      remainingAmount,
      status: vInput.status || status,
      dueDate: vInput.dueDate || undefined,
      notes: vInput.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      this.fallbackVendors[existingIdx] = { ...this.fallbackVendors[existingIdx], ...item };
      return this.fallbackVendors[existingIdx];
    }
    this.fallbackVendors.push(item);
    return item;
  }

  public async deleteVendor(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('event_vendors').delete().eq('id', id);
      if (error && this.isResilientFallbackNeeded(error)) {
        const idx = this.fallbackVendors.findIndex((v) => v.id === id);
        if (idx !== -1) this.fallbackVendors.splice(idx, 1);
        return true;
      }
      return !error;
    } catch {
      const idx = this.fallbackVendors.findIndex((v) => v.id === id);
      if (idx !== -1) this.fallbackVendors.splice(idx, 1);
      return true;
    }
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  public async getCategories(companyId?: string): Promise<Category[]> {
    const { data, error } = await this.client.from('categories').select('*');
    if (error) throw new Error(error.message);
    const all = (data || []).map((r) => this.mapCategory(r));
    if (companyId) {
      return all.filter((c) => !c.companyId || c.companyId === companyId || c.isSystem || c.companyId === DEFAULT_COMPANY_ID);
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
    const row: any = {
      id: txId,
      company_id: (txInput as any).companyId || DEFAULT_COMPANY_ID,
      type: txInput.type,
      direction: (txInput as any).direction ?? null,
      amount: round2(txInput.amount),
      from_account_id: txInput.fromAccountId ?? null,
      to_account_id: txInput.toAccountId ?? null,
      category_id: txInput.categoryId || 'overhead',
      event_id: txInput.eventId ?? null,
      partner_id: (txInput as any).partnerId ?? null,
      partner_name: (txInput as any).partnerName ?? null,
      vendor_id: (txInput as any).vendorId ?? null,
      vendor_name: (txInput as any).vendorName ?? null,
      description: txInput.description ?? '',
      transaction_date: txInput.transactionDate || now,
      is_deleted: false,
      needs_review: (txInput as any).needsReview ?? false,
      created_by: this.sanitizeUserIdRef((txInput as any).createdBy),
      updated_by: this.sanitizeUserIdRef((txInput as any).updatedBy),
      created_at: now,
      updated_at: now,
    };
    let { data, error } = await this.client.from('transactions').insert(row).select('*').single();
    if (error && (error.message?.includes('vendor_id') || error.message?.includes('column'))) {
      delete row.vendor_id;
      delete row.vendor_name;
      const retry = await this.client.from('transactions').insert(row).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error && error.message?.includes('foreign key constraint')) {
      if (error.message.includes('created_by') || error.message.includes('updated_by')) {
        row.created_by = null;
        row.updated_by = null;
      }
      if (error.message.includes('event_id')) {
        row.event_id = null;
      }
      if (error.message.includes('partner_id')) {
        row.partner_id = null;
      }
      if (error.message.includes('vendor_id')) {
        delete row.vendor_id;
        delete row.vendor_name;
      }
      if (error.message.includes('category_id')) {
        row.category_id = txInput.type === 'income' ? 'contract_prepayment' : txInput.type === 'transfer' ? 'transfer_internal' : 'overhead';
      }
      const retry = await this.client.from('transactions').insert(row).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);

    // If transaction is an expense bound to a vendor, update vendor's paid and remaining amounts
    const targetVendorId = (txInput as any).vendorId;
    if (targetVendorId && txInput.type === 'expense') {
      try {
        const vendor = await this.getVendorById(targetVendorId);
        if (vendor) {
          const newPaid = round2((vendor.paidAmount || 0) + Number(txInput.amount));
          const newRemaining = Math.max(0, round2((vendor.agreedFee || 0) - newPaid));
          const newStatus = newPaid >= vendor.agreedFee && vendor.agreedFee > 0 ? 'paid' : 'partial';
          await this.saveVendor({
            ...vendor,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newStatus,
          });
        }
      } catch (vErr) {
        console.warn('[SupabaseStore] Notice: vendor balance sync warning:', vErr);
      }
    }

    const createdTx = this.mapTransaction(data || row);
    if (targetVendorId && !createdTx.vendorId) {
      createdTx.vendorId = targetVendorId;
      createdTx.vendorName = (txInput as any).vendorName || undefined;
    }
    return createdTx;
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

    const tx = this.mapTransaction(data);
    // If deleting an expense tied to a vendor, restore remaining fee
    if (tx.vendorId && tx.type === 'expense') {
      try {
        const vendor = await this.getVendorById(tx.vendorId);
        if (vendor) {
          const newPaid = Math.max(0, round2((vendor.paidAmount || 0) - tx.amount));
          const newRemaining = Math.max(0, round2((vendor.agreedFee || 0) - newPaid));
          const newStatus = newPaid >= vendor.agreedFee && vendor.agreedFee > 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
          await this.saveVendor({
            ...vendor,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newStatus,
          });
        }
      } catch (vErr) {
        console.warn('[SupabaseStore] Notice: vendor balance restore warning on delete:', vErr);
      }
    }

    return tx;
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
