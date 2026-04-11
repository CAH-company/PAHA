import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Cost, CostCategory } from '@/types';

export function useCosts() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [costsResult, categoriesResult] = await Promise.all([
      supabase
        .from('costs')
        .select('*, category:cost_categories(id, name, color), paid_by_employee:employees!paid_by(id, name)')
        .order('cost_date', { ascending: false }),
      supabase
        .from('cost_categories')
        .select('*')
        .order('name', { ascending: true }),
    ]);
    setCosts((costsResult.data ?? []) as unknown as Cost[]);
    setCategories((categoriesResult.data ?? []) as unknown as CostCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  return { costs, categories, loading, refetch: fetchCosts };
}
