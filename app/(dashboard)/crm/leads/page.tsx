'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  LayoutGrid, List, Search, Plus, Upload,
  ChevronUp, ChevronDown, MoreHorizontal, Filter, Trash2, UserCheck,
} from 'lucide-react';
import { cn, formatDate, formatTimeAgo, LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, SOURCE_LABELS } from '@/lib/utils';
import { useLeads } from '@/hooks/useLeads';
import { useEmployees } from '@/hooks/useEmployees';
import { createClient } from '@/lib/supabase/client';
import type { Lead, LeadStatus, ContactStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { LeadStatusBadge } from '@/components/crm/LeadStatusBadge';
import { LeadSidePanel } from '@/components/crm/LeadSidePanel';
import { LeadKanban } from '@/components/crm/LeadKanban';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// ─── CONTACT STATUS ───────────────────────────────────────────────────────────
const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; dot: string }> = {
  not_contacted: { label: 'Nie kontaktowano', color: '#94a3b8', dot: 'bg-slate-300' },
  in_sequence:   { label: 'W sekwencji',      color: '#3b82f6', dot: 'bg-blue-500' },
  replied:       { label: 'Odpowiedział',      color: '#10b981', dot: 'bg-emerald-500' },
  bounced:       { label: 'Odbitka',           color: '#ef4444', dot: 'bg-red-500' },
  unsubscribed:  { label: 'Wypisał się',       color: '#f59e0b', dot: 'bg-amber-400' },
  meeting_booked:{ label: 'Spotkanie',         color: '#8b5cf6', dot: 'bg-violet-500' },
};

function ContactBadge({ status }: { status: ContactStatus }) {
  const cfg = CONTACT_STATUS_CONFIG[status] ?? CONTACT_STATUS_CONFIG.not_contacted;
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}

// ─── ADD LEAD MODAL ───────────────────────────────────────────────────────────
const EMPTY_LEAD = {
  name: '', company: '', company_size: '', email: '', phone: '', address: '',
  source: 'manual' as const, status: 'new' as LeadStatus,
  contact_status: 'not_contacted' as ContactStatus,
  owner_id: '', notes: '',
};

function AddLeadModal({ open, onClose, ownerOptions, onSuccess }: {
  open: boolean; onClose: () => void;
  ownerOptions: { value: string; label: string }[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(EMPTY_LEAD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof EMPTY_LEAD, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Podaj imię i nazwisko'); return; }
    setSaving(true); setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('leads').insert({
      name: form.name.trim(),
      company: form.company.trim() || null,
      company_size: form.company_size.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      source: form.source,
      status: form.status,
      contact_status: form.contact_status,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
      tags: [],
      is_archived: false,
      currency: 'PLN',
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY_LEAD);
    onSuccess();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Dodaj lead" size="lg">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię i Nazwisko *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jan Kowalski" />
          <Input label="Firma" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Nazwa firmy" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jan@firma.pl" />
          <Input label="Telefon" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+48 500 000 000" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Adres" value={form.address} onChange={e => set('address', e.target.value)} placeholder="ul. Przykładowa 1, Warszawa" />
          <Input label="Wielkość firmy" value={form.company_size} onChange={e => set('company_size', e.target.value)} placeholder="np. 11-50 pracowników" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Źródło" value={form.source} onChange={e => set('source', e.target.value)}
            options={[
              { value: 'manual', label: 'Ręczny' }, { value: 'csv', label: 'Import CSV' },
              { value: 'lemlist', label: 'Lemlist' }, { value: 'clay', label: 'Clay' }, { value: 'form', label: 'Formularz' },
            ]} />
          <Select label="Status pipeline" value={form.status} onChange={e => set('status', e.target.value as LeadStatus)}
            options={[
              { value: 'new', label: 'Nowy' }, { value: 'contacted', label: 'Kontakt' },
              { value: 'offer_sent', label: 'Oferta wysłana' }, { value: 'negotiation', label: 'Negocjacje' },
              { value: 'won', label: 'Wygrany' }, { value: 'lost', label: 'Przegrany' },
              { value: 'wrong_form', label: 'Źle wypełniony formularz' }, { value: 'mistake', label: 'Pomyłka' },
            ]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status kontaktu" value={form.contact_status} onChange={e => set('contact_status', e.target.value as ContactStatus)}
            options={Object.entries(CONTACT_STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
          <Select label="Opiekun" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
            options={[{ value: '', label: 'Brak opiekuna' }, ...ownerOptions]} />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Notatka</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Dodatkowe informacje..."
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Zapisuję…' : 'Dodaj lead'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
type ViewMode = 'table' | 'kanban';
type SortKey = 'name' | 'status' | 'created_at' | 'contact_status';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: '', label: 'Wszystkie statusy' },
  { value: 'new', label: 'Nowy' },
  { value: 'contacted', label: 'Kontakt' },
  { value: 'offer_sent', label: 'Oferta wysłana' },
  { value: 'negotiation', label: 'Negocjacje' },
  { value: 'won', label: 'Wygrany' },
  { value: 'lost', label: 'Przegrany' },
  { value: 'wrong_form', label: 'Źle wypełniony formularz' },
  { value: 'mistake', label: 'Pomyłka' },
];

const CONTACT_STATUS_OPTIONS = [
  { value: '', label: 'Wszystkie kontakty' },
  ...Object.entries(CONTACT_STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label })),
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Wszystkie źródła' },
  { value: 'manual', label: 'Ręczny' },
  { value: 'csv', label: 'Import CSV' },
  { value: 'lemlist', label: 'Lemlist' },
  { value: 'clay', label: 'Clay' },
  { value: 'form', label: 'Formularz' },
  { value: 'meta', label: 'Meta Ads' },
];

export default function LeadsPage() {
  const { leads, loading, refetch } = useLeads();
  const { employees } = useEmployees();
  const [view, setView] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterContactStatus, setFilterContactStatus] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [panelEditMode, setPanelEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const OWNER_OPTIONS = useMemo(() =>
    employees.map(e => ({ value: e.id, label: e.name })),
  [employees]);

  const filtered = useMemo(() => {
    let list = [...leads];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      );
    }
    if (filterStatus) list = list.filter(l => l.status === filterStatus);
    if (filterContactStatus) list = list.filter(l => l.contact_status === filterContactStatus);
    if (filterOwner) list = list.filter(l => l.owner_id === filterOwner);
    if (filterSource) list = list.filter(l => l.source === filterSource);

    list.sort((a, b) => {
      const av = ((a[sortKey as keyof Lead] as string) ?? '').toString().toLowerCase();
      const bv = ((b[sortKey as keyof Lead] as string) ?? '').toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [leads, search, filterStatus, filterContactStatus, filterOwner, filterSource, sortKey, sortDir]);

  const handleArchive = useCallback(async (id: string) => {
    setOpenMenu(null);
    const supabase = createClient();
    await supabase.from('leads').update({ is_archived: true }).eq('id', id);
    refetch();
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-text-muted opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-accent" />
      : <ChevronDown size={12} className="text-accent" />;
  };

  const activeFilters = [filterStatus, filterContactStatus, filterOwner, filterSource].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-bg-muted rounded-lg p-0.5">
            <button onClick={() => setView('table')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'table' ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary')}
              title="Tabela"><List size={15} /></button>
            <button onClick={() => setView('kanban')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'kanban' ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary')}
              title="Kanban"><LayoutGrid size={15} /></button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj leadów..."
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 w-56" />
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={cn(activeFilters > 0 && 'border-accent/50 text-accent')}>
            <Filter size={13} />
            Filtry
            {activeFilters > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-accent text-white text-[9px] flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </Button>

          <span className="text-sm text-text-muted">{filtered.length} rekordów</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Upload size={13} /> Import CSV</Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Dodaj lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-3 p-3 bg-bg-subtle border border-border rounded-lg flex-wrap">
          <Select options={STATUS_OPTIONS} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-44" />
          <Select options={CONTACT_STATUS_OPTIONS} value={filterContactStatus} onChange={e => setFilterContactStatus(e.target.value)} className="w-44" />
          <Select options={[{ value: '', label: 'Wszyscy opiekunowie' }, ...OWNER_OPTIONS]} value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="w-44" />
          <Select options={SOURCE_OPTIONS} value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-36" />
          {activeFilters > 0 && (
            <button onClick={() => { setFilterStatus(''); setFilterContactStatus(''); setFilterOwner(''); setFilterSource(''); }}
              className="text-xs text-text-muted hover:text-text-primary">
              Wyczyść filtry
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {view === 'kanban' ? (
        <LeadKanban leads={filtered} onLeadClick={setSelectedLead} onStatusChange={refetch} />
      ) : (
        <div className="bg-bg-base border border-border rounded-xl min-h-[calc(100vh-220px)] flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  {[
                    { key: 'name',           label: 'Imię i Nazwisko' },
                    { key: 'status',         label: 'Pipeline' },
                    { key: 'contact_status', label: 'Kontakt' },
                    { key: null,             label: 'Opiekun' },
                    { key: null,             label: 'Źródło' },
                    { key: null,             label: 'Ostatnia aktywność' },
                    { key: 'created_at',     label: 'Dodany' },
                    { key: null,             label: '' },
                  ].map(({ key, label }, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                      {key ? (
                        <button className="flex items-center gap-1 hover:text-text-primary transition-colors"
                          onClick={() => handleSort(key as SortKey)}>
                          {label}<SortIcon col={key as SortKey} />
                        </button>
                      ) : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-bg-subtle transition-colors cursor-pointer"
                    onClick={() => { setSelectedLead(lead); setPanelEditMode(false); }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                      {lead.company && <p className="text-xs text-text-muted">{lead.company}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ContactBadge status={lead.contact_status ?? 'not_contacted'} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.owner ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={lead.owner.name} size="xs" />
                          <span className="text-xs text-text-secondary">{lead.owner.name.split(' ')[0]}</span>
                        </div>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-secondary">{SOURCE_LABELS[lead.source]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-muted">
                        {lead.last_activity_at ? formatTimeAgo(lead.last_activity_at) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-muted">{formatDate(lead.created_at)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                          className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                          <MoreHorizontal size={15} />
                        </button>
                        {openMenu === lead.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                              <button className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-subtle flex items-center gap-2"
                                onClick={() => { setSelectedLead(lead); setPanelEditMode(true); setOpenMenu(null); }}>
                                <UserCheck size={13} /> Edytuj lead
                              </button>
                              <div className="border-t border-border" />
                              <button className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => handleArchive(lead.id)}>
                                <Trash2 size={13} /> Archiwizuj
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
                  <Search size={20} className="text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-primary">Brak wyników</p>
                <p className="text-xs text-text-muted mt-1">Zmień kryteria wyszukiwania lub dodaj nowy lead</p>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-text-muted">Wyświetlono {filtered.length} z {leads.length} rekordów</span>
            </div>
          )}
        </div>
      )}

      <LeadSidePanel
        lead={selectedLead}
        onClose={() => { setSelectedLead(null); setPanelEditMode(false); }}
        onUpdate={refetch}
        startInEditMode={panelEditMode}
      />
      <AddLeadModal open={showAddModal} onClose={() => setShowAddModal(false)}
        ownerOptions={OWNER_OPTIONS} onSuccess={refetch} />
    </div>
  );
}
