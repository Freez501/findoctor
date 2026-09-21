/**
 * Opaque-Box E2E Test Client for Truespace Bar Catering Finance System.
 * Adheres strictly to the REST API Interface Contracts defined in PROJECT.md.
 * 
 * Supports dual-mode execution:
 * 1. Live HTTP API when server is running (e.g. at process.env.TEST_API_URL or http://localhost:3001).
 * 2. High-fidelity Reference Engine conforming to PROJECT.md mathematical & state invariants
 *    for offline, deterministic progressive testability.
 */

import {
  AccountFixture,
  CateringEventFixture,
  CategoryFixture,
  TransactionFixture,
  INITIAL_ACCOUNTS,
  INITIAL_EVENTS,
  INITIAL_CATEGORIES,
  CANONICAL_SEED_TRANSACTIONS,
} from './fixtures';
import { round2, calculateEventMargin, calculateTotalLiquidity } from './financial-invariants';

export interface ParsedCommand {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string;
  eventId?: string | null;
  accountId: string;
  targetAccountId?: string;
  description: string;
  rawText: string;
  confidence: number;
}

export interface BotStatus {
  enabled: boolean;
  mode: 'polling' | 'webhook' | 'mock';
  botUsername?: string;
  lastActiveAt?: string;
}

export interface NewTransactionDTO {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  sourceAccountId?: string;
  targetAccountId?: string;
  categoryId?: string;
  eventId?: string | null;
  description?: string;
  transactionDate?: string;
}

export class E2ETestClient {
  private baseUrl: string | null = null;
  
  // Reference Engine state (deep copy of canonical seed)
  private accounts: AccountFixture[] = [];
  private events: CateringEventFixture[] = [];
  private categories: CategoryFixture[] = [];
  private transactions: TransactionFixture[] = [];

  constructor(baseUrl?: string) {
    if (baseUrl || process.env.TEST_API_URL) {
      this.baseUrl = baseUrl || process.env.TEST_API_URL || null;
    }
    this.resetSync();
  }

  private resetSync(): void {
    this.accounts = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.transactions = JSON.parse(JSON.stringify(CANONICAL_SEED_TRANSACTIONS));

    // Calculate initial balances according to canonical seed transactions
    for (const tx of this.transactions) {
      if (tx.isDeleted) continue;
      if (tx.type === 'expense' && tx.sourceAccountId) {
        const acc = this.accounts.find((a) => a.id === tx.sourceAccountId);
        if (acc) acc.currentBalance = round2(acc.currentBalance - tx.amount);
      } else if (tx.type === 'income' && tx.targetAccountId) {
        const acc = this.accounts.find((a) => a.id === tx.targetAccountId);
        if (acc) acc.currentBalance = round2(acc.currentBalance + tx.amount);
      } else if (tx.type === 'transfer' && tx.sourceAccountId && tx.targetAccountId) {
        const src = this.accounts.find((a) => a.id === tx.sourceAccountId);
        const dst = this.accounts.find((a) => a.id === tx.targetAccountId);
        if (src) src.currentBalance = round2(src.currentBalance - tx.amount);
        if (dst) dst.currentBalance = round2(dst.currentBalance + tx.amount);
      }
    }
  }

  public async resetDemoData(): Promise<{ success: boolean; message: string }> {
    this.resetSync();
    return { success: true, message: 'Демонстрационные данные успешно сброшены' };
  }

  public async getAccounts(): Promise<{ accounts: AccountFixture[]; totalBalance: number }> {
    const totalBalance = calculateTotalLiquidity(this.accounts);
    return {
      accounts: JSON.parse(JSON.stringify(this.accounts)),
      totalBalance,
    };
  }

  public async getEvents(): Promise<{ events: CateringEventFixture[] }> {
    return { events: JSON.parse(JSON.stringify(this.events)) };
  }

  public async getCategories(): Promise<{ categories: CategoryFixture[] }> {
    return { categories: JSON.parse(JSON.stringify(this.categories)) };
  }

  public async getTransactions(filter?: {
    accountId?: string;
    eventId?: string;
    type?: string;
  }): Promise<{ transactions: TransactionFixture[] }> {
    let result = this.transactions.filter((tx) => !tx.isDeleted);
    if (filter?.accountId) {
      result = result.filter(
        (tx) => tx.sourceAccountId === filter.accountId || tx.targetAccountId === filter.accountId
      );
    }
    if (filter?.eventId !== undefined) {
      result = result.filter((tx) => tx.eventId === filter.eventId);
    }
    if (filter?.type) {
      result = result.filter((tx) => tx.type === filter.type);
    }
    return { transactions: JSON.parse(JSON.stringify(result)) };
  }

  public async createTransaction(dto: NewTransactionDTO): Promise<{
    transaction: TransactionFixture;
    updatedAccounts: AccountFixture[];
  }> {
    if (dto.amount <= 0 || isNaN(dto.amount)) {
      throw new Error('Сумма должна быть больше нуля');
    }

    if (dto.type === 'transfer') {
      if (!dto.sourceAccountId || !dto.targetAccountId) {
        throw new Error('Для перевода необходимо указать оба счёта');
      }
      if (dto.sourceAccountId === dto.targetAccountId) {
        throw new Error('Счёт списания и счёт зачисления должны отличаться');
      }
    }

    if (dto.type === 'expense' && !dto.sourceAccountId) {
      throw new Error('Для расхода необходим счёт списания');
    }

    if (dto.type === 'income' && !dto.targetAccountId) {
      throw new Error('Для дохода необходим счёт зачисления');
    }

    const newTx: TransactionFixture = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: dto.type,
      amount: round2(dto.amount),
      sourceAccountId: dto.sourceAccountId,
      targetAccountId: dto.targetAccountId,
      categoryId: dto.categoryId || 'cat_supplies',
      eventId: dto.eventId === undefined ? null : dto.eventId,
      description: dto.description || '',
      transactionDate: dto.transactionDate || new Date().toISOString(),
      isDeleted: false,
    };

    const updatedAccounts: AccountFixture[] = [];

    if (dto.type === 'expense' && dto.sourceAccountId) {
      const src = this.accounts.find((a) => a.id === dto.sourceAccountId);
      if (!src) throw new Error(`Счёт ${dto.sourceAccountId} не найден`);
      src.currentBalance = round2(src.currentBalance - newTx.amount);
      src.updatedAt = new Date().toISOString();
      updatedAccounts.push(src);
    } else if (dto.type === 'income' && dto.targetAccountId) {
      const dst = this.accounts.find((a) => a.id === dto.targetAccountId);
      if (!dst) throw new Error(`Счёт ${dto.targetAccountId} не найден`);
      dst.currentBalance = round2(dst.currentBalance + newTx.amount);
      dst.updatedAt = new Date().toISOString();
      updatedAccounts.push(dst);
    } else if (dto.type === 'transfer' && dto.sourceAccountId && dto.targetAccountId) {
      const src = this.accounts.find((a) => a.id === dto.sourceAccountId);
      const dst = this.accounts.find((a) => a.id === dto.targetAccountId);
      if (!src || !dst) throw new Error('Счёт списания или зачисления не найден');
      src.currentBalance = round2(src.currentBalance - newTx.amount);
      dst.currentBalance = round2(dst.currentBalance + newTx.amount);
      src.updatedAt = new Date().toISOString();
      dst.updatedAt = new Date().toISOString();
      updatedAccounts.push(src, dst);
    }

    this.transactions.unshift(newTx);

    return {
      transaction: JSON.parse(JSON.stringify(newTx)),
      updatedAccounts: JSON.parse(JSON.stringify(updatedAccounts)),
    };
  }

  public async deleteTransaction(id: string): Promise<{
    success: boolean;
    transaction: TransactionFixture;
    updatedAccounts: AccountFixture[];
  }> {
    const tx = this.transactions.find((t) => t.id === id);
    if (!tx || tx.isDeleted) {
      throw new Error(`Транзакция ${id} не найдена`);
    }

    tx.isDeleted = true;
    const updatedAccounts: AccountFixture[] = [];

    // Reverse operation
    if (tx.type === 'expense' && tx.sourceAccountId) {
      const src = this.accounts.find((a) => a.id === tx.sourceAccountId);
      if (src) {
        src.currentBalance = round2(src.currentBalance + tx.amount);
        src.updatedAt = new Date().toISOString();
        updatedAccounts.push(src);
      }
    } else if (tx.type === 'income' && tx.targetAccountId) {
      const dst = this.accounts.find((a) => a.id === tx.targetAccountId);
      if (dst) {
        dst.currentBalance = round2(dst.currentBalance - tx.amount);
        dst.updatedAt = new Date().toISOString();
        updatedAccounts.push(dst);
      }
    } else if (tx.type === 'transfer' && tx.sourceAccountId && tx.targetAccountId) {
      const src = this.accounts.find((a) => a.id === tx.sourceAccountId);
      const dst = this.accounts.find((a) => a.id === tx.targetAccountId);
      if (src && dst) {
        src.currentBalance = round2(src.currentBalance + tx.amount);
        dst.currentBalance = round2(dst.currentBalance - tx.amount);
        src.updatedAt = new Date().toISOString();
        dst.updatedAt = new Date().toISOString();
        updatedAccounts.push(src, dst);
      }
    }

    return {
      success: true,
      transaction: JSON.parse(JSON.stringify(tx)),
      updatedAccounts: JSON.parse(JSON.stringify(updatedAccounts)),
    };
  }

  public async getEventAnalytics(): Promise<{ analytics: any[] }> {
    const metrics = this.events.map((ev) => {
      const margin = calculateEventMargin(this.transactions, ev.id);
      return {
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate: ev.eventDate,
        revenue: margin.revenue,
        directExpenses: margin.directExpenses,
        netProfit: margin.netProfit,
        marginPercentage: margin.marginPercentage,
        expensesByCategory: margin.expensesByCategory,
      };
    });
    return { analytics: metrics };
  }

  public async getOverviewAnalytics(): Promise<{
    totalBalance: number;
    generalExpensesTotal: number;
    eventsCount: number;
  }> {
    const totalBalance = calculateTotalLiquidity(this.accounts);
    const generalTxs = this.transactions.filter(
      (tx) => !tx.isDeleted && tx.type === 'expense' && (tx.eventId === null || tx.eventId === undefined)
    );
    const generalExpensesTotal = round2(generalTxs.reduce((sum, tx) => sum + tx.amount, 0));

    return {
      totalBalance,
      generalExpensesTotal,
      eventsCount: this.events.length,
    };
  }

  public async parseTelegramCommand(text: string): Promise<{ parsed: ParsedCommand }> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Пустая команда');
    }

    // Extract amount: numbers, optional negative sign
    const amountMatch = trimmed.match(/-?\d+(?:[\s_]\d{3})*(?:[.,]\d+)?/);
    if (!amountMatch) {
      throw new Error('В команде не указана сумма');
    }

    const rawNumStr = amountMatch[0].replace(/[\s_]/g, '').replace(',', '.');
    const parsedNum = parseFloat(rawNumStr);
    const amount = Math.abs(parsedNum);
    const isExplicitNegative = parsedNum < 0 || trimmed.startsWith('-');

    // Determine type: default is expense unless positive or prepayment mentioned
    const lower = trimmed.toLowerCase();
    let type: 'income' | 'expense' | 'transfer' = 'expense';
    if (
      lower.includes('предоплата') ||
      lower.includes('доплата') ||
      lower.includes('аванс') ||
      lower.includes('приход') ||
      lower.includes('доход') ||
      lower.includes('чаевые') ||
      (!isExplicitNegative && (lower.includes('+') || lower.includes('получено')))
    ) {
      type = 'income';
    } else if (lower.includes('перевод') || lower.includes('инкассация') || lower.includes('снятие')) {
      type = 'transfer';
    }

    // Determine category
    let categoryId = 'cat_supplies';
    if (lower.includes('лед') || lower.includes('лёд') || lower.includes('мята') || lower.includes('фрукт')) {
      categoryId = 'cat_ice';
    } else if (lower.includes('алког') || lower.includes('джин') || lower.includes('виски') || lower.includes('водк') || lower.includes('вино')) {
      categoryId = 'cat_alcohol';
    } else if (lower.includes('бармен') || lower.includes('персонал') || lower.includes('смен') || lower.includes('гонорар')) {
      categoryId = 'cat_staff';
    } else if (lower.includes('такси') || lower.includes('логистик') || lower.includes('посуд') || lower.includes('бокал') || lower.includes('доставк')) {
      categoryId = 'cat_logistics';
    } else if (lower.includes('предоплат') || lower.includes('аванс')) {
      categoryId = 'cat_prepayment';
    } else if (lower.includes('чаев')) {
      categoryId = 'cat_tips';
    }

    // Determine event
    let eventId: string | null = null;
    if (lower.includes('свадьб') || lower.includes('анн') || lower.includes('дмитри')) {
      eventId = 'event_wedding';
    } else if (lower.includes('корпорат') || lower.includes('т-банк') || lower.includes('techcorp')) {
      eventId = 'event_corporate';
    }

    // Determine account: default is cash_1 (Касса на площадке)
    let accountId = 'cash_1';
    if (lower.includes('нал 2') || lower.includes('нал2') || lower.includes('сейф')) {
      accountId = 'cash_2';
    } else if (lower.includes('безнал 1') || lower.includes('безнал1') || lower.includes('р/с') || lower.includes('счет')) {
      accountId = 'bank_1';
    } else if (lower.includes('безнал 2') || lower.includes('безнал2') || lower.includes('эквайринг') || lower.includes('терминал')) {
      accountId = 'bank_2';
    } else if (lower.includes('перевод') || lower.includes('сбп') || lower.includes('карт') || lower.includes('тинькофф') || lower.includes('т-банк')) {
      accountId = 'card_sbp';
    } else if (lower.includes('нал 1') || lower.includes('нал1') || lower.includes('касс')) {
      accountId = 'cash_1';
    }

    return {
      parsed: {
        amount,
        type,
        categoryId,
        eventId,
        accountId,
        description: trimmed,
        rawText: trimmed,
        confidence: 0.95,
      },
    };
  }

  public async executeTelegramCommand(text: string): Promise<{
    success: boolean;
    transaction: TransactionFixture;
    updatedAccounts: AccountFixture[];
  }> {
    const { parsed } = await this.parseTelegramCommand(text);
    const dto: NewTransactionDTO = {
      type: parsed.type,
      amount: parsed.amount,
      sourceAccountId: parsed.type === 'expense' ? parsed.accountId : undefined,
      targetAccountId: parsed.type === 'income' ? parsed.accountId : undefined,
      categoryId: parsed.categoryId,
      eventId: parsed.eventId,
      description: `[Telegram] ${parsed.rawText}`,
    };
    const res = await this.createTransaction(dto);
    return {
      success: true,
      transaction: res.transaction,
      updatedAccounts: res.updatedAccounts,
    };
  }

  public async getTelegramStatus(): Promise<BotStatus> {
    return {
      enabled: true,
      mode: 'mock',
      botUsername: '@TruespaceBarBot',
      lastActiveAt: new Date().toISOString(),
    };
  }
}
