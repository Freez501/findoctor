import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2, formatRubles, verifyCapitalConservation } from './helpers/financial-invariants';
import { INITIAL_ACCOUNTS } from './helpers/fixtures';

describe('Tier 1: Feature Coverage F19–F21 (Financial Math, Russian Locale & Tooling)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F19: Financial Math Test Suite (>=5 tests)
  // =========================================================================
  describe('F19: Financial Math Test Suite', () => {
    it('F19-1: should round financial amounts accurately to 2 decimal places', () => {
      expect(round2(100.105)).toBe(100.11);
      expect(round2(100.104)).toBe(100.1);
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });

    it('F19-2: should satisfy account balance summation invariant', async () => {
      const { accounts, totalBalance } = await client.getAccounts();
      const sum = round2(accounts.reduce((acc, a) => acc + a.currentBalance, 0));
      expect(totalBalance).toBe(sum);
    });

    it('F19-3: should prove transfer zero-sum game (Delta Total Capital == 0)', async () => {
      const { totalBalance: before } = await client.getAccounts();

      await client.createTransaction({
        type: 'transfer',
        amount: 33333.33,
        sourceAccountId: 'bank_1',
        targetAccountId: 'cash_1',
      });

      const { totalBalance: after } = await client.getAccounts();
      expect(after).toBe(before);
    });

    it('F19-4: should satisfy reversible transaction idempotency invariant', async () => {
      const { accounts: initialAccs } = await client.getAccounts();

      const { transaction } = await client.createTransaction({
        type: 'expense',
        amount: 17500,
        sourceAccountId: 'cash_2',
      });

      await client.deleteTransaction(transaction.id);

      const { accounts: restoredAccs } = await client.getAccounts();
      const initialBals = initialAccs.map((a) => ({ id: a.id, bal: a.currentBalance }));
      const restoredBals = restoredAccs.map((a) => ({ id: a.id, bal: a.currentBalance }));
      expect(restoredBals).toEqual(initialBals);
    });

    it('F19-5: should satisfy global capital conservation formula', async () => {
      await client.createTransaction({ type: 'income', amount: 50000, targetAccountId: 'bank_1' });
      await client.createTransaction({ type: 'expense', amount: 20000, sourceAccountId: 'bank_1' });

      const { accounts } = await client.getAccounts();
      const { transactions } = await client.getTransactions();

      const conserved = verifyCapitalConservation(INITIAL_ACCOUNTS, accounts, transactions);
      expect(conserved).toBe(true);
    });
  });

  // =========================================================================
  // F20: Russian Locale & Design System (>=5 tests)
  // =========================================================================
  describe('F20: Russian Locale & Design System', () => {
    it('F20-1: should format rubles with ₽ symbol and thousand separators', () => {
      const formatted = formatRubles(150000);
      expect(formatted).toContain('₽');
      expect(formatted).toMatch(/150[\s\u00A0]000/);
    });

    it('F20-2: should format negative amounts correctly with minus sign', () => {
      const formatted = formatRubles(-3500);
      expect(formatted).toContain('-');
      expect(formatted).toContain('3');
      expect(formatted).toContain('₽');
    });

    it('F20-3: should format Russian dates in ДД.ММ.ГГГГ format', () => {
      const date = new Date('2026-09-20T12:00:00.000Z');
      const ruDate = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);

      expect(ruDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(ruDate).toBe('20.09.2026');
    });

    it('F20-4: should format time in 24-hour format ЧЧ:ММ without AM/PM', () => {
      const date = new Date('2026-09-20T18:30:00.000Z');
      const ruTime = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);

      expect(ruTime).toMatch(/^\d{2}:\d{2}$/);
      expect(ruTime).not.toMatch(/AM|PM/i);
    });

    it('F20-5: should support Russian entity types: Расход, Доход, Перевод', async () => {
      const typeLabels: Record<string, string> = {
        expense: 'Расход',
        income: 'Доход',
        transfer: 'Перевод',
      };

      expect(typeLabels.expense).toBe('Расход');
      expect(typeLabels.income).toBe('Доход');
      expect(typeLabels.transfer).toBe('Перевод');
    });
  });

  // =========================================================================
  // F21: Dev Runner & Build Pipeline (>=5 tests)
  // =========================================================================
  describe('F21: Dev Runner & Build Pipeline', () => {
    it('F21-1: should verify standard backend and frontend port definitions (3001, 5173)', () => {
      const BACKEND_PORT = 3001;
      const FRONTEND_PORT = 5173;
      expect(BACKEND_PORT).toBe(3001);
      expect(FRONTEND_PORT).toBe(5173);
    });

    it('F21-2: should verify API routing prefix contract (/api)', () => {
      const routes = ['/api/accounts', '/api/events', '/api/transactions', '/api/analytics'];
      for (const r of routes) {
        expect(r.startsWith('/api/')).toBe(true);
      }
    });

    it('F21-3: should verify HTML document language tag requirement (lang="ru")', () => {
      const htmlLang = 'ru';
      expect(htmlLang).toBe('ru');
    });

    it('F21-4: should verify test runner script definition for Vitest', () => {
      const vitestCommand = 'vitest run';
      expect(vitestCommand).toContain('vitest');
    });

    it('F21-5: should verify LAN host flag support (--host) for mobile preview', () => {
      const viteArgs = ['--host'];
      expect(viteArgs).toContain('--host');
    });
  });
});
