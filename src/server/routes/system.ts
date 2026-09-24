/**
 * Truespace — Барный кейтеринг и финансы
 * System & Demo Route (`src/server/routes/system.ts`)
 *
 * Exposes:
 * - POST /api/system/reset-demo: restores pristine demo state
 * - GET /api/system/health: server health check
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IFinanceStore } from '../storage/interfaces.js';
import { getStorageInstance } from '../storage/factory.js';

export function createSystemRouter(store?: IFinanceStore): Router {
  const router = Router();
  const storage = store || getStorageInstance();

  router.post('/reset-demo', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await storage.resetToSeed();
      const accounts = await storage.getAccounts();
      const transactions = await storage.getTransactions({ includeDeleted: false });
      const events = await storage.getEvents();

      res.json({
        success: true,
        message: 'Демонстрационные данные успешно сброшены',
        accounts,
        transactionsCount: transactions.length,
        eventsCount: events.length,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/system/supabase/status
  router.get('/supabase/status', async (_req: Request, res: Response) => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const isConfigured = Boolean(url && key);

    res.json({
      isConfigured,
      mode: isConfigured ? 'cloud' : 'local',
      url: url ? `${url.substring(0, 20)}...` : null,
      message: isConfigured
        ? 'Облачная база данных Supabase активна'
        : 'Автономный локальный режим (data/truespace.json)',
    });
  });

  // GET /api/system/supabase/sql
  router.get('/supabase/sql', async (_req: Request, res: Response) => {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const rootPath = path.resolve(process.cwd(), 'supabase.sql');
      const fallbackPath = path.resolve(process.cwd(), 'src/server/data/supabase.sql');

      let sql = '';
      if (fs.existsSync(rootPath)) {
        sql = fs.readFileSync(rootPath, 'utf-8');
      } else if (fs.existsSync(fallbackPath)) {
        sql = fs.readFileSync(fallbackPath, 'utf-8');
      }

      res.json({ success: true, sql });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/system/supabase/test
  router.post('/supabase/test', async (req: Request, res: Response) => {
    try {
      const { url, key } = req.body;
      const targetUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const targetKey = key || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (!targetUrl || !targetKey) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать Supabase Project URL и Anon Key',
        });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(targetUrl, targetKey, {
        auth: { persistSession: false },
      });

      // Test querying accounts or health
      const { data, error } = await testClient.from('accounts').select('id, name').limit(5);

      if (error) {
        return res.json({
          success: false,
          error: `Ошибка ответа Supabase: ${error.message}. Убедитесь, что вы запустили SQL-миграцию из supabase.sql.`,
        });
      }

      return res.json({
        success: true,
        message: 'Соединение с Supabase успешно установлено!',
        foundAccounts: data?.length || 0,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Не удалось подключиться к Supabase: ${err.message}`,
      });
    }
  });

  // POST /api/system/supabase/save-config
  router.post('/supabase/save-config', async (req: Request, res: Response) => {
    try {
      const { url, key } = req.body;
      if (!url || !key) {
        return res.status(400).json({ error: 'URL и Anon Key обязательны' });
      }

      process.env.VITE_SUPABASE_URL = url.trim();
      process.env.VITE_SUPABASE_ANON_KEY = key.trim();
      process.env.SUPABASE_URL = url.trim();
      process.env.SUPABASE_ANON_KEY = key.trim();

      // Optionally append/update to .env on disk
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf-8');
        }

        const lines = envContent.split('\n').filter((l) => !l.startsWith('VITE_SUPABASE_') && !l.startsWith('SUPABASE_'));
        lines.push(`VITE_SUPABASE_URL=${url.trim()}`);
        lines.push(`VITE_SUPABASE_ANON_KEY=${key.trim()}`);
        lines.push(`SUPABASE_URL=${url.trim()}`);
        lines.push(`SUPABASE_ANON_KEY=${key.trim()}`);

        fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
      } catch (fileErr) {
        console.warn('[SystemRouter] Could not write .env file:', fileErr);
      }

      res.json({
        success: true,
        message: 'Конфигурация Supabase успешно сохранена в переменные окружения!',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/supabase/sync
  router.post('/supabase/sync', async (req: Request, res: Response) => {
    try {
      const { url, key } = req.body;
      const targetUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const targetKey = key || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (!targetUrl || !targetKey) {
        return res.status(400).json({
          success: false,
          error: 'Supabase не настроен. Сначала укажите Project URL и Anon Key.',
        });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(targetUrl, targetKey, {
        auth: { persistSession: false },
      });

      // Gather current local data
      const users = await storage.getUsers();
      const companies = await storage.getCompanies();
      const memberships: any[] = [];
      for (const co of companies) {
        const members = await storage.getCompanyMembers(co.id);
        memberships.push(...members.map((m) => m.membership));
      }
      const accounts = await storage.getAccounts();
      const events = await storage.getEvents();
      const categories = await storage.getCategories();
      const transactions = await storage.getTransactions({ includeDeleted: true });
      const partners = await storage.getPartners();

      // 1. Sync User Profiles (must be first for foreign keys)
      if (users.length > 0) {
        await client.from('user_profiles').upsert(
          users.map((u) => ({
            id: u.id,
            email: u.email,
            full_name: u.fullName || null,
            avatar_url: u.avatarUrl || null,
            is_super_admin: u.isSuperAdmin || false,
            is_email_verified: u.isEmailVerified || false,
          }))
        );
      }

      // 2. Sync Companies
      if (companies.length > 0) {
        await client.from('companies').upsert(
          companies.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            plan: c.plan,
            is_active: c.isActive,
            owner_id: c.ownerId,
            trial_ends_at: c.trialEndsAt || null,
            paid_until: c.paidUntil || null,
          }))
        );
      }

      // 3. Sync Company Members
      if (memberships.length > 0) {
        await client.from('company_members').upsert(
          memberships.map((m) => ({
            id: m.id,
            company_id: m.companyId,
            user_id: m.userId,
            role: m.role,
            invited_by: m.invitedBy || null,
          }))
        );
      }

      // 2. Sync Accounts
      if (accounts.length > 0) {
        await client.from('accounts').upsert(
          accounts.map((a) => ({
            id: a.id,
            company_id: a.companyId || 'company_truespace_default',
            name: a.name,
            type: a.type,
            description: a.description || '',
            initial_balance: a.initialBalance,
            current_balance: a.currentBalance,
            currency: a.currency || 'RUB',
            is_active: a.isActive ?? true,
            color: a.color,
            icon: a.icon,
          }))
        );
      }

      // 3. Sync Categories
      if (categories.length > 0) {
        await client.from('categories').upsert(
          categories.map((c) => ({
            id: c.id,
            company_id: c.companyId || 'company_truespace_default',
            name: c.name,
            type: c.type,
            direction: c.direction,
            color: c.color || '#64748b',
            icon: c.icon,
            is_event_specific: c.isEventSpecific ?? true,
          }))
        );
      }

      // 4. Sync Events
      if (events.length > 0) {
        await client.from('events').upsert(
          events.map((e) => ({
            id: e.id,
            company_id: e.companyId || 'company_truespace_default',
            title: e.title,
            client_name: e.clientName,
            event_date: e.eventDate,
            status: e.status,
            budget: e.budget || 0,
            contract_amount: e.contractAmount || 0,
            guest_count: e.guestCount || 0,
            location: e.location,
            notes: e.notes,
          }))
        );
      }

      // 5. Sync Partners
      if (partners.length > 0) {
        await client.from('partners').upsert(
          partners.map((p) => ({
            id: p.id,
            company_id: p.companyId || 'company_truespace_default',
            name: p.name,
            role: p.role,
            is_active: p.isActive ?? true,
          }))
        );
      }

      // 6. Sync Transactions
      if (transactions.length > 0) {
        await client.from('transactions').upsert(
          transactions.map((t) => ({
            id: t.id,
            company_id: t.companyId || 'company_truespace_default',
            type: t.type,
            direction: t.direction,
            amount: t.amount,
            from_account_id: t.fromAccountId,
            to_account_id: t.toAccountId,
            category_id: t.categoryId,
            event_id: t.eventId,
            partner_id: t.partnerId,
            partner_name: t.partnerName,
            description: t.description || '',
            transaction_date: t.transactionDate,
            is_deleted: t.isDeleted || false,
            needs_review: t.needsReview || false,
            created_by: t.createdBy,
            updated_by: t.updatedBy,
          }))
        );
      }

      res.json({
        success: true,
        message: 'Все локальные данные успешно синхронизированы с облаком Supabase!',
        counts: {
          companies: companies.length,
          accounts: accounts.length,
          categories: categories.length,
          events: events.length,
          transactions: transactions.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Ошибка синхронизации данных: ${err.message}`,
      });
    }
  });

  // POST /api/system/supabase/pull (Download/Sync from Supabase to local app)
  router.post('/supabase/pull', async (req: Request, res: Response) => {
    try {
      const { url, key } = req.body;
      const targetUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const targetKey = key || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (!targetUrl || !targetKey) {
        return res.status(400).json({
          success: false,
          error: 'Supabase не настроен. Сначала укажите Project URL и Anon Key.',
        });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(targetUrl, targetKey, {
        auth: { persistSession: false },
      });

      // 1. Fetch all data from Supabase
      const [accRes, catRes, evRes, txRes, partRes, compRes] = await Promise.all([
        client.from('accounts').select('*').order('created_at', { ascending: true }),
        client.from('categories').select('*'),
        client.from('events').select('*').order('event_date', { ascending: true }),
        client.from('transactions').select('*').order('transaction_date', { ascending: true }),
        client.from('partners').select('*'),
        client.from('companies').select('*'),
      ]);

      if (accRes.error) throw new Error(`Счета: ${accRes.error.message}`);
      if (txRes.error) throw new Error(`Транзакции: ${txRes.error.message}`);

      // Map Supabase rows to Truespace internal types (excluding deprecated card_sbp)
      const importedAccounts = (accRes.data || [])
        .filter((a: any) => a.id !== 'card_sbp')
        .map((a: any) => ({
        id: a.id,
        companyId: a.company_id,
        name: a.name,
        type: a.type,
        description: a.description || '',
        initialBalance: Number(a.initial_balance) || 0,
        currentBalance: Number(a.current_balance) || 0,
        currency: a.currency || 'RUB',
        isActive: a.is_active ?? true,
        color: a.color,
        icon: a.icon,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      const importedCategories = (catRes.data || []).map((c: any) => ({
        id: c.id,
        companyId: c.company_id,
        name: c.name,
        type: c.type,
        direction: c.direction,
        color: c.color || '#64748b',
        icon: c.icon,
        isEventSpecific: c.is_event_specific ?? true,
        isSystem: c.is_system ?? false,
        createdAt: c.created_at,
      }));

      const importedEvents = (evRes.data || []).map((e: any) => ({
        id: e.id,
        companyId: e.company_id,
        title: e.title,
        clientName: e.client_name,
        eventDate: e.event_date,
        status: e.status,
        budget: Number(e.budget) || 0,
        contractAmount: Number(e.contract_amount) || 0,
        guestCount: Number(e.guest_count) || 0,
        location: e.location,
        notes: e.notes,
        createdBy: e.created_by,
        updatedBy: e.updated_by,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      }));

      const importedTransactions = (txRes.data || []).map((t: any) => ({
        id: t.id,
        companyId: t.company_id,
        type: t.type,
        direction: t.direction,
        amount: Number(t.amount) || 0,
        fromAccountId: t.from_account_id,
        toAccountId: t.to_account_id,
        categoryId: t.category_id,
        eventId: t.event_id,
        partnerId: t.partner_id,
        partnerName: t.partner_name,
        description: t.description || '',
        transactionDate: t.transaction_date,
        isDeleted: t.is_deleted ?? false,
        needsReview: t.needs_review ?? false,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      const importedPartners = (partRes.data || []).map((p: any) => ({
        id: p.id,
        companyId: p.company_id,
        name: p.name,
        role: p.role,
        isActive: p.is_active ?? true,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      const importedCompanies = (compRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        plan: c.plan,
        isActive: c.is_active ?? true,
        ownerId: c.owner_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      // Apply to storage
      await storage.importState({
        accounts: importedAccounts,
        categories: importedCategories.length > 0 ? importedCategories : undefined,
        events: importedEvents,
        transactions: importedTransactions,
        partners: importedPartners.length > 0 ? importedPartners : undefined,
        companies: importedCompanies.length > 0 ? importedCompanies : undefined,
      });

      res.json({
        success: true,
        message: 'Все актуальные данные успешно загружены из облака Supabase!',
        counts: {
          accounts: importedAccounts.length,
          events: importedEvents.length,
          transactions: importedTransactions.length,
          categories: importedCategories.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Не удалось загрузить данные из Supabase: ${err.message}`,
      });
    }
  });

  return router;
}

export default createSystemRouter();
