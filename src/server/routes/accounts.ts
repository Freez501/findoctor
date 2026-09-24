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
      const { name, type, initialBalance, description, color, icon } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Название счёта обязательно', statusCode: 400 });
        return;
      }
      const account = await service.createAccount({
        name: name.trim(),
        type: type || 'checking',
        initialBalance: typeof initialBalance === 'number' ? initialBalance : 0,
        description: typeof description === 'string' ? description.trim() : '',
        color: typeof color === 'string' ? color.trim() : undefined,
        icon: typeof icon === 'string' ? icon.trim() : undefined,
      });
      res.status(201).json({ account });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-balances', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || '';
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || '';

      if (userId && companyId) {
        const store = service.getStore();
        const user = await store.getUserById(userId);
        if (user && !user.isSuperAdmin) {
          const members = await store.getCompanyMembers(companyId);
          const member = members.find((m) => m.membership.userId === userId);
          const role = member?.membership.role;
          if (!role || (role !== 'owner' && role !== 'admin')) {
            return res.status(403).json({
              error: 'Сброс остатков счетов разрешён только владельцу или администратору организации',
              statusCode: 403,
            });
          }
        }
      }

      const accounts = await service.resetAllAccountBalances(companyId || undefined);
      res.json({ success: true, accounts, message: 'Остатки всех счетов успешно обнулены' });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isActive, type, currentBalance, initialBalance, color, icon } = req.body;
      const account = await service.saveAccount({
        id,
        name: typeof name === 'string' ? name.trim() : undefined,
        type: typeof type === 'string' ? (type as any) : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
        color: typeof color === 'string' ? color.trim() : undefined,
        icon: typeof icon === 'string' ? icon.trim() : undefined,
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
