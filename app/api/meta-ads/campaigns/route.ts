import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  const admin = createAdminClient();

  let query = admin
    .from('meta_ads_data')
    .select('*')
    .order('date', { ascending: false });

  if (since) query = query.gte('date', since);
  if (until) query = query.lte('date', until);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by campaign
  const campaignMap = new Map<string, any>();
  for (const row of data ?? []) {
    const key = row.campaign_id;
    if (!campaignMap.has(key)) {
      campaignMap.set(key, {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        status: row.status,
        objective: row.objective,
        impressions: 0, clicks: 0, spend: 0, reach: 0,
        conversions: 0, conversion_value: 0,
        days: new Set<string>(),
      });
    }
    const c = campaignMap.get(key)!;
    c.impressions        += row.impressions;
    c.clicks             += row.clicks;
    c.spend              += Number(row.spend);
    c.reach              += row.reach;
    c.conversions        += row.conversions;
    c.conversion_value   += Number(row.conversion_value);
    c.days.add(row.date);
  }

  const campaigns = Array.from(campaignMap.values()).map(c => ({
    ...c,
    days: c.days.size,
    ctr:  c.impressions > 0 ? c.clicks / c.impressions * 100 : 0,
    cpm:  c.impressions > 0 ? c.spend / c.impressions * 1000 : 0,
    cpc:  c.clicks > 0      ? c.spend / c.clicks             : 0,
    roas: c.spend > 0       ? c.conversion_value / c.spend   : 0,
    spend: Math.round(c.spend * 100) / 100,
  }));

  // Daily spend for chart
  const dailyMap = new Map<string, number>();
  for (const row of data ?? []) {
    dailyMap.set(row.date, (dailyMap.get(row.date) ?? 0) + Number(row.spend));
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({ date, spend: Math.round(spend * 100) / 100 }));

  // Settings
  const { data: settings } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['meta_last_synced', 'meta_sync_time', 'meta_sync_days', 'meta_account_id']);

  const cfg: Record<string, string> = {};
  for (const s of settings ?? []) cfg[s.key] = s.value;

  return NextResponse.json({ campaigns, daily, meta: cfg });
}
