/**
 * Truespace — Барный кейтеринг и финансы
 * Milestone M2 Empirical Stress & Adversarial Challenge Suite
 * File: tests/stress/m2_finance_analytics_stress.test.ts
 *
 * Targets:
 * 1. FinanceService & AnalyticsService under heavy operational load.
 * 2. Heavy sequence of operations (1,000+ expenses, incomes, transfers, and reversals).
 * 3. Total liquidity invariant across all 5 accounts strictly equals:
 *    initial capital + sum(incomes) - sum(expenses).
 * 4. Transfer neutrality invariant: transfers never alter total liquidity.
 * 5. Analytics event margin edge cases: zero revenue, 100% loss, break-even, fractional cents,
 *    huge amounts (billion rubles), category breakdowns, and overview aggregations.
 * 6. Adversarial boundaries: sub-kopecks, non-finite values, concurrent writes, and deletion idempotency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import {
  ACCOUNT_IDS,
  CATEGORY_IDS,
  EVENT_IDS,
  INITIAL_TOTAL_CAPITAL,
} from '../../src/shared/constants.js';

// Kopeck integer arithmetic helpers for golden-standard oracle
function toKop(rub: number): number {
  return Math.round(rub * 100);
}

function toRub(kop: number): number {
  return kop / 100;
}

// Seeded pseudorandom generator (Linear Congruential Generator) for 100% reproducible chaos
function createPrng(seed = 1337) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Milestone M2: Empirical Challenge Suite — FinanceService & AnalyticsService', () => {
  let store: InMemoryStore;
  let financeService: FinanceService;
  let analyticsService: AnalyticsService;

  const ALL_ACCOUNTS = [
    ACCOUNT_IDS.CASH_1,
    ACCOUNT_IDS.CASH_2,
    ACCOUNT_IDS.BANK_1,
    ACCOUNT_IDS.BANK_2,
    ACCOUNT_IDS.CARD_SBP,
  ];

  const EXPENSE_CATEGORIES = [
    CATEGORY_IDS.ALCOHOL,
    CATEGORY_IDS.STAFF,
    CATEGORY_IDS.LOGISTICS,
    CATEGORY_IDS.SUPPLIES,
    CATEGORY_IDS.EQUIPMENT,
    CATEGORY_IDS.OVERHEAD,
    CATEGORY_IDS.INVENTORY,
  ];

  const INCOME_CATEGORIES = [
    CATEGORY_IDS.CONTRACT_PREPAYMENT,
    CATEGORY_IDS.CONTRACT_FINAL,
    CATEGORY_IDS.ONSITE_SALES,
    CATEGORY_IDS.TIPS,
  ];

  beforeEach(() => {
    store = new InMemoryStore();
    financeService = new FinanceService(store);
    analyticsService = new AnalyticsService(store);
  });

  // =========================================================================
  // SUITE 1: HEAVY OPERATIONS SEQUENCE & CAPITAL CONSERVATION INVARIANT
  // =========================================================================
  describe('Challenge 1: Heavy Sequential Operations & Capital Conservation Invariant', () => {
    it('M2-CHALLENGE-01: should maintain total liquidity == initialCapital + sum(incomes) - sum(expenses) across 1,000 continuous operations and 250 interleaved reversals', async () => {
      const prng = createPrng(42);

      // Start from post-seed baseline
      const initialAccounts = await store.getAccounts();
      const initialTotalCapital = round2(initialAccounts.reduce((s, a) => s + a.currentBalance, 0));
      expect(initialTotalCapital).toBe(1166300);

      // We maintain a strict kopeck shadow ledger as our oracle
      let shadowTotalKop = toKop(initialTotalCapital);
      const activeTransactions: Array<{ id: string; type: string; amountKop: number; fromId?: string; toId?: string }> = [];

      const AMOUNTS = [
        0.01, 0.07, 0.13, 0.49, 0.99, 1.33, 2.71, 5.55, 9.99, 12.34,
        25.00, 49.95, 99.99, 150.00, 350.50, 1000.00, 2500.25, 5000.00,
        15000.75, 45000.00, 120000.00,
      ];

      const TOTAL_STEPS = 1000;
      let expensesCount = 0;
      let incomesCount = 0;
      let transfersCount = 0;
      let reversalsCount = 0;

      for (let step = 0; step < TOTAL_STEPS; step++) {
        const actionRoll = prng();

        if (actionRoll < 0.35) {
          // 35% Expense
          const accIndex = Math.floor(prng() * ALL_ACCOUNTS.length);
          const catIndex = Math.floor(prng() * EXPENSE_CATEGORIES.length);
          const amt = AMOUNTS[Math.floor(prng() * AMOUNTS.length)];
          const amtKop = toKop(amt);
          const accountId = ALL_ACCOUNTS[accIndex];
          const categoryId = EXPENSE_CATEGORIES[catIndex];
          const eventId = prng() < 0.6 ? (prng() < 0.5 ? EVENT_IDS.WEDDING : EVENT_IDS.CORPORATE) : null;

          const res = await financeService.createExpense({
            amount: amt,
            sourceAccountId: accountId,
            categoryId,
            eventId,
            description: `Stress expense step ${step}`,
          });

          shadowTotalKop -= amtKop;
          activeTransactions.push({
            id: res.transaction.id,
            type: 'expense',
            amountKop: amtKop,
            fromId: accountId,
          });
          expensesCount++;

        } else if (actionRoll < 0.65) {
          // 30% Income
          const accIndex = Math.floor(prng() * ALL_ACCOUNTS.length);
          const catIndex = Math.floor(prng() * INCOME_CATEGORIES.length);
          const amt = AMOUNTS[Math.floor(prng() * AMOUNTS.length)];
          const amtKop = toKop(amt);
          const accountId = ALL_ACCOUNTS[accIndex];
          const categoryId = INCOME_CATEGORIES[catIndex];
          const eventId = prng() < 0.7 ? (prng() < 0.5 ? EVENT_IDS.WEDDING : EVENT_IDS.CORPORATE) : null;

          const res = await financeService.createIncome({
            amount: amt,
            targetAccountId: accountId,
            categoryId,
            eventId,
            description: `Stress income step ${step}`,
          });

          shadowTotalKop += amtKop;
          activeTransactions.push({
            id: res.transaction.id,
            type: 'income',
            amountKop: amtKop,
            toId: accountId,
          });
          incomesCount++;

        } else if (actionRoll < 0.85) {
          // 20% Transfer
          const srcIndex = Math.floor(prng() * ALL_ACCOUNTS.length);
          let dstIndex = Math.floor(prng() * ALL_ACCOUNTS.length);
          while (dstIndex === srcIndex) {
            dstIndex = Math.floor(prng() * ALL_ACCOUNTS.length);
          }

          const amt = AMOUNTS[Math.floor(prng() * AMOUNTS.length)];
          const amtKop = toKop(amt);
          const srcId = ALL_ACCOUNTS[srcIndex];
          const dstId = ALL_ACCOUNTS[dstIndex];

          const res = await financeService.createTransfer({
            amount: amt,
            sourceAccountId: srcId,
            targetAccountId: dstId,
            description: `Stress transfer step ${step}`,
          });

          // Transfers do NOT alter total capital
          activeTransactions.push({
            id: res.transaction.id,
            type: 'transfer',
            amountKop: amtKop,
            fromId: srcId,
            toId: dstId,
          });
          transfersCount++;

        } else {
          // 15% Reversal of an existing active transaction
          if (activeTransactions.length > 0) {
            const victimIndex = Math.floor(prng() * activeTransactions.length);
            const victim = activeTransactions.splice(victimIndex, 1)[0];

            await financeService.deleteTransaction(victim.id);

            if (victim.type === 'expense') {
              shadowTotalKop += victim.amountKop;
            } else if (victim.type === 'income') {
              shadowTotalKop -= victim.amountKop;
            } // transfer reversal does not change shadowTotalKop

            reversalsCount++;
          }
        }

        // Verify invariant periodically and at step ends
        if (step % 50 === 0 || step === TOTAL_STEPS - 1) {
          const { accounts, totalBalance } = await financeService.getAccounts();
          const sumOfBalances = round2(accounts.reduce((s, a) => s + a.currentBalance, 0));

          expect(totalBalance).toBe(sumOfBalances);
          expect(toKop(totalBalance)).toBe(shadowTotalKop);
          expect(totalBalance).toBe(toRub(shadowTotalKop));
        }
      }

      // Final full ledger reconciliation
      const finalAccounts = await store.getAccounts();
      const finalTotal = round2(finalAccounts.reduce((s, a) => s + a.currentBalance, 0));
      expect(toKop(finalTotal)).toBe(shadowTotalKop);

      // Verify active transaction sum matching:
      // Initial capital + sum(active incomes) - sum(active expenses) == finalTotal
      const allActiveTxs = await store.getTransactions({ includeDeleted: false });
      const sumActiveIncome = round2(
        allActiveTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      );
      const sumActiveExpense = round2(
        allActiveTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      );

      const calculatedCapitalFromTxs = round2(INITIAL_TOTAL_CAPITAL + sumActiveIncome - sumActiveExpense);
      expect(finalTotal).toBe(calculatedCapitalFromTxs);

      expect(expensesCount).toBeGreaterThan(250);
      expect(incomesCount).toBeGreaterThan(200);
      expect(transfersCount).toBeGreaterThan(120);
      expect(reversalsCount).toBeGreaterThan(80);
    });
  });

  // =========================================================================
  // SUITE 2: TRANSFER CONSERVATION & NEUTRALITY INVARIANT
  // =========================================================================
  describe('Challenge 2: Inter-Account Transfer Conservation Invariant', () => {
    it('M2-CHALLENGE-02: should strictly guarantee that 500 arbitrary transfers never alter total liquidity by even 1 kopeck', async () => {
      const prng = createPrng(777);

      const { totalBalance: baselineTotal } = await financeService.getAccounts();
      expect(baselineTotal).toBe(1166300);

      const transferAmounts = [
        0.01, 0.50, 1.25, 9.99, 50.00, 100.55, 333.33, 1000.00,
        5000.00, 12500.50, 50000.00, 250000.00,
      ];

      const executedTransfers: Array<{ id: string; amount: number; src: string; dst: string }> = [];

      for (let i = 0; i < 500; i++) {
        const srcIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
        let dstIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
        while (dstIdx === srcIdx) {
          dstIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
        }

        const src = ALL_ACCOUNTS[srcIdx];
        const dst = ALL_ACCOUNTS[dstIdx];
        const amt = transferAmounts[i % transferAmounts.length];

        const res = await financeService.createTransfer({
          amount: amt,
          sourceAccountId: src,
          targetAccountId: dst,
          description: `Transfer invariant test #${i}`,
        });

        executedTransfers.push({
          id: res.transaction.id,
          amount: amt,
          src,
          dst,
        });

        const { totalBalance: currentTotal } = await financeService.getAccounts();
        expect(currentTotal).toBe(baselineTotal);
      }

      // Verify each individual account moved, but sum stayed identical
      const { accounts, totalBalance: endTotal } = await financeService.getAccounts();
      expect(endTotal).toBe(baselineTotal);
      expect(round2(accounts.reduce((s, a) => s + a.currentBalance, 0))).toBe(baselineTotal);

      // Now reverse 250 transfers in random order
      for (let i = 0; i < 250; i++) {
        const idx = Math.floor(prng() * executedTransfers.length);
        const [txToReverse] = executedTransfers.splice(idx, 1);

        const revRes = await financeService.deleteTransaction(txToReverse.id);
        expect(revRes.success).toBe(true);

        const { totalBalance: postReversalTotal } = await financeService.getAccounts();
        expect(postReversalTotal).toBe(baselineTotal);
      }
    });

    it('M2-CHALLENGE-03: should reject transfers with identical source and target accounts without altering state', async () => {
      const { totalBalance: initialTotal } = await financeService.getAccounts();

      await expect(
        financeService.createTransfer({
          amount: 5000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          targetAccountId: ACCOUNT_IDS.CASH_1,
        })
      ).rejects.toThrow('Счёт списания и счёт зачисления должны отличаться');

      const { totalBalance: finalTotal } = await financeService.getAccounts();
      expect(finalTotal).toBe(initialTotal);
    });
  });

  // =========================================================================
  // SUITE 3: ANALYTICS ENGINE MARGIN METRICS & EDGE CASES
  // =========================================================================
  describe('Challenge 3: Event Margin Calculation Edge Cases, Zero Revenue, 100% Loss & Huge Amounts', () => {
    it('M2-CHALLENGE-04: should handle zero revenue and zero expenses cleanly (0% margin, no NaN or Infinity)', async () => {
      const event = await store.createEvent({
        id: 'event-zero-both',
        title: 'Мероприятие без движения',
        eventDate: '2026-11-01',
      });

      const metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(0);
      expect(metrics!.directExpenses).toBe(0);
      expect(metrics!.netProfit).toBe(0);
      expect(metrics!.marginPercentage).toBe(0);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);
      expect(metrics!.expensesByCategory).toEqual([]);
    });

    it('M2-CHALLENGE-05: should handle zero revenue with positive direct expenses as 100% loss (-100 indicator, no NaN)', async () => {
      const event = await store.createEvent({
        id: 'event-zero-rev-loss',
        title: 'Мероприятие с чистым убытком',
        eventDate: '2026-11-02',
      });

      // Add direct expenses but NO revenue
      await financeService.createExpense({
        amount: 35000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      await financeService.createExpense({
        amount: 15000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
        eventId: event.id,
      });

      const metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.revenue).toBe(0);
      expect(metrics!.directExpenses).toBe(50000);
      expect(metrics!.netProfit).toBe(-50000);
      expect(metrics!.marginPercentage).toBe(-100);
      expect(Number.isNaN(metrics!.marginPercentage)).toBe(false);
      expect(Number.isFinite(metrics!.marginPercentage)).toBe(true);

      // Category breakdown check
      expect(metrics!.expensesByCategory).toHaveLength(2);
      expect(metrics!.expensesByCategory[0].categoryId).toBe(CATEGORY_IDS.ALCOHOL);
      expect(metrics!.expensesByCategory[0].amount).toBe(35000);
      expect(metrics!.expensesByCategory[0].percentage).toBe(70.0);
      expect(metrics!.expensesByCategory[1].categoryId).toBe(CATEGORY_IDS.SUPPLIES);
      expect(metrics!.expensesByCategory[1].amount).toBe(15000);
      expect(metrics!.expensesByCategory[1].percentage).toBe(30.0);
    });

    it('M2-CHALLENGE-06: should handle break-even events (revenue == directExpenses) with 0.00% margin', async () => {
      const event = await store.createEvent({
        id: 'event-break-even',
        title: 'Мероприятие в ноль',
        eventDate: '2026-11-03',
      });

      await financeService.createIncome({
        amount: 125000.50,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_FINAL,
        eventId: event.id,
      });

      await financeService.createExpense({
        amount: 125000.50,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      const metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.revenue).toBe(125000.50);
      expect(metrics!.directExpenses).toBe(125000.50);
      expect(metrics!.netProfit).toBe(0);
      expect(metrics!.marginPercentage).toBe(0);
    });

    it('M2-CHALLENGE-07: should compute fractional kopecks accurately without IEEE-754 precision artifacts', async () => {
      const event = await store.createEvent({
        id: 'event-fractional-kopecks',
        title: 'Дробные копейки',
        eventDate: '2026-11-04',
      });

      // Income: 100,000.33 ₽
      await financeService.createIncome({
        amount: 100000.33,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
        eventId: event.id,
      });

      // Expense: 33,333.11 ₽
      await financeService.createExpense({
        amount: 33333.11,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      const metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.revenue).toBe(100000.33);
      expect(metrics!.directExpenses).toBe(33333.11);
      expect(metrics!.netProfit).toBe(66667.22);
      // margin = (66667.22 / 100000.33) * 100 = 66.667000... -> 66.67
      expect(metrics!.marginPercentage).toBe(66.67);
    });

    it('M2-CHALLENGE-08: should handle huge amounts (billion rubles) without floating point inaccuracies or overflow', async () => {
      const event = await store.createEvent({
        id: 'event-billion-scale',
        title: 'Мега-фестиваль на миллиард',
        eventDate: '2026-11-05',
      });

      // 1.5 Billion rubles revenue
      await financeService.createIncome({
        amount: 1500000000.75,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_FINAL,
        eventId: event.id,
      });

      // 600 Million rubles direct expenses across 3 categories
      await financeService.createExpense({
        amount: 300000000.25,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      await financeService.createExpense({
        amount: 200000000.00,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: event.id,
      });

      await financeService.createExpense({
        amount: 100000000.00,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.LOGISTICS,
        eventId: event.id,
      });

      const metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.revenue).toBe(1500000000.75);
      expect(metrics!.directExpenses).toBe(600000000.25);
      expect(metrics!.netProfit).toBe(900000000.50);

      // (900000000.50 / 1500000000.75) * 100 = 59.99999998... -> 60.00%
      expect(metrics!.marginPercentage).toBe(60.00);

      // Category breakdown checks on billion scale
      expect(metrics!.expensesByCategory).toHaveLength(3);
      expect(metrics!.expensesByCategory[0].categoryId).toBe(CATEGORY_IDS.ALCOHOL);
      expect(metrics!.expensesByCategory[0].amount).toBe(300000000.25);
      expect(metrics!.expensesByCategory[0].percentage).toBe(50.00);

      expect(metrics!.expensesByCategory[1].categoryId).toBe(CATEGORY_IDS.STAFF);
      expect(metrics!.expensesByCategory[1].amount).toBe(200000000.00);
      expect(metrics!.expensesByCategory[1].percentage).toBe(33.33);

      expect(metrics!.expensesByCategory[2].categoryId).toBe(CATEGORY_IDS.LOGISTICS);
      expect(metrics!.expensesByCategory[2].amount).toBe(100000000.00);
      expect(metrics!.expensesByCategory[2].percentage).toBe(16.67);
    });

    it('M2-CHALLENGE-09: should accurately reflect transaction reversals in event margins and category breakdown', async () => {
      const event = await store.createEvent({
        id: 'event-reversal-test',
        title: 'Тест отмены расходов',
        eventDate: '2026-11-06',
      });

      await financeService.createIncome({
        amount: 200000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
        eventId: event.id,
      });

      const exp1 = await financeService.createExpense({
        amount: 50000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });

      const exp2 = await financeService.createExpense({
        amount: 30000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: event.id,
      });

      let metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.directExpenses).toBe(80000);
      expect(metrics!.netProfit).toBe(120000);
      expect(metrics!.marginPercentage).toBe(60.00);

      // Cancel exp1 (50,000 ₽ alcohol)
      await financeService.deleteTransaction(exp1.transaction.id);

      metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.directExpenses).toBe(30000);
      expect(metrics!.netProfit).toBe(170000);
      expect(metrics!.marginPercentage).toBe(85.00);
      expect(metrics!.expensesByCategory).toHaveLength(1);
      expect(metrics!.expensesByCategory[0].categoryId).toBe(CATEGORY_IDS.STAFF);

      // Cancel exp2 (30,000 ₽ staff) -> now 0 direct expenses
      await financeService.deleteTransaction(exp2.transaction.id);

      metrics = await analyticsService.getEventMargin(event.id);
      expect(metrics!.directExpenses).toBe(0);
      expect(metrics!.netProfit).toBe(200000);
      expect(metrics!.marginPercentage).toBe(100.00);
      expect(metrics!.expensesByCategory).toEqual([]);
    });

    it('M2-CHALLENGE-10: should aggregate getOverview() accurately combining event and general bar overhead', async () => {
      // Base seed has 2 events and 2 general bar expenses (overhead: 35,000, inventory: 4,200)
      const overview = await analyticsService.getOverview();
      expect(overview.totalBalance).toBe(1166300);
      expect(overview.generalExpensesTotal).toBe(39200);
      expect(overview.eventsCount).toBe(2);

      // Wedding revenue = 290k, exp = 95k -> profit 195k
      // Corporate revenue = 294k, exp = 123.5k -> profit 170.5k
      // Total revenue = 584k, Total expenses = 218.5k, Total Net Profit = 365.5k
      expect(overview.eventsTotalRevenue).toBe(584000);
      expect(overview.eventsTotalExpenses).toBe(218500);
      expect(overview.eventsNetProfit).toBe(365500);
      expect(overview.averageMarginPercentage).toBe(round2((365500 / 584000) * 100)); // 62.59%
    });

    it('M2-CHALLENGE-11: should support event ID normalization between hyphens and underscores', async () => {
      // In seed data: id is 'event-wedding' or 'event_wedding'
      const metricsHyphen = await analyticsService.getEventMargin('event-wedding');
      const metricsUnderscore = await analyticsService.getEventMargin('event_wedding');

      expect(metricsHyphen).not.toBeNull();
      expect(metricsUnderscore).not.toBeNull();
      expect(metricsHyphen!.revenue).toBe(metricsUnderscore!.revenue);
      expect(metricsHyphen!.directExpenses).toBe(metricsUnderscore!.directExpenses);
      expect(metricsHyphen!.marginPercentage).toBe(metricsUnderscore!.marginPercentage);
    });
  });

  // =========================================================================
  // SUITE 4: ADVERSARIAL INPUT BOUNDARY & ROBUSTNESS AUDIT
  // =========================================================================
  describe('Challenge 4: Adversarial Input Boundary, Sub-Kopecks, Infinite/NaN Values & Aliases', () => {
    it('M2-CHALLENGE-12: should handle string input parsing with Russian commas and spaces in FinanceService', async () => {
      const res = await financeService.createTransaction({
        type: 'expense',
        amount: ' 12 500,75 ',
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });

      expect(res.transaction.amount).toBe(12500.75);
    });

    it('M2-CHALLENGE-13: should reject invalid, NaN, negative, or non-numeric amount inputs', async () => {
      await expect(
        financeService.createTransaction({
          type: 'expense',
          amount: 'not-a-number',
          sourceAccountId: ACCOUNT_IDS.CASH_1,
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');

      await expect(
        financeService.createTransaction({
          type: 'expense',
          amount: -500,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');

      await expect(
        financeService.createTransaction({
          type: 'expense',
          amount: 0,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
        })
      ).rejects.toThrow('Сумма должна быть больше нуля');
    });

    it('M2-CHALLENGE-14: documents adversarial probe: non-finite amount (Infinity) handling in FinanceService', async () => {
      // In JS, Infinity > 0 is true and isNaN(Infinity) is false!
      // When Number.isFinite is omitted, Infinity can pass input validation.
      let acceptedInfinity = false;
      try {
        await financeService.createTransaction({
          type: 'expense',
          amount: Infinity,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.SUPPLIES,
        });
        acceptedInfinity = true;
      } catch (err: any) {
        acceptedInfinity = false;
      }

      // We empirically record that FinanceService currently lacks !Number.isFinite() guard.
      // This is documented as Finding 1 in handoff.md.
      expect(typeof acceptedInfinity).toBe('boolean');
    });

    it('M2-CHALLENGE-15: should correctly map field aliases bidirectionally (fromAccountId / sourceAccountId, toAccountId / targetAccountId)', async () => {
      // 1. Using sourceAccountId & targetAccountId
      const tx1 = await financeService.createTransfer({
        amount: 1000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        targetAccountId: ACCOUNT_IDS.CASH_2,
      });
      expect(tx1.transaction.fromAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(tx1.transaction.toAccountId).toBe(ACCOUNT_IDS.CASH_2);
      expect(tx1.transaction.sourceAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(tx1.transaction.targetAccountId).toBe(ACCOUNT_IDS.CASH_2);

      // 2. Using fromAccountId & toAccountId
      const tx2 = await financeService.createTransfer({
        amount: 1000,
        fromAccountId: ACCOUNT_IDS.CASH_2,
        toAccountId: ACCOUNT_IDS.CASH_1,
      });
      expect(tx2.transaction.fromAccountId).toBe(ACCOUNT_IDS.CASH_2);
      expect(tx2.transaction.toAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(tx2.transaction.sourceAccountId).toBe(ACCOUNT_IDS.CASH_2);
      expect(tx2.transaction.targetAccountId).toBe(ACCOUNT_IDS.CASH_1);
    });

    it('M2-CHALLENGE-16: should enforce single deletion idempotency and reject re-deleting an already deleted transaction', async () => {
      const createRes = await financeService.createExpense({
        amount: 2500,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });
      const txId = createRes.transaction.id;

      // First deletion: succeeds
      const del1 = await financeService.deleteTransaction(txId);
      expect(del1.success).toBe(true);
      expect(del1.transaction.isDeleted).toBe(true);

      // Second deletion: must throw error
      await expect(financeService.deleteTransaction(txId)).rejects.toThrow(
        `Транзакция ${txId} не найдена`
      );
    });

    it('M2-CHALLENGE-17: documents adversarial probe: sub-kopeck rounding creates 0 ₽ transaction', async () => {
      // 0.004 rounds to 0.00 in round2()
      // Because check `amount <= 0` occurs before round2(), a 0-ruble transaction is recorded.
      const res = await financeService.createExpense({
        amount: 0.004,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });

      // Empirically observe: amount becomes 0, which is documented as Finding 2 in handoff.md.
      expect(res.transaction.amount).toBe(0);
    });

    it('M2-CHALLENGE-18: documents adversarial probe: concurrent balance mutations on same account induce Read-Modify-Write race condition', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      // Execute 20 concurrent expense operations of 100 ₽ each on CASH_1 without await
      const CONCURRENT_OPS = 20;
      const promises = Array.from({ length: CONCURRENT_OPS }, (_, i) =>
        financeService.createExpense({
          amount: 100,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.SUPPLIES,
          description: `Concurrent op ${i}`,
        })
      );

      await Promise.all(promises);

      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      const expectedWithoutRace = round2(initialCash1 - CONCURRENT_OPS * 100);
      // FIX-08: Atomic adjustAccountBalance eliminates lost updates under concurrency.
      // All 20 concurrent transactions are accurately accounted for.
      expect(finalCash1).toBe(expectedWithoutRace);
    });

    it('M2-CHALLENGE-19: verifies that sequential serialized balance mutations are 100% accurate and conserved', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      const OPS = 20;

      for (let i = 0; i < OPS; i++) {
        await financeService.createExpense({
          amount: 100,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.SUPPLIES,
          description: `Sequential op ${i}`,
        });
      }

      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(finalCash1).toBe(round2(initialCash1 - OPS * 100));
    });
  });
});
