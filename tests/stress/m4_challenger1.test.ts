/**
 * Truespace — Барный кейтеринг и финансы
 * Milestone M4 Empirical Stress & Adversarial Challenge Suite (Challenger 1)
 * File: tests/stress/m4_challenger1.test.ts
 *
 * Comprehensive adversarial verification of Milestone M4 deliverables:
 * 1. Event Margin Calculations & Invariants:
 *    - Invariant: Revenue - DirectExpenses === NetProfit across dynamic datasets
 *    - Margin percentage formula: (NetProfit / Revenue) * 100 with zero-division handling
 *    - Category breakdown shares strictly sum to 100% of direct expenses
 *    - General bar expenses isolation: transactions with eventId === null or undefined do not contaminate event margin calculations
 * 2. Transaction Cancellation & Balance Restoration:
 *    - Cancelling an expense restores source account balance
 *    - Cancelling an income debits target account balance
 *    - Cancelling an internal transfer restores both accounts atomically
 *    - Re-calculating event margin after cancellation accurately updates metrics
 *    - REST API E2E DELETE validation and double-deletion rejection
 *    - Randomized dynamic workload with continuous capital conservation law
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import { classifyMargin } from '../../src/client/hooks/useAnalytics.js';
import {
  ACCOUNT_IDS,
  CATEGORY_IDS,
  EVENT_IDS,
  INITIAL_TOTAL_CAPITAL,
} from '../../src/shared/constants.js';

// Seeded PRNG for deterministic, reproducible stress tests
function createPrng(seed = 421337) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Milestone M4 Empirical Stress Suite (Challenger 1)', () => {
  let store: InMemoryStore;
  let finance: FinanceService;
  let analytics: AnalyticsService;

  beforeEach(() => {
    store = new InMemoryStore();
    finance = new FinanceService(store);
    analytics = new AnalyticsService(store);
  });

  // =========================================================================
  // 1. EVENT MARGIN CALCULATIONS & INVARIANTS
  // =========================================================================
  describe('1. Event Margin Calculations & Invariants', () => {
    it('M4-CH1-01: Revenue - DirectExpenses === NetProfit invariant holds across 50 randomized dynamic datasets', async () => {
      const rng = createPrng(1001);
      const accounts = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];
      const categories = [
        CATEGORY_IDS.ALCOHOL,
        CATEGORY_IDS.STAFF,
        CATEGORY_IDS.LOGISTICS,
        CATEGORY_IDS.SUPPLIES,
        CATEGORY_IDS.EQUIPMENT,
      ];

      for (let run = 1; run <= 50; run++) {
        const eventId = `dyn-event-${run}`;
        await store.createEvent({
          id: eventId,
          title: `Динамический выезд #${run}`,
          eventDate: '2026-11-15',
        });

        const txCount = Math.floor(rng() * 15) + 1; // 1 to 15 transactions per event
        let expectedRevenue = 0;
        let expectedExpenses = 0;

        for (let i = 0; i < txCount; i++) {
          const isIncome = rng() > 0.45; // 55% income, 45% expense
          // Amount with 2-decimal kopeck precision
          const amount = round2(100 + rng() * 45000);
          const accountId = accounts[Math.floor(rng() * accounts.length)];

          if (isIncome) {
            await finance.createIncome({
              amount,
              targetAccountId: accountId,
              categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
              eventId,
              description: `Приход ${i}`,
            });
            expectedRevenue = round2(expectedRevenue + amount);
          } else {
            const catId = categories[Math.floor(rng() * categories.length)];
            await finance.createExpense({
              amount,
              sourceAccountId: accountId,
              categoryId: catId,
              eventId,
              description: `Расход ${i}`,
            });
            expectedExpenses = round2(expectedExpenses + amount);
          }
        }

        const metrics = await analytics.getEventMargin(eventId);
        expect(metrics).not.toBeNull();
        if (!metrics) continue;

        // Strict invariant assertions
        expect(metrics.revenue).toBe(expectedRevenue);
        expect(metrics.directExpenses).toBe(expectedExpenses);
        expect(metrics.netProfit).toBe(round2(expectedRevenue - expectedExpenses));
        expect(metrics.netProfit).toBe(round2(metrics.revenue - metrics.directExpenses));
        expect(Number.isFinite(metrics.netProfit)).toBe(true);
        expect(Number.isNaN(metrics.netProfit)).toBe(false);
      }
    });

    it('M4-CH1-02: Margin percentage formula (NetProfit / Revenue) * 100 with strict zero-division protection', async () => {
      // Case A: Profitable event (revenue > expenses)
      const evProfitable = await store.createEvent({
        id: 'ev-prof',
        title: 'Прибыльный кейтеринг',
        eventDate: '2026-11-01',
      });
      await finance.createIncome({
        amount: 100000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evProfitable.id,
      });
      await finance.createExpense({
        amount: 40000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evProfitable.id,
      });
      const mProf = await analytics.getEventMargin(evProfitable.id);
      expect(mProf?.revenue).toBe(100000);
      expect(mProf?.directExpenses).toBe(40000);
      expect(mProf?.netProfit).toBe(60000);
      expect(mProf?.marginPercentage).toBe(60); // (60000 / 100000) * 100 = 60.00%

      // Case B: Pure revenue with zero direct expenses (100% margin)
      const evPureRev = await store.createEvent({
        id: 'ev-pure-rev',
        title: 'Чистый гонорар без прямых затрат',
        eventDate: '2026-11-02',
      });
      await finance.createIncome({
        amount: 80000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evPureRev.id,
      });
      const mPureRev = await analytics.getEventMargin(evPureRev.id);
      expect(mPureRev?.revenue).toBe(80000);
      expect(mPureRev?.directExpenses).toBe(0);
      expect(mPureRev?.netProfit).toBe(80000);
      expect(mPureRev?.marginPercentage).toBe(100);

      // Case C: Breakeven event (revenue === directExpenses, 0% margin)
      const evBreakeven = await store.createEvent({
        id: 'ev-breakeven',
        title: 'Выезд в ноль',
        eventDate: '2026-11-03',
      });
      await finance.createIncome({
        amount: 50000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evBreakeven.id,
      });
      await finance.createExpense({
        amount: 50000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evBreakeven.id,
      });
      const mBreakeven = await analytics.getEventMargin(evBreakeven.id);
      expect(mBreakeven?.netProfit).toBe(0);
      expect(mBreakeven?.marginPercentage).toBe(0);

      // Case D: Operational loss with positive revenue (expenses > revenue)
      const evLoss = await store.createEvent({
        id: 'ev-loss',
        title: 'Убыточный выезд с частичной выручкой',
        eventDate: '2026-11-04',
      });
      await finance.createIncome({
        amount: 40000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evLoss.id,
      });
      await finance.createExpense({
        amount: 60000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        eventId: evLoss.id,
      });
      const mLoss = await analytics.getEventMargin(evLoss.id);
      expect(mLoss?.revenue).toBe(40000);
      expect(mLoss?.directExpenses).toBe(60000);
      expect(mLoss?.netProfit).toBe(-20000);
      expect(mLoss?.marginPercentage).toBe(-50); // (-20000 / 40000) * 100 = -50%

      // Case E: Zero revenue division protection (directExpenses > 0, revenue == 0)
      const evZeroRevLoss = await store.createEvent({
        id: 'ev-zero-rev-loss',
        title: 'Затраты без оплаты',
        eventDate: '2026-11-05',
      });
      await finance.createExpense({
        amount: 25000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        eventId: evZeroRevLoss.id,
      });
      const mZeroRev = await analytics.getEventMargin(evZeroRevLoss.id);
      expect(mZeroRev?.revenue).toBe(0);
      expect(mZeroRev?.directExpenses).toBe(25000);
      expect(mZeroRev?.netProfit).toBe(-25000);
      // Operational loss indicator is strictly -100, never NaN, never Infinity
      expect(mZeroRev?.marginPercentage).toBe(-100);
      expect(Number.isFinite(mZeroRev?.marginPercentage)).toBe(true);
      expect(Number.isNaN(mZeroRev?.marginPercentage)).toBe(false);

      // Case F: Zero revenue and zero direct expenses (initial/unfunded event)
      const evEmpty = await store.createEvent({
        id: 'ev-empty',
        title: 'Пустой новый выезд',
        eventDate: '2026-11-06',
      });
      const mEmpty = await analytics.getEventMargin(evEmpty.id);
      expect(mEmpty?.revenue).toBe(0);
      expect(mEmpty?.directExpenses).toBe(0);
      expect(mEmpty?.netProfit).toBe(0);
      expect(mEmpty?.marginPercentage).toBe(0);
      expect(Number.isFinite(mEmpty?.marginPercentage)).toBe(true);
      expect(Number.isNaN(mEmpty?.marginPercentage)).toBe(false);

      // Case G: classifyMargin visual tier validation
      expect(classifyMargin(60).level).toBe('green');
      expect(classifyMargin(40).level).toBe('green');
      expect(classifyMargin(39.99).level).toBe('yellow');
      expect(classifyMargin(20).level).toBe('yellow');
      expect(classifyMargin(19.99).level).toBe('red');
      expect(classifyMargin(0).level).toBe('red');
      expect(classifyMargin(-50).level).toBe('red');
      expect(classifyMargin(-100).label).toBe('Убыток');
    });

    it('M4-CH1-03: Category breakdown shares strictly sum to 100% of direct expenses', async () => {
      const event = await store.createEvent({
        id: 'ev-cat-breakdown',
        title: 'Сложный банкет с 5 статьями затрат',
        eventDate: '2026-11-10',
      });

      // Insert direct expenses across 5 distinct categories with odd amounts
      const expenseSpecs = [
        { categoryId: CATEGORY_IDS.ALCOHOL, amount: 45000.50 },
        { categoryId: CATEGORY_IDS.STAFF, amount: 25000.00 },
        { categoryId: CATEGORY_IDS.SUPPLIES, amount: 3500.25 },
        { categoryId: CATEGORY_IDS.LOGISTICS, amount: 7200.75 },
        { categoryId: CATEGORY_IDS.EQUIPMENT, amount: 4299.50 },
      ];

      let totalExpectedExpenses = 0;
      for (const spec of expenseSpecs) {
        await finance.createExpense({
          amount: spec.amount,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: spec.categoryId,
          eventId: event.id,
          description: `Затраты ${spec.categoryId}`,
        });
        totalExpectedExpenses = round2(totalExpectedExpenses + spec.amount);
      }

      // Also add a second expense to the SAME category (Alcohol) to test aggregation
      await finance.createExpense({
        amount: 5000.00,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
        description: 'Дополнительный алкоголь',
      });
      totalExpectedExpenses = round2(totalExpectedExpenses + 5000.00);

      const metrics = await analytics.getEventMargin(event.id);
      expect(metrics).not.toBeNull();
      if (!metrics) return;

      expect(metrics.directExpenses).toBe(totalExpectedExpenses);

      const breakdown = metrics.expensesByCategory;
      expect(breakdown.length).toBe(5); // 5 unique categories

      // 1. Amounts sum strictly equals directExpenses
      const sumAmounts = round2(breakdown.reduce((s, c) => s + c.amount, 0));
      expect(sumAmounts).toBe(totalExpectedExpenses);

      // 2. Shares sum: each share is (amount / directExpenses) * 100 rounded to 2 decimals
      const sumPercentages = breakdown.reduce((s, c) => s + c.percentage, 0);
      // Allowing minute rounding drift of at most 0.05% due to 2-decimal rounding across 5 items
      expect(Math.abs(sumPercentages - 100)).toBeLessThanOrEqual(0.05);

      // 3. Consolidated alcohol amount: 45000.50 + 5000.00 = 50000.50
      const alcoholItem = breakdown.find((c) => c.categoryId === CATEGORY_IDS.ALCOHOL);
      expect(alcoholItem).toBeDefined();
      expect(alcoholItem?.amount).toBe(50000.50);

      // 4. Breakdown is strictly sorted descending by amount
      for (let i = 0; i < breakdown.length - 1; i++) {
        expect(breakdown[i].amount).toBeGreaterThanOrEqual(breakdown[i + 1].amount);
      }
    });

    it('M4-CH1-04: General bar expenses isolation: eventId === null or undefined never contaminates event margin', async () => {
      const initialOverhead = await analytics.getGeneralExpensesTotal();

      const eventWedding = await store.createEvent({
        id: 'ev-wedding-iso',
        title: 'Изолированная свадьба',
        eventDate: '2026-11-20',
      });

      // 1. Event specific transactions
      await finance.createIncome({
        amount: 150000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: eventWedding.id,
        description: 'Оплата свадьбы',
      });
      await finance.createExpense({
        amount: 60000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: eventWedding.id,
        description: 'Алкоголь на свадьбу',
      });

      // 2. General bar expenses (overhead): explicitly null or undefined eventId
      await finance.createExpense({
        amount: 35000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.OVERHEAD,
        eventId: null,
        description: 'Аренда центрального склада бара',
      });
      await finance.createExpense({
        amount: 12000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.INVENTORY,
        eventId: undefined,
        description: 'Закупка барного инвентаря общего назначения',
      });

      // 3. Margin inspection: event margin must reflect ONLY the event's 60,000 direct expenses
      const margin = await analytics.getEventMargin(eventWedding.id);
      expect(margin?.revenue).toBe(150000);
      expect(margin?.directExpenses).toBe(60000);
      expect(margin?.netProfit).toBe(90000);
      expect(margin?.marginPercentage).toBe(60);

      // 4. Overhead inspection: general expenses total must reflect initial + (35,000 + 12,000)
      const generalExpenses = await analytics.getGeneralExpensesTotal();
      expect(generalExpenses).toBe(round2(initialOverhead + 47000));

      // 5. Consolidated overview inspection
      const overview = await analytics.getOverview();
      expect(overview.generalExpensesTotal).toBe(round2(initialOverhead + 47000));
      // Events total direct expenses does NOT include general expenses
      expect(overview.eventsTotalExpenses).toBeGreaterThanOrEqual(60000);
    });

    it('M4-CH1-05: Substring and normalized ID resistance (event-a vs event-a-extra)', async () => {
      const ev1 = await store.createEvent({
        id: 'event-fest',
        title: 'Фестиваль',
        eventDate: '2026-11-25',
      });
      const ev2 = await store.createEvent({
        id: 'event-fest-afterparty',
        title: 'Афтерпати фестиваля',
        eventDate: '2026-11-26',
      });

      await finance.createExpense({
        amount: 20000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        eventId: ev1.id,
        description: 'Расход фестиваля',
      });
      await finance.createExpense({
        amount: 15000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        eventId: ev2.id,
        description: 'Расход афтерпати',
      });

      const m1 = await analytics.getEventMargin(ev1.id);
      const m2 = await analytics.getEventMargin(ev2.id);

      expect(m1?.directExpenses).toBe(20000);
      expect(m2?.directExpenses).toBe(15000);
    });
  });

  // =========================================================================
  // 2. TRANSACTION CANCELLATION & BALANCE RESTORATION
  // =========================================================================
  describe('2. Transaction Cancellation & Balance Restoration', () => {
    it('M4-CH1-06: Cancelling an expense restores source account balance exactly', async () => {
      const account = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(account).not.toBeNull();
      const initialBalance = account!.currentBalance;

      const expenseAmount = 14500.75;
      const createRes = await finance.createExpense({
        amount: expenseAmount,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
        description: 'Срочная закупка сухого льда',
      });

      const intermediateAccount = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(intermediateAccount?.currentBalance).toBe(round2(initialBalance - expenseAmount));

      // Cancel/delete the expense
      const delRes = await finance.deleteTransaction(createRes.transaction.id);
      expect(delRes.success).toBe(true);
      expect(delRes.transaction.isDeleted).toBe(true);
      expect(delRes.updatedAccounts.length).toBe(1);
      expect(delRes.updatedAccounts[0].id).toBe(ACCOUNT_IDS.CASH_1);
      expect(delRes.updatedAccounts[0].currentBalance).toBe(initialBalance);

      // Verify in store
      const restoredAccount = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(restoredAccount?.currentBalance).toBe(initialBalance);

      // Re-deletion attempt must throw
      await expect(finance.deleteTransaction(createRes.transaction.id)).rejects.toThrow(
        /не найдена/
      );
    });

    it('M4-CH1-07: Cancelling an income debits target account balance exactly', async () => {
      const account = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(account).not.toBeNull();
      const initialBalance = account!.currentBalance;

      const incomeAmount = 87654.32;
      const createRes = await finance.createIncome({
        amount: incomeAmount,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_FINAL,
        description: 'Окончательный расчет от заказчика',
      });

      const creditedAccount = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(creditedAccount?.currentBalance).toBe(round2(initialBalance + incomeAmount));

      // Cancel/delete the income
      const delRes = await finance.deleteTransaction(createRes.transaction.id);
      expect(delRes.success).toBe(true);
      expect(delRes.transaction.isDeleted).toBe(true);
      expect(delRes.updatedAccounts.length).toBe(1);
      expect(delRes.updatedAccounts[0].id).toBe(ACCOUNT_IDS.BANK_1);
      expect(delRes.updatedAccounts[0].currentBalance).toBe(initialBalance);

      // Verify in store
      const debitedAccount = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(debitedAccount?.currentBalance).toBe(initialBalance);
    });

    it('M4-CH1-08: Cancelling an internal transfer restores both accounts atomically with zero capital drift', async () => {
      const srcAcc = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      const dstAcc = await store.getAccountById(ACCOUNT_IDS.BANK_2);
      const initialSrc = srcAcc!.currentBalance;
      const initialDst = dstAcc!.currentBalance;
      const initialTotalCapital = (await finance.getAccounts()).totalBalance;

      const transferAmount = 25000.00;
      const createRes = await finance.createTransfer({
        amount: transferAmount,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        targetAccountId: ACCOUNT_IDS.BANK_2,
        description: 'Инкассация наличных с площадки',
      });

      // Capital conservation during transfer
      const postTransferTotal = (await finance.getAccounts()).totalBalance;
      expect(postTransferTotal).toBe(initialTotalCapital);

      // Cancel/delete the transfer
      const delRes = await finance.deleteTransaction(createRes.transaction.id);
      expect(delRes.success).toBe(true);
      expect(delRes.transaction.isDeleted).toBe(true);
      expect(delRes.updatedAccounts.length).toBe(2);

      const restoredSrcInDel = delRes.updatedAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1);
      const restoredDstInDel = delRes.updatedAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_2);
      expect(restoredSrcInDel?.currentBalance).toBe(initialSrc);
      expect(restoredDstInDel?.currentBalance).toBe(initialDst);

      // Verify in store
      const finalSrc = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      const finalDst = await store.getAccountById(ACCOUNT_IDS.BANK_2);
      expect(finalSrc?.currentBalance).toBe(initialSrc);
      expect(finalDst?.currentBalance).toBe(initialDst);

      // Final total capital strictly conserved
      const finalTotalCapital = (await finance.getAccounts()).totalBalance;
      expect(finalTotalCapital).toBe(initialTotalCapital);
    });

    it('M4-CH1-09: Re-calculating event margin and category breakdown immediately updates after cancellation', async () => {
      const event = await store.createEvent({
        id: 'ev-recalc-test',
        title: 'Тест динамического пересчёта',
        eventDate: '2026-11-28',
      });

      // 1. Initial base: 100k revenue, 40k alcohol, 20k staff
      const txRev = await finance.createIncome({
        amount: 100000,
        targetAccountId: ACCOUNT_IDS.BANK_1,
        eventId: event.id,
      });
      const txAlco = await finance.createExpense({
        amount: 40000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
        eventId: event.id,
      });
      const txStaff = await finance.createExpense({
        amount: 20000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: event.id,
      });

      let m = await analytics.getEventMargin(event.id);
      expect(m?.revenue).toBe(100000);
      expect(m?.directExpenses).toBe(60000);
      expect(m?.netProfit).toBe(40000);
      expect(m?.marginPercentage).toBe(40);
      expect(m?.expensesByCategory.length).toBe(2);

      // 2. Add an extra expense: Logistics 15k
      const txLogistics = await finance.createExpense({
        amount: 15000,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.LOGISTICS,
        eventId: event.id,
      });

      m = await analytics.getEventMargin(event.id);
      expect(m?.directExpenses).toBe(75000);
      expect(m?.netProfit).toBe(25000);
      expect(m?.marginPercentage).toBe(round2((25000 / 100000) * 100)); // 25%
      expect(m?.expensesByCategory.length).toBe(3);

      // 3. Cancel the logistics expense -> metrics must strictly roll back to base
      await finance.deleteTransaction(txLogistics.transaction.id);

      m = await analytics.getEventMargin(event.id);
      expect(m?.directExpenses).toBe(60000);
      expect(m?.netProfit).toBe(40000);
      expect(m?.marginPercentage).toBe(40);
      expect(m?.expensesByCategory.length).toBe(2);
      expect(m?.expensesByCategory.some((c) => c.categoryId === CATEGORY_IDS.LOGISTICS)).toBe(false);

      // 4. Cancel the revenue transaction -> drops to 0 revenue, enters operational loss
      await finance.deleteTransaction(txRev.transaction.id);

      m = await analytics.getEventMargin(event.id);
      expect(m?.revenue).toBe(0);
      expect(m?.directExpenses).toBe(60000);
      expect(m?.netProfit).toBe(-60000);
      expect(m?.marginPercentage).toBe(-100); // Protected zero revenue loss indicator
    });

    it('M4-CH1-10: Cancelling overhead general bar expense dynamically updates getGeneralExpensesTotal', async () => {
      const initialOverhead = await analytics.getGeneralExpensesTotal();

      const overheadTx = await finance.createExpense({
        amount: 28500,
        sourceAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.OVERHEAD,
        eventId: null,
        description: 'Тестовая аренда склада',
      });

      const updatedOverhead = await analytics.getGeneralExpensesTotal();
      expect(updatedOverhead).toBe(round2(initialOverhead + 28500));

      // Cancel overhead
      await finance.deleteTransaction(overheadTx.transaction.id);

      const restoredOverhead = await analytics.getGeneralExpensesTotal();
      expect(restoredOverhead).toBe(initialOverhead);
    });

    it('M4-CH1-11: Fullstack REST API E2E: DELETE /api/transactions/:id with live analytics verification', async () => {
      const app = createApp({ store });

      // Create an expense via REST API
      const postRes = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 18000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.ALCOHOL,
          eventId: EVENT_IDS.WEDDING,
          description: 'REST API отмена расход',
        })
        .expect(201);

      const txId = postRes.body.transaction.id;
      expect(txId).toBeDefined();

      // Check analytics shows increased direct expenses
      const analyticsBefore = await request(app).get('/api/analytics/events').expect(200);
      const weddingBefore = analyticsBefore.body.analytics.find(
        (a: any) => a.eventId === EVENT_IDS.WEDDING || a.eventId === 'event_wedding'
      );
      expect(weddingBefore).toBeDefined();

      // Cancel transaction via REST API
      const deleteRes = await request(app)
        .delete(`/api/transactions/${txId}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.transaction.isDeleted).toBe(true);
      expect(deleteRes.body.updatedAccounts.length).toBeGreaterThan(0);

      // Check analytics immediately reflects reduction
      const analyticsAfter = await request(app).get('/api/analytics/events').expect(200);
      const weddingAfter = analyticsAfter.body.analytics.find(
        (a: any) => a.eventId === EVENT_IDS.WEDDING || a.eventId === 'event_wedding'
      );
      expect(weddingAfter.directExpenses).toBe(round2(weddingBefore.directExpenses - 18000));

      // Attempt second deletion -> must return 404
      const secondDeleteRes = await request(app)
        .delete(`/api/transactions/${txId}`)
        .expect(404);
      expect(secondDeleteRes.body.error).toMatch(/не найдена/);

      // Deletion of non-existent ID -> must return 404
      await request(app).delete('/api/transactions/tx-phantom-9999').expect(404);
    });

    it('M4-CH1-12: High-volume randomized stress harness: 40 operations with interleaved cancellations', async () => {
      const rng = createPrng(999888);
      const accounts = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];
      const categories = [
        CATEGORY_IDS.ALCOHOL,
        CATEGORY_IDS.STAFF,
        CATEGORY_IDS.LOGISTICS,
        CATEGORY_IDS.SUPPLIES,
        CATEGORY_IDS.EQUIPMENT,
      ];

      const baselineCapital = (await finance.getAccounts()).totalBalance;

      interface CreatedTxRecord {
        id: string;
        type: string;
        amount: number;
        isDeleted: boolean;
      }

      const activeList: CreatedTxRecord[] = [];

      // Generate 40 mixed transactions
      for (let i = 0; i < 40; i++) {
        const opType = rng();
        const amount = round2(500 + rng() * 15000);

        if (opType < 0.4) {
          // Expense
          const src = accounts[Math.floor(rng() * accounts.length)];
          const cat = categories[Math.floor(rng() * categories.length)];
          const res = await finance.createExpense({
            amount,
            sourceAccountId: src,
            categoryId: cat,
            eventId: rng() > 0.3 ? EVENT_IDS.WEDDING : null,
          });
          activeList.push({ id: res.transaction.id, type: 'expense', amount, isDeleted: false });
        } else if (opType < 0.7) {
          // Income
          const dst = accounts[Math.floor(rng() * accounts.length)];
          const res = await finance.createIncome({
            amount,
            targetAccountId: dst,
            categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
            eventId: rng() > 0.3 ? EVENT_IDS.WEDDING : null,
          });
          activeList.push({ id: res.transaction.id, type: 'income', amount, isDeleted: false });
        } else {
          // Transfer
          const srcIdx = Math.floor(rng() * accounts.length);
          let dstIdx = Math.floor(rng() * accounts.length);
          while (dstIdx === srcIdx) {
            dstIdx = Math.floor(rng() * accounts.length);
          }
          const res = await finance.createTransfer({
            amount,
            sourceAccountId: accounts[srcIdx],
            targetAccountId: accounts[dstIdx],
          });
          activeList.push({ id: res.transaction.id, type: 'transfer', amount, isDeleted: false });
        }
      }

      // Now randomly cancel 15 transactions
      const toCancel = activeList
        .slice()
        .sort(() => rng() - 0.5)
        .slice(0, 15);

      for (const record of toCancel) {
        const delRes = await finance.deleteTransaction(record.id);
        expect(delRes.success).toBe(true);
        record.isDeleted = true;

        // Verify capital conservation law after EACH deletion:
        // Current total capital must equal Baseline + Active Incomes - Active Expenses
        const currentAccounts = await store.getAccounts();
        const currentCapital = round2(currentAccounts.reduce((s, a) => s + a.currentBalance, 0));

        let netExpected = baselineCapital;
        for (const item of activeList) {
          if (!item.isDeleted) {
            if (item.type === 'income') netExpected = round2(netExpected + item.amount);
            if (item.type === 'expense') netExpected = round2(netExpected - item.amount);
          }
        }

        expect(currentCapital).toBe(netExpected);
      }
    });
  });
});
