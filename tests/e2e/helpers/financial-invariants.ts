/**
 * Financial Invariants and Mathematical Verification Helpers.
 * Grounded in ORIGINAL_REQUEST.md §R1, R3, and Acceptance Criteria.
 */

import { AccountFixture, TransactionFixture } from './fixtures';

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateTotalLiquidity(accounts: AccountFixture[]): number {
  const sum = accounts.reduce((acc, a) => acc + a.currentBalance, 0);
  return round2(sum);
}

export interface CalculatedEventMargin {
  revenue: number;
  directExpenses: number;
  netProfit: number;
  marginPercentage: number;
  expensesByCategory: Array<{ categoryId: string; amount: number; percentage: number }>;
}

export function calculateEventMargin(
  transactions: TransactionFixture[],
  eventId: string
): CalculatedEventMargin {
  const activeTxs = transactions.filter((tx) => !tx.isDeleted && tx.eventId === eventId);
  const revenue = round2(
    activeTxs
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const directExpenses = round2(
    activeTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const netProfit = round2(revenue - directExpenses);
  
  // Safe zero-division handling per spec:
  // If revenue <= 0, margin is 0% or negative loss indicator, never NaN / Infinity
  let marginPercentage = 0;
  if (revenue > 0) {
    marginPercentage = round2((netProfit / revenue) * 100);
  } else if (directExpenses > 0) {
    marginPercentage = -100;
  }

  // Category breakdown
  const categoryMap = new Map<string, number>();
  activeTxs
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const current = categoryMap.get(tx.categoryId) || 0;
      categoryMap.set(tx.categoryId, round2(current + tx.amount));
    });

  const expensesByCategory = Array.from(categoryMap.entries()).map(([catId, amt]) => ({
    categoryId: catId,
    amount: amt,
    percentage: directExpenses > 0 ? round2((amt / directExpenses) * 100) : 0,
  }));

  return {
    revenue,
    directExpenses,
    netProfit,
    marginPercentage,
    expensesByCategory,
  };
}

/**
 * Checks Law of Capital Conservation:
 * Sum(currentBalances) == Sum(initialBalances) + Sum(active Incomes) - Sum(active Expenses)
 * Note: Transfers have net impact of 0 on total capital.
 */
export function verifyCapitalConservation(
  initialAccounts: AccountFixture[],
  currentAccounts: AccountFixture[],
  transactions: TransactionFixture[]
): boolean {
  const initialSum = initialAccounts.reduce((sum, a) => sum + a.initialBalance, 0);
  const currentSum = currentAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const activeTxs = transactions.filter((tx) => !tx.isDeleted);
  const totalIncome = activeTxs
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = activeTxs
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expectedCapital = round2(initialSum + totalIncome - totalExpense);
  const actualCapital = round2(currentSum);

  return Math.abs(expectedCapital - actualCapital) < 0.001;
}

export function formatRubles(amount: number): string {
  const parts = Math.abs(amount).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${parts} ₽`;
}
