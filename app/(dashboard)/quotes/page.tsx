'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, MoreHorizontal, Eye, Copy, Trash2,
  X, FileText, Package, Clock, CheckCircle2,
  XCircle, AlertCircle, TrendingUp, Send, FileDown,
  Sparkles, ChevronDown, ChevronUp, Pencil, BookOpen, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Quote, QuoteLineItem, QuoteStatus } from '@/types';
import { useQuotes } from '@/hooks/useQuotes';
import { useServices, type Service } from '@/hooks/useServices';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:    { label: 'Szkic',          color: '#94a3b8', icon: FileText },
  sent:     { label: 'Wysłana',        color: '#3b82f6', icon: Send },
  accepted: { label: 'Zaakceptowana',  color: '#10b981', icon: CheckCircle2 },
  rejected: { label: 'Odrzucona',      color: '#ef4444', icon: XCircle },
  expired:  { label: 'Wygasła',        color: '#f59e0b', icon: AlertCircle },
};

const VAT_OPTIONS = [
  { value: '0',  label: '0%' },
  { value: '5',  label: '5%' },
  { value: '8',  label: '8%' },
  { value: '23', label: '23%' },
];

const UNIT_OPTIONS = [
  { value: 'szt',     label: 'szt.' },
  { value: 'godz',    label: 'godz.' },
  { value: 'mies',    label: 'mies.' },
  { value: 'projekt', label: 'projekt' },
  { value: 'dzień',   label: 'dzień' },
];

const CURRENCY_OPTIONS = [
  { value: 'PLN', label: 'PLN' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string = 'PLN'): string {
  const sym: Record<string, string> = { PLN: 'zł', EUR: '€', USD: '$' };
  const formatted = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency === 'PLN' ? `${formatted} ${sym[currency]}` : `${sym[currency] ?? currency} ${formatted}`;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function generateQuoteNumber(existing: Quote[]): string {
  const year = new Date().getFullYear();
  const max = existing
    .map(q => parseInt(q.number.split('/')[0]) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${String(max + 1).padStart(3, '0')}/${year}`;
}

function calcLineItem(item: Omit<QuoteLineItem, 'amount_net' | 'vat_amount' | 'amount_gross'>): QuoteLineItem {
  const amount_net = item.quantity * item.unit_price_net;
  const vat_amount = amount_net * (item.vat_rate / 100);
  const amount_gross = amount_net + vat_amount;
  return { ...item, amount_net, vat_amount, amount_gross };
}

function calcTotals(items: QuoteLineItem[], discountPercent: number) {
  const raw_net = items.reduce((s, i) => s + i.amount_net, 0);
  const raw_vat = items.reduce((s, i) => s + i.vat_amount, 0);
  const discount = raw_net * (discountPercent / 100);
  const total_net = raw_net - discount;
  const total_vat = raw_vat * (1 - discountPercent / 100);
  const total_gross = total_net + total_vat;
  return { total_net, total_vat, total_gross };
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_QUOTES: Quote[] = [
  {
    id: 'q1',
    number: '001/2026',
    title: 'Automatyzacja działu sprzedaży',
    client_name: 'TechCorp Sp. z o.o.',
    status: 'accepted',
    created_at: '2026-03-10',
    valid_until: '2026-04-10',
    currency: 'PLN',
    discount_percent: 5,
    notes: 'Oferta obejmuje pełne wdrożenie systemu CRM wraz z integracją z istniejącymi narzędziami.',
    items: [
      calcLineItem({ id: 'i1', name: 'Automatyzacja procesów', quantity: 1, unit: 'projekt', unit_price_net: 4500, vat_rate: 23 }),
      calcLineItem({ id: 'i2', name: 'Integracja systemów', quantity: 1, unit: 'projekt', unit_price_net: 3200, vat_rate: 23 }),
      calcLineItem({ id: 'i3', name: 'Szkolenie zespołu', quantity: 4, unit: 'godz', unit_price_net: 450, vat_rate: 23 }),
    ],
    total_net: 0, total_vat: 0, total_gross: 0,
  },
  {
    id: 'q2',
    number: '002/2026',
    title: 'Strona internetowa + SEO',
    client_name: 'Manufaktura Północ',
    status: 'sent',
    created_at: '2026-04-01',
    valid_until: '2026-05-01',
    currency: 'PLN',
    discount_percent: 0,
    notes: '',
    items: [
      calcLineItem({ id: 'i4', name: 'Tworzenie stron WWW', quantity: 1, unit: 'projekt', unit_price_net: 5500, vat_rate: 23 }),
      calcLineItem({ id: 'i5', name: 'Opieka SEO', quantity: 3, unit: 'mies', unit_price_net: 1500, vat_rate: 23 }),
    ],
    total_net: 0, total_vat: 0, total_gross: 0,
  },
  {
    id: 'q3',
    number: '003/2026',
    title: 'Wsparcie techniczne Q2',
    client_name: 'Retail Pro S.A.',
    status: 'draft',
    created_at: '2026-04-12',
    valid_until: '2026-05-12',
    currency: 'PLN',
    discount_percent: 10,
    notes: 'Oferta wstępna, do ustalenia szczegóły zakresu.',
    items: [
      calcLineItem({ id: 'i6', name: 'Wsparcie techniczne', quantity: 3, unit: 'mies', unit_price_net: 2800, vat_rate: 23 }),
      calcLineItem({ id: 'i7', name: 'Konsultacje', quantity: 8, unit: 'godz', unit_price_net: 350, vat_rate: 23 }),
    ],
    total_net: 0, total_vat: 0, total_gross: 0,
  },
  {
    id: 'q4',
    number: '004/2026',
    title: 'Marketing automation pakiet startowy',
    client_name: 'GreenLeaf Marketing',
    status: 'rejected',
    created_at: '2026-03-25',
    valid_until: '2026-04-25',
    currency: 'PLN',
    discount_percent: 0,
    notes: '',
    items: [
      calcLineItem({ id: 'i8', name: 'Marketing automation', quantity: 6, unit: 'mies', unit_price_net: 2200, vat_rate: 23 }),
      calcLineItem({ id: 'i9', name: 'Analiza procesów', quantity: 1, unit: 'projekt', unit_price_net: 1800, vat_rate: 23 }),
    ],
    total_net: 0, total_vat: 0, total_gross: 0,
  },
  {
    id: 'q5',
    number: '005/2026',
    title: 'Audyt i wdrożenie nowego CRM',
    client_name: 'LogiTrans Sp. k.',
    status: 'expired',
    created_at: '2026-02-15',
    valid_until: '2026-03-15',
    currency: 'EUR',
    discount_percent: 0,
    notes: 'Budżet klienta poniżej naszego minimum — wymaga renegocjacji.',
    items: [
      calcLineItem({ id: 'i10', name: 'Audyt systemów IT', quantity: 1, unit: 'projekt', unit_price_net: 2500, vat_rate: 23 }),
      calcLineItem({ id: 'i11', name: 'Wdrożenie', quantity: 1, unit: 'projekt', unit_price_net: 6000, vat_rate: 23 }),
    ],
    total_net: 0, total_vat: 0, total_gross: 0,
  },
].map(q => {
  const { total_net, total_vat, total_gross } = calcTotals(q.items, q.discount_percent);
  return { ...q, total_net, total_vat, total_gross };
}) as Quote[];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge color={cfg.color}>
      {cfg.label}
    </Badge>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-bg-base border border-border rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted mb-0.5">{label}</p>
        <p className="text-lg font-semibold text-text-primary leading-none">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Line Item Row ─────────────────────────────────────────────────────────────

interface LineItemRowProps {
  item: QuoteLineItem;
  onChange: (updated: QuoteLineItem) => void;
  onRemove: () => void;
}

function LineItemRow({ item, onChange, onRemove }: LineItemRowProps) {
  const update = (patch: Partial<QuoteLineItem>) => {
    const merged = { ...item, ...patch };
    const amount_net = merged.quantity * merged.unit_price_net;
    const vat_amount = amount_net * (merged.vat_rate / 100);
    onChange({ ...merged, amount_net, vat_amount, amount_gross: amount_net + vat_amount });
  };

  // Cena brutto za jednostkę — wyliczana z netto, ale też edytowalna wprost
  // (wpisanie brutto przelicza netto, żeby nie trzeba było liczyć na kalkulatorze).
  const unitPriceGross = item.unit_price_net * (1 + item.vat_rate / 100);
  const updateGross = (grossValue: number) => {
    const net = grossValue / (1 + item.vat_rate / 100);
    update({ unit_price_net: Math.round(net * 100) / 100 });
  };

  return (
    <div className="grid gap-1.5 py-2.5 border-b border-border last:border-0"
      style={{ gridTemplateColumns: '1fr 55px 78px 68px 56px 68px 78px 22px' }}>
      <div className="flex flex-col gap-1 min-w-0">
        <input
          value={item.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="Nazwa usługi"
          className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
        />
        <input
          value={item.description ?? ''}
          onChange={e => update({ description: e.target.value })}
          placeholder="Opis (opcjonalnie)"
          className="w-full border border-border/60 rounded-md px-2.5 py-1 text-xs bg-bg-subtle text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/20 focus:border-accent/40"
        />
      </div>

      <input
        type="number" min="0.01" step="0.01"
        value={item.quantity}
        onChange={e => update({ quantity: parseFloat(e.target.value) || 0 })}
        className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-bg-base text-text-primary text-right focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
      />

      <select
        value={item.unit}
        onChange={e => update({ unit: e.target.value as QuoteLineItem['unit'] })}
        className="border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none"
      >
        {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        type="number" min="0" step="0.01"
        value={item.unit_price_net}
        onChange={e => update({ unit_price_net: parseFloat(e.target.value) || 0 })}
        title="Cena netto"
        className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-bg-base text-text-primary text-right focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
      />

      <select
        value={String(item.vat_rate)}
        onChange={e => update({ vat_rate: parseInt(e.target.value) })}
        className="border border-border rounded-md px-2 py-1.5 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none"
      >
        {VAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        type="number" min="0" step="0.01"
        value={Math.round(unitPriceGross * 100) / 100}
        onChange={e => updateGross(parseFloat(e.target.value) || 0)}
        title="Cena brutto"
        className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-bg-base text-text-primary text-right focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
      />

      <div className="flex items-center justify-end">
        <span className="text-sm font-medium text-text-primary text-right" title="Wartość pozycji brutto">
          {new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.amount_gross)}
        </span>
      </div>

      <button onClick={onRemove}
        className="flex items-center justify-center text-text-muted hover:text-red-500 transition-colors self-start mt-2">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Quote Builder Modal ───────────────────────────────────────────────────────

interface QuoteBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (quote: Quote, asDraft: boolean) => void;
  initial?: Quote | null;
  existingQuotes: Quote[];
}

function emptyItem(): QuoteLineItem {
  return calcLineItem({
    id: generateId(), name: '', description: '', quantity: 1,
    unit: 'projekt', unit_price_net: 0, vat_rate: 23,
  });
}

function QuoteBuilder({ open, onClose, onSave, initial, existingQuotes }: QuoteBuilderProps) {
  const [clientName, setClientName] = useState(initial?.client_name ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? addDays(30));
  const [currency, setCurrency] = useState<'PLN' | 'EUR' | 'USD'>(initial?.currency ?? 'PLN');
  const [items, setItems] = useState<QuoteLineItem[]>(initial?.items ?? [emptyItem()]);
  const [discount, setDiscount] = useState(initial?.discount_percent ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const { services } = useServices();

  const totals = useMemo(() => calcTotals(items, discount), [items, discount]);

  const addFromCatalog = (svc: Service) => {
    setItems(prev => [...prev, calcLineItem({
      id: generateId(), name: svc.name, description: '',
      quantity: 1, unit: svc.unit,
      unit_price_net: svc.unit_price_net, vat_rate: svc.vat_rate,
    })]);
  };

  const handleSave = (asDraft: boolean) => {
    const quote: Quote = {
      id: initial?.id ?? generateId(),
      number: initial?.number ?? generateQuoteNumber(existingQuotes),
      title, client_name: clientName,
      status: asDraft ? 'draft' : 'sent',
      created_at: initial?.created_at ?? today(),
      valid_until: validUntil,
      currency, items, discount_percent: discount, notes,
      ...totals,
    };
    onSave(quote, asDraft);
    onClose();
  };

  const filteredCatalog = services.filter(s =>
    s.is_active && s.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} size="xl"
      title={initial ? `Edytuj ofertę ${initial.number}` : 'Nowa oferta'}
      className="!max-w-4xl">
      <div className="p-5 space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-3 gap-4">
          <Input label="Klient *" value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Nazwa firmy / klienta" className="col-span-1" />
          <Input label="Tytuł oferty *" value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Krótki opis zakresu" className="col-span-1" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Ważna do" type="date" value={validUntil}
              onChange={e => setValidUntil(e.target.value)} />
            <Select label="Waluta" value={currency}
              onChange={e => setCurrency(e.target.value as 'PLN' | 'EUR' | 'USD')}
              options={CURRENCY_OPTIONS} />
          </div>
        </div>

        {/* Catalog */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setCatalogOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-subtle hover:bg-bg-muted transition-colors text-sm font-medium text-text-secondary"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              Katalog usług — szybkie dodawanie
            </span>
            {catalogOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {catalogOpen && (
            <div className="p-3 bg-bg-base border-t border-border">
              <input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Szukaj usługi..."
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-bg-subtle placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 mb-3"
              />
              <div className="grid grid-cols-3 gap-2">
                {filteredCatalog.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => addFromCatalog(svc)}
                    className="flex items-start gap-2 p-2.5 rounded-lg border border-border hover:border-accent/50 hover:bg-accent-subtle text-left transition-all group"
                  >
                    <Package size={12} className="text-text-muted group-hover:text-accent mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary leading-tight">{svc.name}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {new Intl.NumberFormat('pl-PL').format(svc.unit_price_net)} zł / {svc.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary">Pozycje oferty</h3>
            <Button size="sm" variant="outline" onClick={() => setItems(p => [...p, emptyItem()])}>
              <Plus size={13} /> Dodaj pozycję
            </Button>
          </div>

          {/* Column headers */}
          <div className="grid text-[11px] font-medium text-text-muted px-0 mb-1"
            style={{ gridTemplateColumns: '1fr 55px 78px 68px 56px 68px 78px 22px' }}>
            <span>Nazwa usługi / opis</span>
            <span className="text-right">Ilość</span>
            <span className="pl-2">Jednostka</span>
            <span className="text-right">Netto</span>
            <span className="pl-2">VAT</span>
            <span className="text-right">Brutto</span>
            <span className="text-right">Wartość</span>
            <span />
          </div>

          <div className="border border-border rounded-xl px-3 overflow-hidden">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                Brak pozycji. Dodaj usługę lub wybierz z katalogu.
              </div>
            ) : (
              items.map((item, idx) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onChange={updated => setItems(p => p.map((it, i) => i === idx ? updated : it))}
                  onRemove={() => setItems(p => p.filter((_, i) => i !== idx))}
                />
              ))
            )}
          </div>
        </div>

        {/* Summary + notes */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notatki / uwagi</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Warunki płatności, dodatkowe informacje..."
              rows={4}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 resize-none"
            />
          </div>

          <div className="bg-bg-subtle rounded-xl p-4 border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Rabat</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="0" max="100" step="1"
                  value={discount}
                  onChange={e => setDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-16 text-right border border-border rounded-md px-2 py-1 text-sm bg-bg-base focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <span className="text-sm text-text-muted">%</span>
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Suma netto</span>
              <span className="text-sm font-medium text-text-primary">{formatMoney(totals.total_net, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">VAT</span>
              <span className="text-sm text-text-secondary">{formatMoney(totals.total_vat, currency)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Suma brutto</span>
              <span className="text-base font-bold text-accent">{formatMoney(totals.total_gross, currency)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="secondary" onClick={() => handleSave(true)}>
            <FileText size={14} /> Zapisz szkic
          </Button>
          <Button variant="primary" onClick={() => handleSave(false)}>
            <Send size={14} /> Zapisz jako wysłaną
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Quote Preview Panel ───────────────────────────────────────────────────────

function QuotePreviewPanel({ quote, onClose, onEdit, onStatusChange }: {
  quote: Quote;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: QuoteStatus) => void;
}) {
  const cfg = STATUS_CONFIG[quote.status];

  return (
    <div className="flex flex-col h-full border-l border-border bg-bg-base">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-text-muted">{quote.number}</span>
            <StatusBadge status={quote.status} />
          </div>
          <h2 className="text-sm font-semibold text-text-primary leading-tight">{quote.title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{quote.client_name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted transition-colors flex-shrink-0 ml-2">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-bg-subtle rounded-lg p-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Wystawiona</p>
            <p className="text-sm font-medium text-text-primary">{quote.created_at}</p>
          </div>
          <div className="bg-bg-subtle rounded-lg p-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Ważna do</p>
            <p className="text-sm font-medium text-text-primary">{quote.valid_until}</p>
          </div>
        </div>

        {/* Items */}
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Pozycje</h3>
          <div className="space-y-1.5">
            {quote.items.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-2 p-2.5 bg-bg-subtle rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{item.name}</p>
                  {item.description && <p className="text-[10px] text-text-muted mt-0.5">{item.description}</p>}
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {item.quantity} {item.unit} × {formatMoney(item.unit_price_net, quote.currency)} netto
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-text-primary">{formatMoney(item.amount_gross, quote.currency)}</p>
                  <p className="text-[10px] text-text-muted">VAT {item.vat_rate}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-bg-subtle rounded-xl p-3 border border-border space-y-1.5">
          {quote.discount_percent > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Rabat ({quote.discount_percent}%)</span>
              <span className="text-red-500">
                −{formatMoney(quote.items.reduce((s, i) => s + i.amount_net, 0) * (quote.discount_percent / 100), quote.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Suma netto</span>
            <span className="text-text-secondary font-medium">{formatMoney(quote.total_net, quote.currency)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">VAT</span>
            <span className="text-text-secondary">{formatMoney(quote.total_vat, quote.currency)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-text-primary">Brutto</span>
            <span className="text-sm font-bold text-accent">{formatMoney(quote.total_gross, quote.currency)}</span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Notatki</h3>
            <p className="text-xs text-text-secondary bg-bg-subtle rounded-lg p-3">{quote.notes}</p>
          </div>
        )}

        {/* Status change */}
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Zmień status</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  quote.status === s
                    ? 'text-white border-transparent'
                    : 'text-text-secondary border-border hover:border-border-strong bg-bg-base hover:bg-bg-subtle'
                )}
                style={quote.status === s ? { backgroundColor: STATUS_CONFIG[s].color, borderColor: STATUS_CONFIG[s].color } : {}}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil size={13} /> Edytuj
        </Button>
        <Button variant="primary" size="sm" className="flex-1">
          <FileDown size={13} /> Eksport PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Services Catalog Tab ─────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  szt: 'szt.', godz: 'godz.', mies: 'mies.', projekt: 'projekt', 'dzień': 'dzień',
};

function ServicesCatalog() {
  const { services, loading, createService, updateService, deleteService } = useServices();
  const [editing, setEditing] = useState<Service | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<Service>>({
    name: '', unit: 'projekt', unit_price_net: 0, vat_rate: 23, description: '',
  });

  function openAdd() {
    setForm({ name: '', unit: 'projekt', unit_price_net: 0, vat_rate: 23, description: '' });
    setAdding(true);
    setEditing(null);
  }

  function openEdit(s: Service) {
    setForm({ name: s.name, unit: s.unit, unit_price_net: s.unit_price_net, vat_rate: s.vat_rate, description: s.description });
    setEditing(s);
    setAdding(false);
  }

  async function handleSubmit() {
    if (!form.name || !form.unit_price_net) return;
    if (editing) {
      await updateService(editing.id, form);
      setEditing(null);
    } else {
      await createService(form as any);
      setAdding(false);
    }
  }

  const isOpen = adding || !!editing;

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="flex items-center justify-between mb-4 mt-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Katalog usług</p>
          <p className="text-xs text-text-muted mt-0.5">Wewnętrzny cennik — używany przy tworzeniu ofert</p>
        </div>
        <Button variant="primary" size="sm" onClick={openAdd}>
          <Plus size={14} /> Dodaj usługę
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
          <div className="grid text-[11px] font-semibold text-text-muted uppercase tracking-wide px-4 py-2.5 bg-bg-subtle border-b border-border"
            style={{ gridTemplateColumns: '1fr 120px 80px 80px 90px 64px' }}>
            <span>Nazwa</span>
            <span>Opis</span>
            <span className="text-right">Cena netto</span>
            <span className="text-center">VAT</span>
            <span>Jednostka</span>
            <span />
          </div>
          {services.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen size={28} className="text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Brak usług w katalogu</p>
            </div>
          ) : services.map(s => (
            <div key={s.id}
              className="grid items-center px-4 py-3 border-b border-border/60 last:border-0 hover:bg-bg-subtle group transition-colors"
              style={{ gridTemplateColumns: '1fr 120px 80px 80px 90px 64px' }}
            >
              <span className="text-sm font-medium text-text-primary">{s.name}</span>
              <span className="text-xs text-text-muted truncate pr-2">{s.description ?? '—'}</span>
              <span className="text-sm font-semibold text-text-primary text-right">
                {new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2 }).format(s.unit_price_net)} zł
              </span>
              <span className="text-xs text-text-secondary text-center">{s.vat_rate}%</span>
              <span className="text-xs text-text-muted">{UNIT_LABELS[s.unit] ?? s.unit}</span>
              <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)}
                  className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                  <Pencil size={12} />
                </button>
                <button onClick={() => deleteService(s.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={isOpen} onClose={() => { setAdding(false); setEditing(null); }}
        title={editing ? 'Edytuj usługę' : 'Nowa usługa'}>
        <div className="space-y-3 p-4">
          <Input
            label="Nazwa usługi"
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="np. Konsultacje, Wdrożenie CRM"
          />
          <Input
            label="Opis (opcjonalny)"
            value={form.description ?? ''}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Krótki opis zakresu usługi"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cena netto (PLN)"
              type="number"
              value={form.unit_price_net ?? ''}
              onChange={e => setForm(f => ({ ...f, unit_price_net: parseFloat(e.target.value) || 0 }))}
            />
            <Input
              label="Cena brutto (PLN)"
              type="number"
              value={form.unit_price_net != null && form.vat_rate != null
                ? Math.round(form.unit_price_net * (1 + form.vat_rate / 100) * 100) / 100
                : ''}
              onChange={e => {
                const gross = parseFloat(e.target.value) || 0;
                setForm(f => ({ ...f, unit_price_net: Math.round((gross / (1 + (f.vat_rate ?? 23) / 100)) * 100) / 100 }));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Jednostka"
              value={form.unit ?? 'projekt'}
              onChange={e => setForm(f => ({ ...f, unit: (e.target as HTMLSelectElement).value as Service['unit'] }))}
              options={[
                { value: 'szt', label: 'szt.' },
                { value: 'godz', label: 'godz.' },
                { value: 'mies', label: 'mies.' },
                { value: 'projekt', label: 'projekt' },
                { value: 'dzień', label: 'dzień' },
              ]}
            />
            <Select
              label="VAT"
              value={String(form.vat_rate ?? 23)}
              onChange={e => setForm(f => ({ ...f, vat_rate: parseInt((e.target as HTMLSelectElement).value) }))}
              options={[
                { value: '0', label: '0%' },
                { value: '5', label: '5%' },
                { value: '8', label: '8%' },
                { value: '23', label: '23%' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setAdding(false); setEditing(null); }}>Anuluj</Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editing ? 'Zapisz' : 'Dodaj'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [activeTab, setActiveTab] = useState<'quotes' | 'catalog'>('quotes');
  const { quotes, loading: quotesLoading, saveQuote, deleteQuote, updateStatus, setQuotes } = useQuotes();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all');
  const [selected, setSelected] = useState<Quote | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Quote | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => quotes.filter(q => {
    const matchSearch = !search ||
      q.client_name.toLowerCase().includes(search.toLowerCase()) ||
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.number.includes(search);
    const matchStatus = filterStatus === 'all' || q.status === filterStatus;
    return matchSearch && matchStatus;
  }), [quotes, search, filterStatus]);

  const stats = useMemo(() => ({
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalValue: quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total_net, 0),
  }), [quotes]);

  const handleSave = useCallback(async (quote: Quote) => {
    const saved = await saveQuote(quote);
    setSelected(saved);
  }, [saveQuote]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteQuote(id);
    if (selected?.id === id) setSelected(null);
    setMenuOpen(null);
  }, [selected, deleteQuote]);

  const handleDuplicate = useCallback(async (quote: Quote) => {
    const dup: Quote = {
      ...quote,
      id: generateId(),
      number: generateQuoteNumber(quotes),
      status: 'draft',
      created_at: today(),
    };
    await saveQuote(dup);
    setMenuOpen(null);
  }, [quotes, saveQuote]);

  const handleStatusChange = useCallback(async (id: string, status: QuoteStatus) => {
    await updateStatus(id, status);
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }, [updateStatus]);

  const openEdit = (quote: Quote) => {
    setEditTarget(quote);
    setBuilderOpen(true);
    setMenuOpen(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className={cn('flex flex-col flex-1 min-w-0 overflow-hidden', selected ? 'border-r border-border' : '')}>

        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-bg-base flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-bg-subtle border border-border rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('quotes')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'quotes'
                  ? 'bg-bg-base text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <FileText size={14} /> Oferty
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'catalog'
                  ? 'bg-bg-base text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <BookOpen size={14} /> Katalog usług
            </button>
          </div>
          {activeTab === 'quotes' && (
            <Button variant="primary" onClick={() => { setEditTarget(null); setBuilderOpen(true); }}>
              <Plus size={15} /> Nowa oferta
            </Button>
          )}
        </div>

        {activeTab === 'catalog' && <ServicesCatalog />}

        {activeTab === 'quotes' && <>
        {/* Stats */}
        <div className="flex-shrink-0 px-6 py-4 grid grid-cols-5 gap-3">
          <StatCard label="Wszystkie oferty" value={stats.total} icon={FileText} color="#6366f1" />
          <StatCard label="Szkice" value={stats.draft} icon={Clock} color="#94a3b8" />
          <StatCard label="Wysłane" value={stats.sent} icon={Send} color="#3b82f6" />
          <StatCard label="Zaakceptowane" value={stats.accepted} icon={CheckCircle2} color="#10b981" />
          <StatCard label="Wartość wygranych" value={formatMoney(stats.totalValue)} icon={TrendingUp} color="#10b981"
            sub="netto PLN" />
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj oferty, klienta..."
              className="w-full border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                  filterStatus === s
                    ? 'text-white border-transparent'
                    : 'text-text-secondary border-border bg-bg-base hover:bg-bg-subtle'
                )}
                style={filterStatus === s && s !== 'all'
                  ? { backgroundColor: STATUS_CONFIG[s as QuoteStatus].color, borderColor: STATUS_CONFIG[s as QuoteStatus].color }
                  : filterStatus === s ? { backgroundColor: '#0f172a', borderColor: '#0f172a' }
                  : {}}
              >
                {s === 'all' ? 'Wszystkie' : STATUS_CONFIG[s as QuoteStatus].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid text-[11px] font-semibold text-text-muted uppercase tracking-wide px-4 py-2.5 bg-bg-subtle border-b border-border"
              style={{ gridTemplateColumns: '90px 1fr 1fr 100px 100px 110px 90px 36px' }}>
              <span>Nr oferty</span>
              <span>Klient</span>
              <span>Tytuł</span>
              <span>Wystawiona</span>
              <span>Ważna do</span>
              <span className="text-right">Wartość netto</span>
              <span>Status</span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <FileText size={32} className="text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary font-medium">Brak ofert</p>
                <p className="text-xs text-text-muted mt-1">
                  {search || filterStatus !== 'all' ? 'Zmień filtry lub' : ''} Utwórz pierwszą ofertę
                </p>
              </div>
            ) : (
              filtered.map(quote => {
                const isSelected = selected?.id === quote.id;
                return (
                  <div
                    key={quote.id}
                    onClick={() => setSelected(isSelected ? null : quote)}
                    className={cn(
                      'grid items-center px-4 py-3 border-b border-border/60 last:border-0 cursor-pointer transition-colors group',
                      isSelected ? 'bg-accent-subtle' : 'hover:bg-bg-subtle'
                    )}
                    style={{ gridTemplateColumns: '90px 1fr 1fr 100px 100px 110px 90px 36px' }}
                  >
                    <span className="text-xs font-mono text-text-muted">{quote.number}</span>
                    <span className="text-sm font-medium text-text-primary truncate pr-2">{quote.client_name}</span>
                    <span className="text-sm text-text-secondary truncate pr-2">{quote.title}</span>
                    <span className="text-xs text-text-muted">{quote.created_at}</span>
                    <span className="text-xs text-text-muted">{quote.valid_until}</span>
                    <span className="text-sm font-semibold text-text-primary text-right">
                      {formatMoney(quote.total_net, quote.currency)}
                    </span>
                    <span><StatusBadge status={quote.status} /></span>
                    <div className="relative flex justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpen(menuOpen === quote.id ? null : quote.id)}
                        className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-muted opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuOpen === quote.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-bg-base border border-border rounded-lg shadow-lg z-20 py-1">
                          <button onClick={() => setSelected(quote)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors">
                            <Eye size={12} /> Podgląd
                          </button>
                          <button onClick={() => openEdit(quote)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors">
                            <Pencil size={12} /> Edytuj
                          </button>
                          <button onClick={() => handleDuplicate(quote)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors">
                            <Copy size={12} /> Duplikuj
                          </button>
                          <div className="h-px bg-border my-1" />
                          <button onClick={() => handleDelete(quote.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={12} /> Usuń
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>}
      </div>

      {/* Preview panel */}
      {selected && activeTab === 'quotes' && (
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <QuotePreviewPanel
            quote={selected}
            onClose={() => setSelected(null)}
            onEdit={() => openEdit(selected)}
            onStatusChange={status => handleStatusChange(selected.id, status)}
          />
        </div>
      )}

      {/* Quote builder modal */}
      <QuoteBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        existingQuotes={quotes}
      />

      {/* Close menu on outside click */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
