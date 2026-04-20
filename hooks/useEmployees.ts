import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Employee } from '@/types';

async function fetchEmployees(): Promise<Employee[]> {
  const supabase = createClient();
  const { data } = await supabase.from('employees').select('*').order('name', { ascending: true });
  return (data ?? []) as unknown as Employee[];
}

export function useEmployees() {
  const { data: employees = [], isLoading: loading } = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
    staleTime: 5 * 60_000, // pracownicy rzadko się zmieniają — cache 5 min
  });

  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  return { employees, loading, refetch };
}
