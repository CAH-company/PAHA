import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();

  const { data, error } = await admin
    .from('email_campaigns')
    .select('*, steps:email_campaign_steps(*)')
    .eq('created_by', emp?.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();

  const body = await req.json();
  const { name, from_name, from_email, recipient_filter, steps } = body;

  if (!name || !from_email || !steps?.length) {
    return NextResponse.json({ error: 'Brakuje wymaganych pól' }, { status: 400 });
  }

  const {
    stop_on_open = false,
    stop_on_reply = false,
    send_window = null,
    signature_html = null,
  } = body;

  const { data: campaign, error: campErr } = await admin
    .from('email_campaigns')
    .insert({ name, from_name, from_email, signature_html, recipient_filter: recipient_filter ?? { type: 'all' }, stop_on_open, stop_on_reply, send_window, created_by: emp?.id })
    .select()
    .single();

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });

  const stepRows = steps.map((s: any, i: number) => ({
    campaign_id: campaign.id,
    step_order: i + 1,
    subject: s.subject,
    body_html: s.body_html,
    delay_days: i === 0 ? 0 : (s.delay_days ?? 3),
  }));

  const { error: stepsErr } = await admin.from('email_campaign_steps').insert(stepRows);
  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: campaign.id });
}
