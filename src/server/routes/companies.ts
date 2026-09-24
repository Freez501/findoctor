/**
 * Truespace — Барный кейтеринг и финансы
 * Companies & Tenants Route (`src/server/routes/companies.ts`)
 *
 * REST API endpoints for multi-tenant company management and invitations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import {
  mirrorCompanyToCloud,
  mirrorMembershipToCloud,
  mirrorAccountToCloud,
  deleteCompanyFromCloud,
} from '../storage/cloudMirror.js';

export function createCompaniesRouter(store: IFinanceStore): Router {
  const router = Router();

  // GET /api/companies
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const companies = await store.getCompanies();
      res.json(companies);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/companies/:id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await store.getCompanyById(req.params.id);
      if (!company) {
        return res.status(404).json({ error: `Организация ${req.params.id} не найдена` });
      }
      res.json(company);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/companies
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug, plan, ownerId } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Поле "name" обязательно для заполнения' });
      }

      const generatedSlug = slug || name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const newCompany = await store.createCompany({
        name: name.trim(),
        slug: generatedSlug || `co-${Date.now()}`,
        plan: plan || 'free',
        isActive: true,
        ownerId: ownerId || 'user_nikita',
      });

      // Add owner membership
      const membership = await store.addCompanyMember({
        companyId: newCompany.id,
        userId: newCompany.ownerId || 'user_nikita',
        role: 'owner',
      });

      // Mirror company and membership to cloud in background
      mirrorCompanyToCloud(newCompany).catch(() => {});
      mirrorMembershipToCloud(membership).catch(() => {});

      // Create clean 4 default accounts (0 balance) for new company
      const defaultAccounts = [
        { name: 'Нал 1 (Касса на площадке)', type: 'cash', color: '#10b981', icon: 'wallet', description: 'Разменная касса на выезде' },
        { name: 'Нал 2 (Сейф / Владелец)', type: 'cash', color: '#059669', icon: 'vault', description: 'Сейф наличных средств' },
        { name: 'Безнал 1 (Основной р/с)', type: 'bank', color: '#3b82f6', icon: 'landmark', description: 'Расчётный счёт в банке' },
        { name: 'Безнал 2 (Резерв / Эквайринг)', type: 'bank', color: '#6366f1', icon: 'credit-card', description: 'Торговый эквайринг' },
      ];

      for (const acc of defaultAccounts) {
        const createdAcc = await store.createAccount({
          companyId: newCompany.id,
          name: acc.name,
          type: acc.type as any,
          color: acc.color,
          icon: acc.icon,
          description: acc.description,
          initialBalance: 0,
        });
        mirrorAccountToCloud(createdAcc).catch(() => {});
      }

      res.status(201).json(newCompany);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/companies/:id
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await store.updateCompany(req.params.id, req.body);
      mirrorCompanyToCloud(updated).catch(() => {});
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/companies/:id
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.params.id;
      if (companyId === 'company_platform_admin') {
        return res.status(400).json({ error: 'Системное пространство платформы защищено от удаления' });
      }

      const company = await store.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: `Организация ${companyId} не найдена` });
      }

      const callingUserId = (req.headers['x-user-id'] as string) || '';
      if (!callingUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let isAllowed = false;
      const callingUser = await store.getUserById(callingUserId);
      if (callingUser?.isSuperAdmin) {
        isAllowed = true;
      } else if (company.ownerId === callingUserId) {
        isAllowed = true;
      } else {
        const members = await store.getCompanyMembers(companyId);
        const userMem = members.find((m) => m.membership.userId === callingUserId);
        if (userMem && (userMem.membership.role === 'owner' || userMem.membership.role === 'admin')) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        return res.status(403).json({ error: 'Удаление организации разрешено только её владельцу или суперадминистратору' });
      }

      await store.deleteCompany(companyId);
      deleteCompanyFromCloud(companyId).catch(() => {});

      res.json({ success: true, message: `Организация "${company.name}" и все её данные успешно удалены` });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/companies/:id/members
  router.get('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await store.getCompanyMembers(req.params.id);
      res.json(members);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/companies/:id/members
  router.post('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role, invitedBy } = req.body;
      if (!userId || !role) {
        return res.status(400).json({ error: 'Поля userId и role обязательны' });
      }

      const membership = await store.addCompanyMember({
        companyId: req.params.id,
        userId,
        role,
        invitedBy,
      });

      mirrorMembershipToCloud(membership).catch(() => {});

      res.status(201).json(membership);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
