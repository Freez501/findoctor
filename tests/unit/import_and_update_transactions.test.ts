/**
 * Truespace — Transaction Updates, Batch Creation & Statement Import Unit Tests
 * `tests/unit/import_and_update_transactions.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService } from '../../src/server/services/FinanceService.js';
import { ImportStatementService } from '../../src/server/services/ImportStatementService.js';

describe('Transaction Update & Batch Import API', () => {
  let store: InMemoryStore;
  let service: FinanceService;
  let app: any;

  beforeEach(async () => {
    store = new InMemoryStore();
    await store.resetToSeed();
    service = new FinanceService(store);
    app = createApp(service);
  });

  it('PUT /api/transactions/:id updates category, event, and memo without altering balances if amount unchanged', async () => {
    const txs = await service.getTransactions();
    const targetTx = txs[0];
    const initialAcc = await service.getAccountById(targetTx.fromAccountId || targetTx.toAccountId || '');
    const initialBal = initialAcc?.currentBalance;

    const res = await request(app)
      .put(`/api/transactions/${targetTx.id}`)
      .send({
        description: 'Обновлённое примечание для шеф-бармена',
        categoryId: 'cat_staff',
        eventId: 'event_wedding',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.description).toBe('Обновлённое примечание для шеф-бармена');
    expect(res.body.transaction.categoryId).toBe('cat_staff');
    expect(res.body.transaction.eventId).toBe('event_wedding');

    const updatedAcc = await service.getAccountById(targetTx.fromAccountId || targetTx.toAccountId || '');
    expect(updatedAcc?.currentBalance).toBe(initialBal);
  });

  it('PUT /api/transactions/:id correctly recalculates account balance when expense amount is adjusted', async () => {
    // Create an expense of 1000 from cash_1
    const createRes = await service.createTransaction({
      type: 'expense',
      amount: 1000,
      fromAccountId: 'cash_1',
      categoryId: 'cat_supplies',
      description: 'Расходники',
    });

    const txId = createRes.transaction.id;
    const accBefore = await service.getAccountById('cash_1');
    const balBefore = accBefore!.currentBalance;

    // Change amount from 1000 to 1500 (+500 expense -> account balance should decrease by 500)
    const updateRes = await request(app)
      .put(`/api/transactions/${txId}`)
      .send({
        amount: 1500,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.transaction.amount).toBe(1500);

    const accAfter = await service.getAccountById('cash_1');
    expect(accAfter!.currentBalance).toBe(balBefore - 500);
  });

  it('POST /api/transactions/batch successfully creates multiple transactions atomically', async () => {
    const batchData = [
      {
        type: 'expense',
        amount: 3200,
        fromAccountId: 'cash_1',
        categoryId: 'cat_ice',
        description: 'Лёд 20 кг',
      },
      {
        type: 'income',
        amount: 50000,
        toAccountId: 'bank_1',
        categoryId: 'cat_prepayment',
        description: 'Предоплата за бар',
      },
    ];

    const res = await request(app)
      .post('/api/transactions/batch')
      .send({ transactions: batchData });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.transactions).toHaveLength(2);
  });

  it('POST /api/transactions/parse-statement extracts dates, amounts, categories, and flags unreviewed lines', async () => {
    const telegramDump = `
      12.09 3500 лед для Свадьба на веранде
      14.09.2026 +150000 предоплата
      -2400 такси барменов
      Непонятный чек 7800 без категории
    `;

    const res = await request(app)
      .post('/api/transactions/parse-statement')
      .send({
        targetAccountId: 'bank_1',
        text: telegramDump,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalParsed).toBe(4);
    expect(res.body.items).toHaveLength(4);

    const iceItem = res.body.items.find((it: any) => it.amount === 3500);
    expect(iceItem).toBeDefined();
    expect(iceItem.categoryId).toBe('cat_ice');

    const prepayItem = res.body.items.find((it: any) => it.amount === 150000);
    expect(prepayItem).toBeDefined();
    expect(prepayItem.type).toBe('income');

    const unknownItem = res.body.items.find((it: any) => it.amount === 7800);
    expect(unknownItem).toBeDefined();
    expect(unknownItem.needsReview).toBe(true);
  });

  it('POST /api/transactions/parse-statement accurately parses multi-line T-Bank exports without turning dates into amounts', async () => {
    const tbankExport = `
14 мая

ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ХИНТ"
+19 210 ₽
Контрагенты • № 4503 • Оплата за Дополнительные услуги по организации барной зоны на мероприятии, УПД № 5 от16.04.2026 Сумма 19210-00 В т.ч. НДС (5%) 914-76
13 мая

ИП Шамрай Валерий Валериевич
−5 390,7 ₽
Контрагенты • № 50 • Оплата по счету № 1644 от 23.04.2026. В т.ч. НДС 256,70 руб.

Глобальное образование
−500 ₽
Покупки по карте • Отражение операции оплаты по карте номер 2200...8175 CP_OPLATA PARKOVKI Skolkovo RUS. Договор 7007080414

Комиссия
−29 ₽
Услуги банка • Комиссия за внешний банковский перевод. Договор 7007080414

Переводы себе
−150 000 ₽
Перевод собственных средств на карту СБП
    `;

    const res = await request(app)
      .post('/api/transactions/parse-statement')
      .send({
        targetAccountId: 'bank_1',
        text: tbankExport,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalParsed).toBe(5);
    expect(res.body.items).toHaveLength(5);

    // CRITICAL: Ensure dates '14 мая' (14) or '13 мая' (13) are NOT parsed as 14 ₽ or 13 ₽ transactions
    const phantomDateTx = res.body.items.find((it: any) => it.amount === 14 || it.amount === 13);
    expect(phantomDateTx).toBeUndefined();

    // 1. Hint (Income)
    const hintItem = res.body.items.find((it: any) => it.amount === 19210);
    expect(hintItem).toBeDefined();
    expect(hintItem.type).toBe('income');
    expect(hintItem.date).toContain('2026-05-14');
    expect(hintItem.counterparty).toContain('ХИНТ');

    // 2. Shamray (Expense with Unicode minus \u2212)
    const shamrayItem = res.body.items.find((it: any) => it.amount === 5390.7);
    expect(shamrayItem).toBeDefined();
    expect(shamrayItem.type).toBe('expense');
    expect(shamrayItem.date).toContain('2026-05-13');
    expect(shamrayItem.counterparty).toContain('Шамрай');
    expect(shamrayItem.categoryId).toBe('cat_ice');

    // 3. Global education (Parking Skolkovo)
    const parkingItem = res.body.items.find((it: any) => it.amount === 500);
    expect(parkingItem).toBeDefined();
    expect(parkingItem.type).toBe('expense');
    expect(parkingItem.counterparty).toBe('Глобальное образование');

    // 4. Commission
    const commItem = res.body.items.find((it: any) => it.amount === 29);
    expect(commItem).toBeDefined();
    expect(commItem.type).toBe('expense');

    // 5. Partner transfer / self withdrawal
    const transferItem = res.body.items.find((it: any) => it.amount === 150000);
    expect(transferItem).toBeDefined();
    expect(transferItem.type).toBe('expense');
    expect(transferItem.needsReview).toBe(true);
  });

  it('POST /api/transactions/parse-statement handles invisible characters like Word Joiner U+2060 from bank web exports', async () => {
    // Exact raw string copied from T-Bank web UI with \\u2060
    const rawBankSnippet = "14 мая\n\nООО \"ХИНТ\"\n+\u206019 210 ₽\nКонтрагенты • № 4503 • Оплата за бар\n13 мая\n\nИП Шамрай\n−\u20605 390,7 ₽\nКонтрагенты • № 50 • Оплата за лед";

    const res = await request(app)
      .post('/api/transactions/parse-statement')
      .send({
        targetAccountId: 'bank_1',
        text: rawBankSnippet,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalParsed).toBe(2);
    expect(res.body.items).toHaveLength(2);

    const hint = res.body.items[0];
    expect(hint.amount).toBe(19210);
    expect(hint.type).toBe('income');

    const shamray = res.body.items[1];
    expect(shamray.amount).toBe(5390.7);
    expect(shamray.type).toBe('expense');
  });

  it('POST /api/transactions/batch-delete safely cancels multiple transactions and restores account balance', async () => {
    // 1. Get initial balance of cash_1
    const accRes = await request(app).get('/api/accounts');
    const cash1 = accRes.body.accounts.find((a: any) => a.id === 'cash_1');
    const startBalance = cash1.currentBalance;

    // 2. Create 2 expenses
    const tx1 = await request(app).post('/api/transactions').send({
      type: 'expense',
      amount: 1500,
      fromAccountId: 'cash_1',
      categoryId: 'cat_taxi',
      description: 'Тестовый расход 1',
    });
    const tx2 = await request(app).post('/api/transactions').send({
      type: 'expense',
      amount: 2500,
      fromAccountId: 'cash_1',
      categoryId: 'cat_ice',
      description: 'Тестовый расход 2',
    });

    expect(tx1.status).toBe(201);
    expect(tx2.status).toBe(201);

    // 3. Verify balance decreased by 4000
    const midAcc = await request(app).get('/api/accounts');
    const midCash1 = midAcc.body.accounts.find((a: any) => a.id === 'cash_1');
    expect(midCash1.currentBalance).toBe(Math.round((startBalance - 4000) * 100) / 100);

    // 4. Batch delete both transactions
    const delRes = await request(app)
      .post('/api/transactions/batch-delete')
      .send({ ids: [tx1.body.transaction.id, tx2.body.transaction.id] });

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.deletedCount).toBe(2);

    // 5. Verify balance restored completely
    const endAcc = await request(app).get('/api/accounts');
    const endCash1 = endAcc.body.accounts.find((a: any) => a.id === 'cash_1');
    expect(endCash1.currentBalance).toBe(startBalance);
  });

  it('POST /api/transactions/batch-update reassigns account in batch and adjusts both balances', async () => {
    // 1. Get initial balances
    const accRes = await request(app).get('/api/accounts');
    const cash1 = accRes.body.accounts.find((a: any) => a.id === 'cash_1');
    const bank1 = accRes.body.accounts.find((a: any) => a.id === 'bank_1');
    const startCash = cash1.currentBalance;
    const startBank = bank1.currentBalance;

    // 2. Create 1 expense and 1 income on cash_1 (wrong account by mistake)
    const txExp = await request(app).post('/api/transactions').send({
      type: 'expense',
      amount: 1000,
      fromAccountId: 'cash_1',
      categoryId: 'cat_taxi',
      description: 'Расход не на тот счет',
    });
    const txInc = await request(app).post('/api/transactions').send({
      type: 'income',
      amount: 5000,
      toAccountId: 'cash_1',
      categoryId: 'cat_prepay',
      description: 'Доход не на тот счет',
    });

    const expId = txExp.body.transaction.id;
    const incId = txInc.body.transaction.id;

    // 3. Batch reassign to bank_1
    const updateRes = await request(app)
      .post('/api/transactions/batch-update')
      .send({
        ids: [expId, incId],
        updates: { accountId: 'bank_1' },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.updatedCount).toBe(2);

    // 4. Verify balances: cash_1 should be back to startCash, bank_1 should have -1000 and +5000 (+4000)
    const endAcc = await request(app).get('/api/accounts');
    const endCash = endAcc.body.accounts.find((a: any) => a.id === 'cash_1');
    const endBank = endAcc.body.accounts.find((a: any) => a.id === 'bank_1');

    expect(endCash.currentBalance).toBe(startCash);
    expect(endBank.currentBalance).toBe(Math.round((startBank + 4000) * 100) / 100);

    // Clean up
    await request(app).post('/api/transactions/batch-delete').send({ ids: [expId, incId] });
  });
});
