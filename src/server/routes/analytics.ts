/**
 * Truespace — Барный кейтеринг и финансы
 * Analytics Route (`src/server/routes/analytics.ts`)
 *
 * Exposes:
 * - GET /api/analytics/events: margin metrics and category breakdown for all events
 * - GET /api/analytics/events/:id: margin metrics for a specific event
 * - GET /api/analytics/overview: consolidated overview with general bar overhead
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { getStorageInstance } from '../storage/factory.js';

export function createAnalyticsRouter(analyticsService?: AnalyticsService): Router {
  const router = Router();
  const service = analyticsService || new AnalyticsService(getStorageInstance());

  router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const analytics = await service.getAllEventsMargin(companyId);
      res.json({ analytics });
    } catch (err) {
      next(err);
    }
  });

  router.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const metrics = await service.getEventMargin(req.params.id, companyId);
      if (!metrics) {
        res.status(404).json({ error: `Мероприятие ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      res.json({ analytics: metrics });
    } catch (err) {
      next(err);
    }
  });

  router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const overview = await service.getOverview(companyId);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  });

  router.get('/partners', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const partnersAnalytics = await service.getPartnersAnalytics(companyId);
      res.json(partnersAnalytics);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createAnalyticsRouter();
