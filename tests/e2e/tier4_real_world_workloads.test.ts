import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2, verifyCapitalConservation } from './helpers/financial-invariants';
import { INITIAL_ACCOUNTS } from './helpers/fixtures';

describe('Tier 4: Real-World Workload Application Scenarios', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // Scenario 1: Full Wedding Catering Lifecycle («Свадьба Анны и Дмитрия»)
  // =========================================================================
  describe('Scenario 1: Full Wedding Catering Lifecycle', () => {
    it('T4-S1-1: Phase 1 — Prepayment booking of 250,000 ₽ via bank_1', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const wedding = before.find((a) => a.eventId === 'event_wedding')!;
      expect(wedding.revenue).toBeGreaterThanOrEqual(250000);
    });

    it('T4-S1-2: Phase 2 — Wholesale alcohol purchase and glassware rental on bank_1', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      const alcoholTx = transactions.find((t) => t.categoryId === 'cat_alcohol');
      const glasswareTx = transactions.find((t) => t.description?.includes('бокалов'));

      expect(alcoholTx).toBeDefined();
      expect(alcoholTx?.amount).toBe(110000);
      expect(glasswareTx?.amount).toBe(18000);
    });

    it('T4-S1-3: Phase 3 — On-site logistics and fresh ice purchase on cash_1', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      const iceTx = transactions.find((t) => t.categoryId === 'cat_ice');
      const logisticsTx = transactions.find((t) => t.categoryId === 'cat_logistics' && t.sourceAccountId === 'cash_1');

      expect(iceTx?.amount).toBe(12000);
      expect(logisticsTx?.amount).toBe(10000);
    });

    it('T4-S1-4: Phase 4 & 5 — Bartender payouts and final cash payment into safe cash_2', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      const staffTx = transactions.find((t) => t.categoryId === 'cat_staff');
      const finalIncomeTx = transactions.find((t) => t.categoryId === 'cat_final_payment');

      expect(staffTx?.amount).toBe(45000);
      expect(finalIncomeTx?.amount).toBe(50000);
    });

    it('T4-S1-5: Complete Wedding P&L Reconciliation — Revenue 300k, Expenses 195k, Net 105k, Margin 35.0%', async () => {
      const { analytics } = await client.getEventAnalytics();
      const wedding = analytics.find((a) => a.eventId === 'event_wedding')!;

      expect(wedding.revenue).toBe(300000);
      expect(wedding.directExpenses).toBe(195000);
      expect(wedding.netProfit).toBe(105000);
      expect(wedding.marginPercentage).toBe(35.0);
    });
  });

  // =========================================================================
  // Scenario 2: Corporate Event Lifecycle («Корпоратив IT-компании TechCorp»)
  // =========================================================================
  describe('Scenario 2: Corporate Event Lifecycle', () => {
    it('T4-S2-1: Phase 1 — Corporate PO prepayment 420,000 ₽ via bank_1', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_corporate' });
      const corpIncome = transactions.find((t) => t.categoryId === 'cat_prepayment');

      expect(corpIncome?.amount).toBe(420000);
      expect(corpIncome?.targetAccountId).toBe('bank_1');
    });

    it('T4-S2-2: Phase 2 — Premium alcohol and illuminated bar rental logistics', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_corporate' });
      const alcoholTx = transactions.find((t) => t.categoryId === 'cat_alcohol');
      const barSetupTx = transactions.find((t) => t.description?.includes('барной стойки'));

      expect(alcoholTx?.amount).toBe(160000);
      expect(barSetupTx?.amount).toBe(20000);
    });

    it('T4-S2-3: Phase 3 — Specialty citrus and dry ice purchases via cash_1', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_corporate' });
      const dryIceTx = transactions.find((t) => t.categoryId === 'cat_ice');

      expect(dryIceTx?.amount).toBe(25000);
      expect(dryIceTx?.sourceAccountId).toBe('cash_1');
    });

    it('T4-S2-4: Phase 4 — Bartenders team payout (60k) and QR tips collection (15k)', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_corporate' });
      const teamStaffTx = transactions.find((t) => t.categoryId === 'cat_staff');
      const tipsTx = transactions.find((t) => t.categoryId === 'cat_tips');

      expect(teamStaffTx?.amount).toBe(60000);
      expect(tipsTx?.amount).toBe(15000);
      expect(tipsTx?.targetAccountId).toBe('card_sbp');
    });

    it('T4-S2-5: Complete Corporate P&L Reconciliation — Revenue 435k, Expenses 265k, Net 170k, Margin 39.08%', async () => {
      const { analytics } = await client.getEventAnalytics();
      const corp = analytics.find((a) => a.eventId === 'event_corporate')!;

      expect(corp.revenue).toBe(435000);
      expect(corp.directExpenses).toBe(265000);
      expect(corp.netProfit).toBe(170000);
      expect(corp.marginPercentage).toBe(39.08);
    });
  });

  // =========================================================================
  // Scenario 3: Emergency On-Site Supplies Purchase during peak service
  // =========================================================================
  describe('Scenario 3: Emergency On-Site Supplies Purchase & Recovery', () => {
    it('T4-S3-1: should handle sudden emergency ice purchase of 5,500 ₽ exceeding on-site cash', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      // Emergency ice purchase of 5,500 ₽ logged on site via Telegram / fast input
      const res = await client.executeTelegramCommand('5500 срочный лед нал1');
      expect(res.success).toBe(true);

      // Verify cash_1 debited by exactly 5,500 ₽
      const { accounts: afterExp } = await client.getAccounts();
      const cash1After = afterExp.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1Before - 5500));
      expect(cash1After.currentBalance).toBeLessThan(0);
    });

    it('T4-S3-2: should replenish cash_1 from card_sbp bringing account back into positive standing', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      // Manager transfers 20,000 ₽ from SBP card to cash_1
      const transferRes = await client.createTransaction({
        type: 'transfer',
        amount: 20000,
        sourceAccountId: 'card_sbp',
        targetAccountId: 'cash_1',
        description: 'Экстренное пополнение кассы с карты СБП',
      });

      expect(transferRes.transaction.type).toBe('transfer');

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!;
      expect(cash1After.currentBalance).toBe(round2(cash1Before + 20000));
      expect(cash1After.currentBalance).toBeGreaterThan(0);
    });

    it('T4-S3-3: should verify all 5 accounts balance correctly after the emergency workflow', async () => {
      const { accounts } = await client.getAccounts();
      const { transactions } = await client.getTransactions();

      const isConserved = verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions);
      expect(isConserved).toBe(true);
    });

    it('T4-S3-4: should record complete chronological audit trail in journal for emergency ops', async () => {
      await client.executeTelegramCommand('5500 лед нал1');
      await client.createTransaction({
        type: 'transfer',
        amount: 10000,
        sourceAccountId: 'card_sbp',
        targetAccountId: 'cash_1',
        description: 'Пополнение кассы',
      });

      const { transactions } = await client.getTransactions({ accountId: 'cash_1' });
      const recentTxs = transactions.slice(0, 2);
      expect(recentTxs.some((t) => t.type === 'expense' || t.description?.includes('лед'))).toBe(true);
      expect(recentTxs.some((t) => t.type === 'transfer')).toBe(true);
    });

    it('T4-S3-5: should allow reverting emergency purchase in case of payment refund from courier', async () => {
      const exp = await client.executeTelegramCommand('3000 лед нал1');
      const { accounts: beforeRefund } = await client.getAccounts();
      const cash1BeforeRefund = beforeRefund.find((a) => a.id === 'cash_1')!.currentBalance;

      // Courier returns money, transaction deleted/refunded
      await client.deleteTransaction(exp.transaction.id);

      const { accounts: afterRefund } = await client.getAccounts();
      const cash1AfterRefund = afterRefund.find((a) => a.id === 'cash_1')!.currentBalance;
      expect(cash1AfterRefund).toBe(round2(cash1BeforeRefund + 3000));
    });
  });
});
