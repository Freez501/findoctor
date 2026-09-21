/**
 * Truespace Bar Catering Finance — Adversarial Stress Test Harness for Milestone M2
 * File: tests/unit/m2_parser_telegram_stress.test.ts
 *
 * Empirical verification of:
 * 1. ParserService Cyrillic typography, casing & normalization resilience (ALL-CAPS, mixed, Ё/Е).
 * 2. Whitespace, punctuation & currency symbol handling (NBSP, narrow NBSP, tabs, quotes, brackets).
 * 3. Missing field resolution, category deduction, and default account fallback ('cash_1').
 * 4. Boundary numbers, invalid amounts, negative prefixes, and sub-kopeck zeroing.
 * 5. Exception safety & structured output schema invariants across 1,000 randomized fuzz runs.
 * 6. High-throughput batch parsing (10,000 iterations) and ReDoS catastrophic backtracking immunity.
 * 7. TelegramBotService operational status, command parsing, and live ledger execution.
 * 8. Financial ledger consistency & balance conservation under sequential TelegramBot transactions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ParserService, ParseOptions } from '../../src/server/services/ParserService.js';
import { TelegramBotService } from '../../src/server/telegram/TelegramBotService.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { ACCOUNT_IDS, EVENT_IDS } from '../../src/shared/constants.js';
import { ParsedCommand } from '../../src/shared/types.js';

describe('Milestone M2 Adversarial Challenge: ParserService & TelegramBotService', () => {
  let parser: ParserService;
  let store: InMemoryStore;
  let finance: FinanceService;
  let bot: TelegramBotService;

  beforeEach(() => {
    parser = new ParserService();
    store = new InMemoryStore();
    finance = new FinanceService(store);
    bot = new TelegramBotService(finance, parser);
  });

  // =========================================================================
  // 1. CASING & CYRILLIC TYPOGRAPHY RESILIENCE
  // =========================================================================
  describe('Challenge 1: Casing, Diacritics & Cyrillic Typography', () => {
    it('should parse ALL-UPPERCASE Russian commands identically to lowercase', () => {
      const parsed = parser.parse('3500 ЛЕД КОРПОРАТИВ Т-БАНК');
      expect(parsed.amount).toBe(3500);
      expect(parsed.type).toBe('expense');
      expect(parsed.categoryId).toBe('cat_ice');
      expect(parsed.eventId).toBe('event_corporate');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CARD_SBP);
      expect(parsed.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should parse chaotic MiXeD-CaSe commands with identical classification', () => {
      const parsed = parser.parse('50000 ПрЕдОпЛаТа СвАдЬбА бЕзНаЛ1');
      expect(parsed.amount).toBe(50000);
      expect(parsed.type).toBe('income');
      expect(parsed.categoryId).toBe('cat_prepayment');
      expect(parsed.eventId).toBe('event_wedding');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.BANK_1);
    });

    it('should handle Russian letter "Ё" vs "Е" interchangeability (лёд vs лед, счёт vs счет)', () => {
      const parsedYo = parser.parse('2800 лёд нал1');
      const parsedYe = parser.parse('2800 лед нал1');
      expect(parsedYo.categoryId).toBe('cat_ice');
      expect(parsedYe.categoryId).toBe('cat_ice');
      expect(parsedYo.categoryId).toBe(parsedYe.categoryId);

      const parsedAccYo = parser.parse('15000 аванс счёт');
      const parsedAccYe = parser.parse('15000 аванс счет');
      expect(parsedAccYo.accountId).toBe(ACCOUNT_IDS.BANK_1);
      expect(parsedAccYe.accountId).toBe(ACCOUNT_IDS.BANK_1);
    });

    it('should handle groom/event name variations ("Артём" vs "Артем")', () => {
      const p1 = parser.parse('45000 предоплата свадьба Артём и Анна');
      const p2 = parser.parse('45000 предоплата свадьба Артем и Анна');
      expect(p1.eventId).toBe('event_wedding');
      expect(p2.eventId).toBe('event_wedding');
    });
  });

  // =========================================================================
  // 2. WHITESPACE, SEPARATORS & PUNCTUATION CHAOS
  // =========================================================================
  describe('Challenge 2: Whitespace, Grouping Separators & Punctuation Chaos', () => {
    it('should parse amounts with multiple consecutive spaces and trailing whitespace', () => {
      const parsed = parser.parse('   3500      лед      Корпоратив    ');
      expect(parsed.amount).toBe(3500);
      expect(parsed.categoryId).toBe('cat_ice');
      expect(parsed.eventId).toBe('event_corporate');
    });

    it('should parse amounts formatted with space as thousand separator (e.g., "100 000")', () => {
      const parsed = parser.parse('100 000 предоплата Свадьба р/с');
      expect(parsed.amount).toBe(100000);
      expect(parsed.type).toBe('income');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.BANK_1);
    });

    it('should parse non-breaking spaces (\\u00A0) and narrow no-break spaces (\\u202F) commonly copied from bank apps', () => {
      const nbspText = '35\u00A0000\u00A0предоплата\u00A0Свадьба';
      const parsedNbsp = parser.parse(nbspText);
      expect(parsedNbsp.amount).toBe(35000);
      expect(parsedNbsp.type).toBe('income');

      const narrowNbspText = '12\u202F500\u202Fалкоголь\u202Fнал2';
      const parsedNarrow = parser.parse(narrowNbspText);
      expect(parsedNarrow.amount).toBe(12500);
      expect(parsedNarrow.accountId).toBe(ACCOUNT_IDS.CASH_2);
    });

    it('should parse underscore thousand separators (e.g. "50_000")', () => {
      const parsed = parser.parse('50_000 предоплата');
      expect(parsed.amount).toBe(50000);
    });

    it('should handle leading and trailing tabs, carriage returns, and newlines', () => {
      const parsed = parser.parse('\r\n\t4500 мята и лаймы\r\n\t');
      expect(parsed.amount).toBe(4500);
      expect(parsed.categoryId).toBe('cat_ice');
    });

    it('should ignore decorative Russian and English quotes («», "", “”)', () => {
      const parsed = parser.parse('«3500» "лед" «Корпоратив» “Т-Банк”');
      expect(parsed.amount).toBe(3500);
      expect(parsed.categoryId).toBe('cat_ice');
      expect(parsed.eventId).toBe('event_corporate');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CARD_SBP);
    });

    it('should handle currency symbols and abbreviations (₽, руб, р., руб.)', () => {
      const p1 = parser.parse('3500₽ лед нал1');
      const p2 = parser.parse('3500 руб. лед нал1');
      const p3 = parser.parse('3500 р лед нал1');
      expect(p1.amount).toBe(3500);
      expect(p2.amount).toBe(3500);
      expect(p3.amount).toBe(3500);
    });

    it('should parse amounts wrapped in parentheses or brackets', () => {
      const parsed = parser.parse('(1500) [такси] {нал1}');
      expect(parsed.amount).toBe(1500);
      expect(parsed.categoryId).toBe('cat_logistics');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);
    });

    it('should parse comma-decimal and dot-decimal numbers identically', () => {
      const pComma = parser.parse('1250,50 лед нал1');
      const pDot = parser.parse('1250.50 лед нал1');
      expect(pComma.amount).toBe(1250.5);
      expect(pDot.amount).toBe(1250.5);
    });
  });

  // =========================================================================
  // 3. MISSING FIELDS, DEFAULTS & ACCOUNT FALLBACKS
  // =========================================================================
  describe('Challenge 3: Missing Fields & Account Fallback to cash_1', () => {
    it('should fall back to cash_1 when no account keyword is specified', () => {
      const parsed = parser.parse('3500 лед Корпоратив');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(parsed.accountName).toContain('Нал 1');
    });

    it('should fall back to cash_1 on minimal input with amount only', () => {
      const parsed = parser.parse('5000');
      expect(parsed.amount).toBe(5000);
      expect(parsed.type).toBe('expense');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);
      expect(parsed.categoryId).toBe('cat_supplies');
      expect(parsed.eventId).toBeNull();
      expect(parsed.isGeneralExpense).toBe(true);
    });

    it('should default to general bar expense (eventId: null, isGeneralExpense: true) when event is omitted', () => {
      const parsed = parser.parse('12000 алкоголь нал2');
      expect(parsed.eventId).toBeNull();
      expect(parsed.eventTitle).toBeNull();
      expect(parsed.isGeneralExpense).toBe(true);
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_2);
    });

    it('should default category to cat_supplies for expense when no category is matched', () => {
      const parsed = parser.parse('7500 Свадьба нал1');
      expect(parsed.categoryId).toBe('cat_supplies');
      expect(parsed.categoryName).toBe('Хозтовары бара');
    });

    it('should default category to cat_prepayment for income when no specific category is matched', () => {
      const parsed = parser.parse('40000 приход Свадьба р/с');
      expect(parsed.type).toBe('income');
      expect(parsed.categoryId).toBe('cat_prepayment');
    });

    it('should respect ParseOptions.defaultAccountId when provided and text has no account', () => {
      const options: ParseOptions = { defaultAccountId: ACCOUNT_IDS.BANK_1 };
      const parsed = parser.parse('5000 лед', options);
      expect(parsed.accountId).toBe(ACCOUNT_IDS.BANK_1);
    });

    it('should allow explicit text account to override ParseOptions.defaultAccountId', () => {
      const options: ParseOptions = { defaultAccountId: ACCOUNT_IDS.BANK_1 };
      const parsed = parser.parse('5000 лед нал2', options);
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_2); // Explicit beats default option
    });

    it('should respect ParseOptions.defaultEventId when text has no event', () => {
      const options: ParseOptions = { defaultEventId: EVENT_IDS.WEDDING };
      const parsed = parser.parse('3500 лед', options);
      expect(parsed.eventId).toBe(EVENT_IDS.WEDDING);
      expect(parsed.isGeneralExpense).toBe(false);
    });
  });

  // =========================================================================
  // 4. INVALID AMOUNTS, SIGNS & BOUNDARY VALUES
  // =========================================================================
  describe('Challenge 4: Invalid Amounts, Negative Prefixes & Boundary Values', () => {
    it('should parse negative amount prefix ("-1500 такси") as positive amount with expense type', () => {
      const parsed = parser.parse('-1500 такси нал1');
      expect(parsed.amount).toBe(1500);
      expect(parsed.type).toBe('expense');
    });

    it('should parse negative prefix with space ("- 1500 такси")', () => {
      const parsed = parser.parse('- 1500 такси нал1');
      expect(parsed.amount).toBe(1500);
      expect(parsed.type).toBe('expense');
    });

    it('should throw descriptive error for zero amount ("0", "0.00", "-0")', () => {
      expect(() => parser.parse('0 лед')).toThrow('Сумма должна быть больше нуля');
      expect(() => parser.parse('0.00 лед')).toThrow('Сумма должна быть больше нуля');
      expect(() => parser.parse('-0 такси')).toThrow('Сумма должна быть больше нуля');
      expect(() => parser.parse('-0.00 такси')).toThrow('Сумма должна быть больше нуля');
    });

    it('should throw descriptive error for sub-kopeck fractional amounts that round to zero ("0.001")', () => {
      expect(() => parser.parse('0.001 лед')).toThrow('Сумма должна быть больше нуля');
      expect(() => parser.parse('0.0049 лед')).toThrow('Сумма должна быть больше нуля');
    });

    it('should support minimal valid positive fractional amount (0.01 ₽)', () => {
      const parsed = parser.parse('0.01 тест нал1');
      expect(parsed.amount).toBe(0.01);
    });

    it('should support large amounts (up to 1 billion ₽) without floating point loss', () => {
      const parsed = parser.parse('100000000.50 предоплата безнал1');
      expect(parsed.amount).toBe(100000000.5);
    });

    it('should throw descriptive error on empty or whitespace-only inputs', () => {
      expect(() => parser.parse('')).toThrow('Пустая команда');
      expect(() => parser.parse('   ')).toThrow('Пустая команда');
      expect(() => parser.parse('\t\n  \r')).toThrow('Пустая команда');
    });

    it('should throw descriptive error when non-string types are passed', () => {
      expect(() => parser.parse(null as any)).toThrow('Пустая команда');
      expect(() => parser.parse(undefined as any)).toThrow('Пустая команда');
      expect(() => parser.parse(12345 as any)).toThrow('Пустая команда');
      expect(() => parser.parse({} as any)).toThrow('Пустая команда');
    });

    it('should throw descriptive error when no numeric digits are present in string', () => {
      expect(() => parser.parse('лед на площадку')).toThrow('В команде не указана сумма');
      expect(() => parser.parse('такси корпоратив')).toThrow('В команде не указана сумма');
      expect(() => parser.parse('предоплата свадьба')).toThrow('В команде не указана сумма');
    });

    it('should parse amount cleanly when multiple dots or commas are present in description', () => {
      const parsed = parser.parse('1500.25 лед... на площадку... Срочно!!!');
      expect(parsed.amount).toBe(1500.25);
    });
  });

  // =========================================================================
  // 5. STRUCTURED OUTPUT SCHEMA INVARIANTS & FUZZ TESTING
  // =========================================================================
  describe('Challenge 5: Safe Structured Output & Fuzz Testing', () => {
    const knownAccounts = new Set([
      ACCOUNT_IDS.CASH_1,
      ACCOUNT_IDS.CASH_2,
      ACCOUNT_IDS.BANK_1,
      ACCOUNT_IDS.BANK_2,
      ACCOUNT_IDS.CARD_SBP,
    ]);

    function assertValidStructuredOutput(result: ParsedCommand, originalText: string): void {
      expect(typeof result.amount).toBe('number');
      expect(Number.isFinite(result.amount)).toBe(true);
      expect(result.amount).toBeGreaterThan(0);

      expect(['income', 'expense']).toContain(result.type);
      expect(typeof result.categoryId).toBe('string');
      expect(result.categoryId.length).toBeGreaterThan(0);
      expect(typeof result.categoryName).toBe('string');

      if (result.eventId !== null) {
        expect(typeof result.eventId).toBe('string');
        expect(typeof result.eventTitle).toBe('string');
        expect(result.isGeneralExpense).toBe(false);
      } else {
        expect(result.eventTitle).toBeNull();
        expect(result.isGeneralExpense).toBe(true);
      }

      expect(knownAccounts.has(result.accountId as any)).toBe(true);
      expect(typeof result.accountName).toBe('string');

      expect(typeof result.confidence).toBe('number');
      expect(Number.isFinite(result.confidence)).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);

      expect(typeof result.rawText).toBe('string');
      expect(typeof result.description).toBe('string');
    }

    it('should guarantee schema invariants on canonical sample commands from specification', () => {
      const samples = [
        '3500 лед Корпоратив Т-Банк',
        '50000 предоплата Свадьба',
        '-1500 такси нал1',
        '12000 алкоголь джин нал2',
        '8000 гонорар бармена Свадьба нал2',
        '25000 доплата Корпоратив безнал1',
        '6500 чаевые нал1',
        '4200 хозтовары салфетки стаканы',
      ];

      for (const sample of samples) {
        const parsed = parser.parse(sample);
        assertValidStructuredOutput(parsed, sample);
      }
    });

    it('should never throw uncaught exceptions or produce NaN across 1,000 randomized fuzz strings', () => {
      const words = [
        'лед', 'мята', 'алкоголь', 'джин', 'ром', 'бармен', 'такси', 'свадьба',
        'корпоратив', 'т-банк', 'сбп', 'нал1', 'нал2', 'безнал1', 'безнал2',
        'предоплата', 'доплата', 'чаевые', 'касса', 'сейф', 'эквайринг',
        '!', '?', '.', ',', '«»', '-', '+', '₽', 'руб'
      ];

      // PRNG generator for reproducible fuzzing
      let seed = 123456789;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 1000; i++) {
        const tokenCount = Math.floor(nextRandom() * 6) + 1;
        const tokens: string[] = [];

        // 80% chance of inserting a number token
        if (nextRandom() > 0.2) {
          const num = Math.round(nextRandom() * 100000 * 100) / 100;
          tokens.push(num.toString());
        }

        for (let t = 0; t < tokenCount; t++) {
          const w = words[Math.floor(nextRandom() * words.length)];
          tokens.push(w);
        }

        const fuzzString = tokens.join(nextRandom() > 0.5 ? ' ' : '   ');

        try {
          const parsed = parser.parse(fuzzString);
          assertValidStructuredOutput(parsed, fuzzString);
        } catch (err: any) {
          // Clean, caught Errors are expected on invalid amounts or zero
          expect(err).toBeInstanceOf(Error);
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // 6. RAPID BATCH PARSING & ReDoS CATACLYSMIC BACKTRACKING AUDIT
  // =========================================================================
  describe('Challenge 6: Rapid Batch Throughput & ReDoS Immunity', () => {
    it('should parse 10,000 commands rapidly in batch with sustained throughput (> 10,000 ops/sec)', () => {
      const template = '3500 лед Корпоратив Т-Банк';
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        const res = parser.parse(template);
        expect(res.amount).toBe(3500);
      }

      const elapsed = Date.now() - start;
      const opsPerSec = (10000 / elapsed) * 1000;

      // Expect execution well under 1000ms (at least 10,000 ops/sec)
      expect(elapsed).toBeLessThan(1000);
      expect(opsPerSec).toBeGreaterThan(10000);
    });

    it('should resist ReDoS (Regular Expression Denial of Service) on hostile 20,000-character inputs', () => {
      // Test 1: Hostile chain of digits with repeated spaces
      const evilSpaces = '1' + ' 000'.repeat(5000); // 20,001 chars
      const start1 = Date.now();
      const res1 = parser.parse(evilSpaces);
      const elapsed1 = Date.now() - start1;
      expect(elapsed1).toBeLessThan(100);
      expect(res1.amount).toBeGreaterThan(0);

      // Test 2: Hostile repeating non-digits followed by digits
      const evilPrefix = 'a'.repeat(20000) + ' 5000 лед';
      const start2 = Date.now();
      const res2 = parser.parse(evilPrefix);
      const elapsed2 = Date.now() - start2;
      expect(elapsed2).toBeLessThan(100);
      expect(res2.amount).toBe(5000);

      // Test 3: Repeating punctuation without numbers
      const evilPunctuation = '!@#$%^&*()_+'.repeat(2000);
      const start3 = Date.now();
      expect(() => parser.parse(evilPunctuation)).toThrow();
      const elapsed3 = Date.now() - start3;
      expect(elapsed3).toBeLessThan(100);
    });
  });

  // =========================================================================
  // 7. TELEGRAM BOT SERVICE INTEGRATION & LEDGER MUTATION
  // =========================================================================
  describe('Challenge 7: TelegramBotService Status, Parsing & Ledger Execution', () => {
    it('should report operational bot status in mock mode with expected properties', () => {
      const status = bot.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.mode).toBe('mock');
      expect(status.botUsername).toBe('@TruespaceBarBot');
      expect(status.configuredToken).toBe(false);
      expect(status.message).toContain('симулятора');
      expect(typeof status.lastActiveAt).toBe('string');
    });

    it('should preview command parsing without mutating storage balances', async () => {
      const accountsBefore = await store.getAccounts();
      const totalBefore = accountsBefore.reduce((s, a) => s + a.currentBalance, 0);

      const preview = bot.parseCommand('60000 предоплата Свадьба р/с');
      expect(preview.parsed.amount).toBe(60000);
      expect(preview.parsed.type).toBe('income');
      expect(preview.parsed.accountId).toBe(ACCOUNT_IDS.BANK_1);

      const accountsAfter = await store.getAccounts();
      const totalAfter = accountsAfter.reduce((s, a) => s + a.currentBalance, 0);
      expect(totalAfter).toBe(totalBefore); // Strictly non-mutating
    });

    it('should execute command through bot and record transaction with [Telegram] audit marker', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      const result = await bot.executeCommand('3500 лед Корпоратив нал1');
      expect(result.success).toBe(true);
      expect(result.transaction.amount).toBe(3500);
      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.description).toBe('[Telegram] 3500 лед Корпоратив нал1');
      expect(result.transaction.eventId).toBe('event_corporate');

      // Verify account debit
      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(finalCash1).toBe(round2(initialCash1 - 3500));
    });

    it('should reject invalid telegram commands with clear exception without corrupting store', async () => {
      const accountsBefore = await store.getAccounts();
      const txsBefore = await store.getTransactions();

      await expect(bot.executeCommand('')).rejects.toThrow('Пустая команда');
      await expect(bot.executeCommand('такси без суммы')).rejects.toThrow('не указана сумма');
      await expect(bot.executeCommand('0 лед')).rejects.toThrow('больше нуля');

      const accountsAfter = await store.getAccounts();
      const txsAfter = await store.getTransactions();
      expect(accountsAfter).toEqual(accountsBefore);
      expect(txsAfter).toEqual(txsBefore);
    });
  });

  // =========================================================================
  // 8. CONSECUTIVE TELEGRAM TRANSACTIONS & REVERSAL INVARIANTS
  // =========================================================================
  describe('Challenge 8: Multi-Transaction Ledger Reconciliation & Full Rollback', () => {
    it('should process 50 diverse Telegram operations sequentially and maintain exact balance reconciliation', async () => {
      const startAccounts = await store.getAccounts();
      const startTotal = startAccounts.reduce((s, a) => s + a.currentBalance, 0);

      const commands = [
        '1000 лед нал1',
        '25000 предоплата Свадьба р/с',
        '1500 такси нал1',
        '12000 алкоголь нал2',
        '50000 предоплата Корпоратив безнал1',
        '4000 мята и фрукты нал1',
        '15000 гонорар бармена Свадьба нал2',
        '5000 чаевые нал1',
      ];

      const executedTxIds: string[] = [];

      // Execute 50 operations in sequence
      for (let i = 0; i < 50; i++) {
        const cmd = commands[i % commands.length];
        const res = await bot.executeCommand(cmd);
        expect(res.success).toBe(true);
        executedTxIds.push(res.transaction.id);
      }

      // Verify all 50 transactions exist and have [Telegram] prefix
      const currentTxs = await store.getTransactions();
      expect(currentTxs.length).toBe(21 + 50); // 21 seed + 50 new
      const telegramTxs = currentTxs.filter((t) => t.description.startsWith('[Telegram]'));
      expect(telegramTxs).toHaveLength(50);

      // Now reverse all 50 executed Telegram transactions
      for (const txId of executedTxIds) {
        const delRes = await finance.deleteTransaction(txId);
        expect(delRes.success).toBe(true);
      }

      // Verify all accounts land on EXACT initial post-seed balances (sum = 1,166,300 ₽)
      const restoredAccounts = await store.getAccounts();
      const restoredTotal = restoredAccounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(restoredTotal).toBe(startTotal);
      expect(restoredTotal).toBe(1166300);

      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(6300);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_2)?.currentBalance).toBe(199000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)?.currentBalance).toBe(814000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_2)?.currentBalance).toBe(112000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CARD_SBP)?.currentBalance).toBe(35000);
    });
  });

  // =========================================================================
  // 9. DISCOVERY & ADVERSARIAL EDGE CASE MINING
  // =========================================================================
  describe('Challenge 9: Adversarial Semantic Edge Cases & Ambiguities', () => {
    it('should examine keyword containment: "бармен" vs account "бар"', () => {
      // In Russian catering, "гонорар бармена" is staff expense.
      // Account detection has: lower.includes('бар') -> cash_1
      const parsed = parser.parse('5000 бармену');
      expect(parsed.amount).toBe(5000);
      expect(parsed.categoryId).toBe('cat_staff');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);
    });

    it('should correctly prioritize specific account names over generic ones', () => {
      // "нал 2" should resolve to cash_2 even though "нал" is a substring of "нал 1"
      const parsed = parser.parse('8000 гонорар нал 2');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_2);
    });

    it('should correctly prioritize card_sbp on banking brand names (Т-Банк, Тинькофф, СБП)', () => {
      const p1 = parser.parse('3000 лед т-банк');
      const p2 = parser.parse('3000 лед сбп');
      const p3 = parser.parse('3000 лед тинькофф');
      expect(p1.accountId).toBe(ACCOUNT_IDS.CARD_SBP);
      expect(p2.accountId).toBe(ACCOUNT_IDS.CARD_SBP);
      expect(p3.accountId).toBe(ACCOUNT_IDS.CARD_SBP);
    });

    it('should observe accountName consistency when defaultAccountId option is passed', () => {
      const options: ParseOptions = { defaultAccountId: ACCOUNT_IDS.BANK_1 };
      const parsed = parser.parse('3500 лед', options);
      expect(parsed.accountId).toBe(ACCOUNT_IDS.BANK_1);
      // EMPIRICAL OBSERVATION: accountName remains hardcoded to 'Нал 1 (Касса на площадке)'
      // even when defaultAccountId is overridden to 'bank_1'
      expect(parsed.accountName).toBe('Нал 1 (Касса на площадке)');
    });
  });

  // =========================================================================
  // 10. CROSS-MODULE EVENT ID CONVENTION DIVERGENCE (UNDERSCORE vs HYPHEN)
  // =========================================================================
  describe('Challenge 10: Event ID Convention Divergence & Query Filtering Impact', () => {
    it('should empirically demonstrate that TelegramBotService creates transactions with underscore eventId ("event_wedding")', async () => {
      const execRes = await bot.executeCommand('50000 предоплата Свадьба');
      expect(execRes.transaction.eventId).toBe('event_wedding');

      // Now query transactions via storage using canonical EVENT_IDS.WEDDING ('event-wedding')
      const filteredHyphen = await store.getTransactions({ eventId: EVENT_IDS.WEDDING });
      // The newly created transaction with 'event_wedding' is NOT matched by strict equality on 'event-wedding'
      const foundUnderHyphen = filteredHyphen.some((t) => t.id === execRes.transaction.id);
      expect(foundUnderHyphen).toBe(false);

      // But it IS found if queried by 'event_wedding'
      const filteredUnderscore = await store.getTransactions({ eventId: 'event_wedding' });
      const foundUnderUnderscore = filteredUnderscore.some((t) => t.id === execRes.transaction.id);
      expect(foundUnderUnderscore).toBe(true);
    });

    it('should verify AnalyticsService normalization bridge works around the underscore/hyphen divergence', async () => {
      // AnalyticsService has explicit normalization: tx.eventId.replace(/-/g, '_') === event.id.replace(/-/g, '_')
      const { AnalyticsService } = await import('../../src/server/services/AnalyticsService.js');
      const analytics = new AnalyticsService(store);

      const beforeMargin = await analytics.getEventMargin(EVENT_IDS.WEDDING);
      const initialRev = beforeMargin!.revenue;

      // Add 20,000 income via Telegram (generates event_wedding)
      await bot.executeCommand('20000 предоплата Свадьба безнал1');

      const afterMargin = await analytics.getEventMargin(EVENT_IDS.WEDDING);
      // AnalyticsService bridge successfully reconciles event_wedding to event-wedding
      expect(afterMargin!.revenue).toBe(round2(initialRev + 20000));
    });
  });

  // =========================================================================
  // 11. MULTIPLE NUMERIC TOKENS (QUANTITIES, DATES & PREFIXES)
  // =========================================================================
  describe('Challenge 11: Multiple Numeric Tokens & Left-to-Right Greedy Amount Match', () => {
    it('should observe amount extraction when item quantity precedes price: "2 ящика 10000 р"', () => {
      // Greedy regex matches first digit sequence: "2" instead of "10000"
      const parsed = parser.parse('2 ящика водки 10000 р');
      expect(parsed.amount).toBe(2); // First number captured
    });

    it('should observe greedy digit grouping combining event number and amount: "Свадьба 2 50000 предоплата"', () => {
      // Regex /-?\d+(?:[\s_]\d{3})*(?:[.,]\d+)?/ matches "2 500" because 50000 starts with 3 digits!
      // Consequently, "2 50000" is parsed as 2,500 ₽ instead of 50,000 ₽!
      const parsed = parser.parse('Свадьба 2 50000 предоплата');
      expect(parsed.amount).toBe(2500);
    });

    it('should correctly capture amount when amount is placed first: "10000 р за 2 ящика водки"', () => {
      const parsed = parser.parse('10000 р за 2 ящика водки');
      expect(parsed.amount).toBe(10000);
      expect(parsed.categoryId).toBe('cat_alcohol');
    });
  });

  // =========================================================================
  // 12. CYRILLIC GRAMMATICAL DECLENSION & SUBSTRING COLLISION BUGS
  // =========================================================================
  describe('Challenge 12: Cyrillic Declensions & Substring Collisions in Natural Language', () => {
    it('should expose grammatical declension bug: inflected forms ("предоплату", "доплату") wrongly classified as expense', () => {
      // Line 61 uses exact string lower.includes('предоплата') and lower.includes('доплата')
      // In Russian, accusative case ("внести 50000 предоплату") and genitive ("часть предоплаты") end in 'у' / 'ы'.
      // Therefore, lower.includes('предоплата') evaluates to FALSE!
      // But line 133 category matching uses stem lower.includes('предоплат'), which evaluates to TRUE!
      // Result: The parser emits an EXPENSE under category 'cat_prepayment' instead of an INCOME!

      const accusativePrepayment = parser.parse('50000 предоплату Свадьба');
      expect(accusativePrepayment.type).toBe('expense'); // BUG: Expected income, but parser classifies as expense
      expect(accusativePrepayment.categoryId).toBe('cat_prepayment');

      const accusativeFinal = parser.parse('20000 доплату Корпоратив');
      expect(accusativeFinal.type).toBe('expense'); // BUG: Expected income, but parser classifies as expense
      expect(accusativeFinal.categoryId).toBe('cat_final_payment');

      const genitiveTips = parser.parse('5000 чаевых нал1');
      expect(genitiveTips.type).toBe('expense'); // BUG: Expected income, but parser classifies as expense
      expect(genitiveTips.categoryId).toBe('cat_tips');
    });

    it('should observe category collision when word contains "вин": "10000 половина предоплаты Свадьба"', () => {
      // "половина" contains "вин", matching lower.includes('вин') -> cat_alcohol
      const parsed = parser.parse('10000 половина предоплаты Свадьба');
      // Classification collides into cat_alcohol due to 'вин' in 'половина'
      expect(parsed.categoryId).toBe('cat_alcohol');
    });

    it('should detect substring collision: "высокий бокал" matching "сок" (cat_ice)', () => {
      // "высокий" contains "сок", matching lower.includes('сок') -> cat_ice before cat_logistics
      const parsed = parser.parse('2000 высокий бокал');
      expect(parsed.categoryId).toBe('cat_ice');
    });

    it('should detect substring collision: "барбекю" matching account "бар" (cash_1)', () => {
      // "барбекю" contains "бар", matching lower.includes('бар') -> cash_1
      const parsed = parser.parse('5000 барбекю');
      expect(parsed.accountId).toBe(ACCOUNT_IDS.CASH_1);
    });
  });

  // =========================================================================
  // 13. CONCURRENCY & PARALLEL EXECUTION AUDIT
  // =========================================================================
  describe('Challenge 13: Concurrency & Parallel Execution Race Condition Audit', () => {
    it('should empirically prove lost update race condition during concurrent transactions', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance; // 6300

      // 20 concurrent expenses of 100 ₽ each
      const promises = Array.from({ length: 20 }, (_, i) =>
        bot.executeCommand(`100 лед нал1 оператор ${i}`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
      expect(results.every((r) => r.success)).toBe(true);

      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      const txs = await store.getTransactions();
      const telegramTxs = txs.filter((t) => t.description.includes('оператор'));
      expect(telegramTxs).toHaveLength(20); // 20 transactions were logged

      // EMPIRICAL PROOF OF RACE CONDITION:
      // In FinanceService.createTransaction(), balance read and update are separate async steps
      // without locking/mutex. All 20 calls concurrently read initialCash1 (6300) before any write resolved.
      // All 20 wrote (6300 - 100 = 6200).
      // Final balance is 6200 instead of expected 4300!
      expect(finalCash1).toBe(6200);
      expect(finalCash1).not.toBe(4300);
    });

    it('should contrast with sequential execution which preserves 100% balance integrity', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      // 10 sequential expenses of 100 ₽ each
      for (let i = 0; i < 10; i++) {
        await bot.executeCommand(`100 лед нал1 sequential ${i}`);
      }

      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(finalCash1).toBe(round2(initialCash1 - 10 * 100)); // Exactly preserved
    });
  });
});

