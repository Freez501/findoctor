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

import { Transaction, Account, CompanyTaxSettings, TaxSystem, CateringEvent, LegalEntity, LegalEntityTaxSystem } from '../../shared/types.js';

export interface LegalEntityTaxBreakdown {
  entityId: string;
  entityName: string;
  type: string;
  taxSystem: LegalEntityTaxSystem;
  taxSystemLabel: string;
  income: number;
  expense: number;
  vatOutgoing: number; // Исходящий НДС с продаж
  vatIncoming: number; // Входящий НДС к вычету (по УПД)
  vatInDocs?: number;  // НДС во всех документах, даже если режим не даёт права на вычет
  docsCount?: number;  // Сколько расходов с закрывающими документами за период
  vatNet: number;      // Итого НДС к уплате
  taxAmount: number;   // Налог на прибыль или УСН
  totalDue: number;    // Суммарная налоговая обязанность (НДС + налог)
}

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
  entitiesBreakdown?: LegalEntityTaxBreakdown[];
  totalVatIncoming?: number;
  totalVatOutgoing?: number;
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
  events: CateringEvent[] = [],
  legalEntities: LegalEntity[] = []
): TaxCalculationResult {
  const system: TaxSystem = taxSettings?.system || 'usn_income';
  const rate: number = taxSettings?.rate ?? 6;
  const applyOnlyToBank: boolean = taxSettings?.applyOnlyToBank ?? false;

  const labels: Record<TaxSystem, string> = {
    usn_income: `УСН «Доходы» (${rate}%)`,
    usn_income_expense: `УСН «Доходы минус Расходы» (${rate}%)`,
    usn_income_vat5: `УСН «Доходы» + НДС 5%`,
    usn_income_vat7: `УСН «Доходы» + НДС 7%`,
    osno: `ОСНО (НДС 20% + Налог на прибыль)`,
    npd: `Самозанятость / НПД (${rate}%)`,
    custom: `Своя ставка (${rate}%)`,
    none: 'Без налога (чистый управленческий учёт)',
  };

  const { startDate, endDate, quarterLabel } = getQuarterDateRange(targetDate);

  // If legal entities are defined, calculate multi-entity group breakdown
  if (legalEntities && legalEntities.length > 0) {
    const accountEntityMap = new Map<string, string>();
    for (const acc of accounts) {
      if (acc.legalEntityId) {
        accountEntityMap.set(acc.id, acc.legalEntityId);
      }
    }

    const eventMap = new Map<string, CateringEvent>(events.map((e) => [e.id, e]));
    const periodTx = transactions.filter((tx) => {
      if (tx.isDeleted) return false;
      const txDate = tx.transactionDate.slice(0, 10);
      return txDate >= startDate && txDate <= endDate;
    });

    const defaultEntity = legalEntities.find((le) => le.isDefault) || legalEntities[0];
    const entitiesBreakdown: LegalEntityTaxBreakdown[] = [];
    let groupIncome = 0;
    let groupExpense = 0;
    let totalTaxAmount = 0;
    let totalVatIncoming = 0;
    let totalVatOutgoing = 0;

    for (const entity of legalEntities) {
      let entIncome = 0;
      let entExpense = 0;
      let entVatIncoming = 0;
      let entDocsCount = 0;

      for (const tx of periodTx) {
        // Resolve entity for tx: explicit legalEntityId or derived from account
        let txEntityId = tx.legalEntityId;
        if (!txEntityId) {
          if (tx.type === 'income' && tx.toAccountId) {
            txEntityId = accountEntityMap.get(tx.toAccountId);
          } else if (tx.type === 'expense' && tx.fromAccountId) {
            txEntityId = accountEntityMap.get(tx.fromAccountId);
          }
        }
        if (!txEntityId) {
          txEntityId = defaultEntity.id;
        }

        if (txEntityId !== entity.id) continue;

        // Skip non-taxable private events
        if (tx.eventId) {
          const ev = eventMap.get(tx.eventId);
          if (ev && ev.isTaxable === false) {
            continue;
          }
        }

        if (tx.type === 'income') {
          entIncome += tx.amount;
        } else if (tx.type === 'expense') {
          entExpense += tx.amount;
          if (tx.hasVat) {
            const vRate = tx.vatRate ?? 20;
            const vAmt = tx.vatAmount !== undefined && tx.vatAmount !== null ? tx.vatAmount : Math.round(tx.amount * vRate / (100 + vRate));
            entVatIncoming += vAmt;
            entDocsCount += 1;
          }
        }
      }

      groupIncome += entIncome;
      groupExpense += entExpense;

      let vatOutgoing = 0;
      let vatIncoming = 0;
      let vatNet = 0;
      let taxAmount = 0;
      let totalDue = 0;

      const entSys = entity.taxSystem || 'usn_income';
      const entRate = entity.taxRate !== undefined ? entity.taxRate : 6;
      const entVatRate = entity.vatRate !== undefined ? entity.vatRate : 20;

      let entLabel = `УСН (${entRate}%)`;
      if (entSys === 'osno') {
        entLabel = `ОСНО (НДС ${entVatRate}% + Прибыль ${entRate}%)`;
        vatOutgoing = Math.round(entIncome * (entVatRate / (100 + entVatRate)));
        vatIncoming = entVatIncoming;
        vatNet = Math.max(0, vatOutgoing - vatIncoming);
        const taxableProfit = Math.max(0, (entIncome - vatOutgoing) - (entExpense - vatIncoming));
        taxAmount = Math.round(taxableProfit * (entRate / 100));
        totalDue = vatNet + taxAmount;
      } else if (entSys === 'usn_income_vat5') {
        entLabel = `УСН «Доходы» (${entRate}%) + НДС 5%`;
        vatOutgoing = Math.round(entIncome * (5 / 105));
        vatIncoming = 0; // No input VAT deductions allowed for 5% rate by law
        vatNet = vatOutgoing;
        taxAmount = Math.round(entIncome * (entRate / 100));
        totalDue = vatNet + taxAmount;
      } else if (entSys === 'usn_income_vat7') {
        entLabel = `УСН «Доходы» (${entRate}%) + НДС 7%`;
        vatOutgoing = Math.round(entIncome * (7 / 107));
        vatIncoming = 0;
        vatNet = vatOutgoing;
        taxAmount = Math.round(entIncome * (entRate / 100));
        totalDue = vatNet + taxAmount;
      } else if (entSys === 'usn_income' || entSys === 'custom') {
        entLabel = `УСН «Доходы» (${entRate}%)`;
        taxAmount = Math.round(entIncome * (entRate / 100));
        totalDue = taxAmount;
      } else if (entSys === 'usn_income_expense') {
        entLabel = `УСН «Доходы минус Расходы» (${entRate}%)`;
        const taxableProfit = Math.max(0, entIncome - entExpense);
        const standardTax = Math.round(taxableProfit * (entRate / 100));
        const minTax = Math.round(entIncome * 0.01);
        taxAmount = Math.max(standardTax, minTax);
        totalDue = taxAmount;
      } else if (entSys === 'npd') {
        entLabel = `Самозанятость (${entRate}%)`;
        taxAmount = Math.round(entIncome * (entRate / 100));
        totalDue = taxAmount;
      } else if (entSys === 'none') {
        entLabel = 'Без налога';
        totalDue = 0;
      }

      totalTaxAmount += totalDue;
      totalVatIncoming += vatIncoming;
      totalVatOutgoing += vatOutgoing;

      entitiesBreakdown.push({
        entityId: entity.id,
        entityName: entity.name,
        type: entity.type,
        taxSystem: entSys,
        taxSystemLabel: entLabel,
        income: entIncome,
        expense: entExpense,
        vatOutgoing,
        vatIncoming,
        vatInDocs: entVatIncoming,
        docsCount: entDocsCount,
        vatNet,
        taxAmount,
        totalDue,
      });
    }

    return {
      system,
      systemLabel: 'Группа компаний (по юрлицам)',
      rate,
      applyOnlyToBank,
      incomeBase: groupIncome,
      expenseBase: groupExpense,
      taxableBase: groupIncome,
      taxAmount: totalTaxAmount,
      quarterLabel,
      isEffective: totalTaxAmount > 0 || groupIncome > 0,
      entitiesBreakdown,
      totalVatIncoming,
      totalVatOutgoing,
    };
  }

  // Fallback single-tenant calculation (when no legal entities configured)
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
