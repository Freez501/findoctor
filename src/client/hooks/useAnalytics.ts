/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Hook & Profitability Utilities (`src/client/hooks/useAnalytics.ts`)
 */

import { useState, useEffect, useCallback } from 'react';
import { EventMarginMetrics } from '../../shared/types.js';
import { GetAnalyticsOverviewResponseDTO } from '../../shared/dto.js';
import { useFinance } from '../context/FinanceContext.js';

export interface MarginClassification {
  level: 'green' | 'yellow' | 'red';
  label: string;
  color: string;
  bg: string;
  border: string;
}

/**
 * Classifies profit margin percentage into Russian visual status tiers:
 * - Green (>= 40%): Высокая рентабельность
 * - Yellow (20–39.99%): Умеренная норма прибыли
 * - Red (< 20% or negative): Низкая маржа / операционный убыток
 */
export function classifyMargin(percentage: number): MarginClassification {
  if (percentage >= 40) {
    return {
      level: 'green',
      label: 'Высокая (≥40%)',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.12)',
      border: 'rgba(5, 150, 105, 0.3)',
    };
  }
  if (percentage >= 20) {
    return {
      level: 'yellow',
      label: 'Средняя (20–39%)',
      color: '#d97706',
      bg: 'rgba(217, 119, 6, 0.12)',
      border: 'rgba(217, 119, 6, 0.3)',
    };
  }
  return {
    level: 'red',
    label: percentage < 0 ? 'Убыток' : 'Низкая (<20%)',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.3)',
  };
}

export function useAnalytics() {
  const { transactions } = useFinance();
  const [metrics, setMetrics] = useState<EventMarginMetrics[]>([]);
  const [overview, setOverview] = useState<GetAnalyticsOverviewResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsRes, overviewRes] = await Promise.all([
        fetch('/api/analytics/events'),
        fetch('/api/analytics/overview'),
      ]);

      if (!eventsRes.ok || !overviewRes.ok) {
        throw new Error('Ошибка получения аналитических данных с сервера');
      }

      const eventsData = await eventsRes.json();
      const overviewData = await overviewRes.json();

      setMetrics(eventsData.analytics || []);
      setOverview(overviewData || null);
    } catch (err: any) {
      setError(err.message || 'Сбой обновления аналитики');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Automatically refresh analytics whenever active transactions state changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, transactions]);

  return {
    metrics,
    overview,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
