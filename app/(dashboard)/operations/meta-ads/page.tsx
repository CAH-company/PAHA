'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Settings2, TrendingUp, MousePointerClick,
  DollarSign, Eye, ShoppingCart, X, Check, Loader2, BarChart3,
  ChevronDown, AlertCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number;
  cpm: number;
  cpc: number;
  conversions: number;
  roas: number;
  days: number;
}

interface DailySpend { date: string; spend: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANGES = [
  { label: '7 dni',   days: 7  },
  { label: '30 dni',  days: 30 },
  { label: '90 dni',  days: 90 },
];

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number) { return `${n.toFixed(2)}%`; }
function fmtPLN(n: number) { return `${fmt(n, 2)} zł`; }

function getRange(days: number) {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  ACTIVE:   { label: 'Aktywna',   dot: 'bg-emerald-500' },
  PAUSED:   { label: 'Wstrzymana',dot: 'bg-amber-400'   },
  ARCHIVED: { label: 'Archiwum',  dot: 'bg-slate-400'   },
};

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [token,     setToken]     = useState('');
  const [accountId, setAccountId] = useState('');
  const [syncTime,  setSyncTime]  = useState('06:00');
  const [syncDays,  setSyncDays]  = useState('30');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/settings?keys=meta_access_token,meta_account_id,meta_sync_time,meta_sync_days')
      .then(r => r.json())
      .then(d => {
        setToken(d.meta_access_token ?? '');
        setAccountId(d.meta_account_id ?? '');
        setSyncTime(d.meta_sync_time ?? '06:00');
        setSyncDays(d.meta_sync_days ?? '30');
        setLoading(false);
      });
  }, [open]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { key: 'meta_access_token', value: token,     is_secret: true, label: 'Meta Access Token' },
        { key: 'meta_account_id',   value: accountId, label: 'Meta Ad Account ID' },
        { key: 'meta_sync_time',    value: syncTime,  label: 'Meta Sync Time' },
        { key: 'meta_sync_days',    value: syncDays,  label: 'Meta Sync Days' },
      ]),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); onClose(); }, 1200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-bg-base border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Konfiguracja Meta Ads</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
              <p><strong>Jak uzyskać Access Token?</strong></p>
              <p>1. Meta for Developers → Tools → Graph API Explorer</p>
              <p>2. Wybierz swoją aplikację → Generate Access Token</p>
              <p>3. Uprawnienia: <code>ads_read</code>, <code>ads_management</code>, <code>read_insights</code></p>
              <p>4. Wygeneruj Long-Lived Token (ważny 60 dni)</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Access Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxx"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Ad Account ID</label>
                <input
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="123456789012345"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <p className="text-[10px] text-text-muted mt-1">Business Manager → Ad Accounts → ID (bez "act_")</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">Godzina auto-sync</label>
                  <input
                    type="time"
                    value={syncTime}
                    onChange={e => setSyncTime(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">Zakres danych (dni)</label>
                  <select
                    value={syncDays}
                    onChange={e => setSyncDays(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="7">7 dni</option>
                    <option value="30">30 dni</option>
                    <option value="90">90 dni</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="primary" onClick={save} disabled={saving || !token || !accountId}>
                {saving ? <><Loader2 size={13} className="animate-spin" /> Zapisuję...</> :
                 saved  ? <><Check size={13} /> Zapisano!</> : 'Zapisz'}
              </Button>
              <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-bg-base border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">{label}</p>
        <Icon size={14} className={color} />
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MetaAdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [daily,     setDaily]     = useState<DailySpend[]>([]);
  const [meta,      setMeta]      = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [range,     setRange]     = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy,    setSortBy]    = useState<keyof Campaign>('spend');
  const [sortAsc,   setSortAsc]   = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    const { since, until } = getRange(days);
    const res = await fetch(`/api/meta-ads/campaigns?since=${since}&until=${until}`);
    const data = await res.json();
    if (data.error?.includes('Brak konfiguracji') || (!data.meta?.meta_account_id && !data.campaigns?.length)) {
      setNotConfigured(true);
    } else {
      setNotConfigured(false);
    }
    setCampaigns(data.campaigns ?? []);
    setDaily(data.daily ?? []);
    setMeta(data.meta ?? {});
    setLoading(false);
  }, []);

  useEffect(() => { load(range); }, [load, range]);

  const sync = async () => {
    setSyncing(true); setSyncMsg('');
    const res = await fetch('/api/meta-ads/sync', {
      method: 'POST',
      headers: { 'x-manual-sync': '1' },
    });
    const data = await res.json();
    if (res.ok) {
      setSyncMsg(`Zsynchronizowano ${data.rows ?? 0} rekordów`);
      await load(range);
    } else {
      setSyncMsg(data.error ?? 'Błąd synchronizacji');
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const toggleSort = (col: keyof Campaign) => {
    if (sortBy === col) setSortAsc(a => !a);
    else { setSortBy(col); setSortAsc(false); }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortBy] as number;
    const bv = b[sortBy] as number;
    return sortAsc ? av - bv : bv - av;
  });

  // Aggregates
  const totalSpend       = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks      = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const SortTh = ({ col, children }: { col: keyof Campaign; children: React.ReactNode }) => (
    <th
      onClick={() => toggleSort(col)}
      className="text-left px-3 py-2.5 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary select-none whitespace-nowrap">
      <span className="flex items-center gap-1">
        {children}
        {sortBy === col && <ChevronDown size={10} className={cn('transition-transform', sortAsc && 'rotate-180')} />}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Meta Ads</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Analityka kampanii Facebook &amp; Instagram
            {meta.meta_last_synced && (
              <span className="ml-2 text-emerald-600">· Sync: {meta.meta_last_synced}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span className={cn('text-xs px-2 py-1 rounded-lg', syncMsg.startsWith('Zsynchron') ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50')}>
              {syncMsg}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Synchronizuję...' : 'Sync teraz'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings2 size={13} /> Ustawienia
          </Button>
        </div>
      </div>

      {/* Not configured banner */}
      {notConfigured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Brak konfiguracji</p>
            <p className="text-xs text-amber-700 mt-0.5">Ustaw Access Token i Ad Account ID, aby zacząć pobierać dane z Meta Ads.</p>
            <button onClick={() => setShowSettings(true)} className="mt-2 text-xs font-semibold text-amber-800 underline">
              Otwórz ustawienia →
            </button>
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex items-center gap-1">
        {RANGES.map(r => (
          <button key={r.days} onClick={() => setRange(r.days)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              range === r.days ? 'border-accent bg-accent text-white' : 'border-border text-text-secondary hover:border-border-strong'
            )}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Wydatki"       value={fmtPLN(totalSpend)}       icon={DollarSign}        color="text-blue-500"    />
            <KpiCard label="Wyświetlenia"  value={fmt(totalImpressions)}     icon={Eye}               color="text-slate-500"   />
            <KpiCard label="Kliknięcia"    value={fmt(totalClicks)}          icon={MousePointerClick} color="text-indigo-500"  />
            <KpiCard label="CTR"           value={fmtPct(avgCTR)}            icon={TrendingUp}        color="text-violet-500"  sub="avg."  />
            <KpiCard label="CPC"           value={fmtPLN(avgCPC)}            icon={BarChart3}         color="text-amber-500"   sub="śr. koszt kliknięcia" />
            <KpiCard label="Konwersje"     value={fmt(totalConversions)}     icon={ShoppingCart}      color="text-emerald-500" />
          </div>

          {/* Chart */}
          {daily.length > 0 && (
            <div className="bg-bg-base border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Wydatki dziennie</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={daily} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v} zł`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v: any) => [`${v} zł`, 'Wydatki']}
                    labelFormatter={l => `Data: ${l}`}
                  />
                  <Area type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2}
                    fill="url(#spendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Campaign table */}
          <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-text-primary">Kampanie ({campaigns.length})</p>
            </div>
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 size={28} className="text-text-muted mb-3" />
                <p className="text-sm font-medium text-text-secondary">Brak danych</p>
                <p className="text-xs text-text-muted mt-1">
                  {notConfigured ? 'Skonfiguruj integrację powyżej.' : 'Kliknij "Sync teraz" aby pobrać dane z Meta Ads.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle">
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted">Kampania</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted">Status</th>
                      <SortTh col="spend">Wydatki</SortTh>
                      <SortTh col="impressions">Wys.</SortTh>
                      <SortTh col="clicks">Klik.</SortTh>
                      <SortTh col="ctr">CTR</SortTh>
                      <SortTh col="cpc">CPC</SortTh>
                      <SortTh col="conversions">Konw.</SortTh>
                      <SortTh col="roas">ROAS</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(c => {
                      const st = STATUS_CONFIG[c.status] ?? { label: c.status, dot: 'bg-slate-400' };
                      return (
                        <tr key={c.campaign_id} className="border-b border-border last:border-0 hover:bg-bg-subtle/50">
                          <td className="px-3 py-3 max-w-[220px]">
                            <p className="font-medium text-text-primary truncate text-xs">{c.campaign_name}</p>
                            {c.objective && <p className="text-[10px] text-text-muted truncate">{c.objective}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
                              <span className="text-xs text-text-secondary">{st.label}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-text-primary whitespace-nowrap">{fmtPLN(c.spend)}</td>
                          <td className="px-3 py-3 text-xs text-text-secondary">{fmt(c.impressions)}</td>
                          <td className="px-3 py-3 text-xs text-text-secondary">{fmt(c.clicks)}</td>
                          <td className="px-3 py-3 text-xs text-text-secondary">{fmtPct(c.ctr)}</td>
                          <td className="px-3 py-3 text-xs text-text-secondary">{fmtPLN(c.cpc)}</td>
                          <td className="px-3 py-3 text-xs text-text-secondary">{fmt(c.conversions)}</td>
                          <td className="px-3 py-3">
                            <span className={cn(
                              'text-xs font-semibold',
                              c.roas >= 3 ? 'text-emerald-600' : c.roas >= 1 ? 'text-amber-600' : c.roas > 0 ? 'text-red-500' : 'text-text-muted'
                            )}>
                              {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={() => load(range)}
      />
    </div>
  );
}
