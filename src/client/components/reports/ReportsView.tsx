/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Executive Financial Reports Suite (`src/client/components/reports/ReportsView.tsx`)
 *
 * Professional 5 Core Financial Statements:
 * 1. ДДС (Отчёт о движении денежных средств / Cash Flow)
 * 2. ОПиУ (Отчёт о прибылях и убытках / P&L)
 * 3. Маржинальность проектов и юнит-экономика
 * 4. Управленческий баланс и рабочий капитал
 * 5. Ведомость расчётов с подрядчиками и ФОТ
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  TrendingUp,
  Wallet,
  Scale,
  Users,
  PieChart,
  Landmark,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/apiClient.js';
import {
  EventPaymentMilestone,
  EventVendor,
} from '../../../shared/types.js';
import { formatRubles, formatPercent, formatDateRu } from '../../utils/formatters.js';
import { calculateTaxReserve } from '../../utils/taxCalculator.js';
import {
  ReportPeriod,
  getDateRangeForPeriod,
  generateCashFlowStatement,
  generatePnLStatement,
  generateEventEconomicsReport,
  generateBalanceSheet,
  generateVendorPayrollStatement,
  exportReportToExcel,
} from '../../services/reportsGenerator.js';

type StatementTab = 'cashflow' | 'pnl' | 'economics' | 'balance' | 'payroll' | 'taxes';

export const ReportsView: React.FC = () => {
  const { accounts, events, transactions, categories, legalEntities, addToast } = useFinance();
  const { currentCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<StatementTab>('cashflow');
  const [period, setPeriod] = useState<ReportPeriod>('current_month');
  const [allMilestones, setAllMilestones] = useState<EventPaymentMilestone[]>([]);
  const [allVendors, setAllVendors] = useState<EventVendor[]>([]);

  // Calculate active date range
  const dateRange = useMemo(() => getDateRangeForPeriod(period), [period]);

  const periodLabels: Record<ReportPeriod, string> = {
    current_month: 'Текущий месяц',
    prev_month: 'Прошлый месяц',
    current_quarter: 'Текущий квартал',
    current_year: 'Текущий год',
    all: 'За всё время',
    custom: 'Произвольный',
  };

  const currentPeriodLabel = `${periodLabels[period]} (${formatDateRu(dateRange.startDate)} — ${formatDateRu(dateRange.endDate)})`;

  // Load milestones and vendors across all events for Balance & Payroll
  const loadMilestonesAndVendors = useCallback(async () => {
    if (events.length === 0) return;
    try {
      const milestonesPromises = events.map((ev) =>
        api.getMilestones(ev.id).catch(() => ({ milestones: [] }))
      );
      const vendorsPromises = events.map((ev) =>
        api.getVendors(ev.id).catch(() => ({ vendors: [] }))
      );

      const [milestoneResults, vendorResults] = await Promise.all([
        Promise.all(milestonesPromises),
        Promise.all(vendorsPromises),
      ]);

      const flatMilestones = milestoneResults.flatMap((r) => r.milestones || []);
      const flatVendors = vendorResults.flatMap((r) => r.vendors || []);

      setAllMilestones(flatMilestones);
      setAllVendors(flatVendors);
    } catch {
      // ignore
    }
  }, [events]);

  useEffect(() => {
    loadMilestonesAndVendors();
  }, [loadMilestonesAndVendors]);

  // --------------------------------------------------------------------------
  // GENERATE STATEMENTS
  // --------------------------------------------------------------------------
  const cashFlow = useMemo(() => {
    return generateCashFlowStatement(transactions, accounts, categories, dateRange, currentPeriodLabel);
  }, [transactions, accounts, categories, dateRange, currentPeriodLabel]);

  const pnl = useMemo(() => {
    return generatePnLStatement(
      transactions,
      categories,
      dateRange,
      currentPeriodLabel,
      currentCompany?.taxSettings || {
        system: currentCompany?.taxSystem || 'usn_income',
        rate: currentCompany?.taxRate ?? 6,
        applyOnlyToBank: false,
      },
      events
    );
  }, [transactions, categories, dateRange, currentPeriodLabel, currentCompany, events]);

  const eventEconomics = useMemo(() => {
    return generateEventEconomicsReport(events, transactions, dateRange);
  }, [events, transactions, dateRange]);

  const balanceSheet = useMemo(() => {
    return generateBalanceSheet(accounts, allMilestones, allVendors);
  }, [accounts, allMilestones, allVendors]);

  const vendorPayroll = useMemo(() => {
    return generateVendorPayrollStatement(allVendors, events);
  }, [allVendors, events]);

  const taxReport = useMemo(() => {
    return calculateTaxReserve(
      transactions,
      accounts,
      currentCompany?.taxSettings || {
        system: currentCompany?.taxSystem || 'usn_income',
        rate: currentCompany?.taxRate ?? 6,
        applyOnlyToBank: false,
      },
      new Date(),
      events,
      legalEntities
    );
  }, [transactions, accounts, currentCompany, events, legalEntities]);

  // --------------------------------------------------------------------------
  // EXPORT TO EXCEL
  // --------------------------------------------------------------------------
  const handleExportExcel = () => {
    try {
      if (activeTab === 'cashflow') {
        const headers = ['Статья движения ДС', 'Сумма (₽)'];
        const rows: (string | number)[][] = [
          ['Остаток на начало периода', cashFlow.openingBalance],
          ['--- ПОСТУПЛЕНИЯ (Операционная деятельность) ---', ''],
          ...cashFlow.operatingInflows.items.map((i) => [i.name, i.amount]),
          ['Итого поступления ОД', cashFlow.operatingInflows.subtotal],
          ['--- ПЛАТЕЖИ (Операционная деятельность) ---', ''],
          ...cashFlow.operatingOutflows.items.map((i) => [i.name, -i.amount]),
          ['Итого платежи ОД', -cashFlow.operatingOutflows.subtotal],
          ['Чистый операционный поток', cashFlow.netOperatingCash],
          ['Инвестиционная деятельность', cashFlow.investingCash.subtotal],
          ['Финансовая деятельность', cashFlow.financingCash.subtotal],
          ['Чистое изменение денежных средств', cashFlow.netCashChange],
          ['Остаток на конец периода', cashFlow.closingBalance],
        ];
        exportReportToExcel('ДДС (Cash Flow)', `ДДС_${dateRange.startDate}_${dateRange.endDate}`, headers, rows);
      } else if (activeTab === 'pnl') {
        const headers = ['Статья доходов и расходов', 'Сумма (₽)', 'Доля выручки (%)'];
        const rows: (string | number)[][] = [
          ['Выручка от мероприятий', pnl.revenue, '100%'],
          ['--- ПРЯМЫЕ ЗАТРАТЫ (COGS) ---', '', ''],
          ...pnl.cogsItems.map((i) => [i.name, i.amount, `${i.share}%`]),
          ['Итого прямая себестоимость', pnl.totalCOGS, `${pnl.revenue > 0 ? ((pnl.totalCOGS / pnl.revenue) * 100).toFixed(1) : 0}%`],
          ['ВАЛОВАЯ ПРИБЫЛЬ (Gross Profit)', pnl.grossProfit, `${pnl.grossMarginPercent}%`],
          ['--- ОБЩЕХОЗЯЙСТВЕННЫЕ РАСХОДЫ (OPEX) ---', '', ''],
          ...pnl.opexItems.map((i) => [i.name, i.amount, `${i.share}%`]),
          ['Итого постоянные расходы', pnl.totalOPEX, `${pnl.revenue > 0 ? ((pnl.totalOPEX / pnl.revenue) * 100).toFixed(1) : 0}%`],
          ['ОПЕРАЦИОННАЯ ПРИБЫЛЬ (EBITDA)', pnl.operatingProfit, `${pnl.netMarginPercent}%`],
          ...(pnl.taxEstimated > 0
            ? [
                [pnl.taxLabel || 'Оценочный налог', -pnl.taxEstimated, `${pnl.revenue > 0 ? ((pnl.taxEstimated / pnl.revenue) * 100).toFixed(1) : 0}%`],
                ['ЧИСТАЯ ПРИБЫЛЬ К РАСПРЕДЕЛЕНИЮ ПОСЛЕ НАЛОГОВ', pnl.netProfitAfterTax, `${pnl.netMarginAfterTaxPercent}%`],
              ]
            : []),
        ];
        exportReportToExcel('ОПиУ (P&L)', `ОПиУ_${dateRange.startDate}_${dateRange.endDate}`, headers, rows);
      } else if (activeTab === 'economics') {
        const headers = ['Мероприятие', 'Дата', 'Статус', 'План выручка (₽)', 'Факт выручка (₽)', 'Факт расходы (₽)', 'Чистая прибыль (₽)', 'Маржа (%)'];
        const rows = eventEconomics.map((e) => [
          e.title,
          e.date,
          e.status,
          e.planRevenue,
          e.factRevenue,
          e.factExpenses,
          e.netProfit,
          `${e.marginPercent}%`,
        ]);
        exportReportToExcel('Маржинальность проектов', `Маржинальность_${dateRange.startDate}_${dateRange.endDate}`, headers, rows);
      } else if (activeTab === 'balance') {
        const headers = ['Статья баланса', 'Сумма (₽)'];
        const rows: (string | number)[][] = [
          ['--- АКТИВЫ (Ликвидность и ДЗ) ---', ''],
          ...balanceSheet.cashAccounts.map((a) => [a.name, a.balance]),
          ['Итого денежные средства', balanceSheet.totalCash],
          ['Дебиторская задолженность заказчиков', balanceSheet.accountsReceivable],
          ['ИТОГО АКТИВЫ', balanceSheet.totalAssets],
          ['--- ОБЯЗАТЕЛЬСТВА (КЗ подрядчикам) ---', ''],
          ['Кредиторская задолженность перед командой', balanceSheet.accountsPayable],
          ['ИТОГО ОБЯЗАТЕЛЬСТВА', balanceSheet.totalLiabilities],
          ['ЧИСТЫЙ РАБОЧИЙ КАПИТАЛ (Net Working Capital)', balanceSheet.netWorkingCapital],
        ];
        exportReportToExcel('Управленческий баланс', `Баланс_${new Date().toISOString().slice(0, 10)}`, headers, rows);
      } else if (activeTab === 'payroll') {
        const headers = ['Подрядчик', 'Роль', 'Мероприятие', 'Гонорар (₽)', 'Выплачено (₽)', 'Остаток к выплате (₽)', 'Статус', 'Срок'];
        const rows = vendorPayroll.vendors.map((v) => [
          v.name,
          v.role,
          v.eventTitle || '',
          v.agreedFee,
          v.paidAmount,
          v.remainingAmount,
          v.status,
          v.dueDate || '',
        ]);
        exportReportToExcel('Ведомость расчётов с подрядчиками', `Ведомость_подрядчиков_${new Date().toISOString().slice(0, 10)}`, headers, rows);
      } else if (activeTab === 'taxes') {
        const headers = ['Юрлицо', 'Режим', 'Выручка (₽)', 'Расходы (₽)', 'Исходящий НДС (₽)', 'Вычет НДС по УПД (₽)', 'НДС к уплате (₽)', 'Налог УСН/Прибыль (₽)', 'Итого к уплате (₽)'];
        const rows = (taxReport.entitiesBreakdown || []).map((ent) => [
          ent.entityName,
          ent.taxSystemLabel,
          ent.income,
          ent.expense,
          ent.vatOutgoing,
          ent.vatIncoming,
          ent.vatNet,
          ent.taxAmount,
          ent.totalDue,
        ]);
        exportReportToExcel(`Налоги и вычет НДС (${taxReport.quarterLabel})`, `Налоги_и_НДС_${taxReport.quarterLabel.replace(/\s+/g, '_')}`, headers, rows);
      }

      addToast('Отчёт успешно экспортирован в Excel (.xlsx)', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка экспорта в Excel', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-container">
      {/* Top Header Card */}
      <div className="reports-header-card">
        <div className="reports-header-title">
          <div className="reports-header-icon">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
              Управленческие финансовые отчёты
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Классические финансовые формы для собственника и финансового директора
            </span>
          </div>
        </div>

        {/* Action Buttons: Excel & Print */}
        <div className="reports-actions-group">
          <button
            type="button"
            onClick={handleExportExcel}
            className="reports-export-btn"
            title="Выгрузить отчёт в таблицу Microsoft Excel"
          >
            <FileSpreadsheet size={16} />
            <span>Экспорт в Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="reports-print-btn"
            title="Распечатать или сохранить в PDF"
          >
            <Printer size={16} />
            <span>Печать / PDF</span>
          </button>
        </div>
      </div>

      {/* Period Selector Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} />
            <span>Период отчёта:</span>
          </span>
          {(['current_month', 'prev_month', 'current_quarter', 'current_year', 'all'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`reports-period-chip ${period === p ? 'active' : ''}`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>
          {currentPeriodLabel}
        </span>
      </div>

      {/* Statement Tabs Navigation */}
      <div className="reports-tabs-nav">
        <button
          type="button"
          onClick={() => setActiveTab('cashflow')}
          className={`reports-tab-item ${activeTab === 'cashflow' ? 'active' : ''}`}
        >
          <Wallet size={15} />
          <span>1. ДДС (Cash Flow)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pnl')}
          className={`reports-tab-item ${activeTab === 'pnl' ? 'active' : ''}`}
        >
          <TrendingUp size={15} />
          <span>2. ОПиУ (P&L)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('economics')}
          className={`reports-tab-item ${activeTab === 'economics' ? 'active' : ''}`}
        >
          <PieChart size={15} />
          <span>3. Маржа проектов</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('balance')}
          className={`reports-tab-item ${activeTab === 'balance' ? 'active' : ''}`}
        >
          <Scale size={15} />
          <span>4. Баланс</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`reports-tab-item ${activeTab === 'payroll' ? 'active' : ''}`}
        >
          <Users size={15} />
          <span>5. Подрядчики</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('taxes')}
          className={`reports-tab-item ${activeTab === 'taxes' ? 'active' : ''}`}
        >
          <Landmark size={15} />
          <span>6. Налоги и НДС</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. CASH FLOW STATEMENT TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'cashflow' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Отчёт о движении денежных средств (ДДС / Cash Flow)</h3>
              <span className="statement-subtitle">
                Кассовый метод • Учёт фактических поступлений и выплат на всех 5 счетах
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Чистое изменение за период:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: cashFlow.netCashChange >= 0 ? '#059669' : '#dc2626' }}>
                {cashFlow.netCashChange >= 0 ? '+' : ''}{formatRubles(cashFlow.netCashChange)}
              </span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Статья движения денежных средств</th>
                  <th className="num-col" style={{ width: '220px' }}>Сумма (₽)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="statement-row-subtotal">
                  <td>Остаток денежных средств на начало периода</td>
                  <td className="num-col"><strong>{formatRubles(cashFlow.openingBalance)}</strong></td>
                </tr>

                {/* Operating Inflows */}
                <tr className="statement-row-section">
                  <td colSpan={2}>1. ПОСТУПЛЕНИЯ ПО ОПЕРАЦИОННОЙ ДЕЯТЕЛЬНОСТИ</td>
                </tr>
                {cashFlow.operatingInflows.items.length === 0 ? (
                  <tr>
                    <td style={{ color: 'var(--color-text-muted)', paddingLeft: '32px' }}>Нет поступлений за выбранный период</td>
                    <td className="num-col">0 ₽</td>
                  </tr>
                ) : (
                  cashFlow.operatingInflows.items.map((i) => (
                    <tr key={i.id} className="statement-row-subitem">
                      <td>{i.name}</td>
                      <td className="num-col" style={{ color: '#059669', fontWeight: 600 }}>+{formatRubles(i.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="statement-row-subtotal">
                  <td>Итого поступлений от клиентов</td>
                  <td className="num-col" style={{ color: '#059669' }}>+{formatRubles(cashFlow.operatingInflows.subtotal)}</td>
                </tr>

                {/* Operating Outflows */}
                <tr className="statement-row-section">
                  <td colSpan={2}>2. ПЛАТЕЖИ ПО ОПЕРАЦИОННОЙ ДЕЯТЕЛЬНОСТИ</td>
                </tr>
                {cashFlow.operatingOutflows.items.length === 0 ? (
                  <tr>
                    <td style={{ color: 'var(--color-text-muted)', paddingLeft: '32px' }}>Нет списаний за выбранный период</td>
                    <td className="num-col">0 ₽</td>
                  </tr>
                ) : (
                  cashFlow.operatingOutflows.items.map((i) => (
                    <tr key={i.id} className="statement-row-subitem">
                      <td>{i.name}</td>
                      <td className="num-col" style={{ color: '#dc2626', fontWeight: 600 }}>-{formatRubles(i.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="statement-row-subtotal">
                  <td>Итого операционных расходов</td>
                  <td className="num-col" style={{ color: '#dc2626' }}>-{formatRubles(cashFlow.operatingOutflows.subtotal)}</td>
                </tr>

                {/* Net Operating */}
                <tr className="statement-row-grandtotal">
                  <td>ЧИСТЫЙ ОПЕРАЦИОННЫЙ ДЕНЕЖНЫЙ ПОТОК (Operating Cash Flow)</td>
                  <td className="num-col">
                    {cashFlow.netOperatingCash >= 0 ? '+' : ''}{formatRubles(cashFlow.netOperatingCash)}
                  </td>
                </tr>

                {/* Financing & Investing */}
                {(cashFlow.financingCash.subtotal !== 0 || cashFlow.investingCash.subtotal !== 0) && (
                  <>
                    <tr className="statement-row-section">
                      <td colSpan={2}>3. ФИНАНСОВАЯ И ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ</td>
                    </tr>
                    <tr className="statement-row-subitem">
                      <td>Финансовая деятельность (вклады/дивиденды/займы)</td>
                      <td className="num-col">{formatRubles(cashFlow.financingCash.subtotal)}</td>
                    </tr>
                    <tr className="statement-row-subitem">
                      <td>Инвестиционная деятельность (оборудование)</td>
                      <td className="num-col">{formatRubles(cashFlow.investingCash.subtotal)}</td>
                    </tr>
                  </>
                )}

                {/* Closing Balance */}
                <tr className="statement-row-grandtotal">
                  <td>ОСТАТОК ДЕНЕЖНЫХ СРЕДСТВ НА КОНЕЦ ПЕРИОДА (5 счетов)</td>
                  <td className="num-col">
                    {formatRubles(cashFlow.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. PROFIT & LOSS STATEMENT TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'pnl' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Отчёт о прибылях и убытках (ОПиУ / P&L)</h3>
              <span className="statement-subtitle">
                Метод начисления • Экономическая эффективность и чистая рентабельность бизнеса
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Чистая рентабельность:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: pnl.netMarginPercent >= 30 ? '#059669' : '#f59e0b' }}>
                {formatPercent(pnl.netMarginPercent, 1)}
              </span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Статья доходов и расходов</th>
                  <th className="num-col" style={{ width: '200px' }}>Сумма (₽)</th>
                  <th className="num-col" style={{ width: '120px' }}>Доля выручки</th>
                </tr>
              </thead>
              <tbody>
                <tr className="statement-row-section">
                  <td colSpan={3}>1. ВЫРУЧКА</td>
                </tr>
                <tr className="statement-row-subtotal">
                  <td>Выручка от мероприятий (Catering Revenue)</td>
                  <td className="num-col" style={{ color: '#059669', fontWeight: 800 }}>+{formatRubles(pnl.revenue)}</td>
                  <td className="num-col">100%</td>
                </tr>

                {/* Direct Costs COGS */}
                <tr className="statement-row-section">
                  <td colSpan={3}>2. ПРЯМЫЕ ЗАТРАТЫ МЕРОПРИЯТИЙ (COGS)</td>
                </tr>
                {pnl.cogsItems.length === 0 ? (
                  <tr>
                    <td style={{ color: 'var(--color-text-muted)', paddingLeft: '32px' }} colSpan={2}>
                      Нет прямых затрат по мероприятиям
                    </td>
                    <td className="num-col">0%</td>
                  </tr>
                ) : (
                  pnl.cogsItems.map((c) => (
                    <tr key={c.name} className="statement-row-subitem">
                      <td>{c.name}</td>
                      <td className="num-col" style={{ color: '#dc2626' }}>-{formatRubles(c.amount)}</td>
                      <td className="num-col" style={{ color: 'var(--color-text-muted)' }}>{formatPercent(c.share, 1)}</td>
                    </tr>
                  ))
                )}
                <tr className="statement-row-subtotal">
                  <td>Итого прямая себестоимость (COGS)</td>
                  <td className="num-col" style={{ color: '#dc2626', fontWeight: 700 }}>-{formatRubles(pnl.totalCOGS)}</td>
                  <td className="num-col">
                    {pnl.revenue > 0 ? formatPercent((pnl.totalCOGS / pnl.revenue) * 100, 1) : '0%'}
                  </td>
                </tr>

                {/* Gross Profit */}
                <tr className="statement-row-grandtotal">
                  <td>ВАЛОВАЯ ПРИБЫЛЬ (Gross Profit)</td>
                  <td className="num-col">{formatRubles(pnl.grossProfit)}</td>
                  <td className="num-col">{formatPercent(pnl.grossMarginPercent, 1)}</td>
                </tr>

                {/* Overhead Costs OPEX */}
                <tr className="statement-row-section">
                  <td colSpan={3}>3. ОБЩЕХОЗЯЙСТВЕННЫЕ РАСХОДЫ КОМПАНИИ (OPEX)</td>
                </tr>
                {pnl.opexItems.length === 0 ? (
                  <tr>
                    <td style={{ color: 'var(--color-text-muted)', paddingLeft: '32px' }} colSpan={2}>
                      Нет постоянных расходов компании за период
                    </td>
                    <td className="num-col">0%</td>
                  </tr>
                ) : (
                  pnl.opexItems.map((o) => (
                    <tr key={o.name} className="statement-row-subitem">
                      <td>{o.name}</td>
                      <td className="num-col" style={{ color: '#dc2626' }}>-{formatRubles(o.amount)}</td>
                      <td className="num-col" style={{ color: 'var(--color-text-muted)' }}>{formatPercent(o.share, 1)}</td>
                    </tr>
                  ))
                )}
                <tr className="statement-row-subtotal">
                  <td>Итого постоянные расходы (OPEX)</td>
                  <td className="num-col" style={{ color: '#dc2626' }}>-{formatRubles(pnl.totalOPEX)}</td>
                  <td className="num-col">
                    {pnl.revenue > 0 ? formatPercent((pnl.totalOPEX / pnl.revenue) * 100, 1) : '0%'}
                  </td>
                </tr>

                {/* Net Operating Profit */}
                <tr className="statement-row-grandtotal">
                  <td>ОПЕРАЦИОННАЯ ПРИБЫЛЬ (EBITDA)</td>
                  <td className="num-col" style={{ color: pnl.operatingProfit >= 0 ? '#059669' : '#dc2626' }}>
                    {formatRubles(pnl.operatingProfit)}
                  </td>
                  <td className="num-col" style={{ color: pnl.operatingProfit >= 0 ? '#059669' : '#dc2626' }}>
                    {formatPercent(pnl.netMarginPercent, 1)}
                  </td>
                </tr>

                {pnl.taxEstimated > 0 && (
                  <>
                    <tr className="statement-row-subitem" style={{ background: '#fefce8' }}>
                      <td style={{ fontWeight: 600, color: '#854d0e', paddingLeft: '24px' }}>
                        {pnl.taxLabel || 'Оценочный налог'}
                      </td>
                      <td className="num-col" style={{ color: '#dc2626', fontWeight: 600 }}>
                        -{formatRubles(pnl.taxEstimated)}
                      </td>
                      <td className="num-col" style={{ color: '#854d0e' }}>
                        {pnl.revenue > 0 ? formatPercent((pnl.taxEstimated / pnl.revenue) * 100, 1) : '0%'}
                      </td>
                    </tr>
                    <tr className="statement-row-grandtotal" style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                      <td style={{ fontWeight: 800, color: '#166534' }}>
                        ЧИСТАЯ ПРИБЫЛЬ К РАСПРЕДЕЛЕНИЮ ПОСЛЕ НАЛОГОВ
                      </td>
                      <td className="num-col" style={{ color: pnl.netProfitAfterTax >= 0 ? '#166534' : '#dc2626', fontWeight: 800 }}>
                        {formatRubles(pnl.netProfitAfterTax)}
                      </td>
                      <td className="num-col" style={{ color: pnl.netProfitAfterTax >= 0 ? '#166534' : '#dc2626', fontWeight: 800 }}>
                        {formatPercent(pnl.netMarginAfterTaxPercent, 1)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. EVENT UNIT ECONOMICS TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'economics' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Маржинальность проектов и план-факт</h3>
              <span className="statement-subtitle">
                Юнит-экономика каждого проекта • Выручка, себестоимость и маржа
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Мероприятий в периоде:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{eventEconomics.length}</span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Мероприятие</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th className="num-col">Факт выручки</th>
                  <th className="num-col">Факт затрат</th>
                  <th className="num-col">Чистая прибыль</th>
                  <th className="num-col">Маржинальность</th>
                </tr>
              </thead>
              <tbody>
                {eventEconomics.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      В выбранном периоде ({dateRange.startDate} — {dateRange.endDate}) мероприятий не проводилось.
                    </td>
                  </tr>
                ) : (
                  <>
                    {eventEconomics.map((ev) => (
                      <tr key={ev.id}>
                        <td><strong>{ev.title}</strong></td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{formatDateRu(ev.date)}</td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: ev.status === 'completed' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: ev.status === 'completed' ? '#059669' : '#d97706',
                              fontWeight: 600,
                            }}
                          >
                            {ev.status === 'completed' ? 'Завершено' : ev.status === 'active' ? 'В работе' : 'План'}
                          </span>
                        </td>
                        <td className="num-col" style={{ color: '#059669', fontWeight: 700 }}>{formatRubles(ev.factRevenue)}</td>
                        <td className="num-col" style={{ color: '#dc2626', fontWeight: 600 }}>{formatRubles(ev.factExpenses)}</td>
                        <td className="num-col" style={{ fontWeight: 800, color: ev.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                          {formatRubles(ev.netProfit)}
                        </td>
                        <td className="num-col">
                          <span className={ev.marginPercent >= 40 ? 'statement-badge-positive' : 'statement-badge-negative'}>
                            {formatPercent(ev.marginPercent, 1)}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Total Summary Row */}
                    <tr className="statement-row-grandtotal">
                      <td colSpan={3}>ИТОГО ПО ВСЕМ ПРОЕКТАМ ПЕРИОДА</td>
                      <td className="num-col">
                        {formatRubles(eventEconomics.reduce((s, e) => s + e.factRevenue, 0))}
                      </td>
                      <td className="num-col">
                        {formatRubles(eventEconomics.reduce((s, e) => s + e.factExpenses, 0))}
                      </td>
                      <td className="num-col">
                        {formatRubles(eventEconomics.reduce((s, e) => s + e.netProfit, 0))}
                      </td>
                      <td className="num-col">
                        {(() => {
                          const totalRev = eventEconomics.reduce((s, e) => s + e.factRevenue, 0);
                          const totalProf = eventEconomics.reduce((s, e) => s + e.netProfit, 0);
                          return totalRev > 0 ? formatPercent((totalProf / totalRev) * 100, 1) : '0%';
                        })()}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. BALANCE SHEET TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'balance' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Управленческий баланс и ликвидность</h3>
              <span className="statement-subtitle">
                Мгновенный снимок активов и обязательств • Чистый собственный рабочий капитал
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Рабочий капитал:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: balanceSheet.netWorkingCapital >= 0 ? '#059669' : '#dc2626' }}>
                {formatRubles(balanceSheet.netWorkingCapital)}
              </span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Статья управленческого баланса</th>
                  <th className="num-col" style={{ width: '220px' }}>Сумма (₽)</th>
                </tr>
              </thead>
              <tbody>
                {/* Assets */}
                <tr className="statement-row-section">
                  <td colSpan={2}>1. АКТИВЫ (Ликвидность и дебиторская задолженность)</td>
                </tr>
                {balanceSheet.cashAccounts.map((a) => (
                  <tr key={a.id} className="statement-row-subitem">
                    <td>{a.name}</td>
                    <td className="num-col" style={{ fontWeight: 600 }}>{formatRubles(a.balance)}</td>
                  </tr>
                ))}
                <tr className="statement-row-subtotal">
                  <td>Итого денежные средства на 5 счетах</td>
                  <td className="num-col" style={{ color: '#059669', fontWeight: 700 }}>
                    {formatRubles(balanceSheet.totalCash)}
                  </td>
                </tr>
                <tr className="statement-row-subitem">
                  <td>Дебиторская задолженность (ожидаемые транши от заказчиков)</td>
                  <td className="num-col" style={{ color: '#2563eb' }}>
                    +{formatRubles(balanceSheet.accountsReceivable)}
                  </td>
                </tr>
                <tr className="statement-row-grandtotal">
                  <td>ИТОГО АКТИВЫ КОМПАНИИ</td>
                  <td className="num-col">{formatRubles(balanceSheet.totalAssets)}</td>
                </tr>

                {/* Liabilities */}
                <tr className="statement-row-section">
                  <td colSpan={2}>2. ОБЯЗАТЕЛЬСТВА (Кредиторская задолженность перед подрядчиками)</td>
                </tr>
                <tr className="statement-row-subitem">
                  <td>Остаток к выплате подрядчикам и персоналу смен</td>
                  <td className="num-col" style={{ color: '#dc2626', fontWeight: 600 }}>
                    {formatRubles(balanceSheet.accountsPayable)}
                  </td>
                </tr>
                <tr className="statement-row-grandtotal" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#dc2626' }}>
                  <td style={{ color: '#dc2626' }}>ИТОГО ОБЯЗАТЕЛЬСТВА</td>
                  <td className="num-col" style={{ color: '#dc2626' }}>{formatRubles(balanceSheet.totalLiabilities)}</td>
                </tr>

                {/* Net Working Capital */}
                <tr className="statement-row-grandtotal">
                  <td>ЧИСТЫЙ ОБОРОТНЫЙ КАПИТАЛ (Активы − Обязательства)</td>
                  <td className="num-col" style={{ color: balanceSheet.netWorkingCapital >= 0 ? '#059669' : '#dc2626' }}>
                    {formatRubles(balanceSheet.netWorkingCapital)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 5. VENDOR PAYROLL STATEMENT TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'payroll' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Сводная ведомость расчётов с подрядчиками</h3>
              <span className="statement-subtitle">
                Учёт гонораров команды, выплаченных авансов и остатков к закрытию смен
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Осталось выплатить команде:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: vendorPayroll.totalRemaining > 0 ? '#f59e0b' : '#059669' }}>
                {formatRubles(vendorPayroll.totalRemaining)}
              </span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Имя подрядчика</th>
                  <th>Роль</th>
                  <th>Мероприятие</th>
                  <th className="num-col">Гонорар</th>
                  <th className="num-col">Выплачено</th>
                  <th className="num-col">Остаток к выплате</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {vendorPayroll.vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      В мероприятиях пока не зафиксированы подрядчики. Добавьте персонал через карточку мероприятия.
                    </td>
                  </tr>
                ) : (
                  <>
                    {vendorPayroll.vendors.map((v) => (
                      <tr key={v.id}>
                        <td><strong>{v.name}</strong></td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{v.role}</td>
                        <td>{v.eventTitle}</td>
                        <td className="num-col">{formatRubles(v.agreedFee)}</td>
                        <td className="num-col" style={{ color: '#059669', fontWeight: 600 }}>{formatRubles(v.paidAmount)}</td>
                        <td className="num-col" style={{ color: v.remainingAmount > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
                          {formatRubles(v.remainingAmount)}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: v.status === 'Выплачено' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: v.status === 'Выплачено' ? '#059669' : '#d97706',
                              fontWeight: 600,
                            }}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Payroll Grand Total */}
                    <tr className="statement-row-grandtotal">
                      <td colSpan={3}>ИТОГО ПО ВСЕЙ КОМАНДЕ</td>
                      <td className="num-col">{formatRubles(vendorPayroll.totalFee)}</td>
                      <td className="num-col" style={{ color: '#059669' }}>{formatRubles(vendorPayroll.totalPaid)}</td>
                      <td className="num-col" style={{ color: vendorPayroll.totalRemaining > 0 ? '#dc2626' : '#059669' }}>
                        {formatRubles(vendorPayroll.totalRemaining)}
                      </td>
                      <td></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. TAXES & VAT DEDUCTION STATEMENT TAB */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'taxes' && (
        <div className="financial-statement-card">
          <div className="statement-title-bar">
            <div>
              <h3 className="statement-main-title">Ведомость налогов и вычетов НДС по юрлицам ({taxReport.quarterLabel})</h3>
              <span className="statement-subtitle">
                Расчёт исходящего НДС с выручки, входящего НДС по закрывающим документам (УПД/СФ) и итоговых налогов к уплате
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Входящий НДС к вычету (возврату):</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                {formatRubles(taxReport.totalVatIncoming || 0)}
              </span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table" style={{ minWidth: '940px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>Юрлицо / Контур</th>
                  <th style={{ minWidth: '170px' }}>Режим налогообложения</th>
                  <th className="num-col" style={{ minWidth: '95px' }}>Выручка</th>
                  <th className="num-col" style={{ minWidth: '95px' }}>Расходы</th>
                  <th className="num-col" style={{ minWidth: '105px' }}>Исходящий НДС</th>
                  <th className="num-col" style={{ minWidth: '120px' }}>Вычет НДС (УПД)</th>
                  <th className="num-col" style={{ minWidth: '100px' }}>НДС к уплате</th>
                  <th className="num-col" style={{ minWidth: '110px' }}>Налог (УСН/Прибыль)</th>
                  <th className="num-col" style={{ minWidth: '105px' }}>Итого налог</th>
                </tr>
              </thead>
              <tbody>
                {(taxReport.entitiesBreakdown || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      Юрлица ещё не настроены. Перейдите в «Настройки → Юрлица группы», чтобы добавить ООО или ИП.
                    </td>
                  </tr>
                ) : (
                  <>
                    {(taxReport.entitiesBreakdown || []).map((ent) => (
                      <tr key={ent.entityId}>
                        <td>
                          <strong>{ent.entityName}</strong>
                          {(ent.docsCount || 0) > 0 && (
                            <div style={{ fontSize: '0.72rem', color: ent.taxSystem === 'osno' ? '#059669' : 'var(--color-text-muted)', marginTop: '2px' }}>
                              📄 Документов с НДС: {ent.docsCount} шт. ({formatRubles(ent.vatInDocs || 0)})
                              {ent.taxSystem !== 'osno' && ' • без вычета на спецрежиме'}
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{ent.taxSystemLabel}</td>
                        <td className="num-col" style={{ color: '#059669', fontWeight: 600 }}>{formatRubles(ent.income)}</td>
                        <td className="num-col" style={{ color: '#dc2626' }}>{formatRubles(ent.expense)}</td>
                        <td className="num-col">{formatRubles(ent.vatOutgoing)}</td>
                        <td className="num-col" style={{ color: ent.vatIncoming > 0 ? '#059669' : 'var(--color-text-muted)', fontWeight: ent.vatIncoming > 0 ? 700 : 400 }}>
                          {ent.vatIncoming > 0 ? `−${formatRubles(ent.vatIncoming)}` : '0 ₽'}
                        </td>
                        <td className="num-col" style={{ color: ent.vatNet > 0 ? '#d97706' : 'var(--color-text)', fontWeight: 600 }}>
                          {formatRubles(ent.vatNet)}
                        </td>
                        <td className="num-col" style={{ fontWeight: 600 }}>{formatRubles(ent.taxAmount)}</td>
                        <td className="num-col" style={{ color: ent.totalDue > 0 ? '#d97706' : '#059669', fontWeight: 800 }}>
                          {formatRubles(ent.totalDue)}
                        </td>
                      </tr>
                    ))}

                    <tr className="statement-row-grandtotal">
                      <td colSpan={2}>ИТОГО ПО ГРУППЕ КОМПАНИЙ ({taxReport.quarterLabel})</td>
                      <td className="num-col">{formatRubles(taxReport.incomeBase)}</td>
                      <td className="num-col">{formatRubles(taxReport.expenseBase)}</td>
                      <td className="num-col">{formatRubles(taxReport.totalVatOutgoing || 0)}</td>
                      <td className="num-col" style={{ color: '#059669' }}>−{formatRubles(taxReport.totalVatIncoming || 0)}</td>
                      <td className="num-col">
                        {formatRubles((taxReport.entitiesBreakdown || []).reduce((s, e) => s + e.vatNet, 0))}
                      </td>
                      <td className="num-col">
                        {formatRubles((taxReport.entitiesBreakdown || []).reduce((s, e) => s + e.taxAmount, 0))}
                      </td>
                      <td className="num-col" style={{ color: '#d97706' }}>{formatRubles(taxReport.taxAmount)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
