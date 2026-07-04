import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
const META_API_VERSION = 'v22.0';

function parseFields(fieldData: { name: string; values: string[] }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fieldData ?? []) {
    out[String(f.name).toLowerCase()] = f.values?.[0] ?? '';
  }
  return out;
}

// POST /api/meta-leads/retry — re-fetch a failed Meta lead from Graph API and update CRM record.
// Body: { leadId: string }   (Supabase lead UUID)
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  let leadId: string;
  try {
    ({ leadId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const { data: lead } = await supabase
    .from('leads')
    .select('id, external_id, source')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (lead.source !== 'meta') return NextResponse.json({ error: 'Not a Meta lead' }, { status: 400 });
  if (!lead.external_id) return NextResponse.json({ error: 'No external_id — cannot retry' }, { status: 400 });

  let accessToken = process.env.META_PAGE_ACCESS_TOKEN ?? null;
  if (!accessToken) {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_page_access_token')
      .maybeSingle();
    accessToken = data?.value ?? null;
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'meta_page_access_token not configured' }, { status: 400 });
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${lead.external_id}?fields=field_data,created_time,ad_id,ad_name,form_id,page_id&access_token=${accessToken}`
  );
  const metaData = await metaRes.json();

  if (metaData.error) {
    const msg = metaData.error.message ?? 'Unknown Meta API error';
    const code = metaData.error.code ?? 0;
    const type = metaData.error.type ?? '';
    return NextResponse.json(
      { error: msg, meta_code: code, meta_type: type },
      { status: 400 }
    );
  }

  const fields = parseFields(metaData.field_data ?? []);

  const email     = fields['email'] ?? null;
  const firstName = fields['first_name'] ?? '';
  const lastName  = fields['last_name']  ?? '';
  const fullName  =
    fields['full_name'] ?? fields['name'] ??
    (firstName || lastName ? `${firstName} ${lastName}`.trim() : null) ??
    email?.split('@')[0] ?? 'Lead z Meta';

  const phone   = fields['phone_number'] ?? fields['phone'] ?? null;
  const company = fields['company_name'] ?? fields['company'] ?? null;
  const notes   = fields['message'] ?? fields['comment'] ?? null;

  const { error: dbErr } = await supabase
    .from('leads')
    .update({ name: fullName, email, phone, company, notes })
    .eq('id', lead.id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, name: fullName, email, phone, company });
}

// GET /api/meta-leads/test — verify the stored Page Access Token is valid.
export async function GET() {
  const supabase = createServiceClient();

  let accessToken = process.env.META_PAGE_ACCESS_TOKEN ?? null;
  if (!accessToken) {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_page_access_token')
      .maybeSingle();
    accessToken = data?.value ?? null;
  }

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: 'meta_page_access_token not configured' });
  }

  // Verify token via debug_token — returns expiry and scopes
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
  );
  const data = await res.json();

  if (data.error || !data.data?.is_valid) {
    const msg = data.error?.message ?? data.data?.error?.message ?? 'Token invalid or expired';
    return NextResponse.json({ ok: false, error: msg, meta_code: data.error?.code ?? data.data?.error?.code });
  }

  const info = data.data;
  const expiresAt = info.expires_at
    ? new Date(info.expires_at * 1000).toISOString()
    : 'never (non-expiring token)';

  return NextResponse.json({
    ok: true,
    scopes: info.scopes ?? [],
    expires_at: expiresAt,
    has_leads_retrieval: (info.scopes ?? []).includes('leads_retrieval'),
    app_id: info.app_id,
  });
}
