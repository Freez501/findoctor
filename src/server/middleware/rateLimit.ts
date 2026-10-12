/**
 * Truespace — Барный кейтеринг и финансы
 * Rate Limiting Middleware (`src/server/middleware/rateLimit.ts`)
 *
 * Sliding window rate limiter for sensitive authentication endpoints.
 */

import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test' && !req.headers['x-enforce-rate-limit']) {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = hits.get(ip);

    if (!record || now >= record.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error:
          options.message ||
          `Слишком много запросов. Пожалуйста, повторите попытку через ${retryAfterSec} сек.`,
        statusCode: 429,
      });
    }

    record.count += 1;
    return next();
  };
}
