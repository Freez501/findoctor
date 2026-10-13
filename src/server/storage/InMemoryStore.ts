/**
 * Truespace — Барный кейтеринг и финансы
 * In-Memory Storage Implementation (`src/server/storage/InMemoryStore.ts`)
 *
 * Ephemeral repository implementation ideal for deterministic unit tests and isolated sessions.
 */

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
  EventPaymentMilestone,
  EventBudgetItem,
  EventVendor,
} from '../../shared/types.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import { createInitialDatabaseState, DatabaseState } from '../data/seed.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

let globalTxCounter = 0;

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export class InMemoryStore implements IFinanceStore {
  protected state: DatabaseState;

  constructor(initialState?: DatabaseState) {
    this.state = initialState ? clone(initialState) : createInitialDatabaseState();
  }

  // =========================================================================
  // COMPANIES (TENANTS)
  // =========================================================================

  public async getCompanies(): Promise<Company[]> {
    return clone(this.state.companies || []);
  }

  public async getCompanyById(id: string): Promise<Company | null> {
    const comp = (this.state.companies || []).find((c) => c.id === id);
    return comp ? clone(comp) : null;
  }

  public async createCompany(companyInput: Partial<Company> & { name: string }): Promise<Company> {
    if (!this.state.companies) this.state.companies = [];
    const newCompany: Company = {
      id: companyInput.id || `company_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: companyInput.name.trim(),
      slug: companyInput.slug || companyInput.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      plan: companyInput.plan || 'free',
      trialEndsAt: companyInput.trialEndsAt,
      paidUntil: companyInput.paidUntil,
      isActive: companyInput.isActive ?? true,
      ownerId: companyInput.ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.companies.push(newCompany);
    return clone(newCompany);
  }

  public async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    if (!this.state.companies) this.state.companies = [];
    const comp = this.state.companies.find((c) => c.id === id);
    if (!comp) throw new Error(`Компания не найдена: ${id}`);
    Object.assign(comp, updates, { updatedAt: new Date().toISOString() });
    return clone(comp);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    if (!this.state.companies) return false;
    const initialLen = this.state.companies.length;
    this.state.companies = this.state.companies.filter((c) => c.id !== id);
    if (this.state.companies.length === initialLen) return false;

    // Cascade delete accounts, transactions, events, categories, partners, memberships
    if (this.state.accounts) {
      this.state.accounts = this.state.accounts.filter((a) => a.companyId !== id);
    }
    if (this.state.transactions) {
      this.state.transactions = this.state.transactions.filter((t) => t.companyId !== id);
    }
    if (this.state.events) {
      this.state.events = this.state.events.filter((e) => e.companyId !== id);
    }
    if (this.state.categories) {
      this.state.categories = this.state.categories.filter((c) => c.companyId !== id);
    }
    if (this.state.partners) {
      this.state.partners = this.state.partners.filter((p) => p.companyId !== id);
    }
    if (this.state.memberships) {
      this.state.memberships = this.state.memberships.filter((m) => m.companyId !== id);
    }

    return true;
  }

  // =========================================================================
  // USERS & MEMBERSHIPS
  // =========================================================================

  public async getUsers(): Promise<UserProfile[]> {
    return clone(this.state.users || []);
  }

  public async getUserById(id: string): Promise<UserProfile | null> {
    const user = (this.state.users || []).find((u) => u.id === id);
    return user ? clone(user) : null;
  }

  public async saveUserProfile(userInput: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    if (!this.state.users) this.state.users = [];
    const idx = this.state.users.findIndex((u) => u.id === userInput.id);
    if (idx >= 0) {
      Object.assign(this.state.users[idx], userInput, { updatedAt: new Date().toISOString() });
      return clone(this.state.users[idx]);
    } else {
      const newUser: UserProfile = {
        id: userInput.id,
        email: userInput.email,
        fullName: userInput.fullName || userInput.email.split('@')[0],
        avatarUrl: userInput.avatarUrl,
        isSuperAdmin: userInput.isSuperAdmin || false,
        isEmailVerified: userInput.isEmailVerified ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.state.users.push(newUser);
      return clone(newUser);
    }
  }

  public async getCompanyMembers(companyId: string): Promise<{ membership: CompanyMembership; user?: UserProfile }[]> {
    const memberships = (this.state.memberships || []).filter((m) => m.companyId === companyId);
    return memberships.map((m) => ({
      membership: clone(m),
      user: (this.state.users || []).find((u) => u.id === m.userId),
    }));
  }

  public async addCompanyMember(data: { companyId: string; userId: string; role: UserRole; invitedBy?: string }): Promise<CompanyMembership> {
    if (!this.state.memberships) this.state.memberships = [];
    const newMembership: CompanyMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: data.companyId,
      userId: data.userId,
      role: data.role,
      invitedBy: data.invitedBy,
      createdAt: new Date().toISOString(),
    };
    this.state.memberships.push(newMembership);
    return clone(newMembership);
  }

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  public async getAccounts(companyId?: string): Promise<Account[]> {
    const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
    return clone(this.state.accounts.filter((a) => (a.companyId || DEFAULT_COMPANY_ID) === targetCompanyId));
  }

  public async getAccountById(id: string): Promise<Account | null> {
    const acc = this.state.accounts.find((a) => a.id === id);
    return acc ? clone(acc) : null;
  }

  public async updateAccountBalance(id: string, newBalance: number): Promise<Account> {
    const acc = this.state.accounts.find((a) => a.id === id);
    if (!acc) {
      throw new Error(`Счёт не найден: ${id}`);
    }
    acc.currentBalance = Math.round(newBalance * 100) / 100;
    acc.updatedAt = new Date().toISOString();
    return clone(acc);
  }

  public async adjustAccountBalance(id: string, delta: number): Promise<Account> {
    const acc = this.state.accounts.find((a) => a.id === id);
    if (!acc) {
      throw new Error(`Счёт не найден: ${id}`);
    }
    acc.currentBalance = Math.round((acc.currentBalance + delta) * 100) / 100;
    acc.updatedAt = new Date().toISOString();
    return clone(acc);
  }

  public async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const acc = this.state.accounts.find((a) => a.id === accountInput.id);
    if (!acc) {
      throw new Error(`Счёт не найден: ${accountInput.id}`);
    }
    if (accountInput.name !== undefined) acc.name = accountInput.name;
    if (accountInput.type !== undefined) acc.type = accountInput.type;
    if (accountInput.description !== undefined) acc.description = accountInput.description;
    if (accountInput.isActive !== undefined) acc.isActive = accountInput.isActive;
    if (accountInput.color !== undefined) acc.color = accountInput.color;
    if (accountInput.icon !== undefined) acc.icon = accountInput.icon;
    if (accountInput.currentBalance !== undefined) {
      acc.currentBalance = Math.round(accountInput.currentBalance * 100) / 100;
    }
    if (accountInput.initialBalance !== undefined) {
      acc.initialBalance = Math.round(accountInput.initialBalance * 100) / 100;
    }
    acc.updatedAt = new Date().toISOString();
    return clone(acc);
  }

  public async createAccount(accountInput: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    const now = new Date().toISOString();
    const id = accountInput.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAcc: Account = {
      id,
      name: accountInput.name,
      type: accountInput.type,
      initialBalance: accountInput.initialBalance || 0,
      currentBalance: accountInput.initialBalance || 0,
      currency: 'RUB',
      description: accountInput.description || '',
      color: accountInput.color,
      icon: accountInput.icon,
      companyId: accountInput.companyId || DEFAULT_COMPANY_ID,
      isActive: accountInput.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.accounts.push(newAcc);
    return clone(newAcc);
  }

  public async deleteAccount(id: string): Promise<boolean> {
    const idx = this.state.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.state.accounts.splice(idx, 1);
    return true;
  }

  // =========================================================================
  // PARTNERS
  // =========================================================================

  public async getPartners(companyId?: string): Promise<Partner[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    const partners = this.state.partners || [];
    return clone(partners.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === target));
  }

  public async getPartnerById(id: string): Promise<Partner | null> {
    const partner = (this.state.partners || []).find((p) => p.id === id);
    return partner ? clone(partner) : null;
  }

  public async savePartner(partnerInput: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    const now = new Date().toISOString();
    if (!this.state.partners) {
      this.state.partners = [];
    }
    const existing = partnerInput.id ? this.state.partners.find((p) => p.id === partnerInput.id) : null;
    if (existing) {
      existing.name = partnerInput.name;
      if (partnerInput.role !== undefined) existing.role = partnerInput.role;
      if (partnerInput.companyId !== undefined) existing.companyId = partnerInput.companyId;
      existing.isActive = partnerInput.isActive ?? existing.isActive;
      existing.updatedAt = now;
      return clone(existing);
    } else {
      const id = partnerInput.id || `partner_${Date.now()}`;
      const newPartner: Partner = {
        id,
        name: partnerInput.name,
        role: partnerInput.role,
        companyId: partnerInput.companyId || DEFAULT_COMPANY_ID,
        isActive: partnerInput.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.partners.push(newPartner);
      return clone(newPartner);
    }
  }

  public async deletePartner(id: string): Promise<boolean> {
    if (!this.state.partners) return false;
    const idx = this.state.partners.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.state.partners.splice(idx, 1);
    return true;
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  public async getEvents(companyId?: string): Promise<CateringEvent[]> {
    const target = companyId || DEFAULT_COMPANY_ID;
    return clone(this.state.events.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === target));
  }

  public async getEventById(id: string): Promise<CateringEvent | null> {
    const ev = this.state.events.find((e) => e.id === id);
    return ev ? clone(ev) : null;
  }

  public async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const now = new Date().toISOString();
    const eventId = ('id' in eventInput && eventInput.id)
      ? eventInput.id
      : `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newEvent: CateringEvent = {
      id: eventId,
      title: eventInput.title,
      clientName: eventInput.clientName,
      eventDate: eventInput.eventDate,
      status: eventInput.status || 'planned',
      budget: eventInput.budget,
      contractAmount: eventInput.contractAmount,
      guestCount: eventInput.guestCount,
      location: eventInput.location,
      notes: eventInput.notes,
      companyId: (eventInput as any).companyId || DEFAULT_COMPANY_ID,
      createdBy: (eventInput as any).createdBy,
      updatedBy: (eventInput as any).updatedBy,
      createdAt: now,
      updatedAt: now,
    };

    this.state.events.push(newEvent);
    return clone(newEvent);
  }

  public async updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent> {
    const existing = this.state.events.find((e) => e.id === id);
    if (!existing) {
      throw new Error(`Мероприятие с id "${id}" не найдено`);
    }
    const now = new Date().toISOString();
    Object.assign(existing, updates, { id: existing.id, updatedAt: now });
    return clone(existing);
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const index = this.state.events.findIndex((e) => e.id === id);
    if (index === -1) return false;
    this.state.events.splice(index, 1);
    return true;
  }

  // =========================================================================
  // EVENT PAYMENT MILESTONES (График оплат от заказчика)
  // =========================================================================

  public async getMilestones(companyId?: string, eventId?: string): Promise<EventPaymentMilestone[]> {
    const targetCompany = companyId || DEFAULT_COMPANY_ID;
    if (!this.state.milestones) this.state.milestones = [];
    return clone(
      this.state.milestones.filter((m) => {
        const matchesComp = (m.companyId || DEFAULT_COMPANY_ID) === targetCompany;
        const matchesEvent = eventId ? m.eventId === eventId : true;
        return matchesComp && matchesEvent;
      })
    );
  }

  public async getMilestoneById(id: string): Promise<EventPaymentMilestone | null> {
    if (!this.state.milestones) this.state.milestones = [];
    const item = this.state.milestones.find((m) => m.id === id);
    return item ? clone(item) : null;
  }

  public async saveMilestone(milestoneInput: Omit<EventPaymentMilestone, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventPaymentMilestone> {
    if (!this.state.milestones) this.state.milestones = [];
    const now = new Date().toISOString();
    const id = milestoneInput.id || `ms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const existingIndex = this.state.milestones.findIndex((m) => m.id === id);

    if (existingIndex !== -1) {
      const updated: EventPaymentMilestone = {
        ...this.state.milestones[existingIndex],
        ...milestoneInput,
        id,
        updatedAt: now,
      };
      this.state.milestones[existingIndex] = updated;
      return clone(updated);
    }

    const created: EventPaymentMilestone = {
      id,
      companyId: milestoneInput.companyId || DEFAULT_COMPANY_ID,
      eventId: milestoneInput.eventId,
      title: milestoneInput.title.trim(),
      dueDate: milestoneInput.dueDate,
      amount: milestoneInput.amount,
      status: milestoneInput.status || 'pending',
      paidAmount: milestoneInput.paidAmount || (milestoneInput.status === 'received' ? milestoneInput.amount : 0),
      paidDate: milestoneInput.paidDate,
      notes: milestoneInput.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.milestones.push(created);
    return clone(created);
  }

  public async deleteMilestone(id: string): Promise<boolean> {
    if (!this.state.milestones) this.state.milestones = [];
    const index = this.state.milestones.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.state.milestones.splice(index, 1);
    return true;
  }

  // =========================================================================
  // EVENT BUDGET ITEMS (Смета мероприятия: План-Факт)
  // =========================================================================

  public async getBudgetItems(companyId?: string, eventId?: string): Promise<EventBudgetItem[]> {
    const targetCompany = companyId || DEFAULT_COMPANY_ID;
    if (!this.state.budgetItems) this.state.budgetItems = [];
    return clone(
      this.state.budgetItems.filter((b) => {
        const matchesComp = (b.companyId || DEFAULT_COMPANY_ID) === targetCompany;
        const matchesEvent = eventId ? b.eventId === eventId : true;
        return matchesComp && matchesEvent;
      })
    );
  }

  public async saveBudgetItem(itemInput: Omit<EventBudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventBudgetItem> {
    if (!this.state.budgetItems) this.state.budgetItems = [];
    const now = new Date().toISOString();
    const id = itemInput.id || `bgt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const existingIndex = this.state.budgetItems.findIndex(
      (b) => b.id === id || (b.eventId === itemInput.eventId && b.categoryId === itemInput.categoryId)
    );

    if (existingIndex !== -1) {
      const updated: EventBudgetItem = {
        ...this.state.budgetItems[existingIndex],
        ...itemInput,
        id: this.state.budgetItems[existingIndex].id,
        updatedAt: now,
      };
      this.state.budgetItems[existingIndex] = updated;
      return clone(updated);
    }

    const created: EventBudgetItem = {
      id,
      companyId: itemInput.companyId || DEFAULT_COMPANY_ID,
      eventId: itemInput.eventId,
      categoryId: itemInput.categoryId,
      plannedAmount: itemInput.plannedAmount,
      notes: itemInput.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.budgetItems.push(created);
    return clone(created);
  }

  public async deleteBudgetItem(id: string): Promise<boolean> {
    if (!this.state.budgetItems) this.state.budgetItems = [];
    const index = this.state.budgetItems.findIndex((b) => b.id === id);
    if (index === -1) return false;
    this.state.budgetItems.splice(index, 1);
    return true;
  }

  // =========================================================================
  // EVENT VENDORS & CREW (Подрядчики и команда на мероприятии)
  // =========================================================================

  public async getVendors(companyId?: string, eventId?: string): Promise<EventVendor[]> {
    const targetCompany = companyId || DEFAULT_COMPANY_ID;
    if (!this.state.vendors) this.state.vendors = [];
    return clone(
      this.state.vendors.filter((v) => {
        const matchesComp = (v.companyId || DEFAULT_COMPANY_ID) === targetCompany;
        const matchesEvent = eventId ? v.eventId === eventId : true;
        return matchesComp && matchesEvent;
      })
    );
  }

  public async getVendorById(id: string): Promise<EventVendor | null> {
    if (!this.state.vendors) this.state.vendors = [];
    const item = this.state.vendors.find((v) => v.id === id);
    return item ? clone(item) : null;
  }

  public async saveVendor(vendorInput: Omit<EventVendor, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventVendor> {
    if (!this.state.vendors) this.state.vendors = [];
    const now = new Date().toISOString();
    const id = vendorInput.id || `vnd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const agreedFee = Number(vendorInput.agreedFee) || 0;
    const paidAmount = Number(vendorInput.paidAmount) || 0;
    const remainingAmount = Math.max(0, agreedFee - paidAmount);
    const status: 'pending' | 'partial' | 'paid' =
      paidAmount >= agreedFee && agreedFee > 0
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'pending';

    const existingIndex = this.state.vendors.findIndex((v) => v.id === id);

    if (existingIndex !== -1) {
      const updated: EventVendor = {
        ...this.state.vendors[existingIndex],
        ...vendorInput,
        id,
        agreedFee,
        paidAmount,
        remainingAmount,
        status: vendorInput.status || status,
        updatedAt: now,
      };
      this.state.vendors[existingIndex] = updated;
      return clone(updated);
    }

    const created: EventVendor = {
      id,
      companyId: vendorInput.companyId || DEFAULT_COMPANY_ID,
      eventId: vendorInput.eventId,
      name: vendorInput.name.trim(),
      role: vendorInput.role.trim(),
      phone: vendorInput.phone,
      agreedFee,
      paidAmount,
      remainingAmount,
      status: vendorInput.status || status,
      dueDate: vendorInput.dueDate,
      notes: vendorInput.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.vendors.push(created);
    return clone(created);
  }

  public async deleteVendor(id: string): Promise<boolean> {
    if (!this.state.vendors) this.state.vendors = [];
    const index = this.state.vendors.findIndex((v) => v.id === id);
    if (index === -1) return false;
    this.state.vendors.splice(index, 1);
    return true;
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  public async getCategories(companyId?: string): Promise<Category[]> {
    if (companyId) {
      return clone(this.state.categories.filter((c) => !c.companyId || c.companyId === companyId));
    }
    return clone(this.state.categories);
  }

  public async getCategoryById(id: string): Promise<Category | null> {
    const cat = this.state.categories.find((c) => c.id === id);
    return cat ? clone(cat) : null;
  }

  public async saveCategory(catInput: Category): Promise<Category> {
    const existing = this.state.categories.find((c) => c.id === catInput.id);
    if (existing) {
      existing.name = catInput.name;
      existing.type = catInput.type;
      existing.color = catInput.color || existing.color;
      existing.icon = catInput.icon || existing.icon;
      existing.direction = catInput.direction || existing.direction;
      existing.isEventSpecific = catInput.isEventSpecific ?? existing.isEventSpecific;
      if (catInput.companyId !== undefined) existing.companyId = catInput.companyId;
      return clone(existing);
    } else {
      const newCat: Category = {
        ...catInput,
        companyId: catInput.companyId || DEFAULT_COMPANY_ID,
        createdAt: catInput.createdAt || new Date().toISOString(),
      };
      this.state.categories.push(newCat);
      return clone(newCat);
    }
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const idx = this.state.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.state.categories.splice(idx, 1);
    return true;
  }

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================

  public async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let result = this.state.transactions;

    if (filter) {
      if (!filter.includeDeleted) {
        result = result.filter((tx) => !tx.isDeleted);
      }
      if (filter.companyId) {
        result = result.filter((tx) => (tx.companyId || DEFAULT_COMPANY_ID) === filter.companyId);
      }
      if (filter.accountId) {
        result = result.filter(
          (tx) => tx.fromAccountId === filter.accountId || tx.toAccountId === filter.accountId
        );
      }
      if (filter.eventId !== undefined) {
        result = result.filter((tx) => tx.eventId === filter.eventId);
      }
      if (filter.partnerId) {
        result = result.filter((tx) => tx.partnerId === filter.partnerId);
      }
      if (filter.direction) {
        result = result.filter((tx) => tx.direction === filter.direction);
      }
      if (filter.type) {
        result = result.filter((tx) => tx.type === filter.type);
      }
      if (filter.categoryId) {
        result = result.filter((tx) => tx.categoryId === filter.categoryId);
      }
      if (filter.startDate) {
        result = result.filter((tx) => tx.transactionDate >= filter.startDate!);
      }
      if (filter.endDate) {
        result = result.filter((tx) => tx.transactionDate <= filter.endDate!);
      }
    } else {
      result = result.filter((tx) => !tx.isDeleted);
    }

    // Return sorted newest first
    const sorted = [...result].sort((a, b) => {
      const timeDiff = Date.parse(b.transactionDate) - Date.parse(a.transactionDate);
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    return clone(sorted);
  }

  public async getTransactionById(id: string): Promise<Transaction | null> {
    const tx = this.state.transactions.find((t) => t.id === id);
    return tx ? clone(tx) : null;
  }

  public async createTransaction(txInput: NewTransactionInput): Promise<Transaction> {
    const now = new Date().toISOString();
    const txId = ('id' in txInput && txInput.id)
      ? txInput.id
      : `tx-${Date.now()}-${++globalTxCounter}-${Math.random().toString(36).substring(2, 9)}`;

    const newTx: Transaction = {
      id: txId,
      type: txInput.type,
      direction: (txInput as any).direction ?? undefined,
      amount: Math.round(Number(txInput.amount) * 100) / 100,
      fromAccountId: txInput.fromAccountId ?? null,
      toAccountId: txInput.toAccountId ?? null,
      categoryId: txInput.categoryId || 'cat_other_expense',
      eventId: txInput.eventId ?? null,
      partnerId: (txInput as any).partnerId ?? null,
      partnerName: (txInput as any).partnerName ?? null,
      vendorId: (txInput as any).vendorId ?? null,
      vendorName: (txInput as any).vendorName ?? null,
      description: txInput.description ?? '',
      transactionDate: txInput.transactionDate || now,
      companyId: (txInput as any).companyId || DEFAULT_COMPANY_ID,
      createdBy: (txInput as any).createdBy,
      updatedBy: (txInput as any).updatedBy,
      isDeleted: false,
      needsReview: (txInput as any).needsReview ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.state.transactions.push(newTx);

    // If transaction is an expense bound to a vendor, automatically reduce remaining amount
    if (newTx.vendorId && newTx.type === 'expense' && !newTx.isDeleted) {
      const vendor = (this.state.vendors || []).find((v) => v.id === newTx.vendorId);
      if (vendor) {
        vendor.paidAmount = Math.round(((vendor.paidAmount || 0) + newTx.amount) * 100) / 100;
        vendor.remainingAmount = Math.max(0, Math.round(((vendor.agreedFee || 0) - vendor.paidAmount) * 100) / 100);
        vendor.status = vendor.paidAmount >= vendor.agreedFee && vendor.agreedFee > 0 ? 'paid' : 'partial';
        vendor.updatedAt = now;
      }
    }

    return clone(newTx);
  }

  public async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const tx = this.state.transactions.find((t) => t.id === id);
    if (!tx) {
      throw new Error(`Транзакция с ID ${id} не найдена`);
    }

    if (updates.type !== undefined) tx.type = updates.type;
    if (updates.direction !== undefined) tx.direction = updates.direction;
    if (updates.amount !== undefined) tx.amount = Math.round(updates.amount * 100) / 100;
    if (updates.fromAccountId !== undefined) tx.fromAccountId = updates.fromAccountId;
    if (updates.toAccountId !== undefined) tx.toAccountId = updates.toAccountId;
    if (updates.categoryId !== undefined) tx.categoryId = updates.categoryId;
    if (updates.eventId !== undefined) tx.eventId = updates.eventId;
    if (updates.partnerId !== undefined) tx.partnerId = updates.partnerId;
    if (updates.partnerName !== undefined) tx.partnerName = updates.partnerName;
    if (updates.description !== undefined) tx.description = updates.description;
    if (updates.transactionDate !== undefined) tx.transactionDate = updates.transactionDate;
    if (updates.needsReview !== undefined) tx.needsReview = updates.needsReview;
    if (updates.updatedBy !== undefined) tx.updatedBy = updates.updatedBy;
    tx.updatedAt = new Date().toISOString();

    return clone(tx);
  }

  public async softDeleteTransaction(id: string): Promise<Transaction> {
    const tx = this.state.transactions.find((t) => t.id === id);
    if (!tx) {
      throw new Error(`Транзакция не найдена: ${id}`);
    }
    tx.isDeleted = true;
    tx.updatedAt = new Date().toISOString();

    // If deleting an expense tied to a vendor, restore remaining fee
    if ((tx as any).vendorId && tx.type === 'expense') {
      const vendor = (this.state.vendors || []).find((v) => v.id === (tx as any).vendorId);
      if (vendor) {
        vendor.paidAmount = Math.max(0, Math.round(((vendor.paidAmount || 0) - tx.amount) * 100) / 100);
        vendor.remainingAmount = Math.max(0, Math.round(((vendor.agreedFee || 0) - vendor.paidAmount) * 100) / 100);
        vendor.status = vendor.paidAmount >= vendor.agreedFee && vendor.agreedFee > 0 ? 'paid' : vendor.paidAmount > 0 ? 'partial' : 'pending';
        vendor.updatedAt = new Date().toISOString();
      }
    }

    return clone(tx);
  }

  // =========================================================================
  // RESET STATE
  // =========================================================================

  public async resetToSeed(): Promise<void> {
    this.state = createInitialDatabaseState();
  }

  public async importState(newState: Partial<DatabaseState>): Promise<void> {
    if (newState.accounts) this.state.accounts = clone(newState.accounts);
    if (newState.categories) this.state.categories = clone(newState.categories);
    if (newState.events) this.state.events = clone(newState.events);
    if (newState.transactions) this.state.transactions = clone(newState.transactions);
    if (newState.partners) this.state.partners = clone(newState.partners);
    if (newState.companies) this.state.companies = clone(newState.companies);
    if (newState.users) this.state.users = clone(newState.users);
    if (newState.memberships) this.state.memberships = clone(newState.memberships);
    if (newState.milestones) this.state.milestones = clone(newState.milestones);
    if (newState.budgetItems) this.state.budgetItems = clone(newState.budgetItems);
    if (newState.vendors) this.state.vendors = clone(newState.vendors);
  }
}
