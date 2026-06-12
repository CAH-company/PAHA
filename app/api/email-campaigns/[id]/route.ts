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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const empId = await resolveEmpId(admin, user.id);
  if (!empId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await admin
    .from('email_campaigns')
    .select('status, created_by')
    .eq('id', params.id)
    .single();

  if (!existing || existing.created_by !== empId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const {
    name, from_name, from_email, signature_html,
    stop_on_open, stop_on_reply, send_window,
    recipient_filter, steps, daily_limit,
  } = body;

  const { error: updErr } = await admin
    .from('email_campaigns')
    .update({
      name, from_name, from_email,
      signature_html: signature_html ?? null,
      stop_on_open: stop_on_open ?? false,
      stop_on_reply: stop_on_reply ?? false,
      send_window: send_window ?? null,
      recipient_filter: recipient_filter ?? { type: 'all' },
      daily_limit: daily_limit ?? 50,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (steps?.length) {
    await admin.from('email_campaign_steps').delete().eq('campaign_id', params.id);
    const stepRows = steps.map((s: any, i: number) => ({
      campaign_id: params.id,
      step_order: i + 1,
      subject: s.subject,
      body_html: s.body_html,
      delay_days: i === 0 ? 0 : (s.delay_days ?? 3),
    }));
    const { error: stepsErr } = await admin.from('email_campaign_steps').insert(stepRows);
    if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
