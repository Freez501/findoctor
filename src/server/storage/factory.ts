/**
 * Truespace — Барный кейтеринг и финансы
 * Storage Factory (`src/server/storage/factory.ts`)
 *
 * Pluggable repository instantiation based on environment configuration or programmatic overrides.
 */

import { IFinanceStore } from './interfaces.js';
import { InMemoryStore } from './InMemoryStore.js';
import { JsonFileStore } from './JsonFileStore.js';

export type StorageMode = 'memory' | 'json' | 'supabase';

export interface StorageOptions {
  mode?: StorageMode | string;
  filePath?: string;
}

let activeStoreInstance: IFinanceStore | null = null;

/**
 * Creates a new instance of IFinanceStore according to the requested mode or env configuration.
 */
export function createStorage(options?: StorageOptions): IFinanceStore {
  const mode = (options?.mode || process.env.STORAGE_MODE || 'json').toLowerCase();

  switch (mode) {
    case 'memory':
      return new InMemoryStore();

    case 'supabase':
      // Supabase adapter hook: falls back gracefully to JSON file storage if not configured
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[StorageFactory] STORAGE_MODE=supabase requested but credentials missing. Falling back to JsonFileStore.');
        return new JsonFileStore(options?.filePath);
      }
      // Reserved for SupabaseStore in future cloud integration
      return new JsonFileStore(options?.filePath);

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
