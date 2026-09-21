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
} from '../../shared/types.js';
import { createInitialDatabaseState, DatabaseState } from '../data/seed.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export class InMemoryStore implements IFinanceStore {
  protected state: DatabaseState;

  constructor(initialState?: DatabaseState) {
    this.state = initialState ? clone(initialState) : createInitialDatabaseState();
  }

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  public async getAccounts(): Promise<Account[]> {
    return clone(this.state.accounts);
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

  public async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const acc = this.state.accounts.find((a) => a.id === accountInput.id);
    if (!acc) {
      throw new Error(`Счёт не найден: ${accountInput.id}`);
    }
    if (accountInput.name !== undefined) acc.name = accountInput.name;
    if (accountInput.type !== undefined) acc.type = accountInput.type;
    if (accountInput.description !== undefined) acc.description = accountInput.description;
    if (accountInput.isActive !== undefined) acc.isActive = accountInput.isActive;
    acc.updatedAt = new Date().toISOString();
    return clone(acc);
  }

  public async createAccount(accountInput: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    const now = new Date().toISOString();
    const id = accountInput.id || `acc_${Date.now()}`;
    const newAcc: Account = {
      id,
      name: accountInput.name,
      type: accountInput.type,
      initialBalance: accountInput.initialBalance || 0,
      currentBalance: accountInput.initialBalance || 0,
      currency: 'RUB',
      description: accountInput.description || '',
      isActive: accountInput.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.accounts.push(newAcc);
    return clone(newAcc);
  }

  // =========================================================================
  // PARTNERS
  // =========================================================================

  public async getPartners(): Promise<Partner[]> {
    return clone(this.state.partners || []);
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
      existing.isActive = partnerInput.isActive ?? existing.isActive;
      existing.updatedAt = now;
      return clone(existing);
    } else {
      const id = partnerInput.id || `partner_${Date.now()}`;
      const newPartner: Partner = {
        id,
        name: partnerInput.name,
        isActive: partnerInput.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.partners.push(newPartner);
      return clone(newPartner);
    }
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  public async getEvents(): Promise<CateringEvent[]> {
    return clone(this.state.events);
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
      eventDate: eventInput.eventDate,
      status: eventInput.status || 'planned',
      budget: eventInput.budget,
      guestCount: eventInput.guestCount,
      location: eventInput.location,
      notes: eventInput.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.state.events.push(newEvent);
    return clone(newEvent);
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  public async getCategories(): Promise<Category[]> {
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
      return clone(existing);
    } else {
      const newCat: Category = {
        ...catInput,
        createdAt: catInput.createdAt || new Date().toISOString(),
      };
      this.state.categories.push(newCat);
      return clone(newCat);
    }
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
      : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newTx: Transaction = {
      id: txId,
      type: txInput.type,
      direction: (txInput as any).direction ?? undefined,
      amount: Math.round(txInput.amount * 100) / 100,
      fromAccountId: txInput.fromAccountId ?? null,
      toAccountId: txInput.toAccountId ?? null,
      categoryId: txInput.categoryId,
      eventId: txInput.eventId ?? null,
      partnerId: (txInput as any).partnerId ?? null,
      partnerName: (txInput as any).partnerName ?? null,
      description: txInput.description ?? '',
      transactionDate: txInput.transactionDate || now,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    this.state.transactions.push(newTx);
    return clone(newTx);
  }

  public async softDeleteTransaction(id: string): Promise<Transaction> {
    const tx = this.state.transactions.find((t) => t.id === id);
    if (!tx) {
      throw new Error(`Транзакция не найдена: ${id}`);
    }
    tx.isDeleted = true;
    tx.updatedAt = new Date().toISOString();
    return clone(tx);
  }

  // =========================================================================
  // RESET STATE
  // =========================================================================

  public async resetToSeed(): Promise<void> {
    this.state = createInitialDatabaseState();
  }
}
