/**
 * Truespace — Барный кейтеринг и финансы
 * Multi-Tenant SaaS & SuperAdmin Unit Test Suite (`tests/unit/saas_multitenant.test.ts`)
 *
 * Validates tenant isolation, company creation, co-founder permissions,
 * author attribution (`createdBy`, `updatedBy`), and auth endpoints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import { DEFAULT_COMPANY_ID } from '../../src/shared/constants.js';

describe('SaaS Multi-Tenant & SuperAdmin Suite', () => {
  let store: InMemoryStore;
  let app: any;

  beforeEach(() => {
    store = new InMemoryStore();
    app = createApp({ store });
  });

  describe('Storage Multi-Tenant Layer', () => {
    it('initializes with default Truespace company and pre-seeded users', async () => {
      const companies = await store.getCompanies();
      expect(companies.length).toBeGreaterThanOrEqual(1);
      expect(companies[0].id).toBe(DEFAULT_COMPANY_ID);
      expect(companies[0].name).toBe('Truespace Catering');

      const users = await store.getUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
      const nikita = users.find((u) => u.fullName === 'Никита');
      expect(nikita).toBeDefined();
      expect(nikita?.isSuperAdmin).toBe(true);

      const vlad = users.find((u) => u.fullName === 'Влад');
      expect(vlad).toBeDefined();
      expect(vlad?.isSuperAdmin).toBe(false);
    });

    it('creates and updates a new company tenant', async () => {
      const newCo = await store.createCompany({
        name: 'Коктейли СПБ',
        slug: 'cocktails-spb',
        plan: 'starter',
        ownerId: 'user_vlad',
      });

      expect(newCo.id).toBeDefined();
      expect(newCo.name).toBe('Коктейли СПБ');
      expect(newCo.slug).toBe('cocktails-spb');

      const fetched = await store.getCompanyById(newCo.id);
      expect(fetched?.name).toBe('Коктейли СПБ');

      const updated = await store.updateCompany(newCo.id, { plan: 'pro' });
      expect(updated.plan).toBe('pro');
    });

    it('adds and lists company members with roles', async () => {
      const members = await store.getCompanyMembers(DEFAULT_COMPANY_ID);
      expect(members.length).toBeGreaterThanOrEqual(2);

      const added = await store.addCompanyMember({
        companyId: DEFAULT_COMPANY_ID,
        userId: 'user_new_bartender',
        role: 'staff',
        invitedBy: 'user_nikita',
      });

      expect(added.role).toBe('staff');
      expect(added.invitedBy).toBe('user_nikita');

      const updatedMembers = await store.getCompanyMembers(DEFAULT_COMPANY_ID);
      expect(updatedMembers.some((m) => m.membership.userId === 'user_new_bartender')).toBe(true);
    });

    it('attaches and preserves createdBy author metadata on transactions', async () => {
      const tx = await store.createTransaction({
        type: 'expense',
        amount: 5000,
        fromAccountId: 'cash_1',
        toAccountId: null,
        categoryId: 'staff',
        description: 'Оплата клининга склада',
        createdBy: 'Никита',
        companyId: DEFAULT_COMPANY_ID,
      });

      expect(tx.createdBy).toBe('Никита');
      expect(tx.companyId).toBe(DEFAULT_COMPANY_ID);

      const fetched = await store.getTransactionById(tx.id);
      expect(fetched?.createdBy).toBe('Никита');

      const updated = await store.updateTransaction(tx.id, {
        description: 'Оплата клининга склада (перепроверено)',
        updatedBy: 'Влад',
      });

      expect(updated.createdBy).toBe('Никита');
      expect(updated.updatedBy).toBe('Влад');
    });
  });

  describe('REST API Endpoints for Companies & Auth', () => {
    it('GET /api/companies returns list of companies', async () => {
      const res = await request(app).get('/api/companies');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(DEFAULT_COMPANY_ID);
    });

    it('POST /api/companies creates a new tenant organization', async () => {
      const res = await request(app)
        .post('/api/companies')
        .send({
          name: 'Выездной Бар Сибирь',
          plan: 'pro',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Выездной Бар Сибирь');
      expect(res.body.id).toBeDefined();

      // Check membership was auto-created for owner
      const membersRes = await request(app).get(`/api/companies/${res.body.id}/members`);
      expect(membersRes.status).toBe(200);
      expect(membersRes.body.length).toBeGreaterThanOrEqual(1);
      expect(membersRes.body[0].membership.role).toBe('owner');
    });

    it('GET /api/auth/me returns active session user and tenant', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.fullName).toBe('Никита');
      expect(res.body.user.isSuperAdmin).toBe(true);
      expect(res.body.activeCompanyId).toBe(DEFAULT_COMPANY_ID);
    });

    it('POST /api/auth/switch-user switches active user profile', async () => {
      const res = await request(app)
        .post('/api/auth/switch-user')
        .send({ userId: 'user_vlad' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.fullName).toBe('Влад');

      // Now /api/auth/me should reflect Vlad
      const meRes = await request(app).get('/api/auth/me');
      expect(meRes.body.user.fullName).toBe('Влад');
    });

    it('POST /api/auth/register-or-invite adds new member to the company', async () => {
      const res = await request(app)
        .post('/api/auth/register-or-invite')
        .send({
          email: 'alex@truespace.ru',
          fullName: 'Алексей (Старший бармен)',
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('alex@truespace.ru');
      expect(res.body.role).toBe('admin');

      // Member should appear in company members list
      const membersRes = await request(app).get(`/api/companies/${DEFAULT_COMPANY_ID}/members`);
      expect(membersRes.body.some((m: any) => m.membership.userId === res.body.user.id)).toBe(true);
    });

    it('PATCH /api/companies/:id updates trialEndsAt and paidUntil', async () => {
      const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
      const patchRes = await request(app)
        .patch(`/api/companies/${DEFAULT_COMPANY_ID}`)
        .send({
          trialEndsAt: futureDate,
          plan: 'pro',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.trialEndsAt).toBe(futureDate);
      expect(patchRes.body.plan).toBe('pro');
    });

    it('DELETE /api/companies/:id deletes company, enforces RBAC and rejects deletion of company_platform_admin', async () => {
      // 1. Trying to delete platform admin company should fail with 400
      const systemRes = await request(app)
        .delete('/api/companies/company_platform_admin')
        .set('x-user-id', 'user_admin_platform');
      expect(systemRes.status).toBe(400);

      // 2. Create a test company to delete
      const coRes = await request(app)
        .post('/api/companies')
        .send({ name: 'Временная Компания Для Удаления' });
      expect(coRes.status).toBe(201);
      const tempId = coRes.body.id;

      // 3. Unauthorized request without x-user-id must return 401
      const unauthRes = await request(app).delete(`/api/companies/${tempId}`);
      expect(unauthRes.status).toBe(401);

      // 4. Delete this company with owner credentials (user_nikita is default owner)
      const deleteRes = await request(app)
        .delete(`/api/companies/${tempId}`)
        .set('x-user-id', 'user_nikita');
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // 4. Verify it is gone
      const getRes = await request(app).get(`/api/companies/${tempId}`);
      expect(getRes.status).toBe(404);
    });

    it('POST /api/auth/send-code and /api/auth/register with verification code', async () => {
      // 1. Send verification code
      const sendRes = await request(app)
        .post('/api/auth/send-code')
        .send({
          email: 'founder@truespace.ru',
          fullName: 'Основатель',
          companyName: 'Бар Основателей',
        });
      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      const code = sendRes.body.previewCode;
      expect(code).toBeDefined();

      // 2. Register with verification code
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'founder@truespace.ru',
          password: 'Password123!',
          fullName: 'Основатель',
          companyName: 'Бар Основателей',
          code,
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.user.email).toBe('founder@truespace.ru');
      expect(regRes.body.user.isEmailVerified).toBe(true);
      expect(regRes.body.company.name).toBe('Бар Основателей');
      expect(regRes.body.company.trialEndsAt).toBeDefined();
    });

    it('FIX-03 & FIX-04: RBAC protects batch-delete and reset-balances against unauthorized roles', async () => {
      // 1. Create a staff member for DEFAULT_COMPANY_ID
      const staffUser = await store.saveUserProfile({
        id: 'user_staff_test',
        email: 'staff@truespace.ru',
        fullName: 'Бармен Тестовый',
        isSuperAdmin: false,
      });
      await store.addCompanyMember({
        companyId: DEFAULT_COMPANY_ID,
        userId: staffUser.id,
        role: 'staff',
      });

      // 2. Batch-delete attempt by staff member should be rejected with 403
      const batchDelRes = await request(app)
        .post('/api/transactions/batch-delete')
        .set('x-user-id', staffUser.id)
        .set('x-company-id', DEFAULT_COMPANY_ID)
        .send({ ids: ['tx_1', 'tx_2'] });
      expect(batchDelRes.status).toBe(403);

      // 3. Reset-balances attempt by staff member should be rejected with 403
      const resetRes = await request(app)
        .post('/api/accounts/reset-balances')
        .set('x-user-id', staffUser.id)
        .set('x-company-id', DEFAULT_COMPANY_ID);
      expect(resetRes.status).toBe(403);
    });

    it('FIX-05: Cross-tenant transfer between accounts of different companies is strictly forbidden', async () => {
      // Create second company and its account
      const co2 = await store.createCompany({ name: 'Другой Кейтеринг', slug: 'other-cat', plan: 'pro', isActive: true });
      const acc2 = await store.createAccount({
        name: 'Касса Другого Кейтеринга',
        type: 'cash',
        initialBalance: 10000,
        currentBalance: 10000,
        currency: 'RUB',
        description: 'Чужой счёт',
        companyId: co2.id,
      });

      // Try to transfer from default company account (cash_1) to co2 account with companyId = DEFAULT_COMPANY_ID
      const financeService = new FinanceService(store);
      await expect(
        financeService.createTransaction({
          type: 'transfer',
          amount: 500,
          sourceAccountId: 'cash_1',
          targetAccountId: acc2.id,
          companyId: DEFAULT_COMPANY_ID,
        })
      ).rejects.toThrow(/другой организации|разных организаций/);
    });

    it('FIX-06: AnalyticsService strictly isolates metrics by companyId', async () => {
      const analyticsService = new AnalyticsService(store);

      // Default company metrics
      const defaultOverview = await analyticsService.getOverview(DEFAULT_COMPANY_ID);
      expect(defaultOverview.accounts.length).toBeGreaterThan(0);

      // New empty company metrics
      const emptyCo = await store.createCompany({ name: 'Новый пустой бар', slug: 'empty-bar', plan: 'free', isActive: true });
      const emptyOverview = await analyticsService.getOverview(emptyCo.id);
      expect(emptyOverview.accounts.length).toBe(0);
      expect(emptyOverview.totalBalance).toBe(0);
      expect(emptyOverview.eventsTotalRevenue).toBe(0);
    });

    it('FIX-07: updateTransaction rejects non-positive amounts', async () => {
      const financeService = new FinanceService(store);
      const created = await financeService.createTransaction({
        type: 'expense',
        amount: 1500,
        sourceAccountId: 'cash_1',
        description: 'Расходники бара',
      });

      await expect(
        financeService.updateTransaction(created.transaction.id, { amount: -500 })
      ).rejects.toThrow(/положительным числом/);

      await expect(
        financeService.updateTransaction(created.transaction.id, { amount: 0 })
      ).rejects.toThrow(/положительным числом/);
    });
  });
});
