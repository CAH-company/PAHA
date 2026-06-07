import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// GET /api/settings?keys=anthropic_api_key,anthropic_model
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Sprawdź rolę — sekrety dostępne tylko dla admin/partner
  const { data: emp } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const isPrivileged = emp && ['admin', 'partner'].includes(emp.role);

  const keys = req.nextUrl.searchParams.get('keys')?.split(',') ?? [];
  if (keys.length === 0) return NextResponse.json({});

  const admin = createAdminClient();
  const { data } = await admin
    .from('app_settings')
    .select('key, value, is_secret')
    .in('key', keys);

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    // Sekrety (klucze API, tokeny) — tylko dla admin/partner
    if (row.is_secret && !isPrivileged) {
      result[row.key] = '';
    } else {
      result[row.key] = row.value ?? '';
    }
  }

  return NextResponse.json(result);
}

// POST /api/settings  body: { key: string, value: string, is_secret?: boolean }[]
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: emp } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!emp || !['admin', 'partner'].includes(emp.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const body = await req.json();
  if (!Array.isArray(body)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert(body, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
