/**
 * Truespace — Барный кейтеринг и финансы
 * Authentication & Profiles Route (`src/server/routes/auth.ts`)
 *
 * REST API endpoints for user profiles, roles, and session resolution.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { DEFAULT_COMPANY_ID } from '../../shared/constants.js';
import { UserProfile } from '../../shared/types.js';
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
  hashPassword,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { sendMail, buildVerificationEmailHtml } from '../utils/mailer.js';

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
      const isProd = process.env.NODE_ENV === 'production';
      const ctx = extractAuthContext(req, isProd ? '' : devSessionUserId);
      const headerCompanyId = (req.headers['x-company-id'] as string) || '';

      const targetUserId = ctx.userId || (isProd ? '' : devSessionUserId);
      let user: UserProfile | null = null;
      if (targetUserId) {
        user = await store.getUserById(targetUserId);
        if (!user && !isProd) {
          user = (await store.getUsers())[0] || null;
        }
      }

      if (!user) {
        return res.json({
          user: null,
          activeCompanyId: DEFAULT_COMPANY_ID,
        });
      }

      let activeCompanyId = DEFAULT_COMPANY_ID;
      const companies = await store.getCompanies();
      const ownedIds = companies
        .filter((comp) => user.isSuperAdmin || comp.ownerId === user.id)
        .map((comp) => comp.id);

        if (headerCompanyId && ownedIds.includes(headerCompanyId)) {
          activeCompanyId = headerCompanyId;
        } else if (ownedIds.length > 0 && !headerCompanyId) {
          activeCompanyId = ownedIds[0];
        } else {
          const otherCompanies = companies.filter((comp) => !ownedIds.includes(comp.id));
          const memberResults = await Promise.all(
            otherCompanies.map(async (comp) => {
              const members = await store.getCompanyMembers(comp.id);
              return members.some((m) => m.membership.userId === user!.id) ? comp.id : null;
            })
          );
          const userCompanies = [...ownedIds, ...memberResults.filter((id): id is string => Boolean(id))];

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

  // GET /api/auth/invites/:token
  router.get('/invites/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invite = await store.getInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ valid: false, error: 'Приглашение не найдено или ссылка повреждена' });
      }
      if (invite.status === 'revoked') {
        return res.status(410).json({ valid: false, error: 'Приглашение отозвано организатором' });
      }
      if (invite.status === 'expired' || (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())) {
        return res.status(410).json({ valid: false, error: 'Срок действия приглашения истёк' });
      }
      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        return res.status(410).json({ valid: false, error: 'Лимит переходов по этой ссылке исчерпан' });
      }

      const company = await store.getCompanyById(invite.companyId);
      let inviterName: string | undefined;
      if (invite.invitedBy) {
        const inviter = await store.getUserById(invite.invitedBy);
        inviterName = inviter?.fullName;
      }

      res.json({
        valid: true,
        invite: {
          id: invite.id,
          token: invite.token,
          companyId: invite.companyId,
          companyName: company?.name || 'Кейтеринг',
          role: invite.role,
          email: invite.email,
          fullName: invite.fullName,
          inviterName,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/invites/:token/accept
  router.post('/invites/:token/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, fullName, userId } = req.body;
      let targetUser: UserProfile | null = null;

      if (userId) {
        targetUser = await store.getUserById(userId);
      } else if (email && typeof email === 'string') {
        const trimmedEmail = email.trim().toLowerCase();
        const existingUsers = await store.getUsers();
        targetUser = existingUsers.find((u) => u.email.toLowerCase() === trimmedEmail) || null;

        if (!targetUser) {
          const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          targetUser = await store.saveUserProfile({
            id: newId,
            email: trimmedEmail,
            fullName: fullName?.trim() || trimmedEmail.split('@')[0],
            isSuperAdmin: false,
            isEmailVerified: true,
          });
        }
      } else {
        const ctx = extractAuthContext(req, devSessionUserId);
        if (ctx.userId) {
          targetUser = await store.getUserById(ctx.userId);
        }
      }

      if (!targetUser) {
        return res.status(400).json({ error: 'Укажите email или войдите в систему для принятия приглашения' });
      }

      const result = await store.acceptCompanyInvite(req.params.token, targetUser.id);
      devSessionUserId = targetUser.id;

      res.json({
        success: true,
        user: targetUser,
        company: result.company,
        membership: result.membership,
      });
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

      // Verify stored password hash if set for this user
      const storedHash = store.getUserPasswordHash ? await store.getUserPasswordHash(user.id) : null;
      if (storedHash) {
        if (!password || !verifyPassword(String(password), storedHash)) {
          return res.status(401).json({ error: 'Неверный пароль' });
        }
      } else if (user.isSuperAdmin && process.env.ADMIN_PASSWORD_HASH) {
        if (!password || !verifyPassword(String(password), process.env.ADMIN_PASSWORD_HASH)) {
          return res.status(401).json({ error: 'Неверный пароль администратора платформы' });
        }
      }

      devSessionUserId = user.id;

      // Find company for this user
      const companies = await store.getCompanies();
      let userCompany = companies.find((c) => c.ownerId === user.id);
      if (!userCompany) {
        for (const comp of companies) {
          const members = await store.getCompanyMembers(comp.id);
          if (members.some((m) => m.membership.userId === user.id)) {
            userCompany = comp;
            break;
          }
        }
      }
      if (!userCompany) {
        userCompany = companies[0];
      }

      // Ensure owner membership and default accounts exist for the user's company
      if (userCompany) {
        const existingMembers = await store.getCompanyMembers(userCompany.id);
        if (
          userCompany.ownerId === user.id &&
          !existingMembers.some((m) => m.membership.userId === user.id)
        ) {
          await store.addCompanyMember({
            companyId: userCompany.id,
            userId: user.id,
            role: 'owner',
          });
        }

        const existingAccounts = await store.getAccounts(userCompany.id);
        if (existingAccounts.length === 0) {
          const defaultAccounts = [
            { name: 'Нал 1 (Касса на площадке)', type: 'cash', color: '#10b981', icon: 'wallet', description: 'Разменная касса на выезде' },
            { name: 'Нал 2 (Сейф / Владелец)', type: 'cash', color: '#059669', icon: 'vault', description: 'Сейф наличных средств' },
            { name: 'Безнал 1 (Основной р/с)', type: 'bank', color: '#3b82f6', icon: 'landmark', description: 'Расчётный счёт в банке' },
            { name: 'Безнал 2 (Резерв / Эквайринг)', type: 'bank', color: '#6366f1', icon: 'credit-card', description: 'Торговый эквайринг' },
          ];
          for (const acc of defaultAccounts) {
            await store.createAccount({
              companyId: userCompany.id,
              name: acc.name,
              type: acc.type as any,
              color: acc.color,
              icon: acc.icon,
              description: acc.description,
              initialBalance: 0,
            });
          }
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
      const { email, fullName, companyName } = req.body;
      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        return res.status(400).json({ error: 'Поле "Ваше имя" обязательно для заполнения' });
      }
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ error: 'Поле "Название организации или проекта" обязательно для заполнения' });
      }
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно для заполнения' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Укажите корректный адрес электронной почты (например, name@company.ru)' });
      }

      const existingUsers = await store.getUsers();
      const existing = existingUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (existing) {
        return res.status(400).json({
          error: 'Пользователь с таким email уже зарегистрирован. Воспользуйтесь входом.',
        });
      }

      // Generate 6-digit confirmation code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      verificationStore.set(trimmedEmail, {
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
        fullName,
        companyName,
      });

      const isTestEnv = process.env.NODE_ENV === 'test';

      if (!isTestEnv) {
        try {
          await sendMail({
            to: trimmedEmail,
            subject: 'Код подтверждения — Brilliant Event',
            html: buildVerificationEmailHtml(code, fullName),
          });
          console.log(`[Auth] Verification email sent to ${trimmedEmail}`);
        } catch (e: any) {
          console.error('[Auth] Failed to send verification email:', e?.message || e);
          // Не блокируем регистрацию, но логируем
        }
      } else {
        console.log(`[Auth] [TEST] Verification code for ${trimmedEmail}: ${code}`);
      }

      res.json({
        success: true,
        message: `Код подтверждения отправлен на ${email.trim()}`,
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
      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        return res.status(400).json({ error: 'Поле "Ваше имя" обязательно для заполнения' });
      }
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ error: 'Поле "Название организации или проекта" обязательно для заполнения' });
      }
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Поле email обязательно' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Укажите корректный адрес электронной почты' });
      }

      // If code was supplied, verify it
      if (code) {
        const stored = verificationStore.get(trimmedEmail);
        let isValid = Boolean(
          stored &&
            stored.code === String(code).trim() &&
            stored.expiresAt >= Date.now()
        );

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

  // POST /api/auth/change-email
  router.post('/change-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, newEmail } = req.body;
      if (!userId || !newEmail || typeof newEmail !== 'string') {
        return res.status(400).json({ error: 'Поля userId и newEmail обязательны' });
      }

      const trimmedEmail = newEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Укажите корректный адрес электронной почты (например, name@mail.ru)' });
      }

      const existingUser = await store.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const allUsers = await store.getUsers();
      const duplicate = allUsers.find((u) => u.email.toLowerCase() === trimmedEmail && u.id !== userId);
      if (duplicate) {
        return res.status(400).json({ error: 'Этот email уже используется другим пользователем' });
      }

      const updated = await store.saveUserProfile({
        id: userId,
        email: trimmedEmail,
        fullName: existingUser.fullName,
        avatarUrl: existingUser.avatarUrl,
        isSuperAdmin: existingUser.isSuperAdmin,
        isEmailVerified: true,
      });

      mirrorUserProfileToCloud(updated).catch(() => {});

      res.json({
        success: true,
        user: updated,
        message: 'Email успешно изменён',
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/change-password
  router.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, newPassword, currentPassword } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Поле userId обязательно' });
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов' });
      }

      const targetUser = await store.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Check if there is an existing password hash
      const existingHash = store.getUserPasswordHash ? await store.getUserPasswordHash(userId) : null;
      if (existingHash) {
        // Current password must match
        if (!currentPassword || !verifyPassword(String(currentPassword), existingHash)) {
          return res.status(400).json({ error: 'Текущий пароль указан неверно' });
        }
      } else if (targetUser.isSuperAdmin && process.env.ADMIN_PASSWORD_HASH) {
        if (!currentPassword || !verifyPassword(String(currentPassword), process.env.ADMIN_PASSWORD_HASH)) {
          return res.status(400).json({ error: 'Текущий пароль администратора указан неверно' });
        }
      }

      const newHash = hashPassword(String(newPassword));
      if (store.setUserPassword) {
        await store.setUserPassword(userId, newHash);
      }

      res.json({
        success: true,
        message: 'Пароль успешно обновлён',
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
