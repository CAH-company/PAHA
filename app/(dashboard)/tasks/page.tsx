'use client';

import { useState, useMemo } from 'react';
import { LayoutGrid, List, Sun, Plus, ChevronDown, AlertTriangle, MessageSquare, CheckSquare, MoreHorizontal } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useEmployees } from '@/hooks/useEmployees';
import type { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn, formatDate, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/utils';

type ViewMode = 'kanban' | 'list' | 'myday';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const priorityColor = PRIORITY_COLORS[task.priority];

  return (
    <div
      onClick={onClick}
      className="bg-bg-base border border-border rounded-lg p-3 cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all duration-100 group"
    >
      {/* Priority bar */}
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full"
        style={{ backgroundColor: priorityColor }}
      />

      <p className="text-xs font-semibold text-text-primary leading-relaxed mb-2 pr-1">{task.title}</p>

      <div className="flex items-center justify-between">
        <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" />
        <div className="flex items-center gap-2">
          {task.checklist_total > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <CheckSquare size={10} />
              {task.checklist_done}/{task.checklist_total}
            </span>
          )}
          {task.comments_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <MessageSquare size={10} />
              {task.comments_count}
            </span>
          )}
        </div>
      </div>

      {task.due_date && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-[10px]',
          isOverdue ? 'text-red-500' : 'text-text-muted'
        )}>
          {isOverdue && <AlertTriangle size={9} />}
          {formatDate(task.due_date, 'dd.MM HH:mm')}
        </div>
      )}

      {(task.client ?? task.lead) && (
        <div className="mt-2">
          <Badge className="text-[9px] py-0">
            {task.client?.company ?? task.client?.name ?? task.lead?.company ?? task.lead?.name}
          </Badge>
        </div>
      )}
    </div>
  );
}

function TaskDetailPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Modal open={!!task} onClose={onClose} size="xl" className="h-[80vh] flex flex-col">
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-text-primary">{task.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge color={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
            {task.due_date && (
              <span className={cn('text-xs', new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-text-muted')}>
                Termin: {formatDate(task.due_date, 'dd.MM.yyyy HH:mm')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Przypisani</p>
              <div className="flex items-center gap-2 flex-wrap">
                {task.assignees.map(a => (
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
                <div className="space-y-2">
                  {['Analiza wymagań', 'Przygotowanie wyceny', 'Review z partnerem', 'Wysyłka do klienta'].slice(0, task.checklist_total).map((item, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked={i < task.checklist_done}
                        className="rounded accent-indigo-500" />
                      <span className={cn('text-sm', i < task.checklist_done ? 'line-through text-text-muted' : 'text-text-primary')}>
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
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
                  <Avatar name="Anna Wiśniewska" size="sm" />
                  <div className="flex-1 bg-bg-subtle rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-text-primary">Anna Wiśniewska</p>
                    <p className="text-xs text-text-secondary mt-0.5">Sprawdziłam — umowa jest zgodna z warunkami.</p>
                    <p className="text-[10px] text-text-muted mt-1">07.04.2026 15:22</p>
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

export default function TasksPage() {
  const { tasks, columns, loading } = useTasks();
  const { employees } = useEmployees();
  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === mode ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-bg-subtle text-text-secondary">
            Osoba <ChevronDown size={12} />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-bg-subtle text-text-secondary">
            Priorytet <ChevronDown size={12} />
          </button>
        </div>

        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          Nowe zadanie
        </Button>
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.column_id === col.id);
            return (
              <div key={col.id} className="flex-shrink-0 w-[260px] flex flex-col">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="text-xs font-semibold text-text-primary">{col.name}</span>
                  <span className="ml-auto text-[10px] font-medium text-text-muted bg-bg-muted px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex-1 bg-bg-subtle border border-border rounded-xl p-2 space-y-2 min-h-[300px] relative">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                  ))}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-muted rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
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
                {['Zadanie', 'Priorytet', 'Przypisani', 'Kolumna', 'Termin', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map(task => {
                const col = columns.find(c => c.id === task.column_id);
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                return (
                  <tr key={task.id} className="hover:bg-bg-subtle transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">{task.title}</td>
                    <td className="px-4 py-3">
                      <Badge color={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col?.color }} />
                        <span className="text-xs text-text-secondary">{col?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {task.due_date ? (
                        <span className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-text-muted')}>
                          {isOverdue && '⚠ '}{formatDate(task.due_date, 'dd.MM HH:mm')}
                        </span>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted"><MoreHorizontal size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* My Day view */}
      {view === 'myday' && (
        <div className="space-y-4">
          {[
            { label: 'Dziś', tasks: tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()) },
            { label: 'Ten tydzień', tasks: tasks.filter(t => t.assignees.some(a => a.id === 'emp-1') && (!t.due_date || new Date(t.due_date) >= new Date())).slice(0, 3) },
            { label: 'Przeterminowane', tasks: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()) },
          ].map(({ label, tasks }) => (
            <div key={label}>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{label} ({tasks.length})</h3>
              {tasks.length === 0
                ? <p className="text-xs text-text-muted px-1">Brak zadań</p>
                : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} onClick={() => setSelectedTask(task)}
                        className="flex items-center gap-3 bg-bg-base border border-border rounded-lg px-4 py-2.5 hover:border-accent/40 cursor-pointer transition-all">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                        <span className="flex-1 text-sm text-text-primary">{task.title}</span>
                        <AvatarGroup names={task.assignees.map(a => a.name)} size="xs" max={2} />
                        {task.due_date && (
                          <span className="text-xs text-text-muted">{formatDate(task.due_date, 'dd.MM HH:mm')}</span>
                        )}
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
        <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {/* Add task modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Nowe zadanie">
        <div className="p-5 space-y-4">
          <Input label="Tytuł *" placeholder="Opis zadania" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priorytet" options={[
              { value: 'low', label: 'Niski' },
              { value: 'normal', label: 'Normalny' },
              { value: 'high', label: 'Wysoki' },
              { value: 'urgent', label: 'Pilny' },
            ]} defaultValue="normal" />
            <Select label="Kolumna" options={columns.map(c => ({ value: c.id, label: c.name }))} />
          </div>
          <Input label="Termin" type="datetime-local" />
          <Select label="Przypisz do" options={employees.map(e => ({ value: e.id, label: e.name }))} placeholder="Wybierz osobę" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
          <Button variant="ghost" onClick={() => setShowAddModal(false)}>Anuluj</Button>
          <Button variant="primary">Dodaj zadanie</Button>
        </div>
      </Modal>
    </div>
  );
}
