import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Lead } from '@/types';

async function fetchLeads(): Promise<Lead[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('leads')
    .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  return ((data ?? []).map((row: any) => ({ ...row, tags: row.tags ?? [] }))) as unknown as Lead[];
}

export function useLeads() {
  const { data: leads = [], isLoading: loading } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
  });

  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['leads'] });

  return { leads, loading, refetch };
}
