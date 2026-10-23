/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Dashboard Component (`src/client/components/analytics/AnalyticsDashboard.tsx`)
 */

import React, { useState } from 'react';
import { BarChart3, RefreshCw, AlertCircle, TrendingUp, Calendar, PieChart } from 'lucide-react';
import { useAnalytics, classifyMargin } from '../../hooks/useAnalytics.js';
import { useFinance } from '../../context/FinanceContext.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';
import { EventMarginSummary } from './EventMarginSummary.js';
import { GeneralBarExpensesCard } from './GeneralBarExpensesCard.js';
import { PartnersDashboard } from './PartnersDashboard.js';
import { CashFlowCalendar } from './CashFlowCalendar.js';
import { AnalyticsCharts } from './AnalyticsCharts.js';

export const AnalyticsDashboard: React.FC = () => {
  const { metrics, overview, isLoading, error, refetch } = useAnalytics();
  const { events } = useFinance();
  const [activeTab, setActiveTab] = useState<'margin' | 'charts' | 'cashflow'>('margin');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  const eventStatusMap = new Map(events.map((e) => [e.id, e.status]));

  if (isLoading && metrics.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p>Загрузка аналитики маржинальности...</p>
      </div>
    );
  }

  if (error && metrics.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 10px' }} />
        <p style={{ fontWeight: 600, marginBottom: '12px' }}>{error}</p>
        <button type="button" onClick={() => refetch()} className="btn-confirm-no" style={{ padding: '8px 16px' }}>
          Повторить попытку
        </button>
      </div>
    );
  }

  const avgMargin = overview?.averageMarginPercentage ?? 0;
  const avgMarginBadge = classifyMargin(avgMargin);

  const displayedMetrics = selectedEventId === 'all'
    ? metrics
    : metrics.filter((m) => m.eventId === selectedEventId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Row (Unified Header Card Standard) */}
      <div className="reports-header-card">
        <div className="reports-header-title">
          <div className="reports-header-icon">
            <BarChart3 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
              Маржинальность и доходность
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '2px 0 0 0' }}>
              Чистая прибыль проектов и подробный разбор затрат
            </p>
          </div>
        </div>
        <div className="reports-actions-group">
          <button type="button" onClick={() => refetch()} className="reports-print-btn" title="Обновить аналитику">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Top Mode Switcher */}
      <div className="dossier-tabs-nav" style={{ margin: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: '6px', boxShadow: 'var(--shadow-sm)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('margin')}
          className={`dossier-tab-btn ${activeTab === 'margin' ? 'tab-active' : ''}`}
        >
          <BarChart3 size={16} />
          <span>Маржинальность проектов</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`dossier-tab-btn ${activeTab === 'charts' ? 'tab-active' : ''}`}
        >
          <PieChart size={16} />
          <span>Графики</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cashflow')}
          className={`dossier-tab-btn ${activeTab === 'cashflow' ? 'tab-active' : ''}`}
        >
          <Calendar size={16} />
          <span>Платёжный календарь (Cash Flow)</span>
        </button>
      </div>

      {activeTab === 'cashflow' && <CashFlowCalendar />}

      {activeTab === 'charts' && (
        <AnalyticsCharts
          metrics={metrics}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
      )}

      {activeTab === 'margin' && (
        <>
          {/* Aggregate Catering Overview Cards */}
          {overview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Выручка кейтеринга</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{formatRubles(overview.eventsTotalRevenue)}</span>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Прямые расходы</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{formatRubles(overview.eventsTotalExpenses)}</span>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Чистая прибыль</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: overview.eventsNetProfit >= 0 ? '#059669' : '#dc2626' }}>
                  {formatRubles(overview.eventsNetProfit)}
                </span>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Средняя маржа</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <TrendingUp size={18} style={{ color: avgMarginBadge.color }} />
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: avgMarginBadge.color }}>
                    {formatPercent(avgMargin, 1)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Event Selector */}
          <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Мероприятие:
              </span>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="settings-text-input"
                style={{ width: 'auto', minWidth: '240px', fontWeight: 600, padding: '6px 12px' }}
              >
                <option value="all">Все мероприятия ({metrics.length})</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.eventDate})
                  </option>
                ))}
              </select>
            </div>

            <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
              {selectedEventId === 'all'
                ? `Показаны все ${metrics.length} выездных баров`
                : `Детализированный отчёт по выбранному проекту`}
            </span>
          </div>

          {/* Events Margin Breakdown Cards (Compact Grid with Drill-down) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {displayedMetrics.length === 0 ? (
              <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                По выбранному мероприятию пока нет финансовых операций.
              </div>
            ) : (
              displayedMetrics.map((metric) => (
                <EventMarginSummary
                  key={metric.eventId}
                  metric={metric}
                  status={eventStatusMap.get(metric.eventId) || 'active'}
                />
              ))
            )}
          </div>

          {/* General Overhead Expenses */}
          <GeneralBarExpensesCard totalAmount={overview?.generalExpensesTotal ?? 0} />

          {/* Partners Dividends & Payouts Analytics */}
          <PartnersDashboard />
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
