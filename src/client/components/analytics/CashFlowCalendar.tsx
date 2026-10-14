import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { CashFlowForecast, CashFlowCalendarDay } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';

export const CashFlowCalendar: React.FC = () => {
  const { totalBalance, addToast } = useFinance();
  const [daysAhead, setDaysAhead] = useState<number>(30);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadForecast = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getCashFlowForecast(daysAhead);
      setForecast(data);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки платёжного календаря', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [daysAhead, addToast]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  // Aggregate metrics across the forecast period
  const metrics = useMemo(() => {
    if (!forecast || !forecast.days.length) {
      return {
        totalInflow: 0,
        totalOutflow: 0,
        minBalance: totalBalance,
      };
    }

    let totalInflow = 0;
    let totalOutflow = 0;
    let minBalance = forecast.days[0].closingBalance;

    forecast.days.forEach((d) => {
      totalInflow += d.totalIncome;
      totalOutflow += d.totalExpense;
      if (d.closingBalance < minBalance) {
        minBalance = d.closingBalance;
      }
    });

    return { totalInflow, totalOutflow, minBalance };
  }, [forecast, totalBalance]);

  // Filter only days that have movement (income or expense)
  const activeDays: CashFlowCalendarDay[] = useMemo(() => {
    return forecast?.days.filter((d) => d.totalIncome > 0 || d.totalExpense > 0) || [];
  }, [forecast]);

  return (
    <div className="cashflow-container">
      {/* Top Header with Horizon Filter */}
      <div className="cashflow-header-panel">
        <div>
          <h3 className="cashflow-title">Платёжный календарь и радар разрывов</h3>
          <p className="cashflow-subtitle">
            Прогноз остатка денег по дням с учётом траншей от заказчиков и выплат подрядчикам
          </p>
        </div>

        <div className="cashflow-controls">
          <div className="cashflow-filter-pills">
            <button
              type="button"
              onClick={() => setDaysAhead(14)}
              className={`pill-btn ${daysAhead === 14 ? 'pill-active' : ''}`}
            >
              14 дней
            </button>
            <button
              type="button"
              onClick={() => setDaysAhead(30)}
              className={`pill-btn ${daysAhead === 30 ? 'pill-active' : ''}`}
            >
              30 дней
            </button>
            <button
              type="button"
              onClick={() => setDaysAhead(60)}
              className={`pill-btn ${daysAhead === 60 ? 'pill-active' : ''}`}
            >
              60 дней
            </button>
          </div>

          <button
            type="button"
            onClick={loadForecast}
            className="btn-icon-tiny"
            title="Обновить прогноз"
            style={{ width: '36px', height: '36px' }}
          >
            <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* Radar Warning / Safety Banner */}
      {forecast && (
        <>
          {forecast.hasShortages ? (
            <div className="cashflow-alert-danger">
              <div className="cashflow-alert-icon">
                <ShieldAlert size={28} color="#dc2626" />
              </div>
              <div className="cashflow-alert-content">
                <div className="cashflow-alert-title">
                  Обнаружен риск кассового разрыва!
                </div>
                <div className="cashflow-alert-text">
                  {forecast.firstShortageDate && (
                    <span>
                      <strong>{formatDateRu(forecast.firstShortageDate)}</strong> прогнозируемый остаток упадёт ниже нуля (дефицит{' '}
                      <strong>{formatRubles(forecast.maxShortageAmount || Math.abs(metrics.minBalance))}</strong>).
                    </span>
                  )}{' '}
                  Рекомендуется запросить досрочный транш у заказчика или перенести выплаты подрядчикам на демонтаже.
                </div>
              </div>
            </div>
          ) : (
            <div className="cashflow-alert-safe">
              <div className="cashflow-alert-icon">
                <ShieldCheck size={28} color="#059669" />
              </div>
              <div className="cashflow-alert-content">
                <div className="cashflow-alert-title" style={{ color: '#059669' }}>
                  Кассовые разрывы отсутствуют
                </div>
                <div className="cashflow-alert-text">
                  На горизонте {daysAhead} дней баланс остаётся положительным. Минимальный запас ликвидности:{' '}
                  <strong>{formatRubles(metrics.minBalance)}</strong>.
                </div>
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="dossier-kpi-grid">
            <div className="dossier-kpi-card">
              <span className="dossier-kpi-label">Текущий баланс на счетах</span>
              <span className="dossier-kpi-val">{formatRubles(totalBalance)}</span>
            </div>

            <div className="dossier-kpi-card">
              <span className="dossier-kpi-label">Ожидаемые транши (Приход)</span>
              <span className="dossier-kpi-val val-green">
                +{formatRubles(metrics.totalInflow)}
              </span>
            </div>

            <div className="dossier-kpi-card">
              <span className="dossier-kpi-label">Выплаты подрядчикам (Расход)</span>
              <span className="dossier-kpi-val val-red">
                -{formatRubles(metrics.totalOutflow)}
              </span>
            </div>

            <div className="dossier-kpi-card">
              <span className="dossier-kpi-label">Минимальный остаток за период</span>
              <span
                className="dossier-kpi-val"
                style={{
                  color: metrics.minBalance < 0 ? '#dc2626' : 'var(--color-success)',
                }}
              >
                {formatRubles(metrics.minBalance)}
              </span>
            </div>
          </div>

          {/* Timeline Table */}
          <div className="cashflow-table-card">
            <h4 className="cashflow-table-title">График платежей по дням</h4>

            {activeDays.length === 0 ? (
              <div className="dossier-empty-state">
                <Calendar size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
                <p>На выбранные {daysAhead} дней нет запланированных траншей или выплат.</p>
              </div>
            ) : (
              <div className="dossier-table-container">
                <table className="dossier-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Плановые операции дня</th>
                      <th style={{ textAlign: 'right' }}>Приход</th>
                      <th style={{ textAlign: 'right' }}>Расход</th>
                      <th style={{ textAlign: 'right' }}>Прогноз остатка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map((day) => {
                      const isDeficit = day.closingBalance < 0 || day.isShortage;

                      return (
                        <tr key={day.date} className={isDeficit ? 'row-overbudget' : ''}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong>{formatDateRu(day.date)}</strong>
                          </td>
                          <td>
                            <div className="cashflow-events-cell">
                              {/* Inflows */}
                              {day.plannedIncomes.map((inc) => (
                                <div key={inc.id} className="cashflow-event-tag tag-inflow">
                                  <ArrowDownLeft size={12} />
                                  <span>{inc.eventTitle}: {inc.title}</span>
                                  <strong style={{ marginLeft: '4px' }}>
                                    {formatRubles(inc.amount)}
                                  </strong>
                                </div>
                              ))}

                              {/* Outflows */}
                              {day.plannedExpenses.map((exp) => (
                                <div key={exp.id} className="cashflow-event-tag tag-outflow">
                                  <ArrowUpRight size={12} />
                                  <span>
                                    {exp.eventTitle ? `${exp.eventTitle} • ` : ''}
                                    {exp.vendorName ? `${exp.vendorName}: ` : ''}
                                    {exp.title}
                                  </span>
                                  <strong style={{ marginLeft: '4px' }}>
                                    {formatRubles(exp.amount)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              color: day.totalIncome > 0 ? 'var(--color-success)' : 'inherit',
                              fontWeight: day.totalIncome > 0 ? 600 : 400,
                            }}
                          >
                            {day.totalIncome > 0 ? `+${formatRubles(day.totalIncome)}` : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              color: day.totalExpense > 0 ? '#dc2626' : 'inherit',
                              fontWeight: day.totalExpense > 0 ? 600 : 400,
                            }}
                          >
                            {day.totalExpense > 0 ? `-${formatRubles(day.totalExpense)}` : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              color: isDeficit ? '#dc2626' : 'var(--foreground)',
                            }}
                          >
                            {formatRubles(day.closingBalance)}
                            {isDeficit && (
                              <span className="cashflow-deficit-label">ДЕФИЦИТ</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
