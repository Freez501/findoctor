import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { ACCOUNT_IDS, EVENT_IDS } from '../../src/shared/constants.js';

describe('Milestone M2: Backend REST API Integration Tests', () => {
  let app: any;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    app = createApp({ store });
  });

  // =========================================================================
  // 1. SYSTEM & HEALTH
  // =========================================================================
  describe('System & Health Endpoints', () => {
    it('GET /api/health should return ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('truespace-backend');
    });

    it('POST /api/system/reset-demo should restore pristine seed data', async () => {
      // Mutate state
      await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 5000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: 'cat_ice',
        });

      // Reset
      const res = await request(app).post('/api/system/reset-demo');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('успешно сброшены');

      // Check balance restored to 6,300 ₽
      const accRes = await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`);
      expect(accRes.body.account.currentBalance).toBe(6300);
    });
  });

  // =========================================================================
  // 2. ACCOUNTS
  // =========================================================================
  describe('Accounts Endpoints', () => {
    it('GET /api/accounts should return 5 accounts and consolidated capital 1,166,300 ₽', async () => {
      const res = await request(app).get('/api/accounts');
      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(5);
      expect(res.body.totalBalance).toBe(1166300);

      const cash1 = res.body.accounts.find((a: any) => a.id === ACCOUNT_IDS.CASH_1);
      expect(cash1).toBeDefined();
      expect(cash1.currentBalance).toBe(6300);
    });

    it('GET /api/accounts/:id should return single account details', async () => {
      const res = await request(app).get(`/api/accounts/${ACCOUNT_IDS.BANK_1}`);
      expect(res.status).toBe(200);
      expect(res.body.account.id).toBe(ACCOUNT_IDS.BANK_1);
      expect(res.body.account.currentBalance).toBe(814000);
    });

    it('GET /api/accounts/:id should return 404 for unknown account', async () => {
      const res = await request(app).get('/api/accounts/non_existent_account');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('не найден');
    });
  });

  // =========================================================================
  // 3. EVENTS
  // =========================================================================
  describe('Events Endpoints', () => {
    it('GET /api/events should list all catering events', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      expect(res.body.events.some((e: any) => e.title.includes('Свадьба'))).toBe(true);
    });

    it('GET /api/events/:id should return event details or 404', async () => {
      const res = await request(app).get(`/api/events/${EVENT_IDS.WEDDING}`);
      expect(res.status).toBe(200);
      expect(res.body.event.id).toBe(EVENT_IDS.WEDDING);

      const notFound = await request(app).get('/api/events/unknown_event');
      expect(notFound.status).toBe(404);
    });

    it('POST /api/events should create a new catering event', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Коктейльная вечеринка в лофте',
          eventDate: '2026-10-10',
          budget: 180000,
          guestCount: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.event.title).toBe('Коктейльная вечеринка в лофте');
      expect(res.body.event.id).toBeDefined();
    });

    it('POST /api/events should reject invalid event payload with 400', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: '', // Missing title
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // 4. CATEGORIES
  // =========================================================================
  describe('Categories Endpoints', () => {
    it('GET /api/categories should return all categories', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBeGreaterThanOrEqual(9);
    });

    it('GET /api/categories/:id should return single category or 404', async () => {
      const res = await request(app).get('/api/categories/alcohol');
      expect(res.status).toBe(200);
      expect(res.body.category.name).toContain('Алкоголь');

      const notFound = await request(app).get('/api/categories/unknown_category');
      expect(notFound.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. TRANSACTIONS & OPERATIONS
  // =========================================================================
  describe('Transactions Endpoints', () => {
    it('GET /api/transactions should return active transactions and support filtering', async () => {
      const resAll = await request(app).get('/api/transactions');
      expect(resAll.status).toBe(200);
      expect(resAll.body.transactions).toHaveLength(21);

      const resFilterAcc = await request(app).get(`/api/transactions?accountId=${ACCOUNT_IDS.CASH_1}`);
      expect(resFilterAcc.status).toBe(200);
      expect(resFilterAcc.body.transactions.length).toBeGreaterThan(0);
      for (const tx of resFilterAcc.body.transactions) {
        expect(tx.sourceAccountId === ACCOUNT_IDS.CASH_1 || tx.targetAccountId === ACCOUNT_IDS.CASH_1).toBe(true);
      }
    });

    it('POST /api/transactions should record an expense and debit source account', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 4500,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: 'cat_ice',
          description: 'Лёд и мята',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.amount).toBe(4500);
      expect(res.body.transaction.type).toBe('expense');
      expect(res.body.updatedAccounts).toHaveLength(1);
      expect(res.body.updatedAccounts[0].currentBalance).toBe(6300 - 4500); // 1800
    });

    it('POST /api/transactions should record an income and credit target account', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'income',
          amount: 35000,
          targetAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: 'cat_prepayment',
          description: 'Предоплата по договору',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.amount).toBe(35000);
      expect(res.body.updatedAccounts[0].currentBalance).toBe(814000 + 35000);
    });

    it('POST /api/transactions should execute transfer conserving total liquidity', async () => {
      const accBefore = await request(app).get('/api/accounts');
      const totalBefore = accBefore.body.totalBalance;

      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'transfer',
          amount: 20000,
          sourceAccountId: ACCOUNT_IDS.CASH_2,
          targetAccountId: ACCOUNT_IDS.CASH_1,
          description: 'Размен наличных',
        });

      expect(res.status).toBe(201);
      expect(res.body.updatedAccounts).toHaveLength(2);

      const accAfter = await request(app).get('/api/accounts');
      expect(accAfter.body.totalBalance).toBe(totalBefore); // Capital conserved
    });

    it('POST /api/transactions should handle field aliases (fromAccountId, toAccountId)', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 1200,
          fromAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: 'cat_ice',
        });

      expect(res.status).toBe(201);
      expect(res.body.transaction.sourceAccountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(res.body.transaction.fromAccountId).toBe(ACCOUNT_IDS.CASH_1);
    });

    it('POST /api/transactions should reject invalid operations with 400', async () => {
      // Zero amount
      const resZero = await request(app)
        .post('/api/transactions')
        .send({ type: 'expense', amount: 0, sourceAccountId: ACCOUNT_IDS.CASH_1 });
      expect(resZero.status).toBe(400);
      expect(resZero.body.error).toContain('больше нуля');

      // Negative amount
      const resNeg = await request(app)
        .post('/api/transactions')
        .send({ type: 'expense', amount: -500, sourceAccountId: ACCOUNT_IDS.CASH_1 });
      expect(resNeg.status).toBe(400);

      // Self-transfer
      const resSelf = await request(app)
        .post('/api/transactions')
        .send({
          type: 'transfer',
          amount: 5000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          targetAccountId: ACCOUNT_IDS.CASH_1,
        });
      expect(resSelf.status).toBe(400);
      expect(resSelf.body.error).toContain('должны отличаться');

      // Missing source account for expense
      const resMissingSrc = await request(app)
        .post('/api/transactions')
        .send({ type: 'expense', amount: 500 });
      expect(resMissingSrc.status).toBe(400);
      expect(resMissingSrc.body.error).toContain('счёт списания');
    });

    it('DELETE /api/transactions/:id should cancel transaction and restore balance', async () => {
      const createRes = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 3000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: 'cat_ice',
        });

      const txId = createRes.body.transaction.id;

      const deleteRes = await request(app).delete(`/api/transactions/${txId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.transaction.isDeleted).toBe(true);
      expect(deleteRes.body.updatedAccounts[0].currentBalance).toBe(6300); // Restored
    });

    it('DELETE /api/transactions/:id should return 404 when deleting an already deleted transaction', async () => {
      const createRes = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 1000,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
        });

      const txId = createRes.body.transaction.id;
      await request(app).delete(`/api/transactions/${txId}`);

      // Second delete
      const resSecond = await request(app).delete(`/api/transactions/${txId}`);
      expect(resSecond.status).toBe(404);
      expect(resSecond.body.error).toContain('не найдена');
    });
  });

  // =========================================================================
  // 6. ANALYTICS
  // =========================================================================
  describe('Analytics Endpoints', () => {
    it('GET /api/analytics/events should calculate wedding and corporate margin metrics', async () => {
      const res = await request(app).get('/api/analytics/events');
      expect(res.status).toBe(200);
      expect(res.body.analytics).toHaveLength(2);

      const wedding = res.body.analytics.find((a: any) => a.eventId === EVENT_IDS.WEDDING);
      expect(wedding).toBeDefined();
      expect(wedding.revenue).toBe(290000);
      expect(wedding.directExpenses).toBe(95000);
      expect(wedding.netProfit).toBe(195000);
      expect(wedding.marginPercentage).toBe(67.24);
      expect(wedding.expensesByCategory.length).toBeGreaterThan(0);
    });

    it('GET /api/analytics/events/:id should return single event margin', async () => {
      const res = await request(app).get(`/api/analytics/events/${EVENT_IDS.CORPORATE}`);
      expect(res.status).toBe(200);
      expect(res.body.analytics.eventId).toBe(EVENT_IDS.CORPORATE);
      expect(res.body.analytics.revenue).toBe(294000);
      expect(res.body.analytics.directExpenses).toBe(123500);
      expect(res.body.analytics.netProfit).toBe(170500);
    });

    it('GET /api/analytics/overview should return total liquidity and general bar overhead', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.status).toBe(200);
      expect(res.body.totalBalance).toBe(1166300);
      expect(res.body.generalExpensesTotal).toBe(35000 + 4200); // 39,200 ₽ in seed
      expect(res.body.eventsCount).toBe(2);
    });

    it('GET /api/analytics/events/:id should handle zero revenue gracefully (0% margin, no NaN)', async () => {
      const newEvent = await store.createEvent({
        id: 'event-zero-rev',
        title: 'Тест без выручки',
        eventDate: '2026-11-20',
      });

      const res = await request(app).get(`/api/analytics/events/${newEvent.id}`);
      expect(res.status).toBe(200);
      expect(res.body.analytics.revenue).toBe(0);
      expect(res.body.analytics.marginPercentage).toBe(0);
      expect(Number.isNaN(res.body.analytics.marginPercentage)).toBe(false);
    });
  });

  // =========================================================================
  // 7. TELEGRAM BOT & WEB SIMULATOR
  // =========================================================================
  describe('Telegram & Fast Command Simulator Endpoints', () => {
    it('GET /api/telegram/status should report operational bot status in mock mode', async () => {
      const res = await request(app).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.mode).toBe('mock');
      expect(res.body.botUsername).toBe('@TruespaceBarBot');
    });

    it('POST /api/telegram/parse should parse complex commands without mutating ledger', async () => {
      const res = await request(app)
        .post('/api/telegram/parse')
        .send({ text: '3500 лед Корпоратив Т-Банк' });

      expect(res.status).toBe(200);
      expect(res.body.parsed.amount).toBe(3500);
      expect(res.body.parsed.type).toBe('expense');
      expect(res.body.parsed.categoryId).toBe('cat_ice');
      expect(res.body.parsed.eventId).toBe('event_corporate');
      expect(res.body.parsed.accountId).toBe('card_sbp');
      expect(res.body.parsed.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('POST /api/telegram/parse should parse prepayment income command', async () => {
      const res = await request(app)
        .post('/api/telegram/parse')
        .send({ text: '50000 предоплата Свадьба' });

      expect(res.status).toBe(200);
      expect(res.body.parsed.amount).toBe(50000);
      expect(res.body.parsed.type).toBe('income');
      expect(res.body.parsed.categoryId).toBe('cat_prepayment');
      expect(res.body.parsed.eventId).toBe('event_wedding');
      expect(res.body.parsed.accountId).toBe('cash_1'); // Default account
    });

    it('POST /api/telegram/parse should parse negative amount prefix', async () => {
      const res = await request(app)
        .post('/api/telegram/parse')
        .send({ text: '-1500 такси нал1' });

      expect(res.status).toBe(200);
      expect(res.body.parsed.amount).toBe(1500);
      expect(res.body.parsed.type).toBe('expense');
      expect(res.body.parsed.categoryId).toBe('cat_logistics');
      expect(res.body.parsed.accountId).toBe('cash_1');
    });

    it('POST /api/telegram/parse should reject empty string or missing amount', async () => {
      const resEmpty = await request(app).post('/api/telegram/parse').send({ text: '' });
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toContain('Пустая команда');

      const resNoAmount = await request(app).post('/api/telegram/parse').send({ text: 'лед на стойку' });
      expect(resNoAmount.status).toBe(400);
      expect(resNoAmount.body.error).toContain('не указана сумма');
    });

    it('POST /api/telegram/execute should parse and commit transaction with [Telegram] tag', async () => {
      const res = await request(app)
        .post('/api/telegram/execute')
        .send({ text: '4000 мята и лимоны нал1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.amount).toBe(4000);
      expect(res.body.transaction.description).toContain('[Telegram]');
      expect(res.body.updatedAccounts[0].currentBalance).toBe(6300 - 4000);
    });
  });
});
