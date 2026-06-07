import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function resolveEmpId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from('employees').select('id').eq('user_id', userId).single();
  return data?.id ?? null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const empId = await resolveEmpId(admin, user.id);
  if (!empId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await admin
    .from('email_campaigns')
    .select(`
      *,
      steps:email_campaign_steps(*),
      recipients:email_campaign_recipients(*, lead:leads(id, name, email, company))
    `)
    .eq('id', params.id)
    .eq('created_by', empId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const empId = await resolveEmpId(admin, user.id);
  if (!empId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership before delete
  const { data: campaign } = await admin
    .from('email_campaigns')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!campaign || campaign.created_by !== empId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin.from('email_campaigns').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
