/**
 * Truespace — Барный кейтеринг и финансы
 * Categories Route (`src/server/routes/categories.ts`)
 *
 * Exposes:
 * - GET /api/categories: list available expense/income categories
 * - GET /api/categories/:id: category details
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';

export function createCategoriesRouter(store?: IFinanceStore): Router {
  const router = Router();
  const storage = store || getStorageInstance();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const categories = await storage.getCategories(companyId);
      res.json({ categories });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await storage.getCategoryById(req.params.id);
      if (!category) {
        res.status(404).json({ error: `Категория ${req.params.id} не найдена`, statusCode: 404 });
        return;
      }
      res.json({ category });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type, direction, color, isEventSpecific, icon } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Название статьи обязательно', statusCode: 400 });
        return;
      }
      const category = await storage.saveCategory({
        id: `cat_${Date.now()}`,
        name: name.trim(),
        type: type || 'expense',
        direction: direction || 'operational',
        color: color || '#64748b',
        icon: icon || 'tag',
        isEventSpecific: typeof isEventSpecific === 'boolean' ? isEventSpecific : true,
      });
      res.status(201).json({ category });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, type, direction, color, isEventSpecific, icon } = req.body;
      const category = await storage.saveCategory({
        id,
        name: typeof name === 'string' ? name.trim() : undefined as any,
        type,
        direction,
        color,
        icon,
        isEventSpecific,
      });
      res.json({ category });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await storage.deleteCategory(req.params.id);
      if (!success) {
        res.status(404).json({ error: `Категория ${req.params.id} не найдена`, statusCode: 404 });
        return;
      }
      res.json({ success: true, message: `Категория ${req.params.id} удалена` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createCategoriesRouter();
