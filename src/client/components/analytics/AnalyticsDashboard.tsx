/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Dashboard Component (`src/client/components/analytics/AnalyticsDashboard.tsx`)
 */

import React from 'react';
import { BarChart3, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { useAnalytics, classifyMargin } from '../../hooks/useAnalytics.js';
import { useFinance } from '../../context/FinanceContext.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';
import { EventMarginSummary } from './EventMarginSummary.js';
import { GeneralBarExpensesCard } from './GeneralBarExpensesCard.js';
import { PartnersDashboard } from './PartnersDashboard.js';

export const AnalyticsDashboard: React.FC = () => {
  const { metrics, overview, isLoading, error, refetch } = useAnalytics();
  const { events } = useFinance();
  const [selectedEventId, setSelectedEventId] = React.useState<string>('all');

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
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-accent-strong)' }}>
              Маржинальность и доходность
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Чистая прибыль проектов и подробный разбор затрат
            </span>
          </div>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-refresh-accounts" title="Обновить аналитику">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Обновить</span>
        </button>
      </div>

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

      {/* Events Margin Breakdown Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
    </div>
  );
};

export default AnalyticsDashboard;
