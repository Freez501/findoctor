/**
 * Truespace — Барный кейтеринг и финансы
 * Events Route (`src/server/routes/events.ts`)
 *
 * Exposes:
 * - GET /api/events: list catering events
 * - GET /api/events/:id: event details
 * - POST /api/events: create a new event
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';
import { validateCreateEventDTO } from '../../shared/dto.js';
import { mirrorEventToCloud } from '../storage/cloudMirror.js';

export function createEventsRouter(store?: IFinanceStore): Router {
  const router = Router();
  const storage = store || getStorageInstance();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const events = await storage.getEvents(companyId);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        res.status(404).json({ error: `Мероприятие ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      res.json({ event });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = validateCreateEventDTO(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors.join(', '), details: validation.errors, statusCode: 400 });
        return;
      }

      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || undefined;
      const newEvent = await storage.createEvent({ ...validation.data!, companyId });
      mirrorEventToCloud(newEvent).catch(() => {});
      res.status(201).json({ event: newEvent });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await storage.getEventById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: `Мероприятие ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      const updates = req.body;
      const updated = await storage.updateEvent(req.params.id, updates);
      mirrorEventToCloud(updated).catch(() => {});
      res.json({ event: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await storage.deleteEvent(req.params.id);
      if (!success) {
        res.status(404).json({ error: `Мероприятие ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      res.json({ success: true, deletedId: req.params.id });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================
  // EVENT PAYMENT MILESTONES (График оплат)
  // ==========================================

  router.get('/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const milestones = await storage.getMilestones(companyId, req.params.id);
      res.json({ milestones });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, dueDate, amount, status, paidAmount, paidDate, notes } = req.body;
      if (!title || !dueDate || amount === undefined) {
        res.status(400).json({ error: 'Поля title, dueDate и amount обязательны', statusCode: 400 });
        return;
      }
      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || undefined;
      const milestone = await storage.saveMilestone({
        companyId,
        eventId: req.params.id,
        title: String(title).trim(),
        dueDate: String(dueDate),
        amount: Number(amount),
        status: status || 'pending',
        paidAmount: paidAmount !== undefined ? Number(paidAmount) : undefined,
        paidDate: paidDate || undefined,
        notes: notes || undefined,
      });
      res.status(201).json({ milestone });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await storage.getMilestoneById(req.params.milestoneId);
      if (!existing) {
        res.status(404).json({ error: `Этап ${req.params.milestoneId} не найден`, statusCode: 404 });
        return;
      }
      const updated = await storage.saveMilestone({
        ...existing,
        ...req.body,
        id: req.params.milestoneId,
        eventId: req.params.id,
      });
      res.json({ milestone: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await storage.deleteMilestone(req.params.milestoneId);
      if (!success) {
        res.status(404).json({ error: `Этап ${req.params.milestoneId} не найден`, statusCode: 404 });
        return;
      }
      res.json({ success: true, deletedId: req.params.milestoneId });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================
  // EVENT BUDGET ITEMS (Смета План-Факт)
  // ==========================================

  router.get('/:id/budget', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const budgetItems = await storage.getBudgetItems(companyId, req.params.id);
      res.json({ budgetItems });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/budget', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, plannedAmount, notes, id } = req.body;
      if (!categoryId || plannedAmount === undefined) {
        res.status(400).json({ error: 'Поля categoryId и plannedAmount обязательны', statusCode: 400 });
        return;
      }
      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || undefined;
      const budgetItem = await storage.saveBudgetItem({
        id: id || undefined,
        companyId,
        eventId: req.params.id,
        categoryId: String(categoryId),
        plannedAmount: Number(plannedAmount),
        notes: notes || undefined,
      });
      res.status(201).json({ budgetItem });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/budget/:budgetId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await storage.deleteBudgetItem(req.params.budgetId);
      if (!success) {
        res.status(404).json({ error: `Позиция сметы ${req.params.budgetId} не найдена`, statusCode: 404 });
        return;
      }
      res.json({ success: true, deletedId: req.params.budgetId });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================
  // EVENT VENDORS (Подрядчики и команда)
  // ==========================================

  router.get('/:id/vendors', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const vendors = await storage.getVendors(companyId, req.params.id);
      res.json({ vendors });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/vendors', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, role, phone, agreedFee, paidAmount, dueDate, notes } = req.body;
      if (!name || !role || agreedFee === undefined) {
        res.status(400).json({ error: 'Поля name, role и agreedFee обязательны', statusCode: 400 });
        return;
      }
      const companyId = req.body.companyId || (req.headers['x-company-id'] as string) || undefined;
      const vendor = await storage.saveVendor({
        companyId,
        eventId: req.params.id,
        name: String(name).trim(),
        role: String(role).trim(),
        phone: phone ? String(phone).trim() : undefined,
        agreedFee: Number(agreedFee),
        paidAmount: paidAmount ? Number(paidAmount) : 0,
        remainingAmount: Math.max(0, Number(agreedFee) - (Number(paidAmount) || 0)),
        status: (Number(paidAmount) || 0) >= Number(agreedFee) ? 'paid' : (Number(paidAmount) || 0) > 0 ? 'partial' : 'pending',
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      });
      res.status(201).json({ vendor });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id/vendors/:vendorId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await storage.getVendorById(req.params.vendorId);
      if (!existing) {
        res.status(404).json({ error: `Подрядчик ${req.params.vendorId} не найден`, statusCode: 404 });
        return;
      }
      const updated = await storage.saveVendor({
        ...existing,
        ...req.body,
        id: req.params.vendorId,
        eventId: req.params.id,
      });
      res.json({ vendor: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/vendors/:vendorId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await storage.deleteVendor(req.params.vendorId);
      if (!success) {
        res.status(404).json({ error: `Подрядчик ${req.params.vendorId} не найден`, statusCode: 404 });
        return;
      }
      res.json({ success: true, deletedId: req.params.vendorId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createEventsRouter();
