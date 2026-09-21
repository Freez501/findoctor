/**
 * Truespace — Барный кейтеринг и финансы
 * Strongly-Typed REST API Client (`src/client/api/apiClient.ts`)
 *
 * Provides typed HTTP communication with Express server endpoints.
 * Handles timeouts with AbortController, offline detection, and domain error translation.
 */

import {
  Account,
  BotStatus,
  Category,
  ParsedCommand,
  Partner,
  PartnersAnalyticsSummary,
  Transaction,
  TransactionFilter,
} from '../../shared/types.js';
import {
  CreateTransactionDTO,
  CreateTransactionResponseDTO,
  DeleteTransactionResponseDTO,
  GetAccountsResponseDTO,
  GetCategoriesResponseDTO,
  GetEventsResponseDTO,
  ResetDemoResponseDTO,
} from '../../shared/dto.js';
import { ApiClientError, translateApiError } from './errors.js';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  priority?: 'high' | 'low' | 'auto';
}

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl: string = '', defaultTimeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = this.defaultTimeout, priority, ...fetchOptions } = options;
    const url = `${this.baseUrl}${path}`;

    // Detect browser offline state
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      throw new ApiClientError(
        'Отсутствует подключение к интернету. Проверьте соединение с сетью на площадке.',
        0
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        ...(priority ? { priority } : {}),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Try reading JSON error body
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        // Body is not JSON
      }

      const rawMessage = errorBody?.error || errorBody?.message || response.statusText;
      const translated = translateApiError(response.status, rawMessage);
      throw new ApiClientError(translated, response.status, errorBody?.details);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof ApiClientError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new ApiClientError(
          'Время ожидания ответа сервера истекло. Пожалуйста, попробуйте снова.',
          408
        );
      }

      throw new ApiClientError(
        'Не удалось связаться с сервером учёта. Проверьте подключение к локальной сети или запущен ли сервер.',
        0
      );
    }
  }

  // --- Accounts ---
  public getAccounts(options?: RequestOptions): Promise<GetAccountsResponseDTO> {
    return this.request<GetAccountsResponseDTO>('/api/accounts', options);
  }

  public getAccountById(id: string, options?: RequestOptions): Promise<{ account: Account }> {
    return this.request<{ account: Account }>(`/api/accounts/${encodeURIComponent(id)}`, options);
  }

  public createAccount(
    data: { name: string; type?: string; initialBalance?: number; description?: string },
    options?: RequestOptions
  ): Promise<{ account: Account }> {
    return this.request<{ account: Account }>('/api/accounts', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public saveAccount(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
    options?: RequestOptions
  ): Promise<{ account: Account }> {
    return this.request<{ account: Account }>(`/api/accounts/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Categories ---
  public getCategories(options?: RequestOptions): Promise<GetCategoriesResponseDTO> {
    return this.request<GetCategoriesResponseDTO>('/api/categories', options);
  }

  public createCategory(
    data: Partial<Category> & { name: string },
    options?: RequestOptions
  ): Promise<{ category: Category }> {
    return this.request<{ category: Category }>('/api/categories', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public saveCategory(
    id: string,
    data: Partial<Category>,
    options?: RequestOptions
  ): Promise<{ category: Category }> {
    return this.request<{ category: Category }>(`/api/categories/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Partners ---
  public getPartners(options?: RequestOptions): Promise<{ partners: Partner[] }> {
    return this.request<{ partners: Partner[] }>('/api/partners', options);
  }

  public createPartner(
    data: { name: string },
    options?: RequestOptions
  ): Promise<{ partner: Partner }> {
    return this.request<{ partner: Partner }>('/api/partners', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public updatePartner(
    id: string,
    data: { name?: string; isActive?: boolean },
    options?: RequestOptions
  ): Promise<{ partner: Partner }> {
    return this.request<{ partner: Partner }>(`/api/partners/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Analytics ---
  public getPartnersAnalytics(options?: RequestOptions): Promise<PartnersAnalyticsSummary> {
    return this.request<PartnersAnalyticsSummary>('/api/analytics/partners', options);
  }

  // --- Events ---
  public getEvents(options?: RequestOptions): Promise<GetEventsResponseDTO> {
    return this.request<GetEventsResponseDTO>('/api/events', options);
  }

  // --- Transactions ---
  public getTransactions(
    filter?: TransactionFilter,
    options?: RequestOptions
  ): Promise<{ transactions: Transaction[] }> {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.accountId) params.set('accountId', filter.accountId);
      if (filter.eventId !== undefined) {
        params.set('eventId', filter.eventId === null ? 'null' : filter.eventId);
      }
      if (filter.type) params.set('type', filter.type);
      if (filter.categoryId) params.set('categoryId', filter.categoryId);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);
      if (filter.includeDeleted !== undefined) {
        params.set('includeDeleted', String(filter.includeDeleted));
      }
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ transactions: Transaction[] }>(`/api/transactions${query}`, options);
  }

  public createTransaction(
    dto: CreateTransactionDTO,
    options?: RequestOptions
  ): Promise<CreateTransactionResponseDTO> {
    return this.request<CreateTransactionResponseDTO>('/api/transactions', {
      ...options,
      method: 'POST',
      body: JSON.stringify(dto),
      priority: 'high',
    });
  }

  public deleteTransaction(
    id: string,
    options?: RequestOptions
  ): Promise<DeleteTransactionResponseDTO> {
    return this.request<DeleteTransactionResponseDTO>(`/api/transactions/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
      priority: 'high',
    });
  }

  // --- Telegram & Command Simulator ---
  public getTelegramStatus(options?: RequestOptions): Promise<BotStatus> {
    return this.request<BotStatus>('/api/telegram/status', {
      ...options,
      priority: 'low',
    });
  }

  public parseTelegramCommand(
    text: string,
    options?: RequestOptions
  ): Promise<{ parsed: ParsedCommand }> {
    return this.request<{ parsed: ParsedCommand }>('/api/telegram/parse', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  public executeTelegramCommand(
    text: string,
    options?: RequestOptions
  ): Promise<{
    success: boolean;
    transaction: Transaction;
    updatedAccounts: Account[];
    message: string;
  }> {
    return this.request<{
      success: boolean;
      transaction: Transaction;
      updatedAccounts: Account[];
      message: string;
    }>('/api/telegram/execute', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ text }),
      priority: 'high',
    });
  }

  // --- System ---
  public resetDemoData(options?: RequestOptions): Promise<ResetDemoResponseDTO> {
    return this.request<ResetDemoResponseDTO>('/api/system/reset-demo', {
      ...options,
      method: 'POST',
      priority: 'high',
    });
  }
}

export const api = new ApiClient();
