/**
 * Truespace — Барный кейтеринг и финансы
 * Storage Layer Interfaces (`src/server/storage/interfaces.ts`)
 *
 * Repository pattern abstraction isolating data access from business domain logic.
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
} from '../../shared/types.js';
import { CreateEventDTO, CreateTransactionDTO } from '../../shared/dto.js';
import { DatabaseState } from '../data/seed.js';

export { TransactionFilter };

export type NewEventInput = CreateEventDTO | (Omit<CateringEvent, 'createdAt' | 'updatedAt'> & { id?: string });
export type NewTransactionInput = CreateTransactionDTO | (Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'> & { id?: string });

export interface IFinanceStore {
  // Companies (Tenants)
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | null>;
  createCompany(company: Partial<Company> & { name: string }): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company>;

  // Users & Memberships
  getUsers(): Promise<UserProfile[]>;
  getUserById(id: string): Promise<UserProfile | null>;
  saveUserProfile(user: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile>;
  getCompanyMembers(companyId: string): Promise<{ membership: CompanyMembership; user?: UserProfile }[]>;
  addCompanyMember(data: { companyId: string; userId: string; role: UserRole; invitedBy?: string }): Promise<CompanyMembership>;

  // Accounts
  getAccounts(companyId?: string): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  updateAccountBalance(id: string, newBalance: number): Promise<Account>;
  saveAccount(account: Partial<Account> & { id: string }): Promise<Account>;
  createAccount(account: Partial<Account> & { name: string }): Promise<Account>;
  deleteAccount(id: string): Promise<boolean>;

  // Partners
  getPartners(companyId?: string): Promise<Partner[]>;
  getPartnerById(id: string): Promise<Partner | null>;
  savePartner(partner: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner>;
  deletePartner(id: string): Promise<boolean>;

  // Events
  getEvents(companyId?: string): Promise<CateringEvent[]>;
  getEventById(id: string): Promise<CateringEvent | null>;
  createEvent(event: NewEventInput): Promise<CateringEvent>;
  updateEvent(id: string, updates: Partial<CateringEvent>): Promise<CateringEvent>;
  deleteEvent(id: string): Promise<boolean>;

  // Categories
  getCategories(companyId?: string): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | null>;
  saveCategory(category: Partial<Category> & { id: string }): Promise<Category>;
  deleteCategory(id: string): Promise<boolean>;

  // Transactions
  getTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;
  createTransaction(tx: NewTransactionInput): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  softDeleteTransaction(id: string): Promise<Transaction>;

  // State maintenance
  resetToSeed(): Promise<void>;
  importState(state: Partial<DatabaseState>): Promise<void>;
}
