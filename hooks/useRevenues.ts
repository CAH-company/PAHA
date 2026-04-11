import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Revenue, RevenueCategory } from '@/types';

export function useRevenues() {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRevenues = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [revResult, catResult] = await Promise.all([
      supabase
        .from('revenues')
        .select('*, category:revenue_categories(id, name, color)')
        .order('revenue_date', { ascending: false }),
      supabase
        .from('revenue_categories')
        .select('*')
        .order('name', { ascending: true }),
    ]);
    setRevenues((revResult.data ?? []) as unknown as Revenue[]);
    setRevenueCategories((catResult.data ?? []) as unknown as RevenueCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRevenues(); }, [fetchRevenues]);

  return { revenues, revenueCategories, loading, refetch: fetchRevenues };
}
