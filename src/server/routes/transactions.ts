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
      const result = await service.createTransaction(req.body);
      res.status(201).json({
        success: true,
        transaction: result.transaction,
        updatedAccounts: result.updatedAccounts,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка создания транзакции', statusCode: 400 });
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
