/**
 * Truespace — Барный кейтеринг и финансы
 * Numeric Input Component (`src/client/components/entry/NumericPad.tsx`)
 *
 * Variant 1 (shadcn/ui Maia): Clean keyboard numeric input with strict digit-only
 * protection (no letters allowed) and quick increment chips (+500, +1 000, +5 000, +10 000 ₽).
 */

import React from 'react';
import { X } from 'lucide-react';

interface NumericPadProps {
  amount: number;
  onAmountChange: (newAmount: number) => void;
  maxAmount?: number;
}

const formatIntegerWithSpaces = (num: number): string => {
  if (!num || num <= 0) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const NumericPad: React.FC<NumericPadProps> = ({
  amount,
  onAmountChange,
  maxAmount = 100000000, // 100 million rubles cap
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly strip any letters, spaces, or non-digit characters
    const digitsOnly = e.target.value.replace(/\D/g, '');
    if (!digitsOnly) {
      onAmountChange(0);
      return;
    }
    const parsed = parseInt(digitsOnly.slice(0, 9), 10);
    if (!isNaN(parsed)) {
      onAmountChange(Math.min(maxAmount, parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation, deletion, and shortcuts (Ctrl/Cmd+A/C/V/X)
    if (
      e.ctrlKey ||
      e.metaKey ||
      ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
    ) {
      return;
    }
    // Strictly block any non-digit key (letters, symbols, etc.)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleIncrement = (increment: number) => {
    const next = Math.min(maxAmount, amount + increment);
    onAmountChange(next);
  };

  return (
    <div className="numeric-pad-container">
      <div className="amount-display-box" role="region" aria-label="Ввод суммы операции">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8c734b' }}>
            Сумма операции (ввод с клавиатуры)
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>
            RUB, ₽
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={formatIntegerWithSpaces(amount)}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="amount-keyboard-input"
            aria-label="Сумма в рублях"
          />
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--muted-foreground)', userSelect: 'none' }}>
            ₽
          </span>
          {amount > 0 && (
            <button
              type="button"
              onClick={() => onAmountChange(0)}
              title="Очистить сумму"
              aria-label="Очистить сумму"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted-foreground)',
                background: 'rgba(0,0,0,0.05)',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="preset-increments-row" role="group" aria-label="Быстрые добавления суммы" style={{ justifyContent: 'flex-start', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => handleIncrement(500)}
            className="btn-increment-preset"
          >
            +500&nbsp;₽
          </button>
          <button
            type="button"
            onClick={() => handleIncrement(1000)}
            className="btn-increment-preset"
          >
            +1&nbsp;000&nbsp;₽
          </button>
          <button
            type="button"
            onClick={() => handleIncrement(5000)}
            className="btn-increment-preset"
          >
            +5&nbsp;000&nbsp;₽
          </button>
          <button
            type="button"
            onClick={() => handleIncrement(10000)}
            className="btn-increment-preset"
          >
            +10&nbsp;000&nbsp;₽
          </button>
        </div>
      </div>
    </div>
  );
};
