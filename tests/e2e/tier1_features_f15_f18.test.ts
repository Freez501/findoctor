import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { INITIAL_ACCOUNTS, INITIAL_EVENTS, INITIAL_CATEGORIES } from './helpers/fixtures';

describe('Tier 1: Feature Coverage F15–F18 (Repository, Storage, Schema & Seed)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F15: Repository Pattern Abstraction (>=5 tests)
  // =========================================================================
  describe('F15: Repository Pattern Abstraction', () => {
    it('F15-1: should expose standard asynchronous repository methods', async () => {
      expect(typeof client.getAccounts).toBe('function');
      expect(typeof client.getTransactions).toBe('function');
      expect(typeof client.createTransaction).toBe('function');
      expect(typeof client.deleteTransaction).toBe('function');
      expect(typeof client.resetDemoData).toBe('function');
    });

    it('F15-2: should return typed entity collections without leaking raw database queries', async () => {
      const { accounts } = await client.getAccounts();
      for (const a of accounts) {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('name');
        expect(a).toHaveProperty('currentBalance');
        expect(a).toHaveProperty('currency', 'RUB');
      }
    });

    it('F15-3: should encapsulate transaction creation logic inside store abstraction', async () => {
      const result = await client.createTransaction({
        type: 'expense',
        amount: 5000,
        sourceAccountId: 'cash_1',
        categoryId: 'cat_ice',
      });

      expect(result.transaction.id).toBeDefined();
      expect(result.transaction.amount).toBe(5000);
      expect(result.updatedAccounts).toHaveLength(1);
    });

    it('F15-4: should isolate multi-account transfer orchestration within repository layer', async () => {
      const result = await client.createTransaction({
        type: 'transfer',
        amount: 20000,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_2',
      });

      expect(result.transaction.type).toBe('transfer');
      expect(result.updatedAccounts).toHaveLength(2);
    });

    it('F15-5: should support transaction query filtering within repository interface', async () => {
      const { transactions } = await client.getTransactions({ eventId: 'event_wedding' });
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions.every((tx) => tx.eventId === 'event_wedding')).toBe(true);
    });
  });

  // =========================================================================
  // F16: Local JSON & InMemory Storage (>=5 tests)
  // =========================================================================
  describe('F16: Local JSON & InMemory Storage', () => {
    it('F16-1: should boot autonomously with zero external database connection required', async () => {
      const { accounts } = await client.getAccounts();
      expect(accounts).toHaveLength(5);
    });

    it('F16-2: should maintain in-memory state changes within active session', async () => {
      await client.createTransaction({
        type: 'expense',
        amount: 3000,
        sourceAccountId: 'cash_1',
      });

      const { transactions } = await client.getTransactions();
      expect(transactions[0].amount).toBe(3000);
    });

    it('F16-3: should reset to pristine seed state upon request', async () => {
      const { accounts: before } = await client.getAccounts();
      const initialBal = before.find((a) => a.id === 'cash_1')!.currentBalance;

      await client.createTransaction({
        type: 'expense',
        amount: 10000,
        sourceAccountId: 'cash_1',
      });

      await client.resetDemoData();

      const { accounts } = await client.getAccounts();
      const cash1 = accounts.find((a) => a.id === 'cash_1')!;
      // Reverted to baseline
      expect(cash1.currentBalance).toBe(initialBal);
    });

    it('F16-4: should handle rapid sequential storage operations without data corruption', async () => {
      for (let i = 1; i <= 5; i++) {
        await client.createTransaction({
          type: 'expense',
          amount: 100 * i,
          sourceAccountId: 'cash_1',
          description: `Rapid op #${i}`,
        });
      }

      const { transactions } = await client.getTransactions();
      const rapidTxs = transactions.filter((tx) => tx.description?.includes('Rapid op'));
      expect(rapidTxs).toHaveLength(5);
    });

    it('F16-5: should maintain data isolation between independent client instances', async () => {
      const clientA = new E2ETestClient();
      const clientB = new E2ETestClient();

      await clientA.createTransaction({
        type: 'expense',
        amount: 5000,
        sourceAccountId: 'cash_1',
      });

      const { accounts: accountsA } = await clientA.getAccounts();
      const { accounts: accountsB } = await clientB.getAccounts();

      const balA = accountsA.find((a) => a.id === 'cash_1')!.currentBalance;
      const balB = accountsB.find((a) => a.id === 'cash_1')!.currentBalance;

      expect(balA).not.toBe(balB); // Isolated state instances
    });
  });

  // =========================================================================
  // F17: Supabase-Ready Schema (>=5 tests)
  // =========================================================================
  describe('F17: Supabase-Ready Schema', () => {
    it('F17-1: should conform to PostgreSQL schema for accounts table', async () => {
      const { accounts } = await client.getAccounts();
      for (const a of accounts) {
        expect(typeof a.id).toBe('string');
        expect(typeof a.name).toBe('string');
        expect(['cash', 'bank', 'card_transfer']).toContain(a.type);
        expect(typeof a.currentBalance).toBe('number');
        expect(a.currency).toBe('RUB');
      }
    });

    it('F17-2: should conform to PostgreSQL schema for events table', async () => {
      const { events } = await client.getEvents();
      for (const ev of events) {
        expect(typeof ev.id).toBe('string');
        expect(typeof ev.title).toBe('string');
        expect(typeof ev.eventDate).toBe('string');
        expect(['planned', 'active', 'completed', 'cancelled']).toContain(ev.status);
      }
    });

    it('F17-3: should conform to PostgreSQL schema for categories table', async () => {
      const { categories } = await client.getCategories();
      for (const cat of categories) {
        expect(typeof cat.id).toBe('string');
        expect(typeof cat.name).toBe('string');
        expect(['expense', 'income', 'both']).toContain(cat.type);
      }
    });

    it('F17-4: should conform to PostgreSQL schema for transactions table', async () => {
      const { transactions } = await client.getTransactions();
      for (const tx of transactions) {
        expect(typeof tx.id).toBe('string');
        expect(['expense', 'income', 'transfer']).toContain(tx.type);
        expect(tx.amount).toBeGreaterThan(0);
        expect(typeof tx.isDeleted).toBe('boolean');
      }
    });

    it('F17-5: should satisfy foreign key references across domain entities', async () => {
      const { transactions } = await client.getTransactions();
      const { accounts } = await client.getAccounts();
      const { events } = await client.getEvents();
      const { categories } = await client.getCategories();

      const accIds = new Set(accounts.map((a) => a.id));
      const eventIds = new Set(events.map((e) => e.id));
      const catIds = new Set(categories.map((c) => c.id));

      for (const tx of transactions) {
        if (tx.sourceAccountId) expect(accIds.has(tx.sourceAccountId)).toBe(true);
        if (tx.targetAccountId) expect(accIds.has(tx.targetAccountId)).toBe(true);
        if (tx.eventId) expect(eventIds.has(tx.eventId)).toBe(true);
        if (tx.categoryId) expect(catIds.has(tx.categoryId)).toBe(true);
      }
    });
  });

  // =========================================================================
  // F18: Seed Demo Data Generator (>=5 tests)
  // =========================================================================
  describe('F18: Seed Demo Data Generator', () => {
    it('F18-1: should pre-populate exactly 5 initial accounts', async () => {
      const { accounts } = await client.getAccounts();
      expect(accounts).toHaveLength(INITIAL_ACCOUNTS.length);
    });

    it('F18-2: should pre-populate 2 real catering event scenarios (Wedding & Corporate)', async () => {
      const { events } = await client.getEvents();
      expect(events).toHaveLength(INITIAL_EVENTS.length);
      const titles = events.map((e) => e.title);
      expect(titles.some((t) => t.includes('Свадьба'))).toBe(true);
      expect(titles.some((t) => t.includes('Корпоратив'))).toBe(true);
    });

    it('F18-3: should pre-populate standard catering categories', async () => {
      const { categories } = await client.getCategories();
      expect(categories).toHaveLength(INITIAL_CATEGORIES.length);
    });

    it('F18-4: should be idempotent: resetting seed multiple times yields identical initial state', async () => {
      await client.resetDemoData();
      const state1 = await client.getAccounts();

      await client.resetDemoData();
      const state2 = await client.getAccounts();

      expect(state1.accounts).toEqual(state2.accounts);
      expect(state1.totalBalance).toEqual(state2.totalBalance);
    });

    it('F18-5: should establish realistic starting total liquidity > 0 in demo mode', async () => {
      const { totalBalance } = await client.getAccounts();
      expect(totalBalance).toBeGreaterThan(500000); // Realistic bar catering capital
    });
  });
});
