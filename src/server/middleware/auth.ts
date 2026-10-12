/**
 * Truespace — Барный кейтеринг и финансы
 * Authentication & RBAC Middleware (`src/server/middleware/auth.ts`)
 *
 * Provides stateless HMAC-SHA256 Bearer token signing/verification,
 * request session extraction, and strict role-based access control (`requireRole`).
 */

import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { UserRole } from '../../shared/types.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';

export interface AuthTokenPayload {
  userId: string;
  email?: string;
  companyId?: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authCompanyId?: string;
    }
  }
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'truespace-dev-hmac-secret-key-min-32-chars';
}

export function signAuthToken(payload: Omit<AuthTokenPayload, 'exp'>, ttlSeconds = 7 * 24 * 3600): string {
  const fullPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const bodyB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerB64}.${bodyB64}`)
    .digest('base64url');
  return `${headerB64}.${bodyB64}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf-8')) as AuthTokenPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return crypto.createHmac('sha256', getSecret()).update(password).digest('hex');
}

export function verifyPassword(password: string, expectedHash?: string): boolean {
  if (!expectedHash) return false;
  const actual = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}

export function extractAuthContext(req: Request, devFallbackUserId = 'user_nikita'): {
  userId: string;
  companyId: string;
  isAuthenticated: boolean;
} {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAuthToken(token);
    if (verified?.userId) {
      const headerCompanyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || '';
      return {
        userId: verified.userId,
        companyId: headerCompanyId || verified.companyId || DEFAULT_COMPANY_ID,
        isAuthenticated: true,
      };
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  const headerUserId = (req.headers['x-user-id'] as string) || '';
  const headerCompanyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || '';

  if (!isProd && headerUserId) {
    return {
      userId: headerUserId,
      companyId: headerCompanyId || DEFAULT_COMPANY_ID,
      isAuthenticated: true,
    };
  }

  if (!isProd) {
    return {
      userId: devFallbackUserId,
      companyId: headerCompanyId || DEFAULT_COMPANY_ID,
      isAuthenticated: Boolean(devFallbackUserId),
    };
  }

  return {
    userId: '',
    companyId: headerCompanyId || DEFAULT_COMPANY_ID,
    isAuthenticated: false,
  };
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const ctx = extractAuthContext(req);
  req.authUserId = ctx.userId;
  req.authCompanyId = ctx.companyId;
  next();
}

export function requireRole(
  store: IFinanceStore,
  allowedRoles: UserRole[],
  customErrorMessage?: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, companyId, isAuthenticated } = extractAuthContext(req);

      if (!isAuthenticated || !userId) {
        return res.status(401).json({
          error: 'Требуется авторизация для выполнения операции',
          statusCode: 401,
        });
      }

      const user = await store.getUserById(userId);
      if (!user) {
        return res.status(401).json({
          error: 'Профиль пользователя не найден или сессия недействительна',
          statusCode: 401,
        });
      }

      if (user.isSuperAdmin) {
        req.authUserId = user.id;
        req.authCompanyId = companyId;
        return next();
      }

      const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
      const company = await store.getCompanyById(targetCompanyId);
      if (company && company.ownerId === user.id && allowedRoles.includes('owner')) {
        req.authUserId = user.id;
        req.authCompanyId = targetCompanyId;
        return next();
      }

      const members = await store.getCompanyMembers(targetCompanyId);
      const member = members.find((m) => m.membership.userId === user.id);
      const role = member?.membership.role;

      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
          error:
            customErrorMessage ||
            'Недостаточно прав для выполнения операции. Доступно только владельцу или администратору организации.',
          statusCode: 403,
        });
      }

      req.authUserId = user.id;
      req.authCompanyId = targetCompanyId;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
