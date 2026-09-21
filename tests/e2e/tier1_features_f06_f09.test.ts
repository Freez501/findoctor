import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2 } from './helpers/financial-invariants';

describe('Tier 1: Feature Coverage F06–F09 (Quick Entry & Categorization)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F06: 3-Step 5-Second Mobile Modal (>=5 tests)
  // =========================================================================
  describe('F06: 3-Step 5-Second Mobile Modal', () => {
    it('F06-1: should process 3-step rapid payload: Type -> Amount -> Account/Category', async () => {
      // Step 1: Type ('expense')
      // Step 2: Amount (3500)
      // Step 3: Account ('cash_1') & Category ('cat_ice')
      const result = await client.createTransaction({
        type: 'expense',
        amount: 3500,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
      });

      expect(result.transaction.id).toBeDefined();
      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.amount).toBe(3500);
      expect(result.transaction.sourceAccountId).toBe('cash_1');
      expect(result.updatedAccounts).toHaveLength(1);
    });

    it('F06-2: should handle string-formatted amounts with thin spaces or commas', async () => {
      // Simulation of user entering "12 500,50" into mobile numpad
      const rawInput = '12 500,50';
      const normalizedAmount = parseFloat(rawInput.replace(/\s/g, '').replace(',', '.'));

      const result = await client.createTransaction({
        type: 'expense',
        amount: normalizedAmount,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_staff',
      });

      expect(result.transaction.amount).toBe(12500.5);
    });

    it('F06-3: should assign default category and current ISO date when not provided in quick flow', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 1200,
        sourceAccountId: 'cash_1',
      });

      expect(result.transaction.categoryId).toBe('cat_supplies'); // Safe default
      expect(result.transaction.transactionDate).toBeDefined();
      expect(new Date(result.transaction.transactionDate).getFullYear()).toBeGreaterThanOrEqual(2026);
    });

    it('F06-4: should return atomic response payload containing transaction and updated accounts', async () => {
      const result = await client.createTransaction({
        type: 'transfer',
        amount: 15000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_2',
      });

      expect(result.transaction).toBeDefined();
      expect(result.updatedAccounts).toHaveLength(2);
      const src = result.updatedAccounts.find((a) => a.id === 'bank_1');
      const dst = result.updatedAccounts.find((a) => a.id === 'cash_2');
      expect(src).toBeDefined();
      expect(dst).toBeDefined();
    });

    it('F06-5: should support fast execution within 5-second mobile usage profile', async () => {
      const startTime = Date.now();
      await client.createTransaction({
        type: 'expense',
        amount: 800,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
      });
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Must be near-instantaneous
    });
  });

  // =========================================================================
  // F07: Quick Category Selectors (>=5 tests)
  // =========================================================================
  describe('F07: Quick Category Selectors', () => {
    it('F07-1: should retrieve all preset catering categories', async () => {
      const { categories } = await client.getCategories();
      expect(categories.length).toBeGreaterThanOrEqual(7);

      const names = categories.map((c) => c.name);
      expect(names.some((n) => n.includes('Лёд'))).toBe(true);
      expect(names.some((n) => n.includes('Алкоголь'))).toBe(true);
      expect(names.some((n) => n.includes('Персонал'))).toBe(true);
      expect(names.some((n) => n.includes('Логистика'))).toBe(true);
      expect(names.some((n) => n.includes('Предоплата'))).toBe(true);
      expect(names.some((n) => n.includes('Чаевые'))).toBe(true);
    });

    it('F07-2: should distinguish expense categories from income categories', async () => {
      const { categories } = await client.getCategories();
      const expenseCats = categories.filter((c) => c.type === 'expense');
      const incomeCats = categories.filter((c) => c.type === 'income');

      expect(expenseCats.length).toBeGreaterThan(0);
      expect(incomeCats.length).toBeGreaterThan(0);
      expect(expenseCats.some((c) => c.id === 'cat_alcohol')).toBe(true);
      expect(incomeCats.some((c) => c.id === 'cat_prepayment')).toBe(true);
    });

    it('F07-3: should verify categories have color tokens for UI chips', async () => {
      const { categories } = await client.getCategories();
      for (const cat of categories) {
        expect(cat.color).toBeDefined();
        expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('F07-4: should assign selected category to the created transaction', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 25000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
      });

      expect(result.transaction.categoryId).toBe('cat_alcohol');
    });

    it('F07-5: should differentiate event-specific categories from general bar categories', async () => {
      const { categories } = await client.getCategories();
      const iceCat = categories.find((c) => c.id === 'cat_ice')!;
      const suppliesCat = categories.find((c) => c.id === 'cat_supplies')!;

      expect(iceCat.isEventSpecific).toBe(true);
      expect(suppliesCat.isEventSpecific).toBe(false);
    });
  });

  // =========================================================================
  // F08: Quick Account Chips (>=5 tests)
  // =========================================================================
  describe('F08: Quick Account Chips', () => {
    it('F08-1: should support switching source account chips effortlessly', async () => {
      const accounts = ['cash_1', 'cash_2', 'bank_1', 'bank_2', 'card_sbp'];
      for (const accId of accounts) {
        const result = await client.createTransaction({
          type: 'expense',
          amount: 500,
          sourceAccountId: accId,
          categoryId: 'cat_supplies',
        });
        expect(result.transaction.sourceAccountId).toBe(accId);
      }
    });

    it('F08-2: should support selecting target account chips for incoming payments', async () => {
      const targets = ['bank_1', 'bank_2', 'card_sbp', 'cash_2'];
      for (const targetId of targets) {
        const result = await client.createTransaction({
          type: 'income',
          amount: 2000,
          targetAccountId: targetId,
          categoryId: 'cat_tips',
        });
        expect(result.transaction.targetAccountId).toBe(targetId);
      }
    });

    it('F08-3: should verify live balance on account chip changes immediately after transaction', async () => {
      const { accounts: before } = await client.getAccounts();
      const initialCard = before.find((a) => a.id === 'card_sbp')!.currentBalance;

      await client.createTransaction({
        type: 'income',
        amount: 7700,
        targetAccountId: 'card_sbp',
        categoryId: 'cat_tips',
      });

      const { accounts: after } = await client.getAccounts();
      const updatedCard = after.find((a) => a.id === 'card_sbp')!.currentBalance;
      expect(updatedCard).toBe(round2(initialCard + 7700));
    });

    it('F08-4: should reject invalid account ID when submitted from chip', async () => {
      await expect(
        client.createTransaction({
          type: 'expense',
          amount: 1000,
          sourceAccountId: 'non_existent_acc',
        })
      ).rejects.toThrow('не найден');
    });

    it('F08-5: should present accounts in standard display order (Нал 1, Нал 2, Безнал 1, Безнал 2, Переводы)', async () => {
      const { accounts } = await client.getAccounts();
      expect(accounts[0].id).toBe('cash_1');
      expect(accounts[1].id).toBe('cash_2');
      expect(accounts[2].id).toBe('bank_1');
      expect(accounts[3].id).toBe('bank_2');
      expect(accounts[4].id).toBe('card_sbp');
    });
  });

  // =========================================================================
  // F09: General Bar Expenses Toggle (>=5 tests)
  // =========================================================================
  describe('F09: General Bar Expenses Toggle', () => {
    it('F09-1: should explicitly set eventId to null when toggle is active', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 12000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_supplies',
        eventId: null,
        description: 'Оплата клининга склада и бара',
      });

      expect(result.transaction.eventId).toBeNull();
    });

    it('F09-2: should not inflate any event direct expenses when general toggle is used', async () => {
      const { analytics: before } = await client.getEventAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 15000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      const { analytics: after } = await client.getEventAnalytics();
      expect(after).toEqual(before); // Event analytics are unpolluted
    });

    it('F09-3: should increase generalExpensesTotal in overview analytics', async () => {
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 8500,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(round2(before + 8500));
    });

    it('F09-4: should isolate general expenses in transactions query with eventId: null', async () => {
      await client.createTransaction({
        type: 'expense',
        amount: 4000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_supplies',
        eventId: null,
        description: 'Уникальный расход на салфетки',
      });

      const { transactions } = await client.getTransactions({ eventId: null as any });
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions.every((tx) => tx.eventId === null)).toBe(true);
      expect(transactions.some((tx) => tx.description?.includes('салфетки'))).toBe(true);
    });

    it('F09-5: should debit the designated account when general expenses toggle is used', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash2Before = before.find((a) => a.id === 'cash_2')!.currentBalance;

      await client.createTransaction({
        type: 'expense',
        amount: 9000,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      const { accounts: after } = await client.getAccounts();
      const cash2After = after.find((a) => a.id === 'cash_2')!.currentBalance;
      expect(cash2After).toBe(round2(cash2Before - 9000));
    });
  });
});
