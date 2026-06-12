import { SupabaseClient } from '@supabase/supabase-js';

export async function getResendKey(admin: SupabaseClient): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  const { data } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'resend_api_key')
    .single();
  return data?.value || null;
}
