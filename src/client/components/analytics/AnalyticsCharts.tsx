/**
 * Brilliant Event — Барный кейтеринг и финансы
 * Interactive Analytics Visualizer (`src/client/components/analytics/AnalyticsCharts.tsx`)
 *
 * Professional interactive SVG financial charts:
 * 1. Dynamic Bar / Waterfall Chart: Revenue vs Direct Expenses vs Net Profit
 * 2. Interactive Donut Chart: Cost structure breakdown across categories
 * 3. Profitability Matrix (Scatter / Bubble Plot): Margin % vs Revenue ₽
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Target,
  Filter,
  Info,
  Sparkles,
} from 'lucide-react';
import { EventMarginMetrics } from '../../../shared/types.js';
import { formatRubles, formatPercent, formatDateRu } from '../../utils/formatters.js';

interface AnalyticsChartsProps {
  metrics: EventMarginMetrics[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}

type ChartType = 'bar' | 'donut' | 'matrix';

const CATEGORY_COLORS: Record<string, string> = {
  cat_alcohol: '#e11d48',
  cat_staff: '#2563eb',
  cat_ice: '#0284c7',
  cat_logistics: '#d97706',
  cat_supplies: '#7c3aed',
  cat_rent: '#64748b',
  cat_tips: '#10b981',
  cat_decor: '#ec4899',
  cat_food: '#f97316',
};

const PALETTE = ['#e11d48', '#2563eb', '#0284c7', '#d97706', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#0d9488'];

function getCategoryColor(id: string, idx: number): string {
  if (CATEGORY_COLORS[id]) return CATEGORY_COLORS[id];
  return PALETTE[idx % PALETTE.length];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  metrics,
  selectedEventId,
  onSelectEvent,
}) => {
  const [activeChart, setActiveChart] = useState<ChartType>('bar');
  const [minMarginFilter, setMinMarginFilter] = useState<number>(0);
  const [hoveredEvent, setHoveredEvent] = useState<EventMarginMetrics | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<{ name: string; amount: number; percent: number; color: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter metrics based on controls
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => m.marginPercentage >= minMarginFilter);
  }, [metrics, minMarginFilter]);

  // Aggregate category breakdown across all filtered metrics
  const aggregatedCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; amount: number }>();
    let totalDirect = 0;

    const source = selectedEventId === 'all'
      ? filteredMetrics
      : filteredMetrics.filter((m) => m.eventId === selectedEventId);

    source.forEach((metric) => {
      metric.expensesByCategory.forEach((cat) => {
        totalDirect += cat.amount;
        const existing = map.get(cat.categoryId);
        if (existing) {
          existing.amount += cat.amount;
        } else {
          map.set(cat.categoryId, {
            id: cat.categoryId,
            name: cat.categoryName,
            amount: cat.amount,
          });
        }
      });
    });

    const items = Array.from(map.values())
      .filter((i) => i.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return items.map((item, idx) => ({
      ...item,
      color: getCategoryColor(item.id, idx),
      percent: totalDirect > 0 ? (item.amount / totalDirect) * 100 : 0,
      totalDirect,
    }));
  }, [filteredMetrics, selectedEventId]);

  const totalDirectCost = useMemo(() => {
    return aggregatedCategories.reduce((sum, c) => sum + c.amount, 0);
  }, [aggregatedCategories]);

  // Dimensions for SVG Charts
  const svgWidth = 800;
  const svgHeight = 320;
  const padding = { top: 30, right: 30, bottom: 60, left: 70 };

  // --------------------------------------------------------------------------
  // BAR CHART CALCULATIONS
  // --------------------------------------------------------------------------
  const maxBarValue = useMemo(() => {
    let max = 0;
    filteredMetrics.forEach((m) => {
      if (m.revenue > max) max = m.revenue;
      if (m.directExpenses > max) max = m.directExpenses;
    });
    return max > 0 ? max * 1.15 : 100000;
  }, [filteredMetrics]);

  // --------------------------------------------------------------------------
  // MATRIX (SCATTER) CALCULATIONS
  // --------------------------------------------------------------------------
  const maxRevenueMatrix = useMemo(() => {
    const max = Math.max(...filteredMetrics.map((m) => m.revenue), 100000);
    return max * 1.1;
  }, [filteredMetrics]);

  const maxMarginMatrix = 100; // Percent

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header & Chart Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              Интерактивный финансовый радар
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Живая визуализация доходности, структуры затрат и маржинальности выездов
          </span>
        </div>

        {/* View Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button
            type="button"
            onClick={() => setActiveChart('bar')}
            className={`chart-mode-btn ${activeChart === 'bar' ? 'active' : ''}`}
            title="Динамика выручки и расходов"
          >
            <BarChart3 size={15} />
            <span>Выручка & Затраты</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChart('donut')}
            className={`chart-mode-btn ${activeChart === 'donut' ? 'active' : ''}`}
            title="Круговая диаграмма себестоимости"
          >
            <PieChart size={15} />
            <span>Структура затрат</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChart('matrix')}
            className={`chart-mode-btn ${activeChart === 'matrix' ? 'active' : ''}`}
            title="Матрица рентабельности проектов"
          >
            <Target size={15} />
            <span>Матрица маржи</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <Filter size={14} />
            <span>Мин. маржинальность:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 30, 40, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinMarginFilter(val)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: minMarginFilter === val ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: minMarginFilter === val ? 'var(--color-accent)' : 'transparent',
                    color: minMarginFilter === val ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {val === 0 ? 'Все' : `≥ ${val}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} />
          <span>Наведите курсор на элемент графика для детализации</span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflowX: 'auto',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          padding: '16px',
        }}
        onMouseMove={handleMouseMove}
      >
        {filteredMetrics.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Нет данных по заданному фильтру маржинальности (≥ {minMarginFilter}%).
          </div>
        ) : (
          <>
            {/* 1. BAR CHART: Revenue vs Expenses vs Profit */}
            {activeChart === 'bar' && (
              <div style={{ minWidth: '600px' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="barRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
                    </linearGradient>
                    <linearGradient id="barExpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity="0.75" />
                    </linearGradient>
                    <linearGradient id="barProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.75" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = svgHeight - padding.bottom - ratio * (svgHeight - padding.top - padding.bottom);
                    const val = Math.round(maxBarValue * ratio);
                    return (
                      <g key={ratio}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke="var(--color-border)"
                          strokeDasharray={ratio === 0 ? 'none' : '4 4'}
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="var(--color-text-muted)"
                        >
                          {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars per Event */}
                  {filteredMetrics.map((item, idx) => {
                    const usableWidth = svgWidth - padding.left - padding.right;
                    const groupWidth = usableWidth / filteredMetrics.length;
                    const barWidth = Math.min(28, (groupWidth - 20) / 3);
                    const groupX = padding.left + idx * groupWidth;
                    const chartHeight = svgHeight - padding.top - padding.bottom;

                    const revHeight = Math.max(2, (item.revenue / maxBarValue) * chartHeight);
                    const expHeight = Math.max(2, (item.directExpenses / maxBarValue) * chartHeight);
                    const profitHeight = Math.max(2, (Math.max(0, item.netProfit) / maxBarValue) * chartHeight);

                    const revY = svgHeight - padding.bottom - revHeight;
                    const expY = svgHeight - padding.bottom - expHeight;
                    const profitY = svgHeight - padding.bottom - profitHeight;

                    const isSelected = selectedEventId === item.eventId;

                    return (
                      <g
                        key={item.eventId}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                        onClick={() => onSelectEvent(selectedEventId === item.eventId ? 'all' : item.eventId)}
                        onMouseEnter={() => setHoveredEvent(item)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      >
                        {/* Background column highlight if selected or hovered */}
                        {(isSelected || hoveredEvent?.eventId === item.eventId) && (
                          <rect
                            x={groupX + 4}
                            y={padding.top}
                            width={groupWidth - 8}
                            height={chartHeight}
                            fill="var(--color-accent)"
                            fillOpacity="0.06"
                            rx="6"
                          />
                        )}

                        {/* Revenue Bar */}
                        <rect
                          x={groupX + groupWidth / 2 - barWidth * 1.6}
                          y={revY}
                          width={barWidth}
                          height={revHeight}
                          rx="4"
                          fill="url(#barRevGrad)"
                        />

                        {/* Expense Bar */}
                        <rect
                          x={groupX + groupWidth / 2 - barWidth * 0.5}
                          y={expY}
                          width={barWidth}
                          height={expHeight}
                          rx="4"
                          fill="url(#barExpGrad)"
                        />

                        {/* Net Profit Bar */}
                        <rect
                          x={groupX + groupWidth / 2 + barWidth * 0.6}
                          y={profitY}
                          width={barWidth}
                          height={profitHeight}
                          rx="4"
                          fill="url(#barProfitGrad)"
                        />

                        {/* Event Label */}
                        <text
                          x={groupX + groupWidth / 2}
                          y={svgHeight - padding.bottom + 18}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={isSelected ? '700' : '500'}
                          fill={isSelected ? 'var(--color-accent)' : 'var(--color-text)'}
                        >
                          {item.eventTitle.length > 14 ? item.eventTitle.slice(0, 12) + '…' : item.eventTitle}
                        </text>
                        <text
                          x={groupX + groupWidth / 2}
                          y={svgHeight - padding.bottom + 32}
                          textAnchor="middle"
                          fontSize="10"
                          fill="var(--color-text-muted)"
                        >
                          {formatPercent(item.marginPercentage, 0)} маржа
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Bar Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                    <span>Выручка</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f43f5e' }} />
                    <span>Прямые расходы</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }} />
                    <span>Чистая прибыль</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. DONUT CHART: Direct Expense Categories Breakdown */}
            {activeChart === 'donut' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px', padding: '10px 0' }}>
                {totalDirectCost === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', width: '100%' }}>
                    Прямых расходов по выбранным проектам пока не зафиксировано
                  </div>
                ) : (
                  <>
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: '260px', height: '260px' }}>
                      <svg viewBox="0 0 260 260" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        {(() => {
                          const cx = 130;
                          const cy = 130;
                          const radius = 90;
                          const strokeWidth = 32;
                          const circumference = 2 * Math.PI * radius;
                          let accumulatedPercent = 0;

                          return aggregatedCategories.map((cat) => {
                            const strokeDasharray = `${(cat.percent / 100) * circumference} ${circumference}`;
                            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                            accumulatedPercent += cat.percent;

                            const isHovered = hoveredCategory?.name === cat.name;

                            return (
                              <circle
                                key={cat.id}
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill="transparent"
                                stroke={cat.color}
                                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                style={{
                                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={() => setHoveredCategory(cat)}
                                onMouseLeave={() => setHoveredCategory(null)}
                              />
                            );
                          });
                        })()}
                      </svg>

                      {/* Donut Center Info */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          pointerEvents: 'none',
                          maxWidth: '140px',
                        }}
                      >
                        {hoveredCategory ? (
                          <>
                            <span style={{ fontSize: '0.75rem', color: hoveredCategory.color, fontWeight: 700, display: 'block' }}>
                              {hoveredCategory.name}
                            </span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                              {formatRubles(hoveredCategory.amount)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>
                              {formatPercent(hoveredCategory.percent, 1)} от расходов
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>
                              Всего затрат
                            </span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>
                              {formatRubles(totalDirectCost)}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-accent)' }}>
                              {aggregatedCategories.length} категорий
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px', maxWidth: '360px', flex: 1 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Категории расходов:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aggregatedCategories.map((cat) => (
                          <div
                            key={cat.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: hoveredCategory?.name === cat.name ? 'var(--color-surface-hover)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={() => setHoveredCategory(cat)}
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color }} />
                              <span style={{ fontSize: '0.825rem', fontWeight: 500 }}>{cat.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>{formatRubles(cat.amount)}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '42px', textAlign: 'right' }}>
                                {formatPercent(cat.percent, 1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 3. PROFITABILITY MATRIX (SCATTER / BUBBLE PLOT) */}
            {activeChart === 'matrix' && (
              <div style={{ minWidth: '600px' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = svgHeight - padding.bottom - (pct / 100) * (svgHeight - padding.top - padding.bottom);
                    return (
                      <g key={pct}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke="var(--color-border)"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="var(--color-text-muted)"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Benchmark 40% Target Margin Line */}
                  {(() => {
                    const benchmarkY = svgHeight - padding.bottom - (40 / 100) * (svgHeight - padding.top - padding.bottom);
                    return (
                      <g>
                        <line
                          x1={padding.left}
                          y1={benchmarkY}
                          x2={svgWidth - padding.right}
                          y2={benchmarkY}
                          stroke="#10b981"
                          strokeWidth="2"
                          strokeDasharray="6 3"
                        />
                        <text
                          x={svgWidth - padding.right}
                          y={benchmarkY - 6}
                          textAnchor="end"
                          fontSize="10"
                          fontWeight="700"
                          fill="#10b981"
                        >
                          Целевой ориентир 40%
                        </text>
                      </g>
                    );
                  })()}

                  {/* Axis Labels */}
                  <text
                    x={padding.left}
                    y={padding.top - 10}
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-text-muted)"
                  >
                    ↑ Маржинальность (%)
                  </text>
                  <text
                    x={svgWidth - padding.right}
                    y={svgHeight - 15}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-text-muted)"
                  >
                    Выручка проекта (₽) →
                  </text>

                  {/* Scatter Bubbles */}
                  {filteredMetrics.map((item) => {
                    const chartWidth = svgWidth - padding.left - padding.right;
                    const chartHeight = svgHeight - padding.top - padding.bottom;

                    const cx = padding.left + (Math.max(0, item.revenue) / maxRevenueMatrix) * chartWidth;
                    const cy = svgHeight - padding.bottom - (Math.max(0, Math.min(100, item.marginPercentage)) / maxMarginMatrix) * chartHeight;

                    // Bubble size proportional to net profit
                    const radius = Math.max(8, Math.min(24, Math.sqrt(Math.max(1, item.netProfit) / 500)));

                    // Color based on margin threshold
                    const bubbleColor = item.marginPercentage >= 50 ? '#10b981' : item.marginPercentage >= 30 ? '#f59e0b' : '#ef4444';

                    const isHovered = hoveredEvent?.eventId === item.eventId;

                    return (
                      <g
                        key={item.eventId}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectEvent(selectedEventId === item.eventId ? 'all' : item.eventId)}
                        onMouseEnter={() => setHoveredEvent(item)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? radius + 4 : radius}
                          fill={bubbleColor}
                          fillOpacity={isHovered ? 0.9 : 0.65}
                          stroke={bubbleColor}
                          strokeWidth={isHovered ? 3 : 1.5}
                          style={{ transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        />
                        <text
                          x={cx}
                          y={cy - radius - 6}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight={isHovered ? '700' : '500'}
                          fill="var(--color-text)"
                        >
                          {item.eventTitle.length > 12 ? item.eventTitle.slice(0, 10) + '…' : item.eventTitle}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Matrix Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                    <span>Высокая маржа (≥ 50%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                    <span>Средняя (30–49%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                    <span>Низкая (&lt; 30%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Hover Tooltip (Shared across charts) */}
            {hoveredEvent && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(mousePos.x + 15, 550),
                  top: Math.max(10, mousePos.y - 70),
                  backgroundColor: 'var(--color-surface)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  border: '1px solid var(--color-border)',
                  zIndex: 20,
                  pointerEvents: 'none',
                  minWidth: '180px',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px', color: 'var(--color-text)' }}>
                  {hoveredEvent.eventTitle}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  {formatDateRu(hoveredEvent.eventDate)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.775rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Выручка:</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>{formatRubles(hoveredEvent.revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Расходы:</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatRubles(hoveredEvent.directExpenses)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '3px' }}>
                    <span style={{ color: 'var(--color-text)' }}>Прибыль:</span>
                    <span style={{ fontWeight: 800, color: hoveredEvent.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                      {formatRubles(hoveredEvent.netProfit)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Маржинальность:</span>
                    <span style={{ fontWeight: 800, color: hoveredEvent.marginPercentage >= 40 ? '#059669' : '#f59e0b' }}>
                      {formatPercent(hoveredEvent.marginPercentage, 1)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
