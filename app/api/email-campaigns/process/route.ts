import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { applyVars, buildHtml, isInWindow } from '@/lib/email-campaign-utils';
import { getResendKey } from '@/lib/get-resend-key';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();

  const { data: dueRecipients } = await admin
    .from('email_campaign_recipients')
    .select(`
      id, campaign_id, lead_id, current_step, status,
      campaign:email_campaigns!campaign_id(id, name, from_name, from_email, status, created_by, stop_on_open, stop_on_reply, send_window, sent_count, steps:email_campaign_steps(*)),
      lead:leads!lead_id(id, name, email, company)
    `)
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString());

  const ownedDue = (dueRecipients ?? []).filter(
    (r: any) => r.campaign?.created_by === emp.id && r.campaign?.status === 'active'
  );

  if (!ownedDue.length) return NextResponse.json({ ok: true, processed: 0, skipped: 0 });

  const resendKey = await getResendKey(admin);
  let processed = 0;
  let skipped = 0;
  const sentCountDelta: Record<string, number> = {};

  for (const rec of ownedDue) {
    const campaign = rec.campaign as any;

    // Respect send window — skip if outside, recipient stays due for next run
    if (!isInWindow(campaign.send_window ?? null, now)) {
      skipped++;
      continue;
    }

    const steps = (campaign.steps ?? []).sort((a: any, b: any) => a.step_order - b.step_order);
    const nextStepIndex = rec.current_step;
    const step = steps[nextStepIndex];

    if (!step) {
      await admin.from('email_campaign_recipients').update({ status: 'completed' }).eq('id', rec.id);
      continue;
    }

    const lead = rec.lead as any;
    if (!lead?.email) continue;

    const subject  = applyVars(step.subject, lead);
    const bodyText = applyVars(step.body_html, lead);
    const html     = buildHtml(bodyText, rec.id, appUrl, campaign.signature_html);

    let resendId: string | null = null;
    let sendStatus = 'sent';

    if (resendKey) {
      const resend = new Resend(resendKey);
      try {
        const { data: r } = await resend.emails.send({
          from: `${campaign.from_name} <${campaign.from_email}>`,
          to: lead.email,
          subject,
          html,
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

    sentCountDelta[rec.campaign_id] = (sentCountDelta[rec.campaign_id] ?? 0) + 1;
    processed++;
  }

  // Update sent_count once per campaign with accurate delta (avoids stale-read race)
  for (const [cid, delta] of Object.entries(sentCountDelta)) {
    const { data: camp } = await admin.from('email_campaigns').select('sent_count').eq('id', cid).single();
    await admin.from('email_campaigns')
      .update({ sent_count: (camp?.sent_count ?? 0) + delta })
      .eq('id', cid);
  }

  return NextResponse.json({ ok: true, processed, skipped });
}
