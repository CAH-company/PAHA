'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, RotateCcw, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate, LEAD_STATUS_LABELS, SOURCE_LABELS } from '@/lib/utils';
import { LeadStatusBadge } from '@/components/crm/LeadStatusBadge';
import { Button } from '@/components/ui/button';
import type { Lead, Client } from '@/types';

export default function ArchivePage() {
  const [tab, setTab] = useState<'leads' | 'clients'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadLeads = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('is_archived', true)
      .order('updated_at', { ascending: false });
    setLeads(((data ?? []).map((r: any) => ({ ...r, tags: r.tags ?? [] }))) as unknown as Lead[]);
  }, []);

  const loadClients = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('is_archived', true)
      .order('updated_at', { ascending: false });
    setClients(((data ?? []).map((r: any) => ({ ...r, tags: r.tags ?? [], total_value: r.total_value ?? 0 }))) as unknown as Client[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLeads(), loadClients()]).finally(() => setLoading(false));
  }, [loadLeads, loadClients]);

  const restoreLead = async (id: string) => {
    setRestoring(id);
    const supabase = createClient();
    await supabase.from('leads').update({ is_archived: false }).eq('id', id);
    await loadLeads();
    setRestoring(null);
  };

  const restoreClient = async (id: string) => {
    setRestoring(id);
    const supabase = createClient();
    await supabase.from('clients').update({ is_archived: false }).eq('id', id);
    await loadClients();
    setRestoring(null);
  };

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q);
  });

  const filteredClients = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const currentCount = tab === 'leads' ? filteredLeads.length : filteredClients.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Archiwum</h1>
        <span className="text-sm text-text-muted">{currentCount} rekordów</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
          {(['leads', 'clients'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(''); }}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === t ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary')}>
              {t === 'leads' ? `Leady (${leads.length})` : `Klienci (${clients.length})`}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj w archiwum..."
            className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
          {tab === 'leads' && (
            filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
                  <Archive size={20} className="text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-primary">Brak zarchiwizowanych leadów</p>
                <p className="text-xs text-text-muted mt-1">Zarchiwizowane leady pojawią się tutaj</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-subtle">
                    {['Imię i Nazwisko', 'Status', 'Źródło', 'Email', 'Telefon', 'Data dodania', ''].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-bg-subtle transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                        {lead.company && <p className="text-xs text-text-muted">{lead.company}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{SOURCE_LABELS[lead.source]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{lead.email ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{lead.phone ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-muted">{formatDate(lead.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreLead(lead.id)}
                          disabled={restoring === lead.id}
                        >
                          <RotateCcw size={12} />
                          {restoring === lead.id ? '…' : 'Przywróć'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'clients' && (
            filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
                  <Archive size={20} className="text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-primary">Brak zarchiwizowanych klientów</p>
                <p className="text-xs text-text-muted mt-1">Zarchiwizowani klienci pojawią się tutaj</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-subtle">
                    {['Imię i Nazwisko', 'Firma', 'Email', 'Telefon', 'Data dodania', ''].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-bg-subtle transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{client.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{client.company ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{client.email ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-secondary">{client.phone ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-muted">{formatDate(client.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreClient(client.id)}
                          disabled={restoring === client.id}
                        >
                          <RotateCcw size={12} />
                          {restoring === client.id ? '…' : 'Przywróć'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
