import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('meeting_transcripts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Transkrypcje spotkań nie mają pola created_by — usuwać może tylko admin/partner
  const { data: emp } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!emp || !['admin', 'partner'].includes(emp.role)) {
    return NextResponse.json({ error: 'Brak uprawnień — tylko admin może usuwać transkrypcje' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('meeting_transcripts')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
