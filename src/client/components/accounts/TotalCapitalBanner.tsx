/**
 * Truespace — Барный кейтеринг и финансы
 * Total Capital Banner Component (`src/client/components/accounts/TotalCapitalBanner.tsx`)
 *
 * Displays aggregated business capital with a premium glowing visual chart,
 * dynamic account chips, and an account-driven multi-segment liquidity bar.
 */

import React from 'react';
import { TrendingUp, Sparkles, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';

export const TotalCapitalBanner: React.FC = () => {
  const { accounts, totalBalance } = useAccounts();

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  return (
    <section className="total-capital-banner hero-glow-banner" aria-label="Сводный баланс и ликвидность">
      {/* Background ambient decorative glow */}
      <div className="banner-ambient-glow" aria-hidden="true" />

      <div className="banner-content-grid">
        {/* Left Side: Capital Metrics */}
        <div className="banner-metrics-column">
          <div className="banner-eyebrow-pill">
            <span className="live-pulse-dot" aria-hidden="true" />
            <TrendingUp size={13} className="eyebrow-icon" aria-hidden="true" />
            <span>Совокупная ликвидность бизнеса</span>
          </div>

          <div className="banner-total-amount">
            {formatRubles(totalBalance)}
          </div>
        </div>

        {/* Right Side: Visual WOW Dynamic Chart / Sparkline */}
        <div className="banner-visual-column" aria-hidden="true">
          <div className="hero-chart-card">
            <div className="chart-header-row">
              <div className="chart-metric-badge">
                <Sparkles size={12} className="text-amber-400" />
                <span>Финансовый пульс</span>
              </div>
              <div className="chart-growth-tag">
                <ShieldCheck size={13} />
                <span>Капитал под контролем</span>
              </div>
            </div>

            {/* Glowing Wave SVG Visualization */}
            <div className="chart-svg-container">
              <svg
                viewBox="0 0 280 90"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="hero-chart-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Subtle glowing fill gradient */}
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                    <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                  {/* Luminous stroke gradient */}
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                {/* Ambient baseline and grid lines */}
                <line x1="0" y1="30" x2="280" y2="30" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="280" y2="60" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />

                {/* Area Fill */}
                <path
                  d="M 0 75 Q 40 70, 75 52 T 150 48 T 215 28 T 280 14 L 280 90 L 0 90 Z"
                  fill="url(#chartGradient)"
                />

                {/* Foreground Wave Stroke */}
                <path
                  d="M 0 75 Q 40 70, 75 52 T 150 48 T 215 28 T 280 14"
                  stroke="url(#strokeGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Luminous end dot with ping circle */}
                <circle cx="280" cy="14" r="5" fill="#10b981" />
                <circle cx="280" cy="14" r="9" stroke="#10b981" strokeOpacity="0.4" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="chart-footer-row">
              <span className="chart-footer-caption">Мгновенный учёт всех счетов в реальном времени</span>
              <div className="chart-footer-status">
                <span>100% точность</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-segment liquidity progress bar (dynamic by actual active accounts) */}
      <div
        className="liquidity-stacked-bar"
        role="progressbar"
        aria-label="Распределение капитала по активным счетам"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {totalBalance > 0 ? (
          activeAccounts.map((acc) => {
            const accColor = acc.color || (acc.type === 'bank' ? '#2563eb' : acc.type === 'cash' ? '#10b981' : '#7c3aed');
            const share = (acc.currentBalance / totalBalance) * 100;
            if (share <= 0) return null;

            return (
              <div
                key={acc.id}
                className="bar-segment"
                style={{
                  width: `${share}%`,
                  backgroundColor: accColor,
                }}
                title={`${acc.name}: ${formatRubles(acc.currentBalance)} (${formatPercent(share, 1)})`}
              />
            );
          })
        ) : (
          <div
            className="bar-segment"
            style={{ width: '100%', backgroundColor: 'var(--border)' }}
            title="Баланс обнулён (0 ₽)"
          />
        )}
      </div>
    </section>
  );
};
