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
    .select('created_by, status')
    .eq('id', params.id)
    .single();

  if (!campaign || campaign.created_by !== emp.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date().toISOString();

  // Reset wszystkich odbiorców do kroku 0 — zostaną ponownie przetworzone przez cron
  const { error } = await admin
    .from('email_campaign_recipients')
    .update({
      current_step: 0,
      status: 'active',
      next_send_at: now,
      last_sent_at: null,
    })
    .eq('campaign_id', params.id)
    .in('status', ['active', 'pending', 'completed']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Upewnij się że kampania jest aktywna
  await admin
    .from('email_campaigns')
    .update({ status: 'active', sent_count: 0, updated_at: now })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
}
