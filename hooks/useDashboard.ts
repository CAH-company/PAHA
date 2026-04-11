import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Lead, Client, Task, TaskColumn, Cost, CostCategory } from '@/types';

const MONTH_LABELS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paz', 'Lis', 'Gru'];

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function computeLast6MonthsCosts(allCosts: Cost[]): { month: string; value: number }[] {
  const now = new Date();
  const result: { month: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = MONTH_LABELS_PL[month];
    const value = allCosts
      .filter((c) => {
        const cd = new Date(c.cost_date);
        return cd.getFullYear() === year && cd.getMonth() === month;
      })
      .reduce((sum, c) => sum + (c.amount_pln ?? c.amount), 0);
    result.push({ month: label, value });
  }
  return result;
}

function computeCostsByCategory(
  allCosts: Cost[],
  categories: CostCategory[]
): { name: string; value: number; color: string }[] {
  const map: Record<string, number> = {};
  for (const c of allCosts) {
    const key = c.category_id ?? '__none__';
    map[key] = (map[key] ?? 0) + (c.amount_pln ?? c.amount);
  }
  return Object.entries(map)
    .map(([catId, value]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        name: cat?.name ?? 'Inne',
        value,
        color: cat?.color ?? '#94a3b8',
      };
    })
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function useDashboard() {
  const [stats, setStats] = useState({
    leads_total: 0,
    leads_new: 0,
    clients_active: 0,
    tasks_pending: 0,
    tasks_overdue: 0,
    costs_month: 0,
    costs_month_eur: 0,
    costs_month_usd: 0,
    campaigns_active: 0,
  });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [recentCosts, setRecentCosts] = useState<Cost[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [chartData, setChartData] = useState<{
    costsOverTime: { month: string; value: number }[];
    costsByCategory: { name: string; value: number; color: string }[];
  }>({ costsOverTime: [], costsByCategory: [] });
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const [
      leadsResult,
      clientsResult,
      tasksResult,
      columnsResult,
      allCostsResult,
      monthCostsResult,
      categoriesResult,
    ] = await Promise.all([
      supabase
        .from('leads')
        .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*, task_assignees(employee:employees(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)), task_comments(id), task_checklists(items)')
        .order('position', { ascending: true }),
      supabase
        .from('task_columns')
        .select('*')
        .order('position', { ascending: true }),
      supabase
        .from('costs')
        .select('*, category:cost_categories(id, name, color), paid_by_employee:employees!paid_by(id, name)')
        .order('cost_date', { ascending: false }),
      supabase
        .from('costs')
        .select('*, category:cost_categories(id, name, color), paid_by_employee:employees!paid_by(id, name)')
        .gte('cost_date', firstDayOfMonth)
        .order('cost_date', { ascending: false }),
      supabase
        .from('cost_categories')
        .select('*')
        .order('name', { ascending: true }),
    ]);

    const leads = (leadsResult.data ?? []).map((row: any) => ({
      ...row,
      tags: row.tags ?? [],
    })) as unknown as Lead[];

    const clients = (clientsResult.data ?? []).map((row: any) => ({
      ...row,
      tags: row.tags ?? [],
      total_value: row.total_value ?? 0,
    })) as unknown as Client[];

    const columns = (columnsResult.data ?? []) as unknown as TaskColumn[];

    const tasks = (tasksResult.data ?? []).map((row: any) => ({
      ...row,
      assignees: (row.task_assignees ?? []).map((ta: any) => ta.employee).filter(Boolean),
      comments_count: (row.task_comments ?? []).length,
      checklist_total: (row.task_checklists?.[0]?.items as any[])?.length ?? 0,
      checklist_done: ((row.task_checklists?.[0]?.items as any[]) ?? []).filter((i: any) => i.done).length,
    })) as unknown as Task[];

    const allCosts = (allCostsResult.data ?? []) as unknown as Cost[];
    const monthCosts = (monthCostsResult.data ?? []) as unknown as Cost[];
    const categories = (categoriesResult.data ?? []) as unknown as CostCategory[];

    const doneCol = columns.find(
      (c) => c.name.toLowerCase() === 'gotowe' || c.name.toLowerCase() === 'done'
    );

    setStats({
      leads_total: leads.length,
      leads_new: leads.filter((l) => isToday(l.created_at)).length,
      clients_active: clients.filter((c) => c.status === 'active').length,
      tasks_pending: tasks.filter((t) => !doneCol || t.column_id !== doneCol.id).length,
      tasks_overdue: tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length,
      costs_month: monthCosts
        .filter((c) => c.currency === 'PLN')
        .reduce((s, c) => s + c.amount, 0),
      costs_month_eur: monthCosts
        .filter((c) => c.currency === 'EUR')
        .reduce((s, c) => s + c.amount, 0),
      costs_month_usd: monthCosts
        .filter((c) => c.currency === 'USD')
        .reduce((s, c) => s + c.amount, 0),
      campaigns_active: 0,
    });

    setRecentLeads(leads.slice(0, 5));
    setRecentCosts(monthCosts.slice(0, 4));
    setMyTasks(tasks.slice(0, 4));
    setChartData({
      costsOverTime: computeLast6MonthsCosts(allCosts),
      costsByCategory: computeCostsByCategory(allCosts, categories),
    });

    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return { stats, recentLeads, recentCosts, myTasks, chartData, loading };
}
