/**
 * Truespace — Барный кейтеринг и финансы
 * Transactions Route (`src/server/routes/transactions.ts`)
 *
 * Exposes:
 * - GET /api/transactions: list filtered transactions
 * - POST /api/transactions: record expense, income, or transfer
 * - DELETE /api/transactions/:id: cancel/reverse transaction with full balance refund
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FinanceService } from '../services/FinanceService.js';
import { getStorageInstance } from '../storage/factory.js';
import { TransactionFilter, TransactionType } from '../../shared/types.js';

export function createTransactionsRouter(financeService?: FinanceService): Router {
  const router = Router();
  const service = financeService || new FinanceService(getStorageInstance());

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: TransactionFilter = {};
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      if (companyId) {
        filter.companyId = companyId;
      }

      if (req.query.accountId) {
        filter.accountId = String(req.query.accountId);
      }

      if (req.query.eventId !== undefined) {
        if (req.query.eventId === 'null' || req.query.eventId === '') {
          filter.eventId = null as any;
        } else {
          filter.eventId = String(req.query.eventId);
        }
      }

      if (req.query.type) {
        filter.type = req.query.type as TransactionType;
      }

      if (req.query.categoryId) {
        filter.categoryId = String(req.query.categoryId);
      }

      if (req.query.startDate) {
        filter.startDate = String(req.query.startDate);
      }

      if (req.query.endDate) {
        filter.endDate = String(req.query.endDate);
      }

      if (req.query.includeDeleted !== undefined) {
        filter.includeDeleted = req.query.includeDeleted === 'true';
      }

      const transactions = await service.getTransactions(filter);
      res.json({ transactions });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transaction = await service.getTransactionById(req.params.id);
      if (!transaction) {
        res.status(404).json({ error: `Транзакция ${req.params.id} не найдена`, statusCode: 404 });
        return;
      }
      res.json({ transaction });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || undefined;
      const result = await service.createTransaction({ ...req.body, companyId });
      res.status(201).json({
        success: true,
        transaction: result.transaction,
        updatedAccounts: result.updatedAccounts,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка создания транзакции', statusCode: 400 });
    }
  });

  router.post('/batch', async (req: Request, res: Response) => {
    try {
      const items = Array.isArray(req.body.transactions) ? req.body.transactions : req.body;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Список транзакций для пакетного создания пуст', statusCode: 400 });
        return;
      }

      const result = await service.createBatchTransactions(items);
      res.status(201).json({
        success: true,
        count: result.transactions.length,
        transactions: result.transactions,
        updatedAccounts: result.updatedAccounts,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка пакетного создания транзакций', statusCode: 400 });
    }
  });

  router.post('/batch-delete', async (req: Request, res: Response) => {
    try {
      const ids = req.body.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'Список идентификаторов для удаления пуст', statusCode: 400 });
        return;
      }

      const result = await service.deleteBatchTransactions(ids);
      res.json({
        success: true,
        deletedCount: result.deletedCount,
        deletedIds: result.deletedIds,
        updatedAccounts: result.updatedAccounts,
        message: `Успешно удалено транзакций: ${result.deletedCount}`,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка пакетного удаления транзакций', statusCode: 400 });
    }
  });

  router.post('/batch-update', async (req: Request, res: Response) => {
    try {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'Список идентификаторов для обновления пуст', statusCode: 400 });
        return;
      }
      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ error: 'Параметры обновления не указаны', statusCode: 400 });
        return;
      }

      const result = await service.updateBatchTransactions(ids, updates);
      res.json({
        success: true,
        updatedCount: result.updatedCount,
        updatedAccounts: result.updatedAccounts,
        message: `Успешно обновлено транзакций: ${result.updatedCount}`,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка пакетного обновления транзакций', statusCode: 400 });
    }
  });

  router.post('/parse-statement', async (req: Request, res: Response) => {
    try {
      const { ImportStatementService } = await import('../services/ImportStatementService.js');
      const importService = new ImportStatementService();

      const targetAccountId = req.body.targetAccountId;
      const text = req.body.text;
      const fileName = req.body.fileName;
      let fileBuffer: Buffer | undefined = undefined;

      if (req.body.fileBase64) {
        fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
      }

      const items = await importService.parseStatement({
        targetAccountId,
        text,
        fileBuffer,
        fileName,
      });

      const needsReviewCount = items.filter((it) => it.needsReview).length;

      res.json({
        targetAccountId,
        items,
        totalParsed: items.length,
        needsReviewCount,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка разбора выписки', statusCode: 400 });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const result = await service.updateTransaction(req.params.id, req.body);
      res.json({
        success: true,
        transaction: result.transaction,
        updatedAccounts: result.updatedAccounts,
      });
    } catch (err: any) {
      const isNotFound = err.message && err.message.includes('не найдена');
      const statusCode = isNotFound ? 404 : 400;
      res.status(statusCode).json({ error: err.message || 'Ошибка обновления транзакции', statusCode });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const result = await service.deleteTransaction(req.params.id);
      res.json({
        success: true,
        transaction: result.transaction,
        updatedAccounts: result.updatedAccounts,
        message: 'Транзакция успешно отменена',
      });
    } catch (err: any) {
      const isNotFound = err.message && err.message.includes('не найдена');
      const statusCode = isNotFound ? 404 : 400;
      res.status(statusCode).json({ error: err.message || 'Ошибка отмены транзакции', statusCode });
    }
  });

  return router;
}

export default createTransactionsRouter();
