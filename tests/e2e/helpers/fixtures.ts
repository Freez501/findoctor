/**
 * Canonical test fixtures for Truespace Bar Catering Financial System.
 * Grounded in ORIGINAL_REQUEST.md §R1, §R4, and PROJECT.md.
 */

export interface AccountFixture {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card_transfer';
  description: string;
  initialBalance: number;
  currentBalance: number;
  currency: 'RUB';
  updatedAt: string;
}

export interface CateringEventFixture {
  id: string;
  title: string;
  clientName?: string;
  eventDate: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  budget?: number;
  guestCount?: number;
  location?: string;
  notes?: string;
}

export interface CategoryFixture {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  color?: string;
  isEventSpecific: boolean;
}

export interface TransactionFixture {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  sourceAccountId?: string;
  targetAccountId?: string;
  categoryId: string;
  eventId?: string | null;
  description?: string;
  transactionDate: string;
  isDeleted: boolean;
}

export const INITIAL_ACCOUNTS: AccountFixture[] = [
  {
    id: 'cash_1',
    name: 'Нал 1 (Касса на площадке)',
    type: 'cash',
    description: 'Касса бара на площадке — размен, чаевые, лёд',
    initialBalance: 25000,
    currentBalance: 25000,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cash_2',
    name: 'Нал 2 (Сейф / Владелец)',
    type: 'cash',
    description: 'Сейф / Владелец — крупные расчеты наличными, гонорары',
    initialBalance: 180000,
    currentBalance: 180000,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bank_1',
    name: 'Безнал 1 (Основной р/с)',
    type: 'bank',
    description: 'Основной р/с кейтеринга — предоплаты по договору',
    initialBalance: 450000,
    currentBalance: 450000,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bank_2',
    name: 'Безнал 2 (Резервный р/с / Эквайринг)',
    type: 'bank',
    description: 'Резервный р/с / Эквайринг на выезде',
    initialBalance: 120000,
    currentBalance: 120000,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'card_sbp',
    name: 'Переводы (Личная карта)',
    type: 'card_transfer',
    description: 'Личная карта — переводы СБП от гостей и клиентов',
    initialBalance: 65000,
    currentBalance: 65000,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_EVENTS: CateringEventFixture[] = [
  {
    id: 'event_wedding',
    title: 'Свадьба Анны и Дмитрия',
    clientName: 'Анна и Дмитрий',
    eventDate: '2026-09-20',
    status: 'active',
    budget: 300000,
    guestCount: 80,
    location: 'Загородный клуб "Лесное"',
    notes: 'Премиальный коктейльный бар, горка шампанского',
  },
  {
    id: 'event_corporate',
    title: 'Корпоратив IT-компании TechCorp',
    clientName: 'TechCorp LLC',
    eventDate: '2026-09-26',
    status: 'active',
    budget: 450000,
    guestCount: 150,
    location: 'Лофт "Красный Октябрь"',
    notes: 'Выездной бар, безалкогольные авторские лимонады, крафтовое пиво',
  },
];

export const INITIAL_CATEGORIES: CategoryFixture[] = [
  { id: 'cat_ice', name: 'Лёд и расходники', type: 'expense', color: '#60a5fa', isEventSpecific: true },
  { id: 'cat_alcohol', name: 'Алкоголь', type: 'expense', color: '#f87171', isEventSpecific: true },
  { id: 'cat_staff', name: 'Персонал (бармены/официанты)', type: 'expense', color: '#fbbf24', isEventSpecific: true },
  { id: 'cat_logistics', name: 'Логистика и аренда посуды', type: 'expense', color: '#a78bfa', isEventSpecific: true },
  { id: 'cat_supplies', name: 'Хозтовары бара', type: 'expense', color: '#9ca3af', isEventSpecific: false },
  { id: 'cat_prepayment', name: 'Предоплата по договору', type: 'income', color: '#34d399', isEventSpecific: true },
  { id: 'cat_final_payment', name: 'Доплата / Финальный расчет', type: 'income', color: '#10b981', isEventSpecific: true },
  { id: 'cat_tips', name: 'Чаевые команды', type: 'income', color: '#f472b6', isEventSpecific: true },
  { id: 'cat_bar_sales', name: 'Продажи на стойке', type: 'income', color: '#38bdf8', isEventSpecific: true },
];

export const CANONICAL_SEED_TRANSACTIONS: TransactionFixture[] = [
  // Свадьба (Event Wedding)
  {
    id: 'tx_seed_01',
    type: 'income',
    amount: 250000,
    targetAccountId: 'bank_1',
    categoryId: 'cat_prepayment',
    eventId: 'event_wedding',
    description: 'Аванс 80% за свадебный бар по договору',
    transactionDate: '2026-09-10T11:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_02',
    type: 'income',
    amount: 50000,
    targetAccountId: 'cash_2',
    categoryId: 'cat_final_payment',
    eventId: 'event_wedding',
    description: 'Остаток оплаты наличными в сейф',
    transactionDate: '2026-09-19T18:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_03',
    type: 'expense',
    amount: 110000,
    sourceAccountId: 'bank_1',
    categoryId: 'cat_alcohol',
    eventId: 'event_wedding',
    description: 'Закупка алкоголя (SimpleWine) для свадьбы',
    transactionDate: '2026-09-12T14:30:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_04',
    type: 'expense',
    amount: 45000,
    sourceAccountId: 'cash_2',
    categoryId: 'cat_staff',
    eventId: 'event_wedding',
    description: 'Оплата работы 3 барменов наличными из сейфа',
    transactionDate: '2026-09-20T23:30:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_05',
    type: 'expense',
    amount: 18000,
    sourceAccountId: 'bank_1',
    categoryId: 'cat_logistics',
    eventId: 'event_wedding',
    description: 'Аренда бокалов и стекла на банкет',
    transactionDate: '2026-09-15T10:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_06',
    type: 'expense',
    amount: 12000,
    sourceAccountId: 'cash_1',
    categoryId: 'cat_ice',
    eventId: 'event_wedding',
    description: 'Лёд глыбы и краш + свежая мята на площадку',
    transactionDate: '2026-09-20T12:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_07',
    type: 'expense',
    amount: 10000,
    sourceAccountId: 'cash_1',
    categoryId: 'cat_logistics',
    eventId: 'event_wedding',
    description: 'Грузовое такси с барной стойкой на площадку и обратно',
    transactionDate: '2026-09-20T09:00:00.000Z',
    isDeleted: false,
  },
  // Корпоратив (Event Corporate)
  {
    id: 'tx_seed_08',
    type: 'income',
    amount: 420000,
    targetAccountId: 'bank_1',
    categoryId: 'cat_prepayment',
    eventId: 'event_corporate',
    description: 'Оплата по счёту 100% за корпоративный кейтеринг',
    transactionDate: '2026-09-18T16:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_09',
    type: 'income',
    amount: 15000,
    targetAccountId: 'card_sbp',
    categoryId: 'cat_tips',
    eventId: 'event_corporate',
    description: 'Чаевые барменам от заказчика по СБП',
    transactionDate: '2026-09-26T22:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_10',
    type: 'expense',
    amount: 160000,
    sourceAccountId: 'bank_1',
    categoryId: 'cat_alcohol',
    eventId: 'event_corporate',
    description: 'Премиум алкоголь (виски, джин, кордиалы)',
    transactionDate: '2026-09-22T15:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_11',
    type: 'expense',
    amount: 60000,
    sourceAccountId: 'cash_2',
    categoryId: 'cat_staff',
    eventId: 'event_corporate',
    description: 'Гонорары 4 барменов + шеф-бартендер',
    transactionDate: '2026-09-26T23:50:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_12',
    type: 'expense',
    amount: 25000,
    sourceAccountId: 'cash_1',
    categoryId: 'cat_ice',
    eventId: 'event_corporate',
    description: 'Сухой лёд, глыбы, сиропы, свежие цитрусы',
    transactionDate: '2026-09-26T11:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_13',
    type: 'expense',
    amount: 20000,
    sourceAccountId: 'card_sbp',
    categoryId: 'cat_logistics',
    eventId: 'event_corporate',
    description: 'Монтаж светящейся барной стойки и доставка',
    transactionDate: '2026-09-26T10:00:00.000Z',
    isDeleted: false,
  },
  // Общие расходы бара (eventId: null)
  {
    id: 'tx_seed_14',
    type: 'expense',
    amount: 35000,
    sourceAccountId: 'bank_1',
    categoryId: 'cat_supplies',
    eventId: null,
    description: 'Ежемесячная аренда склада инвентаря и посуды',
    transactionDate: '2026-09-01T09:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_15',
    type: 'expense',
    amount: 8000,
    sourceAccountId: 'cash_1',
    categoryId: 'cat_supplies',
    eventId: null,
    description: 'Новые барные ложки, джиггеры, салфетки',
    transactionDate: '2026-09-05T12:00:00.000Z',
    isDeleted: false,
  },
  // Внутренние переводы между счетами (transfers)
  {
    id: 'tx_seed_16',
    type: 'transfer',
    amount: 30000,
    sourceAccountId: 'bank_1',
    targetAccountId: 'cash_2',
    categoryId: 'cat_supplies',
    eventId: null,
    description: 'Снятие наличных с р/с в сейф на размен и авансы',
    transactionDate: '2026-09-08T13:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_17',
    type: 'transfer',
    amount: 20000,
    sourceAccountId: 'cash_2',
    targetAccountId: 'cash_1',
    categoryId: 'cat_supplies',
    eventId: null,
    description: 'Выдача размена из сейфа в кассу площадки',
    transactionDate: '2026-09-19T10:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'tx_seed_18',
    type: 'transfer',
    amount: 15000,
    sourceAccountId: 'card_sbp',
    targetAccountId: 'bank_1',
    categoryId: 'cat_supplies',
    eventId: null,
    description: 'Перевод полученных чаевых/предоплаты с карты на р/с',
    transactionDate: '2026-09-21T11:00:00.000Z',
    isDeleted: false,
  },
];
