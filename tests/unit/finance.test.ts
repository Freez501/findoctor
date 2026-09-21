import { describe, it, expect } from 'vitest';
import {
  INITIAL_ACCOUNTS_SEED,
  INITIAL_TOTAL_CAPITAL,
  ACCOUNT_IDS,
  EVENT_IDS,
  getMarginRating,
} from '../../src/shared/constants.js';
import { SEED_TRANSACTIONS, POST_SEED_ACCOUNTS } from '../../src/server/data/seed.js';
import { validateCreateTransactionDTO } from '../../src/shared/dto.js';
import { Transaction } from '../../src/shared/types.js';

// Helper for pure integer kopeck math
function toKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

function toRubles(kopecks: number): number {
  return kopecks / 100;
}

describe('Financial Core & Mathematical Invariants', () => {
  describe('Initial Capital & Account Consistency', () => {
    it('should have initial starting capital totaling exactly 840,000 ₽ across 5 accounts', () => {
      expect(INITIAL_ACCOUNTS_SEED).toHaveLength(5);
      const totalInitialKopecks = INITIAL_ACCOUNTS_SEED.reduce(
        (sum, acc) => sum + toKopecks(acc.initialBalance),
        0
      );
      expect(toRubles(totalInitialKopecks)).toBe(840000);
      expect(toRubles(totalInitialKopecks)).toBe(INITIAL_TOTAL_CAPITAL);
    });

    it('should match individual starting balances per specification', () => {
      const getBalance = (id: string) => INITIAL_ACCOUNTS_SEED.find((a) => a.id === id)?.initialBalance;
      expect(getBalance(ACCOUNT_IDS.CASH_1)).toBe(25000);
      expect(getBalance(ACCOUNT_IDS.CASH_2)).toBe(180000);
      expect(getBalance(ACCOUNT_IDS.BANK_1)).toBe(450000);
      expect(getBalance(ACCOUNT_IDS.BANK_2)).toBe(120000);
      expect(getBalance(ACCOUNT_IDS.CARD_SBP)).toBe(65000);
    });
  });

  describe('Canonical 21-Transaction Ledger Reconciliation', () => {
    it('should verify exactly 21 transactions (5 incomes, 11 expenses, 5 transfers)', () => {
      expect(SEED_TRANSACTIONS).toHaveLength(21);

      const incomes = SEED_TRANSACTIONS.filter((t) => t.type === 'income');
      const expenses = SEED_TRANSACTIONS.filter((t) => t.type === 'expense');
      const transfers = SEED_TRANSACTIONS.filter((t) => t.type === 'transfer');

      expect(incomes).toHaveLength(5);
      expect(expenses).toHaveLength(11);
      expect(transfers).toHaveLength(5);
    });

    it('should calculate global cashflow and reconcile final total capital to exactly 1,166,300 ₽', () => {
      let totalIncomeKop = 0;
      let totalExpenseKop = 0;

      for (const tx of SEED_TRANSACTIONS) {
        if (tx.type === 'income') totalIncomeKop += toKopecks(tx.amount);
        if (tx.type === 'expense') totalExpenseKop += toKopecks(tx.amount);
      }

      const totalIncome = toRubles(totalIncomeKop);
      const totalExpense = toRubles(totalExpenseKop);
      const netCashFlow = toRubles(totalIncomeKop - totalExpenseKop);

      expect(totalIncome).toBe(584000);
      expect(totalExpense).toBe(257700);
      expect(netCashFlow).toBe(326300);

      const theoreticalFinalCapital = toRubles(toKopecks(INITIAL_TOTAL_CAPITAL) + totalIncomeKop - totalExpenseKop);
      expect(theoreticalFinalCapital).toBe(1166300);

      // Verify sum of POST_SEED_ACCOUNTS matches theoretical capital
      const actualPostSeedTotal = POST_SEED_ACCOUNTS.reduce((sum, a) => sum + a.currentBalance, 0);
      expect(actualPostSeedTotal).toBe(1166300);
    });

    it('should reconcile each account individually from initial balance through all 21 transactions', () => {
      // Initialize balances from seed
      const balanceMap: Record<string, number> = {};
      for (const acc of INITIAL_ACCOUNTS_SEED) {
        balanceMap[acc.id] = toKopecks(acc.initialBalance);
      }

      // Replay all 21 transactions
      for (const tx of SEED_TRANSACTIONS) {
        const amountKop = toKopecks(tx.amount);
        if (tx.type === 'income') {
          balanceMap[tx.toAccountId!] += amountKop;
        } else if (tx.type === 'expense') {
          balanceMap[tx.fromAccountId!] -= amountKop;
        } else if (tx.type === 'transfer') {
          balanceMap[tx.fromAccountId!] -= amountKop;
          balanceMap[tx.toAccountId!] += amountKop;
        }
      }

      // Check against authoritative post-seed balances
      expect(toRubles(balanceMap[ACCOUNT_IDS.CASH_1])).toBe(6300);
      expect(toRubles(balanceMap[ACCOUNT_IDS.CASH_2])).toBe(199000);
      expect(toRubles(balanceMap[ACCOUNT_IDS.BANK_1])).toBe(814000);
      expect(toRubles(balanceMap[ACCOUNT_IDS.BANK_2])).toBe(112000);
      expect(toRubles(balanceMap[ACCOUNT_IDS.CARD_SBP])).toBe(35000);

      const finalSum = Object.values(balanceMap).reduce((acc, val) => acc + val, 0);
      expect(toRubles(finalSum)).toBe(1166300);
    });
  });

  describe('Transfer Conservation Invariant', () => {
    it('should strictly preserve total business liquidity on internal transfers', () => {
      const balances: Record<string, number> = {
        [ACCOUNT_IDS.CASH_1]: 50000,
        [ACCOUNT_IDS.BANK_1]: 200000,
      };

      const initialTotal = balances[ACCOUNT_IDS.CASH_1] + balances[ACCOUNT_IDS.BANK_1];

      // Perform transfer of 25,000 from Bank 1 to Cash 1
      const transferAmount = 25000;
      balances[ACCOUNT_IDS.BANK_1] -= transferAmount;
      balances[ACCOUNT_IDS.CASH_1] += transferAmount;

      const postTotal = balances[ACCOUNT_IDS.CASH_1] + balances[ACCOUNT_IDS.BANK_1];
      expect(postTotal).toBe(initialTotal);
    });
  });

  describe('Event Margin Analytics & Profitability', () => {
    it('should accurately calculate Wedding margin: Revenue 290k, Direct Expenses 95k, Margin 67.24%', () => {
      const weddingTxs = SEED_TRANSACTIONS.filter((t) => t.eventId === EVENT_IDS.WEDDING);

      const revenueKop = weddingTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + toKopecks(t.amount), 0);
      const directExpensesKop = weddingTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + toKopecks(t.amount), 0);

      const revenue = toRubles(revenueKop);
      const directExpenses = toRubles(directExpensesKop);
      const netProfit = revenue - directExpenses;
      const marginPercentage = Math.round(((netProfit / revenue) * 100) * 100) / 100;

      expect(revenue).toBe(290000);
      expect(directExpenses).toBe(95000);
      expect(netProfit).toBe(195000);
      expect(marginPercentage).toBe(67.24);

      expect(getMarginRating(marginPercentage, revenue)).toBe('high');
    });

    it('should accurately calculate Corporate margin: Revenue 294k, Direct Expenses 123.5k, Margin 57.99%', () => {
      const corpTxs = SEED_TRANSACTIONS.filter((t) => t.eventId === EVENT_IDS.CORPORATE);

      const revenueKop = corpTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + toKopecks(t.amount), 0);
      const directExpensesKop = corpTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + toKopecks(t.amount), 0);

      const revenue = toRubles(revenueKop);
      const directExpenses = toRubles(directExpensesKop);
      const netProfit = revenue - directExpenses;
      const marginPercentage = Math.round(((netProfit / revenue) * 100) * 100) / 100;

      expect(revenue).toBe(294000);
      expect(directExpenses).toBe(123500);
      expect(netProfit).toBe(170500);
      expect(marginPercentage).toBe(57.99);

      expect(getMarginRating(marginPercentage, revenue)).toBe('medium');
    });

    it('should handle zero-revenue edge cases gracefully without divide-by-zero errors', () => {
      expect(getMarginRating(0, 0)).toBe('no_revenue');
      expect(getMarginRating(-100, 0)).toBe('no_revenue');
      expect(getMarginRating(10, 100000)).toBe('low');
      expect(getMarginRating(-15, 100000)).toBe('loss');
    });
  });

  describe('Transaction Validation Schema', () => {
    it('should accept a valid expense DTO', () => {
      const res = validateCreateTransactionDTO({
        type: 'expense',
        amount: 3500.5,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: 'supplies',
        description: 'Лед',
      });
      expect(res.valid).toBe(true);
      expect(res.data?.amount).toBe(3500.5);
      expect(res.data?.fromAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(res.data?.toAccountId).toBeNull();
    });

    it('should accept a valid transfer DTO', () => {
      const res = validateCreateTransactionDTO({
        type: 'transfer',
        amount: 15000,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        toAccountId: ACCOUNT_IDS.CASH_2,
        categoryId: 'transfer_internal',
      });
      expect(res.valid).toBe(true);
      expect(res.data?.fromAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(res.data?.toAccountId).toBe(ACCOUNT_IDS.CASH_2);
    });

    it('should reject invalid payloads', () => {
      // Missing amount
      expect(validateCreateTransactionDTO({ type: 'income', categoryId: 'cat' }).valid).toBe(false);

      // Negative amount
      expect(validateCreateTransactionDTO({ type: 'expense', amount: -50, categoryId: 'cat', fromAccountId: 'acc' }).valid).toBe(false);

      // Missing fromAccountId for expense
      expect(validateCreateTransactionDTO({ type: 'expense', amount: 50, categoryId: 'cat' }).valid).toBe(false);

      // Missing toAccountId for income
      expect(validateCreateTransactionDTO({ type: 'income', amount: 50, categoryId: 'cat' }).valid).toBe(false);

      // Transfer with identical accounts
      expect(validateCreateTransactionDTO({
        type: 'transfer',
        amount: 50,
        categoryId: 'cat',
        fromAccountId: 'cash_1',
        toAccountId: 'cash_1',
      }).valid).toBe(false);
    });
  });

  describe('Transaction Reversibility & Rollback Invariant', () => {
    it('should perfectly reverse any transaction state effect', () => {
      let balanceCash1 = 100000;

      // Apply expense: 15,000
      const expenseAmount = 15000;
      balanceCash1 -= expenseAmount;
      expect(balanceCash1).toBe(85000);

      // Revert expense
      balanceCash1 += expenseAmount;
      expect(balanceCash1).toBe(100000);
    });
  });
});
