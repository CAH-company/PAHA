'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Video, Clock, Users, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, RefreshCw, Check, X, Plus, Trash2, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { cn, formatDate } from '@/lib/utils';
import { useEmployees } from '@/hooks/useEmployees';

interface Meeting {
  id: string;
  fathom_id: string | null;
  title: string;
  meeting_date: string | null;
  duration_minutes: number | null;
  participants: string[];
  status: 'pending' | 'processing' | 'done' | 'error';
  extracted_tasks: { summary?: string; tasks?: ExtractedTask[] } | null;
  processed_at: string | null;
  created_at: string;
}

interface ExtractedTask {
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  suggested_assignee?: string | null;
  due_date?: string | null;
  category?: string;
}

interface TaskDraft extends ExtractedTask {
  selected: boolean;
  assignee_id: string | null;
}

const STATUS_CONFIG = {
  pending:    { label: 'Oczekuje',     color: '#f59e0b', icon: Clock },
  processing: { label: 'Przetwarzam',  color: '#3b82f6', icon: Loader2 },
  done:       { label: 'Gotowe',       color: '#10b981', icon: CheckCircle2 },
  error:      { label: 'Błąd',         color: '#ef4444', icon: AlertCircle },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444',
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { employees } = useEmployees();

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/meetings');
    if (res.ok) setMeetings(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  function openMeeting(meeting: Meeting) {
    setSelected(meeting);
    const tasks = meeting.extracted_tasks?.tasks ?? [];
    setTaskDrafts(tasks.map(t => ({
      ...t,
      selected: true,
      assignee_id: null,
    })));
  }

  async function triggerProcess(meetingId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setProcessing(meetingId);
    await fetch(`/api/meetings/${meetingId}/process`, { method: 'POST' });
    await fetchMeetings();
    setProcessing(null);
    // Refresh selected if open
    if (selected?.id === meetingId) {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        setTaskDrafts((updated.extracted_tasks?.tasks ?? []).map((t: ExtractedTask) => ({
          ...t, selected: true, assignee_id: null,
        })));
      }
    }
  }

  async function confirmTasks() {
    if (!selected) return;
    const toCreate = taskDrafts.filter(t => t.selected);
    if (toCreate.length === 0) return;

    setConfirming(true);
    const res = await fetch(`/api/meetings/${selected.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: toCreate.map(t => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          due_date: t.due_date,
          category: t.category,
          assignee_id: t.assignee_id,
        })),
      }),
    });

    setConfirming(false);
    if (res.ok) {
      const { created } = await res.json();
      alert(`Utworzono ${created} zadań w systemie.`);
      setSelected(null);
    }
  }

  async function deleteMeeting(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Usunąć ten zapis spotkania?')) return;
    await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className={cn('flex flex-col flex-1 min-w-0 overflow-hidden', selected ? 'border-r border-border' : '')}>
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-bg-base flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Spotkania</h1>
            <p className="text-xs text-text-muted mt-0.5">Transkrypcje z Fathom + wyodrębnione zadania</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchMeetings}>
            <RefreshCw size={14} /> Odśwież
          </Button>
        </div>

        {/* Webhook info */}
        <div className="flex-shrink-0 mx-6 mt-4 mb-2 bg-bg-subtle border border-border rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-text-secondary mb-0.5">URL webhooka Fathom</p>
          <code className="text-xs text-accent font-mono select-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/fathom
          </code>
          <p className="text-xs text-text-muted mt-1">Wklej w Fathom → Settings → Integrations → Webhook. Sekret zapisz w <code className="font-mono">FATHOM_WEBHOOK_SECRET</code>.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-20 text-center">
              <Video size={36} className="text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary font-medium">Brak spotkań</p>
              <p className="text-xs text-text-muted mt-1">Skonfiguruj webhook w Fathom — transkrypcje będą tu lądować automatycznie.</p>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {meetings.map(meeting => {
                const cfg = STATUS_CONFIG[meeting.status];
                const Icon = cfg.icon;
                const taskCount = meeting.extracted_tasks?.tasks?.length ?? 0;
                const isProcessing = processing === meeting.id || meeting.status === 'processing';

                return (
                  <div
                    key={meeting.id}
                    onClick={() => meeting.status === 'done' && openMeeting(meeting)}
                    className={cn(
                      'border border-border rounded-xl p-4 transition-all group',
                      meeting.status === 'done'
                        ? 'cursor-pointer hover:border-accent/40 hover:shadow-sm'
                        : 'cursor-default',
                      selected?.id === meeting.id ? 'border-accent/40 bg-accent-subtle' : 'bg-bg-base'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${cfg.color}18` }}>
                          <Icon size={15} style={{ color: cfg.color }}
                            className={meeting.status === 'processing' ? 'animate-spin' : ''} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{meeting.title}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {meeting.meeting_date && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                <Calendar size={10} />
                                {formatDate(meeting.meeting_date)}
                              </span>
                            )}
                            {meeting.duration_minutes && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                <Clock size={10} />
                                {meeting.duration_minutes} min
                              </span>
                            )}
                            {meeting.participants.length > 0 && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                <Users size={10} />
                                {meeting.participants.slice(0, 3).join(', ')}
                                {meeting.participants.length > 3 && ` +${meeting.participants.length - 3}`}
                              </span>
                            )}
                          </div>
                          {meeting.status === 'done' && taskCount > 0 && (
                            <p className="text-xs text-accent mt-1 font-medium">
                              {taskCount} zadań do przejrzenia
                            </p>
                          )}
                          {meeting.status === 'error' && (
                            <p className="text-xs text-red-500 mt-1">Błąd przetwarzania — kliknij "Spróbuj ponownie"</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        {(meeting.status === 'pending' || meeting.status === 'error') && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={e => triggerProcess(meeting.id, e)}
                            disabled={isProcessing}
                          >
                            {isProcessing
                              ? <Loader2 size={13} className="animate-spin" />
                              : <RefreshCw size={13} />}
                            {meeting.status === 'error' ? 'Ponów' : 'Przetwórz'}
                          </Button>
                        )}
                        {meeting.status === 'done' && (
                          <ChevronRight size={14} className="text-text-muted group-hover:text-text-secondary transition-colors" />
                        )}
                        <button
                          onClick={e => deleteMeeting(meeting.id, e)}
                          className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task review panel */}
      {selected && (
        <div className="w-[480px] flex-shrink-0 flex flex-col overflow-hidden bg-bg-base">
          <div className="flex-shrink-0 px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{selected.title}</h2>
              <p className="text-xs text-text-muted mt-0.5">Wybierz zadania do dodania do systemu</p>
            </div>
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted">
              <X size={15} />
            </button>
          </div>

          {selected.extracted_tasks?.summary && (
            <div className="flex-shrink-0 mx-5 mt-4 bg-bg-subtle border border-border rounded-lg p-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Podsumowanie spotkania</p>
              <p className="text-sm text-text-secondary">{selected.extracted_tasks.summary}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {taskDrafts.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Brak wyodrębnionych zadań</p>
            ) : taskDrafts.map((task, idx) => (
              <div
                key={idx}
                className={cn(
                  'border rounded-xl p-3 transition-all cursor-pointer',
                  task.selected
                    ? 'border-accent/50 bg-accent-subtle'
                    : 'border-border bg-bg-base opacity-60'
                )}
                onClick={() => setTaskDrafts(prev =>
                  prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t)
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                    task.selected ? 'bg-accent border-accent' : 'border-border'
                  )}>
                    {task.selected && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">{task.title}</p>
                      <Badge color={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
                    </div>
                    {task.description && (
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {task.due_date && (
                        <span className="text-xs text-text-muted">{task.due_date}</span>
                      )}
                      {task.suggested_assignee && (
                        <span className="text-xs text-accent">Sugerowane: {task.suggested_assignee}</span>
                      )}
                    </div>

                    {/* Assignee selector */}
                    {task.selected && (
                      <div className="mt-2" onClick={e => e.stopPropagation()}>
                        <Select
                          value={task.assignee_id ?? ''}
                          onChange={e => setTaskDrafts(prev =>
                            prev.map((t, i) => i === idx ? { ...t, assignee_id: (e.target as HTMLSelectElement).value || null } : t)
                          )}
                          options={[
                            { value: '', label: 'Bez przypisania' },
                            ...employeeOptions,
                          ]}
                          placeholder="Przypisz do..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {taskDrafts.filter(t => t.selected).length} z {taskDrafts.length} wybranych
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Anuluj</Button>
              <Button
                variant="primary" size="sm"
                onClick={confirmTasks}
                disabled={confirming || taskDrafts.filter(t => t.selected).length === 0}
              >
                {confirming ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Dodaj zadania
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
