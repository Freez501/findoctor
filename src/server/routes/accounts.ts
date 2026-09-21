/**
 * Truespace — Барный кейтеринг и финансы
 * Accounts Route (`src/server/routes/accounts.ts`)
 *
 * Exposes:
 * - GET /api/accounts: list of 5 accounts and total business liquidity
 * - GET /api/accounts/:id: specific account details
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FinanceService } from '../services/FinanceService.js';
import { getStorageInstance } from '../storage/factory.js';

export function createAccountsRouter(financeService?: FinanceService): Router {
  const router = Router();
  const service = financeService || new FinanceService(getStorageInstance());

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.getAccounts();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await service.getAccountById(req.params.id);
      if (!account) {
        res.status(404).json({ error: `Счёт ${req.params.id} не найден`, statusCode: 404 });
        return;
      }
      res.json({ account });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type, initialBalance, description } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Название счёта обязательно', statusCode: 400 });
        return;
      }
      const account = await service.createAccount({
        name: name.trim(),
        type: type || 'checking',
        initialBalance: typeof initialBalance === 'number' ? initialBalance : 0,
        description: typeof description === 'string' ? description.trim() : '',
      });
      res.status(201).json({ account });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
      const account = await service.saveAccount({
        id,
        name: typeof name === 'string' ? name.trim() : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      });
      res.json({ account });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createAccountsRouter();
