/**
 * Truespace — Барный кейтеринг и финансы
 * Total Capital Banner Component (`src/client/components/accounts/TotalCapitalBanner.tsx`)
 *
 * Displays aggregated business capital, categorized distribution
 * (Bank / Cash / SBP cards), and a multi-segmented visual liquidity bar.
 */

import React from 'react';
import { Landmark, Banknote, Smartphone, TrendingUp } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { formatRubles, formatPercent, roundRubles } from '../../utils/formatters.js';

export const TotalCapitalBanner: React.FC = () => {
  const { accounts, totalBalance } = useAccounts();

  // Compute breakdown by account categories
  const cashTotal = roundRubles(
    accounts.filter((a) => a.type === 'cash').reduce((sum, a) => sum + (a.currentBalance || 0), 0)
  );

  const bankTotal = roundRubles(
    accounts.filter((a) => a.type === 'bank').reduce((sum, a) => sum + (a.currentBalance || 0), 0)
  );

  const cardTotal = roundRubles(
    accounts.filter((a) => a.type === 'card').reduce((sum, a) => sum + (a.currentBalance || 0), 0)
  );

  const bankPercent = totalBalance > 0 ? (bankTotal / totalBalance) * 100 : 0;
  const cashPercent = totalBalance > 0 ? (cashTotal / totalBalance) * 100 : 0;
  const cardPercent = totalBalance > 0 ? (cardTotal / totalBalance) * 100 : 0;

  return (
    <section className="total-capital-banner" aria-label="Сводный баланс и ликвидность">
      <div className="banner-top-row">
        <div>
          <div className="banner-eyebrow">
            <TrendingUp size={14} className="text-accent" aria-hidden="true" />
            <span>Совокупная ликвидность бизнеса</span>
          </div>
          <div className="banner-total-amount">
            {formatRubles(totalBalance)}
          </div>
          <p className="banner-subtitle">
            Доступные финансовые резервы по 5 счетам кейтеринга
          </p>
        </div>

        {/* Structure Badges */}
        <div className="capital-breakdown-pills">
          {/* Bank */}
          <div className="breakdown-pill pill-bank" title="Безналичные расчётные счета ИП/ООО">
            <div className="pill-header">
              <Landmark size={14} className="pill-icon" aria-hidden="true" />
              <span className="pill-name">Безнал (р/с):</span>
              <span className="pill-pct">{formatPercent(bankPercent, 1)}</span>
            </div>
            <div className="pill-amount">{formatRubles(bankTotal)}</div>
          </div>

          {/* Cash */}
          <div className="breakdown-pill pill-cash" title="Наличные: касса на площадке и сейф">
            <div className="pill-header">
              <Banknote size={14} className="pill-icon" aria-hidden="true" />
              <span className="pill-name">Наличные:</span>
              <span className="pill-pct">{formatPercent(cashPercent, 1)}</span>
            </div>
            <div className="pill-amount">{formatRubles(cashTotal)}</div>
          </div>

          {/* SBP Card */}
          <div className="breakdown-pill pill-card" title="Личные переводы СБП от клиентов и гостей">
            <div className="pill-header">
              <Smartphone size={14} className="pill-icon" aria-hidden="true" />
              <span className="pill-name">Переводы (СБП):</span>
              <span className="pill-pct">{formatPercent(cardPercent, 1)}</span>
            </div>
            <div className="pill-amount">{formatRubles(cardTotal)}</div>
          </div>
        </div>
      </div>

      {/* Multi-segment liquidity progress bar */}
      <div
        className="liquidity-stacked-bar"
        role="progressbar"
        aria-label="Распределение капитала по видам счетов"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bar-segment segment-bank"
          style={{ width: `${Math.max(bankPercent, 0)}%` }}
          title={`Безнал: ${formatRubles(bankTotal)} (${formatPercent(bankPercent, 1)})`}
        />
        <div
          className="bar-segment segment-cash"
          style={{ width: `${Math.max(cashPercent, 0)}%` }}
          title={`Наличные: ${formatRubles(cashTotal)} (${formatPercent(cashPercent, 1)})`}
        />
        <div
          className="bar-segment segment-card"
          style={{ width: `${Math.max(cardPercent, 0)}%` }}
          title={`Переводы СБП: ${formatRubles(cardTotal)} (${formatPercent(cardPercent, 1)})`}
        />
      </div>
    </section>
  );
};
