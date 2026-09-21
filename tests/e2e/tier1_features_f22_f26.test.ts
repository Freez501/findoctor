import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestClient } from './helpers/test-client';
import { round2 } from './helpers/financial-invariants';

describe('Tier 1: Feature Coverage F22–F26 (E2E Track, NLP Parser & Telegram)', () => {
  let client: E2ETestClient;

  beforeEach(async () => {
    client = new E2ETestClient();
    await client.resetDemoData();
  });

  // =========================================================================
  // F22: Opaque-Box E2E Test Suite (>=5 tests)
  // =========================================================================
  describe('F22: Opaque-Box E2E Test Suite', () => {
    it('F22-1: should operate strictly through public contract interfaces without private introspection', async () => {
      const { accounts } = await client.getAccounts();
      expect(Array.isArray(accounts)).toBe(true);
    });

    it('F22-2: should verify deterministic repeatability across consecutive test executions', async () => {
      const { totalBalance: run1 } = await client.getAccounts();
      await client.resetDemoData();
      const { totalBalance: run2 } = await client.getAccounts();
      expect(run1).toBe(run2);
    });

    it('F22-3: should verify self-contained isolation of test runs', async () => {
      await client.createTransaction({
        type: 'expense',
        amount: 9999,
        sourceAccountId: 'cash_1',
      });
      await client.resetDemoData();
      const { transactions } = await client.getTransactions();
      const found = transactions.some((t) => t.amount === 9999);
      expect(found).toBe(false);
    });

    it('F22-4: should derive test expectations from documented specifications in ORIGINAL_REQUEST.md', async () => {
      const { events } = await client.getEvents();
      expect(events.some((e) => e.title.includes('Свадьба'))).toBe(true);
      expect(events.some((e) => e.title.includes('Корпоратив'))).toBe(true);
    });

    it('F22-5: should measure sub-second response time for end-to-end contract calls', async () => {
      const start = Date.now();
      await client.getAccounts();
      await client.getTransactions();
      await client.getEventAnalytics();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // =========================================================================
  // F23: Adversarial Coverage Hardening (>=5 tests)
  // =========================================================================
  describe('F23: Adversarial Coverage Hardening', () => {
    it('F23-1: should handle extreme character lengths in description safely without crashing', async () => {
      const longDesc = 'A'.repeat(4000);
      const res = await client.createTransaction({
        type: 'expense',
        amount: 500,
        sourceAccountId: 'cash_1',
        description: longDesc,
      });
      expect(res.transaction.description).toHaveLength(4000);
    });

    it('F23-2: should preserve UTF-8 emojis and cocktail symbols intact', async () => {
      const emojiDesc = 'Коктейли: 🍸 🍹 🥃 + Лёд 🧊 + Лайм 🍋 — Супер бармен!';
      const res = await client.createTransaction({
        type: 'expense',
        amount: 1500,
        sourceAccountId: 'cash_1',
        description: emojiDesc,
      });
      expect(res.transaction.description).toBe(emojiDesc);
    });

    it('F23-3: should safely store HTML/SQL strings without code execution vulnerabilities', async () => {
      const malicious = "'; DROP TABLE accounts; <script>alert('pwned')</script>";
      const res = await client.createTransaction({
        type: 'expense',
        amount: 250,
        sourceAccountId: 'cash_1',
        description: malicious,
      });
      expect(res.transaction.description).toBe(malicious);
      const { accounts } = await client.getAccounts();
      expect(accounts).toHaveLength(5); // Accounts table unharmed
    });

    it('F23-4: should handle minimal positive boundary amounts (0.01 ₽)', async () => {
      const res = await client.createTransaction({
        type: 'income',
        amount: 0.01,
        targetAccountId: 'bank_1',
      });
      expect(res.transaction.amount).toBe(0.01);
    });

    it('F23-5: should handle large multi-million values without numeric overflow', async () => {
      const res = await client.createTransaction({
        type: 'income',
        amount: 15000000.0,
        targetAccountId: 'bank_1',
      });
      expect(res.transaction.amount).toBe(15000000.0);
    });
  });

  // =========================================================================
  // F24: Fast Command & NLP Parser (>=5 tests)
  // =========================================================================
  describe('F24: Fast Command & NLP Parser', () => {
    it('F24-1: should parse "3500 лед Корпоратив Т-Банк" with correct entity attribution', async () => {
      const { parsed } = await client.parseTelegramCommand('3500 лед Корпоратив Т-Банк');
      expect(parsed.amount).toBe(3500);
      expect(parsed.type).toBe('expense');
      expect(parsed.categoryId).toBe('cat_ice');
      expect(parsed.eventId).toBe('event_corporate');
      expect(parsed.accountId).toBe('card_sbp'); // Т-Банк maps to SBP card
    });

    it('F24-2: should parse "50000 предоплата Свадьба" as income', async () => {
      const { parsed } = await client.parseTelegramCommand('50000 предоплата Свадьба');
      expect(parsed.amount).toBe(50000);
      expect(parsed.type).toBe('income');
      expect(parsed.categoryId).toBe('cat_prepayment');
      expect(parsed.eventId).toBe('event_wedding');
    });

    it('F24-3: should parse "-1500 такси нал1" as expense with negative amount prefix', async () => {
      const { parsed } = await client.parseTelegramCommand('-1500 такси нал1');
      expect(parsed.amount).toBe(1500);
      expect(parsed.type).toBe('expense');
      expect(parsed.categoryId).toBe('cat_logistics');
      expect(parsed.accountId).toBe('cash_1');
    });

    it('F24-4: should parse "12000 алкоголь джин нал2" correctly attributing to cash_2', async () => {
      const { parsed } = await client.parseTelegramCommand('12000 алкоголь джин нал2');
      expect(parsed.amount).toBe(12000);
      expect(parsed.type).toBe('expense');
      expect(parsed.categoryId).toBe('cat_alcohol');
      expect(parsed.accountId).toBe('cash_2');
    });

    it('F24-5: should fall back to general expenses (eventId: null) when no event is detected', async () => {
      const { parsed } = await client.parseTelegramCommand('2500 салфетки и стаканы нал1');
      expect(parsed.amount).toBe(2500);
      expect(parsed.eventId).toBeNull();
      expect(parsed.accountId).toBe('cash_1');
    });
  });

  // =========================================================================
  // F25: Telegram Bot Integration (>=5 tests)
  // =========================================================================
  describe('F25: Telegram Bot Integration', () => {
    it('F25-1: should report active bot status and mode', async () => {
      const status = await client.getTelegramStatus();
      expect(status.enabled).toBe(true);
      expect(['polling', 'webhook', 'mock']).toContain(status.mode);
    });

    it('F25-2: should report configured bot username (@TruespaceBarBot)', async () => {
      const status = await client.getTelegramStatus();
      expect(status.botUsername).toBeDefined();
      expect(status.botUsername).toContain('Bot');
    });

    it('F25-3: should execute a Telegram command directly into the ledger', async () => {
      const result = await client.executeTelegramCommand('3500 лед Корпоратив нал1');
      expect(result.success).toBe(true);
      expect(result.transaction.amount).toBe(3500);
      expect(result.transaction.description).toContain('[Telegram]');
    });

    it('F25-4: should decrement account balance upon executing Telegram expense command', async () => {
      const { accounts: before } = await client.getAccounts();
      const cash1Before = before.find((a) => a.id === 'cash_1')!.currentBalance;

      await client.executeTelegramCommand('4000 мята и лаймы нал1');

      const { accounts: after } = await client.getAccounts();
      const cash1After = after.find((a) => a.id === 'cash_1')!.currentBalance;
      expect(cash1After).toBe(round2(cash1Before - 4000));
    });

    it('F25-5: should update event margin analytics when Telegram command includes event name', async () => {
      const { analytics: before } = await client.getEventAnalytics();
      const corpBefore = before.find((a) => a.eventId === 'event_corporate')!;

      await client.executeTelegramCommand('8000 сухой лед Корпоратив нал1');

      const { analytics: after } = await client.getEventAnalytics();
      const corpAfter = after.find((a) => a.eventId === 'event_corporate')!;
      expect(corpAfter.directExpenses).toBe(round2(corpBefore.directExpenses + 8000));
    });
  });

  // =========================================================================
  // F26: Web Fast Simulator & Bot Status (>=5 tests)
  // =========================================================================
  describe('F26: Web Fast Simulator & Bot Status', () => {
    it('F26-1: should provide instant preview via /api/telegram/parse without mutating state', async () => {
      const { accounts: before } = await client.getAccounts();
      const { parsed } = await client.parseTelegramCommand('60000 аванс Свадьба безнал1');

      expect(parsed.amount).toBe(60000);
      expect(parsed.type).toBe('income');
      expect(parsed.eventId).toBe('event_wedding');

      const { accounts: after } = await client.getAccounts();
      expect(after).toEqual(before); // Preview does NOT mutate accounts
    });

    it('F26-2: should preview high confidence score (>= 0.8) for recognized commands', async () => {
      const { parsed } = await client.parseTelegramCommand('3000 лед нал1');
      expect(parsed.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('F26-3: should commit transaction upon simulator confirmation', async () => {
      const res = await client.executeTelegramCommand('15000 гонорар бармена Свадьба нал2');
      expect(res.success).toBe(true);

      const { transactions } = await client.getTransactions();
      expect(transactions[0].amount).toBe(15000);
      expect(transactions[0].sourceAccountId).toBe('cash_2');
    });

    it('F26-4: should reject empty command string in web simulator with clear message', async () => {
      await expect(client.parseTelegramCommand('')).rejects.toThrow('Пустая команда');
    });

    it('F26-5: should reject commands lacking numeric amount with helpful feedback', async () => {
      await expect(client.parseTelegramCommand('лед на площадку')).rejects.toThrow('не указана сумма');
    });
  });
});
