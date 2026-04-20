import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/types';

async function fetchClients(): Promise<Client[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
    .order('created_at', { ascending: false });
  return ((data ?? []).map((row: any) => ({
    ...row,
    tags: row.tags ?? [],
    total_value: row.total_value ?? 0,
  }))) as unknown as Client[];
}

export function useClients() {
  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  return { clients, loading, refetch };
}
