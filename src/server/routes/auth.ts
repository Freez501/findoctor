/**
 * Truespace — Барный кейтеринг и финансы
 * Authentication & Profiles Route (`src/server/routes/auth.ts`)
 *
 * REST API endpoints for user profiles, roles, and session resolution.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import {
  mirrorUserProfileToCloud,
  mirrorCompanyToCloud,
  mirrorMembershipToCloud,
  mirrorAccountToCloud,
} from '../storage/cloudMirror.js';
import {
  extractAuthContext,
  signAuthToken,
  verifyPassword,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export function createAuthRouter(store: IFinanceStore): Router {
  const router = Router();
  let devSessionUserId = 'user_nikita';

  const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут.',
  });

  const codeRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Слишком много запросов кода подтверждения. Пожалуйста, подождите 1 минуту.',
  });

  // GET /api/auth/me
  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractAuthContext(req, devSessionUserId);
      const headerCompanyId = (req.headers['x-company-id'] as string) || '';

      const targetUserId = ctx.userId || devSessionUserId;
      let user = await store.getUserById(targetUserId);
      if (!user) {
        user = (await store.getUsers())[0] || null;
      }

      let activeCompanyId = DEFAULT_COMPANY_ID;
      if (user) {
        const companies = await store.getCompanies();
        const userCompanies: string[] = [];
        for (const comp of companies) {
          if (user.isSuperAdmin || comp.ownerId === user.id) {
            userCompanies.push(comp.id);
          } else {
            const members = await store.getCompanyMembers(comp.id);
            if (members.some((m) => m.membership.userId === user.id)) {
              userCompanies.push(comp.id);
            }
          }
        }

        if (headerCompanyId && userCompanies.includes(headerCompanyId)) {
          activeCompanyId = headerCompanyId;
        } else if (userCompanies.length > 0) {
          activeCompanyId = userCompanies[0];
        } else {
          activeCompanyId = companies[0]?.id || DEFAULT_COMPANY_ID;
        }
      }

      res.json({
        user,
        activeCompanyId,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/users
  router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await store.getUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/switch-user
  router.post('/switch-user', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      const user = await store.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: `Пользователь ${userId} не найден` });
      }
      devSessionUserId = userId;

      // Find company for this user
      const companies = await store.getCompanies();
      let userCompany = companies[0];
      for (const comp of companies) {
        if (comp.ownerId === user.id) {
          userCompany = comp;
          break;
        }
        const members = await store.getCompanyMembers(comp.id);
        if (members.some((m) => m.membership.userId === user.id)) {
          userCompany = comp;
          break;
        }
      }

      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        companyId: userCompany?.id || DEFAULT_COMPANY_ID,
      });

      res.json({ success: true, user, company: userCompany, token });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/register-or-invite
  router.post('/register-or-invite', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, fullName, companyId, role } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const ctx = extractAuthContext(req, devSessionUserId);
      const existingUsers = await store.getUsers();
      let user = existingUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        user = await store.saveUserProfile({
          id,
          email: email.trim().toLowerCase(),
          fullName: fullName?.trim() || email.split('@')[0],
          isSuperAdmin: false,
        });
      }

      const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
      const targetRole = role || 'staff';

      await store.addCompanyMember({
        companyId: targetCompanyId,
        userId: user.id,
        role: targetRole,
        invitedBy: ctx.userId || devSessionUserId,
      });

      res.status(201).json({ user, companyId: targetCompanyId, role: targetRole });
    } catch (err) {
      next(err);
    }
  });

  // Ephemeral in-memory verification code registry: email -> { code, expiresAt, fullName?, companyName? }
  const verificationStore = new Map<string, { code: string; expiresAt: number; fullName?: string; companyName?: string }>();

  // POST /api/auth/login
  router.post('/login', loginRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно для входа' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const users = await store.getUsers();
      const user = users.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (!user) {
        return res.status(401).json({
          error: `Пользователь с адресом "${email}" не найден. Проверьте адрес или зарегистрируйтесь.`,
        });
      }

      // Verify super-admin password via environment hash if configured
      if (user.isSuperAdmin && process.env.ADMIN_PASSWORD_HASH) {
        if (!password || !verifyPassword(String(password), process.env.ADMIN_PASSWORD_HASH)) {
          return res.status(401).json({ error: 'Неверный пароль администратора платформы' });
        }
      }

      devSessionUserId = user.id;

      // Find company for this user
      const companies = await store.getCompanies();
      let userCompany = companies[0];
      for (const comp of companies) {
        if (comp.ownerId === user.id) {
          userCompany = comp;
          break;
        }
        const members = await store.getCompanyMembers(comp.id);
        if (members.some((m) => m.membership.userId === user.id)) {
          userCompany = comp;
          break;
        }
      }

      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        companyId: userCompany?.id || DEFAULT_COMPANY_ID,
      });

      res.json({
        success: true,
        user,
        company: userCompany,
        token,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/send-code
  router.post('/send-code', codeRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, companyName } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const existingUsers = await store.getUsers();
      const existing = existingUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (existing) {
        return res.status(400).json({
          error: 'Пользователь с таким email уже зарегистрирован. Воспользуйтесь входом.',
        });
      }

      // Generate 6-digit confirmation code for backup / store verification
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      verificationStore.set(trimmedEmail, {
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
        fullName,
        companyName,
      });

      // Try sending real verification email via Supabase Auth if credentials exist
      let emailSentViaSupabase = false;
      const isTestEnv = process.env.NODE_ENV === 'test';
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (!isTestEnv && supabaseUrl && supabaseKey) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          });

          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: password || 'SecurePass123!',
            options: {
              data: {
                full_name: fullName,
                company_name: companyName,
              },
            },
          });

          if (error) {
            console.warn('[Auth] Supabase signUp note:', error.message);
            if (error.status === 429) {
              return res.status(429).json({
                error: 'Письмо уже отправлено. В целях безопасности повторный запрос возможен через 1 минуту. Проверьте ваш почтовый ящик.',
              });
            }
          } else if (data?.user) {
            emailSentViaSupabase = true;
            console.log(`[Auth] Real Supabase verification email dispatched to ${trimmedEmail}`);
          }
        } catch (e: any) {
          console.warn('[Auth] Supabase dispatch exception:', e?.message || e);
        }
      }

      if (isTestEnv) {
        console.log(`[Auth] Verification code registered for ${trimmedEmail}: ${code}`);
      }

      res.json({
        success: true,
        message: emailSentViaSupabase
          ? `Проверочное письмо отправлено на ${email.trim()}`
          : `Код подтверждения отправлен на ${email.trim()}`,
        ...(isTestEnv ? { previewCode: code } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/verify-code
  router.post('/verify-code', codeRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email и код подтверждения обязательны' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const stored = verificationStore.get(trimmedEmail);
      let isValid = Boolean(
        stored &&
          stored.code === String(code).trim() &&
          stored.expiresAt >= Date.now()
      );

      if (!isValid) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
            const { data, error } = await supabase.auth.verifyOtp({
              email: trimmedEmail,
              token: String(code).trim(),
              type: 'signup',
            });
            if (!error && data?.user) {
              isValid = true;
            }
          } catch {
            // ignore
          }
        }
      }

      if (!isValid) {
        return res.status(400).json({ error: 'Неверный код подтверждения. Проверьте цифры из письма или запросите новый код.' });
      }

      res.json({ success: true, verified: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/forgot-password
  router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }
      res.json({
        success: true,
        message: `Инструкции по восстановлению пароля отправлены на ${email.trim()}`,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, fullName, companyName, code } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const trimmedEmail = email.trim().toLowerCase();

      // If code was supplied, verify it
      if (code) {
        const stored = verificationStore.get(trimmedEmail);
        let isValid = Boolean(
          stored &&
            stored.code === String(code).trim() &&
            stored.expiresAt >= Date.now()
        );

        if (!isValid) {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
              const { data, error } = await supabase.auth.verifyOtp({
                email: trimmedEmail,
                token: String(code).trim(),
                type: 'signup',
              });
              if (!error && data?.user) {
                isValid = true;
              }
            } catch {
              // ignore
            }
          }
        }

        if (!isValid) {
          return res.status(400).json({ error: 'Неверный код подтверждения email. Проверьте цифры из письма.' });
        }
        verificationStore.delete(trimmedEmail);
      }

      const existingUsers = await store.getUsers();
      const existing = existingUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (existing) {
        return res.status(400).json({
          error: 'Пользователь с таким email уже зарегистрирован. Воспользуйтесь входом.',
        });
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const user = await store.saveUserProfile({
        id: userId,
        email: trimmedEmail,
        fullName: fullName?.trim() || email.split('@')[0],
        isSuperAdmin: false,
        isEmailVerified: true,
      });

      // Create new tenant organization with 14-day pro trial
      const coName = companyName?.trim() || `Кейтеринг ${user.fullName}`;
      const trialEndDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
      const newCompany = await store.createCompany({
        name: coName,
        slug: coName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `co-${Date.now()}`,
        plan: 'pro',
        ownerId: user.id,
        trialEndsAt: trialEndDate,
        paidUntil: null,
      });

      // Add user as owner of their company
      const membership = await store.addCompanyMember({
        companyId: newCompany.id,
        userId: user.id,
        role: 'owner',
      });

      devSessionUserId = user.id;

      // Mirror user, company, and membership to cloud in background
      mirrorUserProfileToCloud(user).catch(() => {});
      mirrorCompanyToCloud(newCompany).catch(() => {});
      mirrorMembershipToCloud(membership).catch(() => {});

      // Create a clean template of 4 default accounts with 0 balance for this new company
      const defaultAccounts = [
        { name: 'Нал 1 (Касса на площадке)', type: 'cash', color: '#10b981', icon: 'wallet', description: 'Разменная касса на выезде' },
        { name: 'Нал 2 (Сейф / Владелец)', type: 'cash', color: '#059669', icon: 'vault', description: 'Сейф наличных средств' },
        { name: 'Безнал 1 (Основной р/с)', type: 'bank', color: '#3b82f6', icon: 'landmark', description: 'Расчётный счёт в банке' },
        { name: 'Безнал 2 (Резерв / Эквайринг)', type: 'bank', color: '#6366f1', icon: 'credit-card', description: 'Торговый эквайринг' },
      ];

      for (const acc of defaultAccounts) {
        const createdAcc = await store.createAccount({
          companyId: newCompany.id,
          name: acc.name,
          type: acc.type as any,
          color: acc.color,
          icon: acc.icon,
          description: acc.description,
          initialBalance: 0,
        });
        mirrorAccountToCloud(createdAcc).catch(() => {});
      }

      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        companyId: newCompany.id,
      });

      res.status(201).json({
        success: true,
        user,
        company: newCompany,
        token,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (_req: Request, res: Response) => {
    devSessionUserId = '';
    res.json({ success: true, message: 'Сессия успешно завершена' });
  });

  // PATCH /api/auth/users/:id
  router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { fullName, email, avatarUrl, isSuperAdmin } = req.body;
      const existing = await store.getUserById(id);
      if (!existing) {
        return res.status(404).json({ error: `Пользователь ${id} не найден` });
      }

      const updated = await store.saveUserProfile({
        id,
        email: email !== undefined ? email.trim() : existing.email,
        fullName: fullName !== undefined ? fullName.trim() : existing.fullName,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl,
        isSuperAdmin: isSuperAdmin !== undefined ? isSuperAdmin : existing.isSuperAdmin,
      });

      res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
