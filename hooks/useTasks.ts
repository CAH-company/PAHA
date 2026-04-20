import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskColumn } from '@/types';

async function fetchTasks(): Promise<{ tasks: Task[]; columns: TaskColumn[] }> {
  const supabase = createClient();
  const [tasksResult, columnsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, task_assignees(employee:employees(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at), accepted_at, rejected_at), task_comments(id), task_checklists(items), client:clients(id, name, company)')
      .order('position', { ascending: true }),
    supabase
      .from('task_columns')
      .select('*')
      .order('position', { ascending: true }),
  ]);

  return {
    tasks: (tasksResult.data ?? []).map((row: any) => ({
      ...row,
      assignees: (row.task_assignees ?? []).map((ta: any) => ta.employee).filter(Boolean),
      comments_count: (row.task_comments ?? []).length,
      checklist_total: (row.task_checklists?.[0]?.items as any[])?.length ?? 0,
      checklist_done: ((row.task_checklists?.[0]?.items as any[]) ?? []).filter((i: any) => i.done).length,
    })) as unknown as Task[],
    columns: (columnsResult.data ?? []) as unknown as TaskColumn[],
  };
}

export function useTasks() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    staleTime: 30_000, // taski mogą się zmieniać — odświeżaj co 30s
  });

  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  return {
    tasks: data?.tasks ?? [],
    columns: data?.columns ?? [],
    loading,
    refetch,
  };
}
