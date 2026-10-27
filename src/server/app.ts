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
import { createLegalEntitiesRouter } from './routes/legalEntities.js';
import { createTelegramRouter } from './routes/telegram.js';
import { createSystemRouter } from './routes/system.js';
import { createCompaniesRouter } from './routes/companies.js';
import { createAuthRouter } from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';

export interface AppOptions {
  store?: IFinanceStore;
}

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Same-origin, curl, or server-to-server requests
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin)) {
    return true;
  }

  const customOrigins = [
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
    process.env.FRONTEND_URL || '',
  ]
    .map((o) => o.trim())
    .filter(Boolean);

  return customOrigins.includes(origin);
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  const store = options?.store || getStorageInstance();
  const financeService = new FinanceService(store);
  const analyticsService = new AnalyticsService(store);
  const parserService = new ParserService();
  const telegramService = new TelegramBotService(financeService, parserService);

  // Middlewares
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed by CORS policy'));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  // Prevent browser caching of dynamic financial API data
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

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
  app.use('/api/legal-entities', createLegalEntitiesRouter(financeService));
  app.use('/api/telegram', createTelegramRouter(telegramService));
  app.use('/api/system', createSystemRouter(store));
  app.use('/api/companies', createCompaniesRouter(store));
  app.use('/api/auth', createAuthRouter(store));

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

    const isProd = process.env.NODE_ENV === 'production';
    const safeMessage =
      statusCode === 500 && isProd
        ? 'Внутренняя ошибка сервера'
        : err.message || 'Внутренняя ошибка сервера';

    res.status(statusCode).json({
      error: safeMessage,
      statusCode,
    });
  });

  return app;
}

export default createApp();
