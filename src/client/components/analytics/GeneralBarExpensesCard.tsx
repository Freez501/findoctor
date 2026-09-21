/**
 * Truespace — Барный кейтеринг и финансы
 * General Bar Expenses Card Component (`src/client/components/analytics/GeneralBarExpensesCard.tsx`)
 */

import React from 'react';
import { Warehouse, Info } from 'lucide-react';
import { formatRubles } from '../../utils/formatters.js';

interface Props {
  totalAmount: number;
  description?: string;
}

export const GeneralBarExpensesCard: React.FC<Props> = ({
  totalAmount,
  description = 'Аренда склада, хозтовары, инвентарь и обслуживание без привязки к конкретным ивентам',
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(23, 32, 25, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text)',
            }}
          >
            <Warehouse size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Общие расходы бара (Overhead)</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Не привязаны к мероприятиям
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>
            Сумма затрат
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>
            {formatRubles(totalAmount)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          backgroundColor: 'rgba(23, 32, 25, 0.03)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <Info size={16} style={{ flexShrink: 0, color: 'var(--color-accent)' }} aria-hidden="true" />
        <span>{description}</span>
      </div>
    </div>
  );
};

export default GeneralBarExpensesCard;
