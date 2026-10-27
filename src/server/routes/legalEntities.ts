/**
 * Truespace — Барный кейтеринг и финансы
 * Legal Entities Route (`src/server/routes/legalEntities.ts`)
 *
 * Exposes:
 * - GET /api/legal-entities: list legal entities (e.g. ООО «Ивент Групп», ИП «Кейтеринг», ИП Личное, Касса)
 * - POST /api/legal-entities: create new legal entity
 * - PUT /api/legal-entities/:id: update legal entity
 * - DELETE /api/legal-entities/:id: delete legal entity
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FinanceService } from '../services/FinanceService.js';
import { getStorageInstance } from '../storage/factory.js';

export function createLegalEntitiesRouter(financeService?: FinanceService): Router {
  const router = Router();
  const service = financeService || new FinanceService(getStorageInstance());

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || undefined;
      const legalEntities = await service.getLegalEntities(companyId);
      res.json({ legalEntities });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await service.getLegalEntityById(req.params.id);
      if (!entity) {
        res.status(404).json({ error: `Юрлицо ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      res.json({ legalEntity: entity });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.body.companyId as string) || undefined;
      const { name, type, taxSystem, taxRate, vatRate, inn, description, isDefault } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Наименование юрлица обязательно', statusCode: 400 });
        return;
      }

      const entity = await service.saveLegalEntity({
        companyId,
        name: name.trim(),
        type: type || 'llc',
        taxSystem: taxSystem || 'usn_income',
        taxRate: taxRate !== undefined && taxRate !== null && taxRate !== '' ? Number(taxRate) : undefined,
        vatRate: vatRate !== undefined && vatRate !== null && vatRate !== '' ? Number(vatRate) : undefined,
        inn: inn ? String(inn).trim() : undefined,
        description: description ? String(description).trim() : undefined,
        isDefault: Boolean(isDefault),
        isActive: true,
      });

      res.status(201).json({ legalEntity: entity });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || (req.body.companyId as string) || undefined;
      const { id } = req.params;
      const { name, type, taxSystem, taxRate, vatRate, inn, description, isDefault, isActive } = req.body;

      const entity = await service.saveLegalEntity({
        id,
        companyId,
        name: name !== undefined ? String(name).trim() : '',
        type: type !== undefined ? type : 'llc',
        taxSystem: taxSystem !== undefined ? taxSystem : 'usn_income',
        taxRate: taxRate !== undefined && taxRate !== null && taxRate !== '' ? Number(taxRate) : undefined,
        vatRate: vatRate !== undefined && vatRate !== null && vatRate !== '' ? Number(vatRate) : undefined,
        inn: inn !== undefined ? (inn ? String(inn).trim() : undefined) : undefined,
        description: description !== undefined ? (description ? String(description).trim() : undefined) : undefined,
        isDefault: isDefault !== undefined ? Boolean(isDefault) : false,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });

      res.json({ legalEntity: entity });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await service.deleteLegalEntity(req.params.id);
      if (!success) {
        res.status(404).json({ error: `Юрлицо ${req.params.id} не найдено`, statusCode: 404 });
        return;
      }
      res.json({ success: true, message: `Юрлицо ${req.params.id} удалено` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createLegalEntitiesRouter();
