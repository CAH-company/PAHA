import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await admin
    .from('email_campaigns')
    .select('status, created_by')
    .eq('id', params.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
  if (campaign.created_by !== emp.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const newStatus = campaign.status === 'paused' ? 'active' : 'paused';
  await admin.from('email_campaigns')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ ok: true, status: newStatus });
}
