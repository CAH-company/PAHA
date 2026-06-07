import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function applyVars(template: string, lead: { name?: string; company?: string; email?: string }) {
  const firstName = (lead.name ?? '').split(' ')[0];
  return template
    .replace(/\{\{name\}\}/g, lead.name ?? '')
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{company\}\}/g, lead.company ?? '')
    .replace(/\{\{email\}\}/g, lead.email ?? '');
}

// Process due follow-up steps — only for the caller's own campaigns
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();

  // Only process recipients belonging to campaigns owned by this employee
  const { data: dueRecipients } = await admin
    .from('email_campaign_recipients')
    .select(`
      id, campaign_id, lead_id, current_step, status,
      campaign:email_campaigns!campaign_id(id, name, from_name, from_email, status, created_by, steps:email_campaign_steps(*)),
      lead:leads!lead_id(id, name, email, company)
    `)
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString());

  // Filter to only this employee's campaigns
  const ownedDue = (dueRecipients ?? []).filter(
    (r: any) => r.campaign?.created_by === emp.id && r.campaign?.status === 'active'
  );

  if (!ownedDue.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;

  for (const rec of ownedDue) {
    const campaign = rec.campaign as any;
    const steps = (campaign.steps ?? []).sort((a: any, b: any) => a.step_order - b.step_order);
    const nextStepIndex = rec.current_step;
    const step = steps[nextStepIndex];

    if (!step) {
      await admin.from('email_campaign_recipients').update({ status: 'completed' }).eq('id', rec.id);
      continue;
    }

    const lead = rec.lead as any;
    if (!lead?.email) continue;

    const subject = applyVars(step.subject, lead);
    const body = applyVars(step.body_html, lead);

    let resendId: string | null = null;
    let sendStatus = 'sent';

    if (process.env.RESEND_API_KEY) {
      try {
        const { data: r } = await resend.emails.send({
          from: `${campaign.from_name} <${campaign.from_email}>`,
          to: lead.email,
          subject,
          html: body.replace(/\n/g, '<br>'),
        });
        resendId = r?.id ?? null;
      } catch {
        sendStatus = 'failed';
      }
    }

    const nextStep = steps[nextStepIndex + 1];
    const nextSendAt = nextStep
      ? new Date(now.getTime() + nextStep.delay_days * 86400000).toISOString()
      : null;

    await admin.from('email_campaign_recipients').update({
      current_step: rec.current_step + 1,
      last_sent_at: now.toISOString(),
      next_send_at: nextSendAt,
      status: nextSendAt ? 'active' : 'completed',
    }).eq('id', rec.id);

    await admin.from('email_campaign_sends').insert({
      campaign_id: rec.campaign_id,
      recipient_id: rec.id,
      step_id: step.id,
      step_order: step.step_order,
      lead_id: lead.id,
      status: sendStatus,
      resend_id: resendId,
    });

    // Increment campaign sent_count
    await admin
      .from('email_campaigns')
      .update({ sent_count: campaign.sent_count + 1 })
      .eq('id', rec.campaign_id);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
