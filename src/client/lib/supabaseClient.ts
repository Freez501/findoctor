/**
 * Truespace — Барный кейтеринг и финансы
 * Supabase Client Initialization (`src/client/lib/supabaseClient.ts`)
 *
 * Configures the official Supabase JS client when environment variables are supplied.
 * Falls back gracefully to local REST API mode when running without Supabase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const supabaseAnonKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
