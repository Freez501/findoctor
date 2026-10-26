import { describe, it, expect } from 'vitest';
import { calculateTaxReserve, getQuarterDateRange } from '../../src/client/utils/taxCalculator.js';
import { Account, Transaction, CompanyTaxSettings } from '../../src/shared/types.js';

describe('Tax Calculator Suite — Russian SME & Agency Taxation', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc_cash',
      companyId: 'co_test',
      name: 'Наличные в кассе',
      type: 'cash',
      currency: 'RUB',
      currentBalance: 50000,
      initialBalance: 0,
      isActive: true,
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'acc_bank',
      companyId: 'co_test',
      name: 'Расчётный счёт Т-Банк',
      type: 'bank',
      currency: 'RUB',
      currentBalance: 500000,
      initialBalance: 0,
      isActive: true,
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  it('correctly calculates quarter ranges', () => {
    const q4Date = new Date('2026-10-26T20:00:00Z');
    const q4 = getQuarterDateRange(q4Date);
    expect(q4.quarterLabel).toBe('IV кв. 2026');
    expect(q4.startDate).toBe('2026-10-01');
    expect(q4.endDate).toBe('2026-12-31');

    const q1Date = new Date('2026-02-15T20:00:00Z');
    const q1 = getQuarterDateRange(q1Date);
    expect(q1.quarterLabel).toBe('I кв. 2026');
    expect(q1.startDate).toBe('2026-01-01');
    expect(q1.endDate).toBe('2026-03-31');
  });

  it('calculates standard УСН «Доходы» (6%) across all accounts', () => {
    const targetDate = new Date('2026-10-26T12:00:00Z');
    const txs: Transaction[] = [
      {
        id: 'tx_1',
        type: 'income',
        amount: 100000,
        toAccountId: 'acc_bank',
        categoryId: 'prepayment',
        transactionDate: '2026-10-10T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Предоплата по р/с',
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z',
      },
      {
        id: 'tx_2',
        type: 'income',
        amount: 50000,
        toAccountId: 'acc_cash',
        categoryId: 'cash_payment',
        transactionDate: '2026-10-15T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Доплата наличными',
        createdAt: '2026-10-15T12:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
      {
        id: 'tx_old',
        type: 'income',
        amount: 200000,
        toAccountId: 'acc_bank',
        categoryId: 'prepayment',
        transactionDate: '2026-08-10T12:00:00Z', // III quarter
        isDeleted: false,
        companyId: 'co_test',
        description: 'Оплата прошлого квартала',
        createdAt: '2026-08-10T12:00:00Z',
        updatedAt: '2026-08-10T12:00:00Z',
      },
    ];

    const taxSettings: CompanyTaxSettings = {
      system: 'usn_income',
      rate: 6,
      applyOnlyToBank: false,
    };

    const res = calculateTaxReserve(txs, mockAccounts, taxSettings, targetDate);
    expect(res.incomeBase).toBe(150000); // 100k + 50k
    expect(res.taxAmount).toBe(9000); // 6% of 150000
    expect(res.quarterLabel).toBe('IV кв. 2026');
  });

  it('filters out cash payments when applyOnlyToBank is enabled', () => {
    const targetDate = new Date('2026-10-26T12:00:00Z');
    const txs: Transaction[] = [
      {
        id: 'tx_bank',
        type: 'income',
        amount: 200000,
        toAccountId: 'acc_bank',
        categoryId: 'prepayment',
        transactionDate: '2026-10-10T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Банковский перевод',
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z',
      },
      {
        id: 'tx_cash',
        type: 'income',
        amount: 100000,
        toAccountId: 'acc_cash',
        categoryId: 'cash_payment',
        transactionDate: '2026-10-15T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Наличка на площадке',
        createdAt: '2026-10-15T12:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
    ];

    const taxSettings: CompanyTaxSettings = {
      system: 'usn_income',
      rate: 6,
      applyOnlyToBank: true,
    };

    const res = calculateTaxReserve(txs, mockAccounts, taxSettings, targetDate);
    expect(res.incomeBase).toBe(200000); // only bank
    expect(res.taxAmount).toBe(12000); // 6% of 200000
  });

  it('calculates УСН «Доходы минус Расходы» (15%) with 1% minimum tax rule', () => {
    const targetDate = new Date('2026-10-26T12:00:00Z');
    const txsHighExpenses: Transaction[] = [
      {
        id: 'tx_inc',
        type: 'income',
        amount: 1000000,
        toAccountId: 'acc_bank',
        categoryId: 'prepayment',
        transactionDate: '2026-10-10T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Выручка',
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z',
      },
      {
        id: 'tx_exp',
        type: 'expense',
        amount: 980000, // profit is only 20,000, 15% is 3,000. But min tax 1% of 1,000,000 is 10,000!
        fromAccountId: 'acc_bank',
        categoryId: 'supplies',
        transactionDate: '2026-10-12T12:00:00Z',
        isDeleted: false,
        companyId: 'co_test',
        description: 'Огромные закупки алкоголя и оборудования',
        createdAt: '2026-10-12T12:00:00Z',
        updatedAt: '2026-10-12T12:00:00Z',
      },
    ];

    const taxSettings: CompanyTaxSettings = {
      system: 'usn_income_expense',
      rate: 15,
      applyOnlyToBank: false,
    };

    const res = calculateTaxReserve(txsHighExpenses, mockAccounts, taxSettings, targetDate);
    expect(res.incomeBase).toBe(1000000);
    expect(res.expenseBase).toBe(980000);
    expect(res.taxableBase).toBe(20000);
    // 15% of 20,000 is 3,000, but min tax is 1% of 1,000,000 = 10,000
    expect(res.taxAmount).toBe(10000);
  });

  it('returns zero and inactive when system is "none"', () => {
    const taxSettings: CompanyTaxSettings = {
      system: 'none',
      rate: 0,
      applyOnlyToBank: false,
    };

    const res = calculateTaxReserve([], mockAccounts, taxSettings);
    expect(res.system).toBe('none');
    expect(res.taxAmount).toBe(0);
    expect(res.isEffective).toBe(false);
  });
});
