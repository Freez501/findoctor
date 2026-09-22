/**
 * Truespace — Барный кейтеринг и финансы
 * Supabase Real-Time Cloud Mirror (`src/server/storage/cloudMirror.ts`)
 *
 * Silently and asynchronously mirrors transactions, balances, and entity updates to Supabase
 * whenever cloud configuration is detected. Ensures zero latency overhead and graceful offline degradation.
 */

import { Transaction, Account } from '../../shared/types.js';

export async function mirrorTransactionToCloud(tx: Transaction, updatedAccounts: Account[]): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    await client.from('transactions').upsert({
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

    for (const acc of updatedAccounts) {
      await client.from('accounts').update({
        current_balance: acc.currentBalance,
        updated_at: new Date().toISOString(),
      }).eq('id', acc.id);
    }
  } catch (err) {
    console.warn('[CloudMirror] Non-blocking error mirroring to Supabase:', err);
  }
}

export async function mirrorAccountToCloud(acc: Account): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false } });

    await client.from('accounts').upsert({
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
  } catch (err) {
    console.warn('[CloudMirror] Non-blocking error mirroring account to Supabase:', err);
  }
}
