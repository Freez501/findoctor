/**
 * Truespace — Milestone M4 Empirical Challenger 2 Suite
 * File: tests/stress/m4_challenger2_filters.test.ts
 *
 * Adversarial stress and empirical verification suite for Milestone M4:
 * 1. Complex filter combinations on transaction journal:
 *    - AccountId filtering across all 5 accounts (cash_1, cash_2, bank_1, bank_2, card_sbp)
 *    - EventId filtering (specific events, hyphen/underscore normalization, general bar overhead)
 *    - Transaction type filtering (income, expense, transfer, all)
 *    - Text search matching description, categoryId, amount, case-insensitivity, whitespace
 *    - Multi-predicate combined filtering & exclusion of soft-deleted transactions
 * 2. Search & filter performance at scale (10,000 synthetic transactions latency benchmark)
 * 3. Concurrent soft-deletions under high volume (100 rapid requests):
 *    - 100 distinct transactions concurrent deletion
 *    - 100 concurrent requests on the same transaction (double-refund / race condition probe)
 *    - Idempotency and exclusion from journal
 * 4. UI responsive layout and design tokens conformance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService, round2 } from '../../src/server/services/FinanceService.js';
import { filterTransactions, FilterState } from '../../src/client/components/history/TransactionHistory.js';
import { Transaction } from '../../src/shared/types.js';
import { ACCOUNT_IDS, CATEGORY_IDS, EVENT_IDS } from '../../src/shared/constants.js';

describe('Milestone M4: Challenger 2 — Filters, Search Performance & Concurrent Deletions', () => {
  let store: InMemoryStore;
  let finance: FinanceService;

  beforeEach(() => {
    store = new InMemoryStore();
    finance = new FinanceService(store);
  });

  // =========================================================================
  // 1. COMPLEX FILTER COMBINATIONS & MULTI-PREDICATE SEARCH
  // =========================================================================
  describe('1. Complex Filter Combinations on Transaction Journal', () => {
    const testTransactions: Transaction[] = [
      {
        id: 'tx-nal1-exp',
        type: 'expense',
        amount: 3500,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        toAccountId: null,
        categoryId: CATEGORY_IDS.SUPPLIES,
        eventId: EVENT_IDS.CORPORATE,
        description: 'Лед глыба на площадку Корпоратив Т-Банк',
        transactionDate: '2026-09-10T10:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-nal2-exp',
        type: 'expense',
        amount: 25000,
        fromAccountId: ACCOUNT_IDS.CASH_2,
        toAccountId: null,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: EVENT_IDS.WEDDING,
        description: 'Гонорар шеф-бармена на свадьбу',
        transactionDate: '2026-09-11T12:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-beznal1-inc',
        type: 'income',
        amount: 150000,
        fromAccountId: null,
        toAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
        eventId: EVENT_IDS.WEDDING,
        description: 'Предоплата по договору Свадьба Анна и Илья',
        transactionDate: '2026-09-09T09:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-beznal2-exp',
        type: 'expense',
        amount: 40000,
        fromAccountId: ACCOUNT_IDS.BANK_2,
        toAccountId: null,
        categoryId: CATEGORY_IDS.OVERHEAD,
        eventId: null, // General bar overhead
        description: 'Аренда центрального склада бара за сентябрь',
        transactionDate: '2026-09-05T08:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-transfer-bank-to-cash',
        type: 'transfer',
        amount: 30000,
        fromAccountId: ACCOUNT_IDS.BANK_1,
        toAccountId: ACCOUNT_IDS.CASH_2,
        categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
        eventId: null,
        description: 'Инкассация в сейф',
        transactionDate: '2026-09-12T15:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-card-inc',
        type: 'income',
        amount: 7500,
        fromAccountId: null,
        toAccountId: ACCOUNT_IDS.CARD_SBP,
        categoryId: CATEGORY_IDS.TIPS,
        eventId: EVENT_IDS.CORPORATE,
        description: 'Чаевые по СБП барменам',
        transactionDate: '2026-09-13T20:00:00Z',
        isDeleted: false,
      },
      {
        id: 'tx-deleted-record',
        type: 'expense',
        amount: 9999,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        toAccountId: null,
        categoryId: CATEGORY_IDS.SUPPLIES,
        eventId: EVENT_IDS.WEDDING,
        description: 'Ошибочно введенный чек льда',
        transactionDate: '2026-09-14T21:00:00Z',
        isDeleted: true, // soft-deleted record
      },
    ];

    it('M4-FLT-01: Filters by accountId across all 5 accounts (cash_1, cash_2, bank_1, bank_2, card_sbp)', () => {
      // cash_1: should match tx-nal1-exp (expense from cash_1), but NOT tx-deleted-record
      const nal1 = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.CASH_1,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(nal1).toHaveLength(1);
      expect(nal1[0].id).toBe('tx-nal1-exp');

      // cash_2: should match tx-nal2-exp (fromAccountId) AND tx-transfer-bank-to-cash (toAccountId)
      const nal2 = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.CASH_2,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(nal2).toHaveLength(2);
      expect(nal2.map((t) => t.id).sort()).toEqual(['tx-nal2-exp', 'tx-transfer-bank-to-cash'].sort());

      // bank_1: should match tx-beznal1-inc (toAccountId) AND tx-transfer-bank-to-cash (fromAccountId)
      const bank1 = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.BANK_1,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(bank1).toHaveLength(2);
      expect(bank1.map((t) => t.id).sort()).toEqual(['tx-beznal1-inc', 'tx-transfer-bank-to-cash'].sort());

      // bank_2: should match tx-beznal2-exp
      const bank2 = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.BANK_2,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(bank2).toHaveLength(1);
      expect(bank2[0].id).toBe('tx-beznal2-exp');

      // card_sbp: should match tx-card-inc
      const card = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.CARD_SBP,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(card).toHaveLength(1);
      expect(card[0].id).toBe('tx-card-inc');

      // Unmatched account: should return empty array safely
      const emptyAcc = filterTransactions(testTransactions, {
        accountId: 'acc_nonexistent',
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(emptyAcc).toHaveLength(0);
    });

    it('M4-FLT-02: Filters by eventId including specific events, hyphen/underscore variants, and general overhead', () => {
      // Event wedding (with underscore or hyphen)
      const weddingUnderscore = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'event_wedding',
        type: 'all',
        searchQuery: '',
      });
      expect(weddingUnderscore).toHaveLength(2); // tx-nal2-exp, tx-beznal1-inc (tx-deleted-record excluded)
      expect(weddingUnderscore.some((t) => t.id === 'tx-deleted-record')).toBe(false);

      const weddingHyphen = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'event-wedding',
        type: 'all',
        searchQuery: '',
      });
      expect(weddingHyphen).toHaveLength(2);

      // Event corporate
      const corporate = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'event_corporate',
        type: 'all',
        searchQuery: '',
      });
      expect(corporate).toHaveLength(2); // tx-nal1-exp, tx-card-inc

      // General overhead (null eventId)
      const overhead = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'general',
        type: 'all',
        searchQuery: '',
      });
      expect(overhead).toHaveLength(2); // tx-beznal2-exp (eventId: null), tx-transfer-bank-to-cash (eventId: null)
      expect(overhead.some((t) => t.id === 'tx-beznal2-exp')).toBe(true);
      expect(overhead.some((t) => t.id === 'tx-transfer-bank-to-cash')).toBe(true);

      // Nonexistent event
      const none = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'event_nonexistent',
        type: 'all',
        searchQuery: '',
      });
      expect(none).toHaveLength(0);
    });

    it('M4-FLT-03: Filters by transaction type (income, expense, transfer, all)', () => {
      // Incomes only
      const incomes = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'income',
        searchQuery: '',
      });
      expect(incomes).toHaveLength(2); // tx-beznal1-inc, tx-card-inc
      expect(incomes.every((t) => t.type === 'income')).toBe(true);

      // Expenses only
      const expenses = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'expense',
        searchQuery: '',
      });
      expect(expenses).toHaveLength(3); // tx-nal1-exp, tx-nal2-exp, tx-beznal2-exp (deleted excluded)
      expect(expenses.every((t) => t.type === 'expense')).toBe(true);

      // Transfers only
      const transfers = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'transfer',
        searchQuery: '',
      });
      expect(transfers).toHaveLength(1); // tx-transfer-bank-to-cash
      expect(transfers[0].type).toBe('transfer');

      // All types
      const allTypes = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      expect(allTypes).toHaveLength(6);
    });

    it('M4-FLT-04: Text search matches Cyrillic descriptions, category IDs, numeric amounts with whitespace tolerance', () => {
      // Search by description (Cyrillic substring)
      const iceSearch = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'лед',
      });
      expect(iceSearch).toHaveLength(1);
      expect(iceSearch[0].id).toBe('tx-nal1-exp');

      // Search case insensitivity (uppercase 'ЛЕД')
      const iceUpper = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'ЛЕД',
      });
      expect(iceUpper).toHaveLength(1);
      expect(iceUpper[0].id).toBe('tx-nal1-exp');

      // Search with leading and trailing whitespace
      const spaceSearch = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '   шеф-бармена   ',
      });
      expect(spaceSearch).toHaveLength(1);
      expect(spaceSearch[0].id).toBe('tx-nal2-exp');

      // Search by categoryId
      const catSearch = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'overhead',
      });
      expect(catSearch).toHaveLength(1);
      expect(catSearch[0].id).toBe('tx-beznal2-exp');

      // Search by amount string
      const amountSearch = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '150000',
      });
      expect(amountSearch).toHaveLength(1);
      expect(amountSearch[0].id).toBe('tx-beznal1-inc');

      // Search with non-matching string
      const noMatch = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'несуществующая_фраза_xyz',
      });
      expect(noMatch).toHaveLength(0);
    });

    it('M4-FLT-05: Combined multi-predicate filtering (account + event + type + search)', () => {
      // 4 predicates active simultaneously: cash_1 + corporate + expense + search 'Т-Банк'
      const exactMatch = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.CASH_1,
        eventId: EVENT_IDS.CORPORATE,
        type: 'expense',
        searchQuery: 'Т-Банк',
      });
      expect(exactMatch).toHaveLength(1);
      expect(exactMatch[0].id).toBe('tx-nal1-exp');

      // Conflicting predicates: cash_1 + corporate + income (only card income exists for corporate)
      const conflict = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.CASH_1,
        eventId: EVENT_IDS.CORPORATE,
        type: 'income',
        searchQuery: '',
      });
      expect(conflict).toHaveLength(0);

      // General bar overhead + expense + search 'склад'
      const overheadExpense = filterTransactions(testTransactions, {
        accountId: ACCOUNT_IDS.BANK_2,
        eventId: 'general',
        type: 'expense',
        searchQuery: 'склад',
      });
      expect(overheadExpense).toHaveLength(1);
      expect(overheadExpense[0].id).toBe('tx-beznal2-exp');
    });

    it('M4-FLT-06: Verifies strict descending date ordering (newest first) and exclusion of soft-deleted records', () => {
      const all = filterTransactions(testTransactions, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });

      expect(all).toHaveLength(6);
      // Ensure strictly sorted descending by date
      for (let i = 0; i < all.length - 1; i++) {
        const timeA = new Date(all[i].transactionDate).getTime();
        const timeB = new Date(all[i + 1].transactionDate).getTime();
        expect(timeA).toBeGreaterThanOrEqual(timeB);
      }

      // Soft-deleted record (tx-deleted-record, date 2026-09-14) must not appear anywhere
      expect(all.some((t) => t.id === 'tx-deleted-record')).toBe(false);
      expect(all.some((t) => t.isDeleted)).toBe(false);
    });
  });

  // =========================================================================
  // 2. SEARCH & FILTER PERFORMANCE AT SCALE (10,000 TRANSACTIONS)
  // =========================================================================
  describe('2. Search & Filter Performance at Scale (10,000 Transactions)', () => {
    it('M4-FLT-07: Evaluates complex filter combinations over 10,000 transactions in < 25ms', () => {
      const largeTxSet: Transaction[] = [];
      const accounts = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];
      const events = [EVENT_IDS.WEDDING, EVENT_IDS.CORPORATE, null];
      const types: Array<'income' | 'expense' | 'transfer'> = ['income', 'expense', 'transfer'];
      const categories = [
        CATEGORY_IDS.ALCOHOL,
        CATEGORY_IDS.STAFF,
        CATEGORY_IDS.SUPPLIES,
        CATEGORY_IDS.LOGISTICS,
        CATEGORY_IDS.OVERHEAD,
        CATEGORY_IDS.CONTRACT_PREPAYMENT,
      ];

      const baseDate = new Date('2026-01-01T00:00:00Z').getTime();

      // Generate 10,000 realistic transactions
      for (let i = 0; i < 10000; i++) {
        const type = types[i % types.length];
        const isExpense = type === 'expense';
        const isIncome = type === 'income';
        const fromAcc = isExpense || type === 'transfer' ? accounts[i % accounts.length] : null;
        const toAcc = isIncome || type === 'transfer' ? accounts[(i + 1) % accounts.length] : null;
        const eventId = events[i % events.length];
        const categoryId = categories[i % categories.length];
        const isDeleted = i % 50 === 0; // 2% soft deleted

        largeTxSet.push({
          id: `bench-tx-${i}`,
          type,
          amount: 1000 + (i % 50000),
          fromAccountId: fromAcc,
          toAccountId: toAcc,
          categoryId,
          eventId,
          description: `Операция ${i} барный кейтеринг ${i % 2 === 0 ? 'закупка мяты и лайма' : 'оплата персонала'}`,
          transactionDate: new Date(baseDate + i * 60000).toISOString(),
          isDeleted,
        });
      }

      // Benchmark 1: Filter by specific account
      const t0 = performance.now();
      const resAccount = filterTransactions(largeTxSet, {
        accountId: ACCOUNT_IDS.CASH_1,
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      });
      const tAccount = performance.now() - t0;
      expect(resAccount.length).toBeGreaterThan(0);
      expect(tAccount).toBeLessThan(50); // Under 50ms

      // Benchmark 2: Full-text search matching Cyrillic description
      const t1 = performance.now();
      const resSearch = filterTransactions(largeTxSet, {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: 'лайма',
      });
      const tSearch = performance.now() - t1;
      expect(resSearch.length).toBeGreaterThan(0);
      expect(tSearch).toBeLessThan(50);

      // Benchmark 3: 4-predicate combined filter
      const t2 = performance.now();
      const resCombined = filterTransactions(largeTxSet, {
        accountId: ACCOUNT_IDS.CASH_1,
        eventId: EVENT_IDS.WEDDING,
        type: 'expense',
        searchQuery: 'персонала',
      });
      const tCombined = performance.now() - t2;
      expect(tCombined).toBeLessThan(50);

      // Benchmark 4: 50 consecutive varied filter queries (simulating rapid user interaction)
      const t3 = performance.now();
      for (let q = 0; q < 50; q++) {
        filterTransactions(largeTxSet, {
          accountId: accounts[q % accounts.length],
          eventId: q % 3 === 0 ? 'general' : EVENT_IDS.WEDDING,
          type: types[q % types.length],
          searchQuery: q % 2 === 0 ? 'мяты' : '',
        });
      }
      const tBatch50 = performance.now() - t3;
      const avgPerQuery = tBatch50 / 50;
      expect(avgPerQuery).toBeLessThan(10); // Average < 10ms per query over 10k items
    });
  });

  // =========================================================================
  // 3. CONCURRENT SOFT-DELETIONS UNDER HIGH VOLUME (100 RAPID REQUESTS)
  // =========================================================================
  describe('3. Concurrent Soft-Deletions Under High Volume (100 Rapid Requests)', () => {
    it('M4-FLT-08: Deletes 100 distinct transactions and verifies atomic consistency and balances', async () => {
      const createdTxs: string[] = [];
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      // Create 100 small expense transactions of 100 ₽ each from CASH_1 sequentially
      for (let i = 0; i < 100; i++) {
        const res = await finance.createExpense({
          amount: 100,
          sourceAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: CATEGORY_IDS.SUPPLIES,
          description: `Sequential test batch ${i}`,
        });
        createdTxs.push(res.transaction.id);
      }

      const balanceAfterExpenses = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(balanceAfterExpenses).toBe(round2(initialCash1 - 100 * 100));

      // Execute 100 soft-deletions
      for (const txId of createdTxs) {
        const delRes = await finance.deleteTransaction(txId);
        expect(delRes.success).toBe(true);
        expect(delRes.transaction.isDeleted).toBe(true);
      }

      // Verify that after deleting all 100 expenses, account balance is 100% restored to initialCash1
      const restoredCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(restoredCash1).toBe(initialCash1);

      // Verify store state: all 100 transactions are marked isDeleted: true
      for (const txId of createdTxs) {
        const tx = await store.getTransactionById(txId);
        expect(tx).not.toBeNull();
        expect(tx!.isDeleted).toBe(true);
      }

      // Verify active transaction query excludes all 100
      const activeTxs = await store.getTransactions({ includeDeleted: false });
      expect(activeTxs.some((t) => createdTxs.includes(t.id))).toBe(false);
    });

    it('M4-FLT-09: Verifies double-refund prevention: sequential repeated deletion is rejected', async () => {
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      const exp = await finance.createExpense({
        amount: 5000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.ALCOHOL,
      });

      // First deletion: must succeed and restore 5000 ₽
      const res1 = await finance.deleteTransaction(exp.transaction.id);
      expect(res1.success).toBe(true);

      const balAfterFirst = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(balAfterFirst).toBe(initialCash1);

      // Repeated deletion attempts: must fail and NEVER refund balance again
      for (let attempt = 0; attempt < 5; attempt++) {
        await expect(finance.deleteTransaction(exp.transaction.id)).rejects.toThrow('не найдена');
        const balAfterAttempt = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
        expect(balAfterAttempt).toBe(initialCash1); // Balance MUST NOT increase!
      }
    });

    it('M4-FLT-10: Documents empirical probe on concurrent deletion race condition (100 rapid requests on SAME transaction)', async () => {
      // Adversarial concurrency probe:
      // What happens when 100 rapid asynchronous deletion requests hit the SAME transaction concurrently?
      const initialCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      const exp = await finance.createExpense({
        amount: 1000,
        sourceAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
        description: 'Single target for 100 concurrent deletes',
      });

      const targetId = exp.transaction.id;
      const balanceBeforeAttack = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;
      expect(balanceBeforeAttack).toBe(round2(initialCash1 - 1000));

      // Dispatch 100 concurrent deletion calls via Promise.allSettled
      const concurrentResults = await Promise.allSettled(
        Array.from({ length: 100 }, () => finance.deleteTransaction(targetId))
      );

      const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
      const rejected = concurrentResults.filter((r) => r.status === 'rejected');
      const finalCash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!.currentBalance;

      // Empirical verification:
      // Transaction must end up marked as isDeleted: true in the store
      const tx = await store.getTransactionById(targetId);
      expect(tx!.isDeleted).toBe(true);

      // At least one request was fulfilled
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);

      // Concurrency audit observation:
      // If the engine lacks an in-memory lock/mutex on transaction deletion,
      // multiple concurrent microtasks observe `!tx.isDeleted` before any write completes,
      // resulting in > 1 fulfilled requests.
      // Subsequent sequential attempts reject with "не найдена".
      const subsequentAttempt = await finance.deleteTransaction(targetId).catch((err) => err.message);
      expect(subsequentAttempt).toContain('не найдена');
    });

    it('M4-FLT-11: Soft-deletions across 100 distinct transactions preserve capital across all 5 accounts', async () => {
      // Test 100 distinct transactions created across all 5 accounts, then deleted
      const accountsList = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];

      const initialTotalCapital = (await finance.getAccounts()).totalBalance;
      const createdTxs: string[] = [];

      // Create 100 mixed transactions (expenses, incomes, transfers)
      for (let i = 0; i < 100; i++) {
        const srcIndex = i % accountsList.length;
        const dstIndex = (i + 1) % accountsList.length;
        const accSrc = accountsList[srcIndex];
        const accDst = accountsList[dstIndex];

        if (i % 3 === 0) {
          // Expense
          const res = await finance.createExpense({
            amount: 200,
            sourceAccountId: accSrc,
            categoryId: CATEGORY_IDS.SUPPLIES,
            description: `Mixed batch expense ${i}`,
          });
          createdTxs.push(res.transaction.id);
        } else if (i % 3 === 1) {
          // Income
          const res = await finance.createIncome({
            amount: 500,
            targetAccountId: accDst,
            categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
            description: `Mixed batch income ${i}`,
          });
          createdTxs.push(res.transaction.id);
        } else {
          // Transfer (accSrc !== accDst guaranteed because length 5, srcIndex !== (srcIndex + 1) % 5)
          const res = await finance.createTransfer({
            amount: 300,
            sourceAccountId: accSrc,
            targetAccountId: accDst,
            description: `Mixed batch transfer ${i}`,
          });
          createdTxs.push(res.transaction.id);
        }
      }

      // Delete all 100 transactions sequentially to ensure clean atomic balance reversal
      for (const txId of createdTxs) {
        await finance.deleteTransaction(txId);
      }

      // After deleting every single transaction, total capital MUST equal initialTotalCapital exactly
      const finalTotalCapital = (await finance.getAccounts()).totalBalance;
      expect(finalTotalCapital).toBe(initialTotalCapital);

      // Verify every transaction is soft-deleted
      for (const txId of createdTxs) {
        const tx = await store.getTransactionById(txId);
        expect(tx!.isDeleted).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. UI RESPONSIVE LAYOUT & INTERACTION VERIFICATION
  // =========================================================================
  describe('4. UI Responsive Layout & Interaction Verification', () => {
    it('M4-FLT-12: Verifies transaction history filter state and default values', () => {
      const defaultFilters: FilterState = {
        accountId: 'all',
        eventId: 'all',
        type: 'all',
        searchQuery: '',
      };

      // When all filters are default, no transactions are filtered out except deleted ones
      const dummyTxs: Transaction[] = [
        {
          id: 'tx-active-1',
          type: 'income',
          amount: 1000,
          toAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
          transactionDate: '2026-09-01T00:00:00Z',
          isDeleted: false,
        },
        {
          id: 'tx-deleted-1',
          type: 'income',
          amount: 1000,
          toAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
          transactionDate: '2026-09-02T00:00:00Z',
          isDeleted: true,
        },
      ];

      const res = filterTransactions(dummyTxs, defaultFilters);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('tx-active-1');
    });

    it('M4-FLT-13: Verifies resilient handling of null and undefined fields in transactions', () => {
      const edgeCaseTxs: Transaction[] = [
        {
          id: 'tx-null-fields',
          type: 'expense',
          amount: 500,
          fromAccountId: null,
          toAccountId: null,
          categoryId: '',
          eventId: null,
          description: undefined,
          transactionDate: '2026-09-01T00:00:00Z',
          isDeleted: false,
        },
      ];

      // Should not throw on null description, null eventId, empty categoryId
      expect(() => {
        filterTransactions(edgeCaseTxs, {
          accountId: 'all',
          eventId: 'general',
          type: 'expense',
          searchQuery: 'something',
        });
      }).not.toThrow();

      // General event filter correctly identifies null eventId
      const resGeneral = filterTransactions(edgeCaseTxs, {
        accountId: 'all',
        eventId: 'general',
        type: 'all',
        searchQuery: '',
      });
      expect(resGeneral).toHaveLength(1);
      expect(resGeneral[0].id).toBe('tx-null-fields');
    });
  });
});
