import { describe, it, expect } from 'vitest';
import {
  generateCashFlowStatement,
  generatePnLStatement,
  generateEventEconomicsReport,
  generateBalanceSheet,
  generateVendorPayrollStatement,
  getDateRangeForPeriod,
} from '../../src/client/services/reportsGenerator.js';
import {
  Account,
  Category,
  CateringEvent,
  EventPaymentMilestone,
  EventVendor,
  Transaction,
} from '../../src/shared/types.js';

describe('Financial Reports Engine Unit Tests', () => {
  const dummyAccounts: Account[] = [
    {
      id: 'cash_1',
      name: 'Нал 1',
      type: 'cash',
      initialBalance: 100000,
      currentBalance: 150000,
      currency: 'RUB',
      description: 'Касса',
      isActive: true,
      updatedAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'bank_1',
      name: 'Безнал 1',
      type: 'bank',
      initialBalance: 500000,
      currentBalance: 800000,
      currency: 'RUB',
      description: 'Р/С',
      isActive: true,
      updatedAt: '2026-10-15T00:00:00Z',
    },
  ];

  const dummyCategories: Category[] = [
    { id: 'cat_prepayment', name: 'Предоплата банкета', type: 'income', direction: 'operational' },
    { id: 'cat_alcohol', name: 'Алкоголь', type: 'expense', direction: 'operational' },
    { id: 'cat_staff', name: 'Персонал', type: 'expense', direction: 'operational' },
    { id: 'cat_rent', name: 'Аренда склада', type: 'expense', direction: 'operational' },
  ];

  const dummyEvents: CateringEvent[] = [
    {
      id: 'ev_wedding',
      title: 'Свадьба в лофте',
      eventDate: '2026-10-15',
      status: 'completed',
      contractAmount: 300000,
      budget: 120000,
    },
  ];

  const dummyTransactions: Transaction[] = [
    {
      id: 'tx_1',
      type: 'income',
      amount: 300000,
      categoryId: 'cat_prepayment',
      toAccountId: 'bank_1',
      eventId: 'ev_wedding',
      transactionDate: '2026-10-10T12:00:00Z',
      isDeleted: false,
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 80000,
      categoryId: 'cat_alcohol',
      fromAccountId: 'bank_1',
      eventId: 'ev_wedding',
      transactionDate: '2026-10-11T14:00:00Z',
      isDeleted: false,
    },
    {
      id: 'tx_3',
      type: 'expense',
      amount: 30000,
      categoryId: 'cat_staff',
      fromAccountId: 'cash_1',
      eventId: 'ev_wedding',
      transactionDate: '2026-10-12T18:00:00Z',
      isDeleted: false,
    },
    {
      id: 'tx_4',
      type: 'expense',
      amount: 25000,
      categoryId: 'cat_rent',
      fromAccountId: 'bank_1',
      eventId: null, // General overhead OPEX
      transactionDate: '2026-10-13T10:00:00Z',
      isDeleted: false,
    },
  ];

  const range = { startDate: '2026-10-01', endDate: '2026-10-31' };

  it('generates accurate Cash Flow Statement (ДДС)', () => {
    const cf = generateCashFlowStatement(dummyTransactions, dummyAccounts, dummyCategories, range, 'Октябрь 2026');
    expect(cf.operatingInflows.subtotal).toBe(300000);
    expect(cf.operatingOutflows.subtotal).toBe(135000);
    expect(cf.netOperatingCash).toBe(165000);
    expect(cf.closingBalance).toBe(950000); // 150000 + 800000
    expect(cf.openingBalance).toBe(785000); // 950000 - 165000
  });

  it('generates accurate Profit & Loss Statement (ОПиУ)', () => {
    const pnl = generatePnLStatement(dummyTransactions, dummyCategories, range, 'Октябрь 2026');
    expect(pnl.revenue).toBe(300000);
    expect(pnl.totalCOGS).toBe(110000); // alcohol 80k + staff 30k
    expect(pnl.grossProfit).toBe(190000); // 300k - 110k
    expect(pnl.grossMarginPercent).toBe(63.33); // 190k / 300k * 100
    expect(pnl.totalOPEX).toBe(25000); // rent 25k
    expect(pnl.operatingProfit).toBe(165000); // 190k - 25k
    expect(pnl.netMarginPercent).toBe(55); // 165k / 300k * 100
  });

  it('generates accurate Event Unit Economics Report', () => {
    const eco = generateEventEconomicsReport(dummyEvents, dummyTransactions, range);
    expect(eco.length).toBe(1);
    expect(eco[0].factRevenue).toBe(300000);
    expect(eco[0].factExpenses).toBe(110000);
    expect(eco[0].netProfit).toBe(190000);
    expect(eco[0].marginPercent).toBe(63.33);
  });

  it('generates accurate Balance Sheet & Working Capital', () => {
    const dummyMilestones: EventPaymentMilestone[] = [
      {
        id: 'ms_1',
        companyId: 'comp_1',
        eventId: 'ev_wedding',
        title: 'Остаток по договору',
        dueDate: '2026-10-20',
        amount: 50000,
        status: 'pending',
        paidAmount: 0,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const dummyVendors: EventVendor[] = [
      {
        id: 'v_1',
        companyId: 'comp_1',
        eventId: 'ev_wedding',
        name: 'Алексей Смирнов',
        role: 'Шеф-бармен',
        agreedFee: 25000,
        paidAmount: 10000,
        remainingAmount: 15000,
        status: 'partial',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const bs = generateBalanceSheet(dummyAccounts, dummyMilestones, dummyVendors);
    expect(bs.totalCash).toBe(950000);
    expect(bs.accountsReceivable).toBe(50000);
    expect(bs.totalAssets).toBe(1000000);
    expect(bs.accountsPayable).toBe(15000);
    expect(bs.totalLiabilities).toBe(15000);
    expect(bs.netWorkingCapital).toBe(985000); // 1 000 000 - 15 000
  });

  it('generates accurate Vendor Payroll Statement', () => {
    const dummyVendors: EventVendor[] = [
      {
        id: 'v_1',
        companyId: 'comp_1',
        eventId: 'ev_wedding',
        name: 'Илья',
        role: 'Диджей',
        agreedFee: 30000,
        paidAmount: 10000,
        remainingAmount: 20000,
        status: 'partial',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const payroll = generateVendorPayrollStatement(dummyVendors, dummyEvents);
    expect(payroll.totalFee).toBe(30000);
    expect(payroll.totalPaid).toBe(10000);
    expect(payroll.totalRemaining).toBe(20000);
    expect(payroll.vendors[0].eventTitle).toBe('Свадьба в лофте');
  });

  it('correctly calculates predefined DateRanges', () => {
    const curMonth = getDateRangeForPeriod('current_month');
    expect(curMonth.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    const all = getDateRangeForPeriod('all');
    expect(all.startDate).toBe('2020-01-01');
  });
});
