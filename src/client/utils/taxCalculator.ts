/**
 * Tax Calculator for Russian business / agencies (`src/client/utils/taxCalculator.ts`)
 *
 * Supports:
 * - УСН «Доходы» (стандартная ставка 6%, либо региональная)
 * - УСН «Доходы минус Расходы» (стандартная ставка 15%, с правилом минимального налога 1%)
 * - Самозанятость / НПД (4% / 6%)
 * - Индивидуальная ставка (%)
 * - Без расчёта (чистый управленческий учёт)
 */

import { Transaction, Account, CompanyTaxSettings, TaxSystem } from '../../shared/types.js';

export interface TaxCalculationResult {
  system: TaxSystem;
  systemLabel: string;
  rate: number;
  applyOnlyToBank: boolean;
  incomeBase: number;
  expenseBase: number;
  taxableBase: number;
  taxAmount: number;
  quarterLabel: string;
  isEffective: boolean;
}

export function getQuarterDateRange(date: Date = new Date()): { startDate: string; endDate: string; quarterLabel: string } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));

  const quarterRoman = ['I', 'II', 'III', 'IV'][quarter - 1];
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    quarterLabel: `${quarterRoman} кв. ${year}`,
  };
}

export function calculateTaxReserve(
  transactions: Transaction[],
  accounts: Account[],
  taxSettings?: CompanyTaxSettings,
  targetDate: Date = new Date()
): TaxCalculationResult {
  const system: TaxSystem = taxSettings?.system || 'usn_income';
  const rate: number = taxSettings?.rate ?? 6;
  const applyOnlyToBank: boolean = taxSettings?.applyOnlyToBank ?? false;

  const labels: Record<TaxSystem, string> = {
    usn_income: `УСН «Доходы» (${rate}%)`,
    usn_income_expense: `УСН «Доходы минус Расходы» (${rate}%)`,
    npd: `Самозанятость / НПД (${rate}%)`,
    custom: `Своя ставка (${rate}%)`,
    none: 'Без налога (чистый управленческий учёт)',
  };

  const { startDate, endDate, quarterLabel } = getQuarterDateRange(targetDate);

  if (system === 'none') {
    return {
      system,
      systemLabel: labels.none,
      rate: 0,
      applyOnlyToBank,
      incomeBase: 0,
      expenseBase: 0,
      taxableBase: 0,
      taxAmount: 0,
      quarterLabel,
      isEffective: false,
    };
  }

  const bankAccountIds = new Set(
    accounts.filter((a) => a.type === 'bank' || a.type === 'card').map((a) => a.id)
  );

  let incomeBase = 0;
  let expenseBase = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const txDate = tx.transactionDate.slice(0, 10);
    if (txDate < startDate || txDate > endDate) continue;

    if (tx.type === 'income') {
      if (applyOnlyToBank && tx.toAccountId && !bankAccountIds.has(tx.toAccountId)) {
        continue;
      }
      incomeBase += tx.amount;
    } else if (tx.type === 'expense') {
      if (applyOnlyToBank && tx.fromAccountId && !bankAccountIds.has(tx.fromAccountId)) {
        continue;
      }
      expenseBase += tx.amount;
    }
  }

  let taxableBase = 0;
  let taxAmount = 0;

  if (system === 'usn_income' || system === 'npd' || system === 'custom') {
    taxableBase = incomeBase;
    taxAmount = Math.round(incomeBase * (rate / 100));
  } else if (system === 'usn_income_expense') {
    taxableBase = Math.max(0, incomeBase - expenseBase);
    // Минимальный налог для УСН Доходы минус Расходы в РФ: 1% от доходов
    const standardTax = Math.round(taxableBase * (rate / 100));
    const minTax = Math.round(incomeBase * 0.01);
    taxAmount = Math.max(standardTax, minTax);
  }

  return {
    system,
    systemLabel: labels[system],
    rate,
    applyOnlyToBank,
    incomeBase,
    expenseBase,
    taxableBase,
    taxAmount,
    quarterLabel,
    isEffective: taxAmount > 0 || incomeBase > 0,
  };
}
