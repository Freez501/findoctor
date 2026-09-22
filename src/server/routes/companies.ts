/**
 * Truespace — Барный кейтеринг и финансы
 * Companies & Tenants Route (`src/server/routes/companies.ts`)
 *
 * REST API endpoints for multi-tenant company management and invitations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';

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
      await store.addCompanyMember({
        companyId: newCompany.id,
        userId: newCompany.ownerId || 'user_nikita',
        role: 'owner',
      });

      res.status(201).json(newCompany);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/companies/:id
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await store.updateCompany(req.params.id, req.body);
      res.json(updated);
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

      res.status(201).json(membership);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
