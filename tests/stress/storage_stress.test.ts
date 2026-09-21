/**
 * Truespace — Барный кейтеринг и финансы
 * Empirical Stress Testing & Adversarial Invariant Verification Suite
 * Milestone M1 Challenge (`tests/stress/storage_stress.test.ts`)
 *
 * Targets: InMemoryStore, JsonFileStore, Capital Conservation Invariant, Concurrency,
 * Extreme Amounts (0.01 ₽ to 100,000,000 ₽), Negative Balances, and Persistence Resilience.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { JsonFileStore } from '../../src/server/storage/JsonFileStore.js';
import { ACCOUNT_IDS, CATEGORY_IDS, EVENT_IDS } from '../../src/shared/constants.js';

// Precise kopeck helper
function toKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

function toRubles(kopecks: number): number {
  return kopecks / 100;
}

describe('Empirical Stress & Adversarial Suite — Milestone M1', () => {
  // =========================================================================
  // 1. CONCURRENCY & RAPID PARALLEL WRITES
  // =========================================================================
  describe('Concurrency & Rapid Parallel Writes', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-01: InMemoryStore handles 1,000 rapid parallel transactions without loss or ID collisions', async () => {
      const TX_COUNT = 1000;
      const initialTxs = await store.getTransactions({ includeDeleted: true });
      const initialCount = initialTxs.length; // 21 seed transactions

      const startTime = Date.now();
      const promises = Array.from({ length: TX_COUNT }, (_, i) =>
        store.createTransaction({
          type: i % 2 === 0 ? 'income' : 'expense',
          amount: Math.round(((i + 1) * 1.37) * 100) / 100,
          fromAccountId: i % 2 === 0 ? null : ACCOUNT_IDS.CASH_1,
          toAccountId: i % 2 === 0 ? ACCOUNT_IDS.BANK_1 : null,
          categoryId: i % 2 === 0 ? CATEGORY_IDS.ONSITE_SALES : CATEGORY_IDS.SUPPLIES,
          eventId: i % 3 === 0 ? EVENT_IDS.WEDDING : EVENT_IDS.CORPORATE,
          description: `Parallel Stress Tx #${i}`,
        })
      );

      const createdTxs = await Promise.all(promises);
      const elapsedMs = Date.now() - startTime;

      // 1. All promises resolved
      expect(createdTxs).toHaveLength(TX_COUNT);

      // 2. All transactions stored in state
      const allTxs = await store.getTransactions({ includeDeleted: true });
      expect(allTxs).toHaveLength(initialCount + TX_COUNT);

      // 3. ID Uniqueness Check: zero duplicate IDs
      const ids = new Set(allTxs.map((t) => t.id));
      expect(ids.size).toBe(initialCount + TX_COUNT);

      // 4. Performance verification: 1000 writes in memory must be fast (< 2000ms)
      expect(elapsedMs).toBeLessThan(2000);
    });

    it('M1-STRESS-02: JsonFileStore survives 200 rapid parallel writes and maintains valid JSON disk state', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truespace-stress-'));
      const tempFile = path.join(tempDir, 'data', 'truespace_parallel.json');

      try {
        const fileStore = new JsonFileStore(tempFile);
        const PARALLEL_OPS = 200;

        const startTime = Date.now();
        const writePromises = Array.from({ length: PARALLEL_OPS }, (_, i) => {
          if (i % 3 === 0) {
            return fileStore.createTransaction({
              type: 'expense',
              amount: 100 + i,
              fromAccountId: ACCOUNT_IDS.CASH_1,
              categoryId: CATEGORY_IDS.SUPPLIES,
              description: `Parallel Json Tx #${i}`,
            });
          } else if (i % 3 === 1) {
            return fileStore.createEvent({
              title: `Event Parallel #${i}`,
              eventDate: '2026-11-20',
            });
          } else {
            return fileStore.updateAccountBalance(ACCOUNT_IDS.BANK_1, 800000 + i);
          }
        });

        await Promise.all(writePromises);
        const elapsedMs = Date.now() - startTime;

        // Verify disk file exists and is valid JSON
        expect(fs.existsSync(tempFile)).toBe(true);
        const rawContent = fs.readFileSync(tempFile, 'utf-8');
        expect(() => JSON.parse(rawContent)).not.toThrow();

        const diskState = JSON.parse(rawContent);
        expect(diskState.accounts).toHaveLength(5);
        expect(diskState.transactions.length).toBeGreaterThan(21);

        // Verify that a fresh instance restores exact state from disk
        const reloadedStore = new JsonFileStore(tempFile);
        const reloadedAccounts = await reloadedStore.getAccounts();
        const memoryAccounts = await fileStore.getAccounts();

        expect(reloadedAccounts).toEqual(memoryAccounts);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('M1-STRESS-03: Rapid concurrent balance updates across all 5 accounts with deterministic interleaved sequence', async () => {
      const accounts = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];

      // Execute 50 rounds of updates to all 5 accounts concurrently (250 total updates)
      const ROUNDS = 50;
      for (let round = 0; round < ROUNDS; round++) {
        await Promise.all(
          accounts.map((accId, idx) =>
            store.updateAccountBalance(accId, (round + 1) * 1000 + idx * 10)
          )
        );
      }

      // Check final state matches exactly round 50
      const finalAccounts = await store.getAccounts();
      for (let idx = 0; idx < accounts.length; idx++) {
        const acc = finalAccounts.find((a) => a.id === accounts[idx]);
        expect(acc?.currentBalance).toBe(50 * 1000 + idx * 10);
      }
    });

    it('M1-STRESS-16: InMemoryStore handles 5,000 rapid parallel transactions to test ID collision probability under extreme volume', async () => {
      const TX_COUNT = 5000;
      const initialCount = (await store.getTransactions({ includeDeleted: true })).length;

      const promises = Array.from({ length: TX_COUNT }, (_, i) =>
        store.createTransaction({
          type: 'income',
          amount: 100 + (i % 50),
          toAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: CATEGORY_IDS.ONSITE_SALES,
          description: `Bulk Tx ${i}`,
        })
      );

      const created = await Promise.all(promises);
      expect(created).toHaveLength(TX_COUNT);

      const all = await store.getTransactions({ includeDeleted: true });
      expect(all).toHaveLength(initialCount + TX_COUNT);

      const uniqueIds = new Set(all.map((t) => t.id));
      expect(uniqueIds.size).toBe(initialCount + TX_COUNT);
    });

    it('M1-STRESS-19: Concurrent interleaved read-during-write stress test', async () => {
      // 50 writers updating balances while 50 readers read accounts simultaneously
      const writerPromises = Array.from({ length: 50 }, (_, i) =>
        store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 10000 + i)
      );

      const readerPromises = Array.from({ length: 50 }, () =>
        store.getAccounts()
      );

      const [writeResults, readResults] = await Promise.all([
        Promise.all(writerPromises),
        Promise.all(readerPromises),
      ]);

      expect(writeResults).toHaveLength(50);
      expect(readResults).toHaveLength(50);

      // Verify every read result returned valid, uncorrupted account structures
      for (const accounts of readResults) {
        expect(accounts).toHaveLength(5);
        expect(typeof accounts[0].currentBalance).toBe('number');
        expect(Number.isFinite(accounts[0].currentBalance)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. CAPITAL CONSERVATION INVARIANT UNDER STRESS
  // =========================================================================
  describe('Capital Conservation Invariant Under Stress', () => {
    let store: InMemoryStore;
    const STARTING_CAPITAL = 1166300; // Post-seed consolidated capital

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-04: Closed-system transfer loop strictly conserves total capital across 500 random transfers', async () => {
      const accountIds = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];

      const initialAccounts = await store.getAccounts();
      const initialTotal = initialAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
      expect(initialTotal).toBe(STARTING_CAPITAL);

      // Perform 500 transfers with varying amounts between random accounts
      const TRANSFER_COUNT = 500;
      for (let i = 0; i < TRANSFER_COUNT; i++) {
        const fromIdx = Math.floor(Math.random() * accountIds.length);
        let toIdx = Math.floor(Math.random() * accountIds.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(Math.random() * accountIds.length);
        }

        const fromId = accountIds[fromIdx];
        const toId = accountIds[toIdx];

        // Extreme variety of amounts: from 0.01 ₽ to 500,000.00 ₽
        const amount = toRubles(Math.floor(Math.random() * 50000000) + 1);

        const fromAcc = (await store.getAccountById(fromId))!;
        const toAcc = (await store.getAccountById(toId))!;

        const newFromBalance = toRubles(toKopecks(fromAcc.currentBalance) - toKopecks(amount));
        const newToBalance = toRubles(toKopecks(toAcc.currentBalance) + toKopecks(amount));

        await store.updateAccountBalance(fromId, newFromBalance);
        await store.updateAccountBalance(toId, newToBalance);

        // Record transfer transaction
        await store.createTransaction({
          type: 'transfer',
          amount,
          fromAccountId: fromId,
          toAccountId: toId,
          categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
          description: `Stress Transfer #${i}`,
        });

        // Periodic invariant validation every 50 transfers
        if (i % 50 === 0) {
          const currentAccounts = await store.getAccounts();
          const currentTotal = currentAccounts.reduce(
            (sum, a) => sum + toKopecks(a.currentBalance),
            0
          );
          expect(toRubles(currentTotal)).toBe(STARTING_CAPITAL);
        }
      }

      // Final invariant check: exact match to 0.00 ₽
      const finalAccounts = await store.getAccounts();
      const finalTotalKop = finalAccounts.reduce((sum, a) => sum + toKopecks(a.currentBalance), 0);
      expect(toRubles(finalTotalKop)).toBe(STARTING_CAPITAL);
    });

    it('M1-STRESS-05: Open-system mixed cashflow maintains strict Capital Conservation Invariant', async () => {
      const accountIds = [
        ACCOUNT_IDS.CASH_1,
        ACCOUNT_IDS.CASH_2,
        ACCOUNT_IDS.BANK_1,
        ACCOUNT_IDS.BANK_2,
        ACCOUNT_IDS.CARD_SBP,
      ];

      let cumulativeIncomeKop = 0;
      let cumulativeExpenseKop = 0;

      const OPERATIONS_COUNT = 300;

      for (let i = 0; i < OPERATIONS_COUNT; i++) {
        const opType = i % 3 === 0 ? 'income' : i % 3 === 1 ? 'expense' : 'transfer';
        const targetAccId = accountIds[i % accountIds.length];
        const secondaryAccId = accountIds[(i + 1) % accountIds.length];

        // Amounts ranging from 0.01 ₽ to 2,500,000.75 ₽
        const amount = toRubles(Math.floor(Math.random() * 250000000) + 1);
        const amountKop = toKopecks(amount);

        if (opType === 'income') {
          cumulativeIncomeKop += amountKop;
          const acc = (await store.getAccountById(targetAccId))!;
          await store.updateAccountBalance(targetAccId, toRubles(toKopecks(acc.currentBalance) + amountKop));
          await store.createTransaction({
            type: 'income',
            amount,
            toAccountId: targetAccId,
            categoryId: CATEGORY_IDS.ONSITE_SALES,
          });
        } else if (opType === 'expense') {
          cumulativeExpenseKop += amountKop;
          const acc = (await store.getAccountById(targetAccId))!;
          await store.updateAccountBalance(targetAccId, toRubles(toKopecks(acc.currentBalance) - amountKop));
          await store.createTransaction({
            type: 'expense',
            amount,
            fromAccountId: targetAccId,
            categoryId: CATEGORY_IDS.SUPPLIES,
          });
        } else {
          // Transfer: zero net impact on total capital
          const fromAcc = (await store.getAccountById(targetAccId))!;
          const toAcc = (await store.getAccountById(secondaryAccId))!;
          await store.updateAccountBalance(targetAccId, toRubles(toKopecks(fromAcc.currentBalance) - amountKop));
          await store.updateAccountBalance(secondaryAccId, toRubles(toKopecks(toAcc.currentBalance) + amountKop));
          await store.createTransaction({
            type: 'transfer',
            amount,
            fromAccountId: targetAccId,
            toAccountId: secondaryAccId,
            categoryId: CATEGORY_IDS.TRANSFER_INTERNAL,
          });
        }
      }

      // Check Invariant: Current Capital = Starting Capital + Total Income - Total Expense
      const accounts = await store.getAccounts();
      const currentCapitalKop = accounts.reduce((sum, a) => sum + toKopecks(a.currentBalance), 0);
      const expectedCapitalKop = toKopecks(STARTING_CAPITAL) + cumulativeIncomeKop - cumulativeExpenseKop;

      expect(toRubles(currentCapitalKop)).toBe(toRubles(expectedCapitalKop));
    });
  });

  // =========================================================================
  // 3. EXTREME AMOUNTS & ARITHMETIC PRECISION (0.01 ₽ to 100,000,000 ₽)
  // =========================================================================
  describe('Extreme Amounts & Boundary Precision', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-06: Sub-ruble precision (0.01 ₽ micro-transactions) without precision drift', async () => {
      const accId = ACCOUNT_IDS.CASH_1;
      const initialAcc = (await store.getAccountById(accId))!;
      const startBalance = initialAcc.currentBalance; // 6300 ₽

      const STEPS = 1000;
      let balanceKop = toKopecks(startBalance);

      for (let i = 0; i < STEPS; i++) {
        balanceKop += 1; // +0.01 ₽
        await store.updateAccountBalance(accId, toRubles(balanceKop));
      }

      const finalAcc = (await store.getAccountById(accId))!;
      const expectedBalance = toRubles(toKopecks(startBalance) + STEPS);
      expect(finalAcc.currentBalance).toBe(expectedBalance);
      expect(finalAcc.currentBalance).toBe(6310.00);
    });

    it('M1-STRESS-07: Extreme large amounts (100,000,000 ₽) round and persist bit-exact', async () => {
      const HUGE_AMOUNT = 100000000.55;

      const updated = await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, HUGE_AMOUNT);
      expect(updated.currentBalance).toBe(100000000.55);

      const tx = await store.createTransaction({
        type: 'income',
        amount: HUGE_AMOUNT,
        toAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.CONTRACT_PREPAYMENT,
      });

      expect(tx.amount).toBe(100000000.55);

      const fetchedTx = await store.getTransactionById(tx.id);
      expect(fetchedTx?.amount).toBe(100000000.55);

      // Adding 0.01 ₽ to 100,000,000 ₽
      const plusOneKopeck = await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, 100000000.56);
      expect(plusOneKopeck.currentBalance).toBe(100000000.56);
    });

    it('M1-STRESS-20: Micro-kopeck (0.01 ₽) combined with 100,000,000 ₽ does not lose precision in 64-bit float', async () => {
      // 100 million rubles in kopecks is 10^10 kopecks
      // Number.MAX_SAFE_INTEGER is 9 * 10^15 (90 trillion rubles)
      const baseRubles = 100000000;
      await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, baseRubles);

      // Add 1 kopeck 100 times
      for (let i = 1; i <= 100; i++) {
        const expected = toRubles(toKopecks(baseRubles) + i);
        const updated = await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, expected);
        expect(updated.currentBalance).toBe(expected);
      }

      const finalAcc = await store.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(finalAcc?.currentBalance).toBe(100000001.00);
    });

    it('M1-STRESS-08: Sub-kopeck rounding rounds correctly to 2 decimal places', async () => {
      // 1234.5678 -> 1234.57
      const roundedUp = await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 1234.5678);
      expect(roundedUp.currentBalance).toBe(1234.57);

      // 1234.562 -> 1234.56
      const roundedDown = await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 1234.562);
      expect(roundedDown.currentBalance).toBe(1234.56);

      // Transaction amount rounding
      const tx = await store.createTransaction({
        type: 'expense',
        amount: 555.559,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });
      expect(tx.amount).toBe(555.56);
    });
  });

  // =========================================================================
  // 4. NEGATIVE BALANCES & DEFICIT RESILIENCE
  // =========================================================================
  describe('Negative Balances & Deficit Resilience', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-09: Supports negative balances and preserves deep deficit values', async () => {
      const DEEP_DEFICIT = -50000000.75;
      const updated = await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, DEEP_DEFICIT);

      expect(updated.currentBalance).toBe(DEEP_DEFICIT);

      const fetched = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(fetched?.currentBalance).toBe(DEEP_DEFICIT);
    });

    it('M1-STRESS-10: Capital Conservation Invariant holds strictly when accounts are in deficit', async () => {
      // Initial capital: 1,166,300 ₽
      // Debit CASH_1 by 2,000,000 ₽ (CASH_1 goes from 6,300 to -1,993,700 ₽)
      const cash1 = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!;
      const expenseAmount = 2000000;
      const newCash1 = cash1.currentBalance - expenseAmount; // -1,993,700

      await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, newCash1);

      const accounts = await store.getAccounts();
      const currentTotal = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

      // Expected: 1,166,300 - 2,000,000 = -833,700 ₽
      expect(currentTotal).toBe(1166300 - expenseAmount);
      expect(currentTotal).toBe(-833700);

      // Now transfer 500,000 from Bank 1 to Cash 1 (deficit reduction)
      const bank1 = (await store.getAccountById(ACCOUNT_IDS.BANK_1))!;
      await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, bank1.currentBalance - 500000);
      await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, newCash1 + 500000);

      const postTransferAccounts = await store.getAccounts();
      const postTransferTotal = postTransferAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

      // Total must remain EXACTLY -833,700 ₽
      expect(postTransferTotal).toBe(-833700);
    });
  });

  // =========================================================================
  // 5. DEEP CLONING & IMMUTABILITY INTEGRITY
  // =========================================================================
  describe('Deep Cloning & Immutability Integrity', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-11: Mutating returned account array or objects does not corrupt store internal state', async () => {
      const accounts = await store.getAccounts();
      accounts[0].currentBalance = 0; // Malicious mutation
      accounts.pop(); // Malicious deletion

      const freshAccounts = await store.getAccounts();
      expect(freshAccounts).toHaveLength(5);
      expect(freshAccounts[0].currentBalance).not.toBe(0);
    });

    it('M1-STRESS-12: Mutating returned transactions does not corrupt store internal state', async () => {
      const txs = await store.getTransactions();
      txs[0].amount = 999999999;
      txs[0].isDeleted = true;

      const freshTx = await store.getTransactionById(txs[0].id);
      expect(freshTx?.amount).not.toBe(999999999);
      expect(freshTx?.isDeleted).toBe(false);
    });
  });

  // =========================================================================
  // 6. JSON FILE STORE CORRUPTION RECOVERY & MULTI-INSTANCE PHENOMENA
  // =========================================================================
  describe('JsonFileStore Corruption Recovery & Multi-Instance Semantics', () => {
    let tempDir: string;
    let tempFile: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truespace-corrupt-'));
      tempFile = path.join(tempDir, 'data', 'truespace.json');
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('M1-STRESS-13: Recovers cleanly from truncated JSON without crashing', async () => {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, '{"accounts": [', 'utf-8'); // Truncated JSON

      const store = new JsonFileStore(tempFile);
      const accounts = await store.getAccounts();
      expect(accounts).toHaveLength(5);
      expect(accounts.reduce((sum, a) => sum + a.currentBalance, 0)).toBe(1166300);
    });

    it('M1-STRESS-14: Recovers cleanly from missing required keys without crashing', async () => {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify({ invalid: true, numbers: [1, 2, 3] }), 'utf-8');

      const store = new JsonFileStore(tempFile);
      const accounts = await store.getAccounts();
      expect(accounts).toHaveLength(5);
    });

    it('M1-STRESS-15: Recovers cleanly from zero-byte empty file', async () => {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, '', 'utf-8');

      const store = new JsonFileStore(tempFile);
      const accounts = await store.getAccounts();
      expect(accounts).toHaveLength(5);
    });

    it('M1-STRESS-18: Multiple non-singleton JsonFileStore instances demonstrate uncoordinated file overwrite', async () => {
      // Instance 1 loads initial state
      const store1 = new JsonFileStore(tempFile);
      // Instance 2 loads initial state
      const store2 = new JsonFileStore(tempFile);

      // Store 1 updates Cash 1 to 50,000
      await store1.updateAccountBalance(ACCOUNT_IDS.CASH_1, 50000);

      // Store 2 independently updates Bank 1 to 999,000 without awareness of Store 1
      await store2.updateAccountBalance(ACCOUNT_IDS.BANK_1, 999000);

      // A third instance reads disk:
      const store3 = new JsonFileStore(tempFile);
      const accCash1 = await store3.getAccountById(ACCOUNT_IDS.CASH_1);
      const accBank1 = await store3.getAccountById(ACCOUNT_IDS.BANK_1);

      // Since Store 2 had stale Cash 1 (6,300), writing its state overwrote Store 1's change on disk
      expect(accBank1?.currentBalance).toBe(999000);
      expect(accCash1?.currentBalance).toBe(6300); // Proves the necessity of getStorageInstance singleton pattern!
    });
  });

  // =========================================================================
  // 7. EDGE CASES & DATE TIMEZONE FILTERING BEHAVIOR
  // =========================================================================
  describe('Edge Cases & Date Filtering Behavior', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('M1-STRESS-17: Date filtering uses lexicographical comparison which behaves strictly on normalized UTC ISO strings', async () => {
      // Create transactions at known UTC times
      const tx1 = await store.createTransaction({
        type: 'income',
        amount: 1000,
        toAccountId: ACCOUNT_IDS.BANK_1,
        categoryId: CATEGORY_IDS.ONSITE_SALES,
        transactionDate: '2026-09-17T10:00:00.000Z',
      });

      const tx2 = await store.createTransaction({
        type: 'expense',
        amount: 500,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
        transactionDate: '2026-09-17T12:00:00.000Z',
      });

      // Filter with normalized UTC bounds
      const filtered = await store.getTransactions({
        startDate: '2026-09-17T09:00:00.000Z',
        endDate: '2026-09-17T11:00:00.000Z',
      });

      expect(filtered.some((t) => t.id === tx1.id)).toBe(true);
      expect(filtered.some((t) => t.id === tx2.id)).toBe(false);
    });
  });
});
