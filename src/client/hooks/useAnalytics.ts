/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Hook & Profitability Utilities (`src/client/hooks/useAnalytics.ts`)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EventMarginMetrics, CategoryExpenseBreakdown } from '../../shared/types.js';
import { GetAnalyticsOverviewResponseDTO } from '../../shared/dto.js';
import { useFinance } from '../context/FinanceContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/apiClient.js';

export interface MarginClassification {
  level: 'green' | 'yellow' | 'red';
  label: string;
  color: string;
  bg: string;
  border: string;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

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
  const { transactions, events, accounts, categories, isInitialLoaded } = useFinance();
  const { currentCompany, currentUser } = useAuth();
  const [serverMetrics, setServerMetrics] = useState<EventMarginMetrics[] | null>(null);
  const [serverOverview, setServerOverview] = useState<GetAnalyticsOverviewResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Instant 0ms local calculation from FinanceContext state
  const computed = useMemo(() => {
    const activeTxs = transactions.filter((t) => !t.isDeleted);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const localMetrics: EventMarginMetrics[] = events.map((event) => {
      const normEventId = event.id.replace(/-/g, '_');
      const eventTxs = activeTxs.filter(
        (tx) =>
          tx.eventId &&
          (tx.eventId === event.id || tx.eventId.replace(/-/g, '_') === normEventId)
      );

      const revenue = round2(
        eventTxs.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
      );
      const directExpenses = round2(
        eventTxs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
      );
      const netProfit = round2(revenue - directExpenses);

      let marginPercentage = 0;
      if (revenue > 0) {
        marginPercentage = round2((netProfit / revenue) * 100);
      } else if (directExpenses > 0) {
        marginPercentage = -100;
      }

      const catSumMap = new Map<string, number>();
      for (const tx of eventTxs) {
        if (tx.type === 'expense') {
          const prev = catSumMap.get(tx.categoryId) || 0;
          catSumMap.set(tx.categoryId, round2(prev + tx.amount));
        }
      }

      const expensesByCategory: CategoryExpenseBreakdown[] = Array.from(catSumMap.entries())
        .map(([categoryId, amount]) => ({
          categoryId,
          categoryName: categoryMap.get(categoryId) || categoryId,
          amount,
          percentage: directExpenses > 0 ? round2((amount / directExpenses) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.eventDate,
        revenue,
        directExpenses,
        netProfit,
        marginPercentage,
        expensesByCategory,
      };
    });

    const totalBalance = round2(accounts.reduce((sum, a) => sum + a.currentBalance, 0));
    const generalExpensesTotal = round2(
      activeTxs
        .filter((tx) => tx.type === 'expense' && (tx.eventId === null || tx.eventId === undefined))
        .reduce((sum, tx) => sum + tx.amount, 0)
    );
    const eventsTotalRevenue = round2(localMetrics.reduce((sum, m) => sum + m.revenue, 0));
    const eventsTotalExpenses = round2(localMetrics.reduce((sum, m) => sum + m.directExpenses, 0));
    const eventsNetProfit = round2(eventsTotalRevenue - eventsTotalExpenses);
    const averageMarginPercentage =
      eventsTotalRevenue > 0 ? round2((eventsNetProfit / eventsTotalRevenue) * 100) : 0;

    const localOverview: GetAnalyticsOverviewResponseDTO = {
      totalBalance,
      generalExpensesTotal,
      eventsCount: events.length,
      activeEventsCount: events.filter((e) => e.status === 'active').length,
      eventsTotalRevenue,
      eventsTotalExpenses,
      eventsNetProfit,
      averageMarginPercentage,
      accounts,
    };

    return { localMetrics, localOverview };
  }, [transactions, events, accounts, categories]);

  // Clear stale server overrides whenever local transactions or events change
  useEffect(() => {
    setServerMetrics(null);
    setServerOverview(null);
  }, [transactions, events, currentCompany?.id]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const companyId =
        currentCompany?.id ||
        api.activeCompanyId ||
        (typeof window !== 'undefined' ? localStorage.getItem('truespace_company_id') : null) ||
        'company_truespace_default';
      const userId =
        currentUser?.id ||
        api.activeUserId ||
        (typeof window !== 'undefined' ? localStorage.getItem('truespace_user_id') : null) ||
        '';

      const headers: Record<string, string> = {
        'x-company-id': companyId,
      };
      if (userId) {
        headers['x-user-id'] = userId;
      }

      const [eventsRes, overviewRes] = await Promise.all([
        fetch('/api/analytics/events', { headers }),
        fetch('/api/analytics/overview', { headers }),
      ]);

      if (!eventsRes.ok || !overviewRes.ok) {
        throw new Error('Ошибка получения аналитических данных с сервера');
      }

      const eventsData = await eventsRes.json();
      const overviewData = await overviewRes.json();

      setServerMetrics(eventsData.analytics || []);
      setServerOverview(overviewData || null);
    } catch (err: any) {
      if (!isInitialLoaded) {
        setError(err.message || 'Сбой обновления аналитики');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id, currentUser?.id, isInitialLoaded]);

  useEffect(() => {
    if (!isInitialLoaded) {
      fetchAnalytics();
    }
  }, [isInitialLoaded, fetchAnalytics]);

  return {
    metrics: serverMetrics ?? computed.localMetrics,
    overview: serverOverview ?? computed.localOverview,
    isLoading: !isInitialLoaded && isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
