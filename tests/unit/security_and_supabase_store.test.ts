import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { SupabaseStore } from '../../src/server/storage/SupabaseStore.js';
import { signAuthToken, verifyAuthToken } from '../../src/server/middleware/auth.js';
import { FinanceService } from '../../src/server/services/FinanceService.js';

describe('Security P0, SupabaseStore & Architecture P1/P2 Verification', () => {
  let store: InMemoryStore;
  let app: any;

  beforeEach(() => {
    store = new InMemoryStore();
    app = createApp({ store });
  });

  it('rejects hardcoded 777111 verification code backdoor', async () => {
    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'newuser@truespace.ru', code: '777111' });
    expect(res.status).toBe(400);
  }, 20000);

  it('signs and verifies JWT Bearer tokens and authenticates /api/auth/me', async () => {
    const token = signAuthToken({
      userId: 'user_vlad',
      email: 'vlad@truespace.ru',
      companyId: 'company_truespace_default',
    });
    const payload = verifyAuthToken(token);
    expect(payload?.userId).toBe('user_vlad');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe('user_vlad');
  }, 20000);

  it('enforces rate limiting when x-enforce-rate-limit header is set', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/verify-code')
        .set('x-enforce-rate-limit', '1')
        .send({ email: 'rate@truespace.ru', code: '000000' });
    }
    const sixth = await request(app)
      .post('/api/auth/verify-code')
      .set('x-enforce-rate-limit', '1')
      .send({ email: 'rate@truespace.ru', code: '000000' });
    expect(sixth.status).toBe(429);
  }, 20000);

  it('updates transaction balances atomically via adjustAccountBalance', async () => {
    const service = new FinanceService(store);
    const created = await service.createTransaction({
      type: 'expense',
      amount: 1000,
      fromAccountId: 'cash_1',
      categoryId: 'cat_ice',
    });
    const beforeAcc = await store.getAccountById('cash_1');
    const updated = await service.updateTransaction(created.transaction.id, {
      amount: 1500,
    });
    const afterAcc = await store.getAccountById('cash_1');
    expect(updated.transaction.amount).toBe(1500);
    expect(afterAcc!.currentBalance).toBe(beforeAcc!.currentBalance - 500);
  });

  it('instantiates SupabaseStore with custom mock client and maps entities cleanly', async () => {
    const mockClient: any = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: 'cash_1', name: 'Касса', type: 'cash', initial_balance: 100, current_balance: 250.55 }], error: null }),
        }),
      }),
      rpc: () => Promise.resolve({ data: 300.55, error: null }),
    };
    const supaStore = new SupabaseStore(undefined, undefined, mockClient);
    const accounts = await supaStore.getAccounts('company_truespace_default');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].currentBalance).toBe(250.55);
  });
});
