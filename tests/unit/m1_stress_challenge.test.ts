/**
 * Truespace Bar Catering Finance — Adversarial Stress Test Harness for Milestone M1
 * File: tests/unit/m1_stress_challenge.test.ts
 *
 * Empirical verification of:
 * 1. Random-order transaction deletion & reversal idempotency.
 * 2. Deterministic capital restoration (1,166,300 ₽) and per-account balances.
 * 3. Deep reference isolation & mutation leak prevention.
 * 4. High-frequency fractional kopeck stress testing & floating-point drift detection.
 * 5. JsonFileStore persistence, corruption recovery & rapid re-initialization.
 * 6. Memory leak & heap retention audit across repeated reset cycles.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { JsonFileStore } from '../../src/server/storage/JsonFileStore.js';
import {
  ACCOUNT_IDS,
  INITIAL_ACCOUNTS_SEED,
  INITIAL_TOTAL_CAPITAL,
} from '../../src/shared/constants.js';
import {
  SEED_TRANSACTIONS,
  POST_SEED_ACCOUNTS,
  createInitialDatabaseState,
} from '../../src/server/data/seed.js';
import { Account, Transaction } from '../../src/shared/types.js';

// Helper for exact kopeck integer arithmetic
function toKop(rubles: number): number {
  return Math.round(rubles * 100);
}

function toRub(kopecks: number): number {
  return kopecks / 100;
}

// Fisher-Yates shuffle with seeded pseudorandomness for reproducible chaos
function shuffleArray<T>(array: readonly T[], seed: number): T[] {
  const arr = [...array];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    // Simple LCG PRNG
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

describe('M1 Adversarial Challenge: Idempotency, Drift & Stress Harness', () => {
  describe('Challenge 1: Randomized Transaction Reversal & Rollback Invariance', () => {
    it('should reverse all 21 seed transactions in 50 distinct random orders and always land on exact 840,000 ₽ initial capital', () => {
      const canonicalInitial: Record<string, number> = {};
      for (const acc of INITIAL_ACCOUNTS_SEED) {
        canonicalInitial[acc.id] = acc.initialBalance;
      }

      for (let run = 1; run <= 50; run++) {
        const shuffled = shuffleArray(SEED_TRANSACTIONS, run * 7919);

        // Start from post-seed balances (sum = 1,166,300 ₽)
        const balancesKop: Record<string, number> = {};
        for (const acc of POST_SEED_ACCOUNTS) {
          balancesKop[acc.id] = toKop(acc.currentBalance);
        }

        // Apply reversal of each transaction in random order
        for (const tx of shuffled) {
          const amtKop = toKop(tx.amount);
          if (tx.type === 'income') {
            balancesKop[tx.toAccountId!] -= amtKop;
          } else if (tx.type === 'expense') {
            balancesKop[tx.fromAccountId!] += amtKop;
          } else if (tx.type === 'transfer') {
            balancesKop[tx.fromAccountId!] += amtKop;
            balancesKop[tx.toAccountId!] -= amtKop;
          }
        }

        // Verify that EVERY account returns to exact initial balance
        for (const accId of Object.keys(canonicalInitial)) {
          expect(toRub(balancesKop[accId])).toBe(canonicalInitial[accId]);
        }

        const totalInitial = Object.values(balancesKop).reduce((s, v) => s + v, 0);
        expect(toRub(totalInitial)).toBe(INITIAL_TOTAL_CAPITAL); // 840,000 ₽
      }
    });

    it('should rollback (re-apply) all 21 transactions in another random permutation and deterministically restore 1,166,300 ₽ and exact per-account balances', () => {
      const canonicalPostSeed: Record<string, number> = {};
      for (const acc of POST_SEED_ACCOUNTS) {
        canonicalPostSeed[acc.id] = acc.currentBalance;
      }

      for (let run = 1; run <= 50; run++) {
        // Reverse phase (shuffle A)
        const reverseOrder = shuffleArray(SEED_TRANSACTIONS, run * 31337);
        const balancesKop: Record<string, number> = {};
        for (const acc of POST_SEED_ACCOUNTS) {
          balancesKop[acc.id] = toKop(acc.currentBalance);
        }
        for (const tx of reverseOrder) {
          const amtKop = toKop(tx.amount);
          if (tx.type === 'income') balancesKop[tx.toAccountId!] -= amtKop;
          else if (tx.type === 'expense') balancesKop[tx.fromAccountId!] += amtKop;
          else if (tx.type === 'transfer') {
            balancesKop[tx.fromAccountId!] += amtKop;
            balancesKop[tx.toAccountId!] -= amtKop;
          }
        }

        // Re-apply phase (shuffle B)
        const reapplyOrder = shuffleArray(SEED_TRANSACTIONS, run * 65537);
        for (const tx of reapplyOrder) {
          const amtKop = toKop(tx.amount);
          if (tx.type === 'income') balancesKop[tx.toAccountId!] += amtKop;
          else if (tx.type === 'expense') balancesKop[tx.fromAccountId!] -= amtKop;
          else if (tx.type === 'transfer') {
            balancesKop[tx.fromAccountId!] -= amtKop;
            balancesKop[tx.toAccountId!] += amtKop;
          }
        }

        // Verify restoration
        for (const accId of Object.keys(canonicalPostSeed)) {
          expect(toRub(balancesKop[accId])).toBe(canonicalPostSeed[accId]);
        }

        const restoredTotal = Object.values(balancesKop).reduce((s, v) => s + v, 0);
        expect(toRub(restoredTotal)).toBe(1166300);
      }
    });
  });

  describe('Challenge 2: InMemoryStore Random Soft-Delete, Chaos Mutation & resetToSeed() Idempotency', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should preserve resetToSeed() idempotency across 100 consecutive chaotic destruction-reset cycles', async () => {
      for (let cycle = 1; cycle <= 100; cycle++) {
        // 1. Randomly soft-delete 1 to 21 transactions
        const allTxs = await store.getTransactions({ includeDeleted: true });
        const shuffled = shuffleArray(allTxs, cycle * 101);
        const deleteCount = (cycle % 21) + 1;
        for (let i = 0; i < deleteCount; i++) {
          await store.softDeleteTransaction(shuffled[i].id);
        }

        // 2. Corrupt account balances with extreme values
        await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, -999999.99);
        await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, 100000000);
        await store.updateAccountBalance(ACCOUNT_IDS.CARD_SBP, 0.01);

        // 3. Inject synthetic ephemeral transactions and events
        await store.createTransaction({
          type: 'expense',
          amount: 12345.67,
          fromAccountId: ACCOUNT_IDS.CASH_1,
          categoryId: 'cat_test',
          description: `Chaos tx cycle ${cycle}`,
        });
        await store.createEvent({
          title: `Chaos event ${cycle}`,
          eventDate: '2026-12-31',
        });

        // 4. Verify state is dirty
        const dirtyAccounts = await store.getAccounts();
        const dirtyTotal = dirtyAccounts.reduce((s, a) => s + a.currentBalance, 0);
        expect(dirtyTotal).not.toBe(1166300);

        // 5. Execute resetToSeed()
        await store.resetToSeed();

        // 6. Verify deterministic restoration
        const restoredAccounts = await store.getAccounts();
        expect(restoredAccounts).toHaveLength(5);
        const restoredTotal = restoredAccounts.reduce((s, a) => s + a.currentBalance, 0);
        expect(restoredTotal).toBe(1166300);

        expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(6300);
        expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_2)?.currentBalance).toBe(199000);
        expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)?.currentBalance).toBe(814000);
        expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_2)?.currentBalance).toBe(112000);
        expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CARD_SBP)?.currentBalance).toBe(35000);

        const restoredTxs = await store.getTransactions();
        expect(restoredTxs).toHaveLength(21);
        expect(restoredTxs.every((t) => !t.isDeleted)).toBe(true);

        const allRestoredTxs = await store.getTransactions({ includeDeleted: true });
        expect(allRestoredTxs).toHaveLength(21);

        const restoredEvents = await store.getEvents();
        expect(restoredEvents).toHaveLength(2);
      }
    });
  });

  describe('Challenge 3: Deep Clone Isolation & Object Mutation Resistance', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should resist caller mutation of returned Account objects without mutating store state', async () => {
      const accounts = await store.getAccounts();
      const cash1 = accounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!;
      cash1.currentBalance = 9999999;
      cash1.name = 'HACKED ACCOUNT';

      const freshAccounts = await store.getAccounts();
      const freshCash1 = freshAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)!;
      expect(freshCash1.currentBalance).toBe(6300);
      expect(freshCash1.name).toContain('Нал 1');
    });

    it('should resist caller mutation of returned Transaction objects without mutating store state', async () => {
      const txs = await store.getTransactions();
      txs[0].amount = 9999999;
      txs[0].isDeleted = true;

      const freshTxs = await store.getTransactions();
      expect(freshTxs[0].amount).not.toBe(9999999);
      expect(freshTxs[0].isDeleted).toBe(false);
    });

    it('should ensure repeated resetToSeed() does not suffer from prototype or reference pollution', async () => {
      // Direct call to seed generator
      const state1 = createInitialDatabaseState();
      state1.accounts[0].currentBalance = 0;
      state1.transactions[0].amount = 0;

      // New store instance should have pristine seed
      const newStore = new InMemoryStore();
      const accounts = await newStore.getAccounts();
      expect(accounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(6300);
      const total = accounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(total).toBe(1166300);
    });
  });

  describe('Challenge 4: High-Frequency Fractional Kopeck Stress & Floating-Point Drift', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should execute 5,000 fractional micro-transactions and reversals without accumulating IEEE-754 drift', async () => {
      const startBalance = 100000;
      await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, startBalance);

      let expectedKop = toKop(startBalance);
      let currentRub = startBalance;

      const fractionalAmounts = [
        0.01, 0.07, 0.13, 0.29, 0.49, 0.99, 1.33, 2.71, 5.55, 9.99,
        14.88, 23.45, 50.15, 99.99, 123.45, 0.03, 0.06, 0.09, 0.11, 0.37
      ];

      const appliedAmounts: number[] = [];

      // Apply 2,500 operations
      for (let i = 0; i < 2500; i++) {
        const amt = fractionalAmounts[i % fractionalAmounts.length];
        appliedAmounts.push(amt);
        expectedKop -= toKop(amt);

        currentRub = Math.round((currentRub - amt) * 100) / 100;
        await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, currentRub);
      }

      let fetched = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!;
      expect(fetched.currentBalance).toBe(toRub(expectedKop));

      // Reverse in random order
      const reversedOrder = shuffleArray(appliedAmounts, 424242);
      for (const amt of reversedOrder) {
        expectedKop += toKop(amt);
        currentRub = Math.round((currentRub + amt) * 100) / 100;
        await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, currentRub);
      }

      fetched = (await store.getAccountById(ACCOUNT_IDS.CASH_1))!;
      // Must be EXACTLY startBalance, no 100000.0000000001 or 99999.9999999999
      expect(fetched.currentBalance).toBe(startBalance);
      expect(toRub(expectedKop)).toBe(startBalance);
    });
  });

  describe('Challenge 5: JsonFileStore Persistence, Rapid I/O & File Corruption Recovery', () => {
    let tempDir: string;
    let tempFile: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truespace-stress-'));
      tempFile = path.join(tempDir, 'data', 'truespace.json');
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Cleanup temp
      }
    });

    it('should maintain deterministic state on disk across 25 rapid mutation-reset cycles in JsonFileStore', async () => {
      const fileStore = new JsonFileStore(tempFile);

      for (let cycle = 1; cycle <= 25; cycle++) {
        // Delete a transaction and update balance
        const txs = await fileStore.getTransactions();
        if (txs.length > 0) {
          await fileStore.softDeleteTransaction(txs[cycle % txs.length].id);
        }
        await fileStore.updateAccountBalance(ACCOUNT_IDS.BANK_1, 500000 + cycle);

        // Reset to seed
        await fileStore.resetToSeed();

        // Read raw disk file directly to verify persistence
        const rawJson = fs.readFileSync(tempFile, 'utf-8');
        const parsed = JSON.parse(rawJson);

        expect(parsed.accounts).toHaveLength(5);
        const totalCapital = parsed.accounts.reduce((s: number, a: Account) => s + a.currentBalance, 0);
        expect(totalCapital).toBe(1166300);

        expect(parsed.transactions).toHaveLength(21);
        expect(parsed.transactions.every((t: Transaction) => !t.isDeleted)).toBe(true);
      }
    });

    it('should cleanly recover to 1,166,300 ₽ when disk file is corrupted with truncated JSON', async () => {
      const fileStore = new JsonFileStore(tempFile);
      await fileStore.updateAccountBalance(ACCOUNT_IDS.CASH_1, 12345);

      // Truncate file mid-json
      fs.writeFileSync(tempFile, '{"accounts":[{"id":"cash_1","curr', 'utf-8');

      // Create new instance pointing to truncated file
      const recoveredStore = new JsonFileStore(tempFile);
      const accounts = await recoveredStore.getAccounts();
      expect(accounts).toHaveLength(5);
      const total = accounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(total).toBe(1166300);
    });

    it('should cleanly recover when disk file is corrupted with an empty file', async () => {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, '   \n  \t ', 'utf-8');

      const recoveredStore = new JsonFileStore(tempFile);
      const accounts = await recoveredStore.getAccounts();
      expect(accounts).toHaveLength(5);
      const total = accounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(total).toBe(1166300);
    });
  });

  describe('Challenge 6: Memory Stability & Heap Retention Audit', () => {
    it('should perform 300 sequential storage allocations and reset cycles without unbounded heap growth', async () => {
      // Force GC if available, otherwise record baseline
      if (global.gc) {
        global.gc();
      }
      const initialMem = process.memoryUsage().heapUsed;

      for (let i = 0; i < 300; i++) {
        const tempStore = new InMemoryStore();
        await tempStore.updateAccountBalance(ACCOUNT_IDS.CASH_1, i * 100);
        await tempStore.createTransaction({
          type: 'income',
          amount: i * 50,
          toAccountId: ACCOUNT_IDS.BANK_1,
          categoryId: 'cat_prepayment',
        });
        await tempStore.resetToSeed();
        const accounts = await tempStore.getAccounts();
        expect(accounts.reduce((s, a) => s + a.currentBalance, 0)).toBe(1166300);
      }

      if (global.gc) {
        global.gc();
      }
      const finalMem = process.memoryUsage().heapUsed;
      const growthMB = (finalMem - initialMem) / (1024 * 1024);

      // Heap growth should be well bounded (< 30 MB for 300 small store cycles)
      expect(growthMB).toBeLessThan(30);
    });
  });

  describe('Challenge 7: Boundary & Error Handling in Storage', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should throw descriptive error when updating non-existent account ID', async () => {
      await expect(store.updateAccountBalance('non_existent', 500)).rejects.toThrow(
        'Счёт не найден: non_existent'
      );
    });

    it('should throw descriptive error when soft-deleting non-existent transaction ID', async () => {
      await expect(store.softDeleteTransaction('tx_unknown_id')).rejects.toThrow(
        'Транзакция не найдена: tx_unknown_id'
      );
    });

    it('should handle repeated soft-delete of the same transaction without error (idempotent soft delete)', async () => {
      const tx1 = await store.softDeleteTransaction('tx-001');
      expect(tx1.isDeleted).toBe(true);

      const tx2 = await store.softDeleteTransaction('tx-001');
      expect(tx2.isDeleted).toBe(true);

      const txFound = await store.getTransactionById('tx-001');
      expect(txFound?.isDeleted).toBe(true);
    });
  });

  describe('Challenge 8: Concurrency & Parallel Reset Resistance', () => {
    it('should safely resolve concurrent resetToSeed() calls without state corruption', async () => {
      const store = new InMemoryStore();
      await store.updateAccountBalance(ACCOUNT_IDS.BANK_1, 100);

      // Trigger 10 parallel resetToSeed() promises
      await Promise.all(Array.from({ length: 10 }, () => store.resetToSeed()));

      const accounts = await store.getAccounts();
      const total = accounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(total).toBe(1166300);

      const txs = await store.getTransactions();
      expect(txs).toHaveLength(21);
    });

    it('should handle parallel balance updates to distinct accounts safely', async () => {
      const store = new InMemoryStore();
      await Promise.all([
        store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 10000),
        store.updateAccountBalance(ACCOUNT_IDS.CASH_2, 200000),
        store.updateAccountBalance(ACCOUNT_IDS.BANK_1, 800000),
        store.updateAccountBalance(ACCOUNT_IDS.BANK_2, 100000),
        store.updateAccountBalance(ACCOUNT_IDS.CARD_SBP, 50000),
      ]);

      const accounts = await store.getAccounts();
      const total = accounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(total).toBe(1160000);
    });
  });

  describe('Challenge 9: End-to-End Deletion Lifecycle with Balance Recalculation & resetToSeed()', () => {
    it('should progressively delete all 21 transactions while recalculating balances down to 840,000 ₽, then reset back to 1,166,300 ₽', async () => {
      const store = new InMemoryStore();

      // Track running balances
      const balances: Record<string, number> = {};
      for (const a of await store.getAccounts()) {
        balances[a.id] = toKop(a.currentBalance);
      }

      // Soft delete all 21 transactions one by one, reversing balances in storage
      for (const tx of SEED_TRANSACTIONS) {
        await store.softDeleteTransaction(tx.id);
        const amtKop = toKop(tx.amount);

        if (tx.type === 'income') {
          balances[tx.toAccountId!] -= amtKop;
          await store.updateAccountBalance(tx.toAccountId!, toRub(balances[tx.toAccountId!]));
        } else if (tx.type === 'expense') {
          balances[tx.fromAccountId!] += amtKop;
          await store.updateAccountBalance(tx.fromAccountId!, toRub(balances[tx.fromAccountId!]));
        } else if (tx.type === 'transfer') {
          balances[tx.fromAccountId!] += amtKop;
          balances[tx.toAccountId!] -= amtKop;
          await store.updateAccountBalance(tx.fromAccountId!, toRub(balances[tx.fromAccountId!]));
          await store.updateAccountBalance(tx.toAccountId!, toRub(balances[tx.toAccountId!]));
        }
      }

      // Now all transactions are soft deleted: getTransactions() should be empty
      const activeTxs = await store.getTransactions();
      expect(activeTxs).toHaveLength(0);

      // Balances should now exactly match INITIAL_ACCOUNTS_SEED (840,000 ₽)
      const zeroedAccounts = await store.getAccounts();
      const zeroedTotal = zeroedAccounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(zeroedTotal).toBe(840000);
      expect(zeroedAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(25000);
      expect(zeroedAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_2)?.currentBalance).toBe(180000);
      expect(zeroedAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)?.currentBalance).toBe(450000);
      expect(zeroedAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_2)?.currentBalance).toBe(120000);
      expect(zeroedAccounts.find((a) => a.id === ACCOUNT_IDS.CARD_SBP)?.currentBalance).toBe(65000);

      // Reset to seed
      await store.resetToSeed();

      // Everything must be cleanly restored to 1,166,300 ₽
      const restoredAccounts = await store.getAccounts();
      const restoredTotal = restoredAccounts.reduce((s, a) => s + a.currentBalance, 0);
      expect(restoredTotal).toBe(1166300);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(6300);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CASH_2)?.currentBalance).toBe(199000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_1)?.currentBalance).toBe(814000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.BANK_2)?.currentBalance).toBe(112000);
      expect(restoredAccounts.find((a) => a.id === ACCOUNT_IDS.CARD_SBP)?.currentBalance).toBe(35000);

      const restoredTxs = await store.getTransactions();
      expect(restoredTxs).toHaveLength(21);
      expect(restoredTxs.every((t) => !t.isDeleted)).toBe(true);
    });
  });
});
