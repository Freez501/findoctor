/**
 * Truespace — Барный кейтеринг и финансы
 * Local JSON File Storage Implementation (`src/server/storage/JsonFileStore.ts`)
 *
 * Fully autonomous persistent storage targeting `data/truespace.json` with safe fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  Account,
  CateringEvent,
  Transaction,
  Category,
  Partner,
  Company,
  UserProfile,
  CompanyMembership,
  UserRole,
} from '../../shared/types.js';
import { createInitialDatabaseState, DatabaseState } from '../data/seed.js';
import { InMemoryStore } from './InMemoryStore.js';
import { IFinanceStore, NewEventInput, NewTransactionInput } from './interfaces.js';

export class JsonFileStore extends InMemoryStore implements IFinanceStore {
  private readonly filePath: string;

  constructor(customFilePath?: string) {
    const targetPath = customFilePath || path.resolve(process.cwd(), 'data', 'truespace.json');
    super();
    this.filePath = targetPath;
    this.state = this.loadOrCreate();
  }

  public getFilePath(): string {
    return this.filePath;
  }

  private loadOrCreate(): DatabaseState {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const seed = createInitialDatabaseState();
            if (!Array.isArray(parsed.accounts)) parsed.accounts = seed.accounts;
            if (!Array.isArray(parsed.events)) parsed.events = seed.events;
            if (!Array.isArray(parsed.categories)) parsed.categories = seed.categories;
            if (!Array.isArray(parsed.transactions)) parsed.transactions = seed.transactions;
            if (!Array.isArray(parsed.partners)) parsed.partners = seed.partners;
            if (!Array.isArray(parsed.companies)) parsed.companies = seed.companies;
            if (!Array.isArray(parsed.users)) parsed.users = seed.users;
            if (!Array.isArray(parsed.memberships)) parsed.memberships = seed.memberships;
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn(`[JsonFileStore] Warning: Failed to parse ${this.filePath}, safely restoring from seed:`, err);
    }

    // Default: initialize with seed and persist
    const initialState = createInitialDatabaseState();
    this.state = initialState;
    this.persist();
    return initialState;
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serialized = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.filePath, serialized, 'utf-8');
    } catch (err) {
      console.warn(`[JsonFileStore] Warning: Failed to write to disk (${this.filePath}):`, err);
    }
  }

  public override async createCompany(companyInput: Omit<Company, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Company> {
    const result = await super.createCompany(companyInput);
    this.persist();
    return result;
  }

  public override async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const result = await super.updateCompany(id, updates);
    this.persist();
    return result;
  }

  public override async saveUserProfile(userInput: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const result = await super.saveUserProfile(userInput);
    this.persist();
    return result;
  }

  public override async addCompanyMember(data: { companyId: string; userId: string; role: UserRole; invitedBy?: string }): Promise<CompanyMembership> {
    const result = await super.addCompanyMember(data);
    this.persist();
    return result;
  }

  public override async updateAccountBalance(id: string, newBalance: number): Promise<Account> {
    const result = await super.updateAccountBalance(id, newBalance);
    this.persist();
    return result;
  }

  public override async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const result = await super.createEvent(eventInput);
    this.persist();
    return result;
  }

  public override async updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent> {
    const result = await super.updateEvent(id, updates);
    this.persist();
    return result;
  }

  public override async deleteEvent(id: string): Promise<boolean> {
    const result = await super.deleteEvent(id);
    if (result) {
      this.persist();
    }
    return result;
  }

  public override async createTransaction(txInput: NewTransactionInput): Promise<Transaction> {
    const result = await super.createTransaction(txInput);
    this.persist();
    return result;
  }

  public override async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const result = await super.updateTransaction(id, updates);
    this.persist();
    return result;
  }

  public override async softDeleteTransaction(id: string): Promise<Transaction> {
    const result = await super.softDeleteTransaction(id);
    this.persist();
    return result;
  }

  public override async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const result = await super.saveAccount(accountInput);
    this.persist();
    return result;
  }

  public override async createAccount(accountInput: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    const result = await super.createAccount(accountInput);
    this.persist();
    return result;
  }

  public override async savePartner(partnerInput: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    const result = await super.savePartner(partnerInput);
    this.persist();
    return result;
  }

  public override async saveCategory(category: Category): Promise<Category> {
    const result = await super.saveCategory(category);
    this.persist();
    return result;
  }

  public override async deleteAccount(id: string): Promise<boolean> {
    const result = await super.deleteAccount(id);
    if (result) this.persist();
    return result;
  }

  public override async deletePartner(id: string): Promise<boolean> {
    const result = await super.deletePartner(id);
    if (result) this.persist();
    return result;
  }

  public override async deleteCategory(id: string): Promise<boolean> {
    const result = await super.deleteCategory(id);
    if (result) this.persist();
    return result;
  }

  public override async resetToSeed(): Promise<void> {
    await super.resetToSeed();
    this.persist();
  }

  public override async importState(newState: any): Promise<void> {
    await super.importState(newState);
    this.persist();
  }
}
