/**
 * Truespace — Барный кейтеринг и финансы
 * Authentication & Profiles Route (`src/server/routes/auth.ts`)
 *
 * REST API endpoints for user profiles, roles, and session resolution.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';

// Ephemeral active session user (in local offline/mock mode defaults to Nikita)
let currentSessionUserId = 'user_nikita';

export function createAuthRouter(store: IFinanceStore): Router {
  const router = Router();

  // GET /api/auth/me
  router.get('/me', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      let user = await store.getUserById(currentSessionUserId);
      if (!user) {
        user = (await store.getUsers())[0] || null;
      }
      res.json({
        user,
        activeCompanyId: DEFAULT_COMPANY_ID,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/users
  router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await store.getUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/switch-user
  router.post('/switch-user', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      const user = await store.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: `Пользователь ${userId} не найден` });
      }
      currentSessionUserId = userId;
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/register-or-invite
  router.post('/register-or-invite', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, fullName, companyId, role } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const existingUsers = await store.getUsers();
      let user = existingUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        user = await store.saveUserProfile({
          id,
          email: email.trim().toLowerCase(),
          fullName: fullName?.trim() || email.split('@')[0],
          isSuperAdmin: false,
        });
      }

      const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
      const targetRole = role || 'staff';

      await store.addCompanyMember({
        companyId: targetCompanyId,
        userId: user.id,
        role: targetRole,
        invitedBy: currentSessionUserId,
      });

      res.status(201).json({ user, companyId: targetCompanyId, role: targetRole });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно для входа' });
      }

      const users = await store.getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        return res.status(401).json({
          error: `Пользователь с адресом "${email}" не найден. Проверьте адрес или зарегистрируйтесь.`,
        });
      }

      currentSessionUserId = user.id;

      // Find company for this user
      const companies = await store.getCompanies();
      let userCompany = companies[0];
      for (const comp of companies) {
        const members = await store.getCompanyMembers(comp.id);
        if (members.some((m) => m.membership.userId === user.id)) {
          userCompany = comp;
          break;
        }
      }

      res.json({
        success: true,
        user,
        company: userCompany,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, fullName, companyName } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const existingUsers = await store.getUsers();
      const existing = existingUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({
          error: 'Пользователь с таким email уже зарегистрирован. Воспользуйтесь входом.',
        });
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const user = await store.saveUserProfile({
        id: userId,
        email: email.trim().toLowerCase(),
        fullName: fullName?.trim() || email.split('@')[0],
        isSuperAdmin: false,
      });

      // Create new tenant organization with 14-day pro trial
      const coName = companyName?.trim() || `Кейтеринг ${user.fullName}`;
      const newCompany = await store.createCompany({
        name: coName,
        slug: coName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `co-${Date.now()}`,
        plan: 'pro',
        ownerId: user.id,
      });

      // Add user as owner of their company
      await store.addCompanyMember({
        companyId: newCompany.id,
        userId: user.id,
        role: 'owner',
      });

      // Create a clean template of 4 default accounts with 0 balance for this new company
      const defaultAccounts = [
        { name: 'Нал 1 (Касса на площадке)', type: 'cash', color: '#10b981', icon: 'wallet', description: 'Разменная касса на выезде' },
        { name: 'Нал 2 (Сейф / Владелец)', type: 'cash', color: '#059669', icon: 'vault', description: 'Сейф наличных средств' },
        { name: 'Безнал 1 (Основной р/с)', type: 'bank', color: '#3b82f6', icon: 'landmark', description: 'Расчётный счёт в банке' },
        { name: 'Безнал 2 (Резерв / Эквайринг)', type: 'bank', color: '#6366f1', icon: 'credit-card', description: 'Торговый эквайринг' },
      ];

      for (const acc of defaultAccounts) {
        await store.createAccount({
          companyId: newCompany.id,
          name: acc.name,
          type: acc.type as any,
          color: acc.color,
          icon: acc.icon,
          description: acc.description,
          initialBalance: 0,
        });
      }

      currentSessionUserId = user.id;

      res.status(201).json({
        success: true,
        user,
        company: newCompany,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (_req: Request, res: Response) => {
    currentSessionUserId = '';
    res.json({ success: true, message: 'Сессия успешно завершена' });
  });

  // PATCH /api/auth/users/:id
  router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { fullName, email, avatarUrl, isSuperAdmin } = req.body;
      const existing = await store.getUserById(id);
      if (!existing) {
        return res.status(404).json({ error: `Пользователь ${id} не найден` });
      }

      const updated = await store.saveUserProfile({
        id,
        email: email !== undefined ? email.trim() : existing.email,
        fullName: fullName !== undefined ? fullName.trim() : existing.fullName,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl,
        isSuperAdmin: isSuperAdmin !== undefined ? isSuperAdmin : existing.isSuperAdmin,
      });

      res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
