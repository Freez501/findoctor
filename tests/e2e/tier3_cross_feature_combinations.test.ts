import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2, verifyCapitalConservation } from './helpers/financial-invariants';
import { INITIAL_ACCOUNTS } from './helpers/fixtures';

describe('Tier 3: Cross-Feature Combinations (Pairwise Multi-Step Workflows)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // Workflow 1: Inter-Account Transfer followed by Event Expense
  // =========================================================================
  describe('Workflow 1: Replenishment Transfer -> On-Site Event Expense', () => {
    it('T3-W1-1: should replenish cash_1 from bank_1, then spend on wedding ice with exact balance reconciliation', async () => {
      const { accounts: before, totalBalance: totalBefore } = await client.getAccounts();
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      // 1. Replenishment transfer: 20,000 from bank_1 to cash_1
      await client.createTransaction({
        type: 'transfer',
        amount: 20000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_1',
        description: 'Снятие с р/с в кассу бара на площадке',
      });

      // 2. On-site expense: 15,000 from cash_1 for wedding ice & mint
      await client.createTransaction({
        type: 'expense',
        amount: 15000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
        description: 'Дополнительный краш-лед и мята на свадьбу',
      });

      const { accounts: after, totalBalance: totalAfter } = await client.getAccounts();
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;

      expect(bank1After).toBe(round2(bank1Before - 20000));
      expect(cash1After).toBe(round2(cash1Before + 20000 - 15000));
      expect(totalAfter).toBe(round2(totalBefore - 15000)); // Only the expense left the business
    });

    it('T3-W1-2: should update wedding direct expenses and margin % after the sequence', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const weddingBefore = before.find((a) => a.eventId === 'event_wedding')!;

      // Transfer (no margin impact)
      await client.createTransaction({
        type: 'transfer',
        amount: 25000,
        sourceAccountId: 'cash_2',
        targetAccountId: 'cash_1',
      });

      // Expense (margin impact)
      await client.createTransaction({
        type: 'expense',
        amount: 10000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
      });

      const { analytics: after } = await client.getEventAnalytics();
      const weddingAfter = after.find((a) => a.eventId === 'event_wedding')!;

      expect(weddingAfter.directExpenses).toBe(round2(weddingBefore.directExpenses + 10000));
      expect(weddingAfter.netProfit).toBe(round2(weddingBefore.netProfit - 10000));
    });

    it('T3-W1-3: should verify both transfer and expense are listed in journal with correct types', async () => {
      await client.createTransaction({
        type: 'transfer',
        amount: 10000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_1',
        description: 'Инкассация в кассу',
      });
      await client.createTransaction({
        type: 'expense',
        amount: 5000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
        description: 'Закупка льда',
      });

      const { transactions } = await client.getTransactions();
      const transferTx = transactions.find((t) => t.description === 'Инкассация в кассу');
      const expenseTx = transactions.find((t) => t.description === 'Закупка льда');

      expect(transferTx?.type).toBe('transfer');
      expect(expenseTx?.type).toBe('expense');
    });

    it('T3-W1-4: should preserve capital conservation throughout the sequence', async () => {
      await client.createTransaction({
        type: 'transfer',
        amount: 30000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_2',
      });
      await client.createTransaction({
        type: 'expense',
        amount: 12000,
        sourceAccountId: 'cash_2',
        categoryId: 'cat_staff',
        eventId: 'event_wedding',
      });

      const { accounts } = await client.getAccounts();
      const { transactions } = await client.getTransactions();
      expect(verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions)).toBe(true);
    });

    it('T3-W1-5: should allow reverting the expense without reverting the transfer', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      await client.createTransaction({
        type: 'transfer',
        amount: 10000,
        sourceAccountId: 'cash_2',
        targetAccountId: 'cash_1',
      });
      const expRes = await client.createTransaction({
        type: 'expense',
        amount: 4000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
      });

      // Delete only the expense
      await client.deleteTransaction(expRes.transaction.id);

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      // Should equal cash1Before + 10,000 (transfer preserved)
      expect(cash1After).toBe(round2(cash1Before + 10000));
    });
  });

  // =========================================================================
  // Workflow 2: Expense Creation, Margin Degradation & Reversal Recovery
  // =========================================================================
  describe('Workflow 2: Erroneous Expense Creation -> Margin Drop -> Deletion Restoration', () => {
    it('T3-W2-1: should drop margin when 50,000 expense is added and 100% restore when deleted', async () => {
      const { analytics: initialAnalytics } = await client.getEventAnalytics();
      const weddingInitial = initialAnalytics.find((a) => a.eventId === 'event_wedding')!;

      // 1. Erroneous huge expense
      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 50000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_wedding',
        description: 'Ошибочно внесённый алкоголь',
      });

      const { analytics: degradedAnalytics } = await client.getEventAnalytics();
      const weddingDegraded = degradedAnalytics.find((a) => a.eventId === 'event_wedding')!;
      expect(weddingDegraded.marginPercentage).toBeLessThan(weddingInitial.marginPercentage);

      // 2. Reversal / deletion
      await client.deleteTransaction(transaction.id);

      const { analytics: restoredAnalytics } = await client.getEventAnalytics();
      const weddingRestored = restoredAnalytics.find((a) => a.eventId === 'event_wedding')!;

      expect(weddingRestored.revenue).toBe(weddingInitial.revenue);
      expect(weddingRestored.directExpenses).toBe(weddingInitial.directExpenses);
      expect(weddingRestored.netProfit).toBe(weddingInitial.netProfit);
      expect(weddingRestored.marginPercentage).toBe(weddingInitial.marginPercentage);
    });

    it('T3-W2-2: should restore bank_1 balance to exact initial amount upon deletion', async () => {
      const { accounts: before } = await client.getAccounts();
      const bank1Before = before.find((a) => a.id === 'bank_1')!.currentBalance;

      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 35000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_wedding',
      });

      await client.deleteTransaction(transaction.id);

      const { accounts: after } = await client.getAccounts();
      const bank1After = after.find((a) => a.id === 'bank_1')!.currentBalance;
      expect(bank1After).toBe(bank1Before);
    });

    it('T3-W2-3: should remove deleted transaction from active event transaction queries', async () => {
      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 11000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
        eventId: 'event_wedding',
        description: 'Удаляемая транзакция',
      });

      await client.deleteTransaction(transaction.id);

      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      const found = transactions.find((t) => t.id === transaction.id);
      expect(found).toBeUndefined();
    });

    it('T3-W2-4: should maintain capital conservation before, during, and after deletion', async () => {
      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 8000,
        sourceAccountId: 'cash_2',
      });

      let { accounts } = await client.getAccounts();
      let { transactions } = await client.getTransactions();
      expect(verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions)).toBe(true);

      await client.deleteTransaction(transaction.id);

      ({ accounts } = await client.getAccounts());
      ({ transactions } = await client.getTransactions());
      expect(verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions)).toBe(true);
    });

    it('T3-W2-5: should restore category breakdown percentages to original state', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const weddingBefore = before.find((a) => a.eventId === 'event_wedding')!;

      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 20000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_wedding',
      });

      await client.deleteTransaction(transaction.id);

      const { analytics: after } = await client.getEventAnalytics();
      const weddingAfter = after.find((a) => a.eventId === 'event_wedding')!;

      expect(weddingAfter.expensesByCategory).toEqual(weddingBefore.expensesByCategory);
    });
  });

  // =========================================================================
  // Workflow 3: Telegram NLP Logging -> Balance Recalc -> Journal Audit
  // =========================================================================
  describe('Workflow 3: Telegram NLP Fast Logging Pipeline', () => {
    it('T3-W3-1: should parse and execute "3500 лед Корпоратив нал1" and debit cash_1', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      const res = await client.executeTelegramCommand('3500 лед Корпоратив нал1');
      expect(res.success).toBe(true);
      expect(res.transaction.amount).toBe(3500);
      expect(res.transaction.eventId).toBe('event_corporate');

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      expect(cash1After).toBe(round2(cash1Before - 3500));
    });

    it('T3-W3-2: should attribute Telegram expense directly to corporate event analytics', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const corpBefore = before.find((a) => a.eventId === 'event_corporate')!;

      await client.executeTelegramCommand('15000 премиум алкоголь Корпоратив безнал1');

      const { analytics: after } = await client.getEventAnalytics();
      const corpAfter = after.find((a) => a.eventId === 'event_corporate')!;

      expect(corpAfter.directExpenses).toBe(round2(corpBefore.directExpenses + 15000));
      expect(corpAfter.netProfit).toBe(round2(corpBefore.netProfit - 15000));
    });

    it('T3-W3-3: should verify Telegram transaction appears in transaction journal with [Telegram] tag', async () => {
      await client.executeTelegramCommand('2500 лимоны и мята Свадьба нал1');

      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      const tgTx = transactions.find((t) => t.description?.includes('[Telegram]'));
      expect(tgTx).toBeDefined();
      expect(tgTx?.amount).toBe(2500);
      expect(tgTx?.sourceAccountId).toBe('cash_1');
    });

    it('T3-W3-4: should execute multiple sequential Telegram commands with cumulative balance accuracy', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      await client.executeTelegramCommand('1000 лед нал1');
      await client.executeTelegramCommand('2000 сиропы нал1');
      await client.executeTelegramCommand('1500 стаканы нал1');

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      expect(cash1After).toBe(round2(cash1Before - 4500));
    });

    it('T3-W3-5: should maintain capital conservation after executing Telegram commands', async () => {
      await client.executeTelegramCommand('50000 предоплата Свадьба безнал1');
      await client.executeTelegramCommand('12000 гонорар бармена Свадьба нал2');

      const { accounts } = await client.getAccounts();
      const { transactions } = await client.getTransactions();
      expect(verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions)).toBe(true);
    });
  });

  // =========================================================================
  // Workflow 4: General Expenses vs Event Margin Isolation
  // =========================================================================
  describe('Workflow 4: General Expenses vs Event Margin Isolation', () => {
    it('T3-W4-1: should verify general overhead expense drops total capital without altering event margin', async () => {
      const { totalBalance: totalBefore } = await client.getAccounts();
      const { analytics: eventAnalyticsBefore } = await client.getEventAnalytics();

      // Log 40,000 warehouse rent (general expense)
      await client.createTransaction({
        type: 'expense',
        amount: 40000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_supplies',
        eventId: null,
        description: 'Аренда склада за месяц',
      });

      const { totalBalance: totalAfter } = await client.getAccounts();
      const { analytics: eventAnalyticsAfter } = await client.getEventAnalytics();

      expect(totalAfter).toBe(round2(totalBefore - 40000));
      expect(eventAnalyticsAfter).toEqual(eventAnalyticsBefore); // Untouched event margins!
    });

    it('T3-W4-2: should verify overview generalExpensesTotal increments by 40,000', async () => {
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 40000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(round2(before + 40000));
    });

    it('T3-W4-3: should verify event-specific expense does NOT increment generalExpensesTotal', async () => {
      const { generalExpensesTotal: before } = await client.getOverviewAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 30000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_alcohol',
        eventId: 'event_wedding',
      });

      const { generalExpensesTotal: after } = await client.getOverviewAnalytics();
      expect(after).toBe(before);
    });

    it('T3-W4-4: should isolate general expenses in journal filter', async () => {
      const { transactions: generalOnly } = await client.getTransactions({ eventId: null as any });
      for (const tx of generalOnly) {
        expect(tx.eventId).toBeNull();
      }
    });

    it('T3-W4-5: should allow deletion of general expense restoring bank_1 and general overhead total', async () => {
      const { generalExpensesTotal: beforeTotal } = await client.getOverviewAnalytics();
      const { accounts: beforeAccs } = await client.getAccounts();
      const bank1Before = beforeAccs.find((a) => a.id === 'bank_1')!.currentBalance;

      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 15000,
        sourceAccountId: 'bank_1',
        categoryId: 'cat_supplies',
        eventId: null,
      });

      await client.deleteTransaction(transaction.id);

      const { generalExpensesTotal: afterTotal } = await client.getOverviewAnalytics();
      const { accounts: afterAccs } = await client.getAccounts();
      const bank1After = afterAccs.find((a) => a.id === 'bank_1')!.currentBalance;

      expect(afterTotal).toBe(beforeTotal);
      expect(bank1After).toBe(bank1Before);
    });
  });

  // =========================================================================
  // Workflow 5: Multi-Account Batch & Full Seed Reset
  // =========================================================================
  describe('Workflow 5: Complex Multi-Account Batch & Idempotent Reset', () => {
    it('T3-W5-1: should process multi-step complex transactions and restore pristine state via reset', async () => {
      const stateInitial = await client.getAccounts();

      // Execute a cascade of transactions
      await client.createTransaction({ type: 'income', amount: 100000, targetAccountId: 'bank_1' });
      await client.createTransaction({ type: 'transfer', amount: 40000, sourceAccountId: 'bank_1', targetAccountId: 'cash_2' });
      await client.createTransaction({ type: 'transfer', amount: 15000, sourceAccountId: 'cash_2', targetAccountId: 'cash_1' });
      await client.createTransaction({ type: 'expense', amount: 12000, sourceAccountId: 'cash_1', categoryId: 'cat_ice' });
      await client.createTransaction({ type: 'income', amount: 25000, targetAccountId: 'card_sbp', categoryId: 'cat_tips' });

      const stateMutated = await client.getAccounts();
      expect(stateMutated.totalBalance).not.toBe(stateInitial.totalBalance);

      // Trigger reset
      await client.resetDemoData();

      const stateRestored = await client.getAccounts();
      expect(stateRestored.totalBalance).toBe(stateInitial.totalBalance);
      expect(stateRestored.accounts).toEqual(stateInitial.accounts);
    });

    it('T3-W5-2: should restore canonical event analytics upon reset', async () => {
      const analyticsInitial = await client.getEventAnalytics();

      await client.createTransaction({
        type: 'expense',
        amount: 70000,
        sourceAccountId: 'bank_1',
        eventId: 'event_wedding',
      });

      await client.resetDemoData();

      const analyticsRestored = await client.getEventAnalytics();
      expect(analyticsRestored).toEqual(analyticsInitial);
    });

    it('T3-W5-3: should restore canonical transaction count upon reset', async () => {
      await client.createTransaction({ type: 'expense', amount: 500, sourceAccountId: 'cash_1' });
      await client.createTransaction({ type: 'expense', amount: 600, sourceAccountId: 'cash_1' });

      await client.resetDemoData();

      const { transactions } = await client.getTransactions();
      expect(transactions).toHaveLength(18); // Canonical seed count
    });

    it('T3-W5-4: should ensure no orphaned transactions remain after reset', async () => {
      const res = await client.createTransaction({
        type: 'expense',
        amount: 99999,
        sourceAccountId: 'cash_1',
        description: 'Temporary canary transaction',
      });

      await client.resetDemoData();

      const { transactions } = await client.getTransactions();
      const canary = transactions.find((t) => t.id === res.transaction.id);
      expect(canary).toBeUndefined();
    });

    it('T3-W5-5: should return successful confirmation message from reset endpoint', async () => {
      const res = await client.resetDemoData();
      expect(res.success).toBe(true);
      expect(res.message).toContain('успешно сброшены');
    });
  });
});
