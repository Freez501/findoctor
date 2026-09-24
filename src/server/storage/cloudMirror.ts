/**
 * Truespace — Барный кейтеринг и финансы
 * Supabase Real-Time Cloud Mirror (`src/server/storage/cloudMirror.ts`)
 *
 * Silently and asynchronously mirrors transactions, balances, and entity updates to Supabase
 * whenever cloud configuration is detected. Ensures zero latency overhead and graceful offline degradation.
 */

import fs from 'fs';
import path from 'path';
import { Transaction, Account, UserProfile, Company, CompanyMembership, Partner } from '../../shared/types.js';

export interface RetryTask {
  id: string;
  type: 'transaction' | 'account' | 'user' | 'company' | 'membership' | 'partner' | 'category' | 'event' | 'deleteCompany';
  payload: any;
  extra?: any;
  retries: number;
  lastAttempt: number;
  error?: string;
}

const QUEUE_FILE = path.resolve(process.cwd(), 'data', 'cloud_mirror_retry_queue.json');
let memoryQueue: RetryTask[] = [];

export function loadQueue(): RetryTask[] {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return memoryQueue;
}

export function saveQueue(q: RetryTask[]): void {
  memoryQueue = q;
  try {
    const dir = path.dirname(QUEUE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2), 'utf-8');
  } catch {
    // fallback
  }
}

export function enqueueRetry(type: RetryTask['type'], payload: any, extra?: any, errorMsg?: string): void {
  const q = loadQueue();
  const entityId = payload?.id || payload?.companyId || String(payload);
  const existingIndex = q.findIndex((item) => item.type === type && (item.payload?.id === entityId || item.id === entityId));
  if (existingIndex >= 0) {
    q[existingIndex].retries += 1;
    q[existingIndex].lastAttempt = Date.now();
    q[existingIndex].payload = payload;
    q[existingIndex].extra = extra;
    if (errorMsg) q[existingIndex].error = errorMsg;
  } else {
    q.push({
      id: `${type}_${entityId}_${Date.now()}`,
      type,
      payload,
      extra,
      retries: 0,
      lastAttempt: Date.now(),
      error: errorMsg,
    });
  }
  saveQueue(q);
}

export function getRetryQueue(): RetryTask[] {
  return loadQueue();
}

export function clearRetryQueue(): void {
  saveQueue([]);
}

export async function flushRetryQueue(): Promise<{ processed: number; remaining: number }> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { processed: 0, remaining: loadQueue().length };

  const q = loadQueue();
  if (q.length === 0) return { processed: 0, remaining: 0 };

  const remaining: RetryTask[] = [];
  let processed = 0;

  for (const item of q) {
    if (item.retries >= 5) {
      console.warn(`[CloudMirror] Dropping task ${item.id} after 5 failed retries.`);
      continue;
    }
    try {
      if (item.type === 'transaction') {
        await mirrorTransactionToCloud(item.payload, item.extra || []);
      } else if (item.type === 'account') {
        await mirrorAccountToCloud(item.payload);
      } else if (item.type === 'company') {
        await mirrorCompanyToCloud(item.payload);
      } else if (item.type === 'event') {
        await mirrorEventToCloud(item.payload);
      } else if (item.type === 'category') {
        await mirrorCategoryToCloud(item.payload);
      } else if (item.type === 'partner') {
        await mirrorPartnerToCloud(item.payload);
      } else if (item.type === 'user') {
        await mirrorUserProfileToCloud(item.payload);
      } else if (item.type === 'membership') {
        await mirrorMembershipToCloud(item.payload);
      } else if (item.type === 'deleteCompany') {
        await deleteCompanyFromCloud(item.payload);
      }
      processed++;
    } catch {
      item.retries += 1;
      item.lastAttempt = Date.now();
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { processed, remaining: remaining.length };
}

export async function mirrorTransactionToCloud(tx: Transaction, updatedAccounts: Account[]): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error: txErr } = await client.from('transactions').upsert({
      id: tx.id,
      company_id: tx.companyId || 'company_truespace_default',
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount,
      from_account_id: tx.fromAccountId,
      to_account_id: tx.toAccountId,
      category_id: tx.categoryId,
      event_id: tx.eventId,
      partner_id: tx.partnerId,
      partner_name: tx.partnerName,
      description: tx.description || '',
      transaction_date: tx.transactionDate,
      is_deleted: tx.isDeleted || false,
      needs_review: tx.needsReview || false,
      created_by: tx.createdBy,
      updated_by: tx.updatedBy,
    });
    if (txErr) {
      console.error('[CloudMirror] Error mirroring transaction:', txErr);
      enqueueRetry('transaction', tx, updatedAccounts, txErr.message);
    }

    for (const acc of updatedAccounts) {
      const { error: accErr } = await client.from('accounts').update({
        current_balance: acc.currentBalance,
        updated_at: new Date().toISOString(),
      }).eq('id', acc.id);
      if (accErr) {
        console.error('[CloudMirror] Error updating account balance:', accErr);
        enqueueRetry('account', acc, undefined, accErr.message);
      }
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring transaction to Supabase:', err);
    enqueueRetry('transaction', tx, updatedAccounts, err?.message);
  }
}

export async function mirrorAccountToCloud(acc: Account): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('accounts').upsert({
      id: acc.id,
      company_id: acc.companyId || 'company_truespace_default',
      name: acc.name,
      type: acc.type,
      description: acc.description || '',
      initial_balance: acc.initialBalance,
      current_balance: acc.currentBalance,
      currency: acc.currency || 'RUB',
      is_active: acc.isActive ?? true,
      color: acc.color,
      icon: acc.icon,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring account:', error);
      enqueueRetry('account', acc, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring account to Supabase:', err);
    enqueueRetry('account', acc, undefined, err?.message);
  }
}

export async function mirrorUserProfileToCloud(user: UserProfile): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.fullName || null,
      avatar_url: user.avatarUrl || null,
      is_super_admin: user.isSuperAdmin || false,
      is_email_verified: user.isEmailVerified || false,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring user profile:', error);
      enqueueRetry('user', user, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring user to Supabase:', err);
    enqueueRetry('user', user, undefined, err?.message);
  }
}

export async function mirrorCompanyToCloud(company: Company): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const payload: any = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      is_active: company.isActive ?? true,
      owner_id: company.ownerId,
      updated_at: new Date().toISOString(),
    };
    if (company.trialEndsAt !== undefined) payload.trial_ends_at = company.trialEndsAt;
    if (company.paidUntil !== undefined) payload.paid_until = company.paidUntil;

    const { error } = await client.from('companies').upsert(payload);
    if (error) {
      console.error('[CloudMirror] Error mirroring company:', error);
      enqueueRetry('company', company, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring company to Supabase:', err);
    enqueueRetry('company', company, undefined, err?.message);
  }
}

export async function mirrorMembershipToCloud(membership: CompanyMembership): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('company_members').upsert({
      id: membership.id,
      company_id: membership.companyId,
      user_id: membership.userId,
      role: membership.role,
      invited_by: membership.invitedBy || null,
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring membership:', error);
      enqueueRetry('membership', membership, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring membership to Supabase:', err);
    enqueueRetry('membership', membership, undefined, err?.message);
  }
}

export async function mirrorPartnerToCloud(partner: Partner): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('partners').upsert({
      id: partner.id,
      company_id: partner.companyId || 'company_truespace_default',
      name: partner.name,
      role: partner.role || null,
      is_active: partner.isActive ?? true,
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring partner:', error);
      enqueueRetry('partner', partner, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring partner to Supabase:', err);
    enqueueRetry('partner', partner, undefined, err?.message);
  }
}

export async function mirrorCategoryToCloud(cat: any): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('categories').upsert({
      id: cat.id,
      company_id: cat.companyId || 'company_truespace_default',
      name: cat.name,
      type: cat.type,
      direction: cat.direction || cat.type,
      color: cat.color || '#64748b',
      icon: cat.icon || null,
      is_event_specific: cat.isEventSpecific ?? true,
      is_system: cat.isSystem ?? false,
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring category:', error);
      enqueueRetry('category', cat, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring category to Supabase:', err);
    enqueueRetry('category', cat, undefined, err?.message);
  }
}

export async function mirrorEventToCloud(ev: any): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('events').upsert({
      id: ev.id,
      company_id: ev.companyId || 'company_truespace_default',
      title: ev.title,
      client_name: ev.clientName || null,
      event_date: ev.eventDate,
      status: ev.status || 'planned',
      budget: ev.budget || 0,
      contract_amount: ev.contractAmount || 0,
      guest_count: ev.guestCount || 0,
      location: ev.location || null,
      notes: ev.notes || null,
      created_by: ev.createdBy || null,
      updated_by: ev.updatedBy || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[CloudMirror] Error mirroring event:', error);
      enqueueRetry('event', ev, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error mirroring event to Supabase:', err);
    enqueueRetry('event', ev, undefined, err?.message);
  }
}

export async function deleteCompanyFromCloud(companyId: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await client.from('companies').delete().eq('id', companyId);
    if (error) {
      console.error('[CloudMirror] Error deleting company from Supabase:', error);
      enqueueRetry('deleteCompany', companyId, undefined, error.message);
    }
  } catch (err: any) {
    console.error('[CloudMirror] Unexpected error deleting company from Supabase:', err);
    enqueueRetry('deleteCompany', companyId, undefined, err?.message);
  }
}
