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

export function createEventsRouter(store?: IFinanceStore): Router {
  const router = Router();
  const storage = store || getStorageInstance();

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await storage.getEvents();
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

      const newEvent = await storage.createEvent(validation.data!);
      res.status(201).json({ event: newEvent });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createEventsRouter();
