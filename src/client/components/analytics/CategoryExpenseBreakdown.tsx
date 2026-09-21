/**
 * Truespace — Барный кейтеринг и финансы
 * Category Expense Breakdown Component (`src/client/components/analytics/CategoryExpenseBreakdown.tsx`)
 */

import React from 'react';
import { CategoryExpenseBreakdown as ICategoryBreakdown } from '../../../shared/types.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';

interface Props {
  expenses: ICategoryBreakdown[];
  totalDirectExpenses: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  cat_alcohol: '#dc2626',
  cat_staff: '#2563eb',
  cat_ice: '#0891b2',
  cat_logistics: '#d97706',
  cat_supplies: '#7c3aed',
  cat_rent: '#4b5563',
};

export const CategoryExpenseBreakdown: React.FC<Props> = ({ expenses, totalDirectExpenses }) => {
  if (!expenses || expenses.length === 0 || totalDirectExpenses === 0) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Прямых расходов по мероприятию пока нет
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
        Структура прямых расходов:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {expenses.map((item) => {
          const color = CATEGORY_COLORS[item.categoryId] || 'var(--color-accent)';
          const safePercent = Math.max(0, Math.min(100, item.percentage));

          return (
            <div key={item.categoryId} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      display: 'inline-block',
                    }}
                    aria-hidden="true"
                  />
                  <span>{item.categoryName}</span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {formatRubles(item.amount)}{' '}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>
                    ({formatPercent(item.percentage, 1)})
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${safePercent}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease',
                  }}
                  role="progressbar"
                  aria-valuenow={safePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryExpenseBreakdown;
