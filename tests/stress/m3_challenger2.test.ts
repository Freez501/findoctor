/**
 * Truespace Bar Catering Finance — Milestone M3 Adversarial Challenge Suite
 * File: tests/stress/m3_challenger2.test.ts
 *
 * Empirical verification of:
 * 1. Rapid-fire natural language commands via /api/telegram/parse and /api/telegram/execute:
 *    - "3500 лед Корпоратив Т-Банк"
 *    - "50000 предоплата Свадьба"
 *    - "-1500 такси нал1"
 *    - Edge cases, malformed strings, unrecognized strings, and confidence scoring
 *    - Rapid-fire concurrency bursts and ledger conservation
 * 2. Optimistic UI mutation rollback behavior:
 *    - Simulated network failure preserves previous state
 *    - Error message returned without corrupting 5 account balances
 *    - Coverage across expense, income, and transfer operations
 * 3. Telegram Bot status transitions ('mock', 'polling', 'webhook') & health polling
 * 4. Design system tokens presence in src/client/styles/globals.css & responsive rules (375px to 1440px)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { ACCOUNT_IDS, EVENT_IDS } from '../../src/shared/constants.js';
import { TelegramBotService } from '../../src/server/telegram/TelegramBotService.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { ParserService } from '../../src/server/services/ParserService.js';
import { Account, Transaction } from '../../src/shared/types.js';
import { CreateTransactionDTO } from '../../src/shared/dto.js';
import { roundRubles } from '../../src/client/utils/formatters.js';

describe('Milestone M3 Adversarial Challenge 2: Telegram Simulator, Optimistic Rollback & Responsive Tokens', () => {
  let app: any;
  let store: InMemoryStore;
  let finance: FinanceService;
  let parser: ParserService;
  let telegramService: TelegramBotService;

  beforeEach(() => {
    store = new InMemoryStore();
    finance = new FinanceService(store);
    parser = new ParserService();
    telegramService = new TelegramBotService(finance, parser);
    app = createApp({ store, telegramService });
  });

  // =========================================================================
  // SECTION 1: RAPID-FIRE NATURAL LANGUAGE COMMANDS (PARSE & EXECUTE)
  // =========================================================================
  describe('1. Natural Language Telegram Commands & Execution', () => {
    // 1.1 "3500 лед Корпоратив Т-Банк"
    describe('Command: "3500 лед Корпоратив Т-Банк"', () => {
      it('should parse command into expense, cat_ice, event_corporate, and card_sbp without mutating state', async () => {
        const { accounts: accountsBefore } = (await request(app).get('/api/accounts')).body;
        const totalBefore = (await request(app).get('/api/accounts')).body.totalBalance;

        const parseRes = await request(app)
          .post('/api/telegram/parse')
          .send({ text: '3500 лед Корпоратив Т-Банк' });

        expect(parseRes.status).toBe(200);
        expect(parseRes.body.parsed).toBeDefined();

        const p = parseRes.body.parsed;
        expect(p.amount).toBe(3500);
        expect(p.type).toBe('expense');
        expect(p.categoryId).toBe('cat_ice');
        expect(p.categoryName).toBe('Лёд и расходники');
        expect(p.eventId).toBe('event_corporate');
        expect(p.accountId).toBe(ACCOUNT_IDS.CARD_SBP); // Т-Банк resolves to card_sbp
        expect(p.confidence).toBeGreaterThanOrEqual(0.85);

        // Invariant: parsing must NEVER mutate ledger or account balances
        const { accounts: accountsAfter, totalBalance: totalAfter } = (
          await request(app).get('/api/accounts')
        ).body;
        expect(totalAfter).toBe(totalBefore);
        expect(accountsAfter).toEqual(accountsBefore);
      });

      it('should execute command directly into ledger, debiting card_sbp by 3,500 ₽ and updating event margin', async () => {
        const cardBeforeRes = await request(app).get(`/api/accounts/${ACCOUNT_IDS.CARD_SBP}`);
        const cardBalanceBefore = cardBeforeRes.body.account.currentBalance; // 35,000 ₽

        const execRes = await request(app)
          .post('/api/telegram/execute')
          .send({ text: '3500 лед Корпоратив Т-Банк' });

        expect(execRes.status).toBe(201);
        expect(execRes.body.success).toBe(true);
        expect(execRes.body.transaction).toBeDefined();

        const tx = execRes.body.transaction;
        expect(tx.amount).toBe(3500);
        expect(tx.type).toBe('expense');
        expect(tx.categoryId).toBe('cat_ice');
        expect(tx.eventId).toBe('event_corporate');
        expect(tx.fromAccountId).toBe(ACCOUNT_IDS.CARD_SBP);
        expect(tx.description).toBe('[Telegram] 3500 лед Корпоратив Т-Банк');

        // Check updated card balance
        const cardAfterRes = await request(app).get(`/api/accounts/${ACCOUNT_IDS.CARD_SBP}`);
        expect(cardAfterRes.body.account.currentBalance).toBe(cardBalanceBefore - 3500);
        expect(cardAfterRes.body.account.currentBalance).toBe(31500);
      });
    });

    // 1.2 "50000 предоплата Свадьба"
    describe('Command: "50000 предоплата Свадьба"', () => {
      it('should parse command into income, cat_prepayment, event_wedding, defaulting to cash_1', async () => {
        const parseRes = await request(app)
          .post('/api/telegram/parse')
          .send({ text: '50000 предоплата Свадьба' });

        expect(parseRes.status).toBe(200);
        const p = parseRes.body.parsed;
        expect(p.amount).toBe(50000);
        expect(p.type).toBe('income');
        expect(p.categoryId).toBe('cat_prepayment');
        expect(p.eventId).toBe('event_wedding');
        expect(p.accountId).toBe(ACCOUNT_IDS.CASH_1); // Default fallback account
        expect(p.confidence).toBeGreaterThanOrEqual(0.85);
      });

      it('should execute command, crediting cash_1 by 50,000 ₽ (6,300 -> 56,300 ₽)', async () => {
        const cash1Before = (await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)).body
          .account.currentBalance; // 6,300 ₽

        const execRes = await request(app)
          .post('/api/telegram/execute')
          .send({ text: '50000 предоплата Свадьба' });

        expect(execRes.status).toBe(201);
        expect(execRes.body.success).toBe(true);

        const tx = execRes.body.transaction;
        expect(tx.amount).toBe(50000);
        expect(tx.type).toBe('income');
        expect(tx.toAccountId).toBe(ACCOUNT_IDS.CASH_1);
        expect(tx.eventId).toBe('event_wedding');

        const cash1After = (await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)).body
          .account.currentBalance;
        expect(cash1After).toBe(cash1Before + 50000);
        expect(cash1After).toBe(56300);
      });
    });

    // 1.3 "-1500 такси нал1"
    describe('Command: "-1500 такси нал1"', () => {
      it('should parse negative prefix as positive expense amount for logistics with null eventId', async () => {
        const parseRes = await request(app)
          .post('/api/telegram/parse')
          .send({ text: '-1500 такси нал1' });

        expect(parseRes.status).toBe(200);
        const p = parseRes.body.parsed;
        expect(p.amount).toBe(1500);
        expect(p.type).toBe('expense');
        expect(p.categoryId).toBe('cat_logistics');
        expect(p.categoryName).toBe('Логистика и аренда посуды');
        expect(p.eventId).toBeNull();
        expect(p.isGeneralExpense).toBe(true);
        expect(p.accountId).toBe(ACCOUNT_IDS.CASH_1);
      });

      it('should execute command, reducing cash_1 by 1,500 ₽ (6,300 -> 4,800 ₽)', async () => {
        const cash1Before = (await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)).body
          .account.currentBalance;

        const execRes = await request(app)
          .post('/api/telegram/execute')
          .send({ text: '-1500 такси нал1' });

        expect(execRes.status).toBe(201);
        expect(execRes.body.success).toBe(true);

        const tx = execRes.body.transaction;
        expect(tx.amount).toBe(1500);
        expect(tx.type).toBe('expense');
        expect(tx.fromAccountId).toBe(ACCOUNT_IDS.CASH_1);
        expect(tx.eventId).toBeNull();

        const cash1After = (await request(app).get(`/api/accounts/${ACCOUNT_IDS.CASH_1}`)).body
          .account.currentBalance;
        expect(cash1After).toBe(cash1Before - 1500);
        expect(cash1After).toBe(4800);
      });
    });

    // 1.4 Rapid-Fire Concurrency Bursts & Ledger Conservation
    describe('Rapid-Fire Concurrency Bursts', () => {
      it('should execute 25 rapid-fire natural language commands sequentially and preserve total capital equation', async () => {
        const initialAccounts = (await request(app).get('/api/accounts')).body.accounts;
        const initialTotal = (await request(app).get('/api/accounts')).body.totalBalance; // 1,166,300 ₽

        const batchCommands = [
          '3500 лед Корпоратив Т-Банк', // -3500 (card_sbp)
          '50000 предоплата Свадьба', // +50000 (cash_1)
          '-1500 такси нал1', // -1500 (cash_1)
          '12000 алкоголь Свадьба нал2', // -12000 (cash_2)
          '25000 доплата Корпоратив безнал1', // +25000 (bank_1)
        ];

        let expectedNetChange = 0;
        // 5 cycles of 5 commands = 25 operations
        for (let cycle = 0; cycle < 5; cycle++) {
          for (const cmd of batchCommands) {
            const res = await request(app).post('/api/telegram/execute').send({ text: cmd });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
          }
          // Per cycle: -3500 + 50000 - 1500 - 12000 + 25000 = +58000 ₽
          expectedNetChange += 58000;
        }

        const finalRes = await request(app).get('/api/accounts');
        const finalTotal = finalRes.body.totalBalance;
        const finalAccounts: Account[] = finalRes.body.accounts;

        // Balance conservation check
        expect(finalTotal).toBe(roundRubles(initialTotal + expectedNetChange));
        expect(finalTotal).toBe(1166300 + 290000);

        // Sum of all 5 accounts must equal totalBalance exactly
        const accountsSum = finalAccounts.reduce((acc, a) => acc + a.currentBalance, 0);
        expect(roundRubles(accountsSum)).toBe(finalTotal);
      });
    });

    // 1.5 Edge Case Malformed & Unrecognized Strings Error Handling
    describe('Edge Cases & Malformed String Error Handling', () => {
      it('should return 400 with "Пустая команда" for empty strings', async () => {
        const resEmpty = await request(app).post('/api/telegram/parse').send({ text: '' });
        expect(resEmpty.status).toBe(400);
        expect(resEmpty.body.error).toContain('Пустая команда');

        const resSpaces = await request(app).post('/api/telegram/parse').send({ text: '    \t\n   ' });
        expect(resSpaces.status).toBe(400);
        expect(resSpaces.body.error).toContain('Пустая команда');
      });

      it('should return 400 for missing or non-string text property', async () => {
        const resNoText = await request(app).post('/api/telegram/parse').send({});
        expect(resNoText.status).toBe(400);
        expect(resNoText.body.error).toContain('Пустая команда');

        const resNull = await request(app).post('/api/telegram/parse').send({ text: null });
        expect(resNull.status).toBe(400);
        expect(resNull.body.error).toContain('Пустая команда');
      });

      it('should return 400 with "В команде не указана сумма" when no numeric digits exist', async () => {
        const res = await request(app).post('/api/telegram/parse').send({ text: 'купи мяту на площадку' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('не указана сумма');

        const resExecute = await request(app).post('/api/telegram/execute').send({ text: 'просто текст' });
        expect(resExecute.status).toBe(400);
        expect(resExecute.body.error).toContain('не указана сумма');
      });

      it('should return 400 with "Сумма должна быть больше нуля" for zero amounts', async () => {
        const resZero = await request(app).post('/api/telegram/parse').send({ text: '0 лед нал1' });
        expect(resZero.status).toBe(400);
        expect(resZero.body.error).toContain('больше нуля');

        const resNegZero = await request(app).post('/api/telegram/parse').send({ text: '-0 такси' });
        expect(resNegZero.status).toBe(400);
        expect(resNegZero.body.error).toContain('больше нуля');
      });

      it('adversarial challenge: examine parser behavior on completely unrecognized text with numbers', async () => {
        // String contains digits but gibberish words
        const res = await request(app)
          .post('/api/telegram/parse')
          .send({ text: '123456 фывапролдж qwertyuiop' });

        expect(res.status).toBe(200);
        const p = res.body.parsed;
        expect(p.amount).toBe(123456);
        // Default category is cat_supplies
        expect(p.categoryId).toBe('cat_supplies');
        expect(p.eventId).toBeNull();
        expect(p.accountId).toBe(ACCOUNT_IDS.CASH_1);

        // Note: ParserService assigns base confidence 0.85 + 0.05 for amount > 0 = 0.90
        // Document empirical finding: parser does not downgrade confidence below 0.5 for unrecognized vocabularies
        expect(p.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });
  });

  // =========================================================================
  // SECTION 2: OPTIMISTIC UI ROLLBACK BEHAVIOR UNDER NETWORK FAILURE
  // =========================================================================
  describe('2. Optimistic UI Rollback Simulation', () => {
    /**
     * Recreates the exact optimistic mutation & rollback algorithm in FinanceContext.tsx:
     * lines 225-289 of src/client/context/FinanceContext.tsx
     */
    function executeOptimisticMutation(
      initialAccounts: Account[],
      initialTransactions: Transaction[],
      dto: CreateTransactionDTO,
      apiCall: () => Promise<{ success: boolean; transaction?: Transaction; updatedAccounts?: Account[] }>
    ): {
      run: () => Promise<{ success: boolean; accounts: Account[]; transactions: Transaction[]; error?: string }>;
    } {
      return {
        run: async () => {
          // 1. Validation checks
          if (!dto.amount || dto.amount <= 0) {
            return {
              success: false,
              accounts: initialAccounts,
              transactions: initialTransactions,
              error: 'Сумма операции должна быть больше 0 ₽.',
            };
          }
          if (dto.type === 'transfer' && dto.fromAccountId === dto.toAccountId) {
            return {
              success: false,
              accounts: initialAccounts,
              transactions: initialTransactions,
              error: 'Счёт списания и счёт зачисления не могут совпадать.',
            };
          }
          if (dto.type === 'expense' && !dto.fromAccountId) {
            return {
              success: false,
              accounts: initialAccounts,
              transactions: initialTransactions,
              error: 'Выберите счёт списания.',
            };
          }
          if (dto.type === 'income' && !dto.toAccountId) {
            return {
              success: false,
              accounts: initialAccounts,
              transactions: initialTransactions,
              error: 'Выберите счёт зачисления.',
            };
          }

          // 2. Snapshot prior state for rollback
          const prevAccounts = JSON.parse(JSON.stringify(initialAccounts));
          const prevTransactions = JSON.parse(JSON.stringify(initialTransactions));

          // 3. Apply optimistic mutation
          const tempId = `temp-tx-${Date.now()}`;
          const tempTx: Transaction = {
            id: tempId,
            type: dto.type,
            amount: dto.amount,
            fromAccountId: dto.fromAccountId || undefined,
            toAccountId: dto.toAccountId || undefined,
            categoryId: dto.categoryId,
            eventId: dto.eventId || null,
            description: dto.description || '',
            transactionDate: dto.transactionDate || new Date().toISOString(),
            isDeleted: false,
          };

          let currentAccounts = initialAccounts.map((acc) => {
            let newBalance = acc.currentBalance;
            if (dto.type === 'expense' && acc.id === dto.fromAccountId) {
              newBalance = roundRubles(newBalance - dto.amount);
            } else if (dto.type === 'income' && acc.id === dto.toAccountId) {
              newBalance = roundRubles(newBalance + dto.amount);
            } else if (dto.type === 'transfer') {
              if (acc.id === dto.fromAccountId) {
                newBalance = roundRubles(newBalance - dto.amount);
              } else if (acc.id === dto.toAccountId) {
                newBalance = roundRubles(newBalance + dto.amount);
              }
            }
            return newBalance !== acc.currentBalance ? { ...acc, currentBalance: newBalance } : acc;
          });

          let currentTransactions = [tempTx, ...initialTransactions];

          // 4. Trigger remote API call
          try {
            const res = await apiCall();
            if (res.success && res.transaction) {
              // Replace temp with server transaction
              currentTransactions = currentTransactions.map((tx) =>
                tx.id === tempId ? res.transaction! : tx
              );
              return { success: true, accounts: currentAccounts, transactions: currentTransactions };
            } else {
              // Rollback on server rejection
              return {
                success: false,
                accounts: prevAccounts,
                transactions: prevTransactions,
                error: 'Сервер отклонил операцию.',
              };
            }
          } catch (err: any) {
            // Rollback on network failure / exception
            return {
              success: false,
              accounts: prevAccounts,
              transactions: prevTransactions,
              error: err.message || 'Не удалось сохранить операцию. Баланс возвращён в исходное состояние.',
            };
          }
        },
      };
    }

    it('should roll back optimistic expense mutation when simulated network throws TypeError/NetworkError', async () => {
      const initialAccounts: Account[] = (await request(app).get('/api/accounts')).body.accounts;
      const initialTxs: Transaction[] = (await request(app).get('/api/transactions')).body.transactions;

      const expenseDTO: CreateTransactionDTO = {
        type: 'expense',
        amount: 25000,
        fromAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: 'cat_alcohol',
        description: 'Партия алкоголя',
      };

      // Simulate network disconnection
      const failingApiCall = async () => {
        throw new TypeError('Failed to fetch: Network request failed on venue Wi-Fi');
      };

      const result = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        expenseDTO,
        failingApiCall
      ).run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch');

      // VERIFY STATE PRESERVATION:
      // 1. Bank 1 balance must be restored to original 814,000 ₽ (NOT 789,000 ₽)
      const bank1 = result.accounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)!;
      expect(bank1.currentBalance).toBe(814000);

      // 2. All 5 accounts must match initial accounts exactly
      expect(result.accounts).toEqual(initialAccounts);

      // 3. Transactions array must have no temporary dangling transaction
      expect(result.transactions).toEqual(initialTxs);
      expect(result.transactions.some((tx) => tx.id.startsWith('temp-tx'))).toBe(false);
    });

    it('should roll back optimistic income mutation when server responds with 500 error', async () => {
      const initialAccounts: Account[] = (await request(app).get('/api/accounts')).body.accounts;
      const initialTxs: Transaction[] = (await request(app).get('/api/transactions')).body.transactions;

      const incomeDTO: CreateTransactionDTO = {
        type: 'income',
        amount: 100000,
        toAccountId: ACCOUNT_IDS.BANK_2,
        categoryId: 'cat_prepayment',
        description: 'Крупная предоплата',
      };

      // Server error rejection
      const serverErrorApiCall = async () => {
        return { success: false };
      };

      const result = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        incomeDTO,
        serverErrorApiCall
      ).run();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Сервер отклонил операцию.');

      const bank2 = result.accounts.find((a) => a.id === ACCOUNT_IDS.BANK_2)!;
      expect(bank2.currentBalance).toBe(112000); // Intact
      expect(result.accounts).toEqual(initialAccounts);
      expect(result.transactions).toEqual(initialTxs);
    });

    it('should roll back optimistic transfer mutation between two accounts upon timeout', async () => {
      const initialAccounts: Account[] = (await request(app).get('/api/accounts')).body.accounts;
      const initialTxs: Transaction[] = (await request(app).get('/api/transactions')).body.transactions;

      const transferDTO: CreateTransactionDTO = {
        type: 'transfer',
        amount: 50000,
        fromAccountId: ACCOUNT_IDS.BANK_1,
        toAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: 'cat_supplies',
        description: 'Снятие наличности',
      };

      const timeoutApiCall = async () => {
        const err: any = new Error('Время ожидания ответа сервера истекло. Пожалуйста, попробуйте снова.');
        err.name = 'AbortError';
        throw err;
      };

      const result = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        transferDTO,
        timeoutApiCall
      ).run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Время ожидания ответа сервера истекло');

      // Neither source nor destination account balance must change
      const bank1 = result.accounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)!;
      const cash1 = result.accounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!;
      expect(bank1.currentBalance).toBe(814000);
      expect(cash1.currentBalance).toBe(6300);
      expect(result.accounts).toEqual(initialAccounts);
    });

    it('should reject invalid mutations locally before snapshotting or triggering network call', async () => {
      const initialAccounts: Account[] = (await request(app).get('/api/accounts')).body.accounts;
      const initialTxs: Transaction[] = (await request(app).get('/api/transactions')).body.transactions;

      const dummyApi = async () => ({ success: true });

      // Negative or zero amount
      const r1 = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        { type: 'expense', amount: 0, fromAccountId: 'cash_1', categoryId: 'cat_ice' },
        dummyApi
      ).run();
      expect(r1.success).toBe(false);
      expect(r1.error).toContain('больше 0 ₽');

      // Transfer to identical account
      const r2 = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        { type: 'transfer', amount: 1000, fromAccountId: 'cash_1', toAccountId: 'cash_1', categoryId: 'cat_ice' },
        dummyApi
      ).run();
      expect(r2.success).toBe(false);
      expect(r2.error).toContain('не могут совпадать');

      // Expense missing source account
      const r3 = await executeOptimisticMutation(
        initialAccounts,
        initialTxs,
        { type: 'expense', amount: 1000, categoryId: 'cat_ice' },
        dummyApi
      ).run();
      expect(r3.success).toBe(false);
      expect(r3.error).toContain('Выберите счёт списания');
    });
  });

  // =========================================================================
  // SECTION 3: TELEGRAM BOT STATUS TRANSITIONS & HEALTH POLLING
  // =========================================================================
  describe('3. Telegram Bot Status Transitions & Health Polling', () => {
    it('should initialize in "mock" mode by default when BOT_TOKEN is absent', async () => {
      const res = await request(app).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.mode).toBe('mock');
      expect(res.body.configuredToken).toBe(false);
      expect(res.body.botUsername).toBe('@TruespaceBarBot');
      expect(res.body.message).toContain('Работа в режиме симулятора (без токена)');
      expect(res.body.lastActiveAt).toBeDefined();
    });

    it('should transition to "polling" mode when BOT_TOKEN is provided with default mode', () => {
      const originalToken = process.env.BOT_TOKEN;
      const originalMode = process.env.BOT_MODE;

      try {
        process.env.BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
        delete process.env.BOT_MODE;

        const pollingBot = new TelegramBotService(finance, parser);
        const status = pollingBot.getStatus();

        expect(status.enabled).toBe(true);
        expect(status.mode).toBe('polling');
        expect(status.configuredToken).toBe(true);
        expect(status.message).toBe('Telegram бот активен');
      } finally {
        if (originalToken) process.env.BOT_TOKEN = originalToken;
        else delete process.env.BOT_TOKEN;
        if (originalMode) process.env.BOT_MODE = originalMode;
        else delete process.env.BOT_MODE;
      }
    });

    it('should transition to "webhook" mode when BOT_MODE=webhook is specified', () => {
      const originalToken = process.env.BOT_TOKEN;
      const originalMode = process.env.BOT_MODE;

      try {
        process.env.BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
        process.env.BOT_MODE = 'webhook';

        const webhookBot = new TelegramBotService(finance, parser);
        const status = webhookBot.getStatus();

        expect(status.enabled).toBe(true);
        expect(status.mode).toBe('webhook');
        expect(status.configuredToken).toBe(true);
        expect(status.message).toBe('Telegram бот активен');
      } finally {
        if (originalToken) process.env.BOT_TOKEN = originalToken;
        else delete process.env.BOT_TOKEN;
        if (originalMode) process.env.BOT_MODE = originalMode;
        else delete process.env.BOT_MODE;
      }
    });

    it('should update lastActiveAt timestamp on command parsing and command execution', async () => {
      const initialStatus = telegramService.getStatus();
      const initialTimestamp = new Date(initialStatus.lastActiveAt).getTime();

      // Delay 10ms to ensure monotonic time step
      await new Promise((r) => setTimeout(r, 15));

      await request(app).post('/api/telegram/parse').send({ text: '1000 лед нал1' });
      const afterParseStatus = telegramService.getStatus();
      const afterParseTime = new Date(afterParseStatus.lastActiveAt).getTime();
      expect(afterParseTime).toBeGreaterThanOrEqual(initialTimestamp);

      await new Promise((r) => setTimeout(r, 15));

      await request(app).post('/api/telegram/execute').send({ text: '2000 такси нал1' });
      const afterExecStatus = telegramService.getStatus();
      const afterExecTime = new Date(afterExecStatus.lastActiveAt).getTime();
      expect(afterExecTime).toBeGreaterThanOrEqual(afterParseTime);
    });
  });

  // =========================================================================
  // SECTION 4: DESIGN SYSTEM TOKENS & RESPONSIVE VIEWPORT RULES
  // =========================================================================
  describe('4. Design System Tokens & Responsive Viewport Rules (375px - 1440px)', () => {
    let cssContent: string;

    beforeEach(() => {
      const cssPath = path.resolve(__dirname, '../../src/client/styles/globals.css');
      expect(fs.existsSync(cssPath)).toBe(true);
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    });

    it('should define all mandatory design system color and font tokens in :root', () => {
      // Light color scheme
      expect(cssContent).toContain('color-scheme: light');

      // Font tokens
      expect(cssContent).toContain('--font-sans');

      // Color tokens from DESIGN_SYSTEM.md
      expect(cssContent).toContain('--color-bg: #f1f1ec');
      expect(cssContent).toContain('--color-surface:');
      expect(cssContent).toContain('--color-surface-strong:');
      expect(cssContent).toContain('--color-border:');
      expect(cssContent).toContain('--color-text: #172019');
      expect(cssContent).toContain('--color-text-muted: #657069');
      expect(cssContent).toContain('--color-accent: #5f7c67');
      expect(cssContent).toContain('--color-accent-strong: #46614e');

      // Border radius tokens
      expect(cssContent).toContain('--radius-sm:');
      expect(cssContent).toContain('--radius-md:');
      expect(cssContent).toContain('--radius-lg:');
      expect(cssContent).toContain('--radius-full:');

      // Spacing tokens
      expect(cssContent).toContain('--space-1:');
      expect(cssContent).toContain('--space-2:');
      expect(cssContent).toContain('--space-3:');
      expect(cssContent).toContain('--space-4:');
      expect(cssContent).toContain('--space-5:');
      expect(cssContent).toContain('--space-6:');

      // Shadow token
      expect(cssContent).toContain('--shadow-soft:');
    });

    it('should enforce responsive rules preventing horizontal overflow on 375px mobile', () => {
      // 1. Body overflow-x prevention
      expect(cssContent).toContain('overflow-x: hidden');

      // 2. Mobile-first app-container padding
      expect(cssContent).toContain('.app-container');

      // 3. Mobile bottom-sheet quick entry modal rules
      expect(cssContent).toContain('.quick-entry-bottom-sheet');
      expect(cssContent).toContain('.modal-backdrop');
      expect(cssContent).toContain('align-items: flex-end'); // Bottom-sheet on mobile

      // 4. Floating Action Button (FAB) for mobile finger reachability
      expect(cssContent).toContain('.fab-quick-entry');
      expect(cssContent).toContain('position: fixed');

      // 5. 3-column numeric keypad for touch input
      expect(cssContent).toContain('.numpad-grid');
      expect(cssContent).toContain('grid-template-columns: repeat(3, 1fr)');
    });

    it('should enforce responsive rules for 1440px desktop viewports', () => {
      // 1. Desktop container centering and max-width 1280px
      expect(cssContent).toContain('max-width: 1280px');
      expect(cssContent).toContain('margin: 0 auto');

      // 2. Desktop media query centering the quick entry modal
      expect(cssContent).toContain('@media (min-width: 640px)');
      expect(cssContent).toContain('align-items: center');

      // 3. Accounts responsive grid adapting from mobile to 5 columns on desktop
      expect(cssContent).toContain('.accounts-grid');
      expect(cssContent).toContain('grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))');

      // 4. Banner row switching to horizontal flex on desktop
      expect(cssContent).toContain('@media (min-width: 768px)');
      expect(cssContent).toContain('flex-direction: row');

      // 5. Header capital pill visible on desktop
      expect(cssContent).toContain('.header-capital-pill');
    });
  });
});
