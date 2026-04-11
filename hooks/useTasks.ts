import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskColumn } from '@/types';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [tasksResult, columnsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, task_assignees(employee:employees(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)), task_comments(id), task_checklists(items)')
        .order('position', { ascending: true }),
      supabase
        .from('task_columns')
        .select('*')
        .order('position', { ascending: true }),
    ]);
    setTasks(
      (tasksResult.data ?? []).map((row: any) => ({
        ...row,
        assignees: (row.task_assignees ?? []).map((ta: any) => ta.employee).filter(Boolean),
        comments_count: (row.task_comments ?? []).length,
        checklist_total: (row.task_checklists?.[0]?.items as any[])?.length ?? 0,
        checklist_done: ((row.task_checklists?.[0]?.items as any[]) ?? []).filter((i: any) => i.done).length,
      })) as unknown as Task[]
    );
    setColumns((columnsResult.data ?? []) as unknown as TaskColumn[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  return { tasks, columns, loading, refetch: fetchTasks };
}
