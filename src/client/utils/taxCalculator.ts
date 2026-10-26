/**
 * Tax Calculator for Russian business / agencies (`src/client/utils/taxCalculator.ts`)
 *
 * Supports:
 * - УСН «Доходы» (стандартная ставка 6%, либо региональная)
 * - УСН «Доходы минус Расходы» (стандартная ставка 15%, с правилом минимального налога 1%)
 * - Самозанятость / НПД (4% / 6%)
 * - Индивидуальная ставка (%)
 * - Без расчёта (чистый управленческий учёт)
 * - Попроектный учёт: частные мероприятия (без налога) vs официальные договоры с индивидуальной ставкой (5%, 7%, 15%, 20%)
 */

import { Transaction, Account, CompanyTaxSettings, TaxSystem, CateringEvent } from '../../shared/types.js';

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
  taxableEventsCount?: number;
  nonTaxableEventsCount?: number;
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
  targetDate: Date = new Date(),
  events: CateringEvent[] = []
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

  const eventMap = new Map<string, CateringEvent>(events.map((e) => [e.id, e]));

  let standardIncomeBase = 0;
  let customEventIncomeBase = 0;
  let customEventTaxSum = 0;
  let expenseBase = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const txDate = tx.transactionDate.slice(0, 10);
    if (txDate < startDate || txDate > endDate) continue;

    if (tx.type === 'income') {
      if (applyOnlyToBank && tx.toAccountId && !bankAccountIds.has(tx.toAccountId)) {
        continue;
      }

      // Check event taxability
      if (tx.eventId) {
        const ev = eventMap.get(tx.eventId);
        if (ev) {
          // If event is explicitly marked non-taxable (private event without contract)
          if (ev.isTaxable === false) {
            continue; // Completely exclude from tax base!
          }
          // If event has its own specific tax rate (different legal entity or VAT)
          if (ev.taxRate !== undefined && ev.taxRate !== null) {
            customEventTaxSum += Math.round(tx.amount * (ev.taxRate / 100));
            customEventIncomeBase += tx.amount;
            continue;
          }
        }
      }

      standardIncomeBase += tx.amount;
    } else if (tx.type === 'expense') {
      if (applyOnlyToBank && tx.fromAccountId && !bankAccountIds.has(tx.fromAccountId)) {
        continue;
      }
      if (tx.eventId) {
        const ev = eventMap.get(tx.eventId);
        if (ev && ev.isTaxable === false) {
          continue; // Non-taxable event expenses don't offset taxable company income
        }
      }
      expenseBase += tx.amount;
    }
  }

  let standardTax = 0;
  let calculatedTaxableBase = standardIncomeBase + customEventIncomeBase;

  if (system === 'usn_income' || system === 'npd' || system === 'custom') {
    standardTax = Math.round(standardIncomeBase * (rate / 100));
  } else if (system === 'usn_income_expense') {
    const taxableProfit = Math.max(0, standardIncomeBase - expenseBase);
    calculatedTaxableBase = taxableProfit + customEventIncomeBase;
    const calculatedTax = Math.round(taxableProfit * (rate / 100));
    const minTax = Math.round(standardIncomeBase * 0.01);
    standardTax = Math.max(calculatedTax, minTax);
  }

  const totalTaxAmount = standardTax + customEventTaxSum;

  return {
    system,
    systemLabel: labels[system],
    rate,
    applyOnlyToBank,
    incomeBase: standardIncomeBase + customEventIncomeBase,
    expenseBase,
    taxableBase: calculatedTaxableBase,
    taxAmount: totalTaxAmount,
    quarterLabel,
    isEffective: totalTaxAmount > 0 || (standardIncomeBase + customEventIncomeBase) > 0,
  };
}
