import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { JsonFileStore } from '../../src/server/storage/JsonFileStore.js';
import { createStorage, getStorageInstance, setStorageInstance } from '../../src/server/storage/factory.js';
import { ACCOUNT_IDS, CATEGORY_IDS, EVENT_IDS } from '../../src/shared/constants.js';

describe('Storage Layer Unit Tests', () => {
  describe('InMemoryStore', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should initialize with canonical 5 accounts totaling 1,166,300 ₽', async () => {
      const accounts = await store.getAccounts();
      expect(accounts).toHaveLength(5);

      const total = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
      expect(total).toBe(1166300);

      const cash1 = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(cash1).toBeDefined();
      expect(cash1?.name).toContain('Нал 1');
      expect(cash1?.currentBalance).toBe(6300);
    });

    it('should return null for non-existent account', async () => {
      const acc = await store.getAccountById('non_existent_account');
      expect(acc).toBeNull();
    });

    it('should update account balance with rounding to 2 decimals', async () => {
      const updated = await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 15000.555);
      expect(updated.currentBalance).toBe(15000.56);

      const fetched = await store.getAccountById(ACCOUNT_IDS.CASH_1);
      expect(fetched?.currentBalance).toBe(15000.56);
    });

    it('should throw error when updating non-existent account', async () => {
      await expect(store.updateAccountBalance('unknown', 1000)).rejects.toThrow('Счёт не найден');
    });

    it('should list all 2 pre-seeded events', async () => {
      const events = await store.getEvents();
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.id)).toContain(EVENT_IDS.WEDDING);
      expect(events.map((e) => e.id)).toContain(EVENT_IDS.CORPORATE);
    });

    it('should retrieve event by ID and create new event', async () => {
      const wedding = await store.getEventById(EVENT_IDS.WEDDING);
      expect(wedding).toBeDefined();
      expect(wedding?.title).toContain('Свадьба');

      const created = await store.createEvent({
        title: 'Юбилей ресторатора',
        eventDate: '2026-10-15',
        budget: 150000,
        guestCount: 40,
        location: 'Веранда',
      });

      expect(created.id).toBeDefined();
      expect(created.title).toBe('Юбилей ресторатора');
      expect(created.status).toBe('planned');

      const allEvents = await store.getEvents();
      expect(allEvents).toHaveLength(3);
    });

    it('should list all 12 categories and get by ID', async () => {
      const categories = await store.getCategories();
      expect(categories).toHaveLength(12);

      const alcohol = await store.getCategoryById(CATEGORY_IDS.ALCOHOL);
      expect(alcohol).toBeDefined();
      expect(alcohol?.name).toBe('Алкоголь и напитки');
      expect(alcohol?.type).toBe('expense');

      const unknown = await store.getCategoryById('unknown_cat');
      expect(unknown).toBeNull();
    });

    it('should filter transactions by eventId and accountId', async () => {
      const weddingTxs = await store.getTransactions({ eventId: EVENT_IDS.WEDDING });
      expect(weddingTxs.length).toBeGreaterThan(0);
      expect(weddingTxs.every((tx) => tx.eventId === EVENT_IDS.WEDDING)).toBe(true);

      const cash1Txs = await store.getTransactions({ accountId: ACCOUNT_IDS.CASH_1 });
      expect(cash1Txs.length).toBeGreaterThan(0);
      expect(cash1Txs.every((tx) => tx.fromAccountId === ACCOUNT_IDS.CASH_1 || tx.toAccountId === ACCOUNT_IDS.CASH_1)).toBe(true);
    });

    it('should filter transactions by type and date range', async () => {
      const incomeTxs = await store.getTransactions({ type: 'income' });
      expect(incomeTxs.length).toBe(5);
      expect(incomeTxs.every((tx) => tx.type === 'income')).toBe(true);

      const rangeTxs = await store.getTransactions({
        startDate: '2026-09-15T00:00:00Z',
        endDate: '2026-09-16T12:00:00Z',
      });
      expect(rangeTxs.length).toBeGreaterThan(0);
      expect(rangeTxs.every((tx) => tx.transactionDate >= '2026-09-15T00:00:00Z' && tx.transactionDate <= '2026-09-16T12:00:00Z')).toBe(true);
    });

    it('should create and retrieve a new transaction', async () => {
      const created = await store.createTransaction({
        type: 'expense',
        amount: 2500,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
        eventId: EVENT_IDS.WEDDING,
        description: 'Срочная закупка лаймов',
      });

      expect(created.id).toBeDefined();
      expect(created.amount).toBe(2500);
      expect(created.isDeleted).toBe(false);

      const fetched = await store.getTransactionById(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.description).toBe('Срочная закупка лаймов');
    });

    it('should soft delete transaction and hide it by default', async () => {
      const created = await store.createTransaction({
        type: 'expense',
        amount: 1000,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.SUPPLIES,
      });

      const deleted = await store.softDeleteTransaction(created.id);
      expect(deleted.isDeleted).toBe(true);

      const activeTxs = await store.getTransactions();
      expect(activeTxs.some((tx) => tx.id === created.id)).toBe(false);

      const allTxs = await store.getTransactions({ includeDeleted: true });
      expect(allTxs.some((tx) => tx.id === created.id)).toBe(true);
    });

    it('should reset state back to pristine seed', async () => {
      await store.updateAccountBalance(ACCOUNT_IDS.CASH_1, 999999);
      await store.createEvent({ title: 'Temporary', eventDate: '2026-11-01' });

      await store.resetToSeed();

      const accounts = await store.getAccounts();
      const cash1 = accounts.find((a) => a.id === ACCOUNT_IDS.CASH_1);
      expect(cash1?.currentBalance).toBe(6300);

      const events = await store.getEvents();
      expect(events).toHaveLength(2);
    });
  });

  describe('JsonFileStore', () => {
    let tempDir: string;
    let tempFile: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truespace-test-'));
      tempFile = path.join(tempDir, 'data', 'truespace.json');
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors in tests
      }
    });

    it('should auto-create parent directories and persist initial seed file', async () => {
      expect(fs.existsSync(tempFile)).toBe(false);

      const fileStore = new JsonFileStore(tempFile);
      expect(fs.existsSync(tempFile)).toBe(true);

      const raw = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.accounts).toHaveLength(5);
      expect(parsed.events).toHaveLength(2);
      expect(parsed.transactions).toHaveLength(21);

      const accounts = await fileStore.getAccounts();
      expect(accounts).toHaveLength(5);
    });

    it('should persist modifications and restore them across new store instances', async () => {
      const store1 = new JsonFileStore(tempFile);
      await store1.updateAccountBalance(ACCOUNT_IDS.BANK_1, 950000);
      await store1.createEvent({
        id: 'event-custom',
        title: 'Фестиваль коктейлей',
        eventDate: '2026-10-01',
      });

      // Instantiate a new store targeting the exact same file
      const store2 = new JsonFileStore(tempFile);
      const acc = await store2.getAccountById(ACCOUNT_IDS.BANK_1);
      expect(acc?.currentBalance).toBe(950000);

      const ev = await store2.getEventById('event-custom');
      expect(ev).toBeDefined();
      expect(ev?.title).toBe('Фестиваль коктейлей');
    });

    it('should recover gracefully if JSON file is corrupted', async () => {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, 'NOT_VALID_JSON_CORRUPTED{{{', 'utf-8');

      const store = new JsonFileStore(tempFile);
      const accounts = await store.getAccounts();
      expect(accounts).toHaveLength(5);
      expect(accounts.find((a) => a.id === ACCOUNT_IDS.CASH_1)?.currentBalance).toBe(6300);
    });
  });

  describe('StorageFactory', () => {
    afterEach(() => {
      setStorageInstance(null);
    });

    it('should create InMemoryStore when mode is memory', () => {
      const store = createStorage({ mode: 'memory' });
      expect(store instanceof InMemoryStore).toBe(true);
      expect(store instanceof JsonFileStore).toBe(false);
    });

    it('should create JsonFileStore when mode is json or default', () => {
      const store = createStorage({ mode: 'json' });
      expect(store instanceof JsonFileStore).toBe(true);
    });

    it('should manage singleton storage instance correctly', () => {
      const store1 = getStorageInstance({ mode: 'memory' });
      const store2 = getStorageInstance();
      expect(store1).toBe(store2);
    });
  });
});
