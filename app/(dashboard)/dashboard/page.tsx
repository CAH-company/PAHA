'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Handshake, CheckSquare, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight,
  Clock, Bell, BellOff, FileText, X, Copy, Check,
  ChevronRight, Banknote, UserPlus, Trophy, Frown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/hooks/useDashboard';
import { useNotifications } from '@/hooks/useNotifications';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency, formatDate, formatTimeAgo,
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
} from '@/lib/utils';

// ─── STAT CARD ────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  trend?: { value: number; label: string };
  href?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor = '#6366f1', trend, href }: StatCardProps) {
  const content = (
    <div className="bg-bg-base border border-border rounded-xl p-4 hover:border-border-strong transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${iconColor}18` }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend.value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}</span>
        </div>
      )}
      {href && (
        <div className="flex items-center gap-1 mt-2 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Przejdź</span><ChevronRight size={11} />
        </div>
      )}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// ─── WEEKLY REPORT MODAL ──────────────────────────────────────────────────────
interface WeekReport {
  newLeads: any[];
  wonLeads: any[];
  lostLeads: any[];
  newClients: any[];
  completedTasks: any[];
  costs: any[];
  revenues: any[];
  weekLabel: string;
}

function WeeklyReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [report, setReport] = useState<WeekReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const weekAgoIso = weekAgo.toISOString();

    const weekLabel = `${formatDate(weekAgo, 'd MMM')} – ${formatDate(now, 'd MMM yyyy')}`;

    // Find "done" column
    const { data: cols } = await supabase.from('task_columns').select('id, name');
    const doneColId = (cols ?? []).find(
      (c: any) => ['gotowe', 'done', 'zrobione', 'ukończone', 'zakończone'].includes(c.name.toLowerCase())
    )?.id;

    const [newLeadsRes, wonLeadsRes, lostLeadsRes, newClientsRes, completedTasksRes, costsRes, revsRes] =
      await Promise.all([
        supabase.from('leads').select('id, name, company, status, estimated_value, currency')
          .gte('created_at', weekAgoIso).eq('is_archived', false).order('created_at', { ascending: false }),
        supabase.from('leads').select('id, name, company, estimated_value, currency')
          .eq('status', 'won').gte('updated_at', weekAgoIso),
        supabase.from('leads').select('id, name, company')
          .eq('status', 'lost').gte('updated_at', weekAgoIso),
        supabase.from('clients').select('id, name, company, total_value, currency')
          .gte('created_at', weekAgoIso),
        doneColId
          ? supabase.from('tasks').select('id, title, due_date').eq('column_id', doneColId).gte('updated_at', weekAgoIso)
          : Promise.resolve({ data: [] }),
        supabase.from('costs').select('id, title, amount, amount_pln, currency, category:cost_categories(name)')
          .gte('cost_date', weekAgoStr).order('cost_date', { ascending: false }),
        supabase.from('revenues').select('id, title, amount, amount_pln, currency')
          .gte('revenue_date', weekAgoStr).order('revenue_date', { ascending: false }),
      ]);

    setReport({
      newLeads: newLeadsRes.data ?? [],
      wonLeads: wonLeadsRes.data ?? [],
      lostLeads: lostLeadsRes.data ?? [],
      newClients: newClientsRes.data ?? [],
      completedTasks: completedTasksRes.data ?? [],
      costs: costsRes.data ?? [],
      revenues: revsRes.data ?? [],
      weekLabel,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchReport();
    else { setReport(null); setCopied(false); }
  }, [open, fetchReport]);

  const handleCopy = () => {
    if (!report) return;
    const totalCostsPln = report.costs.reduce((s: number, c: any) => s + (c.amount_pln ?? c.amount), 0);
    const totalRevPln = report.revenues.reduce((s: number, r: any) => s + (r.amount_pln ?? r.amount), 0);
    const balance = totalRevPln - totalCostsPln;

    const text = [
      `📊 RAPORT TYGODNIOWY — ${report.weekLabel}`,
      '',
      `🎯 LEADY`,
      `  • Nowe leady: ${report.newLeads.length}`,
      ...report.newLeads.map((l: any) => `    – ${l.name}${l.company ? ` (${l.company})` : ''}`),
      `  • Wygrane: ${report.wonLeads.length}`,
      ...report.wonLeads.map((l: any) => `    – ${l.name}`),
      `  • Stracone: ${report.lostLeads.length}`,
      '',
      `🤝 KLIENCI`,
      `  • Nowi klienci: ${report.newClients.length}`,
      ...report.newClients.map((c: any) => `    – ${c.name}${c.company ? ` (${c.company})` : ''}`),
      '',
      `✅ ZADANIA`,
      `  • Ukończone: ${report.completedTasks.length}`,
      ...report.completedTasks.map((t: any) => `    – ${t.title}`),
      '',
      `💰 FINANSE`,
      `  • Koszty: ${formatCurrency(totalCostsPln)} PLN`,
      `  • Przychody: ${formatCurrency(totalRevPln)} PLN`,
      `  • Bilans: ${balance >= 0 ? '+' : ''}${formatCurrency(balance)} PLN`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) return null;

  const totalCostsPln = (report?.costs ?? []).reduce((s: number, c: any) => s + (c.amount_pln ?? c.amount), 0);
  const totalRevPln = (report?.revenues ?? []).reduce((s: number, r: any) => s + (r.amount_pln ?? r.amount), 0);
  const balance = totalRevPln - totalCostsPln;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-bg-base border-l border-border overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-subtle sticky top-0 z-10">
          <div>
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <FileText size={15} className="text-accent" />
              Raport tygodniowy
            </h2>
            {report && <p className="text-xs text-text-muted mt-0.5">{report.weekLabel}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!report || loading}>
              {copied ? <><Check size={12} className="text-emerald-500" /> Skopiowano</> : <><Copy size={12} /> Kopiuj</>}
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !report ? null : (
          <div className="flex-1 p-5 space-y-5">

            {/* Leady */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Users size={13} className="text-indigo-500" />
                </div>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Leady</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-bg-subtle rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-text-primary">{report.newLeads.length}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Nowe</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{report.wonLeads.length}</p>
                  <p className="text-[10px] text-emerald-600/70 mt-0.5">Wygrane</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-500">{report.lostLeads.length}</p>
                  <p className="text-[10px] text-red-500/70 mt-0.5">Stracone</p>
                </div>
              </div>
              {report.newLeads.length > 0 && (
                <div className="space-y-1.5">
                  {report.newLeads.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-subtle">
                      <UserPlus size={11} className="text-indigo-400 flex-shrink-0" />
                      <span className="text-xs text-text-primary truncate">{l.name}</span>
                      {l.company && <span className="text-xs text-text-muted truncate">· {l.company}</span>}
                      <Badge color={LEAD_STATUS_COLORS[l.status]} className="ml-auto flex-shrink-0">
                        {LEAD_STATUS_LABELS[l.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {report.wonLeads.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {report.wonLeads.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                      <Trophy size={11} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-emerald-700 truncate">{l.name}</span>
                      {l.estimated_value && (
                        <span className="text-xs font-semibold text-emerald-600 ml-auto flex-shrink-0">
                          +{formatCurrency(l.estimated_value, l.currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Klienci */}
            {report.newClients.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Handshake size={13} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Nowi klienci</h3>
                  <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                    +{report.newClients.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {report.newClients.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-subtle">
                      <Avatar name={c.name} size="xs" />
                      <span className="text-xs text-text-primary">{c.name}</span>
                      {c.company && <span className="text-xs text-text-muted">· {c.company}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Zadania */}
            {report.completedTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <CheckSquare size={13} className="text-amber-500" />
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Ukończone zadania</h3>
                  <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                    {report.completedTasks.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {report.completedTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-subtle">
                      <Check size={11} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-text-primary truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Finanse */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Banknote size={13} className="text-blue-500" />
                </div>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Finanse tygodnia</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                  <p className="text-sm font-bold text-red-600">{formatCurrency(totalCostsPln)}</p>
                  <p className="text-[10px] text-red-500/70 mt-0.5">Koszty PLN</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalRevPln)}</p>
                  <p className="text-[10px] text-emerald-600/70 mt-0.5">Przychody PLN</p>
                </div>
                <div className={`rounded-lg p-3 text-center border ${balance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-sm font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${balance >= 0 ? 'text-emerald-600/70' : 'text-red-500/70'}`}>Bilans</p>
                </div>
              </div>
              {report.costs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Koszty ({report.costs.length})</p>
                  {report.costs.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-bg-subtle">
                      <span className="text-xs text-text-secondary truncate">{c.title}</span>
                      <span className="text-xs font-medium text-text-primary ml-2 flex-shrink-0">
                        {formatCurrency(c.amount, c.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {report.revenues.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Przychody ({report.revenues.length})</p>
                  {report.revenues.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-bg-subtle">
                      <span className="text-xs text-text-secondary truncate">{r.title}</span>
                      <span className="text-xs font-medium text-emerald-600 ml-2 flex-shrink-0">
                        +{formatCurrency(r.amount, r.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {report.costs.length === 0 && report.revenues.length === 0 && (
                <p className="text-xs text-text-muted text-center py-3">Brak transakcji w tym tygodniu</p>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS PANEL ─────────────────────────────────────────────────────
const NOTIF_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  task:    { icon: CheckSquare, color: '#f59e0b' },
  lead:    { icon: Users,       color: '#6366f1' },
  client:  { icon: Handshake,   color: '#10b981' },
  cost:    { icon: DollarSign,  color: '#ef4444' },
  info:    { icon: Bell,        color: '#3b82f6' },
};

function NotificationsPanel() {
  const { notifications, unread, loading, markAllRead } = useNotifications();

  return (
    <div className="bg-bg-base border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Powiadomienia</h2>
          {unread > 0 && (
            <span className="bg-accent text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-[10px] text-accent hover:text-accent-hover">
            Oznacz przeczytane
          </button>
        )}
      </div>
      <div className="flex-1 divide-y divide-border overflow-y-auto max-h-64">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <BellOff size={20} className="text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted">Brak powiadomień</p>
          </div>
        ) : (
          notifications.map((n) => {
            const def = NOTIF_ICONS[n.type] ?? NOTIF_ICONS.info;
            const Icon = def.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-2.5 hover:bg-bg-subtle transition-colors cursor-pointer ${!n.is_read ? 'bg-accent/5' : ''}`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${def.color}18` }}>
                  <Icon size={11} style={{ color: def.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-relaxed ${!n.is_read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-[10px] text-text-muted truncate mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-text-muted mt-0.5">{formatTimeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTH_NAMES = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export default function DashboardPage() {
  const { stats, recentLeads, myTasks, loading } = useDashboard();
  const [showReport, setShowReport] = useState(false);

  const now = new Date();
  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Dzień dobry';
    if (h < 18) return 'Dobry popołudnie';
    return 'Dobry wieczór';
  })();
  const dateStr = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary capitalize">{greeting} 👋</h1>
          <p className="text-sm text-text-muted mt-0.5 capitalize">{dateStr}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowReport(true)}>
          <FileText size={14} />
          Raport tygodnia
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Nowe leady"
          value={stats.leads_new > 0 ? `+${stats.leads_new}` : stats.leads_total}
          subtitle={`${stats.leads_total} łącznie`}
          icon={Users}
          iconColor="#6366f1"
          href="/crm/leads"
        />
        <StatCard
          title="Aktywni klienci"
          value={stats.clients_active}
          icon={Handshake}
          iconColor="#10b981"
          href="/crm/clients"
        />
        <StatCard
          title="Zadania"
          value={stats.tasks_pending}
          subtitle={stats.tasks_overdue > 0 ? `${stats.tasks_overdue} przeterminowane` : 'Wszystko na czas'}
          icon={CheckSquare}
          iconColor={stats.tasks_overdue > 0 ? '#ef4444' : '#f59e0b'}
          href="/tasks"
        />
        <StatCard
          title={`Koszty ${MONTH_NAMES[now.getMonth()]}`}
          value={formatCurrency(stats.costs_month)}
          subtitle={[
            stats.costs_month_eur > 0 && `${formatCurrency(stats.costs_month_eur, 'EUR')}`,
            stats.costs_month_usd > 0 && `${formatCurrency(stats.costs_month_usd, 'USD')}`,
          ].filter(Boolean).join(' · ') || undefined}
          icon={DollarSign}
          iconColor="#ef4444"
          href="/accounting"
        />
      </div>

      {/* Bottom: Tasks + Leads + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* My tasks */}
        <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Moje zadania</h2>
              {stats.tasks_overdue > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                  <AlertTriangle size={9} />{stats.tasks_overdue}
                </span>
              )}
            </div>
            <Link href="/tasks" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
              Wszystkie <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {myTasks.length === 0 ? (
              <div className="py-8 text-center">
                <CheckSquare size={20} className="text-text-muted mx-auto mb-2" />
                <p className="text-xs text-text-muted">Brak zadań</p>
              </div>
            ) : (
              myTasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                return (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-subtle transition-colors cursor-pointer">
                    <div className="w-1 h-full min-h-[28px] rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary leading-relaxed">{task.title}</p>
                      {task.due_date && (
                        <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-red-500' : 'text-text-muted'}`}>
                          {isOverdue && <AlertTriangle size={9} />}
                          <Clock size={9} />
                          {formatDate(task.due_date, 'dd.MM HH:mm')}
                        </p>
                      )}
                    </div>
                    <Badge color={PRIORITY_COLORS[task.priority]}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent leads */}
        <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Ostatnie leady</h2>
            <Link href="/crm/leads" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
              Wszystkie <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentLeads.length === 0 ? (
              <div className="py-8 text-center">
                <Users size={20} className="text-text-muted mx-auto mb-2" />
                <p className="text-xs text-text-muted">Brak leadów</p>
              </div>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-subtle transition-colors cursor-pointer">
                  <Avatar name={lead.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{lead.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{lead.company ?? '—'}</p>
                  </div>
                  <Badge color={LEAD_STATUS_COLORS[lead.status]}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <NotificationsPanel />
      </div>

      {/* Weekly report side panel */}
      <WeeklyReportModal open={showReport} onClose={() => setShowReport(false)} />
    </div>
  );
}
