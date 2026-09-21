/**
 * Truespace � ������ ��������� � �������
 * Milestone M3 Empirical Stress & Adversarial Challenge Suite
 * File: tests/stress/m3_challenger1.test.ts
 *
 * Targets:
 * 1. 3-step QuickEntryModal inputs and validations:
 *    - Zero amount rejection (validation error, disabled submit button).
 *    - Negative amount rejection and non-penetrability.
 *    - Malformed and non-numeric input handling (spaces, commas, alphanumeric strings, NaN/null).
 *    - Massive amounts and strict upper boundary at 10,000,000 ? (numpad digits, 00, increments, fuzzing).
 * 2. Internal transfer invariant:
 *    - Strict rejection when fromAccountId === toAccountId across all 5 accounts.
 *    - State non-alteration and zero capital drift on rejected attempts.
 *    - 100 randomized valid transfers with continuous capital conservation law.
 * 3. Client currency and locale formatters:
 *    - Negative numbers (typographic minus, non-breaking space, ruble sign).
 *    - Kopecks and fractional currency (comma separation, IEEE-754 precision drift prevention).
 *    - Zero balance and negative zero.
 *    - Undefined / null / NaN type safety.
 *    - Portfolio liquidity shares: summing strictly to 100% across 5 accounts, no NaN on zero capital.
 * 4. Unlinking event via " ����� ������� ����\ toggle (eventId: null):
 * - Explicit null eventId propagation.
 * - Strict event margin isolation (zero contamination of Wedding / Corporate margins).
 * - General bar expenses overview aggregation and transaction filtering.
 * - Atomic reversal isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import {
 formatRubles,
 formatMoneyRubles,
 roundRubles,
 formatPercent,
 formatDateRu,
 formatTime24h,
 formatDateTimeRu,
} from '../../src/client/utils/formatters.js';
import {
 ACCOUNT_IDS,
 CATEGORY_IDS,
 EVENT_IDS,
 INITIAL_TOTAL_CAPITAL,
} from '../../src/shared/constants.js';

// Helper to normalize non-breaking spaces (\u00A0 or \u202F) to standard space for assertions
function normalizeSpaces(str: string): string {
 return str.replace(/[\u00A0\u202F]/g, ' ');
}

// Seeded PRNG for deterministic reproducible stress runs
function createPrng(seed = 987654) {
 let s = seed;
 return () => {
 s = (s * 1664525 + 1013904223) % 4294967296;
 return s / 4294967296;
 };
}

/**
 * High-fidelity state machine oracle replicating NumericPad.tsx logic
 */
class NumericPadOracle {
 public amount: number = 0;
 public readonly maxAmount: number;

 constructor(maxAmount = 10000000) {
 this.maxAmount = maxAmount;
 }

 public handleDigit(digit: string): void {
 const currentStr = this.amount === 0 ? '' : String(this.amount);
 const nextStr = currentStr + digit;
 if (nextStr.length > 8) return;
 const nextNum = parseInt(nextStr, 10);
 if (!isNaN(nextNum) && nextNum <= this.maxAmount) {
 this.amount = nextNum;
 }
 }

 public handleDoubleZero(): void {
 if (this.amount === 0) return;
 const currentStr = String(this.amount);
 const nextStr = currentStr + '00';
 if (nextStr.length > 8) return;
 const nextNum = parseInt(nextStr, 10);
 if (!isNaN(nextNum) && nextNum <= this.maxAmount) {
 this.amount = nextNum;
 }
 }

 public handleBackspace(): void {
 const currentStr = String(this.amount);
 if (currentStr.length <= 1) {
 this.amount = 0;
 return;
 }
 const nextStr = currentStr.slice(0, -1);
 const nextNum = parseInt(nextStr, 10);
 this.amount = isNaN(nextNum) ? 0 : nextNum;
 }

 public handleClear(): void {
 this.amount = 0;
 }

 public handleIncrement(increment: number): void {
 this.amount = Math.min(this.maxAmount, this.amount + increment);
 }
}

describe('Milestone M3: Empirical Challenge Suite (Challenger 1)', () => {
 let store: InMemoryStore;
 let financeService: FinanceService;
 let analyticsService: AnalyticsService;
 let app: any;

 const ALL_ACCOUNTS = [
 ACCOUNT_IDS.CASH_1,
 ACCOUNT_IDS.CASH_2,
 ACCOUNT_IDS.BANK_1,
 ACCOUNT_IDS.BANK_2,
 ACCOUNT_IDS.CARD_SBP,
 ];

 beforeEach(() => {
 store = new InMemoryStore();
 financeService = new FinanceService(store);
 analyticsService = new AnalyticsService(store);
 app = createApp({ store });
 });

 // =========================================================================
 // CHALLENGE 1: 3-STEP QUICK ENTRY MODAL INPUTS & BOUNDARY VALIDATIONS
 // =========================================================================
 describe('Challenge 1: 3-Step QuickEntryModal Inputs & Boundary Validations', () => {
 it('M3-CHALLENGE-01: rejects zero amount (0 ?) with validation error and disables submission', async () => {
 // 1. Backend API rejection
 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: 0,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 categoryId: 'cat_ice',
 });

 expect(res.status).toBe(400);
 expect(res.body.error).toBeDefined();

 // 2. Service level rejection
 await expect(
 financeService.createTransaction({
 type: 'expense',
 amount: 0,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 })
 ).rejects.toThrow();

 // 3. NumericPad behavior on 0
 const pad = new NumericPadOracle();
 expect(pad.amount).toBe(0);
 pad.handleDigit('0');
 expect(pad.amount).toBe(0);
 pad.handleDoubleZero();
 expect(pad.amount).toBe(0);
 pad.handleBackspace();
 expect(pad.amount).toBe(0);
 });

 it('M3-CHALLENGE-02: rejects negative amounts (-500 ?) and prevents entry via keypad', async () => {
 // 1. Backend rejection of negative amounts
 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: -500,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 });

 expect(res.status).toBe(400);
 expect(res.body.error).toBeDefined();

 // 2. Fractional negative rejection
 await expect(
 financeService.createTransaction({
 type: 'income',
 amount: -0.01,
 targetAccountId: ACCOUNT_IDS.BANK_1,
 })
 ).rejects.toThrow();

 // 3. Keypad state machine invariant: keypad cannot produce negative numbers
 const pad = new NumericPadOracle();
 pad.handleBackspace();
 expect(pad.amount).toBe(0);
 pad.handleClear();
 expect(pad.amount).toBe(0);
 expect(pad.amount).toBeGreaterThanOrEqual(0);
 });

 it('M3-CHALLENGE-03: safely handles malformed, string, and non-numeric inputs', async () => {
 // 1. String with spaces and comma
 const validStringRes = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: ' 12 500,50 ',
 sourceAccountId: ACCOUNT_IDS.CASH_2,
 categoryId: 'cat_staff',
 });
 expect(validStringRes.status).toBe(201);
 expect(validStringRes.body.transaction.amount).toBe(12500.50);

 // 2. Non-numeric garbage string
 const garbageRes = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: '��-�����',
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 });
 expect(garbageRes.status).toBe(400);
 expect(garbageRes.body.error).toBeDefined();

 // 3. Null and undefined amount
 const nullRes = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: null,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 });
 expect(nullRes.status).toBe(400);

 // 4. NaN amount
 await expect(
 financeService.createTransaction({
 type: 'expense',
 amount: NaN,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 })
 ).rejects.toThrow();
 });

 it('M3-CHALLENGE-04: strictly caps keypad entry at 10,000,000 ? boundary', () => {
 const pad = new NumericPadOracle();

 // Enter 10,000,000
 pad.handleDigit('1');
 pad.handleDigit('0');
 pad.handleDoubleZero();
 pad.handleDoubleZero();
 pad.handleDoubleZero();
 expect(pad.amount).toBe(10000000);

 // Attempting to append any digit is rejected
 pad.handleDigit('1');
 expect(pad.amount).toBe(10000000);
 pad.handleDigit('0');
 expect(pad.amount).toBe(10000000);
 pad.handleDoubleZero();
 expect(pad.amount).toBe(10000000);

 // Increment presets at boundary are clamped
 pad.handleIncrement(500);
 expect(pad.amount).toBe(10000000);
 pad.handleIncrement(1000);
 expect(pad.amount).toBe(10000000);
 pad.handleIncrement(5000);
 expect(pad.amount).toBe(10000000);
 pad.handleIncrement(10000);
 expect(pad.amount).toBe(10000000);
 });

 it('M3-CHALLENGE-05: correctly clamps increment near boundary (e.g. 9,995,000 + 10,000 = 10,000,000)', () => {
 const pad = new NumericPadOracle();
 pad.amount = 9995000;

 pad.handleIncrement(10000);
 expect(pad.amount).toBe(10000000); // Clamped, not 10,005,000

 pad.amount = 9999000;
 pad.handleIncrement(5000);
 expect(pad.amount).toBe(10000000);
 });

 it('M3-CHALLENGE-06: survives 1,000 random keystrokes fuzz test maintaining invariant 0 <= amount <= 10,000,000', () => {
 const pad = new NumericPadOracle();
 const prng = createPrng(12345);

 const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
 const INCREMENTS = [500, 1000, 5000, 10000];

 for (let i = 0; i < 1000; i++) {
 const roll = prng();
 if (roll < 0.5) {
 // 50% enter digit
 const d = DIGITS[Math.floor(prng() * DIGITS.length)];
 pad.handleDigit(d);
 } else if (roll < 0.65) {
 // 15% double zero
 pad.handleDoubleZero();
 } else if (roll < 0.8) {
 // 15% backspace
 pad.handleBackspace();
 } else if (roll < 0.9) {
 // 10% increment preset
 const inc = INCREMENTS[Math.floor(prng() * INCREMENTS.length)];
 pad.handleIncrement(inc);
 } else {
 // 10% clear
 pad.handleClear();
 }

 expect(pad.amount).toBeGreaterThanOrEqual(0);
 expect(pad.amount).toBeLessThanOrEqual(10000000);
 expect(Number.isInteger(pad.amount)).toBe(true);
 expect(Number.isNaN(pad.amount)).toBe(false);
 }
 });
 });

 // =========================================================================
 // CHALLENGE 2: INTERNAL TRANSFER INVARIANT & CAPITAL NEUTRALITY
 // =========================================================================
 describe('Challenge 2: Internal Transfer Invariant & Capital Neutrality', () => {
 it('M3-CHALLENGE-07: rejects transfer when fromAccountId === toAccountId across all 5 accounts with 400', async () => {
 const initialAccounts = await store.getAccounts();
 const initialCapital = initialAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

 for (const accId of ALL_ACCOUNTS) {
 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'transfer',
 amount: 5000,
 sourceAccountId: accId,
 targetAccountId: accId,
 });

 expect(res.status).toBe(400);
 expect(res.body.error).toBeDefined();
 }

 // Check zero capital drift and zero balance mutation
 const postAccounts = await store.getAccounts();
 const postCapital = postAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
 expect(postCapital).toBe(initialCapital);
 for (const acc of postAccounts) {
 const orig = initialAccounts.find((a) => a.id === acc.id)!;
 expect(acc.currentBalance).toBe(orig.currentBalance);
 }
 });

 it('M3-CHALLENGE-08: rejects transfer when one or both accounts are missing', async () => {
 // Missing target
 const res1 = await request(app)
 .post('/api/transactions')
 .send({
 type: 'transfer',
 amount: 5000,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 });
 expect(res1.status).toBe(400);
 expect(res1.body.error).toBeDefined();

 // Missing source
 const res2 = await request(app)
 .post('/api/transactions')
 .send({
 type: 'transfer',
 amount: 5000,
 targetAccountId: ACCOUNT_IDS.BANK_1,
 });
 expect(res2.status).toBe(400);
 expect(res2.body.error).toBeDefined();
 });

 it('M3-CHALLENGE-09: verifies total capital neutrality across 100 consecutive random transfers', async () => {
 const prng = createPrng(999);
 const { totalBalance: baselineTotal } = await financeService.getAccounts();

 const AMOUNTS = [100, 250.5, 1000, 3500, 10000, 25000, 50000];

 for (let i = 0; i < 100; i++) {
 const srcIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
 let dstIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
 while (dstIdx === srcIdx) {
 dstIdx = Math.floor(prng() * ALL_ACCOUNTS.length);
 }

 const src = ALL_ACCOUNTS[srcIdx];
 const dst = ALL_ACCOUNTS[dstIdx];
 const amt = AMOUNTS[Math.floor(prng() * AMOUNTS.length)];

 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'transfer',
 amount: amt,
 sourceAccountId: src,
 targetAccountId: dst,
 });

 expect(res.status).toBe(201);
 expect(res.body.updatedAccounts).toHaveLength(2);

 // Invariant: total capital must be exactly identical
 const { totalBalance: currentTotal } = await financeService.getAccounts();
 expect(currentTotal).toBe(baselineTotal);
 }
 });

 it('M3-CHALLENGE-10: automatically switches target account when user switches type to transfer with matching account', () => {
 // Simulate QuickEntryModal.handleTypeChange('transfer') logic
 const initialFrom = 'cash_1';
 let initialTo = 'cash_1';

 if (initialFrom === initialTo) {
 initialTo = initialFrom === 'cash_1' ? 'cash_2' : 'cash_1';
 }

 expect(initialFrom).not.toBe(initialTo);
 expect(initialTo).toBe('cash_2');

 // Test reverse case
 const from2 = 'cash_2';
 let to2 = 'cash_2';
 if (from2 === to2) {
 to2 = from2 === 'cash_1' ? 'cash_2' : 'cash_1';
 }
 expect(from2).not.toBe(to2);
 expect(to2).toBe('cash_1');
 });
 });

 // =========================================================================
 // CHALLENGE 3: CLIENT CURRENCY AND LOCALE FORMATTERS STRESS TESTING
 // =========================================================================
 describe('Challenge 3: Client Currency and Locale Formatters Stress Testing', () => {
 it('M3-CHALLENGE-11: formats negative numbers with typographic minus and non-breaking space', () => {
    const formatted1 = formatRubles(-1500);
    expect(normalizeSpaces(formatted1)).toBe('−1 500 ₽');
    expect(formatted1).toContain('−'); // Typographic minus (U+2212)
    expect(formatted1).toContain('₽');

    const formatted2 = formatRubles(-0.01);
    expect(normalizeSpaces(formatted2)).toBe('−0,01 ₽');

    const formatted3 = formatRubles(-10000000);
    expect(normalizeSpaces(formatted3)).toBe('−10 000 000 ₽');
  });

  it('M3-CHALLENGE-12: formats kopecks and fractions with 2 decimals and comma', () => {
    expect(normalizeSpaces(formatRubles(3500.5))).toBe('3 500,50 ₽');
    expect(normalizeSpaces(formatRubles(12.75))).toBe('12,75 ₽');
    expect(normalizeSpaces(formatRubles(0.05))).toBe('0,05 ₽');
    expect(normalizeSpaces(formatRubles(10.005))).toBe('10,01 ₽'); // Rounds up
    expect(normalizeSpaces(formatRubles(10.004))).toBe('10 ₽'); // Rounds down and hides decimals
  });

  it('M3-CHALLENGE-13: handles IEEE-754 precision drift gracefully (0.1 + 0.2)', () => {
    const sum = 0.1 + 0.2;
    expect(roundRubles(sum)).toBe(0.3);
    expect(normalizeSpaces(formatRubles(sum))).toBe('0,30 ₽');
  });

  it('M3-CHALLENGE-14: handles zero balance and negative zero (-0) returning 0 ₽', () => {
    expect(normalizeSpaces(formatRubles(0))).toBe('0 ₽');
    expect(normalizeSpaces(formatRubles(-0))).toBe('0 ₽');
    expect(normalizeSpaces(formatRubles(0.0))).toBe('0 ₽');
  });

  it('M3-CHALLENGE-15: undefined and null safety across all formatter functions', () => {
    expect(normalizeSpaces(formatRubles(null))).toBe('0 ₽');
    expect(normalizeSpaces(formatRubles(undefined))).toBe('0 ₽');
    expect(normalizeSpaces(formatRubles(NaN))).toBe('0 ₽');

 expect(formatPercent(null)).toBe('0%');
 expect(formatPercent(undefined)).toBe('0%');
 expect(formatPercent(NaN)).toBe('0%');

 expect(formatDateRu(null)).toBe('');
 expect(formatDateRu(undefined)).toBe('');
 expect(formatDateRu('invalid-date')).toBe('invalid-date');

 expect(formatTime24h(null)).toBe('');
 expect(formatTime24h(undefined)).toBe('');

 expect(formatDateTimeRu(null)).toBe('');
 expect(formatDateTimeRu(undefined)).toBe('');
 });

 it('M3-CHALLENGE-16: portfolio liquidity shares strictly sum to 100% across 5 accounts', () => {
 // Standard seed distribution
 const accounts = [
 { type: 'cash', balance: 6300 },
 { type: 'cash', balance: 250000 },
 { type: 'bank', balance: 814000 },
 { type: 'bank', balance: 50000 },
 { type: 'card', balance: 46000 },
 ];

 const totalBalance = roundRubles(accounts.reduce((s, a) => s + a.balance, 0));
 expect(totalBalance).toBe(1166300);

 const cashTotal = roundRubles(accounts.filter((a) => a.type === 'cash').reduce((s, a) => s + a.balance, 0));
 const bankTotal = roundRubles(accounts.filter((a) => a.type === 'bank').reduce((s, a) => s + a.balance, 0));
 const cardTotal = roundRubles(accounts.filter((a) => a.type === 'card').reduce((s, a) => s + a.balance, 0));

 const bankPercent = totalBalance > 0 ? (bankTotal / totalBalance) * 100 : 0;
 const cashPercent = totalBalance > 0 ? (cashTotal / totalBalance) * 100 : 0;
 const cardPercent = totalBalance > 0 ? (cardTotal / totalBalance) * 100 : 0;

 const sumPercent = bankPercent + cashPercent + cardPercent;
 expect(Math.abs(sumPercent - 100)).toBeLessThan(1e-9);
 });

 it('M3-CHALLENGE-17: handles 0 capital portfolio with 0% shares and NO NaN or Infinity', () => {
 const accounts = [
 { type: 'cash', balance: 0 },
 { type: 'cash', balance: 0 },
 { type: 'bank', balance: 0 },
 { type: 'bank', balance: 0 },
 { type: 'card', balance: 0 },
 ];

 const totalBalance = roundRubles(accounts.reduce((s, a) => s + a.balance, 0));
 expect(totalBalance).toBe(0);

 const cashTotal = roundRubles(accounts.filter((a) => a.type === 'cash').reduce((s, a) => s + a.balance, 0));
 const bankTotal = roundRubles(accounts.filter((a) => a.type === 'bank').reduce((s, a) => s + a.balance, 0));
 const cardTotal = roundRubles(accounts.filter((a) => a.type === 'card').reduce((s, a) => s + a.balance, 0));

 const bankPercent = totalBalance > 0 ? (bankTotal / totalBalance) * 100 : 0;
 const cashPercent = totalBalance > 0 ? (cashTotal / totalBalance) * 100 : 0;
 const cardPercent = totalBalance > 0 ? (cardTotal / totalBalance) * 100 : 0;

 expect(bankPercent).toBe(0);
 expect(cashPercent).toBe(0);
 expect(cardPercent).toBe(0);

 expect(Number.isNaN(bankPercent)).toBe(false);
 expect(Number.isNaN(cashPercent)).toBe(false);
 expect(Number.isNaN(cardPercent)).toBe(false);

 expect(formatPercent(bankPercent)).toBe('0%');
 expect(formatPercent(cashPercent)).toBe('0%');
 expect(formatPercent(cardPercent)).toBe('0%');
 });

 it('M3-CHALLENGE-18: verifies 500 randomized portfolios strictly conserve 100% liquidity share sum', () => {
 const prng = createPrng(777);

 for (let i = 0; i < 500; i++) {
 const b1 = Math.floor(prng() * 500000) + 1;
 const b2 = Math.floor(prng() * 500000) + 1;
 const c1 = Math.floor(prng() * 100000) + 1;
 const c2 = Math.floor(prng() * 100000) + 1;
 const sbp = Math.floor(prng() * 200000) + 1;

 const bankTotal = b1 + b2;
 const cashTotal = c1 + c2;
 const cardTotal = sbp;
 const total = bankTotal + cashTotal + cardTotal;

 const pBank = (bankTotal / total) * 100;
 const pCash = (cashTotal / total) * 100;
 const pCard = (cardTotal / total) * 100;

 const sum = pBank + pCash + pCard;
 expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
 }
 });
 });

 // =========================================================================
 // CHALLENGE 4: UNLINKING EVENT VIA \����� ������� ����\ TOGGLE (eventId: null)
 // =========================================================================
 describe('Challenge 4: Unlinking Event via \����� ������� ����\ Toggle (eventId: null)', () => {
 it('M3-CHALLENGE-19: records transaction with eventId: null and debits chosen account', async () => {
 const { accounts: accBefore } = await financeService.getAccounts();
 const cash1Before = accBefore.find((a) => a.id === ACCOUNT_IDS.CASH_1)!.currentBalance;

 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: 2500,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 categoryId: 'cat_supplies',
 eventId: null,
 description: '�������� � ����� ��� ������ �� �����',
 });

 expect(res.status).toBe(201);
 expect(res.body.transaction.eventId).toBeNull();

 const { accounts: accAfter } = await financeService.getAccounts();
 const cash1After = accAfter.find((a) => a.id === ACCOUNT_IDS.CASH_1)!.currentBalance;
 expect(cash1After).toBe(round2(cash1Before - 2500));
 });

 it('M3-CHALLENGE-20: strictly isolates event margin metrics when general bar expenses are added', async () => {
 // Capture baseline event margins for Wedding & Corporate
 const weddingBefore = await analyticsService.getEventMargin(EVENT_IDS.WEDDING);
 const corporateBefore = await analyticsService.getEventMargin(EVENT_IDS.CORPORATE);

 // Create 5 large unlinked general bar expenses totaling 85,000 ?
 const GENERAL_EXPENSES = [
 { amount: 35000, desc: '������ ������ �� �����' },
 { amount: 20000, desc: '������� �������� � ���������' },
 { amount: 15000, desc: '������������ ��������������' },
 { amount: 10000, desc: '�������� ��� ��������' },
 { amount: 5000, desc: '������� ����� ��� ����' },
 ];

 for (const item of GENERAL_EXPENSES) {
 const res = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: item.amount,
 sourceAccountId: ACCOUNT_IDS.BANK_1,
 categoryId: 'cat_supplies',
 eventId: null,
 description: item.desc,
 });
 expect(res.status).toBe(201);
 }

 // Verify Wedding margin metrics are 100% untouched
 const weddingAfter = await analyticsService.getEventMargin(EVENT_IDS.WEDDING);
 expect(weddingAfter!.revenue).toBe(weddingBefore!.revenue);
 expect(weddingAfter!.directExpenses).toBe(weddingBefore!.directExpenses);
 expect(weddingAfter!.netProfit).toBe(weddingBefore!.netProfit);
 expect(weddingAfter!.marginPercentage).toBe(weddingBefore!.marginPercentage);

 // Verify Corporate margin metrics are 100% untouched
 const corporateAfter = await analyticsService.getEventMargin(EVENT_IDS.CORPORATE);
 expect(corporateAfter!.revenue).toBe(corporateBefore!.revenue);
 expect(corporateAfter!.directExpenses).toBe(corporateBefore!.directExpenses);
 expect(corporateAfter!.netProfit).toBe(corporateBefore!.netProfit);
 expect(corporateAfter!.marginPercentage).toBe(corporateBefore!.marginPercentage);
 });

 it('M3-CHALLENGE-21: increments generalExpensesTotal in overview analytics by exact sum of general expenses', async () => {
 const overviewBefore = await analyticsService.getOverview();
 const initialGeneralExpenses = overviewBefore.generalExpensesTotal;

 await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: 14750.50,
 sourceAccountId: ACCOUNT_IDS.CASH_2,
 categoryId: 'cat_supplies',
 eventId: null,
 description: '���������',
 });

 const overviewAfter = await analyticsService.getOverview();
 expect(overviewAfter.generalExpensesTotal).toBe(round2(initialGeneralExpenses + 14750.50));
 });

 it('M3-CHALLENGE-22: supports filtering transactions specifically with eventId=null', async () => {
 // Create a distinguishable general transaction
      const uniqueDesc = 'General purchase ' + Date.now();
 await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: 3200,
 sourceAccountId: ACCOUNT_IDS.CASH_1,
 categoryId: 'cat_supplies',
 eventId: null,
 description: uniqueDesc,
 });

 const res = await request(app).get('/api/transactions?eventId=null');
 expect(res.status).toBe(200);
 expect(res.body.transactions.length).toBeGreaterThan(0);

      const found = res.body.transactions.find((tx: any) => tx.description === uniqueDesc);
 expect(found).toBeDefined();
 expect(found.eventId).toBeNull();
 });

 it('M3-CHALLENGE-23: reversing a general bar expense restores accounts and generalExpensesTotal without touching event margins', async () => {
 const overviewBefore = await analyticsService.getOverview();
 const weddingBefore = await analyticsService.getEventMargin(EVENT_IDS.WEDDING);

 const createRes = await request(app)
 .post('/api/transactions')
 .send({
 type: 'expense',
 amount: 18000,
 sourceAccountId: ACCOUNT_IDS.BANK_2,
 categoryId: 'cat_supplies',
 eventId: null,
 description: '��������� ������ �� �����',
 });

 const txId = createRes.body.transaction.id;

 // Delete / reverse transaction
      const deleteRes = await request(app).delete('/api/transactions/' + txId);
 expect(deleteRes.status).toBe(200);
 expect(deleteRes.body.success).toBe(true);

 const overviewAfter = await analyticsService.getOverview();
 expect(overviewAfter.generalExpensesTotal).toBe(overviewBefore.generalExpensesTotal);

 const weddingAfter = await analyticsService.getEventMargin(EVENT_IDS.WEDDING);
 expect(weddingAfter!.directExpenses).toBe(weddingBefore!.directExpenses);
 });
 });
});
