'use client';

import { useState } from 'react';
import { Plus, Zap, Send } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { formatDate, formatCurrency, CAMPAIGN_STATUS_LABELS } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  planning: '#94a3b8',
  active: '#10b981',
  paused: '#f59e0b',
  done: '#6366f1',
};

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

export default function MarketingPage() {
  const { campaigns, loading } = useCampaigns();
  const [showAIModal, setShowAIModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [platform, setPlatform] = useState('linkedin');
  const [brief, setBrief] = useState('');
  const [variants, setVariants] = useState(2);
  const [results, setResults] = useState<string[]>([]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setResults([]);
    // Simulate AI generation
    await new Promise(r => setTimeout(r, 1500));
    setResults([
      '🚀 Szukasz skuteczniejszego zarządzania firmą? AutomationHub łączy CRM, finanse i marketing w jednym miejscu. Dowiedz się, jak nasi klienci zwiększyli efektywność o 40%. Link w komentarzu! #automatyzacja #biznes #CRM',
      '💡 Czy wiedziałeś, że ręczne zarządzanie leadami może kosztować Cię nawet 5h tygodniowo? Z AutomationHub wszystko dzieje się automatycznie. Wypróbuj za darmo → link w bio. #produktywnosc #startup',
    ]);
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Marketing</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAIModal(true)}>
            <Zap size={13} className="text-accent" />
            Agent AI
          </Button>
          <Button variant="primary" size="sm">
            <Plus size={14} />
            Nowa kampania
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktywne kampanie', value: '1' },
          { label: 'Posty w tym miesiącu', value: '8' },
          { label: 'Avg. otwarcia email', value: '24%' },
          { label: 'Budżet wydany', value: '3 500 zł' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-bg-base border border-border rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Kampanie</h2>
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-bg-base border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-text-primary">{c.name}</h3>
                  <Badge color={CAMPAIGN_STATUS_COLORS[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
                </div>
                <p className="text-xs text-text-muted">{c.description}</p>
                {c.start_date && (
                  <p className="text-xs text-text-muted mt-1">
                    {formatDate(c.start_date)} → {c.end_date ? formatDate(c.end_date) : '...'}
                  </p>
                )}
              </div>
              {c.budget && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-text-muted">Budżet</p>
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(c.budget, c.budget_currency)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent Modal */}
      <Modal open={showAIModal} onClose={() => setShowAIModal(false)} title="Agent AI — Generuj treści" size="xl">
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {PLATFORM_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setPlatform(p.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  platform === p.value ? 'border-accent bg-accent-subtle text-accent' : 'border-border text-text-secondary hover:border-border-strong'
                }`}>
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Brief / Temat</label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3}
              placeholder='np. "Promuj nową funkcję automatyzacji CRM, ton profesjonalny, skierowane do właścicieli MŚP"'
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Liczba wariantów:</span>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => setVariants(n)}
                className={`w-8 h-8 rounded-lg border text-sm font-medium transition-colors ${
                  variants === n ? 'border-accent bg-accent text-white' : 'border-border text-text-secondary hover:border-border-strong'
                }`}>
                {n}
              </button>
            ))}
          </div>

          <Button variant="primary" onClick={handleGenerate} disabled={!brief.trim() || generating} className="w-full">
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generuję...
              </span>
            ) : (
              <span className="flex items-center gap-2"><Zap size={14} /> Generuj posty</span>
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Wyniki:</p>
              {results.map((text, i) => (
                <div key={i} className="p-3 bg-bg-subtle border border-border rounded-lg">
                  <p className="text-sm text-text-primary leading-relaxed">{text}</p>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm">📋 Kopiuj</Button>
                    <Button variant="primary" size="sm">✅ Zaakceptuj</Button>
                    <Button variant="ghost" size="sm">🔄 Wygeneruj ponownie</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
