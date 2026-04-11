'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, Mail, Phone, Building2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useEmployees } from '@/hooks/useEmployees';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { CLIENT_STATUS_LABELS } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ClientStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  needs_attention: '#f59e0b',
  closed: '#94a3b8',
};

// ─── ADD CLIENT MODAL ─────────────────────────────────────────────────────────
const EMPTY = {
  name: '', company: '', email: '', phone: '', address: '',
  nip: '', regon: '', contract_number: '', contract_date: '',
  status: 'active' as ClientStatus,
  owner_id: '', notes: '',
};

function AddClientModal({ open, onClose, ownerOptions, onSuccess }: {
  open: boolean; onClose: () => void;
  ownerOptions: { value: string; label: string }[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Podaj imię i nazwisko lub nazwę klienta'); return; }
    setSaving(true); setError('');
    const supabase = createSupabaseClient();
    const { error: err } = await supabase.from('clients').insert({
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      nip: form.nip.trim() || null,
      regon: form.regon.trim() || null,
      contract_number: form.contract_number.trim() || null,
      contract_date: form.contract_date || null,
      status: form.status,
      owner_id: form.owner_id || null,
      total_value: 0,
      currency: 'PLN',
      notes: form.notes.trim() || null,
      tags: [],
      is_archived: false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY);
    onSuccess();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Dodaj klienta" size="lg">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię i Nazwisko *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jan Kowalski" />
          <Input label="Firma" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Sp. z o.o." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jan@firma.pl" />
          <Input label="Telefon" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+48 500 000 000" />
        </div>
        <Input label="Adres" value={form.address} onChange={e => set('address', e.target.value)} placeholder="ul. Przykładowa 1, Warszawa" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="NIP" value={form.nip} onChange={e => set('nip', e.target.value)} placeholder="000-000-00-00" />
          <Input label="REGON" value={form.regon} onChange={e => set('regon', e.target.value)} placeholder="000000000" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nr umowy" value={form.contract_number} onChange={e => set('contract_number', e.target.value)} placeholder="UMW/2025/001" />
          <Input label="Data umowy" type="date" value={form.contract_date} onChange={e => set('contract_date', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={e => set('status', e.target.value as ClientStatus)}
            options={[
              { value: 'active', label: 'Aktywny' },
              { value: 'needs_attention', label: 'Wymaga uwagi' },
              { value: 'closed', label: 'Zamknięty' },
            ]} />
          <Select label="Opiekun" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
            options={[{ value: '', label: 'Brak opiekuna' }, ...ownerOptions]} />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Notatki</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Dodatkowe informacje..."
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Zapisuję…' : 'Dodaj klienta'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const { clients, loading, refetch } = useClients();
  const { employees } = useEmployees();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const ownerOptions = useMemo(() =>
    employees.map(e => ({ value: e.id, label: e.name })),
  [employees]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.includes(q)
    );
  }, [clients, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj klientów..."
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-base focus:outline-none focus:ring-2 focus:ring-accent/30 w-56" />
          </div>
          <span className="text-sm text-text-muted">{filtered.length} klientów</span>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Dodaj klienta
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(client => (
          <div key={client.id} className="bg-bg-base border border-border rounded-xl p-4 hover:border-border-strong transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={client.name} size="md" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{client.name}</h3>
                  {client.company && (
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <Building2 size={10} /> {client.company}
                    </p>
                  )}
                </div>
              </div>
              <Badge color={STATUS_COLORS[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
            </div>

            <div className="space-y-1.5 mb-3">
              {client.email && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Mail size={11} className="text-text-muted flex-shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Phone size={11} className="text-text-muted flex-shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                {client.owner && <Avatar name={client.owner.name} size="xs" />}
                {client.owner && <span className="text-xs text-text-muted">{client.owner.name.split(' ')[0]}</span>}
              </div>
              <Link href={`/crm/clients/${client.id}`}
                className="text-xs text-accent hover:text-accent-hover font-medium px-2 py-1">
                Szczegóły →
              </Link>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <p className="text-sm text-text-muted">Brak klientów. Dodaj pierwszego!</p>
          </div>
        )}
      </div>

      <AddClientModal open={showAdd} onClose={() => setShowAdd(false)}
        ownerOptions={ownerOptions} onSuccess={refetch} />
    </div>
  );
}
