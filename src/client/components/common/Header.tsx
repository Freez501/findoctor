/**
 * Truespace — Барный кейтеринг и финансы
 * Application Header (`src/client/components/common/Header.tsx`)
 *
 * Displays brand identity, quick total capital summary, Telegram bot status badge,
 * and demo data reset control.
 */

import React, { useState } from 'react';
import { Wine, RotateCcw, Plus, Wallet } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { useResetDemo } from '../../hooks/useResetDemo.js';

interface HeaderProps {
  onOpenQuickEntry?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickEntry }) => {
  const { formattedTotalBalance } = useAccounts();
  const { resetDemo, isResetting } = useResetDemo();
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const handleResetClick = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    await resetDemo();
    setShowResetConfirm(false);
  };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-icon" aria-hidden="true">
            <Wine size={20} />
          </div>
          <div>
            <h1 className="brand-title">Truespace</h1>
            <p className="brand-subtitle">Учёт финансов барного кейтеринга</p>
          </div>
        </div>

        {/* Quick capital overview on desktop */}
        <div className="header-capital-pill" title="Совокупная ликвидность по всем 5 счетам">
          <Wallet size={16} className="text-muted" aria-hidden="true" />
          <span className="capital-label">Капитал:</span>
          <span className="capital-value">{formattedTotalBalance}</span>
        </div>

        {/* Right action group */}
        <div className="header-actions">
          {/* Quick Entry Button (Desktop) */}
          {onOpenQuickEntry && (
            <button
              type="button"
              onClick={onOpenQuickEntry}
              className="btn-quick-entry-header"
              title="Открыть форму быстрого ввода операции (5 секунд)"
            >
              <Plus size={16} aria-hidden="true" />
              <span>+ Внести операцию</span>
            </button>
          )}

          {/* Reset Demo button */}
          <div className="reset-group">
            {showResetConfirm ? (
              <div className="reset-confirm-box animate-fade-in">
                <span className="reset-confirm-text">Сбросить демо?</span>
                <button
                  type="button"
                  onClick={handleResetClick}
                  disabled={isResetting}
                  className="btn-confirm-yes"
                >
                  {isResetting ? 'Сброс...' : 'Да'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="btn-confirm-no"
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleResetClick}
                disabled={isResetting}
                className="btn-reset-demo"
                title="Сбросить все операции к исходным 21 демо-записям"
              >
                <RotateCcw size={14} className={isResetting ? 'animate-spin' : ''} aria-hidden="true" />
                <span className="reset-label">Сброс демо</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
