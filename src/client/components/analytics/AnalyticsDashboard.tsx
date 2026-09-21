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

export const AnalyticsDashboard: React.FC = () => {
  const { metrics, overview, isLoading, error, refetch } = useAnalytics();
  const { events } = useFinance();

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Аналитика маржинальности</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Доходность мероприятий и общие расходы бара
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
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Выручка по кейтерингам</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{formatRubles(overview.eventsTotalRevenue)}</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Прямые затраты на выезды</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{formatRubles(overview.eventsTotalExpenses)}</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Чистая прибыль кейтеринга</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: overview.eventsNetProfit >= 0 ? '#172019' : '#dc2626' }}>
              {formatRubles(overview.eventsNetProfit)}
            </span>
          </div>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Средняя маржинальность</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <TrendingUp size={18} style={{ color: avgMarginBadge.color }} />
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: avgMarginBadge.color }}>
                {formatPercent(avgMargin, 1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* General Overhead Expenses */}
      <GeneralBarExpensesCard totalAmount={overview?.generalExpensesTotal ?? 0} />

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Мероприятия ({metrics.length})</h3>
        {metrics.map((metric) => (
          <EventMarginSummary
            key={metric.eventId}
            metric={metric}
            status={eventStatusMap.get(metric.eventId) || 'active'}
          />
        ))}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
