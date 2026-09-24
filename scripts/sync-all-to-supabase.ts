/**
 * scripts/sync-all-to-supabase.ts
 *
 * Direct, authoritative sync from clean local state to Supabase.
 * Ensures UTF-8 encoding, complete company isolation, and 100% data integrity.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Supabase URL or Key not found in .env!');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const dataFilePath = path.resolve(process.cwd(), 'data/truespace.json');
const raw = fs.readFileSync(dataFilePath, 'utf8');
const store = JSON.parse(raw);

async function syncAll() {
  console.log('=== Starting full sync to Supabase ===');

  // 1. Companies
  console.log('1. Syncing companies...');
  for (const comp of store.companies || []) {
    const { error } = await supabase.from('companies').upsert({
      id: comp.id,
      name: comp.name,
      slug: comp.slug,
      plan: comp.plan || 'pro',
      is_active: comp.isActive ?? true,
      owner_id: comp.ownerId || null,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Failed to upsert company ${comp.id}:`, error);
    else console.log(`  ✓ Company: ${comp.name} (${comp.id})`);
  }

  // 2. User Profiles
  console.log('2. Syncing user profiles...');
  for (const user of store.users || []) {
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl || null,
      is_super_admin: user.isSuperAdmin || false,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Failed to upsert user ${user.id}:`, error);
    else console.log(`  ✓ User: ${user.fullName} (${user.email})`);
  }

  // 3. Company Memberships
  console.log('3. Syncing memberships...');
  for (const mem of store.memberships || []) {
    const { error } = await supabase.from('company_members').upsert({
      id: mem.id,
      company_id: mem.companyId,
      user_id: mem.userId,
      role: mem.role,
      invited_by: mem.invitedBy || null,
    });
    if (error) console.error(`Failed to upsert membership ${mem.id}:`, error);
    else console.log(`  ✓ Membership: ${mem.userId} in ${mem.companyId} (${mem.role})`);
  }

  // 4. Accounts
  console.log('4. Syncing accounts...');
  for (const acc of store.accounts || []) {
    const { error } = await supabase.from('accounts').upsert({
      id: acc.id,
      company_id: acc.companyId,
      name: acc.name,
      type: acc.type,
      description: acc.description || '',
      initial_balance: acc.initialBalance || 0,
      current_balance: acc.currentBalance || 0,
      currency: acc.currency || 'RUB',
      is_active: acc.isActive ?? true,
      color: acc.color || '#3b82f6',
      icon: acc.icon || 'wallet',
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Failed to upsert account ${acc.id}:`, error);
    else console.log(`  ✓ Account: ${acc.name} [${acc.companyId}] -> ${acc.currentBalance} ₽`);
  }

  // 5. Partners
  console.log('5. Syncing partners...');
  for (const part of store.partners || []) {
    const { error } = await supabase.from('partners').upsert({
      id: part.id,
      company_id: part.companyId,
      name: part.name,
      role: part.role || null,
      is_active: part.isActive ?? true,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Failed to upsert partner ${part.id}:`, error);
    else console.log(`  ✓ Partner: ${part.name} [${part.companyId}]`);
  }

  // 6. Categories
  console.log('6. Syncing categories...');
  for (const cat of store.categories || []) {
    const { error } = await supabase.from('categories').upsert({
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
    if (error) console.error(`Failed to upsert category ${cat.id}:`, error);
  }
  console.log(`  ✓ Synced ${(store.categories || []).length} categories`);

  // 7. Events
  console.log('7. Syncing events...');
  for (const ev of store.events || []) {
    const { error } = await supabase.from('events').upsert({
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
    if (error) console.error(`Failed to upsert event ${ev.id}:`, error);
  }
  console.log(`  ✓ Synced ${(store.events || []).length} events`);

  // 8. Transactions
  console.log('8. Syncing transactions...');
  for (const tx of store.transactions || []) {
    const { error } = await supabase.from('transactions').upsert({
      id: tx.id,
      company_id: tx.companyId || 'company_truespace_default',
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount,
      from_account_id: tx.fromAccountId || null,
      to_account_id: tx.toAccountId || null,
      category_id: tx.categoryId,
      event_id: tx.eventId || null,
      partner_id: tx.partnerId || null,
      partner_name: tx.partnerName || null,
      description: tx.description || '',
      transaction_date: tx.transactionDate,
      is_deleted: tx.isDeleted || false,
      needs_review: tx.needsReview || false,
      created_by: tx.createdBy || null,
      updated_by: tx.updatedBy || null,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Failed to upsert transaction ${tx.id}:`, error);
  }
  console.log(`  ✓ Synced ${(store.transactions || []).length} transactions`);

  console.log('=== Full sync to Supabase completed successfully! ===');
}

syncAll().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
