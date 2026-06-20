import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// GET — Meta webhook verification (hub challenge)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.META_VERIFY_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: 'META_VERIFY_TOKEN not configured' }, { status: 500 });
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST — receive leadgen notification, fetch data from Meta Graph API, insert to CRM
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

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
          `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,ad_id,form_id,page_id&access_token=${accessToken}`
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
