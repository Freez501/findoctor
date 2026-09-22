import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { ACCOUNT_IDS, CATEGORY_IDS } from '../../src/shared/constants.js';

describe('Partners, Custom Directories & Directions API Tests', () => {
  let app: any;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    app = createApp({ store });
  });

  // =========================================================================
  // 1. PARTNERS API
  // =========================================================================
  describe('Partners Endpoints', () => {
    it('GET /api/partners should return default seeded partners (Влад and Никита)', async () => {
      const res = await request(app).get('/api/partners');
      expect(res.status).toBe(200);
      expect(res.body.partners).toBeDefined();
      expect(res.body.partners.length).toBeGreaterThanOrEqual(2);

      const vlad = res.body.partners.find((p: any) => p.name === 'Влад');
      const nikita = res.body.partners.find((p: any) => p.name === 'Никита');
      expect(vlad).toBeDefined();
      expect(nikita).toBeDefined();
    });

    it('POST /api/partners should create a new partner', async () => {
      const res = await request(app)
        .post('/api/partners')
        .send({ name: 'Алексей Инвестор' });

      expect(res.status).toBe(201);
      expect(res.body.partner).toBeDefined();
      expect(res.body.partner.name).toBe('Алексей Инвестор');
      expect(res.body.partner.isActive).toBe(true);

      const listRes = await request(app).get('/api/partners');
      const found = listRes.body.partners.find((p: any) => p.name === 'Алексей Инвестор');
      expect(found).toBeDefined();
    });

    it('PUT /api/partners/:id should update partner details', async () => {
      const res = await request(app)
        .put('/api/partners/partner_vlad')
        .send({ name: 'Влад Старший' });

      expect(res.status).toBe(200);
      expect(res.body.partner.name).toBe('Влад Старший');

      const getRes = await request(app).get('/api/partners');
      const vlad = getRes.body.partners.find((p: any) => p.id === 'partner_vlad');
      expect(vlad?.name).toBe('Влад Старший');
    });
  });

  // =========================================================================
  // 2. ACCOUNTS CUSTOMIZATION API
  // =========================================================================
  describe('Accounts Customization Endpoints', () => {
    it('POST /api/accounts should create a new custom business account', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .send({
          name: 'Сбербанк Дополнительный',
          initialBalance: 50000,
          description: 'Резервный счёт для оборудования',
        });

      expect(res.status).toBe(201);
      expect(res.body.account).toBeDefined();
      expect(res.body.account.name).toBe('Сбербанк Дополнительный');
      expect(res.body.account.currentBalance).toBe(50000);

      const accountsRes = await request(app).get('/api/accounts');
      expect(accountsRes.body.accounts.length).toBe(6);
      expect(accountsRes.body.totalBalance).toBe(1166300 + 50000);
    });

    it('PUT /api/accounts/:id should rename an existing account', async () => {
      const res = await request(app)
        .put(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)
        .send({
          name: 'Нал_Влад (Переименованный)',
          description: 'Личная касса Влада',
        });

      expect(res.status).toBe(200);
      expect(res.body.account.name).toBe('Нал_Влад (Переименованный)');
      expect(res.body.account.description).toBe('Личная касса Влада');
    });

    it('POST /api/accounts should persist custom icon and color badge', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .send({
          name: 'Сейф Офис',
          initialBalance: 25000,
          color: '#0284c7',
          icon: 'shield',
        });

      expect(res.status).toBe(201);
      expect(res.body.account.name).toBe('Сейф Офис');
      expect(res.body.account.color).toBe('#0284c7');
      expect(res.body.account.icon).toBe('shield');

      const getRes = await request(app).get(`/api/accounts/${res.body.account.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.account.color).toBe('#0284c7');
      expect(getRes.body.account.icon).toBe('shield');
    });

    it('PUT /api/accounts/:id should update account icon and color badge', async () => {
      const res = await request(app)
        .put(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)
        .send({
          color: '#7c3aed',
          icon: 'piggy-bank',
        });

      expect(res.status).toBe(200);
      expect(res.body.account.color).toBe('#7c3aed');
      expect(res.body.account.icon).toBe('piggy-bank');

      const getRes = await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.account.color).toBe('#7c3aed');
      expect(getRes.body.account.icon).toBe('piggy-bank');
    });
  });

  // =========================================================================
  // 3. CATEGORIES CUSTOMIZATION API
  // =========================================================================
  describe('Categories Customization Endpoints', () => {
    it('POST /api/categories should create a custom category with direction', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({
          name: 'Декор и свет',
          type: 'expense',
          direction: 'operational',
          color: '#f59e0b',
        });

      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe('Декор и свет');
      expect(res.body.category.direction).toBe('operational');
      expect(res.body.category.color).toBe('#f59e0b');
    });

    it('PUT /api/categories/:id should update an existing category', async () => {
      const res = await request(app)
        .put(`/api/categories/${CATEGORY_IDS.ALCOHOL}`)
        .send({
          name: 'Премиум Алкоголь',
          color: '#ef4444',
        });

      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe('Премиум Алкоголь');
      expect(res.body.category.color).toBe('#ef4444');
    });
  });

  // =========================================================================
  // 4. PARTNER DIVIDENDS & ANALYTICS
  // =========================================================================
  describe('Partner Dividends & Analytics Endpoints', () => {
    it('POST /api/transactions with direction=dividends should link payout to partner', async () => {
      const txRes = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          direction: 'dividends',
          amount: 25000,
          sourceAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: CATEGORY_IDS.DIVIDENDS,
          partnerId: 'partner_vlad',
          partnerName: 'Влад',
          description: 'Дивиденды за август Влад',
        });

      expect(txRes.status).toBe(201);
      expect(txRes.body.transaction.partnerId).toBe('partner_vlad');
      expect(txRes.body.transaction.partnerName).toBe('Влад');
      expect(txRes.body.transaction.direction).toBe('dividends');

      // Check partner analytics endpoint
      const analyticsRes = await request(app).get('/api/analytics/partners');
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.totalDividendsPaid).toBe(25000);

      const vladMetric = analyticsRes.body.partners.find((p: any) => p.partnerId === 'partner_vlad');
      expect(vladMetric).toBeDefined();
      expect(vladMetric.totalWithdrawn).toBe(25000);
      expect(vladMetric.transactionsCount).toBe(1);
      expect(vladMetric.recentPayouts[0].amount).toBe(25000);
      expect(vladMetric.recentPayouts[0].comment).toBe('Дивиденды за август Влад');
    });

    it('GET /api/analytics/partners should return empty metrics when no payouts exist', async () => {
      const analyticsRes = await request(app).get('/api/analytics/partners');
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.totalDividendsPaid).toBe(0);
      expect(analyticsRes.body.partners.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 5. DELETION ENDPOINTS (Accounts, Categories, Partners)
  // =========================================================================
  describe('Deletion Endpoints', () => {
    it('DELETE /api/categories/:id should delete custom category', async () => {
      const createRes = await request(app)
        .post('/api/categories')
        .send({ name: 'Временная статья', type: 'expense' });
      const catId = createRes.body.category.id;

      const delRes = await request(app).delete(`/api/categories/${catId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const listRes = await request(app).get('/api/categories');
      expect(listRes.body.categories.find((c: any) => c.id === catId)).toBeUndefined();
    });

    it('DELETE /api/accounts/:id should delete account', async () => {
      const createRes = await request(app)
        .post('/api/accounts')
        .send({ name: 'Тестовый счёт', initialBalance: 1000 });
      const accId = createRes.body.account.id;

      const delRes = await request(app).delete(`/api/accounts/${accId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const listRes = await request(app).get('/api/accounts');
      expect(listRes.body.accounts.find((a: any) => a.id === accId)).toBeUndefined();
    });

    it('DELETE /api/partners/:id should delete partner', async () => {
      const createRes = await request(app)
        .post('/api/partners')
        .send({ name: 'Тестовый Партнёр', role: 'Инвестор' });
      const partnerId = createRes.body.partner.id;
      expect(createRes.body.partner.role).toBe('Инвестор');

      const delRes = await request(app).delete(`/api/partners/${partnerId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const listRes = await request(app).get('/api/partners');
      expect(listRes.body.partners.find((p: any) => p.id === partnerId)).toBeUndefined();
    });
  });
});
