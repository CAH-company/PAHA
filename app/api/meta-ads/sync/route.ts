import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const META_API = 'https://graph.facebook.com/v19.0';
const FIELDS = 'campaign_id,campaign_name,objective,impressions,clicks,spend,reach,frequency,ctr,cpm,cpc,actions';

function getDateRange(days: number) {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

function extractConversions(actions: any[]): { conversions: number; conversionValue: number } {
  if (!Array.isArray(actions)) return { conversions: 0, conversionValue: 0 };
  const conv = actions.find(a =>
    ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
  );
  const val  = actions.find(a =>
    ['offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
  );
  return {
    conversions:     conv ? parseInt(conv.value ?? '0', 10) : 0,
    conversionValue: val  ? parseFloat(val.value ?? '0')   : 0,
  };
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  // Auth: Vercel Cron sends CRON_SECRET; every other call requires a logged-in user
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isCron) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load settings from app_settings
  const { data: settings } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['meta_access_token', 'meta_account_id', 'meta_sync_time', 'meta_last_synced', 'meta_sync_days']);

  const cfg: Record<string, string> = {};
  for (const s of settings ?? []) cfg[s.key] = s.value;

  const token     = cfg.meta_access_token;
  const accountId = cfg.meta_account_id;

  if (!token || !accountId) {
    return NextResponse.json({ error: 'Brak konfiguracji Meta Ads — ustaw Access Token i Account ID w ustawieniach.' }, { status: 422 });
  }

  // Daily cron (Hobby plan): skip if already synced today
  if (isCron) {
    const lastSync = cfg.meta_last_synced ?? '';
    const todayStr = new Date().toISOString().slice(0, 10);
    if (lastSync === todayStr) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already synced today' });
    }
  }

  const days = parseInt(cfg.meta_sync_days ?? '30', 10);
  const { since, until } = getDateRange(days);

  // Fetch from Meta Graph API
  const url = new URL(`${META_API}/act_${accountId}/insights`);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);

  let metaRes: Response;
  try {
    metaRes = await fetch(url.toString());
  } catch (e: any) {
    return NextResponse.json({ error: `Błąd połączenia z Meta API: ${e.message}` }, { status: 502 });
  }

  const metaJson = await metaRes.json();

  if (metaJson.error) {
    return NextResponse.json({
      error: `Meta API: ${metaJson.error.message}`,
      code: metaJson.error.code,
    }, { status: 422 });
  }

  const rows = (metaJson.data ?? []).map((r: any) => {
    const { conversions, conversionValue } = extractConversions(r.actions);
    return {
      date:              r.date_start,
      campaign_id:       r.campaign_id,
      campaign_name:     r.campaign_name,
      status:            null,
      objective:         r.objective ?? null,
      impressions:       parseInt(r.impressions ?? '0', 10),
      clicks:            parseInt(r.clicks ?? '0', 10),
      spend:             parseFloat(r.spend ?? '0'),
      reach:             parseInt(r.reach ?? '0', 10),
      frequency:         parseFloat(r.frequency ?? '0'),
      ctr:               parseFloat(r.ctr ?? '0'),
      cpm:               parseFloat(r.cpm ?? '0'),
      cpc:               parseFloat(r.cpc ?? '0'),
      conversions,
      conversion_value:  conversionValue,
      fetched_at:        new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error: upsertErr } = await admin
      .from('meta_ads_data')
      .upsert(rows, { onConflict: 'date,campaign_id' });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  // Update last synced timestamp
  await admin.from('app_settings').upsert([
    { key: 'meta_last_synced', value: new Date().toISOString().slice(0, 10), label: 'Meta Ads last sync' },
  ], { onConflict: 'key' });

  return NextResponse.json({ ok: true, rows: rows.length, since, until });
}
