import { useEffect, useState, useCallback } from 'react';
import type { Quote } from '@/types';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/quotes');
    if (res.ok) {
      const data = await res.json();
      setQuotes(data.map((q: any) => ({
        ...q,
        items: q.items ?? [],
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const saveQuote = useCallback(async (quote: Quote): Promise<Quote> => {
    const isNew = !quotes.find(q => q.id === quote.id);
    const { id, ...body } = quote;

    if (isNew) {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, id }),
      });
      const { id: newId } = await res.json();
      const saved = { ...quote, id: newId };
      setQuotes(prev => [saved, ...prev]);
      return saved;
    } else {
      await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setQuotes(prev => prev.map(q => q.id === id ? quote : q));
      return quote;
    }
  }, [quotes]);

  const deleteQuote = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    setQuotes(prev => prev.filter(q => q.id !== id));
  }, []);

  const updateStatus = useCallback(async (id: string, status: Quote['status']) => {
    await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  }, []);

  return { quotes, loading, fetchQuotes, saveQuote, deleteQuote, updateStatus, setQuotes };
}
