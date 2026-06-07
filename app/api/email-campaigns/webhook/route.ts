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

  // Verify Resend webhook signature (svix HMAC)
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const svixId        = req.headers.get('svix-id')        ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSig       = req.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSig) {
    return NextResponse.json({ error: 'Missing svix signature headers' }, { status: 401 });
  }

  // Cryptographic HMAC-SHA256 verification (svix format)
  const rawBody = await req.text();
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const { createHmac } = await import('crypto');
  const computed = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedSigs = svixSig.split(' ').map(s => s.replace(/^v1,/, ''));
  const signatureValid = expectedSigs.some(sig => sig === computed);

  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Timestamp check — reject events older than 5 minutes
  const ts = parseInt(svixTimestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: 'Timestamp too old' }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }); }

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
