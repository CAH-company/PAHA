import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const META_API_VERSION = 'v22.0';

// Verifies X-Hub-Signature-256 header — required by Meta for all webhook POST deliveries.
// Without this, anyone who knows the URL can inject fake leads.
async function verifyMetaSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signature) return false;

  const { createHmac, timingSafeEqual } = await import('crypto');
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signature);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

// GET — Meta webhook verification (hub challenge).
// Meta sends GET with hub.mode=subscribe to confirm your endpoint before activating the subscription.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check env var first, then fall back to app_settings in DB
  let expectedToken = process.env.META_VERIFY_TOKEN ?? null;
  if (!expectedToken) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_verify_token')
      .maybeSingle();
    expectedToken = data?.value ?? null;
  }

  if (!expectedToken) {
    return NextResponse.json({ error: 'META_VERIFY_TOKEN not configured' }, { status: 500 });
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST — receive leadgen notification, fetch data from Meta Graph API, insert to CRM.
// Meta sends POST for each new lead event after the subscription is verified.
export async function POST(req: NextRequest) {
  // Read raw body first — needed for signature verification before JSON.parse
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  const signatureOk = await verifyMetaSignature(rawBody, signature);
  if (!signatureOk) {
    // Reject if APP_SECRET is configured; log and pass through only if secret is missing (dev mode)
    if (process.env.META_APP_SECRET) {
      console.error('[meta-lead] Invalid X-Hub-Signature-256 — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    console.warn('[meta-lead] META_APP_SECRET not configured — skipping signature check (set it in production!)');
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }

  // Meta expects 200 quickly — always respond ok, log errors internally
  if (body?.object !== 'page') return NextResponse.json({ ok: true });

  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[meta-lead] META_PAGE_ACCESS_TOKEN not configured');
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;

      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${leadgenId}?fields=field_data,created_time,ad_id,form_id,page_id&access_token=${accessToken}`
        );
        const leadData = await metaRes.json();

        if (leadData.error) {
          console.error('[meta-lead] Graph API error:', leadData.error);
          continue;
        }

        // field_data: [{ name: 'email', values: ['jan@firma.pl'] }, ...]
        const fields: Record<string, string> = {};
        for (const field of leadData.field_data ?? []) {
          fields[String(field.name).toLowerCase()] = field.values?.[0] ?? '';
        }

        const email = fields['email'] ?? null;

        // Deduplicate by email
        if (email) {
          const { data: existing } = await supabase.from('leads').select('id').eq('email', email).maybeSingle();
          if (existing) continue;
        }

        const firstName = fields['first_name'] ?? '';
        const lastName  = fields['last_name'] ?? '';
        const fullName  = fields['full_name'] ?? fields['name'] ??
          (firstName || lastName ? `${firstName} ${lastName}`.trim() : null) ??
          email?.split('@')[0] ?? 'Lead z Meta';

        await supabase.from('leads').insert({
          name:     fullName,
          email,
          phone:    fields['phone_number'] ?? fields['phone'] ?? null,
          company:  fields['company_name'] ?? fields['company'] ?? null,
          notes:    fields['message'] ?? fields['comment'] ?? null,
          source:   'meta',
          external_id: leadgenId,
          status:   'new',
          tags:     [],
          is_archived: false,
        });
      } catch (err) {
        console.error('[meta-lead] Error processing leadgen', leadgenId, err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
