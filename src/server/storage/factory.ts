/**
 * Truespace — Барный кейтеринг и финансы
 * Storage Factory (`src/server/storage/factory.ts`)
 *
 * Pluggable repository instantiation based on environment configuration or programmatic overrides.
 */

import dotenv from 'dotenv';
import { IFinanceStore } from './interfaces.js';
import { InMemoryStore } from './InMemoryStore.js';
import { JsonFileStore } from './JsonFileStore.js';
import { SupabaseStore } from './SupabaseStore.js';
import { MySqlStore } from './MySqlStore.js';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

export type StorageMode = 'memory' | 'json' | 'supabase' | 'mysql';

export interface StorageOptions {
  mode?: StorageMode | string;
  filePath?: string;
}

let activeStoreInstance: IFinanceStore | null = null;

/**
 * Creates a new instance of IFinanceStore according to the requested mode or env configuration.
 */
export function createStorage(options?: StorageOptions): IFinanceStore {
  const defaultMode =
    process.env.NODE_ENV === 'test'
      ? options?.filePath
        ? 'json'
        : 'memory'
      : process.env.STORAGE_MODE || (process.env.DB_NAME ? 'mysql' : 'json');
  const mode = (options?.mode || defaultMode).toLowerCase();

  switch (mode) {
    case 'memory':
      return new InMemoryStore();

    case 'mysql':
      return new MySqlStore();

    case 'supabase': {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        console.warn('[StorageFactory] STORAGE_MODE=supabase requested but credentials missing. Falling back to JsonFileStore.');
        return new JsonFileStore(options?.filePath);
      }
      return new SupabaseStore(url, key);
    }

    case 'json':
    default:
      return new JsonFileStore(options?.filePath);
  }
}

/**
 * Returns the singleton store instance, creating it if not already initialized.
 */
export function getStorageInstance(options?: StorageOptions): IFinanceStore {
  if (!activeStoreInstance) {
    activeStoreInstance = createStorage(options);
  }
  return activeStoreInstance;
}

/**
 * Overrides the active singleton store (primarily for unit and integration testing).
 */
export function setStorageInstance(store: IFinanceStore | null): void {
  activeStoreInstance = store;
}
