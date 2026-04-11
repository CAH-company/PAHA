import { createClient } from '@supabase/supabase-js';

// Admin client z service role key — tylko na serwerze, nigdy w przeglądarce
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
