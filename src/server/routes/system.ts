/**
 * Truespace — Барный кейтеринг и финансы
 * System & Demo Route (`src/server/routes/system.ts`)
 *
 * Exposes:
 * - POST /api/system/reset-demo: restores pristine demo state
 * - GET /api/system/health: server health check
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';

export function createSystemRouter(store?: IFinanceStore): Router {
  const router = Router();
  const storage = store || getStorageInstance();

  router.post('/reset-demo', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await storage.resetToSeed();
      const accounts = await storage.getAccounts();
      const transactions = await storage.getTransactions({ includeDeleted: false });
      const events = await storage.getEvents();

      res.json({
        success: true,
        message: 'Демонстрационные данные успешно сброшены',
        accounts,
        transactionsCount: transactions.length,
        eventsCount: events.length,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

export default createSystemRouter();
