/**
 * Truespace — Барный кейтеринг и финансы
 * Shared Domain Models (`src/shared/types.ts`)
 *
 * Authoritative domain contracts shared across Frontend (React) and Backend (Node.js/Express).
 */

/**
 * Account types supported by the catering business:
 * - cash: Physical cash (onsite bar box, office safe)
 * - bank: Official corporate/sole-proprietorship bank accounts
 * - card: Personal cards / fast payment system (SBP)
 */
export type AccountType = 'cash' | 'bank' | 'card';

/**
 * Supported financial transaction operations:
 * - income: Incoming revenue (prepayments, onsite sales, tips)
 * - expense: Outgoing expense (alcohol, staff fees, ice/supplies, logistics, rent)
 * - transfer: Internal liquidity movement between accounts (cash withdrawals, collection)
 */
export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * Catering event lifecycle states:
 * - planned: Upcoming event in negotiation or pre-procurement phase
 * - active: Event currently in preparation or execution
 * - completed: Event concluded, all calculations finalized
 * - cancelled: Event called off
 */
export type EventStatus = 'planned' | 'active' | 'completed' | 'cancelled';

/**
 * Category classification:
 * - income: Applied only to revenue operations
 * - expense: Applied only to expenditure operations
 * - both: Applicable to both revenue and expenditure
 * - transfer: System category for internal balance shifts
 */
export type CategoryType = 'income' | 'expense' | 'both' | 'transfer';

/**
 * Account domain model representing one of the 5 distinct liquidity nodes.
 */
export interface Account {
  /** Unique account identifier (e.g. 'cash_1', 'cash_2', 'bank_1', 'bank_2', 'card_sbp') */
  id: string;
  /** Human-readable display name (e.g. "Нал 1 (Касса на площадке)") */
  name: string;
  /** Account category type */
  type: AccountType;
  /** Initial starting balance in rubles (base reference) */
  initialBalance: number;
  /** Dynamically calculated current balance in rubles */
  currentBalance: number;
  /** Currency code, standard is Russian Ruble */
  currency: 'RUB';
  /** Account purpose and usage guidelines */
  description: string;
  /** Account active status */
  isActive: boolean;
  /** Creation timestamp (ISO 8601) */
  createdAt?: string;
  /** Last balance modification timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Catering Event domain model representing a client banquet, wedding, or corporate event.
 */
export interface CateringEvent {
  /** Unique event identifier (e.g. 'event-wedding', 'event-corporate') */
  id: string;
  /** Event title / name */
  title: string;
  /** Event date formatted as YYYY-MM-DD */
  eventDate: string;
  /** Current lifecycle status */
  status: EventStatus;
  /** Target planned budget / contract value in rubles */
  budget?: number;
  /** Expected or confirmed guest count */
  guestCount?: number;
  /** Venue / location title */
  location?: string;
  /** Additional notes, cocktail menu specifics, organizer contacts */
  notes?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt?: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt?: string;
}

/**
 * Category domain model for grouping income and direct/general expenses.
 */
export interface Category {
  /** Unique category identifier (e.g. 'alcohol', 'supplies', 'staff') */
  id: string;
  /** Category display name in Russian */
  name: string;
  /** Permitted transaction type */
  type: CategoryType;
  /** Color hex code for UI badges and charts */
  color: string;
  /** Lucide icon identifier or visual token */
  icon?: string;
  /** True if category is strictly bound to catering events (direct expenses/incomes); false for general bar overhead */
  isEventSpecific: boolean;
  /** True for immutable system categories */
  isSystem?: boolean;
  /** Creation timestamp (ISO 8601) */
  createdAt?: string;
}

/**
 * Transaction domain model representing an atomic cashflow operation.
 */
export interface Transaction {
  /** Unique transaction identifier (e.g. 'tx-001' or UUID) */
  id: string;
  /** Operation type: income, expense, or transfer */
  type: TransactionType;
  /** Monetary amount in Russian Rubles (always strictly positive > 0) */
  amount: number;
  /** Source account ID (mandatory for expense and transfer; null for income) */
  fromAccountId?: string | null;
  /** Destination account ID (mandatory for income and transfer; null for expense) */
  toAccountId?: string | null;
  /** Associated category identifier */
  categoryId: string;
  /** Associated event identifier (null represents general bar overhead / non-event operation) */
  eventId?: string | null;
  /** Freeform commentary or receipt memo */
  description?: string;
  /** Transaction date and time (ISO 8601 string) */
  transactionDate: string;
  /** Soft-deletion flag (true when transaction has been reversed/cancelled) */
  isDeleted: boolean;
  /** System creation timestamp */
  createdAt?: string;
  /** System modification timestamp */
  updatedAt?: string;
}

/**
 * Detailed breakdown of direct expenses for a specific category within an event.
 */
export interface CategoryExpenseBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

/**
 * Event margin metrics for financial analytics and profitability assessment.
 */
export interface EventMarginMetrics {
  /** Event identifier */
  eventId: string;
  /** Event title */
  eventTitle: string;
  /** Event date */
  eventDate: string;
  /** Total collected revenue for this event (sum of active incomes) */
  revenue: number;
  /** Total direct expenses attributed to this event (sum of active expenses) */
  directExpenses: number;
  /** Net operational profit (revenue - directExpenses) */
  netProfit: number;
  /** Profitability percentage ((netProfit / revenue) * 100, or 0 if revenue is 0) */
  marginPercentage: number;
  /** Detailed breakdown by direct expense categories */
  expensesByCategory: CategoryExpenseBreakdown[];
}

/**
 * Natural language / fast text command parsed entity.
 * Supports strings like "3500 лед Корпоратив Т-Банк", "50000 предоплата Свадьба", "-1500 такси нал1".
 */
export interface ParsedCommand {
  /** Extracted positive transaction amount */
  amount: number;
  /** Extracted transaction type (income or expense) */
  type: 'income' | 'expense';
  /** Matched category identifier (if resolved) */
  categoryId?: string;
  /** Human-readable category name */
  categoryName?: string;
  /** Matched event identifier (null if general bar overhead) */
  eventId?: string | null;
  /** Human-readable event title */
  eventTitle?: string | null;
  /** Resolved target or source account identifier */
  accountId: string;
  /** Human-readable account display name */
  accountName?: string;
  /** Transaction description or parsed memo */
  description: string;
  /** Raw unparsed input string */
  rawText: string;
  /** Parsing confidence score (0.0 to 1.0) */
  confidence: number;
  /** Flag indicating whether the expense was marked as general bar expense */
  isGeneralExpense?: boolean;
}

/**
 * Status representation for the Telegram Bot integration and Web Simulator.
 */
export interface BotStatus {
  /** True if the Telegram bot service is enabled and operational */
  enabled: boolean;
  /** Operational mode: polling (long-polling), webhook (production), or mock (simulator) */
  mode: 'polling' | 'webhook' | 'mock';
  /** Telegram bot username (e.g. "@TruespaceFinanceBot") if available */
  botUsername?: string;
  /** Last ping or incoming update timestamp (ISO 8601) */
  lastActiveAt?: string;
  /** Whether BOT_TOKEN environment variable is configured */
  configuredToken: boolean;
  /** Human-readable operational status message */
  message?: string;
}

/**
 * Top-level catering financial overview.
 */
export interface FinancialOverview {
  /** Total consolidated capital across all 5 accounts */
  totalBalance: number;
  /** Total general overhead expenses not linked to specific events */
  generalExpensesTotal: number;
  /** Count of active / tracked events */
  eventsCount: number;
  /** Summary of all accounts */
  accounts: Account[];
}
