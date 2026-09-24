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

  return router;
}

export default createEventsRouter();
