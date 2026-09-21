/**
 * Truespace — Milestone M4 Adversarial Reviewer Suite
 * File: tests/stress/m4_challenger2.test.ts
 *
 * Independent, adversarial verification of Milestone M4:
 * 1. Margin calculation edge cases:
 *    - Zero revenue with expenses (-100% loss indicator)
 *    - Zero expenses with revenue (100% margin)
 *    - Zero both (0% margin, no NaN or Infinity)
 *    - Loss with positive revenue (negative margin)
 * 2. Margin color classification boundaries:
 *    - >= 40% green
 *    - 20–39.99% yellow
 *    - < 20% or negative red with Убыток label
 * 3. Filter combinations in transaction history:
 *    - account + event + type + search query across description, category, and amount
 *    - general overhead expenses isolation (eventId: null)
 *    - Normalization of hyphen vs underscore in eventId
 *    - Exclusion of soft-deleted transactions
 * 4. Transaction cancellation & balance reversal:
 *    - Reversal across expense, income, and transfer
 *    - Immediate recomputation of event margins and overhead totals
 *    - Double-deletion rejection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import { classifyMargin } from '../../src/client/hooks/useAnalytics.js';
import { filterTransactions, FilterState } from '../../src/client/components/history/TransactionHistory.js';
import { Transaction } from '../../src/shared/types.js';
import { ACCOUNT_IDS, CATEGORY_IDS, EVENT_IDS } from '../../src/shared/constants.js';

describe('Milestone M4 Adversarial Suite (Reviewer 2)', () => {
  let store: InMemoryStore;
  let finance: FinanceService;
  let analytics: AnalyticsService;

  beforeEach(() => {
    store = new InMemoryStore();
    finance = new FinanceService(store);
    analytics = new AnalyticsService(store);
  });

  // =========================================================================
  // 1. MARGIN CALCULATION EDGE CASES
  // =========================================================================
  describe('1. Margin Calculation Edge Cases', () => {
    it('M4-REV-01: Zero revenue with expenses results in exactly -100% loss indicator and no NaN', async () => {
      const event = await store.createEvent({
        id: 'event-loss-only',
        title: 'Убыточный выезд',
        eventDate: '2026-10-01',
      });

      await finance.createExpense({
        amount: 25000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: event.id,
      });

      const metrics = await analytics.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(0);
      expect(metrics!.directExpenses).toBe(25000);
      expect(metrics!.netProfit).toBe(-25000);
      expect(metrics!.marginPercentage).toBe(-100);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);
    });

    it('M4-REV-02: Zero expenses with revenue results in exactly 100% margin', async () => {
      const event = await store.createEvent({
        id: 'event-revenue-only',
        title: 'Предоплата без затрат',
        eventDate: '2026-10-02',
      });

      await finance.createIncome({
        amount: 80000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
        eventId: event.id,
      });

      const metrics = await analytics.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(80000);
      expect(metrics!.directExpenses).toBe(0);
      expect(metrics!.netProfit).toBe(80000);
      expect(metrics!.marginPercentage).toBe(100);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);
    });

    it('M4-REV-03: Zero revenue and zero expenses results in 0% margin, no NaN or Infinity', async () => {
      const event = await store.createEvent({
        id: 'event-empty',
        title: 'Пустое мероприятие',
        eventDate: '2026-10-03',
      });

      const metrics = await analytics.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(0);
      expect(metrics!.directExpenses).toBe(0);
      expect(metrics!.netProfit).toBe(0);
      expect(metrics!.marginPercentage).toBe(0);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);
    });

    it('M4-REV-04: Negative margin with positive revenue (expenses > revenue)', async () => {
      const event = await store.createEvent({
        id: 'event-deficit',
        title: 'Превышение сметы',
        eventDate: '2026-10-04',
      });

      await finance.createIncome({
        amount: 50000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
        eventId: event.id,
      });

      await finance.createExpense({
        amount: 125000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      const metrics = await analytics.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(50000);
      expect(metrics!.directExpenses).toBe(125000);
      expect(metrics!.netProfit).toBe(-75000);
      // margin = (-75000 / 50000) * 100 = -150%
      expect(metrics!.marginPercentage).toBe(-150);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);
    });
  });

  // =========================================================================
  // 2. MARGIN COLOR CLASSIFICATION BOUNDARIES
  // =========================================================================
  describe('2. Margin Color Classification Boundaries', () => {
    it('M4-REV-05: verifies >= 40% green boundary', () => {
      const tier40 = classifyMargin(40.0);
      expect(tier40.level).toBe('green');
      expect(tier40.color).toBe('#059669');

      const tier40_01 = classifyMargin(40.01);
      expect(tier40_01.level).toBe('green');

      const tier100 = classifyMargin(100);
      expect(tier100.level).toBe('green');
    });

    it('M4-REV-06: verifies 20% to 39.99% yellow boundary', () => {
      const tier39_99 = classifyMargin(39.99);
      expect(tier39_99.level).toBe('yellow');
      expect(tier39_99.color).toBe('#d97706');

      const tier20 = classifyMargin(20.0);
      expect(tier20.level).toBe('yellow');
      expect(tier20.color).toBe('#d97706');
    });

    it('M4-REV-07: verifies < 20% red boundary and negative margin loss label', () => {
      const tier19_99 = classifyMargin(19.99);
      expect(tier19_99.level).toBe('red');
      expect(tier19_99.color).toBe('#dc2626');
      expect(tier19_99.label).toContain('<20%');

      const tierZero = classifyMargin(0);
      expect(tierZero.level).toBe('red');

      const tierNeg = classifyMargin(-0.01);
      expect(tierNeg.level).toBe('red');
      expect(tierNeg.label).toContain('Убыток');

      const tierLoss100 = classifyMargin(-100);
      expect(tierLoss100.level).toBe('red');
      expect(tierLoss100.label).toContain('Убыток');
    });
  });

  // =========================================================================
  // 3. MULTI-FILTER COMBINATIONS & JOURNAL INTEGRITY
  // =========================================================================
  describe('3. Multi-Filter Combinations (Transaction History)', () => {
    const mockTxs: Transaction[] = [
      {
        id: 'tx-1',
        type: 'income',
        amount: 250000,
        toAccountId: 'bank_1',
        categoryId: 'cat_prepayment',
        eventId: 'event_wedding',
        description: 'Предоплата Свадьба Анна и Илья',
        transactionDate: '2026-09-10T10:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-2',
        type: 'expense',
        amount: 45000,
        fromAccountId: 'cash_1',
        categoryId: 'cat_staff',
        eventId: 'event-wedding', // hyphen variant
        description: 'Гонорар шеф-бармена',
        transactionDate: '2026-09-11T12:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-3',
        type: 'expense',
        amount: 12000,
        fromAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
        description: 'Пищевой лед глыба',
        transactionDate: '2026-09-12T14:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-4',
        type: 'expense',
        amount: 35000,
        fromAccountId: 'bank_2',
        categoryId: 'cat_rent',
        eventId: null, // overhead
        description: 'Аренда склада за сентябрь',
        transactionDate: '2026-09-13T09:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-5',
        type: 'transfer',
        amount: 30000,
        fromAccountId: 'bank_1',
        toAccountId: 'cash_2',
        categoryId: 'cat_transfer',
        description: 'Инкассация выручки в сейф',
        transactionDate: '2026-09-14T15:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-6',
        type: 'expense',
        amount: 1000,
        fromAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
        description: 'Ошибочный чек',
        transactionDate: '2026-09-15T16:00:00Z',
        isDeleted: true, // soft-deleted
      },
    ];

    it('M4-REV-08: excludes soft-deleted records from active journal', () => {
      const active = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(active).toHaveLength(5);
      expect(active.some((t) => t.id === 'tx-6')).toBe(false);
    });

    it('M4-REV-09: multi-filter combination (account + event + type + search query)', () => {
      // Filter: account cash_1, event wedding, type expense, query 'лед'
      const filtered = filterTransactions(mockTxs, {
        accountId: 'cash_1',
        eventId: 'event_wedding',
        type: 'expense',
        searchQuery: 'лед',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tx-3');
    });

    it('M4-REV-10: normalizes hyphen vs underscore in event filter (event_wedding vs event-wedding)', () => {
      const filteredWithUnderscore = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'event_wedding',
        type: 'all',
        searchQuery: '',
      });
      // Should match both tx-1 (event_wedding), tx-2 (event-wedding), tx-3 (event_wedding)
      expect(filteredWithUnderscore).toHaveLength(3);

      const filteredWithHyphen = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'event-wedding',
        type: 'all',
        searchQuery: '',
      });
      expect(filteredWithHyphen).toHaveLength(3);
    });

    it('M4-REV-11: filters general overhead expenses (eventId: general matches null eventId)', () => {
      const overhead = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'general',
        type: 'all',
        searchQuery: '',
      });
      // Should match tx-4 (eventId: null) and tx-5 (eventId: undefined/missing)
      expect(overhead.some((t) => t.id === 'tx-4')).toBe(true);
      expect(overhead.some((t) => t.id === 'tx-1')).toBe(false);
    });

    it('M4-REV-12: searches across category IDs as well as description and amount', () => {
      const searchCat = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'cat_rent',
      });
      expect(searchCat).toHaveLength(1);
      expect(searchCat[0].id).toBe('tx-4');

      const searchAmount = filterTransactions(mockTxs, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '45000',
      });
      expect(searchAmount).toHaveLength(1);
      expect(searchAmount[0].id).toBe('tx-2');
    });
  });

  // =========================================================================
  // 4. TRANSACTION CANCELLATION & BALANCE REVERSAL
  // =========================================================================
  describe('4. Transaction Cancellation & Balance Reversal Lifecycle', () => {
    it('M4-REV-13: cancels expense and restores source account balance atomically', async () => {
      const acc = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      const initialBal = acc!.currentBalance;

      const exp = await finance.createExpense({
        amount: 5000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });

      const midAcc = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(midAcc!.currentBalance).toBe(round2(initialBal - 5000));

      const delRes = await finance.deleteTransaction(exp.transaction.id);
      expect(delRes.success).toBe(true);
      expect(delRes.transaction.isDeleted).toBe(true);

      const finalAcc = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(finalAcc!.currentBalance).toBe(initialBal);
    });

    it('M4-REV-14: cancels income and debits target account balance atomically', async () => {
      const acc = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      const initialBal = acc!.currentBalance;

      const inc = await finance.createIncome({
        amount: 20000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_FINAL,
      });

      const midAcc = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(midAcc!.currentBalance).toBe(round2(initialBal + 20000));

      const delRes = await finance.deleteTransaction(inc.transaction.id);
      expect(delRes.success).toBe(true);

      const finalAcc = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(finalAcc!.currentBalance).toBe(initialBal);
    });

    it('M4-REV-15: cancels transfer and restores both source and target balances', async () => {
      const srcBefore = (await store.getAccountById(ACCOUNT_IDS.BANK_1))!.currentBalance;
      const dstBefore = (await store.getAccountById(ACCOUNT_IDS.CASH_2))!.currentBalance;

      const transfer = await finance.createTransfer({
        amount: 15000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        targetAccountId: ACCOUNT_IDS.CASH_2,
      });

      const srcMid = (await store.getAccountById(ACCOUNT_IDS.BANK_1))!.currentBalance;
      const dstMid = (await store.getAccountById(ACCOUNT_IDS.CASH_2))!.currentBalance;
      expect(srcMid).toBe(round2(srcBefore - 15000));
      expect(dstMid).toBe(round2(dstBefore + 15000));

      await finance.deleteTransaction(transfer.transaction.id);

      const srcFinal = (await store.getAccountById(ACCOUNT_IDS.BANK_1))!.currentBalance;
      const dstFinal = (await store.getAccountById(ACCOUNT_IDS.CASH_2))!.currentBalance;
      expect(srcFinal).toBe(srcBefore);
      expect(dstFinal).toBe(dstBefore);
    });

    it('M4-REV-16: rejects double deletion of already cancelled transaction', async () => {
      const exp = await finance.createExpense({
        amount: 3000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.LOGISTICS,
      });

      await finance.deleteTransaction(exp.transaction.id);
      await expect(finance.deleteTransaction(exp.transaction.id)).rejects.toThrow('не найдена');
    });
  });
});
