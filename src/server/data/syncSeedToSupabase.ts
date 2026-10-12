/**
 * Truespace — Барный кейтеринг и финансы
 * Initial Seed Synchronization to Supabase (`src/server/data/syncSeedToSupabase.ts`)
 *
 * Ensures that an empty or partially initialized Supabase database is safely populated
 * with initial seed data without uniqueness conflicts.
 */

import { SupabaseStore } from '../storage/SupabaseStore.js';
import { createInitialDatabaseState } from './seed.js';

export async function syncSeedToSupabaseIfEmpty(store?: SupabaseStore): Promise<{
  seeded: boolean;
  reason: string;
}> {
  try {
    const supabaseStore = store || new SupabaseStore();
    const existingAccounts = await supabaseStore.getAccounts();

    if (existingAccounts.length > 0) {
      return {
        seeded: false,
        reason: `В базе Supabase уже есть счета (${existingAccounts.length} шт.), пропуск начального сидинга.`,
      };
    }

    const seedState = createInitialDatabaseState();
    await supabaseStore.importState(seedState);

    return {
      seeded: true,
      reason: 'Начальные демо-данные успешно синхронизированы в Supabase.',
    };
  } catch (err: any) {
    return {
      seeded: false,
      reason: `Ошибка синхронизации с Supabase: ${err?.message || String(err)}`,
    };
  }
}
