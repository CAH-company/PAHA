import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { applyVars, buildHtml, isInWindow } from '@/lib/email-campaign-utils';
import { getResendKey } from '@/lib/get-resend-key';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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

  const recipientRows = validLeads.map((l: any) => ({
    campaign_id: campaign.id,
    lead_id: l.id,
    status: 'pending',
    current_step: 0,
  }));
  await admin.from('email_campaign_recipients').upsert(recipientRows, { onConflict: 'campaign_id,lead_id' });

  const { data: recipients } = await admin
    .from('email_campaign_recipients')
    .select('id, lead_id, status')
    .eq('campaign_id', campaign.id)
    .in('status', ['pending', 'active']);

  const step1 = steps[0];
  const now = new Date();
  const inWindow = isInWindow(campaign.send_window ?? null, now);
  const resendKey = await getResendKey(admin);
  const dailyLimit = campaign.daily_limit ?? 50;
  let sentCount = 0;

  const allRecipients = recipients ?? [];

  if (!inWindow) {
    // Outside window — queue everyone; cron will pick up when in window
    const ids = allRecipients.map((r: any) => r.id);
    if (ids.length) {
      await admin.from('email_campaign_recipients')
        .update({ status: 'active', current_step: 0, next_send_at: now.toISOString() })
        .in('id', ids);
    }
  } else {
    // Queue recipients beyond daily_limit immediately; cron picks them up next run
    const overflow = allRecipients.slice(dailyLimit);
    if (overflow.length) {
      await admin.from('email_campaign_recipients')
        .update({ status: 'active', current_step: 0, next_send_at: now.toISOString() })
        .in('id', overflow.map((r: any) => r.id));
    }
  }

  const toSendNow = inWindow ? allRecipients.slice(0, dailyLimit) : [];

  for (const rec of toSendNow) {
    const lead = validLeads.find((l: any) => l.id === rec.lead_id);
    if (!lead?.email) continue;

    const nextStep = steps[1];
    const nextSendAt = nextStep
      ? new Date(now.getTime() + nextStep.delay_days * 86400000).toISOString()
      : null;

    const subject  = applyVars(step1.subject, lead);
    const bodyText = applyVars(step1.body_html, lead);
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

    await admin.from('email_campaign_sends').insert({
      campaign_id: campaign.id,
      recipient_id: rec.id,
      step_id: step1.id,
      step_order: 1,
      lead_id: lead.id,
      status: sendStatus,
      resend_id: resendId,
    });

    if (sendStatus === 'failed') {
      // Nieudana wysyłka — zostaw na kroku 0, cron ponowi przy następnym uruchomieniu
      await admin.from('email_campaign_recipients').update({
        status: 'active',
        current_step: 0,
        next_send_at: now.toISOString(),
      }).eq('id', rec.id);
      continue;
    }

    await admin.from('email_campaign_recipients').update({
      status: nextSendAt ? 'active' : 'completed',
      current_step: 1,
      last_sent_at: now.toISOString(),
      next_send_at: nextSendAt,
    }).eq('id', rec.id);

    sentCount++;
  }

  await admin.from('email_campaigns').update({
    status: 'active',
    total_recipients: validLeads.length,
    sent_count: sentCount,
    updated_at: now.toISOString(),
  }).eq('id', campaign.id);

  const leadIds = (recipients ?? []).map((r: any) => r.lead_id);
  if (leadIds.length) {
    await admin.from('leads').update({ contact_status: 'in_sequence' }).in('id', leadIds);
  }

  const outsideWindow = !inWindow;
  return NextResponse.json({
    ok: true,
    sent: sentCount,
    total: validLeads.length,
    ...(outsideWindow && { warning: 'Poza oknem wysyłki — emaile zostaną wysłane przy najbliższym uruchomieniu procesu w dozwolonych godzinach.' }),
  });
}
