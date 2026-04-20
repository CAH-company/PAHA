import { useEffect, useState, useCallback } from 'react';

export interface Service {
  id: string;
  name: string;
  description?: string;
  unit: 'szt' | 'godz' | 'mies' | 'projekt' | 'dzień';
  unit_price_net: number;
  vat_rate: number;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/services');
    if (res.ok) setServices(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const createService = useCallback(async (data: Omit<Service, 'id' | 'is_active' | 'position' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const created = await res.json();
    setServices(prev => [...prev, created]);
    return created as Service;
  }, []);

  const updateService = useCallback(async (id: string, data: Partial<Service>) => {
    await fetch(`/api/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const deleteService = useCallback(async (id: string) => {
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  return { services, loading, fetchServices, createService, updateService, deleteService };
}
