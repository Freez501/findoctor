/**
 * Truespace — Барный кейтеринг и финансы
 * Event Margin Summary Card Component (`src/client/components/analytics/EventMarginSummary.tsx`)
 */

import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { EventMarginMetrics, EventStatus } from '../../../shared/types.js';
import { formatRubles, formatDateRu, formatPercent } from '../../utils/formatters.js';
import { classifyMargin } from '../../hooks/useAnalytics.js';
import { CategoryExpenseBreakdown } from './CategoryExpenseBreakdown.js';

interface Props {
  metric: EventMarginMetrics;
  status?: EventStatus;
}

const STATUS_LABELS: Record<EventStatus, string> = {
  active: 'Активно', completed: 'Завершено', planned: 'Запланировано', cancelled: 'Отменено',
};

export const EventMarginSummary: React.FC<Props> = ({ metric, status = 'active' }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const marginBadge = classifyMargin(metric.marginPercentage);

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--color-surface)' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{metric.eventTitle}</h3>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: status === 'active' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(23, 32, 25, 0.06)', color: status === 'active' ? '#059669' : 'var(--color-text-muted)' }}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <Calendar size={14} aria-hidden="true" />
            <span>{formatDateRu(metric.eventDate)}</span>
          </div>
        </div>

        {/* Margin Badge */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-full)', backgroundColor: marginBadge.bg, border: `1px solid ${marginBadge.border}`, color: marginBadge.color, fontWeight: 700, fontSize: '0.85rem' }}
          title={`Маржинальность: ${formatPercent(metric.marginPercentage, 1)}`}
        >
          <TrendingUp size={16} aria-hidden="true" />
          <span>{formatPercent(metric.marginPercentage, 1)} маржа</span>
        </div>
      </div>

      {/* Metrics Row: Revenue, Direct Expenses, Net Profit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Выручка</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>{formatRubles(metric.revenue)}</span>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Прямые расходы</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626' }}>{formatRubles(metric.directExpenses)}</span>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Чистая прибыль</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: metric.netProfit >= 0 ? '#172019' : '#dc2626' }}>
            {formatRubles(metric.netProfit)}
          </span>
        </div>
      </div>

      {/* Category Breakdown Accordion */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, padding: '4px 0' }}
        >
          <span>{isExpanded ? 'Скрыть структуру расходов' : 'Показать структуру расходов'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {isExpanded && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <CategoryExpenseBreakdown expenses={metric.expensesByCategory} totalDirectExpenses={metric.directExpenses} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EventMarginSummary;
