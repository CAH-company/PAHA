import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') ?? 'open';
  const rid  = searchParams.get('rid');
  const url  = searchParams.get('url');

  if (rid) {
    const admin = createAdminClient();

    const { data: recipient } = await admin
      .from('email_campaign_recipients')
      .select('id, campaign_id, status, current_step')
      .eq('id', rid)
      .single();

    if (recipient && !['unsubscribed', 'bounced'].includes(recipient.status)) {
      const { data: campaign } = await admin
        .from('email_campaigns')
        .select('id, stop_on_open, stop_on_reply, opened_count, clicked_count, replied_count')
        .eq('id', recipient.campaign_id)
        .single();

      if (campaign) {
        // Find most recent send for this recipient
        const { data: send } = await admin
          .from('email_campaign_sends')
          .select('id, status')
          .eq('recipient_id', rid)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();

        if (type === 'open' || type === 'click' || type === 'reply') {
          const statusPriority: Record<string, number> = {
            sent: 0, delivered: 1, opened: 2, clicked: 3, replied: 4,
          };
          const newStatus = type === 'open' ? 'opened' : type === 'click' ? 'clicked' : 'replied';
          const currentPriority = statusPriority[send?.status ?? 'sent'] ?? 0;

          if (send && statusPriority[newStatus] > currentPriority) {
            await admin
              .from('email_campaign_sends')
              .update({ status: newStatus })
              .eq('id', send.id);
          }

          const counterField =
            type === 'open'  ? 'opened_count' :
            type === 'click' ? 'clicked_count' : 'replied_count';
          const currentCount = (campaign as any)[counterField] ?? 0;

          await admin
            .from('email_campaigns')
            .update({ [counterField]: currentCount + 1 })
            .eq('id', campaign.id);

          await admin.from('email_campaign_events').insert({
            campaign_id: campaign.id,
            send_id: send?.id ?? null,
            recipient_id: rid,
            event_type: type === 'open' ? 'opened' : type === 'click' ? 'clicked' : 'replied',
            data: url ? { url } : null,
          });

          const shouldStop =
            (type === 'open'  && campaign.stop_on_open) ||
            (type === 'reply' && campaign.stop_on_reply);

          if (shouldStop && !['completed', 'unsubscribed', 'bounced'].includes(recipient.status)) {
            await admin
              .from('email_campaign_recipients')
              .update({ status: 'completed', next_send_at: null })
              .eq('id', rid);
          } else if (type === 'reply') {
            await admin
              .from('email_campaign_recipients')
              .update({ status: 'replied' })
              .eq('id', rid);
          }
        }
      }
    }
  }

  if (type === 'click' && url) {
    return NextResponse.redirect(decodeURIComponent(url));
  }

  if (type === 'reply') {
    const { data: rec } = rid
      ? await createAdminClient()
          .from('email_campaign_recipients')
          .select('campaign_id')
          .eq('id', rid)
          .single()
      : { data: null };

    const fromEmail = rec
      ? (await createAdminClient()
          .from('email_campaigns')
          .select('from_email')
          .eq('id', rec.campaign_id)
          .single()
        ).data?.from_email
      : null;

    const mailto = fromEmail ? `mailto:${fromEmail}` : '/';
    return NextResponse.redirect(mailto);
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
