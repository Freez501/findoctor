/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Financial Statements Engine (`src/client/services/reportsGenerator.ts`)
 *
 * Deterministic generation of 5 core financial reports:
 * 1. Cash Flow Statement (ДДС: ОД, ИД, ФД)
 * 2. Profit & Loss Statement (ОПиУ: Выручка, COGS, Gross Profit, OPEX, Net Profit)
 * 3. Event Unit Economics & Variance (Маржинальность проектов и план-факт)
 * 4. Balance Sheet & Working Capital (Активы, Обязательства, Чистый капитал)
 * 5. Vendor & Payroll Statement (Ведомость расчётов с подрядчиками)
 */

import * as XLSX from 'xlsx';
import {
  Account,
  Category,
  CateringEvent,
  EventPaymentMilestone,
  EventVendor,
  Transaction,
  CompanyTaxSettings,
} from '../../shared/types.js';

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export type ReportPeriod = 'current_month' | 'prev_month' | 'current_quarter' | 'current_year' | 'all' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function getDateRangeForPeriod(period: ReportPeriod): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case 'current_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: formatYMD(start), endDate: formatYMD(end) };
    }
    case 'prev_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { startDate: formatYMD(start), endDate: formatYMD(end) };
    }
    case 'current_quarter': {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      return { startDate: formatYMD(start), endDate: formatYMD(end) };
    }
    case 'current_year': {
      return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    }
    case 'all':
    default:
      return { startDate: '2020-01-01', endDate: '2099-12-31' };
  }
}

// ----------------------------------------------------------------------------
// 1. CASH FLOW STATEMENT (ДДС)
// ----------------------------------------------------------------------------
export interface CashFlowLineItem {
  id: string;
  name: string;
  amount: number;
}

export interface CashFlowSection {
  title: string;
  items: CashFlowLineItem[];
  subtotal: number;
}

export interface CashFlowStatementData {
  periodLabel: string;
  openingBalance: number;
  operatingInflows: CashFlowSection;
  operatingOutflows: CashFlowSection;
  netOperatingCash: number;
  investingCash: CashFlowSection;
  financingCash: CashFlowSection;
  netCashChange: number;
  closingBalance: number;
}

export function generateCashFlowStatement(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  range: DateRange,
  periodLabel: string
): CashFlowStatementData {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const periodTx = transactions.filter((t) => {
    if (t.isDeleted) return false;
    const txDate = t.transactionDate.slice(0, 10);
    return txDate >= range.startDate && txDate <= range.endDate;
  });

  const currentTotal = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  // Group by category
  const opInflows: Record<string, number> = {};
  const opOutflows: Record<string, number> = {};
  const finItems: Record<string, number> = {};
  const invItems: Record<string, number> = {};

  let netOperating = 0;
  let netFinancing = 0;
  let netInvesting = 0;

  periodTx.forEach((tx) => {
    const cat = catMap.get(tx.categoryId) || 'Без категории';

    if (tx.type === 'income') {
      if (tx.categoryId === 'cat_founder_invest' || cat.toLowerCase().includes('взнос') || cat.toLowerCase().includes('займ')) {
        finItems[cat] = (finItems[cat] || 0) + tx.amount;
        netFinancing += tx.amount;
      } else {
        opInflows[cat] = (opInflows[cat] || 0) + tx.amount;
        netOperating += tx.amount;
      }
    } else if (tx.type === 'expense') {
      if (tx.categoryId === 'cat_dividends' || cat.toLowerCase().includes('дивиденд') || cat.toLowerCase().includes('вывод')) {
        finItems[cat] = (finItems[cat] || 0) - tx.amount;
        netFinancing -= tx.amount;
      } else if (tx.categoryId === 'cat_equipment' || cat.toLowerCase().includes('оборудован') || cat.toLowerCase().includes('стойк')) {
        invItems[cat] = (invItems[cat] || 0) - tx.amount;
        netInvesting -= tx.amount;
      } else {
        opOutflows[cat] = (opOutflows[cat] || 0) + tx.amount;
        netOperating -= tx.amount;
      }
    }
  });

  const totalInflowsSum = Object.values(opInflows).reduce((s, v) => s + v, 0);
  const totalOutflowsSum = Object.values(opOutflows).reduce((s, v) => s + v, 0);

  const netCashChange = round2(totalInflowsSum - totalOutflowsSum + netFinancing + netInvesting);
  const closingBalance = round2(currentTotal);
  const openingBalance = round2(closingBalance - netCashChange);

  return {
    periodLabel,
    openingBalance,
    operatingInflows: {
      title: 'Поступления по операционной деятельности',
      items: Object.entries(opInflows).map(([name, amount]) => ({ id: name, name, amount: round2(amount) })),
      subtotal: round2(totalInflowsSum),
    },
    operatingOutflows: {
      title: 'Платежи по операционной деятельности',
      items: Object.entries(opOutflows).map(([name, amount]) => ({ id: name, name, amount: round2(amount) })),
      subtotal: round2(totalOutflowsSum),
    },
    netOperatingCash: round2(totalInflowsSum - totalOutflowsSum),
    investingCash: {
      title: 'Инвестиционная деятельность',
      items: Object.entries(invItems).map(([name, amount]) => ({ id: name, name, amount: round2(amount) })),
      subtotal: round2(netInvesting),
    },
    financingCash: {
      title: 'Финансовая деятельность',
      items: Object.entries(finItems).map(([name, amount]) => ({ id: name, name, amount: round2(amount) })),
      subtotal: round2(netFinancing),
    },
    netCashChange,
    closingBalance,
  };
}

// ----------------------------------------------------------------------------
// 2. PROFIT & LOSS STATEMENT (ОПиУ / P&L)
// ----------------------------------------------------------------------------
export interface PnLStatementData {
  periodLabel: string;
  revenue: number;
  cogsItems: { name: string; amount: number; share: number }[];
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercent: number;
  opexItems: { name: string; amount: number; share: number }[];
  totalOPEX: number;
  operatingProfit: number;
  netMarginPercent: number;
  taxEstimated: number;
  taxLabel: string;
  netProfitAfterTax: number;
  netMarginAfterTaxPercent: number;
}

export function generatePnLStatement(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
  periodLabel: string,
  taxSettings?: CompanyTaxSettings,
  events: CateringEvent[] = []
): PnLStatementData {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const periodTx = transactions.filter((t) => {
    if (t.isDeleted) return false;
    const txDate = t.transactionDate.slice(0, 10);
    return txDate >= range.startDate && txDate <= range.endDate;
  });

  let revenue = 0;
  const cogsMap: Record<string, number> = {};
  const opexMap: Record<string, number> = {};

  periodTx.forEach((tx) => {
    const cat = catMap.get(tx.categoryId) || 'Без категории';

    if (tx.type === 'income') {
      if (tx.categoryId !== 'cat_founder_invest' && !cat.toLowerCase().includes('займ')) {
        revenue += tx.amount;
      }
    } else if (tx.type === 'expense') {
      if (tx.eventId) {
        cogsMap[cat] = (cogsMap[cat] || 0) + tx.amount;
      } else {
        opexMap[cat] = (opexMap[cat] || 0) + tx.amount;
      }
    }
  });

  const totalCOGS = Object.values(cogsMap).reduce((s, v) => s + v, 0);
  const totalOPEX = Object.values(opexMap).reduce((s, v) => s + v, 0);
  const grossProfit = round2(revenue - totalCOGS);
  const operatingProfit = round2(grossProfit - totalOPEX);

  const grossMarginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;
  const netMarginPercent = revenue > 0 ? round2((operatingProfit / revenue) * 100) : 0;

  // Taxation calculations for P&L with per-event taxability support
  let taxEstimated = 0;
  let taxLabel = '';
  if (taxSettings && taxSettings.system !== 'none') {
    const rate = taxSettings.rate ?? 6;
    const eventMap = new Map<string, CateringEvent>(events.map((e) => [e.id, e]));

    let taxableRevenue = 0;
    let customEventTax = 0;

    periodTx.forEach((tx) => {
      if (tx.type !== 'income') return;
      if (tx.categoryId === 'cat_founder_invest' || catMap.get(tx.categoryId)?.toLowerCase().includes('займ')) return;

      if (tx.eventId) {
        const ev = eventMap.get(tx.eventId);
        if (ev) {
          if (ev.isTaxable === false) return; // private event -> no tax!
          if (ev.taxRate !== undefined && ev.taxRate !== null) {
            customEventTax += round2(tx.amount * (ev.taxRate / 100));
            return;
          }
        }
      }
      taxableRevenue += tx.amount;
    });

    if (taxSettings.system === 'usn_income' || taxSettings.system === 'npd' || taxSettings.system === 'custom') {
      taxEstimated = round2(taxableRevenue * (rate / 100)) + customEventTax;
      taxLabel = `Расчётный налог (${taxSettings.system === 'usn_income' ? 'УСН Доходы' : taxSettings.system === 'npd' ? 'НПД' : 'Ставка'} ${rate}%)`;
    } else if (taxSettings.system === 'usn_income_expense') {
      const taxableBase = Math.max(0, operatingProfit);
      const standardTax = round2(taxableBase * (rate / 100));
      const minTax = round2(taxableRevenue * 0.01);
      taxEstimated = Math.max(standardTax, minTax) + customEventTax;
      taxLabel = `Расчётный налог (УСН Доходы-Расходы ${rate}%)`;
    }
  }

  const netProfitAfterTax = round2(operatingProfit - taxEstimated);
  const netMarginAfterTaxPercent = revenue > 0 ? round2((netProfitAfterTax / revenue) * 100) : 0;

  return {
    periodLabel,
    revenue: round2(revenue),
    cogsItems: Object.entries(cogsMap).map(([name, amount]) => ({
      name,
      amount: round2(amount),
      share: revenue > 0 ? round2((amount / revenue) * 100) : 0,
    })),
    totalCOGS: round2(totalCOGS),
    grossProfit,
    grossMarginPercent,
    opexItems: Object.entries(opexMap).map(([name, amount]) => ({
      name,
      amount: round2(amount),
      share: revenue > 0 ? round2((amount / revenue) * 100) : 0,
    })),
    totalOPEX: round2(totalOPEX),
    operatingProfit,
    netMarginPercent,
    taxEstimated,
    taxLabel,
    netProfitAfterTax,
    netMarginAfterTaxPercent,
  };
}

// ----------------------------------------------------------------------------
// 3. EVENT UNIT ECONOMICS & VARIANCE (Маржинальность проектов)
// ----------------------------------------------------------------------------
export interface EventUnitEconomicsItem {
  id: string;
  title: string;
  date: string;
  status: string;
  planRevenue: number;
  factRevenue: number;
  revenueVariance: number;
  planExpenses: number;
  factExpenses: number;
  expenseVariance: number;
  netProfit: number;
  marginPercent: number;
}

export function generateEventEconomicsReport(
  events: CateringEvent[],
  transactions: Transaction[],
  range: DateRange
): EventUnitEconomicsItem[] {
  const filteredEvents = events.filter((e) => {
    return e.eventDate >= range.startDate && e.eventDate <= range.endDate;
  });

  return filteredEvents.map((ev) => {
    const evTx = transactions.filter((t) => !t.isDeleted && t.eventId === ev.id);
    const factRevenue = round2(evTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    const factExpenses = round2(evTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    const netProfit = round2(factRevenue - factExpenses);
    const marginPercent = factRevenue > 0 ? round2((netProfit / factRevenue) * 100) : 0;

    const planRevenue = ev.contractAmount || ev.budget || factRevenue;
    const planExpenses = ev.budget ? round2(ev.budget * 0.5) : factExpenses;

    return {
      id: ev.id,
      title: ev.title,
      date: ev.eventDate,
      status: ev.status,
      planRevenue: round2(planRevenue),
      factRevenue,
      revenueVariance: round2(factRevenue - planRevenue),
      planExpenses: round2(planExpenses),
      factExpenses,
      expenseVariance: round2(factExpenses - planExpenses),
      netProfit,
      marginPercent,
    };
  });
}

// ----------------------------------------------------------------------------
// 4. BALANCE SHEET & WORKING CAPITAL (Управленческий баланс)
// ----------------------------------------------------------------------------
export interface BalanceSheetData {
  asOfDate: string;
  cashAccounts: { id: string; name: string; balance: number }[];
  totalCash: number;
  accountsReceivable: number; // Uncollected customer milestones
  totalAssets: number;
  accountsPayable: number;    // Unpaid vendor fees
  totalLiabilities: number;
  netWorkingCapital: number;  // Assets - Liabilities
}

export function generateBalanceSheet(
  accounts: Account[],
  milestones: EventPaymentMilestone[],
  vendors: EventVendor[]
): BalanceSheetData {
  const totalCash = round2(accounts.reduce((s, a) => s + (a.currentBalance || 0), 0));

  // Receivable: pending milestones from clients
  const accountsReceivable = round2(
    milestones
      .filter((m) => m.status === 'pending' || m.status === 'overdue')
      .reduce((s, m) => s + (m.amount - (m.paidAmount || 0)), 0)
  );

  // Payable: remaining fees to vendors
  const accountsPayable = round2(
    vendors
      .filter((v) => v.status !== 'paid')
      .reduce((s, v) => s + v.remainingAmount, 0)
  );

  const totalAssets = round2(totalCash + accountsReceivable);
  const totalLiabilities = round2(accountsPayable);
  const netWorkingCapital = round2(totalAssets - totalLiabilities);

  return {
    asOfDate: new Date().toLocaleDateString('ru-RU'),
    cashAccounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: round2(a.currentBalance || 0) })),
    totalCash,
    accountsReceivable,
    totalAssets,
    accountsPayable,
    totalLiabilities,
    netWorkingCapital,
  };
}

// ----------------------------------------------------------------------------
// 5. VENDOR PAYROLL STATEMENT (Ведомость расчётов с подрядчиками)
// ----------------------------------------------------------------------------
export interface VendorPayrollSummary {
  vendors: {
    id: string;
    name: string;
    role: string;
    eventTitle?: string;
    agreedFee: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    dueDate?: string;
  }[];
  totalFee: number;
  totalPaid: number;
  totalRemaining: number;
}

export function generateVendorPayrollStatement(
  vendors: EventVendor[],
  events: CateringEvent[]
): VendorPayrollSummary {
  const eventMap = new Map(events.map((e) => [e.id, e.title]));

  const list = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    role: v.role,
    eventTitle: eventMap.get(v.eventId) || 'Неизвестное мероприятие',
    agreedFee: v.agreedFee,
    paidAmount: v.paidAmount,
    remainingAmount: v.remainingAmount,
    status: v.status === 'paid' ? 'Выплачено' : v.status === 'partial' ? 'Частично' : 'Ожидает',
    dueDate: v.dueDate,
  }));

  const totalFee = round2(vendors.reduce((s, v) => s + v.agreedFee, 0));
  const totalPaid = round2(vendors.reduce((s, v) => s + v.paidAmount, 0));
  const totalRemaining = round2(vendors.reduce((s, v) => s + v.remainingAmount, 0));

  return {
    vendors: list,
    totalFee,
    totalPaid,
    totalRemaining,
  };
}

// ----------------------------------------------------------------------------
// EXCEL EXPORT HELPER (XLSX)
// ----------------------------------------------------------------------------
export function exportReportToExcel(
  reportName: string,
  fileName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const wb = XLSX.utils.book_new();
  const wsData = [
    [`ОТЧЁТ: ${reportName}`],
    [`Сформировано: ${new Date().toLocaleString('ru-RU')}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  XLSX.utils.book_append_sheet(wb, ws, reportName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
