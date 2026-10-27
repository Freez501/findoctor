import { describe, it, expect } from 'vitest';
import { calculateTaxReserve } from '../../src/client/utils/taxCalculator.js';
import { Account, CateringEvent, LegalEntity, Transaction } from '../../src/shared/types.js';

describe('Multi-Entity Tax & Deductible VAT Engine', () => {
  const legalEntities: LegalEntity[] = [
    {
      id: 'le_llc',
      name: 'ООО «Ивент Групп»',
      type: 'llc',
      taxSystem: 'osno',
      taxRate: 20, // 20% налог на прибыль
      vatRate: 20, // 20% НДС
      isActive: true,
    },
    {
      id: 'le_ip',
      name: 'ИП «Кейтеринг»',
      type: 'sole_proprietor',
      taxSystem: 'usn_income_vat5',
      taxRate: 6, // 6% УСН
      vatRate: 5, // 5% НДС (без вычетов по ст. 164 НК РФ)
      isActive: true,
    },
    {
      id: 'le_cash',
      name: 'Касса и сейф',
      type: 'cash',
      taxSystem: 'none',
      isActive: true,
    },
  ];

  const accounts: Account[] = [
    {
      id: 'acc_llc_bank',
      name: 'р/с Т-Банк (ООО)',
      type: 'bank',
      initialBalance: 0,
      currentBalance: 1200000,
      currency: 'RUB',
      description: 'Счёт ООО',
      isActive: true,
      legalEntityId: 'le_llc',
      legalEntityName: 'ООО «Ивент Групп»',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc_ip_bank',
      name: 'р/с Т-Банк (ИП)',
      type: 'bank',
      initialBalance: 0,
      currentBalance: 500000,
      currency: 'RUB',
      description: 'Счёт ИП',
      isActive: true,
      legalEntityId: 'le_ip',
      legalEntityName: 'ИП «Кейтеринг»',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc_cash',
      name: 'Наличная касса',
      type: 'cash',
      initialBalance: 0,
      currentBalance: 300000,
      currency: 'RUB',
      description: 'Сейф',
      isActive: true,
      legalEntityId: 'le_cash',
      legalEntityName: 'Касса и сейф',
      updatedAt: new Date().toISOString(),
    },
  ];

  it('calculates OSNO with deductible input VAT from supplier invoices with UPD', () => {
    const transactions: Transaction[] = [
      // 1. Income to LLC account: 1,200,000 ₽ (including 20% VAT: 200,000 ₽)
      {
        id: 'tx_inc_llc',
        type: 'income',
        amount: 1200000,
        toAccountId: 'acc_llc_bank',
        legalEntityId: 'le_llc',
        transactionDate: '2026-10-15T12:00:00Z',
        createdAt: '2026-10-15T12:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
      // 2. Expense from LLC with UPD/VAT: 360,000 ₽ (including 20% VAT: 60,000 ₽ deductible)
      {
        id: 'tx_exp_llc_vat',
        type: 'expense',
        amount: 360000,
        fromAccountId: 'acc_llc_bank',
        legalEntityId: 'le_llc',
        hasVat: true,
        vatRate: 20,
        vatAmount: 60000,
        transactionDate: '2026-10-16T12:00:00Z',
        createdAt: '2026-10-16T12:00:00Z',
        updatedAt: '2026-10-16T12:00:00Z',
      },
      // 3. Expense from LLC without VAT (e.g. self-employed or non-VAT vendor): 100,000 ₽
      {
        id: 'tx_exp_llc_novat',
        type: 'expense',
        amount: 100000,
        fromAccountId: 'acc_llc_bank',
        legalEntityId: 'le_llc',
        hasVat: false,
        transactionDate: '2026-10-17T12:00:00Z',
        createdAt: '2026-10-17T12:00:00Z',
        updatedAt: '2026-10-17T12:00:00Z',
      },
    ];

    const result = calculateTaxReserve(
      transactions,
      accounts,
      { system: 'osno', rate: 20, applyOnlyToBank: false },
      new Date('2026-10-20'),
      [],
      legalEntities
    );

    expect(result.entitiesBreakdown).toBeDefined();
    const llcBreakdown = result.entitiesBreakdown!.find((e) => e.entityId === 'le_llc');
    expect(llcBreakdown).toBeDefined();

    // Outgoing VAT = 1,200,000 * 20 / 120 = 200,000 ₽
    expect(llcBreakdown!.vatOutgoing).toBe(200000);
    // Incoming VAT to deduct = 60,000 ₽
    expect(llcBreakdown!.vatIncoming).toBe(60000);
    // Net VAT to pay = 200,000 - 60,000 = 140,000 ₽
    expect(llcBreakdown!.vatNet).toBe(140000);

    // Profit Tax Base = (Income 1,200,000 - 200,000 VAT) - ((Expense 360,000 - 60,000 VAT) + 100,000)
    // = 1,000,000 - (300,000 + 100,000) = 600,000 ₽
    // Profit Tax = 600,000 * 20% = 120,000 ₽
    expect(llcBreakdown!.taxAmount).toBe(120000);

    // Total due for LLC = 140,000 (VAT) + 120,000 (Profit tax) = 260,000 ₽
    expect(llcBreakdown!.totalDue).toBe(260000);
  });

  it('calculates USN 6% + 5% VAT (Rule 2025: no deductible input VAT)', () => {
    const transactions: Transaction[] = [
      // Income to IP account: 500,000 ₽
      {
        id: 'tx_inc_ip',
        type: 'income',
        amount: 500000,
        toAccountId: 'acc_ip_bank',
        legalEntityId: 'le_ip',
        transactionDate: '2026-10-15T12:00:00Z',
        createdAt: '2026-10-15T12:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
      // Expense with VAT: 100,000 ₽ — cannot be deducted for USN 5% VAT!
      {
        id: 'tx_exp_ip',
        type: 'expense',
        amount: 100000,
        fromAccountId: 'acc_ip_bank',
        legalEntityId: 'le_ip',
        hasVat: true,
        vatRate: 20,
        vatAmount: 16667,
        transactionDate: '2026-10-16T12:00:00Z',
        createdAt: '2026-10-16T12:00:00Z',
        updatedAt: '2026-10-16T12:00:00Z',
      },
    ];

    const result = calculateTaxReserve(
      transactions,
      accounts,
      { system: 'usn_income_vat5', rate: 6, applyOnlyToBank: false },
      new Date('2026-10-20'),
      [],
      legalEntities
    );

    const ipBreakdown = result.entitiesBreakdown!.find((e) => e.entityId === 'le_ip');
    expect(ipBreakdown).toBeDefined();

    // Outgoing VAT = 500,000 * 5 / 105 = 23,810 ₽
    expect(ipBreakdown!.vatOutgoing).toBe(23810);
    // Incoming VAT = 0 (prohibited by law for simplified 5% VAT)
    expect(ipBreakdown!.vatIncoming).toBe(0);
    expect(ipBreakdown!.vatNet).toBe(23810);

    // USN 6% = 500,000 * 6% = 30,000 ₽
    expect(ipBreakdown!.taxAmount).toBe(30000);

    // Total due for IP = 23,810 + 30,000 = 53,810 ₽
    expect(ipBreakdown!.totalDue).toBe(53810);
  });

  it('cash transactions are not taxed (management cash accounting)', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_inc_cash',
        type: 'income',
        amount: 300000,
        toAccountId: 'acc_cash',
        legalEntityId: 'le_cash',
        transactionDate: '2026-10-15T12:00:00Z',
        createdAt: '2026-10-15T12:00:00Z',
        updatedAt: '2026-10-15T12:00:00Z',
      },
    ];

    const result = calculateTaxReserve(
      transactions,
      accounts,
      { system: 'none', rate: 0, applyOnlyToBank: false },
      new Date('2026-10-20'),
      [],
      legalEntities
    );

    const cashBreakdown = result.entitiesBreakdown!.find((e) => e.entityId === 'le_cash');
    expect(cashBreakdown).toBeDefined();
    expect(cashBreakdown!.totalDue).toBe(0);
  });
});
