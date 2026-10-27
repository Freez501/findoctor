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
import { requireRole } from '../middleware/auth.js';

export function createAccountsRouter(financeService?: FinanceService): Router {
  const router = Router();
  const service = financeService || new FinanceService(getStorageInstance());
  const requireOwnerOrAdmin = requireRole(
    service.getStore(),
    ['owner', 'admin'],
    'Сброс остатков счетов разрешён только владельцу или администратору организации'
  );

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const data = await service.getAccounts(companyId);
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
      const { name, type, initialBalance, description, color, icon, legalEntityId, legalEntityName } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Название счёта обязательно', statusCode: 400 });
        return;
      }
      // Без companyId счёт уходил в демо-компанию и не появлялся у пользователя
      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const account = await service.createAccount({
        companyId,
        name: name.trim(),
        type: type || 'checking',
        initialBalance: typeof initialBalance === 'number' ? initialBalance : 0,
        description: typeof description === 'string' ? description.trim() : '',
        color: typeof color === 'string' ? color.trim() : undefined,
        icon: typeof icon === 'string' ? icon.trim() : undefined,
        legalEntityId: typeof legalEntityId === 'string' ? legalEntityId : undefined,
        legalEntityName: typeof legalEntityName === 'string' ? legalEntityName : undefined,
      });
      res.status(201).json({ account });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-balances', requireOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || '';
      const accounts = await service.resetAllAccountBalances(companyId || undefined);
      res.json({ success: true, accounts, message: 'Остатки всех счетов успешно обнулены' });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isActive, type, currentBalance, initialBalance, color, icon, legalEntityId, legalEntityName } = req.body;
      const account = await service.saveAccount({
        id,
        name: typeof name === 'string' ? name.trim() : undefined,
        type: typeof type === 'string' ? (type as any) : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
        color: typeof color === 'string' ? color.trim() : undefined,
        icon: typeof icon === 'string' ? icon.trim() : undefined,
        legalEntityId: legalEntityId !== undefined ? String(legalEntityId || '') : undefined,
        legalEntityName: legalEntityName !== undefined ? String(legalEntityName || '') : undefined,
        currentBalance: typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : undefined,
        initialBalance: typeof initialBalance === 'number' && !isNaN(initialBalance) ? initialBalance : undefined,
      });
      res.json({ account });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await service.deleteAccount(req.params.id);
      if (!success) {
        res.status(404).json({ error: `Счёт ${req.params.id} не найден`, statusCode: 404 });
        return;
      }
      res.json({ success: true, message: `Счёт ${req.params.id} удалён` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createAccountsRouter();
