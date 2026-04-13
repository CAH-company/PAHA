'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid, List, Sun, Plus, ChevronDown, AlertTriangle, MessageSquare,
  CheckSquare, MoreHorizontal, Loader2, Building2, ExternalLink, Pencil,
  Trash2, ArrowRight, GripVertical, X,
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useEmployees } from '@/hooks/useEmployees';
import { useClients } from '@/hooks/useClients';
import type { Task, TaskColumn } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn, formatDate, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/utils';

type ViewMode = 'kanban' | 'list' | 'myday';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Ogólne firmowe' },
  { value: 'client', label: 'Klienckie' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'documentation', label: 'Dokumentacja' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'hr', label: 'HR' },
  { value: 'operations', label: 'Operacje' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niski' },
  { value: 'normal', label: 'Normalny' },
  { value: 'high', label: 'Wysoki' },
  { value: 'urgent', label: 'Pilny' },
];

async function patchTask(id: string, updates: Record<string, any>) {
  return fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

// ── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  columns: TaskColumn[];
  onOpen: () => void;
  onEdit: () => void;
  onMoved: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

function TaskCard({ task, columns, onOpen, onEdit, onMoved, onDragStart }: TaskCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const priorityColor = PRIORITY_COLORS[task.priority];
  const clientName = task.client?.company ?? task.client?.name ?? task.lead?.company ?? task.lead?.name;

  async function moveToColumn(colId: string) {
    setMoving(true);
    await patchTask(task.id, { column_id: colId });
    setMoving(false);
    setMoveOpen(false);
    setMenuOpen(false);
    onMoved();
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      className="bg-bg-base border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 hover:shadow-sm transition-all duration-100 group relative"
    >
      {/* Priority bar */}
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: priorityColor }} />

      {/* Drag handle + menu */}
      <div className="flex items-start justify-between mb-1.5">
        <GripVertical size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 cursor-grab" />
        <div className="relative ml-auto">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); setMoveOpen(false); }}
            className="p-1 rounded hover:bg-bg-muted text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={12} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 bg-bg-base border border-border rounded-lg shadow-lg py-1 w-44">
              <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-bg-subtle text-text-primary">
                <Pencil size={12} /> Edytuj
              </button>
              <button onClick={e => { e.stopPropagation(); setMoveOpen(v => !v); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-bg-subtle text-text-primary">
                <ArrowRight size={12} /> Przenieś do
              </button>
              {moveOpen && (
                <div className="border-t border-border pt-1">
                  {columns.filter(c => c.id !== task.column_id).map(col => (
                    <button key={col.id} disabled={moving}
                      onClick={e => { e.stopPropagation(); moveToColumn(col.id); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-bg-subtle text-text-secondary">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                      {col.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p onClick={onOpen} className="text-xs font-semibold text-text-primary leading-relaxed mb-2 pr-1 cursor-pointer">{task.title}</p>

      <div className="flex items-center justify-between">
        <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" />
        <div className="flex items-center gap-2">
          {task.checklist_total > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <CheckSquare size={10} /> {task.checklist_done}/{task.checklist_total}
            </span>
          )}
          {task.comments_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <MessageSquare size={10} /> {task.comments_count}
            </span>
          )}
        </div>
      </div>

      {task.due_date && (
        <div className={cn('flex items-center gap-1 mt-2 text-[10px]', isOverdue ? 'text-red-500' : 'text-text-muted')}>
          {isOverdue && <AlertTriangle size={9} />}
          {formatDate(task.due_date, 'dd.MM HH:mm')}
        </div>
      )}

      {clientName && (
        <div className="mt-2">
          <button
            onClick={e => {
              e.stopPropagation();
              if (task.client?.id) router.push(`/crm/clients/${task.client.id}`);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <Building2 size={9} className="text-accent flex-shrink-0" />
            <span className="text-[9px] font-medium text-accent truncate max-w-[140px]">{clientName}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Task Detail Panel ────────────────────────────────────────────────────────

interface DetailPanelProps {
  task: Task;
  columns: TaskColumn[];
  onClose: () => void;
  onEdit: () => void;
  onMoved: () => void;
  onDeleted: () => void;
}

function TaskDetailPanel({ task, columns, onClose, onEdit, onMoved, onDeleted }: DetailPanelProps) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const clientName = task.client?.company ?? task.client?.name;
  const currentCol = columns.find(c => c.id === task.column_id);

  async function moveToColumn(colId: string) {
    setMoving(true);
    await patchTask(task.id, { column_id: colId });
    setMoving(false);
    onMoved();
  }

  async function handleDelete() {
    if (!confirm('Usunąć to zadanie?')) return;
    setDeleting(true);
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    setDeleting(false);
    onClose();
    onDeleted();
  }

  return (
    <Modal open={!!task} onClose={onClose} size="xl" className="h-[80vh] flex flex-col">
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-text-primary">{task.title}</h2>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-bg-subtle hover:bg-bg-muted border border-border text-text-secondary transition-colors">
                <Pencil size={12} /> Edytuj
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="p-1.5 rounded-md hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge color={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
            {task.due_date && (
              <span className={cn('text-xs', new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-text-muted')}>
                Termin: {formatDate(task.due_date, 'dd.MM.yyyy HH:mm')}
              </span>
            )}
            {clientName && (
              <button
                onClick={() => { onClose(); router.push(`/crm/clients/${task.client!.id}`); }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10 hover:bg-accent/20 transition-colors">
                <Building2 size={11} className="text-accent" />
                <span className="text-xs font-medium text-accent">{clientName}</span>
                <ExternalLink size={9} className="text-accent/60" />
              </button>
            )}
          </div>
        </div>

        {/* Move between columns */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Status / kolumna</p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map(col => (
              <button
                key={col.id}
                disabled={moving || col.id === task.column_id}
                onClick={() => moveToColumn(col.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  col.id === task.column_id
                    ? 'border-transparent text-white'
                    : 'border-border bg-bg-subtle hover:bg-bg-muted text-text-secondary'
                )}
                style={col.id === task.column_id ? { backgroundColor: col.color } : {}}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.id === task.column_id ? 'rgba(255,255,255,0.7)' : col.color }} />
                {col.name}
                {moving && col.id !== task.column_id && <Loader2 size={10} className="animate-spin" />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Przypisani</p>
              <div className="flex items-center gap-2 flex-wrap">
                {task.assignees.length === 0
                  ? <span className="text-xs text-text-muted">Brak</span>
                  : task.assignees.map(a => (
                    <div key={a.id} className="flex items-center gap-1.5">
                      <Avatar name={a.name} size="sm" />
                      <span className="text-xs text-text-primary">{a.name}</span>
                    </div>
                  ))}
              </div>
            </div>

            {task.description && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Opis</p>
                <p className="text-sm text-text-secondary leading-relaxed">{task.description}</p>
              </div>
            )}

            {task.checklist_total > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Podzadania ({task.checklist_done}/{task.checklist_total})
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Komentarze</p>
            {task.comments_count === 0 ? (
              <p className="text-xs text-text-muted">Brak komentarzy</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Avatar name="Pracownik" size="sm" />
                  <div className="flex-1 bg-bg-subtle rounded-lg px-3 py-2">
                    <p className="text-xs text-text-secondary mt-0.5">Komentarz do zadania</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input placeholder="Dodaj komentarz..."
                className="flex-1 border border-border rounded-md px-3 py-2 text-xs bg-bg-base focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <Button variant="primary" size="sm">Wyślij</Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormState {
  title: string;
  description: string;
  priority: string;
  column_id: string;
  due_date: string;
  assignee_id: string;
  category: string;
  client_id: string;
}

const emptyForm: TaskFormState = {
  title: '', description: '', priority: 'normal', column_id: '',
  due_date: '', assignee_id: '', category: 'general', client_id: '',
};

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  columns: TaskColumn[];
  employees: any[];
  clients: any[];
  editTask?: Task | null;
}

function TaskFormModal({ open, onClose, onSaved, columns, employees, clients, editTask }: TaskFormModalProps) {
  const isEdit = !!editTask;
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync form when editTask changes
  useState(() => {
    if (editTask) {
      setForm({
        title: editTask.title,
        description: editTask.description ?? '',
        priority: editTask.priority,
        column_id: editTask.column_id ?? '',
        due_date: editTask.due_date ? editTask.due_date.slice(0, 16) : '',
        assignee_id: editTask.assignees?.[0]?.id ?? '',
        category: (editTask as any).category ?? 'general',
        client_id: editTask.client_id ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  });

  // Reset form when modal opens
  const prevOpen = useRef(false);
  if (open !== prevOpen.current) {
    prevOpen.current = open;
    if (open) {
      if (editTask) {
        setForm({
          title: editTask.title,
          description: editTask.description ?? '',
          priority: editTask.priority,
          column_id: editTask.column_id ?? '',
          due_date: editTask.due_date ? editTask.due_date.slice(0, 16) : '',
          assignee_id: editTask.assignees?.[0]?.id ?? '',
          category: (editTask as any).category ?? 'general',
          client_id: editTask.client_id ?? '',
        });
      } else {
        setForm(emptyForm);
      }
      setError('');
    }
  }

  async function handleSave() {
    if (!form.title) return;
    setLoading(true);
    setError('');

    const payload = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      column_id: form.column_id || undefined,
      due_date: form.due_date || null,
      assignee_ids: form.assignee_id ? [form.assignee_id] : [],
      category: form.category,
      client_id: form.client_id || null,
    };

    let res: Response;
    if (isEdit && editTask) {
      res = await fetch(`/api/tasks/${editTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Błąd zapisu');
      return;
    }
    onClose();
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edytuj zadanie' : 'Nowe zadanie'}>
      <div className="p-5 space-y-4">
        <Input label="Tytuł *" placeholder="Opis zadania" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Kategoria" value={form.category} options={CATEGORY_OPTIONS}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          <Select label="Priorytet" value={form.priority} options={PRIORITY_OPTIONS}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Kolumna" value={form.column_id}
            options={[{ value: '', label: '— domyślna —' }, ...columns.map(c => ({ value: c.id, label: c.name }))]}
            onChange={e => setForm(f => ({ ...f, column_id: e.target.value }))} />
          <Select label="Przypisz do" value={form.assignee_id}
            options={[{ value: '', label: '— brak —' }, ...employees.map(e => ({ value: e.id, label: e.name }))]}
            onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))} />
        </div>
        <Select label="Klient (opcjonalnie)" value={form.client_id}
          options={[{ value: '', label: '— brak —' }, ...clients.map((c: any) => ({ value: c.id, label: c.company ?? c.name }))]}
          onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} />
        <Input label="Termin" type="datetime-local" value={form.due_date}
          onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        <Input label="Opis (opcjonalnie)" placeholder="Szczegóły zadania..." value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleSave} disabled={!form.title || loading}>
          {loading ? <><Loader2 size={13} className="animate-spin" /> Zapisywanie...</> : (isEdit ? 'Zapisz zmiany' : 'Dodaj zadanie')}
        </Button>
      </div>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const { tasks, columns, loading, refetch } = useTasks();
  const { employees } = useEmployees();
  const { clients } = useClients();

  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Drag & drop
  const dragTaskId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    dragTaskId.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = dragTaskId.current;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.column_id === colId) return;
    dragTaskId.current = null;
    await patchTask(taskId, { column_id: colId });
    refetch();
  }

  function openEdit(task: Task) {
    setSelectedTask(null);
    setEditTask(task);
    setShowForm(true);
  }

  function openNew() {
    setEditTask(null);
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-bg-muted rounded-lg p-0.5">
            {[
              { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Kanban' },
              { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
              { mode: 'myday' as ViewMode, icon: Sun, label: 'Mój dzień' },
            ].map(({ mode, icon: Icon, label }) => (
              <button key={mode} onClick={() => setView(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === mode ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                )}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus size={14} /> Nowe zadanie
        </Button>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.column_id === col.id);
            const isOver = dragOverCol === col.id;
            return (
              <div key={col.id} className="flex-shrink-0 w-[260px] flex flex-col"
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="text-xs font-semibold text-text-primary">{col.name}</span>
                  <span className="ml-auto text-[10px] font-medium text-text-muted bg-bg-muted px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
                <div className={cn(
                  'flex-1 border rounded-xl p-2 space-y-2 min-h-[300px] relative transition-colors',
                  isOver ? 'bg-accent/5 border-accent/40' : 'bg-bg-subtle border-border'
                )}>
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      columns={columns}
                      onOpen={() => setSelectedTask(task)}
                      onEdit={() => openEdit(task)}
                      onMoved={refetch}
                      onDragStart={handleDragStart}
                    />
                  ))}
                  {isOver && (
                    <div className="border-2 border-dashed border-accent/40 rounded-lg h-16 flex items-center justify-center">
                      <span className="text-xs text-accent/60">Upuść tutaj</span>
                    </div>
                  )}
                  <button onClick={openNew}
                    className="w-full py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-muted rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <Plus size={12} /> Dodaj zadanie
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                {['Zadanie', 'Klient', 'Status', 'Priorytet', 'Przypisani', 'Termin', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map(task => {
                const col = columns.find(c => c.id === task.column_id);
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                return (
                  <tr key={task.id} className="hover:bg-bg-subtle transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-text-primary cursor-pointer"
                      onClick={() => setSelectedTask(task)}>{task.title}</td>
                    <td className="px-4 py-3">
                      {(task.client?.company ?? task.client?.name) ? (
                        <button
                          onClick={() => router.push(`/crm/clients/${task.client!.id}`)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors">
                          <Building2 size={10} className="text-accent" />
                          <span className="text-xs font-medium text-accent">{task.client?.company ?? task.client?.name}</span>
                        </button>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col?.color }} />
                        <span className="text-xs text-text-secondary">{col?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" />
                    </td>
                    <td className="px-4 py-3">
                      {task.due_date ? (
                        <span className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-text-muted')}>
                          {isOverdue && '⚠ '}{formatDate(task.due_date, 'dd.MM HH:mm')}
                        </span>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(task)}
                        className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* My Day */}
      {view === 'myday' && (
        <div className="space-y-4">
          {[
            { label: 'Dziś', tasks: tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()) },
            { label: 'Ten tydzień', tasks: tasks.filter(t => !t.due_date || new Date(t.due_date) >= new Date()).slice(0, 5) },
            { label: 'Przeterminowane', tasks: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()) },
          ].map(({ label, tasks: group }) => (
            <div key={label}>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{label} ({group.length})</h3>
              {group.length === 0
                ? <p className="text-xs text-text-muted px-1">Brak zadań</p>
                : (
                  <div className="space-y-2">
                    {group.map(task => (
                      <div key={task.id} onClick={() => setSelectedTask(task)}
                        className="flex items-center gap-3 bg-bg-base border border-border rounded-lg px-4 py-2.5 hover:border-accent/40 cursor-pointer transition-all">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                        <span className="flex-1 text-sm text-text-primary">{task.title}</span>
                        <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" max={2} />
                        {task.due_date && <span className="text-xs text-text-muted">{formatDate(task.due_date, 'dd.MM HH:mm')}</span>}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Task detail */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          columns={columns}
          onClose={() => setSelectedTask(null)}
          onEdit={() => openEdit(selectedTask)}
          onMoved={() => { refetch(); setSelectedTask(null); }}
          onDeleted={refetch}
        />
      )}

      {/* Add / Edit task modal */}
      <TaskFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={refetch}
        columns={columns}
        employees={employees}
        clients={clients}
        editTask={editTask}
      />
    </div>
  );
}
