/**
 * Truespace — Барный кейтеринг и финансы
 * Numeric Pad Component (`src/client/components/entry/NumericPad.tsx`)
 *
 * Dedicated mobile keypad with large digits (1-9, 0, 00, ⌫, C) and instant
 * round increment presets (+500, +1 000, +5 000, +10 000 ₽) preventing
 * mobile OS keyboard layout shifts.
 */

import React from 'react';
import { Delete, RotateCcw } from 'lucide-react';
import { formatRubles } from '../../utils/formatters.js';

interface NumericPadProps {
  amount: number;
  onAmountChange: (newAmount: number) => void;
  maxAmount?: number;
}

export const NumericPad: React.FC<NumericPadProps> = ({
  amount,
  onAmountChange,
  maxAmount = 10000000, // 10 million rubles cap
}) => {
  // Convert current amount to string representation without trailing zeroes if integer
  const handleDigit = (digit: string) => {
    const currentStr = amount === 0 ? '' : String(amount);
    let nextStr = currentStr + digit;

    // Disallow excessive digits
    if (nextStr.length > 8) return;

    const nextNum = parseInt(nextStr, 10);
    if (!isNaN(nextNum) && nextNum <= maxAmount) {
      onAmountChange(nextNum);
    }
  };


  const handleBackspace = () => {
    const currentStr = String(amount);
    if (currentStr.length <= 1) {
      onAmountChange(0);
      return;
    }
    const nextStr = currentStr.slice(0, -1);
    const nextNum = parseInt(nextStr, 10);
    onAmountChange(isNaN(nextNum) ? 0 : nextNum);
  };

  const handleClear = () => {
    onAmountChange(0);
  };

  const handleIncrement = (increment: number) => {
    const next = Math.min(maxAmount, amount + increment);
    onAmountChange(next);
  };

  // Keyboard input support (0-9, Backspace, Delete/C)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [amount, maxAmount]);

  return (
    <div className="numeric-pad-container">
      {/* Large Amount Display */}
      <div className="amount-display-box" role="region" aria-label="Введённая сумма">
        <span className="display-amount-text">
          {formatRubles(amount)}
        </span>
      </div>

      {/* Quick Increment Preset Chips */}
      <div className="preset-increments-row" role="group" aria-label="Быстрые добавления суммы">
        <button
          type="button"
          onClick={() => handleIncrement(500)}
          className="btn-increment-preset"
          title="Добавить 500 рублей"
        >
          +500&nbsp;₽
        </button>
        <button
          type="button"
          onClick={() => handleIncrement(1000)}
          className="btn-increment-preset"
          title="Добавить 1 000 рублей"
        >
          +1&nbsp;000&nbsp;₽
        </button>
        <button
          type="button"
          onClick={() => handleIncrement(5000)}
          className="btn-increment-preset"
          title="Добавить 5 000 рублей"
        >
          +5&nbsp;000&nbsp;₽
        </button>
        <button
          type="button"
          onClick={() => handleIncrement(10000)}
          className="btn-increment-preset"
          title="Добавить 10 000 рублей"
        >
          +10&nbsp;000&nbsp;₽
        </button>
      </div>

      {/* Keypad Grid: 3 columns x 4 rows */}
      <div className="numpad-grid" role="group" aria-label="Цифровая клавиатура ввода">
        <button type="button" onClick={() => handleDigit('1')} className="numpad-key">1</button>
        <button type="button" onClick={() => handleDigit('2')} className="numpad-key">2</button>
        <button type="button" onClick={() => handleDigit('3')} className="numpad-key">3</button>

        <button type="button" onClick={() => handleDigit('4')} className="numpad-key">4</button>
        <button type="button" onClick={() => handleDigit('5')} className="numpad-key">5</button>
        <button type="button" onClick={() => handleDigit('6')} className="numpad-key">6</button>

        <button type="button" onClick={() => handleDigit('7')} className="numpad-key">7</button>
        <button type="button" onClick={() => handleDigit('8')} className="numpad-key">8</button>
        <button type="button" onClick={() => handleDigit('9')} className="numpad-key">9</button>

        {/* Row 4: Clear | 0 | Backspace */}
        <button
          type="button"
          onClick={handleClear}
          className="numpad-key key-clear"
          title="Сбросить сумму"
          aria-label="Сбросить сумму"
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span className="sr-only">Сбросить</span>
        </button>

        <button type="button" onClick={() => handleDigit('0')} className="numpad-key">0</button>

        <button
          type="button"
          onClick={handleBackspace}
          className="numpad-key key-backspace"
          title="Удалить последнюю цифру"
          aria-label="Стереть цифру"
        >
          <Delete size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

