'use client';

import { useState, useCallback } from 'react';
import {
  Plus, Mail, Send, Pause, Play, Trash2, Eye, ChevronDown,
  ChevronRight, Users, CheckCircle2, AlertCircle, Clock,
  BarChart2, RefreshCw, X, ArrowRight, Zap,
} from 'lucide-react';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { EmailCampaign, EmailCampaignStep, RecipientStatus, LeadStatus, LeadSource } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Szkic',     color: '#94a3b8', bg: '#f1f5f9' },
  active:    { label: 'Aktywna',   color: '#10b981', bg: '#ecfdf5' },
  paused:    { label: 'Pauza',     color: '#f59e0b', bg: '#fffbeb' },
  completed: { label: 'Zakończona',color: '#6366f1', bg: '#eef2ff' },
};

const RECIPIENT_STATUS_CONFIG: Record<RecipientStatus, { label: string; dot: string }> = {
  pending:     { label: 'Oczekuje',    dot: 'bg-slate-300' },
  active:      { label: 'W sekwencji', dot: 'bg-blue-500' },
  completed:   { label: 'Zakończono',  dot: 'bg-emerald-500' },
  bounced:     { label: 'Odbitka',     dot: 'bg-red-500' },
  replied:     { label: 'Odpisał',     dot: 'bg-violet-500' },
  unsubscribed:{ label: 'Wypisał się', dot: 'bg-amber-400' },
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nowy', contacted: 'Kontaktowany', offer_sent: 'Oferta wysłana',
  negotiation: 'Negocjacje', won: 'Wygrany', lost: 'Przegrany',
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: 'Ręczny', csv: 'Import CSV', lemlist: 'Lemlist', clay: 'Clay', form: 'Formularz',
};

const VARS = ['{{name}}', '{{first_name}}', '{{company}}', '{{email}}'];

// ─── Step editor ──────────────────────────────────────────────────────────────

type DraftStep = { subject: string; body_html: string; delay_days: number };

function StepEditor({
  step, index, total, onChange, onRemove,
}: {
  step: DraftStep; index: number; total: number;
  onChange: (s: DraftStep) => void; onRemove: () => void;
}) {
  const insertVar = (field: 'subject' | 'body_html', v: string) => {
    onChange({ ...step, [field]: step[field] + v });
  };

  return (
    <div className="relative">
      {index > 0 && (
        <div className="flex items-center gap-2 mb-3 pl-4">
          <div className="w-px h-6 bg-border ml-3" />
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Clock size={12} />
            <span>Czekaj</span>
            <input
              type="number" min={1} max={90}
              value={step.delay_days || 3}
              onChange={e => onChange({ ...step, delay_days: Number(e.target.value) })}
              className="w-12 border border-border rounded px-1.5 py-0.5 text-center text-xs bg-bg-base text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <span>dni po poprzednim kroku</span>
          </div>
        </div>
      )}
      <div className="border border-border rounded-xl bg-bg-base overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-bg-subtle border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {index === 0 ? 'Pierwszy email' : `Następny email`}
            </span>
          </div>
          {total > 1 && (
            <button onClick={onRemove} className="text-text-muted hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">Temat</label>
            <input
              value={step.subject}
              onChange={e => onChange({ ...step, subject: e.target.value })}
              placeholder="np. Współpraca z {{company}} — wstępna propozycja"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Treść</label>
              <div className="flex gap-1">
                {VARS.map(v => (
                  <button key={v} onClick={() => insertVar('body_html', v)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-accent/40 text-accent hover:bg-accent/10 font-mono transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={step.body_html}
              onChange={e => onChange({ ...step, body_html: e.target.value })}
              rows={6}
              placeholder={`Cześć {{first_name}},\n\nZauważyłem, że {{company}} działa w branży...\n\nCzy masz 15 minut na krótką rozmowę?`}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono leading-relaxed"
            />
            <p className="text-[10px] text-text-muted mt-1">Użyj przycisków wyżej, aby wstawić zmienne personalizacji.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recipient selector ───────────────────────────────────────────────────────

type FilterType = 'all' | 'status' | 'source';

function RecipientSelector({
  leads, filterType, filterValue, onFilterChange,
}: {
  leads: any[];
  filterType: FilterType;
  filterValue: string;
  onFilterChange: (type: FilterType, value: string) => void;
}) {
  const filtered = leads.filter(l => {
    if (!l.email) return false;
    if (filterType === 'status') return l.status === filterValue;
    if (filterType === 'source') return l.source === filterValue;
    return true;
  });

  const allLeadStatuses = Array.from(new Set(leads.map(l => l.status))) as LeadStatus[];
  const allSources = Array.from(new Set(leads.map(l => l.source))) as LeadSource[];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">Filtr odbiorców</label>
        <div className="flex gap-2 flex-wrap">
          {([
            { type: 'all' as FilterType, label: 'Wszyscy leady', value: '' },
            ...allLeadStatuses.map(s => ({ type: 'status' as FilterType, label: LEAD_STATUS_LABELS[s] ?? s, value: s })),
            ...allSources.map(s => ({ type: 'source' as FilterType, label: SOURCE_LABELS[s] ?? s, value: s })),
          ]).map(opt => (
            <button key={`${opt.type}-${opt.value}`}
              onClick={() => onFilterChange(opt.type, opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                filterType === opt.type && filterValue === opt.value
                  ? 'border-accent bg-accent text-white'
                  : 'border-border text-text-secondary hover:border-border-strong'
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-bg-subtle border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">
              {filtered.length} odbiorców z emailem
            </span>
          </div>
          <span className="text-xs text-text-muted">z {leads.filter(l => l.email).length} łącznie</span>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {filtered.slice(0, 8).map(l => (
            <div key={l.id} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="font-medium text-text-primary">{l.name}</span>
              {l.company && <span className="text-text-muted">· {l.company}</span>}
              <span className="ml-auto text-text-muted font-mono">{l.email}</span>
            </div>
          ))}
          {filtered.length > 8 && (
            <p className="text-xs text-text-muted pl-3.5">+ {filtered.length - 8} więcej...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Builder Modal ───────────────────────────────────────────────────

const EMPTY_STEP: DraftStep = { subject: '', body_html: '', delay_days: 3 };

function CampaignBuilderModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { leads } = useLeads();
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [stopOnOpen, setStopOnOpen] = useState(false);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [steps, setSteps] = useState<DraftStep[]>([{ ...EMPTY_STEP, delay_days: 0 }]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterValue, setFilterValue] = useState('');

  const resetForm = () => {
    setWizardStep(0); setName(''); setFromName(''); setFromEmail('');
    setStopOnOpen(false); setStopOnReply(true);
    setSteps([{ ...EMPTY_STEP, delay_days: 0 }]);
    setFilterType('all'); setFilterValue(''); setError('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const addStep = () => setSteps(s => [...s, { ...EMPTY_STEP }]);
  const updateStep = (i: number, s: DraftStep) => setSteps(prev => prev.map((p, idx) => idx === i ? s : p));
  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const filteredLeads = leads.filter(l => {
    if (!l.email) return false;
    if (filterType === 'status') return l.status === filterValue;
    if (filterType === 'source') return l.source === filterValue;
    return true;
  });

  const canNext = [
    name.trim() && fromName.trim() && fromEmail.trim(),
    steps.every(s => s.subject.trim() && s.body_html.trim()),
    filteredLeads.length > 0,
  ];

  const handleSave = async (launch: boolean) => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, from_name: fromName, from_email: fromEmail,
          stop_on_open: stopOnOpen, stop_on_reply: stopOnReply,
          recipient_filter: { type: filterType, value: filterValue || undefined },
          steps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Błąd zapisu');

      if (launch) {
        const lr = await fetch(`/api/email-campaigns/${data.id}/launch`, { method: 'POST' });
        const ld = await lr.json();
        if (!lr.ok) throw new Error(ld.error ?? 'Błąd uruchomienia');
      }

      onSuccess(); handleClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const WIZARD_STEPS = ['Podstawy', 'Sekwencja', 'Odbiorcy', 'Podsumowanie'];

  return (
    <Modal open={open} onClose={handleClose} title="Nowa kampania mailowa" size="xl">
      <div className="flex flex-col h-[70vh]">
        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-0 border-b border-border">
          {WIZARD_STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < wizardStep && setWizardStep(i)}
                className={cn(
                  'flex items-center gap-2 px-3 pb-3 text-sm font-medium border-b-2 transition-colors',
                  i === wizardStep ? 'border-accent text-accent' :
                  i < wizardStep ? 'border-transparent text-text-secondary hover:text-text-primary cursor-pointer' :
                  'border-transparent text-text-muted cursor-default'
                )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                  i === wizardStep ? 'bg-accent text-white' :
                  i < wizardStep ? 'bg-emerald-500 text-white' :
                  'bg-bg-subtle text-text-muted'
                )}>
                  {i < wizardStep ? '✓' : i + 1}
                </span>
                {label}
              </button>
              {i < WIZARD_STEPS.length - 1 && <ChevronRight size={14} className="text-text-muted mx-1 mb-3" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 0: Basics */}
          {wizardStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">Nazwa kampanii</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder='np. "Cold outreach IT Q3 2025"'
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">Nadawca — imię</label>
                  <input value={fromName} onChange={e => setFromName(e.target.value)}
                    placeholder='np. "Dominik z AutomationHub"'
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">Nadawca — email</label>
                  <input value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                    placeholder='np. dominik@twojadomena.pl'
                    type="email"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">Warunki zatrzymania sekwencji</label>
                <div className="space-y-2">
                  {[
                    { id: 'stop-open',  label: 'Zatrzymaj gdy odbiorca otworzy email',   value: stopOnOpen,  set: setStopOnOpen  },
                    { id: 'stop-reply', label: 'Zatrzymaj gdy odbiorca kliknie "Odpowiedz"', value: stopOnReply, set: setStopOnReply },
                  ].map(opt => (
                    <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        id={opt.id}
                        checked={opt.value}
                        onChange={e => opt.set(e.target.checked)}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className="text-sm text-text-primary">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">Każdy email zawiera też automatyczny link do wypisania się (wymóg RODO).</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <strong>Wskazówka:</strong> W Resend musisz zweryfikować domenę nadawcy, żeby emaile nie trafiały do spamu. Na czas testów możesz użyć <code>onboarding@resend.dev</code>.
              </div>
            </div>
          )}

          {/* Step 1: Sequence */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">Zaprojektuj sekwencję emaili. Pierwszy wyślemy od razu po uruchomieniu, kolejne po zdefiniowanym opóźnieniu.</p>
              {steps.map((step, i) => (
                <StepEditor key={i} step={step} index={i} total={steps.length}
                  onChange={s => updateStep(i, s)}
                  onRemove={() => removeStep(i)} />
              ))}
              {steps.length < 5 && (
                <button onClick={addStep}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-sm text-text-muted hover:border-accent hover:text-accent transition-colors">
                  <Plus size={14} /> Dodaj kolejny email do sekwencji
                </button>
              )}
            </div>
          )}

          {/* Step 2: Recipients */}
          {wizardStep === 2 && (
            <RecipientSelector
              leads={leads}
              filterType={filterType}
              filterValue={filterValue}
              onFilterChange={(t, v) => { setFilterType(t); setFilterValue(v); }}
            />
          )}

          {/* Step 3: Summary */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Kampania', value: name },
                  { label: 'Nadawca', value: `${fromName} <${fromEmail}>` },
                  { label: 'Odbiorcy', value: `${filteredLeads.length} leadów` },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-bg-subtle border border-border rounded-xl">
                    <p className="text-xs text-text-muted mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-text-primary truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Sekwencja — {steps.length} krok{steps.length === 1 ? '' : steps.length < 5 ? 'i' : 'ów'}</p>
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-bg-subtle border border-border rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{s.subject || <span className="italic text-text-muted">Brak tematu</span>}</p>
                        {i > 0 && <p className="text-xs text-text-muted">po {s.delay_days} dniach</p>}
                        {i === 0 && <p className="text-xs text-text-muted">wysyłany od razu</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-subtle">
          <Button variant="ghost" size="sm" onClick={wizardStep === 0 ? handleClose : () => setWizardStep(s => s - 1)}>
            {wizardStep === 0 ? 'Anuluj' : 'Wstecz'}
          </Button>
          <div className="flex gap-2">
            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <Button variant="primary" size="sm"
                disabled={!canNext[wizardStep]}
                onClick={() => setWizardStep(s => s + 1)}>
                Dalej <ArrowRight size={13} />
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => handleSave(false)}>
                  Zapisz jako szkic
                </Button>
                <Button variant="primary" size="sm" disabled={saving || filteredLeads.length === 0} onClick={() => handleSave(true)}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uruchamiam...
                    </span>
                  ) : (
                    <><Send size={13} /> Uruchom kampanię</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Campaign Detail Modal ────────────────────────────────────────────────────

function CampaignDetailModal({ campaign, open, onClose, onRefresh }: {
  campaign: EmailCampaign | null; open: boolean; onClose: () => void; onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/email-campaigns/${id}`);
    if (res.ok) setDetail(await res.json());
    setLoadingDetail(false);
  }, []);

  if (open && campaign && !detail && !loadingDetail) loadDetail(campaign.id);
  if (!open && detail) setDetail(null);

  const handlePause = async () => {
    if (!campaign) return;
    setActionLoading(true);
    await fetch(`/api/email-campaigns/${campaign.id}/pause`, { method: 'POST' });
    setActionLoading(false); onRefresh();
    await loadDetail(campaign.id);
  };

  const handleProcess = async () => {
    setActionLoading(true);
    await fetch('/api/email-campaigns/process', { method: 'POST' });
    setActionLoading(false); onRefresh();
    if (campaign) await loadDetail(campaign.id);
  };

  const cfg = campaign ? STATUS_CONFIG[campaign.status] : null;

  return (
    <Modal open={open} onClose={onClose} title={campaign?.name ?? ''} size="xl">
      <div className="p-6 space-y-6">
        {/* Header stats */}
        {campaign && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Wysłane',    value: campaign.sent_count,       icon: Send,          color: 'text-blue-500'    },
                { label: 'Dostarczono',value: campaign.delivered_count,  icon: CheckCircle2,  color: 'text-emerald-400' },
                { label: 'Otwarte',    value: campaign.opened_count,     icon: Eye,           color: 'text-emerald-500' },
              ].map(stat => (
                <div key={stat.label} className="p-3 bg-bg-subtle border border-border rounded-xl text-center">
                  <stat.icon size={15} className={cn('mx-auto mb-1', stat.color)} />
                  <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  {stat.label !== 'Wysłane' && campaign.sent_count > 0 && (
                    <p className="text-[10px] text-text-muted">{Math.round((stat.value / campaign.sent_count) * 100)}%</p>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Kliknięcia',  value: campaign.clicked_count,   icon: BarChart2,     color: 'text-indigo-500' },
                { label: 'Odpowiedzi',  value: campaign.replied_count,   icon: CheckCircle2,  color: 'text-violet-500' },
                { label: 'Odbitki',     value: campaign.bounced_count,   icon: AlertCircle,   color: 'text-red-400'    },
              ].map(stat => (
                <div key={stat.label} className="p-3 bg-bg-subtle border border-border rounded-xl text-center">
                  <stat.icon size={15} className={cn('mx-auto mb-1', stat.color)} />
                  <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  {campaign.sent_count > 0 && (
                    <p className="text-[10px] text-text-muted">{Math.round((stat.value / campaign.sent_count) * 100)}%</p>
                  )}
                </div>
              ))}
            </div>
            {(campaign.stop_on_open || campaign.stop_on_reply) && (
              <div className="flex gap-2 flex-wrap">
                {campaign.stop_on_open  && <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Stop po otwarciu</span>}
                {campaign.stop_on_reply && <span className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Stop po odpowiedzi</span>}
              </div>
            )}
          </div>
        )}

        {/* Sequence steps */}
        {detail?.steps && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Sekwencja</p>
            <div className="flex items-center gap-2 flex-wrap">
              {detail.steps.sort((a: any, b: any) => a.step_order - b.step_order).map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-bg-subtle border border-border rounded-lg">
                    <span className="w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="text-xs font-medium text-text-primary">{s.subject}</p>
                      {i > 0 && <p className="text-[10px] text-text-muted">po {s.delay_days}d</p>}
                    </div>
                  </div>
                  {i < detail.steps.length - 1 && <ArrowRight size={12} className="text-text-muted" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipients */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Odbiorcy</p>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-subtle border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Lead</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Krok</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Następny</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.recipients ?? []).slice(0, 20).map((r: any) => {
                    const rCfg = RECIPIENT_STATUS_CONFIG[r.status as RecipientStatus];
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-subtle/50">
                        <td className="px-4 py-2.5 font-medium text-text-primary">{r.lead?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{r.lead?.email ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-1.5 h-1.5 rounded-full', rCfg?.dot ?? 'bg-slate-300')} />
                            <span className="text-xs text-text-secondary">{rCfg?.label ?? r.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-xs">{r.current_step}/{detail?.steps?.length ?? '?'}</td>
                        <td className="px-4 py-2.5 text-text-muted text-xs">
                          {r.next_send_at ? new Date(r.next_send_at).toLocaleDateString('pl-PL') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {(detail?.recipients ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">Brak odbiorców</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {campaign?.status === 'active' && (
            <Button variant="outline" size="sm" onClick={handlePause} disabled={actionLoading}>
              <Pause size={13} /> Pauza
            </Button>
          )}
          {campaign?.status === 'paused' && (
            <Button variant="primary" size="sm" onClick={handlePause} disabled={actionLoading}>
              <Play size={13} /> Wznów
            </Button>
          )}
          {(campaign?.status === 'active' || campaign?.status === 'paused') && (
            <Button variant="outline" size="sm" onClick={handleProcess} disabled={actionLoading}>
              <RefreshCw size={13} /> Sprawdź zaległe wysyłki
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onOpen, onLaunch, onRefresh }: {
  campaign: EmailCampaign;
  onOpen: () => void;
  onLaunch: () => void;
  onRefresh: () => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cfg = STATUS_CONFIG[campaign.status];
  const stepsCount = campaign.steps?.length ?? 0;
  const sentPct = campaign.total_recipients > 0
    ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) : 0;
  const openRate = campaign.sent_count > 0
    ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0;

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLaunching(true);
    await fetch(`/api/email-campaigns/${campaign.id}/launch`, { method: 'POST' });
    setLaunching(false);
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Usunąć kampanię?')) return;
    setDeleting(true);
    await fetch(`/api/email-campaigns/${campaign.id}`, { method: 'DELETE' });
    setDeleting(false);
    onRefresh();
  };

  return (
    <div
      onClick={onOpen}
      className="bg-bg-base border border-border rounded-xl p-4 hover:border-accent/40 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary truncate">{campaign.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-3">
            <span className="font-mono">{campaign.from_email}</span>
            {stepsCount > 0 && <> · {stepsCount} krok{stepsCount === 1 ? '' : stepsCount < 5 ? 'i' : 'ów'}</>}
          </p>

          {campaign.status !== 'draft' && campaign.total_recipients > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{campaign.sent_count} / {campaign.total_recipients} wysłanych</span>
                <span>{sentPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${sentPct}%` }} />
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600"><strong>{openRate}%</strong> otwarte</span>
                {campaign.replied_count > 0 && (
                  <span className="text-violet-600"><strong>{campaign.replied_count}</strong> odpowiedzi</span>
                )}
                {campaign.bounced_count > 0 && (
                  <span className="text-red-500"><strong>{campaign.bounced_count}</strong> odbitek</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {campaign.status === 'draft' && (
            <Button variant="primary" size="sm" onClick={handleLaunch} disabled={launching}
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              {launching
                ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Send size={12} /> Uruchom</>}
            </Button>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-500 p-1 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { campaigns, loading, refetch } = useEmailCampaigns();
  const [showBuilder, setShowBuilder] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<EmailCampaign | null>(null);

  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied_count, 0);
  const avgOpenRate = totalSent > 0
    ? Math.round(campaigns.reduce((s, c) => s + c.opened_count, 0) / totalSent * 100)
    : 0;
  const avgReplyRate = totalSent > 0
    ? Math.round(totalReplied / totalSent * 100)
    : 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Email Outreach</h1>
          <p className="text-xs text-text-muted mt-0.5">Kampanie mailowe — sekwencje, śledzenie, personalizacja</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowBuilder(true)}>
          <Plus size={14} /> Nowa kampania
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktywne kampanie', value: activeCampaigns,       icon: Zap,      color: 'text-emerald-500' },
          { label: 'Wysłane emaile',   value: totalSent,             icon: Send,     color: 'text-blue-500'   },
          { label: 'Avg. otwarcia',    value: `${avgOpenRate}%`,     icon: Eye,      color: 'text-violet-500' },
          { label: 'Avg. odpowiedzi',  value: `${avgReplyRate}%`,    icon: BarChart2,color: 'text-indigo-500' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-bg-base border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">{kpi.label}</p>
              <kpi.icon size={14} className={kpi.color} />
            </div>
            <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Kampanie ({campaigns.length})</h2>
          <button onClick={refetch} className="text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl">
            <Mail size={32} className="text-text-muted mb-3" />
            <p className="text-sm font-medium text-text-secondary mb-1">Brak kampanii</p>
            <p className="text-xs text-text-muted mb-4">Stwórz pierwszą sekwencję mailową i wyślij do leadów z CRM</p>
            <Button variant="primary" size="sm" onClick={() => setShowBuilder(true)}>
              <Plus size={13} /> Nowa kampania
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onOpen={() => setDetailCampaign(c)}
                onLaunch={() => {}}
                onRefresh={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <CampaignBuilderModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSuccess={refetch}
      />

      <CampaignDetailModal
        campaign={detailCampaign}
        open={!!detailCampaign}
        onClose={() => setDetailCampaign(null)}
        onRefresh={refetch}
      />
    </div>
  );
}
