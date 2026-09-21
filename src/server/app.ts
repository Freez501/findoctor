/**
 * Truespace — Барный кейтеринг и финансы
 * Express Application Setup (`src/server/app.ts`)
 *
 * Configures middlewares, mounts modular REST API routes under `/api/*`,
 * provides client static serving in production, and centralized error handling.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

import { IFinanceStore } from './storage/interfaces.js';
import { getStorageInstance } from './storage/factory.js';
import { FinanceService } from './services/FinanceService.js';
import { AnalyticsService } from './services/AnalyticsService.js';
import { ParserService } from './services/ParserService.js';
import { TelegramBotService } from './telegram/TelegramBotService.js';

import { createAccountsRouter } from './routes/accounts.js';
import { createEventsRouter } from './routes/events.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createPartnersRouter } from './routes/partners.js';
import { createTelegramRouter } from './routes/telegram.js';
import { createSystemRouter } from './routes/system.js';

export interface AppOptions {
  store?: IFinanceStore;
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  const store = options?.store || getStorageInstance();
  const financeService = new FinanceService(store);
  const analyticsService = new AnalyticsService(store);
  const parserService = new ParserService();
  const telegramService = new TelegramBotService(financeService, parserService);

  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger in dev
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'truespace-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use('/api/accounts', createAccountsRouter(financeService));
  app.use('/api/events', createEventsRouter(store));
  app.use('/api/categories', createCategoriesRouter(store));
  app.use('/api/transactions', createTransactionsRouter(financeService));
  app.use('/api/analytics', createAnalyticsRouter(analyticsService));
  app.use('/api/partners', createPartnersRouter(financeService));
  app.use('/api/telegram', createTelegramRouter(telegramService));
  app.use('/api/system', createSystemRouter(store));

  // Serve static client build if available (production / fullstack single port runner)
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Centralized error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isNotFound = err.message && err.message.includes('не найден');
    const statusCode = err.statusCode || (isNotFound ? 404 : 500);

    if (process.env.NODE_ENV !== 'test') {
      console.error('[AppError]', err);
    }

    res.status(statusCode).json({
      error: err.message || 'Внутренняя ошибка сервера',
      statusCode,
    });
  });

  return app;
}

export default createApp();
