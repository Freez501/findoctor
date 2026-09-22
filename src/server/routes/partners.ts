/**
 * Truespace — Барный кейтеринг и финансы
 * Partners Route (`src/server/routes/partners.ts`)
 *
 * Exposes:
 * - GET /api/partners: list business partners (e.g. Влад, Никита)
 * - POST /api/partners: create new partner
 * - PUT /api/partners/:id: update partner
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FinanceService } from '../services/FinanceService.js';
import { getStorageInstance } from '../storage/factory.js';

export function createPartnersRouter(financeService?: FinanceService): Router {
  const router = Router();
  const service = financeService || new FinanceService(getStorageInstance());

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const partners = await service.getPartners();
      res.json({ partners });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, role, id } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Имя партнера обязательно', statusCode: 400 });
        return;
      }

      const partner = await service.savePartner({
        id: id || `partner_${Date.now()}`,
        name: name.trim(),
        role: typeof role === 'string' ? role.trim() : undefined,
        isActive: true,
      });

      res.status(201).json({ partner });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, role, isActive } = req.body;

      const partner = await service.savePartner({
        id,
        name: typeof name === 'string' ? name.trim() : undefined as any,
        role: typeof role === 'string' ? role.trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined as any,
      });

      res.json({ partner });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await service.deletePartner(req.params.id);
      if (!success) {
        res.status(404).json({ error: `Партнёр ${req.params.id} не найден`, statusCode: 404 });
        return;
      }
      res.json({ success: true, message: `Партнёр ${req.params.id} удалён` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createPartnersRouter();
