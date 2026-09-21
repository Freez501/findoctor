import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { verifyCapitalConservation, round2 } from './helpers/financial-invariants';
import { INITIAL_ACCOUNTS } from './helpers/fixtures';

describe('Tier 1: Feature Coverage F01–F05 (Core Accounts & Operations)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F01: 5-Account Balance Tracking (>=5 tests)
  // =========================================================================
  describe('F01: 5-Account Balance Tracking', () => {
    it('F01-1: should return all 5 required accounts with valid IDs and names', async () => {
      const { accounts } = await client.getAccounts();
      expect(accounts).toHaveLength(5);
      const ids = accounts.map((a) => a.id);
      expect(ids).toEqual(expect.arrayContaining(['cash_1', 'cash_2', 'bank_1', 'bank_2', 'card_sbp']));

      const names = accounts.map((a) => a.name);
      expect(names.some((n) => n.includes('Нал 1'))).toBe(true);
      expect(names.some((n) => n.includes('Нал 2'))).toBe(true);
      expect(names.some((n) => n.includes('Безнал 1'))).toBe(true);
      expect(names.some((n) => n.includes('Безнал 2'))).toBe(true);
      expect(names.some((n) => n.includes('Переводы'))).toBe(true);
    });

    it('F01-2: should verify distinct account types (cash, bank, card_transfer)', async () => {
      const { accounts } = await client.getAccounts();
      const cash1 = accounts.find((a) => a.id === 'cash_1')!;
      const cash2 = accounts.find((a) => a.id === 'cash_2')!;
      const bank1 = accounts.find((a) => a.id === 'bank_1')!;
      const bank2 = accounts.find((a) => a.id === 'bank_2')!;
      const card = accounts.find((a) => a.id === 'card_sbp')!;

      expect(cash1.type).toBe('cash');
      expect(cash2.type).toBe('cash');
      expect(bank1.type).toBe('bank');
      expect(bank2.type).toBe('bank');
      expect(card.type).toBe('card_transfer');
    });

    it('F01-3: should enforce RUB currency and ISO updated timestamp across all accounts', async () => {
      const { accounts } = await client.getAccounts();
      for (const acc of accounts) {
        expect(acc.currency).toBe('RUB');
        expect(acc.updatedAt).toBeDefined();
        expect(new Date(acc.updatedAt).getTime()).not.toBeNaN();
      }
    });

    it('F01-4: should track account balances independently without cross-bleeding', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;

      // Expense on cash_1 only
      await client.createTransaction({
        type: 'expense',
        amount: 3000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
      });

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;

      expect(cash1After).toBe(round2(cash1Before - 3000));
      expect(bank1After).toBe(bank1Before); // Untouched
    });

    it('F01-5: should contain accurate domain descriptions for each catering account', async () => {
      const { accounts } = await client.getAccounts();
      const cash1 = accounts.find((a) => a.id === 'cash_1')!;
      const bank1 = accounts.find((a) => a.id === 'bank_1')!;
      expect(cash1.description).toContain('Касса бара на площадке');
      expect(bank1.description).toContain('Основной р/с');
    });
  });

  // =========================================================================
  // F02: Expense Logging (>=5 tests)
  // =========================================================================
  describe('F02: Expense Logging', () => {
    it('F02-1: should record an expense and decrement the source account balance', async () => {
      const { accounts: before } = await client.getAccounts();
      const source = before.find((a) => a.id === 'cash_1')!;

      const result = await client.createTransaction({
        type: 'expense',
        amount: 4500,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        description: 'Закупка краш-льда для выездного бара',
      });

      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.amount).toBe(4500);
      expect(result.transaction.sourceAccountId).toBe('cash_1');
      expect(result.transaction.isDeleted).toBe(false);

      const { accounts: after } = await client.getAccounts();
      const sourceAfter = after.find((a) => a.id === 'cash_1')!;
      expect(sourceAfter.currentBalance).toBe(round2(source.currentBalance - 4500));
    });

    it('F02-2: should record an expense with event attribution', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 15000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_wedding',
        description: 'Дозакупка просекко на свадьбу',
      });

      expect(result.transaction.eventId).toBe('event_wedding');
      expect(result.transaction.categoryId).toBe('cat_alcohol');
    });

    it('F02-3: should record general bar expenses when eventId is null', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 6000,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_supplies',
        eventId: null,
        description: 'Ремонт барного блендера',
      });

      expect(result.transaction.eventId).toBeNull();
    });

    it('F02-4: should reject expense without sourceAccountId', async () => {
      await expect(
        client.createTransaction({
          type: 'expense',
          amount: 2000,
          categoryId: 'cat_ice',
        })
      ).rejects.toThrow('Для расхода необходим счёт списания');
    });

    it('F02-5: should support Russian descriptions and preserve special characters in expense records', async () => {
      const desc = 'Лёд-краш (10 мешков) + мята / лайм: 25 кг — срочно!';
      const result = await client.createTransaction({
        type: 'expense',
        amount: 8750.5,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        description: desc,
      });

      expect(result.transaction.description).toBe(desc);
      expect(result.transaction.amount).toBe(8750.5);
    });
  });

  // =========================================================================
  // F03: Income Logging (>=5 tests)
  // =========================================================================
  describe('F03: Income Logging', () => {
    it('F03-1: should record an income and increment the target account balance', async () => {
      const { accounts: before } = await client.getAccounts();
      const target = before.find((a) => a.id === 'bank_1')!;

      const result = await client.createTransaction({
        type: 'income',
        amount: 50000,
        targetAccountId: 'bank_1',
        categoryId: 'cat_prepayment',
        description: 'Доплата по безналу за корпоратив',
      });

      expect(result.transaction.type).toBe('income');
      expect(result.transaction.amount).toBe(50000);
      expect(result.transaction.targetAccountId).toBe('bank_1');

      const { accounts: after } = await client.getAccounts();
      const targetAfter = after.find((a) => a.id === 'bank_1')!;
      expect(targetAfter.currentBalance).toBe(round2(target.currentBalance + 50000));
    });

    it('F03-2: should record income attributed to an event', async () => {
      const result = await client.createTransaction({
        type: 'income',
        amount: 75000,
        targetAccountId: 'cash_2',
        categoryId: 'cat_final_payment',
        eventId: 'event_corporate',
        description: 'Финальный расчёт наличными',
      });

      expect(result.transaction.eventId).toBe('event_corporate');
      expect(result.transaction.categoryId).toBe('cat_final_payment');
    });

    it('F03-3: should record tips income to card_sbp account', async () => {
      const { accounts: before } = await client.getAccounts();
      const card = before.find((a) => a.id === 'card_sbp')!;

      const result = await client.createTransaction({
        type: 'income',
        amount: 12500,
        targetAccountId: 'card_sbp',
        categoryId: 'cat_tips',
        eventId: 'event_wedding',
        description: 'Чаевые по QR-коду гостями свадьбы',
      });

      expect(result.transaction.amount).toBe(12500);
      const { accounts: after } = await client.getAccounts();
      const cardAfter = after.find((a) => a.id === 'card_sbp')!;
      expect(cardAfter.currentBalance).toBe(round2(card.currentBalance + 12500));
    });

    it('F03-4: should reject income without targetAccountId', async () => {
      await expect(
        client.createTransaction({
          type: 'income',
          amount: 30000,
          categoryId: 'cat_prepayment',
        })
      ).rejects.toThrow('Для дохода необходим счёт зачисления');
    });

    it('F03-5: should accurately accumulate multiple sequential incomes', async () => {
      const { accounts: before } = await client.getAccounts();
      const bank2 = before.find((a) => a.id === 'bank_2')!;

      await client.createTransaction({
        type: 'income',
        amount: 10000,
        targetAccountId: 'bank_2',
        categoryId: 'cat_bar_sales',
      });
      await client.createTransaction({
        type: 'income',
        amount: 15500,
        targetAccountId: 'bank_2',
        categoryId: 'cat_bar_sales',
      });

      const { accounts: after } = await client.getAccounts();
      const bank2After = after.find((a) => a.id === 'bank_2')!;
      expect(bank2After.currentBalance).toBe(round2(bank2.currentBalance + 25500));
    });
  });

  // =========================================================================
  // F04: Inter-Account Transfer (>=5 tests)
  // =========================================================================
  describe('F04: Inter-Account Transfer', () => {
    it('F04-1: should transfer money between accounts with exact debit and credit', async () => {
      const { accounts: before } = await client.getAccounts();
      const srcBefore = before.find((a) => a.id === 'bank_1')!.currentBalance;
      const dstBefore = before.find((a) => a.id === 'cash_2')!.currentBalance;

      const result = await client.createTransaction({
        type: 'transfer',
        amount: 40000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_2',
        description: 'Снятие наличных в сейф',
      });

      expect(result.transaction.type).toBe('transfer');
      expect(result.transaction.amount).toBe(40000);

      const { accounts: after } = await client.getAccounts();
      const srcAfter = after.find((a) => a.id === 'bank_1')!.currentBalance;
      const dstAfter = after.find((a) => a.id === 'cash_2')!.currentBalance;

      expect(srcAfter).toBe(round2(srcBefore - 40000));
      expect(dstAfter).toBe(round2(dstBefore + 40000));
    });

    it('F04-2: should preserve total liquidity during an inter-account transfer', async () => {
      const { totalBalance: totalBefore } = await client.getAccounts();

      await client.createTransaction({
        type: 'transfer',
        amount: 25000,
        sourceAccountId: 'cash_2',
        targetAccountId: 'cash_1',
        description: 'Размен в кассу на площадку',
      });

      const { totalBalance: totalAfter } = await client.getAccounts();
      expect(totalAfter).toBe(totalBefore); // Total capital MUST NOT change
    });

    it('F04-3: should reject transfer when source and target accounts are identical', async () => {
      await expect(
        client.createTransaction({
          type: 'transfer',
          amount: 10000,
          sourceAccountId: 'cash_1',
          targetAccountId: 'cash_1',
        })
      ).rejects.toThrow('Счёт списания и счёт зачисления должны отличаться');
    });

    it('F04-4: should transfer funds from card_sbp to bank_1 (SBP collection)', async () => {
      const { accounts: before } = await client.getAccounts();
      const cardBefore = before.find((a) => a.id === 'card_sbp')!.currentBalance;
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;

      await client.createTransaction({
        type: 'transfer',
        amount: 18000,
        sourceAccountId: 'card_sbp',
        targetAccountId: 'bank_1',
        description: 'Инкассация чаевых с личной карты на р/с',
      });

      const { accounts: after } = await client.getAccounts();
      const cardAfter = after.find((a) => a.id === 'card_sbp')!.currentBalance;
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;

      expect(cardAfter).toBe(round2(cardBefore - 18000));
      expect(bank1After).toBe(round2(bank1Before + 18000));
    });

    it('F04-5: should not modify event margins when performing a transfer', async () => {
      const { analytics: analyticsBefore } = await client.getEventAnalytics();

      await client.createTransaction({
        type: 'transfer',
        amount: 50000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'bank_2',
      });

      const { analytics: analyticsAfter } = await client.getEventAnalytics();
      expect(analyticsAfter).toEqual(analyticsBefore); // Zero impact on event P&L
    });
  });

  // =========================================================================
  // F05: Total Liquidity Aggregation (>=5 tests)
  // =========================================================================
  describe('F05: Total Liquidity Aggregation', () => {
    it('F05-1: should compute total balance exactly matching the sum of individual accounts', async () => {
      const { accounts, totalBalance } = await client.getAccounts();
      const expected = round2(accounts.reduce((sum, a) => sum + a.currentBalance, 0));
      expect(totalBalance).toBe(expected);
    });

    it('F05-2: should increase total liquidity by exact amount after an income', async () => {
      const { totalBalance: before } = await client.getAccounts();

      await client.createTransaction({
        type: 'income',
        amount: 32000,
        targetAccountId: 'cash_1',
        categoryId: 'cat_bar_sales',
      });

      const { totalBalance: after } = await client.getAccounts();
      expect(after).toBe(round2(before + 32000));
    });

    it('F05-3: should decrease total liquidity by exact amount after an expense', async () => {
      const { totalBalance: before } = await client.getAccounts();

      await client.createTransaction({
        type: 'expense',
        amount: 14500,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_supplies',
      });

      const { totalBalance: after } = await client.getAccounts();
      expect(after).toBe(round2(before - 14500));
    });

    it('F05-4: should verify Law of Capital Conservation across complex multi-operation batches', async () => {
      await client.createTransaction({
        type: 'income',
        amount: 20000,
        targetAccountId: 'bank_1',
      });
      await client.createTransaction({
        type: 'transfer',
        amount: 15000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_1',
      });
      await client.createTransaction({
        type: 'expense',
        amount: 7500,
        sourceAccountId: 'cash_1',
      });

      const { accounts } = await client.getAccounts();
      const { transactions } = await client.getTransactions();
      const isValid = verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions);
      expect(isValid).toBe(true);
    });

    it('F05-5: should avoid floating-point math artifacts in total liquidity calculation', async () => {
      // 0.1 + 0.2 problem test
      await client.createTransaction({
        type: 'income',
        amount: 1000.1,
        targetAccountId: 'bank_1',
      });
      await client.createTransaction({
        type: 'expense',
        amount: 500.2,
        sourceAccountId: 'bank_1',
      });

      const { totalBalance } = await client.getAccounts();
      // Expect strictly 2 decimal places without trailing .000000000004
      expect(totalBalance.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });
});
