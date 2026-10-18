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
  CompanyInvite,
  UserRole,
  EventPaymentMilestone,
  EventBudgetItem,
  EventVendor,
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
            if (!Array.isArray(parsed.invites)) parsed.invites = [];
            if (!Array.isArray(parsed.milestones)) parsed.milestones = seed.milestones;
            if (!Array.isArray(parsed.budgetItems)) parsed.budgetItems = seed.budgetItems;
            if (!Array.isArray(parsed.vendors)) parsed.vendors = seed.vendors;
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
    this.persistSync();
    return initialState;
  }

  private writePromise: Promise<void> = Promise.resolve();
  private dirty = false;

  private persistSync(): void {
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

  private async persist(): Promise<void> {
    this.dirty = true;
    this.writePromise = this.writePromise.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        const dir = path.dirname(this.filePath);
        await fs.promises.mkdir(dir, { recursive: true });
        const serialized = JSON.stringify(this.state, null, 2);
        const tempFile = `${this.filePath}.tmp`;
        await fs.promises.writeFile(tempFile, serialized, 'utf-8');
        await fs.promises.rename(tempFile, this.filePath).catch(async () => {
          await fs.promises.writeFile(this.filePath, serialized, 'utf-8');
        });
      } catch (err) {
        console.warn(`[JsonFileStore] Warning: Failed to write to disk (${this.filePath}):`, err);
      }
    });
    return this.writePromise;
  }

  public override async createCompany(companyInput: Omit<Company, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Company> {
    const result = await super.createCompany(companyInput);
    await this.persist();
    return result;
  }

  public override async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const result = await super.updateCompany(id, updates);
    await this.persist();
    return result;
  }

  public override async deleteCompany(id: string): Promise<boolean> {
    const result = await super.deleteCompany(id);
    if (result) await this.persist();
    return result;
  }

  public override async saveUserProfile(userInput: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const result = await super.saveUserProfile(userInput);
    await this.persist();
    return result;
  }

  public override async addCompanyMember(data: { companyId: string; userId: string; role: UserRole; invitedBy?: string }): Promise<CompanyMembership> {
    const result = await super.addCompanyMember(data);
    await this.persist();
    return result;
  }

  public override async createCompanyInvite(inviteInput: Partial<CompanyInvite> & { companyId: string; role: UserRole }): Promise<CompanyInvite> {
    const result = await super.createCompanyInvite(inviteInput);
    await this.persist();
    return result;
  }

  public override async revokeCompanyInvite(id: string): Promise<boolean> {
    const result = await super.revokeCompanyInvite(id);
    if (result) await this.persist();
    return result;
  }

  public override async acceptCompanyInvite(token: string, userId: string): Promise<{ company: Company; membership: CompanyMembership; invite: CompanyInvite }> {
    const result = await super.acceptCompanyInvite(token, userId);
    await this.persist();
    return result;
  }

  public override async updateAccountBalance(id: string, newBalance: number): Promise<Account> {
    const result = await super.updateAccountBalance(id, newBalance);
    await this.persist();
    return result;
  }

  public override async adjustAccountBalance(id: string, delta: number): Promise<Account> {
    const result = await super.adjustAccountBalance(id, delta);
    await this.persist();
    return result;
  }

  public override async createEvent(eventInput: NewEventInput): Promise<CateringEvent> {
    const result = await super.createEvent(eventInput);
    await this.persist();
    return result;
  }

  public override async updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent> {
    const result = await super.updateEvent(id, updates);
    await this.persist();
    return result;
  }

  public override async deleteEvent(id: string): Promise<boolean> {
    const result = await super.deleteEvent(id);
    if (result) {
      await this.persist();
    }
    return result;
  }

  public override async createTransaction(txInput: NewTransactionInput): Promise<Transaction> {
    const result = await super.createTransaction(txInput);
    await this.persist();
    return result;
  }

  public override async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const result = await super.updateTransaction(id, updates);
    await this.persist();
    return result;
  }

  public override async softDeleteTransaction(id: string): Promise<Transaction> {
    const result = await super.softDeleteTransaction(id);
    await this.persist();
    return result;
  }

  public override async saveAccount(accountInput: Partial<Account> & { id: string }): Promise<Account> {
    const result = await super.saveAccount(accountInput);
    await this.persist();
    return result;
  }

  public override async createAccount(accountInput: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    const result = await super.createAccount(accountInput);
    await this.persist();
    return result;
  }

  public override async savePartner(partnerInput: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    const result = await super.savePartner(partnerInput);
    await this.persist();
    return result;
  }

  public override async saveCategory(category: Category): Promise<Category> {
    const result = await super.saveCategory(category);
    await this.persist();
    return result;
  }

  public override async deleteAccount(id: string): Promise<boolean> {
    const result = await super.deleteAccount(id);
    if (result) await this.persist();
    return result;
  }

  public override async deletePartner(id: string): Promise<boolean> {
    const result = await super.deletePartner(id);
    if (result) await this.persist();
    return result;
  }

  public override async deleteCategory(id: string): Promise<boolean> {
    const result = await super.deleteCategory(id);
    if (result) await this.persist();
    return result;
  }

  public override async saveMilestone(milestoneInput: any): Promise<EventPaymentMilestone> {
    const result = await super.saveMilestone(milestoneInput);
    await this.persist();
    return result;
  }

  public override async deleteMilestone(id: string): Promise<boolean> {
    const result = await super.deleteMilestone(id);
    if (result) await this.persist();
    return result;
  }

  public override async saveBudgetItem(itemInput: any): Promise<EventBudgetItem> {
    const result = await super.saveBudgetItem(itemInput);
    await this.persist();
    return result;
  }

  public override async deleteBudgetItem(id: string): Promise<boolean> {
    const result = await super.deleteBudgetItem(id);
    if (result) await this.persist();
    return result;
  }

  public override async saveVendor(vendorInput: any): Promise<EventVendor> {
    const result = await super.saveVendor(vendorInput);
    await this.persist();
    return result;
  }

  public override async deleteVendor(id: string): Promise<boolean> {
    const result = await super.deleteVendor(id);
    if (result) await this.persist();
    return result;
  }

  public override async resetToSeed(): Promise<void> {
    await super.resetToSeed();
    await this.persist();
  }

  public override async importState(newState: any): Promise<void> {
    await super.importState(newState);
    await this.persist();
  }
}
