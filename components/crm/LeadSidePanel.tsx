'use client';

import { useState } from 'react';
import { X, Mail, Phone, MapPin, Tag, User, DollarSign, Calendar, Phone as PhoneIcon, ArrowRight, Archive } from 'lucide-react';
import type { Lead } from '@/types';
import { cn, formatDate, formatTimeAgo, formatCurrency, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, SOURCE_LABELS } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeadStatusBadge } from './LeadStatusBadge';

interface LeadSidePanelProps {
  lead: Lead | null;
  onClose: () => void;
}

const TABS = ['Info', 'Historia', 'Notatki', 'Przypomnienia'] as const;
type Tab = typeof TABS[number];

const MOCK_ACTIVITIES = [
  { id: '1', type: 'note', content: 'Klient zainteresowany pakietem Enterprise. Prosi o szczegółowy kosztorys.', author: 'Dominik Kowalski', at: '2026-04-01T14:00:00Z' },
  { id: '2', type: 'call', content: 'Rozmowa telefoniczna — 15 minut. Omówiono zakres wdrożenia.', author: 'Dominik Kowalski', at: '2026-03-28T11:30:00Z' },
  { id: '3', type: 'email', content: 'Wysłano prezentację ofertową.', author: 'Dominik Kowalski', at: '2026-03-25T09:00:00Z' },
  { id: '4', type: 'status_change', content: 'Status zmieniony: Nowy → Kontakt', author: 'Dominik Kowalski', at: '2026-03-20T10:00:00Z' },
];

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  note: { icon: '📝', color: '#6366f1' },
  call: { icon: '📞', color: '#10b981' },
  email: { icon: '✉️', color: '#3b82f6' },
  meeting: { icon: '🤝', color: '#f59e0b' },
  status_change: { icon: '🔄', color: '#8b5cf6' },
};

export function LeadSidePanel({ lead, onClose }: LeadSidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Info');
  const [note, setNote] = useState('');

  if (!lead) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
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
          {activeTab === 'Info' && (
            <div className="space-y-4">
              {/* Contact info */}
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
              </div>

              <div className="h-px bg-border" />

              {/* Details */}
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
              </div>

              {lead.tags.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Tagi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.tags.map(tag => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="p-3 bg-bg-subtle rounded-lg">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1.5">Notatka</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{lead.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Historia' && (
            <div className="space-y-1">
              {MOCK_ACTIVITIES.map((act, i) => {
                const meta = ACTIVITY_ICONS[act.type] ?? { icon: '•', color: '#94a3b8' };
                return (
                  <div key={act.id} className="flex gap-3 pb-4 relative">
                    {i < MOCK_ACTIVITIES.length - 1 && (
                      <div className="absolute left-4 top-7 bottom-0 w-px bg-border" />
                    )}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm z-10"
                      style={{ backgroundColor: `${meta.color}18` }}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-xs text-text-primary leading-relaxed">{act.content}</p>
                      <p className="text-[10px] text-text-muted mt-1">{act.author} · {formatTimeAgo(act.at)}</p>
                    </div>
                  </div>
                );
              })}
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
              <div className="p-3 bg-bg-subtle rounded-lg">
                <p className="text-[10px] text-text-muted mb-1.5">04.04.2026 · Dominik Kowalski</p>
                <p className="text-xs text-text-secondary leading-relaxed">Klient zainteresowany pakietem Enterprise. Prosi o szczegółowy kosztorys.</p>
              </div>
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

        {/* Footer actions */}
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
