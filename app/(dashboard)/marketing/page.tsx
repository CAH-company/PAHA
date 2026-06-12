'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Mail, Send, Pause, Play, Trash2, Eye, ChevronRight,
  Users, CheckCircle2, AlertCircle, Clock, BarChart2, RefreshCw,
  X, ArrowRight, Zap, Edit2, Settings, List, TrendingUp, Info,
} from 'lucide-react';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { EmailCampaign, RecipientStatus, LeadStatus, LeadSource } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: 'Szkic',      color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  active:    { label: 'Aktywna',    color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  paused:    { label: 'Wstrzymana', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  completed: { label: 'Zakończona', color: '#6366f1', bg: '#eef2ff', border: '#a5b4fc' },
};

const RECIPIENT_STATUS_CONFIG: Record<RecipientStatus, { label: string; dot: string }> = {
  pending:      { label: 'Oczekuje',    dot: 'bg-slate-400' },
  active:       { label: 'W sekwencji', dot: 'bg-blue-500'  },
  completed:    { label: 'Zakończono',  dot: 'bg-emerald-500' },
  bounced:      { label: 'Odbitka',     dot: 'bg-red-500'   },
  replied:      { label: 'Odpisał',     dot: 'bg-violet-500' },
  unsubscribed: { label: 'Wypisał się', dot: 'bg-amber-400'  },
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
            <span>dni po poprzednim</span>
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
              {index === 0 ? 'Pierwszy email' : 'Kolejny email'}
            </span>
            {index === 0 && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Wysyłany od razu</span>}
          </div>
          {total > 1 && (
            <button onClick={onRemove} className="text-text-muted hover:text-red-500 transition-colors p-1">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Temat</label>
              <div className="flex gap-1">
                {VARS.map(v => (
                  <button key={v} onClick={() => insertVar('subject', v)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-accent/40 text-accent hover:bg-accent/10 font-mono transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
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
          {filtered.slice(0, 10).map(l => (
            <div key={l.id} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="font-medium text-text-primary truncate max-w-[120px]">{l.name}</span>
              {l.company && <span className="text-text-muted truncate">· {l.company}</span>}
              <span className="ml-auto text-text-muted font-mono text-[10px] flex-shrink-0">{l.email}</span>
            </div>
          ))}
          {filtered.length > 10 && (
            <p className="text-xs text-text-muted pl-3.5">+ {filtered.length - 10} więcej...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Builder Modal ───────────────────────────────────────────────────

const EMPTY_STEP: DraftStep = { subject: '', body_html: '', delay_days: 3 };

function CampaignBuilderModal({ open, onClose, onSuccess, editCampaign }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCampaign?: any;
}) {
  const { leads } = useLeads();
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingIdx, setTestingIdx] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [name, setName] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [stopOnOpen, setStopOnOpen] = useState(false);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [windowEnabled, setWindowEnabled] = useState(false);
  const [windowDays, setWindowDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [windowFrom, setWindowFrom] = useState('09:00');
  const [windowTo, setWindowTo] = useState('17:00');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [steps, setSteps] = useState<DraftStep[]>([{ ...EMPTY_STEP, delay_days: 0 }]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterValue, setFilterValue] = useState('');

  const isEditMode = !!editCampaign;
  const isNonDraftEdit = isEditMode && editCampaign.status !== 'draft';
  const WIZARD_STEPS = isNonDraftEdit
    ? ['Ustawienia', 'Sekwencja', 'Podsumowanie']
    : ['Podstawy', 'Sekwencja', 'Odbiorcy', 'Podsumowanie'];

  // Pre-populate form when editing
  useEffect(() => {
    if (!open) return;
    if (editCampaign) {
      setWizardStep(0);
      setName(editCampaign.name ?? '');
      setFromName(editCampaign.from_name ?? '');
      setFromEmail(editCampaign.from_email ?? '');
      setSignatureHtml(editCampaign.signature_html ?? '');
      setStopOnOpen(editCampaign.stop_on_open ?? false);
      setStopOnReply(editCampaign.stop_on_reply ?? true);
      setDailyLimit(editCampaign.daily_limit ?? 50);
      if (editCampaign.send_window) {
        setWindowEnabled(true);
        setWindowDays(editCampaign.send_window.days ?? [1, 2, 3, 4, 5]);
        setWindowFrom(editCampaign.send_window.from ?? '09:00');
        setWindowTo(editCampaign.send_window.to ?? '17:00');
      } else {
        setWindowEnabled(false);
        setWindowDays([1, 2, 3, 4, 5]);
        setWindowFrom('09:00');
        setWindowTo('17:00');
      }
      if (editCampaign.steps?.length) {
        setSteps(
          [...editCampaign.steps]
            .sort((a: any, b: any) => a.step_order - b.step_order)
            .map((s: any) => ({ subject: s.subject, body_html: s.body_html, delay_days: s.delay_days }))
        );
      }
      if (editCampaign.recipient_filter) {
        setFilterType(editCampaign.recipient_filter.type ?? 'all');
        setFilterValue(editCampaign.recipient_filter.value ?? '');
      }
    } else {
      setWizardStep(0);
    }
  }, [open, editCampaign?.id]);

  const sendTestEmail = async (idx: number) => {
    const step = steps[idx];
    if (!step.subject || !step.body_html) return;
    setTestingIdx(idx); setTestMsg(null);
    const res = await fetch('/api/email-campaigns/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_name: fromName, from_email: fromEmail || 'onboarding@resend.dev', subject: step.subject, body_html: step.body_html }),
    });
    const data = await res.json();
    setTestingIdx(null);
    setTestMsg(res.ok ? { ok: true, text: 'Email testowy wysłany' } : { ok: false, text: data.error ?? 'Błąd wysyłki' });
    setTimeout(() => setTestMsg(null), 5000);
  };

  const resetForm = () => {
    setWizardStep(0); setName(''); setFromName(''); setFromEmail(''); setSignatureHtml('');
    setStopOnOpen(false); setStopOnReply(true);
    setWindowEnabled(false); setWindowDays([1, 2, 3, 4, 5]); setWindowFrom('09:00'); setWindowTo('17:00');
    setDailyLimit(50);
    setSteps([{ ...EMPTY_STEP, delay_days: 0 }]);
    setFilterType('all'); setFilterValue(''); setError('');
    setTestMsg(null);
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

  const canNext = isNonDraftEdit
    ? [
        name.trim() && fromName.trim() && fromEmail.trim(),
        steps.every(s => s.subject.trim() && s.body_html.trim()),
        true,
      ]
    : [
        name.trim() && fromName.trim() && fromEmail.trim(),
        steps.every(s => s.subject.trim() && s.body_html.trim()),
        filteredLeads.length > 0,
      ];

  const handleSave = async (launch: boolean) => {
    setSaving(true); setError('');
    try {
      const payload = {
        name, from_name: fromName, from_email: fromEmail,
        signature_html: signatureHtml.trim() || null,
        stop_on_open: stopOnOpen, stop_on_reply: stopOnReply,
        send_window: windowEnabled
          ? { days: windowDays, from: windowFrom, to: windowTo, tz: 'Europe/Warsaw' }
          : null,
        recipient_filter: { type: filterType, value: filterValue || undefined },
        daily_limit: dailyLimit,
        steps,
      };

      let campaignId: string;

      if (isEditMode) {
        const res = await fetch(`/api/email-campaigns/${editCampaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Błąd zapisu');
        campaignId = editCampaign.id;
      } else {
        const res = await fetch('/api/email-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Błąd zapisu');
        campaignId = data.id;
      }

      if (launch) {
        const lr = await fetch(`/api/email-campaigns/${campaignId}/launch`, { method: 'POST' });
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

  const summaryStep = WIZARD_STEPS.length - 1;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditMode ? `Edytuj kampanię` : 'Nowa kampania mailowa'}
      size="xl"
    >
      <div className="flex flex-col h-[72vh]">
        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-0 border-b border-border flex-shrink-0">
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

          {/* Settings / Podstawy — step 0 */}
          {wizardStep === 0 && (
            <div className="space-y-4">
              {isNonDraftEdit && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Kampania jest <strong>{STATUS_CONFIG[editCampaign.status]?.label}</strong>. Możesz edytować ustawienia i sekwencję — zmiany w krokach obowiązują od następnego wysyłki dla każdego odbiorcy.</span>
                </div>
              )}
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
                    placeholder='np. dominik@twojadomena.pl' type="email"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">Wizytówka / stopka</label>
                <textarea
                  value={signatureHtml}
                  onChange={e => setSignatureHtml(e.target.value)}
                  rows={3}
                  placeholder={`np. Dominik Nowak\nCEO · AutomationHub\n+48 500 000 000`}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono leading-relaxed"
                />
                <p className="text-[10px] text-text-muted mt-1">Opcjonalne. Pojawi się między treścią a linkiem wypisania.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">Warunki zatrzymania sekwencji</label>
                <div className="space-y-2">
                  {[
                    { id: 'stop-open',  label: 'Zatrzymaj gdy odbiorca otworzy email',       value: stopOnOpen,  set: setStopOnOpen  },
                    { id: 'stop-reply', label: 'Zatrzymaj gdy odbiorca odpowie na email',     value: stopOnReply, set: setStopOnReply },
                  ].map(opt => (
                    <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong cursor-pointer transition-colors">
                      <input type="checkbox" checked={opt.value} onChange={e => opt.set(e.target.checked)}
                        className="w-4 h-4 accent-accent" />
                      <span className="text-sm text-text-primary">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">Limit dzienny</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min={1} max={500}
                    value={dailyLimit}
                    onChange={e => setDailyLimit(Math.max(1, Number(e.target.value)))}
                    className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-sm text-text-muted">emaili / dzień dla tej kampanii</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">Cron wysyła co godzinę — limit pilnuje żeby nie wysłać wszystkich naraz.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">Okno wysyłki</label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong cursor-pointer transition-colors mb-2">
                  <input type="checkbox" checked={windowEnabled} onChange={e => setWindowEnabled(e.target.checked)}
                    className="w-4 h-4 accent-accent" />
                  <span className="text-sm text-text-primary">Ogranicz dni i godziny wysyłki</span>
                </label>
                {windowEnabled && (
                  <div className="p-3 border border-border rounded-xl space-y-3 bg-bg-subtle">
                    <div>
                      <p className="text-xs text-text-muted mb-2">Dni tygodnia</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { d: 1, label: 'Pon' }, { d: 2, label: 'Wt' }, { d: 3, label: 'Śr' },
                          { d: 4, label: 'Czw' }, { d: 5, label: 'Pt' }, { d: 6, label: 'Sob' }, { d: 0, label: 'Ndz' },
                        ].map(({ d, label }) => {
                          const active = windowDays.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => setWindowDays(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                                active ? 'border-accent bg-accent text-white' : 'border-border text-text-secondary hover:border-border-strong')}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-text-muted block mb-1">Od godziny</label>
                        <input type="time" value={windowFrom} onChange={e => setWindowFrom(e.target.value)}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-text-muted block mb-1">Do godziny</label>
                        <input type="time" value={windowTo} onChange={e => setWindowTo(e.target.value)}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30" />
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted">Strefa: Europa/Warszawa</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sequence — step 1 */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">Pierwszy email wysyłamy od razu, kolejne po zadanym opóźnieniu.</p>
              <div className="flex items-center gap-2 p-3 bg-bg-subtle border border-border rounded-xl">
                <span className="text-xs text-text-muted">Test wyśle email na Twój adres konta.</span>
                {testMsg && (
                  <span className={cn('ml-auto text-xs px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0',
                    testMsg.ok ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50')}>
                    {testMsg.text}
                  </span>
                )}
              </div>
              {steps.map((step, i) => (
                <div key={i}>
                  <StepEditor step={step} index={i} total={steps.length}
                    onChange={s => updateStep(i, s)}
                    onRemove={() => removeStep(i)} />
                  <button
                    onClick={() => sendTestEmail(i)}
                    disabled={testingIdx === i || !step.subject || !step.body_html}
                    className="mt-2 ml-auto flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
                    {testingIdx === i
                      ? <><span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Wysyłam...</>
                      : <><Send size={11} /> Wyślij ten krok testowo</>}
                  </button>
                </div>
              ))}
              {steps.length < 5 && (
                <button onClick={addStep}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-sm text-text-muted hover:border-accent hover:text-accent transition-colors">
                  <Plus size={14} /> Dodaj kolejny email
                </button>
              )}
            </div>
          )}

          {/* Recipients — step 2 (only new campaigns and draft edit) */}
          {wizardStep === 2 && !isNonDraftEdit && (
            <RecipientSelector
              leads={leads}
              filterType={filterType}
              filterValue={filterValue}
              onFilterChange={(t, v) => { setFilterType(t); setFilterValue(v); }}
            />
          )}

          {/* Summary — last step */}
          {wizardStep === summaryStep && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Kampania', value: name || '—' },
                  { label: 'Nadawca', value: fromName ? `${fromName} <${fromEmail}>` : fromEmail || '—' },
                  { label: 'Odbiorcy', value: isNonDraftEdit
                    ? `${editCampaign.total_recipients ?? 0} leadów (bez zmian)`
                    : `${filteredLeads.length} leadów` },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-bg-subtle border border-border rounded-xl">
                    <p className="text-xs text-text-muted mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-text-primary truncate" title={item.value}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Sekwencja — {steps.length} krok{steps.length === 1 ? '' : steps.length < 5 ? 'i' : 'ów'}
                </p>
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-bg-subtle border border-border rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{s.subject || <span className="italic text-text-muted">Brak tematu</span>}</p>
                        <p className="text-xs text-text-muted">{i === 0 ? 'Wysyłany od razu' : `po ${s.delay_days} dniach`}</p>
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-subtle flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={wizardStep === 0 ? handleClose : () => setWizardStep(s => s - 1)}>
            {wizardStep === 0 ? 'Anuluj' : 'Wstecz'}
          </Button>
          <div className="flex gap-2">
            {wizardStep < summaryStep ? (
              <Button variant="primary" size="sm"
                disabled={!canNext[wizardStep]}
                onClick={() => setWizardStep(s => s + 1)}>
                Dalej <ArrowRight size={13} />
              </Button>
            ) : isEditMode ? (
              <Button variant="primary" size="sm" disabled={saving} onClick={() => handleSave(false)}>
                {saving ? <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Zapisuję...
                </span> : 'Zapisz zmiany'}
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

type DetailTab = 'stats' | 'recipients' | 'sequence';

function CampaignDetailModal({ campaign, open, onClose, onRefresh, onEdit }: {
  campaign: EmailCampaign | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('stats');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/email-campaigns/${id}`);
    if (res.ok) setDetail(await res.json());
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    if (open && campaign) {
      setDetail(null);
      setActiveTab('stats');
      loadDetail(campaign.id);
    } else if (!open) {
      setDetail(null);
    }
  }, [open, campaign?.id]);

  const handlePauseToggle = async () => {
    if (!campaign) return;
    setActionLoading(true);
    await fetch(`/api/email-campaigns/${campaign.id}/pause`, { method: 'POST' });
    setActionLoading(false);
    onRefresh();
    await loadDetail(campaign.id);
  };

  const handleProcess = async () => {
    setActionLoading(true);
    await fetch('/api/email-campaigns/process', { method: 'POST' });
    setActionLoading(false);
    onRefresh();
    if (campaign) await loadDetail(campaign.id);
  };

  const handleReset = async () => {
    if (!campaign) return;
    setActionLoading(true);
    setResetConfirm(false);
    const res = await fetch(`/api/email-campaigns/${campaign.id}/reset`, { method: 'POST' });
    const msg = res.ok ? 'Kampania zresetowana — cron wyśle emaile przy najbliższym uruchomieniu.' : 'Błąd resetowania';
    setResetMsg(msg);
    setTimeout(() => setResetMsg(null), 6000);
    setActionLoading(false);
    onRefresh();
    await loadDetail(campaign.id);
  };

  const cfg = campaign ? STATUS_CONFIG[campaign.status] : null;

  const tabs: { id: DetailTab; label: string; icon: any }[] = [
    { id: 'stats',      label: 'Statystyki',                      icon: TrendingUp },
    { id: 'recipients', label: `Odbiorcy (${detail?.recipients?.length ?? campaign?.total_recipients ?? 0})`, icon: Users },
    { id: 'sequence',   label: `Sekwencja (${detail?.steps?.length ?? campaign?.steps?.length ?? 0})`,        icon: List  },
  ];

  return (
    <Modal open={open} onClose={onClose} title="" className="!max-w-3xl" hideClose>
      {campaign && (
        <div className="flex flex-col h-[78vh]">

          {/* ── Nagłówek ── */}
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 flex-shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-text-primary truncate">{campaign.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ color: cfg!.color, background: cfg!.bg, border: `1px solid ${cfg!.border}` }}>
                  {cfg!.label}
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono mt-0.5 truncate">{campaign.from_name} &lt;{campaign.from_email}&gt;</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:border-border-strong hover:text-text-primary transition-colors">
                <Edit2 size={12} /> Edytuj
              </button>
              <button onClick={onClose}
                className="p-1.5 rounded-md border border-border hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Pasek akcji ── */}
          {(campaign.status === 'active' || campaign.status === 'paused') && (
            <div className="px-6 pb-3 flex-shrink-0">
              {!resetConfirm ? (
                <div className="flex items-center gap-2 p-3 bg-bg-subtle border border-border rounded-xl">
                  {campaign.status === 'active' && (
                    <button onClick={handlePauseToggle} disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50">
                      <Pause size={12} /> Wstrzymaj
                    </button>
                  )}
                  {campaign.status === 'paused' && (
                    <button onClick={handlePauseToggle} disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50">
                      <Play size={12} /> Wznów
                    </button>
                  )}
                  <button onClick={handleProcess} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-bg-base text-text-secondary text-xs font-medium hover:border-border-strong hover:text-text-primary transition-colors disabled:opacity-50">
                    <RefreshCw size={12} className={actionLoading ? 'animate-spin' : ''} />
                    Wyślij zaległe teraz
                  </button>
                  <button onClick={() => setResetConfirm(true)} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50">
                    <RefreshCw size={12} /> Resetuj kampanię
                  </button>
                  {resetMsg && <span className="ml-auto text-xs text-emerald-600 font-medium">{resetMsg}</span>}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-700 font-medium flex-1">
                    Resetuj kampanię? Wszyscy odbiorcy wrócą do kroku 1 — emaile zostaną wysłane od nowa.
                  </span>
                  <button onClick={handleReset} disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                    Tak, resetuj
                  </button>
                  <button onClick={() => setResetConfirm(false)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-white text-text-secondary text-xs font-medium hover:border-border-strong transition-colors">
                    Anuluj
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border flex-shrink-0" />

          {/* Tabs */}
          <div className="flex gap-0 px-6 border-b border-border flex-shrink-0 -mt-px">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                )}>
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Stats tab */}
            {activeTab === 'stats' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Wysłane',     value: campaign.sent_count,       icon: Send,         color: 'text-blue-500',    pct: false },
                    { label: 'Dostarczono', value: campaign.delivered_count,  icon: CheckCircle2, color: 'text-emerald-400', pct: true  },
                    { label: 'Otwarte',     value: campaign.opened_count,     icon: Eye,          color: 'text-emerald-600', pct: true  },
                    { label: 'Kliknięcia',  value: campaign.clicked_count,    icon: BarChart2,    color: 'text-indigo-500',  pct: true  },
                    { label: 'Odpowiedzi',  value: campaign.replied_count,    icon: CheckCircle2, color: 'text-violet-500',  pct: true  },
                    { label: 'Odbitki',     value: campaign.bounced_count,    icon: AlertCircle,  color: 'text-red-400',     pct: true  },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-bg-subtle border border-border rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <stat.icon size={14} className={stat.color} />
                        {stat.pct && campaign.sent_count > 0 && (
                          <span className="text-xs text-text-muted">{Math.round((stat.value / campaign.sent_count) * 100)}%</span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                      <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {campaign.total_recipients > 0 && campaign.status !== 'draft' && (
                  <div className="p-4 bg-bg-subtle border border-border rounded-xl">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-text-secondary">Postęp wysyłki</span>
                      <span className="font-semibold text-text-primary">
                        {campaign.sent_count} / {campaign.total_recipients}
                        <span className="text-text-muted font-normal ml-1">({Math.round((campaign.sent_count / campaign.total_recipients) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-base rounded-full overflow-hidden border border-border">
                      <div className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${Math.round((campaign.sent_count / campaign.total_recipients) * 100)}%` }} />
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Ustawienia kampanii</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-bg-subtle text-text-secondary border border-border">
                      Limit: {(campaign as any).daily_limit ?? 50} emaili/dzień
                    </span>
                    {campaign.stop_on_open  && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Stop po otwarciu</span>}
                    {campaign.stop_on_reply && <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Stop po odpowiedzi</span>}
                    {campaign.send_window   && (() => {
                      const DAY = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
                      const days = campaign.send_window.days.sort((a: number, b: number) => a - b).map((d: number) => DAY[d]).join(', ');
                      return (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {days} · {campaign.send_window.from}–{campaign.send_window.to}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-text-muted mt-2">Zmień limit i okno wysyłki klikając <strong>Edytuj</strong>.</p>
                </div>
              </div>
            )}

            {/* Recipients tab */}
            {activeTab === 'recipients' && (
              <div>
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm min-w-[580px]">
                      <thead>
                        <tr className="bg-bg-subtle border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted whitespace-nowrap">Lead</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted whitespace-nowrap">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted whitespace-nowrap">Status</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted whitespace-nowrap">Krok</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted whitespace-nowrap">Następna wysyłka</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(detail?.recipients ?? []).slice(0, 50).map((r: any) => {
                          const rCfg = RECIPIENT_STATUS_CONFIG[r.status as RecipientStatus];
                          return (
                            <tr key={r.id} className="hover:bg-bg-subtle/60 transition-colors">
                              <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                                {r.lead?.name ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-text-muted font-mono text-xs">{r.lead?.email ?? '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', rCfg?.dot ?? 'bg-slate-300')} />
                                  <span className="text-xs text-text-secondary">{rCfg?.label ?? r.status}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-text-muted">
                                {r.current_step}/{detail?.steps?.length ?? '?'}
                              </td>
                              <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                                {r.next_send_at
                                  ? new Date(r.next_send_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {(detail?.recipients ?? []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">
                              Brak odbiorców
                            </td>
                          </tr>
                        )}
                        {(detail?.recipients ?? []).length > 50 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-center text-xs text-text-muted">
                              Pokazano 50 z {detail.recipients.length} odbiorców
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sequence tab */}
            {activeTab === 'sequence' && (
              <div className="space-y-3">
                {loadingDetail && !detail ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  (detail?.steps ?? campaign.steps ?? [])
                    .sort((a: any, b: any) => a.step_order - b.step_order)
                    .map((s: any, i: number, arr: any[]) => (
                      <div key={s.id ?? i}>
                        {i > 0 && (
                          <div className="flex items-center gap-2 my-2 pl-4 text-xs text-text-muted">
                            <div className="w-px h-5 bg-border ml-3" />
                            <Clock size={11} />
                            <span>po {s.delay_days} dniach</span>
                          </div>
                        )}
                        <div className="border border-border rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-bg-subtle border-b border-border">
                            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <p className="text-sm font-semibold text-text-primary truncate flex-1">{s.subject}</p>
                            {i === 0 && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">Od razu</span>}
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-xs text-text-muted font-mono whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {s.body_html}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                )}
                {(detail?.steps ?? campaign.steps ?? []).length === 0 && (
                  <p className="text-sm text-text-muted text-center py-10">Brak kroków sekwencji</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onOpen, onEdit, onRefresh }: {
  campaign: EmailCampaign;
  onOpen: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [pausing, setPausing] = useState(false);
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

  const handlePauseToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPausing(true);
    await fetch(`/api/email-campaigns/${campaign.id}/pause`, { method: 'POST' });
    setPausing(false);
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Usunąć kampanię? Tej operacji nie można cofnąć.')) return;
    setDeleting(true);
    await fetch(`/api/email-campaigns/${campaign.id}`, { method: 'DELETE' });
    setDeleting(false);
    onRefresh();
  };

  return (
    <div
      onClick={onOpen}
      className="bg-bg-base border border-border rounded-xl p-5 hover:border-accent/50 hover:shadow-sm transition-all cursor-pointer">

      <div className="flex items-start gap-4">
        {/* Status strip */}
        <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
          style={{ background: cfg.color, opacity: 0.6 }} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="text-sm font-semibold text-text-primary">{campaign.name}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                <span className="font-mono">{campaign.from_name} &lt;{campaign.from_email}&gt;</span>
                {stepsCount > 0 && <span className="text-border mx-1.5">·</span>}
                {stepsCount > 0 && <span>{stepsCount} krok{stepsCount === 1 ? '' : stepsCount < 5 ? 'i' : 'ów'}</span>}
                {campaign.total_recipients > 0 && <span className="text-border mx-1.5">·</span>}
                {campaign.total_recipients > 0 && <span>{campaign.total_recipients} odbiorców</span>}
              </p>
            </div>

            {/* Action buttons — always visible */}
            <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {campaign.status === 'draft' && (
                <button onClick={handleLaunch} disabled={launching}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-60">
                  {launching
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Send size={11} /> Uruchom</>}
                </button>
              )}
              {campaign.status === 'active' && (
                <button onClick={handlePauseToggle} disabled={pausing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
                  title="Wstrzymaj kampanię">
                  {pausing
                    ? <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                    : <><Pause size={11} /> Wstrzymaj</>}
                </button>
              )}
              {campaign.status === 'paused' && (
                <button onClick={handlePauseToggle} disabled={pausing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                  title="Wznów kampanię">
                  {pausing
                    ? <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                    : <><Play size={11} /> Wznów</>}
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                title="Edytuj kampanię">
                <Edit2 size={13} />
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
                title="Usuń kampanię">
                {deleting
                  ? <span className="w-3 h-3 border-2 border-slate-300/30 border-t-slate-500 rounded-full animate-spin block" />
                  : <Trash2 size={13} />}
              </button>
            </div>
          </div>

          {/* Progress bar for non-draft */}
          {campaign.status !== 'draft' && campaign.total_recipients > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{campaign.sent_count} / {campaign.total_recipients} wysłanych</span>
                <span className="font-semibold text-text-primary">{sentPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${sentPct}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs pt-0.5">
                <span className="text-emerald-600 font-medium">{openRate}% otwarte</span>
                {campaign.replied_count > 0 && (
                  <span className="text-violet-600">{campaign.replied_count} odpowiedzi</span>
                )}
                {campaign.bounced_count > 0 && (
                  <span className="text-red-500">{campaign.bounced_count} odbitek</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { campaigns, loading, refetch } = useEmailCampaigns();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [detailCampaign, setDetailCampaign] = useState<EmailCampaign | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const pausedCampaigns = campaigns.filter(c => c.status === 'paused').length;
  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);

  const handleOpenEdit = async (campaignId: string) => {
    setLoadingEdit(campaignId);
    const res = await fetch(`/api/email-campaigns/${campaignId}`);
    if (res.ok) {
      const data = await res.json();
      setEditingCampaign(data);
      setDetailCampaign(null);
      setShowBuilder(true);
    }
    setLoadingEdit(null);
  };

  const handleCloseBuilder = () => {
    setShowBuilder(false);
    setEditingCampaign(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Email Outreach</h1>
          <p className="text-xs text-text-muted mt-0.5">Sekwencje mailowe · śledzenie otwarć · personalizacja</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditingCampaign(null); setShowBuilder(true); }}>
          <Plus size={14} /> Nowa kampania
        </Button>
      </div>

      {/* Summary strip */}
      {campaigns.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-bg-subtle border border-border rounded-xl text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-emerald-500" />
            <span className="text-text-muted">Aktywne:</span>
            <strong className="text-text-primary">{activeCampaigns}</strong>
          </div>
          {pausedCampaigns > 0 && (
            <>
              <span className="text-border">·</span>
              <div className="flex items-center gap-2">
                <Pause size={13} className="text-amber-500" />
                <span className="text-text-muted">Wstrzymane:</span>
                <strong className="text-text-primary">{pausedCampaigns}</strong>
              </div>
            </>
          )}
          <span className="text-border">·</span>
          <div className="flex items-center gap-2">
            <Send size={13} className="text-blue-500" />
            <span className="text-text-muted">Wysłano łącznie:</span>
            <strong className="text-text-primary">{totalSent.toLocaleString('pl-PL')}</strong>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Kampanie
            <span className="ml-2 text-xs font-normal text-text-muted">({campaigns.length})</span>
          </h2>
          <button onClick={refetch}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors p-1.5 rounded hover:bg-bg-subtle">
            <RefreshCw size={13} /> Odśwież
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-bg-subtle border border-border flex items-center justify-center mb-4">
              <Mail size={22} className="text-text-muted" />
            </div>
            <p className="text-sm font-semibold text-text-secondary mb-1">Brak kampanii</p>
            <p className="text-xs text-text-muted mb-5 text-center max-w-xs">
              Stwórz pierwszą sekwencję mailową i wyślij do leadów z CRM
            </p>
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
                onEdit={() => handleOpenEdit(c.id)}
                onRefresh={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <CampaignBuilderModal
        open={showBuilder}
        onClose={handleCloseBuilder}
        onSuccess={() => { refetch(); handleCloseBuilder(); }}
        editCampaign={editingCampaign}
      />

      <CampaignDetailModal
        campaign={detailCampaign}
        open={!!detailCampaign}
        onClose={() => setDetailCampaign(null)}
        onRefresh={refetch}
        onEdit={() => detailCampaign && handleOpenEdit(detailCampaign.id)}
      />

      {/* Loading overlay for edit fetch */}
      {loadingEdit && (
        <div className="fixed inset-0 z-[998] bg-black/20 flex items-center justify-center">
          <div className="bg-bg-base border border-border rounded-xl px-5 py-3 flex items-center gap-3 shadow-xl">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-primary">Ładowanie kampanii...</span>
          </div>
        </div>
      )}
    </div>
  );
}
