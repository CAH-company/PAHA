import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { applyVars, buildHtml, isInWindow } from '@/lib/email-campaign-utils';
import { getResendKey } from '@/lib/get-resend-key';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured on server' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const now = new Date();

  const resendKey = await getResendKey(admin);
  if (!resendKey) {
    return NextResponse.json({ error: 'Brak RESEND_API_KEY' }, { status: 422 });
  }

  // Global limit per run from app_settings (default 50)
  const { data: limitRow } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'campaign_max_per_run')
    .single();
  const globalLimit = Math.max(1, parseInt(limitRow?.value ?? '50', 10));

  const { data: dueRecipients } = await admin
    .from('email_campaign_recipients')
    .select(`
      id, campaign_id, lead_id, current_step,
      campaign:email_campaigns!campaign_id(
        id, name, from_name, from_email, signature_html,
        status, stop_on_open, stop_on_reply, send_window,
        sent_count, daily_limit,
        steps:email_campaign_steps(*)
      ),
      lead:leads!lead_id(id, name, email, company)
    `)
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString());

  const activeDue = (dueRecipients ?? []).filter(
    (r: any) => r.campaign?.status === 'active'
  );

  if (!activeDue.length) return NextResponse.json({ ok: true, processed: 0, skipped: 0 });

  // Cache today's send count per campaign
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sentTodayCache: Record<string, number> = {};

  async function getSentToday(campaignId: string): Promise<number> {
    if (sentTodayCache[campaignId] !== undefined) return sentTodayCache[campaignId];
    const { count } = await admin
      .from('email_campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .gte('sent_at', todayStart.toISOString())
      .in('status', ['sent', 'delivered', 'opened', 'clicked', 'replied']);
    sentTodayCache[campaignId] = count ?? 0;
    return sentTodayCache[campaignId];
  }

  const resend = new Resend(resendKey);
  let processed = 0;
  let skipped = 0;
  let globalSent = 0;
  const sentCountDelta: Record<string, number> = {};

  for (const rec of activeDue) {
    if (globalSent >= globalLimit) break;

    const campaign = rec.campaign as any;

    if (!isInWindow(campaign.send_window ?? null, now)) {
      skipped++;
      continue;
    }

    const dailyLimit = campaign.daily_limit ?? 50;
    const sentToday = await getSentToday(rec.campaign_id);
    if (sentToday >= dailyLimit) {
      skipped++;
      continue;
    }

    const steps = (campaign.steps ?? []).sort((a: any, b: any) => a.step_order - b.step_order);
    const step = steps[rec.current_step];

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

    const nextStep = steps[rec.current_step + 1];
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

    if (sendStatus === 'sent') {
      sentTodayCache[rec.campaign_id] = (sentTodayCache[rec.campaign_id] ?? 0) + 1;
      sentCountDelta[rec.campaign_id] = (sentCountDelta[rec.campaign_id] ?? 0) + 1;
      globalSent++;
    }
    processed++;
  }

  // Update sent_count once per campaign with accurate delta (avoids stale-read race)
  for (const [cid, delta] of Object.entries(sentCountDelta)) {
    const { data: camp } = await admin.from('email_campaigns').select('sent_count').eq('id', cid).single();
    await admin.from('email_campaigns')
      .update({ sent_count: (camp?.sent_count ?? 0) + delta })
      .eq('id', cid);
  }

  return NextResponse.json({ ok: true, processed, skipped, globalSent });
}
