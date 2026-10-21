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
  CompanyInvite,
  UserRole,
  EventPaymentMilestone,
  EventBudgetItem,
  EventVendor,
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
  deleteCompany(id: string): Promise<boolean>;

  // Users & Memberships
  getUsers(): Promise<UserProfile[]>;
  getUserById(id: string): Promise<UserProfile | null>;
  saveUserProfile(user: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile>;
  getCompanyMembers(companyId: string): Promise<{ membership: CompanyMembership; user?: UserProfile }[]>;
  addCompanyMember(data: { companyId: string; userId: string; role: UserRole; invitedBy?: string }): Promise<CompanyMembership>;
  setUserPassword?(userId: string, passwordHash: string): Promise<boolean>;
  getUserPasswordHash?(userId: string): Promise<string | null>;

  // Company Invites (Links & QR)
  getCompanyInvites(companyId?: string): Promise<CompanyInvite[]>;
  getInviteByToken(token: string): Promise<CompanyInvite | null>;
  createCompanyInvite(invite: Partial<CompanyInvite> & { companyId: string; role: UserRole }): Promise<CompanyInvite>;
  revokeCompanyInvite(id: string): Promise<boolean>;
  acceptCompanyInvite(token: string, userId: string): Promise<{ company: Company; membership: CompanyMembership; invite: CompanyInvite }>;

  // Accounts
  getAccounts(companyId?: string): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  updateAccountBalance(id: string, newBalance: number): Promise<Account>;
  adjustAccountBalance(id: string, delta: number): Promise<Account>;
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

  // Event Payment Milestones (График оплат от заказчика)
  getMilestones(companyId?: string, eventId?: string): Promise<EventPaymentMilestone[]>;
  getMilestoneById(id: string): Promise<EventPaymentMilestone | null>;
  saveMilestone(milestone: Omit<EventPaymentMilestone, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventPaymentMilestone>;
  deleteMilestone(id: string): Promise<boolean>;

  // Event Budget Items (Смета мероприятия: План-Факт)
  getBudgetItems(companyId?: string, eventId?: string): Promise<EventBudgetItem[]>;
  saveBudgetItem(item: Omit<EventBudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventBudgetItem>;
  deleteBudgetItem(id: string): Promise<boolean>;

  // Event Vendors & Crew (Подрядчики и команда на мероприятии)
  getVendors(companyId?: string, eventId?: string): Promise<EventVendor[]>;
  getVendorById(id: string): Promise<EventVendor | null>;
  saveVendor(vendor: Omit<EventVendor, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EventVendor>;
  deleteVendor(id: string): Promise<boolean>;

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
