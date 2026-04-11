import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Employee } from '@/types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: rows } = await supabase.from('employees').select('*').order('name', { ascending: true });
    setEmployees((rows ?? []) as unknown as Employee[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  return { employees, loading, refetch: fetchEmployees };
}
