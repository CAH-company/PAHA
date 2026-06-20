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

  const { data: campaign, error: campErr } = await admin
    .from('email_campaigns')
    .select('*, steps:email_campaign_steps(*)')
    .eq('id', params.id)
    .single();

  if (campErr || !campaign) return NextResponse.json({ error: 'Nie znaleziono kampanii' }, { status: 404 });
  if (campaign.created_by !== emp.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (campaign.status === 'active') return NextResponse.json({ error: 'Kampania już aktywna' }, { status: 400 });

  const steps = (campaign.steps ?? []).sort((a: any, b: any) => a.step_order - b.step_order);
  if (!steps.length) return NextResponse.json({ error: 'Brak kroków w sekwencji' }, { status: 400 });

  const filter = campaign.recipient_filter ?? { type: 'all' };
  let leadsQuery = admin.from('leads').select('id, name, email, company').eq('is_archived', false).not('email', 'is', null);
  if (filter.type === 'status' && filter.value) leadsQuery = leadsQuery.eq('status', filter.value);
  if (filter.type === 'source' && filter.value) leadsQuery = leadsQuery.eq('source', filter.value);
  const { data: leads } = await leadsQuery;
  const validLeads = (leads ?? []).filter((l: any) => l.email?.includes('@'));

  if (!validLeads.length) return NextResponse.json({ error: 'Brak leadów z emailami pasujących do filtra' }, { status: 400 });

  // Interval between sends per recipient (default 5 min)
  const intervalMs = Math.max(1, campaign.send_interval_minutes ?? 5) * 60 * 1000;
  const now = new Date();

  // Stagger next_send_at: lead 0 → now, lead 1 → now+interval, lead 2 → now+2*interval, ...
  const recipientRows = validLeads.map((l: any, index: number) => ({
    campaign_id: campaign.id,
    lead_id: l.id,
    status: 'active',
    current_step: 0,
    next_send_at: new Date(now.getTime() + index * intervalMs).toISOString(),
  }));

  await admin.from('email_campaign_recipients').upsert(recipientRows, { onConflict: 'campaign_id,lead_id' });

  await admin.from('email_campaigns').update({
    status: 'active',
    total_recipients: validLeads.length,
    sent_count: 0,
    updated_at: now.toISOString(),
  }).eq('id', campaign.id);

  await admin.from('leads').update({ contact_status: 'in_sequence' }).in('id', validLeads.map((l: any) => l.id));

  const lastSendAt = new Date(now.getTime() + (validLeads.length - 1) * intervalMs);

  return NextResponse.json({
    ok: true,
    total: validLeads.length,
    interval_minutes: campaign.send_interval_minutes ?? 5,
    first_send: now.toISOString(),
    last_send_estimated: lastSendAt.toISOString(),
  });
}
