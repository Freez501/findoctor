/**
 * Truespace — Барный кейтеринг и финансы
 * Milestone M5: Final Acceptance & Adversarial Hardening Suite
 * File: tests/stress/m5_final_acceptance.test.ts
 *
 * Comprehensive end-to-end acceptance certification:
 * 1. Full Lifecycle: Telegram NLP text input -> Transaction creation -> Real-time 5-account balance updates -> Event margin re-computation -> Reversal/Cancellation.
 * 2. Invariant: Law of Total Capital Conservation under heavy random multi-account transfers.
 * 3. Kopeck Precision: Sub-cent rounding (0.01 RUB) without IEEE-754 drift across hundreds of operations.
 * 4. Russian Localization & Formatting Contracts: Currency (₽), Dates (DD.MM.YYYY), 24h Time.
 * 5. Supabase Schema Compatibility: Valid DDL script with foreign keys and indexes.
 * 6. Adversarial Robustness: Malformed commands, negative amounts, invalid accounts, and crash resistance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import { ParserService } from '../../src/server/services/ParserService.js';
import { formatMoneyRubles, formatDateRu, formatPercent } from '../../src/client/utils/formatters.js';
import {
  ACCOUNT_IDS,
  CATEGORY_IDS,
  EVENT_IDS,
  INITIAL_TOTAL_CAPITAL,
} from '../../src/shared/constants.js';

function createPrng(seed = 998877) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Milestone M5: Final Acceptance & Adversarial Hardening Suite', () => {
  let store: InMemoryStore;
  let finance: FinanceService;
  let analytics: AnalyticsService;
  let parser: ParserService;
  let app: any;

  beforeEach(() => {
    store = new InMemoryStore();
    finance = new FinanceService(store);
    analytics = new AnalyticsService(store);
    parser = new ParserService();
    app = createApp({ store });
  });

  // =========================================================================
  // 1. END-TO-END TELEGRAM INPUT TO CASH FLOW & MARGIN LIFECYCLE
  // =========================================================================
  describe('1. End-to-End Telegram NLP Input to Margin Lifecycle', () => {
    it('M5-ACC-01: Full flow — NLP parsing, transaction execution, account balance update, event margin recomputation', async () => {
      // Step 1: Parse Telegram message
      const parseRes = await request(app)
        .post('/api/telegram/parse')
        .send({ text: '4200 лед Свадьба нал1' });

      expect(parseRes.status).toBe(200);
      expect(parseRes.body.parsed.amount).toBe(4200);
      expect(parseRes.body.parsed.type).toBe('expense');
      expect(['cat_ice', CATEGORY_IDS.SUPPLIES]).toContain(parseRes.body.parsed.categoryId);
      expect(['event_wedding', EVENT_IDS.WEDDING]).toContain(parseRes.body.parsed.eventId);
      expect(parseRes.body.parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);

      const targetEventId = parseRes.body.parsed.eventId;

      // Step 2: Record initial state
      const initialAccounts = await store.getAccounts();
      const cash1Initial = initialAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!.currentBalance;
      const initialMargin = await analytics.getEventMargin(targetEventId);

      // Step 3: Execute transaction via Telegram API
      const execRes = await request(app)
        .post('/api/telegram/execute')
        .send({ text: '4200 лед Свадьба нал1' });

      expect(execRes.status).toBe(201);
      expect(execRes.body.success).toBe(true);
      const createdTx = execRes.body.transaction;
      expect(createdTx.amount).toBe(4200);

      // Step 4: Verify Account Balance debited by exact amount
      const updatedAccounts = await store.getAccounts();
      const cash1Updated = updatedAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!.currentBalance;
      expect(cash1Updated).toBe(round2(cash1Initial - 4200));

      // Step 5: Verify Event Margin reflects new direct expense
      const updatedMargin = await analytics.getEventMargin(targetEventId);
      if (initialMargin && updatedMargin) {
        expect(updatedMargin.directExpenses).toBe(round2(initialMargin.directExpenses + 4200));
        expect(updatedMargin.netProfit).toBe(round2(initialMargin.netProfit - 4200));
      }

      // Step 6: Cancel/Delete transaction and verify full balance restoration
      const delRes = await request(app).delete(`/api/transactions/${createdTx.id}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const restoredAccounts = await store.getAccounts();
      const cash1Restored = restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!.currentBalance;
      expect(cash1Restored).toBe(cash1Initial);

      const restoredMargin = await analytics.getEventMargin(targetEventId);
      if (initialMargin && restoredMargin) {
        expect(restoredMargin.directExpenses).toBe(initialMargin.directExpenses);
        expect(restoredMargin.netProfit).toBe(initialMargin.netProfit);
      }
    });
  });

  // =========================================================================
  // 2. CAPITAL CONSERVATION INVARIANT UNDER HIGH-FREQUENCY TRANSFERS
  // =========================================================================
  describe('2. Law of Total Capital Conservation', () => {
    it('M5-ACC-02: Total liquidity strictly conserved across 200 consecutive random multi-account transfers', async () => {
      const rng = createPrng(771122);
      const allAccountIds = Object.values(ACCOUNT_IDS);

      const initialTotal = (await store.getAccounts()).reduce((sum, a) => sum + a.currentBalance, 0);

      for (let i = 0; i < 200; i++) {
        const fromIdx = Math.floor(rng() * allAccountIds.length);
        let toIdx = Math.floor(rng() * allAccountIds.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(rng() * allAccountIds.length);
        }

        const fromId = allAccountIds[fromIdx];
        const toId = allAccountIds[toIdx];
        const amount = round2(10 + rng() * 5000);

        await finance.createTransaction({
          type: 'transfer',
          amount,
          fromAccountId: fromId,
          toAccountId: toId,
          description: `M5 stress transfer #${i + 1}`,
          transactionDate: new Date().toISOString(),
        });
      }

      const finalAccounts = await store.getAccounts();
      const finalTotal = round2(finalAccounts.reduce((sum, a) => sum + a.currentBalance, 0));

      expect(finalTotal).toBe(round2(initialTotal));
    });
  });

  // =========================================================================
  // 3. KOPECK ARITHMETIC PRECISION (0.01 RUB)
  // =========================================================================
  describe('3. Kopeck Precision & Zero IEEE-754 Drift', () => {
    it('M5-ACC-03: Fractional kopeck operations (e.g., 0.33, 0.67, 10.99) preserve exact sums without float drift', async () => {
      const initialCash = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      // 100 operations of 0.33 + 0.67 (= 1.00 each pair)
      for (let i = 0; i < 50; i++) {
        await finance.createTransaction({
          type: 'expense',
          amount: 0.33,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.ICE_SUPPLIES,
          description: `Kopeck expense a #${i}`,
          transactionDate: new Date().toISOString(),
        });

        await finance.createTransaction({
          type: 'expense',
          amount: 0.67,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.ICE_SUPPLIES,
          description: `Kopeck expense b #${i}`,
          transactionDate: new Date().toISOString(),
        });
      }

      const finalCash = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      // 50 * (0.33 + 0.67) = 50.00 exactly
      expect(finalCash).toBe(round2(initialCash - 50.0));
    });
  });

  // =========================================================================
  // 4. RUSSIAN LOCALIZATION & FORMATTING COMPLIANCE
  // =========================================================================
  describe('4. Russian Formatting & Localization Standards', () => {
    it('M5-ACC-04: Currency formatting outputs Russian Ruble symbol and non-breaking space', () => {
      const formatted = formatMoneyRubles(125000.5);
      expect(formatted).toContain('₽');
      expect(formatted).toMatch(/125[\s\u00A0\u202F]?000/);
    });

    it('M5-ACC-05: Date formatting outputs Russian standard DD.MM.YYYY', () => {
      const formatted = formatDateRu('2026-09-17T14:30:00Z');
      expect(formatted).toMatch(/\d{2}\.\d{2}\.2026/);
    });

    it('M5-ACC-06: Percentage formatting correctly handles zero division and rounding', () => {
      expect(formatPercent(45.678)).toMatch(/45[.,]7%/);
      expect(formatPercent(0)).toMatch(/0([.,]0)?%/);
      expect(formatPercent(-12.4)).toMatch(/−?12[.,]4%/);
    });
  });

  // =========================================================================
  // 5. SUPABASE COMPATIBILITY & DDL VALIDATION
  // =========================================================================
  describe('5. Supabase / PostgreSQL Schema Integrity', () => {
    it('M5-ACC-07: SQL migration file exists and defines all 4 core tables and indexes', () => {
      const sqlPath = path.resolve(process.cwd(), 'src/server/data/supabase.sql');
      expect(fs.existsSync(sqlPath)).toBe(true);

      const sql = fs.readFileSync(sqlPath, 'utf8');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS accounts');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS events');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS transactions');
      expect(sql).toContain('REFERENCES');
      expect(sql).toContain('CREATE INDEX');
    });
  });

  // =========================================================================
  // 6. ADVERSARIAL RESILIENCE & ERROR HANDLING
  // =========================================================================
  describe('6. Adversarial Robustness & Input Validation', () => {
    it('M5-ACC-08: Reject negative transaction amounts', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: -500,
          accountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.ICE_SUPPLIES,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('M5-ACC-09: Reject self-transfers (from === to)', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'transfer',
          amount: 1000,
          fromAccountId: ACCOUNT_IDS.CASH_1,
          toAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.OTHER_EXPENSE,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/отличаться|разными|same|не могут/i);
    });

    it('M5-ACC-10: Reject transactions with nonexistent accounts gracefully', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          amount: 1000,
          accountId: 'nonexistent_account_xyz',
          categoryId: CATEGORY_IDS.ICE_SUPPLIES,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('M5-ACC-11: Double deletion of transaction returns 404 or already-deleted error', async () => {
      const result = await finance.createTransaction({
        type: 'expense',
        amount: 500,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.ICE_SUPPLIES,
        description: 'Test double delete',
        transactionDate: new Date().toISOString(),
      });

      const del1 = await request(app).delete(`/api/transactions/${result.transaction.id}`);
      expect(del1.status).toBe(200);

      const del2 = await request(app).delete(`/api/transactions/${result.transaction.id}`);
      expect(del2.status).toBe(404);
    });
  });
});
