/**
 * Truespace — Барный кейтеринг и финансы
 * Telegram & Fast Simulator Route (`src/server/routes/telegram.ts`)
 *
 * Exposes:
 * - GET /api/telegram/status: bot operational status & mode
 * - POST /api/telegram/parse: instant command parsing preview (non-mutating)
 * - POST /api/telegram/execute: parse & commit transaction into ledger
 */

import { Router, Request, Response } from 'express';
import { TelegramBotService } from '../telegram/TelegramBotService.js';
import { FinanceService } from '../services/FinanceService.js';
import { ParserService } from '../services/ParserService.js';
import { getStorageInstance } from '../storage/factory.js';

export function createTelegramRouter(telegramService?: TelegramBotService): Router {
  const router = Router();
  const service =
    telegramService ||
    new TelegramBotService(
      new FinanceService(getStorageInstance()),
      new ParserService()
    );

  router.get('/status', (_req: Request, res: Response) => {
    res.json(service.getStatus());
  });

  router.post('/parse', (req: Request, res: Response) => {
    try {
      const text = req.body?.text;
      if (text === undefined || text === null || (typeof text === 'string' && text.trim() === '')) {
        res.status(400).json({ error: 'Пустая команда', statusCode: 400 });
        return;
      }

      const result = service.parseCommand(text);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка разбора команды', statusCode: 400 });
    }
  });

  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const text = req.body?.text;
      if (!text || typeof text !== 'string' || text.trim() === '') {
        res.status(400).json({ error: 'Пустая команда', statusCode: 400 });
        return;
      }

      const result = await service.executeCommand(text);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка выполнения команды', statusCode: 400 });
    }
  });

  return router;
}

export default createTelegramRouter();
