import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.SUPABASE_URL ?? 'https://example.supabase.co';

export function getActiveSupabaseKey(): string {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (serviceKey && !serviceKey.includes('placeholder') && !serviceKey.includes('your-')) {
    return serviceKey;
  }
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (anonKey && !anonKey.includes('placeholder') && !anonKey.includes('your-')) {
    return anonKey;
  }
  return serviceKey || 'service_role_placeholder';
}

export const activeSupabaseKey = getActiveSupabaseKey();

export const supabase = createClient(supabaseUrl, activeSupabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

