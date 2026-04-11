'use client';

import { useState } from 'react';
import { Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export default function ArchivePage() {
  const [tab, setTab] = useState<'leads' | 'clients'>('leads');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Archiwum</h1>
      <div className="flex gap-1 p-1 bg-bg-muted rounded-lg w-fit">
        {(['leads', 'clients'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary')}>
            {t === 'leads' ? 'Leady' : 'Klienci'}
          </button>
        ))}
      </div>
      <div className="bg-bg-base border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
          <Archive size={20} className="text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-primary">Brak zarchiwizowanych rekordów</p>
        <p className="text-xs text-text-muted mt-1">Zarchiwizowane {tab === 'leads' ? 'leady' : 'klienty'} pojawią się tutaj</p>
      </div>
    </div>
  );
}
