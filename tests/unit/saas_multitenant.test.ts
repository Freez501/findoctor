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
  });
});
