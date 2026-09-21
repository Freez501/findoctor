import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2, formatRubles, calculateEventMargin } from './helpers/financial-invariants';

describe('Tier 2: Boundary & Corner Cases (Opaque-Box Edge Testing)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // Category 1: Zero Revenue Margin Calculation (>=5 tests)
  // =========================================================================
  describe('Zero Revenue Margin Division Protection', () => {
    it('T2-Z01: should return margin 0% and net profit 0 for event with 0 revenue and 0 expenses', () => {
      const margin = calculateEventMargin([], 'event_empty');
      expect(margin.revenue).toBe(0);
      expect(margin.directExpenses).toBe(0);
      expect(margin.netProfit).toBe(0);
      expect(margin.marginPercentage).toBe(0);
      expect(Number.isNaN(margin.marginPercentage)).toBe(false);
      expect(Number.isFinite(margin.marginPercentage)).toBe(true);
    });

    it('T2-Z02: should handle prep expenses with 0 revenue without NaN or Infinity', () => {
      const prepTransactions = [
        {
          id: 'tx_prep_1',
          type: 'expense' as const,
          amount: 25000,
          sourceAccountId: 'cash_1',
          categoryId: 'cat_ice',
          eventId: 'event_prep',
          transactionDate: new Date().toISOString(),
          isDeleted: false,
        },
      ];

      const margin = calculateEventMargin(prepTransactions, 'event_prep');
      expect(margin.revenue).toBe(0);
      expect(margin.directExpenses).toBe(25000);
      expect(margin.netProfit).toBe(-25000);
      // Margin must not be NaN or Infinity
      expect(Number.isNaN(margin.marginPercentage)).toBe(false);
      expect(Number.isFinite(margin.marginPercentage)).toBe(true);
      expect(margin.marginPercentage).toBe(-100);
    });

    it('T2-Z03: should transition safely from negative margin to positive when prepayment arrives', () => {
      const txs = [
        {
          id: 'tx_prep_1',
          type: 'expense' as const,
          amount: 20000,
          sourceAccountId: 'cash_1',
          categoryId: 'cat_ice',
          eventId: 'event_test',
          transactionDate: new Date().toISOString(),
          isDeleted: false,
        },
      ];

      const marginBefore = calculateEventMargin(txs, 'event_test');
      expect(marginBefore.netProfit).toBe(-20000);

      // Now income arrives
      txs.push({
        id: 'tx_income_1',
        type: 'income' as const,
        amount: 80000,
        targetAccountId: 'bank_1',
        categoryId: 'cat_prepayment',
        eventId: 'event_test',
        transactionDate: new Date().toISOString(),
        isDeleted: false,
      });

      const marginAfter = calculateEventMargin(txs, 'event_test');
      expect(marginAfter.revenue).toBe(80000);
      expect(marginAfter.directExpenses).toBe(20000);
      expect(marginAfter.netProfit).toBe(60000);
      expect(marginAfter.marginPercentage).toBe(75.0); // (60,000 / 80,000) * 100
    });

    it('T2-Z04: should compute valid category breakdown even when revenue is 0', () => {
      const txs = [
        {
          id: 'tx_1',
          type: 'expense' as const,
          amount: 15000,
          sourceAccountId: 'bank_1',
          categoryId: 'cat_alcohol',
          eventId: 'event_prep',
          transactionDate: new Date().toISOString(),
          isDeleted: false,
        },
        {
          id: 'tx_2',
          type: 'expense' as const,
          amount: 5000,
          sourceAccountId: 'cash_1',
          categoryId: 'cat_ice',
          eventId: 'event_prep',
          transactionDate: new Date().toISOString(),
          isDeleted: false,
        },
      ];

      const margin = calculateEventMargin(txs, 'event_prep');
      expect(margin.expensesByCategory).toHaveLength(2);
      const totalShare = margin.expensesByCategory.reduce((sum, c) => sum + c.percentage, 0);
      expect(round2(totalShare)).toBe(100.0);
    });

    it('T2-Z05: should format zero margin loss clearly without displaying NaN % to the user', () => {
      const margin = calculateEventMargin(
        [
          {
            id: 'tx_1',
            type: 'expense' as const,
            amount: 10000,
            sourceAccountId: 'cash_1',
            categoryId: 'cat_ice',
            eventId: 'event_zero_rev',
            transactionDate: new Date().toISOString(),
            isDeleted: false,
          },
        ],
        'event_zero_rev'
      );

      const display = margin.revenue === 0 ? '—' : `${margin.marginPercentage}%`;
      expect(display).not.toContain('NaN');
      expect(display).not.toContain('Infinity');
    });
  });

  // =========================================================================
  // Category 2: Negative Account Balance / Overdraft (>=5 tests)
  // =========================================================================
  describe('Negative Account Balance / On-Site Cash Overdraft', () => {
    it('T2-NB01: should allow emergency on-site cash expense exceeding current cash balance', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1 = before.find((a) => a.id === 'cash_1')!;

      // Spend 5000 from cash_1
      const expenseAmount = 5000;
      const res = await client.createTransaction({
        type: 'expense',
        amount: expenseAmount,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        description: 'Срочная ночная закупка сухого льда',
      });

      expect(res.transaction.amount).toBe(expenseAmount);

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1.currentBalance - expenseAmount));
      expect(cash1After.currentBalance).toBeLessThan(0); // Negative balance recorded faithfully
    });

    it('T2-NB02: should restore negative balance to positive when replenishment transfer arrives', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      // Transfer 25,000 from cash_2 to cash_1
      await client.createTransaction({
        type: 'transfer',
        amount: 25000,
        sourceAccountId: 'cash_2',
        targetAccountId: 'cash_1',
        description: 'Пополнение кассы из сейфа',
      });

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1Before + 25000));
      expect(cash1After.currentBalance).toBeGreaterThan(0);
    });

    it('T2-NB03: should correctly compute total liquidity when one or more accounts are negative', async () => {
      const { accounts: before, totalBalance: totalBefore } = await client.getAccounts();
      const cash1 = before.find((a) => a.id === 'cash_1')!;
      expect(cash1.currentBalance).toBeLessThan(0); // already negative in demo data

      const expenseAmt = 2500;
      await client.createTransaction({
        type: 'expense',
        amount: expenseAmt,
        sourceAccountId: 'cash_1',
      });

      const { totalBalance: totalAfter } = await client.getAccounts();
      expect(totalAfter).toBe(round2(totalBefore - expenseAmt));
    });

    it('T2-NB04: should format negative balance cleanly with minus sign in Russian locale', () => {
      const formatted = formatRubles(-4500.5);
      expect(formatted).toMatch(/^-4[\s\u00A0]500,5\s*₽$/);
    });

    it('T2-NB05: should accumulate multiple negative expenses without clamp to zero', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      await client.createTransaction({
        type: 'expense',
        amount: 1000,
        sourceAccountId: 'cash_1',
      });
      await client.createTransaction({
        type: 'expense',
        amount: 2000,
        sourceAccountId: 'cash_1',
      });

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1Before - 3000));
    });
  });

  // =========================================================================
  // Category 3: Self-Transfer Rejection (>=5 tests)
  // =========================================================================
  describe('Self-Transfer Rejection Invariant', () => {
    it('T2-ST01: should reject transfer from cash_1 to cash_1', async () => {
      await expect(
        client.createTransaction({
          type: 'transfer',
          amount: 5000,
          sourceAccountId: 'cash_1',
          targetAccountId: 'cash_1',
        })
      ).rejects.toThrow('Счёт списания и счёт зачисления должны отличаться');
    });

    it('T2-ST02: should reject transfer from bank_1 to bank_1', async () => {
      await expect(
        client.createTransaction({
          type: 'transfer',
          amount: 100000,
          sourceAccountId: 'bank_1',
          targetAccountId: 'bank_1',
        })
      ).rejects.toThrow('Счёт списания и счёт зачисления должны отличаться');
    });

    it('T2-ST03: should reject transfer when targetAccountId is omitted', async () => {
      await expect(
        client.createTransaction({
          type: 'transfer',
          amount: 5000,
          sourceAccountId: 'cash_1',
        })
      ).rejects.toThrow('Для перевода необходимо указать оба счёта');
    });

    it('T2-ST04: should reject transfer when sourceAccountId is omitted', async () => {
      await expect(
        client.createTransaction({
          type: 'transfer',
          amount: 5000,
          targetAccountId: 'bank_1',
        })
      ).rejects.toThrow('Для перевода необходимо указать оба счёта');
    });

    it('T2-ST05: should leave all balances unchanged after a rejected self-transfer', async () => {
      const { accounts: before } = await client.getAccounts();

      try {
        await client.createTransaction({
          type: 'transfer',
          amount: 15000,
          sourceAccountId: 'card_sbp',
          targetAccountId: 'card_sbp',
        });
      } catch {
        // Expected
      }

      const { accounts: after } = await client.getAccounts();
      expect(after).toEqual(before);
    });
  });

  // =========================================================================
  // Category 4: Invalid Amounts & Extreme Values (>=5 tests)
  // =========================================================================
  describe('Invalid Amounts & Extreme Values Validation', () => {
    it('T2-IA01: should reject amount equal to zero', async () => {
      await expect(
        client.createTransaction({
          type: 'expense',
          amount: 0,
          sourceAccountId: 'cash_1',
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');
    });

    it('T2-IA02: should reject negative amount in payload', async () => {
      await expect(
        client.createTransaction({
          type: 'income',
          amount: -500,
          targetAccountId: 'bank_1',
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');
    });

    it('T2-IA03: should reject NaN amount', async () => {
      await expect(
        client.createTransaction({
          type: 'expense',
          amount: NaN,
          sourceAccountId: 'cash_1',
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');
    });

    it('T2-IA04: should round fractional sub-kopecks safely to 2 decimals', async () => {
      const res = await client.createTransaction({
        type: 'expense',
        amount: 123.456,
        sourceAccountId: 'cash_1',
      });
      expect(res.transaction.amount).toBe(123.46);
    });

    it('T2-IA05: should handle extreme volume amount (e.g. 100,000,000 ₽) without overflow', async () => {
      const res = await client.createTransaction({
        type: 'income',
        amount: 100000000,
        targetAccountId: 'bank_1',
      });
      expect(res.transaction.amount).toBe(100000000);
    });
  });

  // =========================================================================
  // Category 5: Rapid Double Submit & Concurrency (>=5 tests)
  // =========================================================================
  describe('Rapid Double Submit & Concurrency Safety', () => {
    it('T2-DS01: should handle two rapid sequential submissions without balance corruption', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      const p1 = client.createTransaction({
        type: 'expense',
        amount: 1000,
        sourceAccountId: 'cash_1',
      });
      const p2 = client.createTransaction({
        type: 'expense',
        amount: 1000,
        sourceAccountId: 'cash_1',
      });

      await Promise.all([p1, p2]);

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1Before - 2000));
    });

    it('T2-DS02: should assign unique transaction IDs to rapid double submits', async () => {
      const [res1, res2] = await Promise.all([
        client.createTransaction({ type: 'expense', amount: 500, sourceAccountId: 'cash_1' }),
        client.createTransaction({ type: 'expense', amount: 500, sourceAccountId: 'cash_1' }),
      ]);

      expect(res1.transaction.id).not.toBe(res2.transaction.id);
    });

    it('T2-DS03: should process batch of 5 concurrent mixed transactions cleanly', async () => {
      const { totalBalance: before } = await client.getAccounts();

      await Promise.all([
        client.createTransaction({ type: 'income', amount: 10000, targetAccountId: 'bank_1' }),
        client.createTransaction({ type: 'expense', amount: 2000, sourceAccountId: 'cash_1' }),
        client.createTransaction({ type: 'transfer', amount: 5000, sourceAccountId: 'bank_1', targetAccountId: 'cash_2' }),
        client.createTransaction({ type: 'expense', amount: 3000, sourceAccountId: 'cash_2' }),
        client.createTransaction({ type: 'income', amount: 5000, targetAccountId: 'card_sbp' }),
      ]);

      // Net change: +10000 - 2000 - 3000 + 5000 = +10000
      const { totalBalance: after } = await client.getAccounts();
      expect(after).toBe(round2(before + 10000));
    });

    it('T2-DS04: should allow deleting both rapid transactions restoring initial balance', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      const res1 = await client.createTransaction({ type: 'expense', amount: 1500, sourceAccountId: 'cash_1' });
      const res2 = await client.createTransaction({ type: 'expense', amount: 2500, sourceAccountId: 'cash_1' });

      await client.deleteTransaction(res1.transaction.id);
      await client.deleteTransaction(res2.transaction.id);

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(cash1Before);
    });

    it('T2-DS05: should preserve transaction timestamps in chronological order', async () => {
      const res1 = await client.createTransaction({ type: 'expense', amount: 100, sourceAccountId: 'cash_1' });
      const res2 = await client.createTransaction({ type: 'expense', amount: 200, sourceAccountId: 'cash_1' });

      expect(new Date(res1.transaction.transactionDate).getTime()).toBeLessThanOrEqual(
        new Date(res2.transaction.transactionDate).getTime()
      );
    });
  });

  // =========================================================================
  // Category 6: NLP / Fast Command Ambiguities (>=5 tests)
  // =========================================================================
  describe('NLP / Fast Command Ambiguities', () => {
    it('T2-NLP01: should parse command with punctuation and mixed delimiters', async () => {
      const { parsed } = await client.parseTelegramCommand('!!! 4500 ,,, лед ??? нал1');
      expect(parsed.amount).toBe(4500);
      expect(parsed.categoryId).toBe('cat_ice');
      expect(parsed.accountId).toBe('cash_1');
    });

    it('T2-NLP02: should parse command in all uppercase letters', async () => {
      const { parsed } = await client.parseTelegramCommand('80000 ПРЕДОПЛАТА СВАДЬБА БЕЗНАЛ1');
      expect(parsed.amount).toBe(80000);
      expect(parsed.type).toBe('income');
      expect(parsed.categoryId).toBe('cat_prepayment');
      expect(parsed.eventId).toBe('event_wedding');
      expect(parsed.accountId).toBe('bank_1');
    });

    it('T2-NLP03: should parse numbers with space thousand separator e.g. "120 000"', async () => {
      const { parsed } = await client.parseTelegramCommand('120 000 алкоголь Свадьба безнал1');
      expect(parsed.amount).toBe(120000);
      expect(parsed.categoryId).toBe('cat_alcohol');
    });

    it('T2-NLP04: should parse Russian bar colloquialisms e.g. "джин", "виски"', async () => {
      const { parsed } = await client.parseTelegramCommand('15000 джин и тоник нал2');
      expect(parsed.amount).toBe(15000);
      expect(parsed.categoryId).toBe('cat_alcohol');
      expect(parsed.accountId).toBe('cash_2');
    });

    it('T2-NLP05: should parse SBP card mentions ("тинькофф", "т-банк", "карта")', async () => {
      const { parsed } = await client.parseTelegramCommand('5000 чаевые тинькофф');
      expect(parsed.amount).toBe(5000);
      expect(parsed.type).toBe('income');
      expect(parsed.categoryId).toBe('cat_tips');
      expect(parsed.accountId).toBe('card_sbp');
    });
  });
});
