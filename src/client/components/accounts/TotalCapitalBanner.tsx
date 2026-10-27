/**
 * Truespace — Барный кейтеринг и финансы
 * Total Capital Banner Component (`src/client/components/accounts/TotalCapitalBanner.tsx`)
 *
 * Displays aggregated business capital with a premium glowing visual chart,
 * dynamic account chips, and an account-driven multi-segment liquidity bar.
 */

import React, { useMemo, useState } from 'react';
import { TrendingUp, Sparkles, ShieldCheck, ArrowUpRight, Landmark, Info, X } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts.js';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { calculateTaxReserve } from '../../utils/taxCalculator.js';
import { formatRubles, formatPercent } from '../../utils/formatters.js';

export const TotalCapitalBanner: React.FC = () => {
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const { accounts, totalBalance, isLoading } = useAccounts();
  const { currentCompany } = useAuth();
  const { transactions, events, legalEntities } = useFinance();

  const activeAccounts = accounts.filter((a) => a.isActive !== false);
  const isInitialColdLoad = isLoading && accounts.length === 0;

  const taxResult = useMemo(() => {
    const currentQ = calculateTaxReserve(transactions, accounts, currentCompany?.taxSettings || {
      system: currentCompany?.taxSystem || 'usn_income',
      rate: currentCompany?.taxRate ?? 6,
      applyOnlyToBank: false,
    }, new Date(), events, legalEntities);
    if (currentQ.taxAmount > 0) return currentQ;

    // If current quarter has no transactions yet, check previous quarter (e.g. III кв. where initial seed data lives)
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 2);
    const prevQ = calculateTaxReserve(transactions, accounts, currentCompany?.taxSettings || {
      system: currentCompany?.taxSystem || 'usn_income',
      rate: currentCompany?.taxRate ?? 6,
      applyOnlyToBank: false,
    }, prevDate, events, legalEntities);

    return prevQ.taxAmount > 0 ? prevQ : currentQ;
  }, [transactions, accounts, currentCompany, events, legalEntities]);

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
            {isInitialColdLoad ? (
              <span
                className="animate-pulse"
                style={{
                  display: 'inline-block',
                  width: '180px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.14)',
                  verticalAlign: 'middle',
                }}
                aria-label="Загрузка баланса"
              />
            ) : (
              formatRubles(totalBalance)
            )}
          </div>

          {taxResult && taxResult.system !== 'none' && taxResult.taxAmount > 0 && (
            <div
              onClick={() => setIsTaxModalOpen(true)}
              role="button"
              tabIndex={0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(217, 119, 6, 0.12)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                fontSize: '0.8rem',
                color: '#d97706',
                flexWrap: 'wrap',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Нажмите, чтобы открыть подробный расчёт налогов и вычетов НДС по каждому юрлицу группы"
            >
              <Landmark size={14} />
              <span>
                Резерв налога ({taxResult.quarterLabel}): <strong>{formatRubles(taxResult.taxAmount)}</strong>
              </span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span style={{ color: 'var(--foreground)' }}>
                Свободный капитал: <strong>{formatRubles(Math.max(0, totalBalance - taxResult.taxAmount))}</strong>
              </span>
              <Info size={13} style={{ marginLeft: '2px', opacity: 0.8 }} />
            </div>
          )}
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
    
      {/* Multi-Entity Tax & Deductible VAT Breakdown Modal */}
      {isTaxModalOpen && taxResult && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={() => setIsTaxModalOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="settings-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '94%' }}
          >
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={18} style={{ color: '#d97706' }} />
                  <span>Налоговый контур группы ({taxResult.quarterLabel})</span>
                </h3>
                <p className="settings-modal-subtitle">
                  Расчёт обязательств по юрлицам с учётом входящего НДС по УПД и спецрежимов
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Summary 3 KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.25)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>Общий резерв налогов</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                    {formatRubles(taxResult.taxAmount)}
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Чистый свободный капитал</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    {formatRubles(Math.max(0, totalBalance - taxResult.taxAmount))}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f6f2ea', border: '1px solid #c5b08e', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#8c734b', fontWeight: 600 }}>Входящий НДС к вычету</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#8c734b', marginTop: '2px' }}>
                    {formatRubles(taxResult.totalVatIncoming || 0)}
                  </div>
                </div>
              </div>

              {/* Entities Breakdown Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Разбивка по компаниям контура:
                </div>

                {(taxResult.entitiesBreakdown || []).map((ent) => {
                  const isLlc = ent.type === 'llc';
                  const isIp = ent.type === 'sole_proprietor' || ent.type === 'ip';
                  const isCash = ent.type === 'cash';

                  return (
                    <div
                      key={ent.entityId}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'var(--muted)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: isLlc ? 'rgba(37, 99, 235, 0.12)' : isIp ? '#f6f2ea' : 'rgba(16, 185, 129, 0.12)',
                              color: isLlc ? '#2563eb' : isIp ? '#8c734b' : '#10b981',
                              border: isIp ? '1px solid #c5b08e' : undefined,
                            }}
                          >
                            {isLlc ? 'ООО' : isIp ? 'ИП' : isCash ? 'Касса' : 'Юрлицо'}
                          </span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>{ent.entityName}</strong>
                        </div>

                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                          {ent.taxSystemLabel}
                        </span>
                      </div>

                      {/* Detail metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '0.75rem', marginTop: '4px' }}>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)' }}>Поступления: </span>
                          <strong style={{ color: 'var(--foreground)' }}>{formatRubles(ent.income)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)' }}>Расходы: </span>
                          <strong style={{ color: 'var(--foreground)' }}>{formatRubles(ent.expense)}</strong>
                        </div>

                        {ent.taxSystem === 'osno' && (
                          <>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Исходящий НДС: </span>
                              <strong>{formatRubles(ent.vatOutgoing)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Вычет НДС (УПД): </span>
                              <strong style={{ color: '#059669' }}>-{formatRubles(ent.vatIncoming)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>НДС к уплате: </span>
                              <strong style={{ color: '#d97706' }}>{formatRubles(ent.vatNet)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Налог на прибыль: </span>
                              <strong>{formatRubles(ent.taxAmount)}</strong>
                            </div>
                          </>
                        )}

                        {(ent.taxSystem === 'usn_income_vat5' || ent.taxSystem === 'usn_income_vat7') && (
                          <>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>НДС ({ent.taxSystem === 'usn_income_vat5' ? '5%' : '7%'}): </span>
                              <strong style={{ color: '#d97706' }}>{formatRubles(ent.vatNet)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>УСН (6%): </span>
                              <strong>{formatRubles(ent.taxAmount)}</strong>
                            </div>
                          </>
                        )}

                        {ent.taxSystem === 'usn_income' && (
                          <div>
                            <span style={{ color: 'var(--muted-foreground)' }}>Налог УСН: </span>
                            <strong style={{ color: '#d97706' }}>{formatRubles(ent.taxAmount)}</strong>
                          </div>
                        )}
                      </div>

                      {/* Total due for this entity */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Итого к уплате:</span>
                        <strong style={{ fontSize: '0.92rem', color: ent.totalDue > 0 ? '#d97706' : '#059669' }}>
                          {formatRubles(ent.totalDue)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="settings-modal-footer">
              <div />
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="btn-form-submit"
                style={{ padding: '8px 20px' }}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
</section>
  );
};
