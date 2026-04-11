import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Użyj w API routes, żeby wymagać zalogowanego użytkownika.
 *
 * Przykład:
 *   const { user, error } = await requireAuth();
 *   if (error) return error;
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, supabase, error: null };
}
