/**
 * Truespace — Барный кейтеринг и финансы
 * Partners Analytics Dashboard (`src/client/components/analytics/PartnersDashboard.tsx`)
 *
 * Visualizes:
 * - Total money withdrawn by founders/partners (dividends, personal expenses)
 * - Partner-specific breakdown cards (Влад, Никита, etc.)
 * - History of payouts with source accounts, amounts, and descriptions
 */

import React, { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient.js';
import { PartnersAnalyticsSummary } from '../../../shared/types.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';

export const PartnersDashboard: React.FC = () => {
  const [data, setData] = useState<PartnersAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getPartnersAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки аналитики партнёров');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--color-accent)' }} />
        <p style={{ fontSize: '0.85rem' }}>Загрузка данных по партнёрам...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{error || 'Не удалось загрузить данные по партнёрам'}</p>
        <button
          type="button"
          onClick={fetchAnalytics}
          className="btn-confirm-no"
          style={{ marginTop: '10px', padding: '6px 14px' }}
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="partners-dashboard-panel animate-fade-in">
      {/* Top Banner: Total Dividends */}
      <div className="partners-total-banner">
        <div>
          <div className="partners-banner-title">
            <Users size={18} />
            <span>Выплаты партнёрам и дивиденды</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Суммарный вывод прибыли и персональные выплаты учредителям
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Всего выведено:</span>
          <span className="partners-banner-amount font-mono">
            {formatRubles(data.totalDividendsPaid)}
          </span>
        </div>
      </div>

      {/* Partner Metric Cards */}
      <div className="settings-card-grid">
        {data.partners.map((partner) => {
          const sharePercent =
            data.totalDividendsPaid > 0
              ? Math.round((partner.totalWithdrawn / data.totalDividendsPaid) * 100)
              : 0;

          return (
            <div key={partner.partnerId} className="partner-metric-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="settings-partner-avatar" aria-hidden="true">
                      {partner.partnerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {partner.partnerName}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {partner.transactionsCount} {partner.transactionsCount === 1 ? 'выплата' : 'выплат'}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', display: 'block' }}>
                      {formatRubles(partner.totalWithdrawn)}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--color-accent-strong)',
                      backgroundColor: 'rgba(95,124,103,0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-block',
                      marginTop: '2px',
                    }}>
                      {sharePercent}% от всех выплат
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="partner-progress-track">
                  <div
                    className="partner-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, sharePercent))}%` }}
                  />
                </div>
              </div>

              {/* Recent payouts snippet */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  Последние выплаты:
                </span>
                {partner.recentPayouts.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Пока нет записей о выводе средств
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {partner.recentPayouts.slice(0, 3).map((p) => (
                      <div key={p.transactionId} className="payout-item-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontFamily: 'monospace', flexShrink: 0 }}>
                            {formatDateRu(p.date)}
                          </span>
                          <span style={{ color: 'var(--color-text)', fontSize: '0.775rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.comment || p.fromAccountName || 'Выплата'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#b45309', flexShrink: 0, marginLeft: '8px' }}>
                          -{formatRubles(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
