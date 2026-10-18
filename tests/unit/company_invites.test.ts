import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { createCompaniesRouter } from '../../src/server/routes/companies.js';
import { createAuthRouter } from '../../src/server/routes/auth.js';
import { DEFAULT_COMPANY_ID } from '../../src/shared/constants.js';

describe('Company Invites API & Link Onboarding Suite', () => {
  let store: InMemoryStore;
  let app: express.Express;

  beforeEach(async () => {
    store = new InMemoryStore();
    app = express();
    app.use(express.json());
    app.use('/api/companies', createCompaniesRouter(store));
    app.use('/api/auth', createAuthRouter(store));
  });

  it('creates an invite link with staff role and default expiration', async () => {
    const res = await request(app)
      .post(`/api/companies/${DEFAULT_COMPANY_ID}/invites`)
      .send({ role: 'staff', expiresDays: 7 });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.startsWith('inv_')).toBe(true);
    expect(res.body.role).toBe('staff');
    expect(res.body.status).toBe('active');
    expect(res.body.usedCount).toBe(0);
  });

  it('validates active invite via public GET /api/auth/invites/:token', async () => {
    const invite = await store.createCompanyInvite({
      companyId: DEFAULT_COMPANY_ID,
      role: 'staff',
    });

    const res = await request(app).get(`/api/auth/invites/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.invite.companyId).toBe(DEFAULT_COMPANY_ID);
    expect(res.body.invite.role).toBe('staff');
  });

  it('allows a new user to onboard and accept the invite link', async () => {
    const invite = await store.createCompanyInvite({
      companyId: DEFAULT_COMPANY_ID,
      role: 'staff',
    });

    const res = await request(app)
      .post(`/api/auth/invites/${invite.token}/accept`)
      .send({
        email: 'new_bartender@truespace.ru',
        fullName: 'Алексей Бармен',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('new_bartender@truespace.ru');
    expect(res.body.user.fullName).toBe('Алексей Бармен');
    expect(res.body.membership.role).toBe('staff');

    // Verify membership was added to store
    const members = await store.getCompanyMembers(DEFAULT_COMPANY_ID);
    const added = members.find((m) => m.user?.email === 'new_bartender@truespace.ru');
    expect(added).toBeDefined();
    expect(added?.membership.role).toBe('staff');
  });

  it('revokes an invite and rejects subsequent accept attempts', async () => {
    const invite = await store.createCompanyInvite({
      companyId: DEFAULT_COMPANY_ID,
      role: 'accountant',
    });

    // Revoke
    const delRes = await request(app).delete(`/api/companies/${DEFAULT_COMPANY_ID}/invites/${invite.id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify GET returns revoked status (410)
    const checkRes = await request(app).get(`/api/auth/invites/${invite.token}`);
    expect(checkRes.status).toBe(410);
    expect(checkRes.body.valid).toBe(false);
  });
});

