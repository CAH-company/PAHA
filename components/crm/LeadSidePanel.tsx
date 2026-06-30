'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Phone as PhoneIcon, ArrowRight, Archive, Pencil, Save } from 'lucide-react';
import type { Lead, LeadStatus, ContactStatus } from '@/types';
import { cn, formatDate, formatCurrency, SOURCE_LABELS } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LeadStatusBadge } from './LeadStatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';

const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string; color: string }> = {
  not_contacted: { label: 'Nie kontaktowano', color: '#94a3b8' },
  in_sequence:   { label: 'W sekwencji',      color: '#3b82f6' },
  replied:       { label: 'Odpowiedział',      color: '#10b981' },
  bounced:       { label: 'Odbitka',           color: '#ef4444' },
  unsubscribed:  { label: 'Wypisał się',       color: '#f59e0b' },
  meeting_booked:{ label: 'Spotkanie',         color: '#8b5cf6' },
};

const STATUS_OPTIONS = [
  { value: 'new',          label: 'Nowy' },
  { value: 'contacted',    label: 'Kontakt' },
  { value: 'offer_sent',   label: 'Oferta wysłana' },
  { value: 'negotiation',  label: 'Negocjacje' },
  { value: 'won',          label: 'Wygrany' },
  { value: 'lost',         label: 'Przegrany' },
];

const CONTACT_STATUS_OPTIONS = Object.entries(CONTACT_STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

interface LeadSidePanelProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdate?: () => void;
  startInEditMode?: boolean;
}

type EditForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  status: LeadStatus;
  contact_status: ContactStatus;
  owner_id: string;
  estimated_value: string;
  notes: string;
};

const TABS = ['Info', 'Historia', 'Notatki', 'Przypomnienia'] as const;
type Tab = typeof TABS[number];


export function LeadSidePanel({ lead, onClose, onUpdate, startInEditMode }: LeadSidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Info');
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [note, setNote] = useState('');
  const { employees } = useEmployees();

  useEffect(() => {
    if (!lead) return;
    setSaveError('');
    setActiveTab('Info');
    if (startInEditMode) {
      setForm({
        name:            lead.name,
        company:         lead.company ?? '',
        email:           lead.email ?? '',
        phone:           lead.phone ?? '',
        address:         lead.address ?? '',
        status:          lead.status,
        contact_status:  lead.contact_status,
        owner_id:        lead.owner_id ?? '',
        estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
        notes:           lead.notes ?? '',
      });
      setIsEditing(true);
    } else {
      setIsEditing(false);
      setForm(null);
    }
  }, [lead?.id, startInEditMode]);

  if (!lead) return null;

  const ownerOptions = [
    { value: '', label: 'Brak opiekuna' },
    ...employees.map(e => ({ value: e.id, label: e.name })),
  ];

  const startEdit = () => {
    setForm({
      name:            lead.name,
      company:         lead.company ?? '',
      email:           lead.email ?? '',
      phone:           lead.phone ?? '',
      address:         lead.address ?? '',
      status:          lead.status,
      contact_status:  lead.contact_status,
      owner_id:        lead.owner_id ?? '',
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
      notes:           lead.notes ?? '',
    });
    setSaveError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setForm(null);
    setSaveError('');
  };

  const set = (k: keyof EditForm, v: string) => setForm(f => f ? { ...f, [k]: v } : f);

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim()) { setSaveError('Imię i Nazwisko jest wymagane'); return; }
    setSaving(true);
    setSaveError('');
    const supabase = createClient();
    const { error } = await supabase.from('leads').update({
      name:            form.name.trim(),
      company:         form.company.trim() || null,
      email:           form.email.trim() || null,
      phone:           form.phone.trim() || null,
      address:         form.address.trim() || null,
      status:          form.status,
      contact_status:  form.contact_status,
      owner_id:        form.owner_id || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      notes:           form.notes.trim() || null,
    }).eq('id', lead.id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setIsEditing(false);
    setForm(null);
    onUpdate?.();
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      <div className="fixed right-0 top-14 bottom-0 w-[480px] z-40 bg-bg-base border-l border-border flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-text-primary">{lead.name}</h2>
              <LeadStatusBadge status={lead.status} />
            </div>
            {lead.company && (
              <p className="text-sm text-text-muted mt-0.5">{lead.company}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isEditing && (
              <button
                onClick={startEdit}
                title="Edytuj"
                className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-accent transition-colors"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0 px-5">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'py-2.5 px-1 text-sm font-medium mr-5 border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'Info' && !isEditing && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {lead.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={14} className="text-text-muted flex-shrink-0" />
                    <a href={`mailto:${lead.email}`} className="text-accent hover:text-accent-hover">{lead.email}</a>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={14} className="text-text-muted flex-shrink-0" />
                    <a href={`tel:${lead.phone}`} className="text-text-primary">{lead.phone}</a>
                  </div>
                )}
                {lead.address && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin size={14} className="text-text-muted flex-shrink-0" />
                    <span className="text-text-secondary">{lead.address}</span>
                  </div>
                )}
                {!lead.email && !lead.phone && !lead.address && (
                  <p className="text-xs text-text-muted italic">Brak danych kontaktowych</p>
                )}
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Opiekun</p>
                  {lead.owner ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={lead.owner.name} size="xs" />
                      <span className="text-xs text-text-primary">{lead.owner.name.split(' ')[0]}</span>
                    </div>
                  ) : <span className="text-xs text-text-muted">—</span>}
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Źródło</p>
                  <span className="text-xs text-text-secondary">{SOURCE_LABELS[lead.source]}</span>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Wartość</p>
                  <span className="text-xs font-semibold text-text-primary">
                    {lead.estimated_value ? formatCurrency(lead.estimated_value, lead.currency) : '—'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Dodany</p>
                  <span className="text-xs text-text-secondary">{formatDate(lead.created_at)}</span>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Status kontaktu</p>
                  <span className="text-xs" style={{ color: CONTACT_STATUS_CONFIG[lead.contact_status]?.color }}>
                    {CONTACT_STATUS_CONFIG[lead.contact_status]?.label ?? '—'}
                  </span>
                </div>
              </div>

              {lead.tags.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Tagi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="p-3 bg-bg-subtle rounded-lg">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1.5">Notatka</p>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Info' && isEditing && form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Imię i Nazwisko *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jan Kowalski" />
                <Input label="Firma" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Nazwa firmy" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jan@firma.pl" />
                <Input label="Telefon" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+48 500 000 000" />
              </div>
              <Input label="Adres" value={form.address} onChange={e => set('address', e.target.value)} placeholder="ul. Przykładowa 1, Warszawa" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Status pipeline" value={form.status} onChange={e => set('status', e.target.value as LeadStatus)} options={STATUS_OPTIONS} />
                <Select label="Status kontaktu" value={form.contact_status} onChange={e => set('contact_status', e.target.value as ContactStatus)} options={CONTACT_STATUS_OPTIONS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Opiekun" value={form.owner_id} onChange={e => set('owner_id', e.target.value)} options={ownerOptions} />
                <Input label="Wartość (PLN)" type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Notatka</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Dodatkowe informacje..."
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="flex-1">
                  <Save size={13} />
                  {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  Anuluj
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'Historia' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
                <span className="text-lg">📋</span>
              </div>
              <p className="text-sm font-medium text-text-primary">Brak historii aktywności</p>
              <p className="text-xs text-text-muted mt-1">Aktywności dla tego leadu będą tu zapisywane</p>
            </div>
          )}

          {activeTab === 'Notatki' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Dodaj notatkę..."
                  rows={4}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <Button variant="primary" size="sm" disabled={!note.trim()}>
                  Dodaj notatkę
                </Button>
              </div>
              {!note && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-text-muted">Brak notatek dla tego leadu</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Przypomnienia' && (
            <div className="space-y-4">
              <div className="p-3 bg-accent-subtle rounded-lg border border-accent/20">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-text-primary">Follow-up po ofercie</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Wt, 09.04.2026 godz. 10:00</p>
                  </div>
                  <Badge color="#6366f1">Jutro</Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                + Nowe przypomnienie
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-5 py-3 bg-bg-subtle">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <PhoneIcon size={13} />
              Zarejestruj kontakt
            </Button>
            <Button variant="primary" size="sm" className="flex-1">
              <ArrowRight size={13} />
              Konwertuj na klienta
            </Button>
            <Button variant="ghost" size="icon">
              <Archive size={14} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
