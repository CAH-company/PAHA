'use client';

import { useState } from 'react';
import { Plus, FileText, ExternalLink, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

const MOCK_DOCS = [
  { id: '1', title: 'Umowa — DevHouse', type: 'contract', status: 'signed', client: 'DevHouse', date: '2026-03-20', drive: true },
  { id: '2', title: 'Oferta RetailPro — Q1', type: 'offer', status: 'sent', client: 'RetailPro', date: '2026-02-10', drive: false },
  { id: '3', title: 'Brief kampania wiosenna', type: 'brief', status: 'draft', client: null, date: '2026-04-01', drive: false },
  { id: '4', title: 'Protokół odbioru — MediaGroup', type: 'protocol', status: 'archived', client: 'MediaGroup', date: '2026-01-15', drive: true },
];

const TYPE_LABELS: Record<string, string> = {
  contract: 'Umowa', offer: 'Oferta', brief: 'Brief', protocol: 'Protokół', other: 'Inne',
};
const TYPE_COLORS: Record<string, string> = {
  contract: '#6366f1', offer: '#3b82f6', brief: '#f59e0b', protocol: '#10b981', other: '#94a3b8',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic', sent: 'Wysłany', signed: 'Podpisany', archived: 'Archiwum',
};
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', sent: '#3b82f6', signed: '#10b981', archived: '#f59e0b',
};

export default function OperationsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Dokumenty</h1>
        <Button variant="primary" size="sm">
          <Plus size={14} />
          Nowy dokument
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_DOCS.map(doc => (
          <div key={doc.id} className="bg-bg-base border border-border rounded-xl p-4 hover:border-border-strong transition-colors group cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${TYPE_COLORS[doc.type]}18` }}>
                <FileText size={16} style={{ color: TYPE_COLORS[doc.type] }} />
              </div>
              <div className="flex items-center gap-1.5">
                <Badge color={STATUS_COLORS[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
                {doc.drive && <ExternalLink size={12} className="text-text-muted" />}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">{doc.title}</h3>
            <div className="flex items-center justify-between">
              <Badge color={TYPE_COLORS[doc.type]}>{TYPE_LABELS[doc.type]}</Badge>
              <span className="text-xs text-text-muted">{formatDate(doc.date)}</span>
            </div>
            {doc.client && <p className="text-xs text-text-muted mt-2">Klient: {doc.client}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
