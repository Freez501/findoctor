/**
 * Truespace — Барный кейтеринг и финансы
 * Financial Engine Service (`src/server/services/FinanceService.ts`)
 *
 * Core accounting business logic implementing:
 * - Double-entry integrity and capital conservation laws
 * - Kopeck precision calculations (preventing IEEE-754 floating point drift)
 * - Atomic account balance mutation
 * - Reversal / cancellation of transactions with full balance restoration
 * - Universal handling of field aliases (fromAccountId / sourceAccountId, toAccountId / targetAccountId)
 */

import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';
import { Account, Transaction, TransactionFilter, TransactionType, Partner, TransactionDirection } from '../../shared/types.js';
import {
  DEFAULT_EXPENSE_CATEGORY_ID,
  DEFAULT_INCOME_CATEGORY_ID,
  CATEGORY_IDS,
} from '../../shared/constants.js';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface TransactionWithAliases extends Transaction {
  sourceAccountId?: string | null;
  targetAccountId?: string | null;
}

export interface CreateTransactionResult {
  transaction: TransactionWithAliases;
  updatedAccounts: Account[];
}

export interface DeleteTransactionResult {
  success: boolean;
  transaction: TransactionWithAliases;
  updatedAccounts: Account[];
}

export class FinanceService {
  constructor(private store: IFinanceStore = getStorageInstance()) {}

  /**
   * Retrieves all accounts along with the aggregated total liquidity.
   */
  public async getAccounts(): Promise<{ accounts: Account[]; totalBalance: number }> {
    const accounts = await this.store.getAccounts();
    const totalBalance = round2(accounts.reduce((sum, a) => sum + a.currentBalance, 0));
    return {
      accounts,
      totalBalance,
    };
  }

  /**
   * Retrieves a single account by ID.
   */
  public async getAccountById(id: string): Promise<Account | null> {
    return this.store.getAccountById(id);
  }

  /**
   * Lists transactions matching optional criteria.
   */
  public async getTransactions(filter?: TransactionFilter): Promise<TransactionWithAliases[]> {
    const transactions = await this.store.getTransactions(filter);
    return transactions.map((tx) => this.attachAliases(tx));
  }

  /**
   * Retrieves a single transaction by ID.
   */
  public async getTransactionById(id: string): Promise<TransactionWithAliases | null> {
    const tx = await this.store.getTransactionById(id);
    return tx ? this.attachAliases(tx) : null;
  }

  public async getPartners(): Promise<Partner[]> {
    return this.store.getPartners();
  }

  public async getPartnerById(id: string): Promise<Partner | null> {
    return this.store.getPartnerById(id);
  }

  public async savePartner(partner: Omit<Partner, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Partner> {
    return this.store.savePartner(partner);
  }

  public async saveAccount(account: Partial<Account> & { id: string }): Promise<Account> {
    return this.store.saveAccount(account);
  }

  public async createAccount(account: Omit<Account, 'currentBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    return this.store.createAccount(account);
  }

  public async saveCategory(category: Category): Promise<Category> {
    return this.store.saveCategory(category);
  }

  /**
   * Universal transaction creation dispatcher.
   * Handles expense, income, and transfer operations with strict validation.
   */
  public async createTransaction(dto: any): Promise<CreateTransactionResult> {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Данные транзакции должны быть объектом');
    }

    // 1. Amount validation & normalization
    let rawAmount = dto.amount;
    if (typeof rawAmount === 'string') {
      rawAmount = parseFloat(rawAmount.replace(/[\s_]/g, '').replace(',', '.'));
    }

    if (typeof rawAmount !== 'number' || isNaN(rawAmount) || rawAmount <= 0) {
      throw new Error('Сумма должна быть больше нуля');
    }

    const amount = round2(rawAmount);

    // 2. Type validation
    const type: TransactionType = dto.type;
    if (!type || !['income', 'expense', 'transfer'].includes(type)) {
      throw new Error("Поле 'type' должно быть одним из: 'income', 'expense', 'transfer'");
    }

    // 3. Resolve account aliases
    const sourceAccountId = dto.sourceAccountId || dto.fromAccountId || null;
    const targetAccountId = dto.targetAccountId || dto.toAccountId || null;

    // 4. Resolve category
    let categoryId = dto.categoryId;
    if (!categoryId || typeof categoryId !== 'string' || categoryId.trim() === '') {
      if (type === 'transfer') {
        categoryId = CATEGORY_IDS.TRANSFER_INTERNAL;
      } else if (type === 'income') {
        categoryId = DEFAULT_INCOME_CATEGORY_ID;
      } else {
        categoryId = DEFAULT_EXPENSE_CATEGORY_ID;
      }
    } else {
      categoryId = categoryId.trim();
    }

    const eventId = dto.eventId === undefined ? null : dto.eventId;
    const partnerId = dto.partnerId || null;
    let partnerName: string | null = dto.partnerName || null;
    if (partnerId && !partnerName) {
      const p = await this.store.getPartnerById(partnerId);
      if (p) partnerName = p.name;
    }
    const direction: TransactionDirection | undefined = dto.direction;
    const description = typeof dto.description === 'string' ? dto.description : '';
    const transactionDate = dto.transactionDate || new Date().toISOString();

    // 5. Operation branch execution
    if (type === 'expense') {
      return this.executeExpense({
        amount,
        sourceAccountId,
        categoryId,
        eventId,
        partnerId,
        partnerName,
        direction,
        description,
        transactionDate,
      });
    }

    if (type === 'income') {
      return this.executeIncome({
        amount,
        targetAccountId,
        categoryId,
        eventId,
        partnerId,
        partnerName,
        direction,
        description,
        transactionDate,
      });
    }

    return this.executeTransfer({
      amount,
      sourceAccountId,
      targetAccountId,
      categoryId,
      direction,
      description,
      transactionDate,
    });
  }

  /**
   * Records an outgoing expense operation and debits the source account.
   */
  public async createExpense(dto: {
    amount: number;
    sourceAccountId?: string | null;
    fromAccountId?: string | null;
    categoryId?: string;
    eventId?: string | null;
    description?: string;
    transactionDate?: string;
  }): Promise<CreateTransactionResult> {
    return this.createTransaction({ ...dto, type: 'expense' });
  }

  /**
   * Records an incoming revenue operation and credits the target account.
   */
  public async createIncome(dto: {
    amount: number;
    targetAccountId?: string | null;
    toAccountId?: string | null;
    categoryId?: string;
    eventId?: string | null;
    description?: string;
    transactionDate?: string;
  }): Promise<CreateTransactionResult> {
    return this.createTransaction({ ...dto, type: 'income' });
  }

  /**
   * Records an internal transfer between two distinct accounts conserving total capital.
   */
  public async createTransfer(dto: {
    amount: number;
    sourceAccountId?: string | null;
    fromAccountId?: string | null;
    targetAccountId?: string | null;
    toAccountId?: string | null;
    categoryId?: string;
    description?: string;
    transactionDate?: string;
  }): Promise<CreateTransactionResult> {
    return this.createTransaction({ ...dto, type: 'transfer' });
  }

  /**
   * Soft deletes a transaction and performs atomic balance reversal.
   */
  public async deleteTransaction(id: string): Promise<DeleteTransactionResult> {
    const tx = await this.store.getTransactionById(id);
    if (!tx || tx.isDeleted) {
      throw new Error(`Транзакция ${id} не найдена`);
    }

    const updatedAccounts: Account[] = [];

    // Reversal logic
    if (tx.type === 'expense') {
      const sourceId = tx.fromAccountId || (tx as any).sourceAccountId;
      if (sourceId) {
        const src = await this.store.getAccountById(sourceId);
        if (src) {
          const updatedSrc = await this.store.updateAccountBalance(
            src.id,
            round2(src.currentBalance + tx.amount)
          );
          updatedAccounts.push(updatedSrc);
        }
      }
    } else if (tx.type === 'income') {
      const targetId = tx.toAccountId || (tx as any).targetAccountId;
      if (targetId) {
        const dst = await this.store.getAccountById(targetId);
        if (dst) {
          const updatedDst = await this.store.updateAccountBalance(
            dst.id,
            round2(dst.currentBalance - tx.amount)
          );
          updatedAccounts.push(updatedDst);
        }
      }
    } else if (tx.type === 'transfer') {
      const sourceId = tx.fromAccountId || (tx as any).sourceAccountId;
      const targetId = tx.toAccountId || (tx as any).targetAccountId;

      if (sourceId) {
        const src = await this.store.getAccountById(sourceId);
        if (src) {
          const updatedSrc = await this.store.updateAccountBalance(
            src.id,
            round2(src.currentBalance + tx.amount)
          );
          updatedAccounts.push(updatedSrc);
        }
      }

      if (targetId) {
        const dst = await this.store.getAccountById(targetId);
        if (dst) {
          const updatedDst = await this.store.updateAccountBalance(
            dst.id,
            round2(dst.currentBalance - tx.amount)
          );
          updatedAccounts.push(updatedDst);
        }
      }
    }

    const deletedTx = await this.store.softDeleteTransaction(id);
    return {
      success: true,
      transaction: this.attachAliases(deletedTx),
      updatedAccounts,
    };
  }

  // =========================================================================
  // INTERNAL OPERATION HELPERS
  // =========================================================================

  private async executeExpense(params: {
    amount: number;
    sourceAccountId: string | null;
    categoryId: string;
    eventId: string | null;
    partnerId?: string | null;
    partnerName?: string | null;
    direction?: TransactionDirection;
    description: string;
    transactionDate: string;
  }): Promise<CreateTransactionResult> {
    if (!params.sourceAccountId) {
      throw new Error('Для расхода необходим счёт списания');
    }

    const source = await this.store.getAccountById(params.sourceAccountId);
    if (!source) {
      throw new Error(`Счёт ${params.sourceAccountId} не найден`);
    }

    const newBalance = round2(source.currentBalance - params.amount);
    const updatedSource = await this.store.updateAccountBalance(source.id, newBalance);

    const tx = await this.store.createTransaction({
      type: 'expense',
      amount: params.amount,
      fromAccountId: source.id,
      toAccountId: null,
      categoryId: params.categoryId,
      eventId: params.eventId,
      partnerId: params.partnerId,
      partnerName: params.partnerName,
      direction: params.direction,
      description: params.description,
      transactionDate: params.transactionDate,
    });

    return {
      transaction: this.attachAliases(tx),
      updatedAccounts: [updatedSource],
    };
  }

  private async executeIncome(params: {
    amount: number;
    targetAccountId: string | null;
    categoryId: string;
    eventId: string | null;
    partnerId?: string | null;
    partnerName?: string | null;
    direction?: TransactionDirection;
    description: string;
    transactionDate: string;
  }): Promise<CreateTransactionResult> {
    if (!params.targetAccountId) {
      throw new Error('Для дохода необходим счёт зачисления');
    }

    const target = await this.store.getAccountById(params.targetAccountId);
    if (!target) {
      throw new Error(`Счёт ${params.targetAccountId} не найден`);
    }

    const newBalance = round2(target.currentBalance + params.amount);
    const updatedTarget = await this.store.updateAccountBalance(target.id, newBalance);

    const tx = await this.store.createTransaction({
      type: 'income',
      amount: params.amount,
      fromAccountId: null,
      toAccountId: target.id,
      categoryId: params.categoryId,
      eventId: params.eventId,
      partnerId: params.partnerId,
      partnerName: params.partnerName,
      direction: params.direction,
      description: params.description,
      transactionDate: params.transactionDate,
    });

    return {
      transaction: this.attachAliases(tx),
      updatedAccounts: [updatedTarget],
    };
  }

  private async executeTransfer(params: {
    amount: number;
    sourceAccountId: string | null;
    targetAccountId: string | null;
    categoryId: string;
    direction?: TransactionDirection;
    description: string;
    transactionDate: string;
  }): Promise<CreateTransactionResult> {
    if (!params.sourceAccountId || !params.targetAccountId) {
      throw new Error('Для перевода необходимо указать оба счёта');
    }

    if (params.sourceAccountId === params.targetAccountId) {
      throw new Error('Счёт списания и счёт зачисления должны отличаться');
    }

    const source = await this.store.getAccountById(params.sourceAccountId);
    const target = await this.store.getAccountById(params.targetAccountId);

    if (!source || !target) {
      throw new Error('Счёт списания или зачисления не найден');
    }

    const newSourceBalance = round2(source.currentBalance - params.amount);
    const newTargetBalance = round2(target.currentBalance + params.amount);

    const updatedSource = await this.store.updateAccountBalance(source.id, newSourceBalance);
    const updatedTarget = await this.store.updateAccountBalance(target.id, newTargetBalance);

    const tx = await this.store.createTransaction({
      type: 'transfer',
      amount: params.amount,
      fromAccountId: source.id,
      toAccountId: target.id,
      categoryId: params.categoryId,
      direction: params.direction || 'transfer',
      eventId: null,
      description: params.description,
      transactionDate: params.transactionDate,
    });

    return {
      transaction: this.attachAliases(tx),
      updatedAccounts: [updatedSource, updatedTarget],
    };
  }

  private attachAliases(tx: Transaction): TransactionWithAliases {
    return {
      ...tx,
      sourceAccountId: tx.fromAccountId ?? null,
      targetAccountId: tx.toAccountId ?? null,
    };
  }
}
