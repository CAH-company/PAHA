import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Lead } from '@/types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('leads')
      .select('*, owner:employees!owner_id(id, name, email, phone, position, role, avatar_url, joined_at, is_active, access_crm_leads, access_crm_clients, access_accounting, access_marketing, access_operations, access_tasks, created_at, updated_at)')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    setLeads(
      (rows ?? []).map((row: any) => ({
        ...row,
        tags: row.tags ?? [],
      })) as unknown as Lead[]
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return { leads, loading, refetch: fetchLeads };
}
