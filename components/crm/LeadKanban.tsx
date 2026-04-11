'use client';

import { useState } from 'react';
import type { Lead, LeadStatus } from '@/types';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, formatCurrency, formatTimeAgo } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

const KANBAN_COLS: LeadStatus[] = ['new', 'contacted', 'offer_sent', 'negotiation', 'won', 'lost'];

interface LeadKanbanProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

export function LeadKanban({ leads, onLeadClick }: LeadKanbanProps) {
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const byStatus = (status: LeadStatus) => leads.filter(l => l.status === status);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDragging(leadId);
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOver(null);
    setDragging(null);
    // In real app: update lead status via API
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {KANBAN_COLS.map((status) => {
        const col = byStatus(status);
        const color = LEAD_STATUS_COLORS[status];
        const isOver = dragOver === status;

        return (
          <div
            key={status}
            className="flex-shrink-0 w-[220px] flex flex-col"
            onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-text-primary">{LEAD_STATUS_LABELS[status]}</span>
              <span className="ml-auto text-[10px] font-medium text-text-muted bg-bg-muted px-1.5 py-0.5 rounded-full">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div
              className={`flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors ${
                isOver ? 'bg-accent/5 border-2 border-accent/20 border-dashed' : 'bg-bg-subtle border border-border'
              }`}
            >
              {col.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => onLeadClick(lead)}
                  className={`bg-bg-base border border-border rounded-lg p-3 cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all duration-100 ${
                    dragging === lead.id ? 'opacity-40' : ''
                  }`}
                >
                  <p className="text-xs font-semibold text-text-primary leading-tight">{lead.name}</p>
                  {lead.company && (
                    <p className="text-[10px] text-text-muted mt-0.5 truncate">{lead.company}</p>
                  )}
                  <div className="flex items-center justify-between mt-2.5">
                    {lead.owner && <Avatar name={lead.owner.name} size="xs" />}
                    {lead.estimated_value && (
                      <span className="text-[10px] font-semibold text-text-secondary">
                        {formatCurrency(lead.estimated_value, lead.currency)}
                      </span>
                    )}
                  </div>
                  {lead.last_activity_at && (
                    <p className="text-[9px] text-text-muted mt-1.5">
                      {formatTimeAgo(lead.last_activity_at)}
                    </p>
                  )}
                </div>
              ))}
              {col.length === 0 && (
                <div className="flex items-center justify-center h-16 text-[10px] text-text-muted">
                  Brak leadów
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
