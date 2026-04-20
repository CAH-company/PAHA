import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Tylko admin/partner może usuwać
  const { data: caller } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!caller || !['admin', 'partner'].includes(caller.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Pobierz user_id usuwanego pracownika
  const { data: emp } = await admin
    .from('employees')
    .select('id, user_id')
    .eq('id', params.id)
    .single();

  if (!emp) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Nie możesz usunąć siebie
  if (emp.user_id === user.id) {
    return NextResponse.json({ error: 'Nie możesz usunąć własnego konta' }, { status: 400 });
  }

  // Usuń rekord pracownika (kaskadowo usuwa task_assignees, etc.)
  const { error: empError } = await admin
    .from('employees')
    .delete()
    .eq('id', params.id);

  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });

  // Usuń konto w Supabase Auth (jeśli było połączone)
  if (emp.user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(emp.user_id);
    if (authError) {
      // Nie przerywamy — rekord pracownika już usunięty, auth user może już nie istnieć
      console.warn('[employees/delete] auth delete failed:', authError.message);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!caller || !['admin', 'partner'].includes(caller.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const body = await req.json();
  const { error } = await supabase
    .from('employees')
    .update(body)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
