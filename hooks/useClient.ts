import { useEffect, useState, useCallback } from 'react';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Client } from '@/types';

export function useClient(id: string) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('clients')
      .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
    } else {
      setClient({ ...data, tags: data.tags ?? [], total_value: data.total_value ?? 0 } as unknown as Client);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  return { client, loading, notFound, refetch: fetchClient };
}
