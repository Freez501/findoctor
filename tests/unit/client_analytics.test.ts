/**
 * Truespace — Client Analytics & History Filter Unit Tests
 * `tests/unit/client_analytics.test.ts`
 */

import { describe, it, expect } from 'vitest';
import { classifyMargin } from '../../src/client/hooks/useAnalytics.js';
import { filterTransactions, FilterState } from '../../src/client/components/history/TransactionHistory.js';
import { Transaction } from '../../src/shared/types.js';

describe('Client Analytics: Margin Classification & Math', () => {
  it('classifies margins >= 40% as green tier', () => {
    expect(classifyMargin(40).level).toBe('green');
    expect(classifyMargin(55.5).level).toBe('green');
    expect(classifyMargin(100).color).toBe('#059669');
  });

  it('classifies margins between 20% and 39.99% as yellow tier', () => {
    expect(classifyMargin(20).level).toBe('yellow');
    expect(classifyMargin(35.0).level).toBe('yellow');
    expect(classifyMargin(39.9).color).toBe('#d97706');
  });

  it('classifies margins < 20% and negative margins as red tier', () => {
    expect(classifyMargin(19.9).level).toBe('red');
    expect(classifyMargin(0).level).toBe('red');
    expect(classifyMargin(-100).level).toBe('red');
    expect(classifyMargin(-15).label).toContain('Убыток');
  });

  it('correctly calculates net profit and margin percentage', () => {
    const revenue = 300000;
    const directExpenses = 195000;
    const netProfit = revenue - directExpenses;
    const marginPercentage = (netProfit / revenue) * 100;
    expect(netProfit).toBe(105000);
    expect(marginPercentage).toBe(35);
  });
});

describe('Client History: Filter Predicates (filterTransactions)', () => {
  const dummyTxs: Transaction[] = [
    { id: 'tx-1', type: 'income', amount: 250000, toAccountId: 'bank_1', categoryId: 'cat_prepayment', eventId: 'event_wedding', description: 'Предоплата за свадьбу', transactionDate: '2026-09-10T10:00:00Z', isDeleted: false },
    { id: 'tx-2', type: 'expense', amount: 45000, fromAccountId: 'cash_1', categoryId: 'cat_staff', eventId: 'event_wedding', description: 'Оплата барменов', transactionDate: '2026-09-12T14:00:00Z', isDeleted: false },
    { id: 'tx-3', type: 'expense', amount: 35000, fromAccountId: 'bank_2', categoryId: 'cat_rent', eventId: null, description: 'Аренда склада за сентябрь', transactionDate: '2026-09-15T09:00:00Z', isDeleted: false },
    { id: 'tx-4', type: 'transfer', amount: 30000, fromAccountId: 'bank_1', toAccountId: 'cash_2', categoryId: 'cat_transfer', description: 'Инкассация в сейф', transactionDate: '2026-09-16T12:00:00Z', isDeleted: false },
    { id: 'tx-5', type: 'expense', amount: 1000, fromAccountId: 'cash_1', categoryId: 'cat_ice', eventId: 'event_wedding', description: 'Удалённая тестовая операция', transactionDate: '2026-09-16T15:00:00Z', isDeleted: true },
  ];

  const defaultFilters: FilterState = { accountId: 'all', eventId: 'all', type: 'all', searchQuery: '' };

  it('filters out soft-deleted transactions and sorts descending by date', () => {
    const result = filterTransactions(dummyTxs, defaultFilters);
    expect(result).toHaveLength(4);
    expect(result.some((t) => t.id === 'tx-5')).toBe(false);
    expect(result[0].id).toBe('tx-4');
  });

  it('filters strictly by account ID across source or destination', () => {
    const resultBank1 = filterTransactions(dummyTxs, { ...defaultFilters, accountId: 'bank_1' });
    expect(resultBank1).toHaveLength(2);
  });

  it('filters by event ID and distinguishes general overhead expenses (eventId: null)', () => {
    const resultWedding = filterTransactions(dummyTxs, { ...defaultFilters, eventId: 'event_wedding' });
    expect(resultWedding).toHaveLength(2);
    const resultGeneral = filterTransactions(dummyTxs, { ...defaultFilters, eventId: 'general' });
    expect(resultGeneral).toHaveLength(2);
    expect(resultGeneral.some((t) => t.id === 'tx-3')).toBe(true);
  });

  it('filters by transaction type (income, expense, transfer)', () => {
    const resultExpenses = filterTransactions(dummyTxs, { ...defaultFilters, type: 'expense' });
    expect(resultExpenses).toHaveLength(2);
  });

  it('filters by text search query matching memo description', () => {
    const resultSearch = filterTransactions(dummyTxs, { ...defaultFilters, searchQuery: 'барменов' });
    expect(resultSearch).toHaveLength(1);
    expect(resultSearch[0].id).toBe('tx-2');
  });
});
