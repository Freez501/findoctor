/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Engine Service (`src/server/services/AnalyticsService.ts`)
 *
 * Implements:
 * - Event margin calculations: revenue, direct expenses, net profit, margin %
 * - Zero revenue division protection (0% or -100% loss indicator, never NaN or Infinity)
 * - Category breakdown of direct expenses with amounts and percentages
 * - General bar expenses (overhead) tracking and isolation
 * - Consolidated catering financial overview
 */

import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';
import { EventMarginMetrics, CategoryExpenseBreakdown, PartnersAnalyticsSummary, PartnerMetricItem } from '../../shared/types.js';
import { GetAnalyticsOverviewResponseDTO } from '../../shared/dto.js';
import { round2 } from './FinanceService.js';

export class AnalyticsService {
  constructor(private store: IFinanceStore = getStorageInstance()) {}

  /**
   * Calculates profitability margin metrics for a single event.
   */
  public async getEventMargin(eventId: string, companyId?: string): Promise<EventMarginMetrics | null> {
    const events = await this.store.getEvents(companyId);
    // Resolve event by exact ID or normalized ID (hyphen vs underscore)
    const event = events.find(
      (e) => e.id === eventId || e.id.replace(/-/g, '_') === eventId.replace(/-/g, '_')
    );

    if (!event) {
      return null;
    }

    const allTxs = await this.store.getTransactions({ includeDeleted: false, companyId });
    const eventTxs = allTxs.filter(
      (tx) =>
        tx.eventId &&
        (tx.eventId === event.id ||
          tx.eventId.replace(/-/g, '_') === event.id.replace(/-/g, '_') ||
          tx.eventId === eventId ||
          tx.eventId.replace(/-/g, '_') === eventId.replace(/-/g, '_'))
    );

    const categories = await this.store.getCategories(companyId);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const revenue = round2(
      eventTxs
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    const directExpenses = round2(
      eventTxs
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    const netProfit = round2(revenue - directExpenses);

    // Margin percentage with safe zero revenue protection:
    // If revenue > 0: (netProfit / revenue) * 100
    // If revenue <= 0 and directExpenses > 0: -100 (pure operational loss indicator)
    // If revenue == 0 and directExpenses == 0: 0
    let marginPercentage = 0;
    if (revenue > 0) {
      marginPercentage = round2((netProfit / revenue) * 100);
    } else if (directExpenses > 0) {
      marginPercentage = -100;
    }

    // Direct expenses grouped by category
    const catSumMap = new Map<string, number>();
    for (const tx of eventTxs) {
      if (tx.type === 'expense') {
        const prev = catSumMap.get(tx.categoryId) || 0;
        catSumMap.set(tx.categoryId, round2(prev + tx.amount));
      }
    }

    const expensesByCategory: CategoryExpenseBreakdown[] = Array.from(catSumMap.entries())
      .map(([categoryId, amount]) => {
        const categoryName = categoryMap.get(categoryId) || categoryId;
        const percentage = directExpenses > 0 ? round2((amount / directExpenses) * 100) : 0;
        return {
          categoryId,
          categoryName,
          amount,
          percentage,
        };
      })
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
  }

  /**
   * Calculates profitability margin metrics for all registered events using a single parallel fetch.
   */
  public async getAllEventsMargin(companyId?: string): Promise<EventMarginMetrics[]> {
    const [events, allTxs, categories] = await Promise.all([
      this.store.getEvents(companyId),
      this.store.getTransactions({ includeDeleted: false, companyId }),
      this.store.getCategories(companyId),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return events.map((event) => {
      const normEventId = event.id.replace(/-/g, '_');
      const eventTxs = allTxs.filter(
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
  }

  /**
   * Sum of general overhead expenses (eventId is null/undefined).
   */
  public async getGeneralExpensesTotal(companyId?: string): Promise<number> {
    const transactions = await this.store.getTransactions({ includeDeleted: false, companyId });
    const generalTxs = transactions.filter(
      (tx) => tx.type === 'expense' && (tx.eventId === null || tx.eventId === undefined)
    );
    return round2(generalTxs.reduce((sum, tx) => sum + tx.amount, 0));
  }

  /**
   * Consolidated overview of the business in a single parallel batch.
   */
  public async getOverview(companyId?: string): Promise<GetAnalyticsOverviewResponseDTO> {
    const [accounts, events, allTxs] = await Promise.all([
      this.store.getAccounts(companyId),
      this.store.getEvents(companyId),
      this.store.getTransactions({ includeDeleted: false, companyId }),
    ]);

    const totalBalance = round2(accounts.reduce((sum, a) => sum + a.currentBalance, 0));
    const generalExpensesTotal = round2(
      allTxs
        .filter((tx) => tx.type === 'expense' && (tx.eventId === null || tx.eventId === undefined))
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    const activeEventsCount = events.filter((e) => e.status === 'active').length;

    let eventsTotalRevenue = 0;
    let eventsTotalExpenses = 0;
    for (const ev of events) {
      const normEventId = ev.id.replace(/-/g, '_');
      for (const tx of allTxs) {
        if (tx.eventId && (tx.eventId === ev.id || tx.eventId.replace(/-/g, '_') === normEventId)) {
          if (tx.type === 'income') eventsTotalRevenue = round2(eventsTotalRevenue + tx.amount);
          else if (tx.type === 'expense') eventsTotalExpenses = round2(eventsTotalExpenses + tx.amount);
        }
      }
    }

    const eventsNetProfit = round2(eventsTotalRevenue - eventsTotalExpenses);
    const averageMarginPercentage =
      eventsTotalRevenue > 0
        ? round2((eventsNetProfit / eventsTotalRevenue) * 100)
        : 0;

    return {
      totalBalance,
      generalExpensesTotal,
      eventsCount: events.length,
      activeEventsCount,
      eventsTotalRevenue,
      eventsTotalExpenses,
      eventsNetProfit,
      averageMarginPercentage,
      accounts,
    };
  }

  /**
   * Analytics on partner withdrawals, dividends, and cash distribution.
   */
  public async getPartnersAnalytics(companyId?: string): Promise<PartnersAnalyticsSummary> {
    const [partners, accounts, transactions] = await Promise.all([
      this.store.getPartners(companyId),
      this.store.getAccounts(companyId),
      this.store.getTransactions({ includeDeleted: false, companyId }),
    ]);
    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

    // Group transactions by partner
    const partnerMetrics: PartnerMetricItem[] = partners.map((p) => {
      const pTxs = transactions.filter(
        (tx) =>
          tx.partnerId === p.id ||
          (tx.partnerName && tx.partnerName.toLowerCase() === p.name.toLowerCase()) ||
          (tx.direction === 'dividends' && tx.description?.toLowerCase().includes(p.name.toLowerCase()))
      );

      const totalWithdrawn = round2(
        pTxs.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0)
      );

      const payouts = pTxs
        .filter((tx) => tx.type === 'expense')
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .map((tx) => ({
          transactionId: tx.id,
          date: tx.transactionDate,
          amount: tx.amount,
          fromAccountName: tx.fromAccountId ? accountMap.get(tx.fromAccountId) || tx.fromAccountId : undefined,
          comment: tx.description,
        }));

      return {
        partnerId: p.id,
        partnerName: p.name,
        totalWithdrawn,
        transactionsCount: payouts.length,
        recentPayouts: payouts,
      };
    });

    const totalDividendsPaid = round2(
      partnerMetrics.reduce((sum, item) => sum + item.totalWithdrawn, 0)
    );

    return {
      totalDividendsPaid,
      partners: partnerMetrics,
    };
  }
}
