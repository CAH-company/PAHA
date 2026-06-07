import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// Mapuje pola z różnych platform na schemat leada
function mapPayload(body: any, platform: string): Record<string, any> {
  // Typeform
  if (platform === 'typeform' || body?.form_response) {
    const answers = body?.form_response?.answers ?? [];
    const fields = body?.form_response?.definition?.fields ?? [];
    const get = (ref: string) => {
      const idx = fields.findIndex((f: any) => f.ref === ref || f.title?.toLowerCase().includes(ref));
      const ans = answers[idx];
      return ans?.text ?? ans?.email ?? ans?.phone_number ?? ans?.number ?? null;
    };
    return {
      name: get('name') ?? get('imię') ?? get('nazwisko') ?? 'Nieznany',
      email: answers.find((a: any) => a.type === 'email')?.email ?? null,
      phone: answers.find((a: any) => a.type === 'phone_number')?.phone_number ?? null,
      company: get('company') ?? get('firma') ?? null,
      notes: get('message') ?? get('wiadomość') ?? get('opis') ?? null,
      source: 'form' as const,
    };
  }

  // Clay
  if (platform === 'clay' || body?.clay_run_id) {
    return {
      name: body?.full_name ?? body?.name ?? (`${body?.first_name ?? ''} ${body?.last_name ?? ''}`.trim() || 'Nieznany'),
      email: body?.email ?? body?.work_email ?? null,
      phone: body?.phone ?? body?.mobile_phone ?? null,
      company: body?.company ?? body?.company_name ?? body?.organization ?? null,
      notes: body?.notes ?? body?.summary ?? null,
      estimated_value: body?.deal_value ?? null,
      source: 'clay' as const,
      external_id: body?.clay_run_id ?? null,
    };
  }

  // Lemlist
  if (platform === 'lemlist' || body?.leadId || body?.campaignId) {
    return {
      name: `${body?.firstName ?? ''} ${body?.lastName ?? ''}`.trim() || body?.email?.split('@')[0] || 'Nieznany',
      email: body?.email ?? null,
      company: body?.companyName ?? null,
      notes: body?.icebreaker ?? body?.customVariable1 ?? null,
      source: 'lemlist' as const,
      external_id: body?.leadId ?? null,
    };
  }

  // Generic / custom form
  return {
    name: body?.name ?? body?.full_name ?? body?.imie ?? body?.firstName
      ?? (`${body?.first_name ?? ''} ${body?.last_name ?? ''}`.trim() || body?.email?.split('@')[0] || 'Nieznany'),
    email: body?.email ?? body?.mail ?? null,
    phone: body?.phone ?? body?.tel ?? body?.telefon ?? null,
    company: body?.company ?? body?.firma ?? body?.organization ?? body?.companyName ?? null,
    notes: body?.message ?? body?.wiadomosc ?? body?.wiadomość ?? body?.note ?? body?.description ?? null,
    estimated_value: body?.budget ?? body?.value ?? body?.estimated_value ?? null,
    source: 'form' as const,
    external_id: body?.id ?? body?.lead_id ?? null,
  };
}

export async function POST(req: NextRequest) {
  // Weryfikacja API key
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') ?? 'generic';

  const apiKey = req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createServiceClient();

  const expectedKey = process.env.LEADS_WEBHOOK_SECRET ?? null;
  let resolvedKey = expectedKey;

  if (!resolvedKey) {
    // Fallback: sprawdź w app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'leads_webhook_secret')
      .maybeSingle();
    resolvedKey = setting?.value ?? null;
  }

  // Fail-closed: brak klucza = brak dostępu
  if (!resolvedKey || apiKey !== resolvedKey) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mapped = mapPayload(body, platform);

  // Walidacja minimum
  if (!mapped.name || mapped.name === '') {
    mapped.name = mapped.email?.split('@')[0] ?? 'Lead z formularza';
  }

  // Sprawdź duplikat po email + external_id
  if (mapped.email) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('email', mapped.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: mapped.name,
      email: mapped.email ?? null,
      phone: mapped.phone ?? null,
      company: mapped.company ?? null,
      notes: mapped.notes ?? null,
      estimated_value: mapped.estimated_value ? parseFloat(mapped.estimated_value) : null,
      source: mapped.source ?? 'form',
      external_id: mapped.external_id ?? null,
      status: 'new',
      tags: [],
      is_archived: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[webhooks/lead]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}

// GET — info o endpoincie (pomocne przy konfiguracji)
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/webhooks/lead',
    methods: ['POST'],
    platforms: ['generic', 'typeform', 'clay', 'lemlist'],
    auth: 'x-api-key header lub ?api_key= query param',
    required_fields: ['name lub email'],
  });
}
