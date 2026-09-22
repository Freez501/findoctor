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
  CateringEvent,
  ParsedCommand,
  Partner,
  PartnersAnalyticsSummary,
  Transaction,
  TransactionFilter,
  Company,
  UserProfile,
  CompanyMembership,
  UserRole,
} from '../../shared/types.js';
import {
  CreateEventDTO,
  CreateEventResponseDTO,
  CreateTransactionDTO,
  CreateTransactionResponseDTO,
  UpdateTransactionDTO,
  UpdateTransactionResponseDTO,
  BatchCreateTransactionsResponseDTO,
  ParseStatementRequestDTO,
  ParseStatementResponseDTO,
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

  public activeCompanyId: string = '';

  constructor(baseUrl: string = '', defaultTimeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  public setActiveCompanyId(id: string): void {
    this.activeCompanyId = id;
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
          ...(this.activeCompanyId ? { 'x-company-id': this.activeCompanyId } : {}),
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
    data: { name: string; type?: string; initialBalance?: number; description?: string; color?: string; icon?: string },
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
    data: { name?: string; description?: string; isActive?: boolean; type?: string; currentBalance?: number; initialBalance?: number; color?: string; icon?: string },
    options?: RequestOptions
  ): Promise<{ account: Account }> {
    return this.request<{ account: Account }>(`/api/accounts/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public resetAccountBalances(options?: RequestOptions): Promise<{ success: boolean; accounts: Account[]; message: string }> {
    return this.request<{ success: boolean; accounts: Account[]; message: string }>('/api/accounts/reset-balances', {
      ...options,
      method: 'POST',
    });
  }

  public deleteAccount(
    id: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/accounts/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
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

  public deleteCategory(
    id: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/categories/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
    });
  }

  // --- Partners ---
  public getPartners(options?: RequestOptions): Promise<{ partners: Partner[] }> {
    return this.request<{ partners: Partner[] }>('/api/partners', options);
  }

  public createPartner(
    data: { name: string; role?: string },
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
    data: { name?: string; role?: string; isActive?: boolean },
    options?: RequestOptions
  ): Promise<{ partner: Partner }> {
    return this.request<{ partner: Partner }>(`/api/partners/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public deletePartner(
    id: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/partners/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
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

  public createEvent(
    data: CreateEventDTO,
    options?: RequestOptions
  ): Promise<CreateEventResponseDTO> {
    return this.request<CreateEventResponseDTO>('/api/events', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public updateEvent(
    id: string,
    data: Partial<CateringEvent>,
    options?: RequestOptions
  ): Promise<{ event: CateringEvent }> {
    return this.request<{ event: CateringEvent }>(`/api/events/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public deleteEvent(
    id: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; deletedId: string }> {
    return this.request<{ success: boolean; deletedId: string }>(`/api/events/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
    });
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

  public updateTransaction(
    id: string,
    dto: UpdateTransactionDTO,
    options?: RequestOptions
  ): Promise<UpdateTransactionResponseDTO> {
    return this.request<UpdateTransactionResponseDTO>(`/api/transactions/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(dto),
      priority: 'high',
    });
  }

  public createBatchTransactions(
    transactions: CreateTransactionDTO[],
    options?: RequestOptions
  ): Promise<BatchCreateTransactionsResponseDTO> {
    return this.request<BatchCreateTransactionsResponseDTO>('/api/transactions/batch', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ transactions }),
      priority: 'high',
    });
  }

  public deleteBatchTransactions(
    ids: string[],
    options?: RequestOptions
  ): Promise<{ success: boolean; deletedCount: number; deletedIds: string[]; updatedAccounts: Account[]; message: string }> {
    return this.request<{ success: boolean; deletedCount: number; deletedIds: string[]; updatedAccounts: Account[]; message: string }>('/api/transactions/batch-delete', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ ids }),
      priority: 'high',
    });
  }

  public updateBatchTransactions(
    ids: string[],
    updates: {
      accountId?: string;
      fromAccountId?: string | null;
      toAccountId?: string | null;
      categoryId?: string;
      eventId?: string | null;
    },
    options?: RequestOptions
  ): Promise<{ success: boolean; updatedCount: number; updatedAccounts: Account[]; message: string }> {
    return this.request<{ success: boolean; updatedCount: number; updatedAccounts: Account[]; message: string }>('/api/transactions/batch-update', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ ids, updates }),
      priority: 'high',
    });
  }

  public parseStatement(
    dto: ParseStatementRequestDTO,
    options?: RequestOptions
  ): Promise<ParseStatementResponseDTO> {
    return this.request<ParseStatementResponseDTO>('/api/transactions/parse-statement', {
      ...options,
      method: 'POST',
      body: JSON.stringify(dto),
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

  // --- Companies & Multi-Tenancy ---
  public getCompanies(options?: RequestOptions): Promise<Company[]> {
    return this.request<Company[]>('/api/companies', options);
  }

  public getCompanyById(id: string, options?: RequestOptions): Promise<Company> {
    return this.request<Company>(`/api/companies/${id}`, options);
  }

  public createCompany(data: { name: string; slug?: string; plan?: string; ownerId?: string }, options?: RequestOptions): Promise<Company> {
    return this.request<Company>('/api/companies', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public getCompanyMembers(companyId: string, options?: RequestOptions): Promise<{ membership: CompanyMembership; user?: UserProfile }[]> {
    return this.request<{ membership: CompanyMembership; user?: UserProfile }[]>(`/api/companies/${companyId}/members`, options);
  }

  public addCompanyMember(companyId: string, data: { userId: string; role: UserRole; invitedBy?: string }, options?: RequestOptions): Promise<CompanyMembership> {
    return this.request<CompanyMembership>(`/api/companies/${companyId}/members`, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  // --- Auth & Users ---
  public login(data: { email: string; password?: string }, options?: RequestOptions): Promise<{ success: boolean; user: UserProfile; company: Company }> {
    return this.request<{ success: boolean; user: UserProfile; company: Company }>('/api/auth/login', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public register(data: { email: string; password?: string; fullName?: string; companyName?: string }, options?: RequestOptions): Promise<{ success: boolean; user: UserProfile; company: Company }> {
    return this.request<{ success: boolean; user: UserProfile; company: Company }>('/api/auth/register', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public logout(options?: RequestOptions): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/logout', {
      ...options,
      method: 'POST',
      priority: 'high',
    });
  }

  public updateUserProfile(id: string, data: Partial<UserProfile>, options?: RequestOptions): Promise<{ success: boolean; user: UserProfile }> {
    return this.request<{ success: boolean; user: UserProfile }>(`/api/auth/users/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public updateCompany(id: string, data: Partial<Company>, options?: RequestOptions): Promise<Company> {
    return this.request<Company>(`/api/companies/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public getCurrentUser(options?: RequestOptions): Promise<{ user: UserProfile | null; activeCompanyId: string }> {
    return this.request<{ user: UserProfile | null; activeCompanyId: string }>('/api/auth/me', options);
  }

  public getUsers(options?: RequestOptions): Promise<UserProfile[]> {
    return this.request<UserProfile[]>('/api/auth/users', options);
  }

  public switchUser(userId: string, options?: RequestOptions): Promise<{ success: boolean; user: UserProfile }> {
    return this.request<{ success: boolean; user: UserProfile }>('/api/auth/switch-user', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ userId }),
      priority: 'high',
    });
  }

  public registerOrInviteUser(data: { email: string; fullName?: string; companyId?: string; role?: UserRole }, options?: RequestOptions): Promise<{ user: UserProfile; companyId: string; role: UserRole }> {
    return this.request<{ user: UserProfile; companyId: string; role: UserRole }>('/api/auth/register-or-invite', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  // --- System & Supabase Cloud ---
  public getSupabaseStatus(options?: RequestOptions): Promise<{ isConfigured: boolean; mode: string; url?: string; message: string }> {
    return this.request<{ isConfigured: boolean; mode: string; url?: string; message: string }>('/api/system/supabase/status', options);
  }

  public getSupabaseSql(options?: RequestOptions): Promise<{ success: boolean; sql: string }> {
    return this.request<{ success: boolean; sql: string }>('/api/system/supabase/sql', options);
  }

  public testSupabase(data: { url?: string; key?: string }, options?: RequestOptions): Promise<{ success: boolean; message?: string; error?: string; foundAccounts?: number }> {
    return this.request<{ success: boolean; message?: string; error?: string; foundAccounts?: number }>('/api/system/supabase/test', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public saveSupabaseConfig(data: { url: string; key: string }, options?: RequestOptions): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request<{ success: boolean; message?: string; error?: string }>('/api/system/supabase/save-config', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high',
    });
  }

  public syncToSupabase(data?: { url?: string; key?: string }, options?: RequestOptions): Promise<{ success: boolean; message?: string; error?: string; counts?: any }> {
    return this.request<{ success: boolean; message?: string; error?: string; counts?: any }>('/api/system/supabase/sync', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data || {}),
      priority: 'high',
    });
  }

  public pullFromSupabase(data?: { url?: string; key?: string }, options?: RequestOptions): Promise<{ success: boolean; message?: string; error?: string; counts?: any }> {
    return this.request<{ success: boolean; message?: string; error?: string; counts?: any }>('/api/system/supabase/pull', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data || {}),
      priority: 'high',
    });
  }

  public resetDemoData(options?: RequestOptions): Promise<ResetDemoResponseDTO> {
    return this.request<ResetDemoResponseDTO>('/api/system/reset-demo', {
      ...options,
      method: 'POST',
      priority: 'high',
    });
  }
}

export const api = new ApiClient();
