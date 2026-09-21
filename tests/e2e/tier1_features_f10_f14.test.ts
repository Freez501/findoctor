import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2 } from './helpers/financial-invariants';

describe('Tier 1: Feature Coverage F10–F14 (Analytics, Journal & Reversals)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F10: Event Margin Dashboard (>=5 tests)
  // =========================================================================
  describe('F10: Event Margin Dashboard', () => {
    it('F10-1: should return margin metrics for all active events', async () => {
      const { analytics } = await client.getEventAnalytics();
      expect(analytics).toHaveLength(2);

      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;
      const corporate = analytics.find((a) => a.eventId === 'event_corporate')!;
      expect(wedding).toBeDefined();
      expect(corporate).toBeDefined();
    });

    it('F10-2: should verify revenue calculation equals sum of active event incomes', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      // Wedding canonical incomes: 250,000 + 50,000 = 300,000
      expect(wedding.revenue).toBe(300000);
    });

    it('F10-3: should verify direct expenses calculation equals sum of active event expenses', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      // Wedding canonical expenses: 110,000 + 45,000 + 18,000 + 12,000 + 10,000 = 195,000
      expect(wedding.directExpenses).toBe(195000);
    });

    it('F10-4: should verify net profit equals revenue minus direct expenses', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      // Net profit = 300,000 - 195,000 = 105,000
      expect(wedding.netProfit).toBe(105000);
    });

    it('F10-5: should verify margin percentage formula: (netProfit / revenue) * 100', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      // Margin % = (105,000 / 300,000) * 100 = 35.0%
      expect(wedding.marginPercentage).toBe(35.0);
    });
  });

  // =========================================================================
  // F11: Expense Category Breakdown (>=5 tests)
  // =========================================================================
  describe('F11: Expense Category Breakdown', () => {
    it('F11-1: should return expensesByCategory for each event', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;
      expect(wedding.expensesByCategory.length).toBeGreaterThanOrEqual(4);
    });

    it('F11-2: should verify sum of category amounts matches total direct expenses', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      const sumCategories = round2(
        wedding.expensesByCategory.reduce((sum, c) => sum + c.amount, 0)
      );
      expect(sumCategories).toBe(wedding.directExpenses);
    });

    it('F11-3: should verify sum of category percentages equals 100%', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      const sumPercent = round2(
        wedding.expensesByCategory.reduce((sum, c) => sum + c.percentage, 0)
      );
      expect(Math.abs(sumPercent - 100.0)).toBeLessThanOrEqual(0.1);
    });

    it('F11-4: should identify alcohol as the largest expense category in wedding catering', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;
      const alcohol = wedding.expensesByCategory.find((c) => c.categoryId === 'cat_alcohol')!;

      expect(alcohol).toBeDefined();
      expect(alcohol.amount).toBe(110000);
      expect(alcohol.percentage).toBeGreaterThan(50); // 110k / 195k = 56.41%
    });

    it('F11-5: should dynamically recompute category breakdown when a new expense is logged', async () => {
      await client.createTransaction({
        type: 'expense',
        amount: 15000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
      });

      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;
      const ice = wedding.expensesByCategory.find((c) => c.categoryId === 'cat_ice')!;

      // Initial 12,000 + 15,000 = 27,000
      expect(ice.amount).toBe(27000);
    });
  });

  // =========================================================================
  // F12: General Bar Expenses Summary (>=5 tests)
  // =========================================================================
  describe('F12: General Bar Expenses Summary', () => {
    it('F12-1: should report accurate general expenses total in overview analytics', async () => {
      const { generalExpensesTotal } = await client.getOverviewAnalytics();
      // Canonical seed: 35,000 (rent) + 8,000 (tools) = 43,000
      expect(generalExpensesTotal).toBe(43000);
    });

    it('F12-2: should increment general expenses total when a new overhead expense is recorded', async () => {
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 7000,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(round2(before + 7000));
    });

    it('F12-3: should decrement general expenses total when an overhead expense is deleted', async () => {
      // Find seed overhead expense tx_seed_15 (8,000 ₽)
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.deleteTransaction('tx_seed_15');

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(round2(before - 8000));
    });

    it('F12-4: should not change general expenses total when an event-specific expense is recorded', async () => {
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 20000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_corporate',
      });

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(before); // Untouched
    });

    it('F12-5: should return total active events count in overview analytics', async () => {
      const { eventsCount } = await client.getOverviewAnalytics();
      expect(eventsCount).toBe(2);
    });
  });

  // =========================================================================
  // F13: Filterable Transaction Journal (>=5 tests)
  // =========================================================================
  describe('F13: Filterable Transaction Journal', () => {
    it('F13-1: should return all active transactions without filter', async () => {
      const { transactions } = await client.getTransactions();
      expect(transactions.length).toBeGreaterThanOrEqual(18);
    });

    it('F13-2: should filter transactions by accountId', async () => {
      const { transactions } = await client.getTransactions({ accountId: 'cash_1' });
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.sourceAccountId === 'cash_1' || tx.targetAccountId === 'cash_1').toBe(true);
      }
    });

    it('F13-3: should filter transactions by eventId', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.eventId).toBe('event_wedding');
      }
    });

    it('F13-4: should filter transactions by type (income / expense / transfer)', async () => {
      const { transactions: transfers } = await client.getTransactions({ type: 'transfer' });
      expect(transfers.length).toBeGreaterThan(0);
      for (const tx of transfers) {
        expect(tx.type).toBe('transfer');
      }
    });

    it('F13-5: should combine filters (accountId and type)', async () => {
      const { transactions } = await client.getTransactions({
        accountId: 'bank_1',
        type: 'expense',
      });

      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.sourceAccountId).toBe('bank_1');
        expect(tx.type).toBe('expense');
      }
    });
  });

  // =========================================================================
  // F14: Transaction Reversal & Deletion (>=5 tests)
  // =========================================================================
  describe('F14: Transaction Reversal & Deletion', () => {
    it('F14-1: should reverse an expense and refund the source account', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      // Seed expense tx_seed_06: 12,000 from cash_1
      const res = await client.deleteTransaction('tx_seed_06');
      expect(res.success).toBe(true);
      expect(res.transaction.isDeleted).toBe(true);

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      expect(cash1After).toBe(round2(cash1Before + 12000));
    });

    it('F14-2: should reverse an income and debit the target account', async () => {
      const { accounts: before } = await client.getAccounts();
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;

      // Seed income tx_seed_01: 250,000 to bank_1
      const res = await client.deleteTransaction('tx_seed_01');
      expect(res.success).toBe(true);

      const { accounts: after } = await client.getAccounts();
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;
      expect(bank1After).toBe(round2(bank1Before - 250000));
    });

    it('F14-3: should reverse an inter-account transfer and restore both balances', async () => {
      const { accounts: before } = await client.getAccounts();
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;
      const cash2Before = before.find((a) => a.id === 'cash_2')!.currentBalance;

      // Seed transfer tx_seed_16: 30,000 from bank_1 to cash_2
      const res = await client.deleteTransaction('tx_seed_16');
      expect(res.success).toBe(true);

      const { accounts: after } = await client.getAccounts();
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;
      const cash2After = after.find((a) => a.id === 'cash_2')!.currentBalance;

      expect(bank1After).toBe(round2(bank1Before + 30000));
      expect(cash2After).toBe(round2(cash2Before - 30000));
    });

    it('F14-4: should recalculate event margin metrics immediately when an event expense is deleted', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const weddingBefore = before.find((a) => a.eventId === 'event_wedding')!;

      // Delete tx_seed_06 (12,000 ₽ ice expense for wedding)
      await client.deleteTransaction('tx_seed_06');

      const { analytics: after } = await client.getEventAnalytics();
      const weddingAfter = after.find((a) => a.eventId === 'event_wedding')!;

      expect(weddingAfter.directExpenses).toBe(round2(weddingBefore.directExpenses - 12000));
      expect(weddingAfter.netProfit).toBe(round2(weddingBefore.netProfit + 12000));
      expect(weddingAfter.marginPercentage).toBeGreaterThan(weddingBefore.marginPercentage);
    });

    it('F14-5: should reject attempt to delete an already deleted transaction', async () => {
      await client.deleteTransaction('tx_seed_07');
      await expect(client.deleteTransaction('tx_seed_07')).rejects.toThrow('не найдена');
    });
  });
});
