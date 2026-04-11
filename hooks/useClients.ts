import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('clients')
      .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
      .order('created_at', { ascending: false });
    setClients(
      (rows ?? []).map((row: any) => ({
        ...row,
        tags: row.tags ?? [],
        total_value: row.total_value ?? 0,
      })) as unknown as Client[]
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  return { clients, loading, refetch: fetchClients };
}
