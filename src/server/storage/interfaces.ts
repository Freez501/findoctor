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
} from '../../shared/types.js';
import { CreateEventDTO, CreateTransactionDTO } from '../../shared/dto.js';

export { TransactionFilter };

export type NewEventInput = CreateEventDTO | (Omit<CateringEvent, 'createdAt' | 'updatedAt'> & { id?: string });
export type NewTransactionInput = CreateTransactionDTO | (Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'> & { id?: string });

export interface IFinanceStore {
  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  updateAccountBalance(id: string, newBalance: number): Promise<Account>;
  saveAccount(account: Partial<Account> & { id: string }): Promise<Account>;
  createAccount(account: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account>;

  // Partners
  getPartners(): Promise<Partner[]>;
  getPartnerById(id: string): Promise<Partner | null>;
  savePartner(partner: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner>;

  // Events
  getEvents(): Promise<CateringEvent[]>;
  getEventById(id: string): Promise<CateringEvent | null>;
  createEvent(event: NewEventInput): Promise<CateringEvent>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | null>;
  saveCategory(category: Category): Promise<Category>;

  // Transactions
  getTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;
  createTransaction(tx: NewTransactionInput): Promise<Transaction>;
  softDeleteTransaction(id: string): Promise<Transaction>;

  // State maintenance
  resetToSeed(): Promise<void>;
}
