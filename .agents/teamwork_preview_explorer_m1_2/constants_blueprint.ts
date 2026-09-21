/**
 * Truespace — Барный кейтеринг и финансы
 * System Constants & Metadata (`src/shared/constants.ts`)
 *
 * Authoritative identifiers, default values, metadata lists, and parser dictionaries.
 */

import { Account, AccountType, Category, CateringEvent } from './types_blueprint';

// ==========================================
// 1. ACCOUNT CONSTANTS
// ==========================================

export const ACCOUNT_IDS = {
  CASH_1: 'cash_1',     // Нал 1 (Касса на площадке)
  CASH_2: 'cash_2',     // Нал 2 (Сейф / Владелец)
  BANK_1: 'bank_1',     // Безнал 1 (Основной р/с)
  BANK_2: 'bank_2',     // Безнал 2 (Резерв / Эквайринг)
  CARD_SBP: 'card_sbp', // Переводы (Карта СБП)
} as const;

export type AccountId = typeof ACCOUNT_IDS[keyof typeof ACCOUNT_IDS];

export const VALID_ACCOUNT_IDS: readonly string[] = Object.values(ACCOUNT_IDS);

export const DEFAULT_ACCOUNT_ID: AccountId = ACCOUNT_IDS.CASH_1;

export const INITIAL_ACCOUNTS_SEED: readonly Account[] = [
  {
    id: ACCOUNT_IDS.CASH_1,
    name: 'Нал 1 (Касса на площадке)',
    type: 'cash',
    initialBalance: 25000,
    currentBalance: 25000,
    currency: 'RUB',
    description: 'Разменная касса барменов на площадке, чаевые, мелкие чеки (лёд, мята)',
    isActive: true,
    updatedAt: '2026-09-10T10:00:00Z',
  },
  {
    id: ACCOUNT_IDS.CASH_2,
    name: 'Нал 2 (Сейф / Владелец)',
    type: 'cash',
    initialBalance: 180000,
    currentBalance: 180000,
    currency: 'RUB',
    description: 'Сейф в офисе: расчёты наличными, гонорары барменов, резерв наличных',
    isActive: true,
    updatedAt: '2026-09-10T10:00:00Z',
  },
  {
    id: ACCOUNT_IDS.BANK_1,
    name: 'Безнал 1 (Основной р/с)',
    type: 'bank',
    initialBalance: 450000,
    currentBalance: 450000,
    currency: 'RUB',
    description: 'Расчётный счёт кейтеринга в банке (договоры с юрлицами, оптовые закупки алкоголя)',
    isActive: true,
    updatedAt: '2026-09-10T10:00:00Z',
  },
  {
    id: ACCOUNT_IDS.BANK_2,
    name: 'Безнал 2 (Резерв / Эквайринг)',
    type: 'bank',
    initialBalance: 120000,
    currentBalance: 120000,
    currency: 'RUB',
    description: 'Торговый эквайринг на выезде (терминал на стойке) и резервный расчётный счёт',
    isActive: true,
    updatedAt: '2026-09-10T10:00:00Z',
  },
  {
    id: ACCOUNT_IDS.CARD_SBP,
    name: 'Переводы (Карта СБП)',
    type: 'card',
    initialBalance: 65000,
    currentBalance: 65000,
    currency: 'RUB',
    description: 'Личная карта шеф-бармена для мгновенных оплат по СБП и срочных оплат такси',
    isActive: true,
    updatedAt: '2026-09-10T10:00:00Z',
  },
] as const;

export const INITIAL_TOTAL_CAPITAL = 840000; // 25k + 180k + 450k + 120k + 65k

// ==========================================
// 2. CATEGORY CONSTANTS
// ==========================================

export const CATEGORY_IDS = {
  // Income categories
  CONTRACT_PREPAYMENT: 'contract_prepayment',
  CONTRACT_FINAL: 'contract_final',
  ONSITE_SALES: 'onsite_sales',
  TIPS: 'tips',
  // Expense categories (direct event expenses)
  ALCOHOL: 'alcohol',
  STAFF: 'staff',
  LOGISTICS: 'logistics',
  SUPPLIES: 'supplies',
  EQUIPMENT: 'equipment',
  // Expense categories (general bar overhead)
  OVERHEAD: 'overhead',
  INVENTORY: 'inventory',
  // System internal transfer
  TRANSFER_INTERNAL: 'transfer_internal',
} as const;

export type CategoryId = typeof CATEGORY_IDS[keyof typeof CATEGORY_IDS];

export const VALID_CATEGORY_IDS: readonly string[] = Object.values(CATEGORY_IDS);

export const DEFAULT_EXPENSE_CATEGORY_ID: CategoryId = CATEGORY_IDS.SUPPLIES;
export const DEFAULT_INCOME_CATEGORY_ID: CategoryId = CATEGORY_IDS.ONSITE_SALES;

export const INITIAL_CATEGORIES_SEED: readonly Category[] = [
  {
    id: CATEGORY_IDS.CONTRACT_PREPAYMENT,
    name: 'Предоплата по договору',
    type: 'income',
    color: '#10b981', // Emerald green
    icon: 'file-check',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.CONTRACT_FINAL,
    name: 'Финальная оплата',
    type: 'income',
    color: '#059669', // Deep emerald
    icon: 'badge-check',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.ONSITE_SALES,
    name: 'Продажи на площадке / Доплата',
    type: 'income',
    color: '#0ea5e9', // Sky blue
    icon: 'credit-card',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.TIPS,
    name: 'Чаевые команды',
    type: 'income',
    color: '#8b5cf6', // Violet
    icon: 'sparkles',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.ALCOHOL,
    name: 'Алкоголь и напитки',
    type: 'expense',
    color: '#ef4444', // Red
    icon: 'wine',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.STAFF,
    name: 'Персонал и гонорары',
    type: 'expense',
    color: '#f97316', // Orange
    icon: 'users',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.LOGISTICS,
    name: 'Логистика и транспорт',
    type: 'expense',
    color: '#eab308', // Amber
    icon: 'truck',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.SUPPLIES,
    name: 'Лёд и продукты',
    type: 'expense',
    color: '#06b6d4', // Cyan
    icon: 'snowflake',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.EQUIPMENT,
    name: 'Аренда оборудования',
    type: 'expense',
    color: '#a855f7', // Purple
    icon: 'box',
    isEventSpecific: true,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.OVERHEAD,
    name: 'Аренда склада / Общехозяйственные',
    type: 'expense',
    color: '#64748b', // Slate
    icon: 'warehouse',
    isEventSpecific: false,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.INVENTORY,
    name: 'Инвентарь и хозтовары',
    type: 'expense',
    color: '#475569', // Dark Slate
    icon: 'wrench',
    isEventSpecific: false,
    isSystem: true,
  },
  {
    id: CATEGORY_IDS.TRANSFER_INTERNAL,
    name: 'Внутренний перевод',
    type: 'transfer',
    color: '#6366f1', // Indigo
    icon: 'arrow-left-right',
    isEventSpecific: false,
    isSystem: true,
  },
] as const;

/**
 * Quick Category Selectors (R2 requirement: 6 primary chips for 5-sec mobile entry)
 */
export const QUICK_CATEGORY_CHIPS: readonly { id: CategoryId; name: string; type: 'expense' | 'income' }[] = [
  { id: CATEGORY_IDS.SUPPLIES, name: 'Лёд и продукты', type: 'expense' },
  { id: CATEGORY_IDS.ALCOHOL, name: 'Алкоголь', type: 'expense' },
  { id: CATEGORY_IDS.STAFF, name: 'Персонал', type: 'expense' },
  { id: CATEGORY_IDS.LOGISTICS, name: 'Логистика', type: 'expense' },
  { id: CATEGORY_IDS.ONSITE_SALES, name: 'Доплата/Продажи', type: 'income' },
  { id: CATEGORY_IDS.TIPS, name: 'Чаевые', type: 'income' },
] as const;

// ==========================================
// 3. EVENT CONSTANTS
// ==========================================

export const EVENT_IDS = {
  WEDDING: 'event-wedding',
  CORPORATE: 'event-corporate',
} as const;

export type EventId = typeof EVENT_IDS[keyof typeof EVENT_IDS];

export const INITIAL_EVENTS_SEED: readonly CateringEvent[] = [
  {
    id: EVENT_IDS.WEDDING,
    title: 'Свадьба Артёма и Анны',
    eventDate: '2026-09-20',
    status: 'active',
    budget: 290000,
    guestCount: 60,
    location: 'Усадьба «Лесной Берег», шатёр у озера',
    notes: 'Авторский коктейльный бар, 350 порций коктейлей, горка шампанского',
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-16T23:30:00Z',
  },
  {
    id: EVENT_IDS.CORPORATE,
    title: 'Летний корпоратив NexaTech',
    eventDate: '2026-09-25',
    status: 'planned',
    budget: 420000,
    guestCount: 120,
    location: 'Лофт «Красный Октябрь», зал «Сфера»',
    notes: 'Тематический интерактивный бар + велком-зона, брендированные коктейли',
    createdAt: '2026-09-12T10:00:00Z',
    updatedAt: '2026-09-16T23:30:00Z',
  },
] as const;

// ==========================================
// 4. FINANCIAL & MARGIN RULES
// ==========================================

export const CURRENCY = 'RUB' as const;
export const CURRENCY_SYMBOL = '₽' as const;
export const DEFAULT_LOCALE = 'ru-RU' as const;

/**
 * Profitability Margin Thresholds (in percent)
 * >= 60% : High (Green) - Premium catering standard
 * 40%..60% : Medium (Yellow) - Standard banquet standard
 * 0%..40% : Low / Risk (Red) - Requires review
 * < 0% : Operational Loss (Dark Red)
 */
export const MARGIN_THRESHOLDS = {
  HIGH: 60,
  MEDIUM: 40,
} as const;

export type MarginRating = 'high' | 'medium' | 'low' | 'loss' | 'no_revenue';

export function getMarginRating(marginPercentage: number, revenue: number): MarginRating {
  if (revenue <= 0) return 'no_revenue';
  if (marginPercentage >= MARGIN_THRESHOLDS.HIGH) return 'high';
  if (marginPercentage >= MARGIN_THRESHOLDS.MEDIUM) return 'medium';
  if (marginPercentage >= 0) return 'low';
  return 'loss';
}

// ==========================================
// 5. NLP & FAST COMMAND PARSER DICTIONARIES
// ==========================================

export const ACCOUNT_KEYWORD_MAP: Record<string, AccountId> = {
  // cash_1
  'нал': ACCOUNT_IDS.CASH_1,
  'нал1': ACCOUNT_IDS.CASH_1,
  'нал 1': ACCOUNT_IDS.CASH_1,
  'касса': ACCOUNT_IDS.CASH_1,
  'площадка': ACCOUNT_IDS.CASH_1,
  'бар': ACCOUNT_IDS.CASH_1,
  'наличные': ACCOUNT_IDS.CASH_1,
  'наличка': ACCOUNT_IDS.CASH_1,

  // cash_2
  'сейф': ACCOUNT_IDS.CASH_2,
  'нал2': ACCOUNT_IDS.CASH_2,
  'нал 2': ACCOUNT_IDS.CASH_2,
  'владелец': ACCOUNT_IDS.CASH_2,
  'шеф': ACCOUNT_IDS.CASH_2,
  'офис': ACCOUNT_IDS.CASH_2,

  // bank_1
  'безнал': ACCOUNT_IDS.BANK_1,
  'безнал1': ACCOUNT_IDS.BANK_1,
  'безнал 1': ACCOUNT_IDS.BANK_1,
  'р/с': ACCOUNT_IDS.BANK_1,
  'рс': ACCOUNT_IDS.BANK_1,
  'счет': ACCOUNT_IDS.BANK_1,
  'счёт': ACCOUNT_IDS.BANK_1,
  'банк': ACCOUNT_IDS.BANK_1,
  'банк1': ACCOUNT_IDS.BANK_1,
  'банк 1': ACCOUNT_IDS.BANK_1,
  'основной': ACCOUNT_IDS.BANK_1,

  // bank_2
  'безнал2': ACCOUNT_IDS.BANK_2,
  'безнал 2': ACCOUNT_IDS.BANK_2,
  'эквайринг': ACCOUNT_IDS.BANK_2,
  'терминал': ACCOUNT_IDS.BANK_2,
  'банк2': ACCOUNT_IDS.BANK_2,
  'банк 2': ACCOUNT_IDS.BANK_2,
  'резерв': ACCOUNT_IDS.BANK_2,

  // card_sbp
  'сбп': ACCOUNT_IDS.CARD_SBP,
  'перевод': ACCOUNT_IDS.CARD_SBP,
  'переводы': ACCOUNT_IDS.CARD_SBP,
  'карта': ACCOUNT_IDS.CARD_SBP,
  'тинькофф': ACCOUNT_IDS.CARD_SBP,
  'тинькоф': ACCOUNT_IDS.CARD_SBP,
  'т-банк': ACCOUNT_IDS.CARD_SBP,
  'тбанк': ACCOUNT_IDS.CARD_SBP,
  'сбер': ACCOUNT_IDS.CARD_SBP,
};

export const CATEGORY_KEYWORD_MAP: Record<string, { categoryId: CategoryId; type: 'income' | 'expense' }> = {
  // Supplies
  'лед': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'лёд': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'продукты': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'мята': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'фрукты': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'лимоны': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'сироп': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'сиропы': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'пюре': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'сок': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'соки': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },
  'ягоды': { categoryId: CATEGORY_IDS.SUPPLIES, type: 'expense' },

  // Alcohol
  'алко': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'алкоголь': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'водка': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'джин': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'ром': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'виски': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'текила': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'вино': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'просекко': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'шампанское': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'пиво': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'тоник': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'ликер': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },
  'биттер': { categoryId: CATEGORY_IDS.ALCOHOL, type: 'expense' },

  // Staff
  'персонал': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'бармен': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'бармены': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'барбэк': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'грузчик': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'грузчики': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'гонорар': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'зарплата': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'аванс': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },
  'ставка': { categoryId: CATEGORY_IDS.STAFF, type: 'expense' },

  // Logistics
  'логистика': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'такси': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'доставка': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'грузовик': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'газель': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'каршеринг': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },
  'бензин': { categoryId: CATEGORY_IDS.LOGISTICS, type: 'expense' },

  // Equipment
  'оборудование': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },
  'аренда': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },
  'стойка': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },
  'посуда': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },
  'бокалы': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },
  'стекло': { categoryId: CATEGORY_IDS.EQUIPMENT, type: 'expense' },

  // Overhead & Inventory (General bar)
  'склад': { categoryId: CATEGORY_IDS.OVERHEAD, type: 'expense' },
  'инвентарь': { categoryId: CATEGORY_IDS.INVENTORY, type: 'expense' },
  'джиггер': { categoryId: CATEGORY_IDS.INVENTORY, type: 'expense' },
  'шейкер': { categoryId: CATEGORY_IDS.INVENTORY, type: 'expense' },
  'салфетки': { categoryId: CATEGORY_IDS.INVENTORY, type: 'expense' },
  'хозтовары': { categoryId: CATEGORY_IDS.INVENTORY, type: 'expense' },

  // Income
  'предоплата': { categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT, type: 'income' },
  'договор': { categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT, type: 'income' },
  'оплата': { categoryId: CATEGORY_IDS.CONTRACT_FINAL, type: 'income' },
  'финал': { categoryId: CATEGORY_IDS.CONTRACT_FINAL, type: 'income' },
  'доплата': { categoryId: CATEGORY_IDS.ONSITE_SALES, type: 'income' },
  'шоты': { categoryId: CATEGORY_IDS.ONSITE_SALES, type: 'income' },
  'коктейли': { categoryId: CATEGORY_IDS.ONSITE_SALES, type: 'income' },
  'продажи': { categoryId: CATEGORY_IDS.ONSITE_SALES, type: 'income' },
  'чай': { categoryId: CATEGORY_IDS.TIPS, type: 'income' },
  'чаевые': { categoryId: CATEGORY_IDS.TIPS, type: 'income' },
};

export const EVENT_KEYWORD_MAP: Record<string, EventId> = {
  'свадьба': EVENT_IDS.WEDDING,
  'свадьбу': EVENT_IDS.WEDDING,
  'свадьбе': EVENT_IDS.WEDDING,
  'артем': EVENT_IDS.WEDDING,
  'артём': EVENT_IDS.WEDDING,
  'анна': EVENT_IDS.WEDDING,
  'wedding': EVENT_IDS.WEDDING,

  'корпоратив': EVENT_IDS.CORPORATE,
  'корпорат': EVENT_IDS.CORPORATE,
  'нексатек': EVENT_IDS.CORPORATE,
  'nexatech': EVENT_IDS.CORPORATE,
  'nexa': EVENT_IDS.CORPORATE,
  'corporate': EVENT_IDS.CORPORATE,
};
