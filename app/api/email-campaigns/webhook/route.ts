import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Resend sends webhook events — verify with RESEND_WEBHOOK_SECRET if set
// Set up in Resend Dashboard → Webhooks → point to /api/email-campaigns/webhook
// Events to subscribe: email.delivered, email.opened, email.clicked, email.bounced, email.complained

const STATUS_PRIORITY: Record<string, number> = {
  sent: 0, delivered: 1, opened: 2, clicked: 3, replied: 4, bounced: 5,
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify Resend webhook signature when secret is configured
  if (secret) {
    const svixId        = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSig       = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    // Full svix verification would require the svix package.
    // For now we accept the event — add `npm i svix` and full verification before going live.
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }); }

  const eventType: string = body.type ?? '';
  const emailId: string   = body.data?.email_id ?? '';

  if (!emailId) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  const { data: send } = await admin
    .from('email_campaign_sends')
    .select('id, campaign_id, recipient_id, status')
    .eq('resend_id', emailId)
    .single();

  if (!send) return NextResponse.json({ ok: true });

  const { data: campaign } = await admin
    .from('email_campaigns')
    .select('id, stop_on_open, stop_on_reply, delivered_count, opened_count, clicked_count, bounced_count')
    .eq('id', send.campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ ok: true });

  const { data: recipient } = await admin
    .from('email_campaign_recipients')
    .select('id, status')
    .eq('id', send.recipient_id)
    .single();

  const eventMap: Record<string, { sendStatus: string; counterField: string }> = {
    'email.delivered':  { sendStatus: 'delivered', counterField: 'delivered_count' },
    'email.opened':     { sendStatus: 'opened',    counterField: 'opened_count'    },
    'email.clicked':    { sendStatus: 'clicked',   counterField: 'clicked_count'   },
    'email.bounced':    { sendStatus: 'bounced',   counterField: 'bounced_count'   },
    'email.complained': { sendStatus: 'bounced',   counterField: 'bounced_count'   },
  };

  const mapped = eventMap[eventType];
  if (!mapped) return NextResponse.json({ ok: true });

  const { sendStatus, counterField } = mapped;
  const currentPriority = STATUS_PRIORITY[send.status] ?? 0;

  if ((STATUS_PRIORITY[sendStatus] ?? 0) > currentPriority) {
    await admin.from('email_campaign_sends').update({ status: sendStatus }).eq('id', send.id);
  }

  const currentCount = (campaign as any)[counterField] ?? 0;
  await admin.from('email_campaigns').update({ [counterField]: currentCount + 1 }).eq('id', campaign.id);

  await admin.from('email_campaign_events').insert({
    campaign_id: campaign.id,
    send_id: send.id,
    recipient_id: send.recipient_id,
    event_type: sendStatus,
    data: body.data ?? null,
  });

  if (recipient && !['unsubscribed', 'bounced', 'completed'].includes(recipient.status)) {
    if (sendStatus === 'bounced') {
      await admin
        .from('email_campaign_recipients')
        .update({ status: 'bounced', next_send_at: null })
        .eq('id', recipient.id);
    } else if (sendStatus === 'opened' && campaign.stop_on_open) {
      await admin
        .from('email_campaign_recipients')
        .update({ status: 'completed', next_send_at: null })
        .eq('id', recipient.id);
    }
  }

  return NextResponse.json({ ok: true });
}
