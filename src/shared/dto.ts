/**
 * Truespace — Барный кейтеринг и финансы
 * API Data Transfer Objects (DTOs) & Validation (`src/shared/dto.ts`)
 *
 * Strongly-typed request/response payloads and zero-dependency validation schemas.
 */

import {
  Account,
  AccountType,
  BotStatus,
  Category,
  CateringEvent,
  EventMarginMetrics,
  EventStatus,
  ParsedCommand,
  ParsedStatementItem,
  Transaction,
  TransactionType,
} from './types.js';

export type { ParsedStatementItem };

// ==========================================
// 1. ACCOUNTS DTOS
// ==========================================

export interface GetAccountsResponseDTO {
  accounts: Account[];
  totalBalance: number;
}

export interface GetAccountByIdResponseDTO {
  account: Account;
}

// ==========================================
// 2. EVENTS DTOS
// ==========================================

export interface GetEventsResponseDTO {
  events: CateringEvent[];
}

export interface CreateEventDTO {
  title: string;
  clientName?: string;
  eventDate: string; // YYYY-MM-DD
  status?: EventStatus;
  budget?: number;
  contractAmount?: number;
  guestCount?: number;
  location?: string;
  notes?: string;
  companyId?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateEventResponseDTO {
  event: CateringEvent;
}

// ==========================================
// 3. CATEGORIES DTOS
// ==========================================

export interface GetCategoriesResponseDTO {
  categories: Category[];
}

// ==========================================
// 4. TRANSACTIONS DTOS
// ==========================================

export interface GetTransactionsQueryDTO {
  accountId?: string;
  eventId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  includeDeleted?: boolean;
}

export interface CreateTransactionDTO {
  type: TransactionType;
  /** Direction: operational (event-based), business (overhead), dividends (partner payouts), transfer */
  direction?: import('./types.js').TransactionDirection;
  /** Strictly positive amount in rubles (> 0) */
  amount: number;
  /** Source account ID (mandatory for expense and transfer) */
  fromAccountId?: string | null;
  /** Destination account ID (mandatory for income and transfer) */
  toAccountId?: string | null;
  /** Associated category ID */
  categoryId: string;
  /** Event ID or null for general bar overhead */
  eventId?: string | null;
  /** Partner ID (for dividends or partner-attributed transactions) */
  partnerId?: string | null;
  /** Partner name */
  partnerName?: string | null;
  /** Optional transaction memo or description */
  description?: string;
  /** ISO 8601 date string (optional, defaults to current time) */
  transactionDate?: string;
  /** Flag indicating whether imported transaction requires category/event review by user */
  needsReview?: boolean;
  companyId?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateTransactionResponseDTO {
  success: boolean;
  transaction: Transaction;
  updatedAccounts: Account[];
}

export interface UpdateTransactionDTO {
  type?: TransactionType;
  direction?: import('./types.js').TransactionDirection;
  amount?: number;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  categoryId?: string;
  eventId?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  description?: string;
  transactionDate?: string;
  needsReview?: boolean;
  companyId?: string;
  updatedBy?: string;
}

export interface UpdateTransactionResponseDTO {
  success: boolean;
  transaction: Transaction;
  updatedAccounts: Account[];
}

export interface BatchCreateTransactionsDTO {
  transactions: CreateTransactionDTO[];
}

export interface BatchCreateTransactionsResponseDTO {
  success: boolean;
  count: number;
  transactions: Transaction[];
  updatedAccounts: Account[];
}

export interface ParseStatementRequestDTO {
  targetAccountId: string;
  text?: string;
  fileBase64?: string;
  fileName?: string;
}

export interface ParseStatementResponseDTO {
  targetAccountId: string;
  items: ParsedStatementItem[];
  totalParsed: number;
  needsReviewCount: number;
}

export interface DeleteTransactionResponseDTO {
  success: boolean;
  transaction: Transaction;
  updatedAccounts: Account[];
  message: string;
}

// ==========================================
// 5. ANALYTICS DTOS
// ==========================================

export interface GetEventsAnalyticsResponseDTO {
  analytics: EventMarginMetrics[];
}

export interface GetAnalyticsOverviewResponseDTO {
  totalBalance: number;
  generalExpensesTotal: number;
  eventsCount: number;
  activeEventsCount: number;
  eventsTotalRevenue: number;
  eventsTotalExpenses: number;
  eventsNetProfit: number;
  averageMarginPercentage: number;
  accounts: Account[];
}

// ==========================================
// 6. TELEGRAM & NLP PARSER DTOS
// ==========================================

export interface ParseCommandRequestDTO {
  /** Raw natural language text from user */
  text: string;
}

export interface ParseCommandResponseDTO {
  parsed: ParsedCommand;
}

export interface ExecuteCommandRequestDTO {
  /** Pre-parsed command entity */
  command?: ParsedCommand;
  /** Or raw text to parse and execute directly in a single call */
  text?: string;
}

export interface ExecuteCommandResponseDTO {
  success: boolean;
  transaction: Transaction;
  updatedAccounts: Account[];
  message: string;
}

export type GetBotStatusResponseDTO = BotStatus;

// ==========================================
// 7. SYSTEM & ERROR DTOS
// ==========================================

export interface ResetDemoResponseDTO {
  success: boolean;
  message: string;
  accounts: Account[];
  transactionsCount: number;
  eventsCount: number;
}

export interface ApiErrorResponseDTO {
  error: string;
  details?: string[];
  statusCode: number;
}

// ==========================================
// 8. VALIDATION HELPERS & TYPE GUARDS
// ==========================================

export function isTransactionType(val: unknown): val is TransactionType {
  return typeof val === 'string' && ['income', 'expense', 'transfer'].includes(val);
}

export function isAccountType(val: unknown): val is AccountType {
  return typeof val === 'string' && ['cash', 'bank', 'card'].includes(val);
}

export function isEventStatus(val: unknown): val is EventStatus {
  return typeof val === 'string' && ['planned', 'active', 'completed', 'cancelled'].includes(val);
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

/**
 * Validates CreateTransactionDTO according to strict double-entry and domain business rules.
 */
export function validateCreateTransactionDTO(input: unknown): ValidationResult<CreateTransactionDTO> {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Тело запроса должно быть объектом'] };
  }

  const payload = input as Partial<CreateTransactionDTO>;

  // 1. Type validation
  if (!payload.type || !isTransactionType(payload.type)) {
    errors.push("Поле 'type' должно быть одним из: 'income', 'expense', 'transfer'");
  }

  // 2. Amount validation
  if (typeof payload.amount !== 'number' || isNaN(payload.amount) || payload.amount <= 0) {
    errors.push("Сумма 'amount' должна быть положительным числом больше 0");
  }

  // 3. Category validation
  if (!payload.categoryId || typeof payload.categoryId !== 'string' || payload.categoryId.trim() === '') {
    errors.push("Поле 'categoryId' обязательно для заполнения");
  }

  // 4. Account rules based on transaction type
  if (payload.type === 'income') {
    if (!payload.toAccountId || typeof payload.toAccountId !== 'string' || payload.toAccountId.trim() === '') {
      errors.push("Для операции 'income' (доход) необходимо указать счёт зачисления 'toAccountId'");
    }
  } else if (payload.type === 'expense') {
    if (!payload.fromAccountId || typeof payload.fromAccountId !== 'string' || payload.fromAccountId.trim() === '') {
      errors.push("Для операции 'expense' (расход) необходимо указать счёт списания 'fromAccountId'");
    }
  } else if (payload.type === 'transfer') {
    if (!payload.fromAccountId || typeof payload.fromAccountId !== 'string') {
      errors.push("Для перевода необходимо указать счёт списания 'fromAccountId'");
    }
    if (!payload.toAccountId || typeof payload.toAccountId !== 'string') {
      errors.push("Для перевода необходимо указать счёт зачисления 'toAccountId'");
    }
    if (payload.fromAccountId && payload.toAccountId && payload.fromAccountId === payload.toAccountId) {
      errors.push("Счёт списания и счёт зачисления при переводе не могут совпадать");
    }
  }

  // 5. Date validation if provided
  if (payload.transactionDate && isNaN(Date.parse(payload.transactionDate))) {
    errors.push("Поле 'transactionDate' должно быть корректной датой в формате ISO 8601");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      type: payload.type!,
      amount: Math.round(payload.amount! * 100) / 100, // Normalize to 2 decimal places
      fromAccountId: payload.fromAccountId || null,
      toAccountId: payload.toAccountId || null,
      categoryId: payload.categoryId!.trim(),
      eventId: payload.eventId || null,
      description: payload.description ? payload.description.trim() : '',
      transactionDate: payload.transactionDate || new Date().toISOString(),
    },
  };
}

/**
 * Validates CreateEventDTO
 */
export function validateCreateEventDTO(input: unknown): ValidationResult<CreateEventDTO> {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Тело запроса должно быть объектом'] };
  }

  const payload = input as Partial<CreateEventDTO>;

  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim() === '') {
    errors.push("Название мероприятия 'title' обязательно");
  }

  if (!payload.eventDate || isNaN(Date.parse(payload.eventDate))) {
    errors.push("Дата мероприятия 'eventDate' обязательна и должна быть валидной датой (YYYY-MM-DD)");
  }

  if (payload.status && !isEventStatus(payload.status)) {
    errors.push("Статус мероприятия 'status' должен быть: 'planned', 'active', 'completed', 'cancelled'");
  }

  if (payload.budget !== undefined && (typeof payload.budget !== 'number' || payload.budget < 0)) {
    errors.push("Бюджет мероприятия 'budget' должен быть неотрицательным числом");
  }

  if (payload.contractAmount !== undefined && (typeof payload.contractAmount !== 'number' || payload.contractAmount < 0)) {
    errors.push("Сумма договора 'contractAmount' должна быть неотрицательным числом");
  }

  if (payload.guestCount !== undefined && (typeof payload.guestCount !== 'number' || payload.guestCount < 0)) {
    errors.push("Количество гостей 'guestCount' должно быть целым неотрицательным числом");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      title: payload.title!.trim(),
      clientName: payload.clientName ? payload.clientName.trim() : undefined,
      eventDate: payload.eventDate!.trim(),
      status: payload.status || 'planned',
      budget: payload.budget,
      contractAmount: payload.contractAmount,
      guestCount: payload.guestCount,
      location: payload.location ? payload.location.trim() : undefined,
      notes: payload.notes ? payload.notes.trim() : undefined,
    },
  };
}

/**
 * Validates ParseCommandRequestDTO
 */
export function validateParseCommandRequestDTO(input: unknown): ValidationResult<ParseCommandRequestDTO> {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Тело запроса должно быть объектом'] };
  }
  const payload = input as Partial<ParseCommandRequestDTO>;
  if (!payload.text || typeof payload.text !== 'string' || payload.text.trim() === '') {
    return { valid: false, errors: ["Текстовая команда 'text' не может быть пустой"] };
  }
  return { valid: true, errors: [], data: { text: payload.text.trim() } };
}
