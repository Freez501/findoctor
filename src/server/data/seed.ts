/**
 * Truespace — Барный кейтеринг и финансы
 * Pre-seeded Canonical Demo Data (`src/server/data/seed.ts`)
 *
 * 5 Accounts (840 000 ₽ initial capital), 2 Events, 12 Categories, 21 Transactions
 * Final capital after 21 transactions: exactly 1 166 300 ₽.
 */

import { Account, CateringEvent, Category, Transaction, Partner, Company, UserProfile, CompanyMembership } from '../../shared/types.js';
import {
  ACCOUNT_IDS,
  INITIAL_ACCOUNTS_SEED,
  EVENT_IDS,
  INITIAL_EVENTS_SEED,
  CATEGORY_IDS,
  INITIAL_CATEGORIES_SEED,
  INITIAL_PARTNERS_SEED,
  INITIAL_COMPANIES_SEED,
  INITIAL_USERS_SEED,
  INITIAL_MEMBERSHIPS_SEED,
} from '../../shared/constants.js';

/**
 * 21 Canonical Seed Transactions
 */
export const SEED_TRANSACTIONS: readonly Transaction[] = [
  {
    id: 'tx-001',
    type: 'income',
    amount: 130000,
    fromAccountId: null,
    toAccountId: ACCOUNT_IDS.BANK_1,
    categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
    eventId: EVENT_IDS.WEDDING,
    description: 'Предоплата 50% по договору №24-СВ от жениха',
    transactionDate: '2026-09-10T11:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-10T11:00:00Z',
    updatedAt: '2026-09-10T11:00:00Z',
  },
  {
    id: 'tx-002',
    type: 'expense',
    amount: 48000,
    fromAccountId: ACCOUNT_IDS.BANK_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.ALCOHOL,
    eventId: EVENT_IDS.WEDDING,
    description: 'Оптовая закупка джина, рома, вермута и просекко в SimpleWine',
    transactionDate: '2026-09-12T14:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-12T14:30:00Z',
    updatedAt: '2026-09-12T14:30:00Z',
  },
  {
    id: 'tx-003',
    type: 'income',
    amount: 294000,
    fromAccountId: null,
    toAccountId: ACCOUNT_IDS.BANK_1,
    categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
    eventId: EVENT_IDS.CORPORATE,
    description: 'Аванс 70% от ООО «НексаТек» по счёту №88',
    transactionDate: '2026-09-13T16:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-13T16:00:00Z',
    updatedAt: '2026-09-13T16:00:00Z',
  },
  {
    id: 'tx-004',
    type: 'expense',
    amount: 85000,
    fromAccountId: ACCOUNT_IDS.BANK_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.ALCOHOL,
    eventId: EVENT_IDS.CORPORATE,
    description: 'Закупка премиального виски, бурбона и тоников под бренд-коктейли',
    transactionDate: '2026-09-14T10:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-14T10:00:00Z',
    updatedAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'tx-005',
    type: 'transfer',
    amount: 30000,
    fromAccountId: ACCOUNT_IDS.CASH_2,
    toAccountId: ACCOUNT_IDS.CASH_1,
    categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
    eventId: null,
    description: 'Пополнение кассы площадки разменными купюрами перед уикендом',
    transactionDate: '2026-09-15T11:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-15T11:30:00Z',
    updatedAt: '2026-09-15T11:30:00Z',
  },
  {
    id: 'tx-006',
    type: 'expense',
    amount: 22000,
    fromAccountId: ACCOUNT_IDS.BANK_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.EQUIPMENT,
    eventId: EVENT_IDS.CORPORATE,
    description: 'Аренда дизайнерской светящейся стойки и бокалов шале в RentBar',
    transactionDate: '2026-09-15T12:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-15T12:00:00Z',
    updatedAt: '2026-09-15T12:00:00Z',
  },
  {
    id: 'tx-007',
    type: 'expense',
    amount: 35000,
    fromAccountId: ACCOUNT_IDS.BANK_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.OVERHEAD,
    eventId: null,
    description: 'Ежемесячная аренда заготовочного цеха и склада инвентаря',
    transactionDate: '2026-09-15T15:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-15T15:30:00Z',
    updatedAt: '2026-09-15T15:30:00Z',
  },
  {
    id: 'tx-008',
    type: 'expense',
    amount: 16000,
    fromAccountId: ACCOUNT_IDS.CASH_2,
    toAccountId: null,
    categoryId: CATEGORY_IDS.STAFF,
    eventId: EVENT_IDS.WEDDING,
    description: 'Аванс шеф-бармену и бартендеру наличными из сейфа',
    transactionDate: '2026-09-15T17:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-15T17:00:00Z',
    updatedAt: '2026-09-15T17:00:00Z',
  },
  {
    id: 'tx-009',
    type: 'expense',
    amount: 8500,
    fromAccountId: ACCOUNT_IDS.CARD_SBP,
    toAccountId: null,
    categoryId: CATEGORY_IDS.LOGISTICS,
    eventId: EVENT_IDS.WEDDING,
    description: 'Грузовое такси: перевозка стойки и стекла в усадьбу «Лесной Берег»',
    transactionDate: '2026-09-15T18:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-15T18:30:00Z',
    updatedAt: '2026-09-15T18:30:00Z',
  },
  {
    id: 'tx-010',
    type: 'transfer',
    amount: 50000,
    fromAccountId: ACCOUNT_IDS.BANK_1,
    toAccountId: ACCOUNT_IDS.CASH_2,
    categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
    eventId: null,
    description: 'Снятие наличных со счёта в сейф на зарплатный фонд команды',
    transactionDate: '2026-09-16T09:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T09:30:00Z',
    updatedAt: '2026-09-16T09:30:00Z',
  },
  {
    id: 'tx-011',
    type: 'expense',
    amount: 9500,
    fromAccountId: ACCOUNT_IDS.CARD_SBP,
    toAccountId: null,
    categoryId: CATEGORY_IDS.SUPPLIES,
    eventId: EVENT_IDS.CORPORATE,
    description: 'Заказ 200 прозрачных ледяных сфер в термобоксах (LumiIce)',
    transactionDate: '2026-09-16T11:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T11:00:00Z',
    updatedAt: '2026-09-16T11:00:00Z',
  },
  {
    id: 'tx-012',
    type: 'expense',
    amount: 12500,
    fromAccountId: ACCOUNT_IDS.CASH_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.SUPPLIES,
    eventId: EVENT_IDS.WEDDING,
    description: 'Покупка ягод, маракуйи, свежей мяты и пищевого льда на Фуд-Сити',
    transactionDate: '2026-09-16T13:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T13:00:00Z',
    updatedAt: '2026-09-16T13:00:00Z',
  },
  {
    id: 'tx-013',
    type: 'expense',
    amount: 4200,
    fromAccountId: ACCOUNT_IDS.CASH_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.INVENTORY,
    eventId: null,
    description: 'Новые джиггеры, гейзеры и запас салфеток для бара',
    transactionDate: '2026-09-16T15:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T15:00:00Z',
    updatedAt: '2026-09-16T15:00:00Z',
  },
  {
    id: 'tx-014',
    type: 'expense',
    amount: 7000,
    fromAccountId: ACCOUNT_IDS.CASH_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.LOGISTICS,
    eventId: EVENT_IDS.CORPORATE,
    description: 'Грузовой каршеринг и грузчики для заезда в лофт Красный Октябрь',
    transactionDate: '2026-09-16T16:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T16:30:00Z',
    updatedAt: '2026-09-16T16:30:00Z',
  },
  {
    id: 'tx-015',
    type: 'income',
    amount: 130000,
    fromAccountId: null,
    toAccountId: ACCOUNT_IDS.BANK_1,
    categoryId: CATEGORY_IDS.CONTRACT_FINAL,
    eventId: EVENT_IDS.WEDDING,
    description: 'Окончательный платёж 50% по договору №24-СВ перед мероприятием',
    transactionDate: '2026-09-16T17:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T17:00:00Z',
    updatedAt: '2026-09-16T17:00:00Z',
  },
  {
    id: 'tx-016',
    type: 'income',
    amount: 18000,
    fromAccountId: null,
    toAccountId: ACCOUNT_IDS.CARD_SBP,
    categoryId: CATEGORY_IDS.ONSITE_SALES,
    eventId: EVENT_IDS.WEDDING,
    description: 'Доплата заказчика через СБП за продление работы бара на 1 час',
    transactionDate: '2026-09-16T19:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T19:30:00Z',
    updatedAt: '2026-09-16T19:30:00Z',
  },
  {
    id: 'tx-017',
    type: 'income',
    amount: 12000,
    fromAccountId: null,
    toAccountId: ACCOUNT_IDS.BANK_2,
    categoryId: CATEGORY_IDS.ONSITE_SALES,
    eventId: EVENT_IDS.WEDDING,
    description: 'Оплата гостями шотов через выездной эквайринг-терминал',
    transactionDate: '2026-09-16T21:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T21:00:00Z',
    updatedAt: '2026-09-16T21:00:00Z',
  },
  {
    id: 'tx-018',
    type: 'expense',
    amount: 10000,
    fromAccountId: ACCOUNT_IDS.CASH_1,
    toAccountId: null,
    categoryId: CATEGORY_IDS.STAFF,
    eventId: EVENT_IDS.WEDDING,
    description: 'Финальный расчёт помощников бармена и барбэка наличными',
    transactionDate: '2026-09-16T22:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T22:00:00Z',
    updatedAt: '2026-09-16T22:00:00Z',
  },
  {
    id: 'tx-019',
    type: 'transfer',
    amount: 30000,
    fromAccountId: ACCOUNT_IDS.CARD_SBP,
    toAccountId: ACCOUNT_IDS.BANK_1,
    categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
    eventId: null,
    description: 'Перевод накопленных клиентских платежей с личной карты на р/с',
    transactionDate: '2026-09-16T22:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T22:30:00Z',
    updatedAt: '2026-09-16T22:30:00Z',
  },
  {
    id: 'tx-020',
    type: 'transfer',
    amount: 20000,
    fromAccountId: ACCOUNT_IDS.BANK_2,
    toAccountId: ACCOUNT_IDS.BANK_1,
    categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
    eventId: null,
    description: 'Перечисление выручки с терминала эквайринга на основной счёт',
    transactionDate: '2026-09-16T23:00:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T23:00:00Z',
    updatedAt: '2026-09-16T23:00:00Z',
  },
  {
    id: 'tx-021',
    type: 'transfer',
    amount: 15000,
    fromAccountId: ACCOUNT_IDS.CASH_1,
    toAccountId: ACCOUNT_IDS.CASH_2,
    categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
    eventId: null,
    description: 'Инкассация остатка наличных с площадки в сейф владельца',
    transactionDate: '2026-09-16T23:30:00Z',
    isDeleted: false,
    createdAt: '2026-09-16T23:30:00Z',
    updatedAt: '2026-09-16T23:30:00Z',
  },
];

/**
 * Expected calculated balances after 21 transactions:
 * cash_1: 6,300 ₽
 * cash_2: 199,000 ₽
 * bank_1: 814,000 ₽
 * bank_2: 112,000 ₽
 * card_sbp: 35,000 ₽
 * Total: 1,166,300 ₽
 */
export const POST_SEED_ACCOUNTS: readonly Account[] = [
  {
    ...INITIAL_ACCOUNTS_SEED[0],
    currentBalance: 6300,
    updatedAt: '2026-09-16T23:30:00Z',
  },
  {
    ...INITIAL_ACCOUNTS_SEED[1],
    currentBalance: 199000,
    updatedAt: '2026-09-16T23:30:00Z',
  },
  {
    ...INITIAL_ACCOUNTS_SEED[2],
    currentBalance: 814000,
    updatedAt: '2026-09-16T23:30:00Z',
  },
  {
    ...INITIAL_ACCOUNTS_SEED[3],
    currentBalance: 112000,
    updatedAt: '2026-09-16T23:30:00Z',
  },
  {
    ...INITIAL_ACCOUNTS_SEED[4],
    currentBalance: 35000,
    updatedAt: '2026-09-16T23:30:00Z',
  },
];

export function getInitialAccounts(): Account[] {
  return JSON.parse(JSON.stringify(POST_SEED_ACCOUNTS));
}

export function getRawInitialAccounts(): Account[] {
  return JSON.parse(JSON.stringify(INITIAL_ACCOUNTS_SEED));
}

export function getInitialEvents(): CateringEvent[] {
  return JSON.parse(JSON.stringify(INITIAL_EVENTS_SEED));
}

export function getInitialCategories(): Category[] {
  return JSON.parse(JSON.stringify(INITIAL_CATEGORIES_SEED));
}

export function getInitialPartners(): Partner[] {
  return JSON.parse(JSON.stringify(INITIAL_PARTNERS_SEED));
}

export function getInitialCompanies(): Company[] {
  return JSON.parse(JSON.stringify(INITIAL_COMPANIES_SEED));
}

export function getInitialUsers(): UserProfile[] {
  return JSON.parse(JSON.stringify(INITIAL_USERS_SEED));
}

export function getInitialMemberships(): CompanyMembership[] {
  return JSON.parse(JSON.stringify(INITIAL_MEMBERSHIPS_SEED));
}

export function getSeedTransactions(): Transaction[] {
  return JSON.parse(JSON.stringify(SEED_TRANSACTIONS));
}

export interface DatabaseState {
  companies?: Company[];
  users?: UserProfile[];
  memberships?: CompanyMembership[];
  accounts: Account[];
  events: CateringEvent[];
  categories: Category[];
  partners: Partner[];
  transactions: Transaction[];
}

export function createInitialDatabaseState(): DatabaseState {
  return {
    companies: getInitialCompanies(),
    users: getInitialUsers(),
    memberships: getInitialMemberships(),
    accounts: getInitialAccounts(),
    events: getInitialEvents(),
    categories: getInitialCategories(),
    partners: getInitialPartners(),
    transactions: getSeedTransactions(),
  };
}
