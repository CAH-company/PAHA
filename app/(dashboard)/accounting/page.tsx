'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Plus, Download, MoreHorizontal, Paperclip,
  ChevronLeft, ChevronRight, Trash2, TrendingUp, TrendingDown,
  DollarSign, ArrowUpRight, ArrowDownRight, Percent,
  Upload, FileText, FileSpreadsheet, ChevronDown, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useCosts } from '@/hooks/useCosts';
import { useRevenues } from '@/hooks/useRevenues';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Cost, Revenue } from '@/types';

const MONTH_LABELS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const MONTH_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exportCSV(rows: Cost[] | Revenue[], label: string, type: 'costs' | 'revenues') {
  const isCost = type === 'costs';
  const headers = isCost
    ? ['Data','Tytuł','Kategoria','Kto poniósł','Netto','VAT%','VAT kwota','Brutto','Waluta','Kwota PLN','Projekt','Notatka']
    : ['Data','Tytuł','Kategoria','Nr faktury','Status','Netto','VAT%','VAT kwota','Brutto','Waluta','Kwota PLN','Projekt','Notatka'];
  const data = rows.map((r: any) => isCost
    ? [r.cost_date, `"${r.title}"`, `"${r.category?.name??''}"`, `"${r.paid_by_employee?.name??''}"`,
       String(r.amount_net??'').replace('.',','), r.vat_rate!=null?String(r.vat_rate):'zw.', String(r.vat_amount??'').replace('.',','),
       String(r.amount).replace('.',','), r.currency, String(r.amount_pln??r.amount).replace('.',','),
       `"${r.project_name??''}"`, `"${r.note??''}"`]
    : [r.revenue_date, `"${r.title}"`, `"${r.category?.name??''}"`, `"${r.invoice_number??''}"`,
       r.status, String(r.amount_net??'').replace('.',','), r.vat_rate!=null?String(r.vat_rate):'zw.', String(r.vat_amount??'').replace('.',','),
       String(r.amount).replace('.',','), r.currency, String(r.amount_pln??r.amount).replace('.',','),
       `"${r.project_name??''}"`, `"${r.note??''}"`]
  );
  const csv = [headers, ...data].map(r => r.join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `${type}_${label}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function useMonthFilter() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<{ year: number; month: number } | null>({
    year: now.getFullYear(), month: now.getMonth(),
  });
  const isCurrentMonth = filterMonth
    ? filterMonth.year === now.getFullYear() && filterMonth.month === now.getMonth()
    : false;
  const prevMonth = () => setFilterMonth(m => {
    if (!m) return { year: now.getFullYear(), month: now.getMonth() };
    const d = new Date(m.year, m.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const nextMonth = () => setFilterMonth(m => {
    if (!m || isCurrentMonth) return m;
    const d = new Date(m.year, m.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const dateRange = filterMonth ? {
    from: new Date(filterMonth.year, filterMonth.month, 1).toISOString().split('T')[0],
    to: new Date(filterMonth.year, filterMonth.month + 1, 0).toISOString().split('T')[0],
  } : null;
  const label = filterMonth ? `${MONTH_LABELS[filterMonth.month]}_${filterMonth.year}` : 'wszystkie';
  const title = filterMonth ? `${MONTH_LABELS[filterMonth.month]} ${filterMonth.year}` : 'Wszystkie miesiące';
  return { filterMonth, setFilterMonth, prevMonth, nextMonth, isCurrentMonth, dateRange, label, title };
}

// ─── VAT helper ──────────────────────────────────────────────────────────────
const VAT_OPTIONS = [
  { value: '23', label: '23%' },
  { value: '8',  label: '8%'  },
  { value: '5',  label: '5%'  },
  { value: '0',  label: '0%'  },
  { value: 'zw', label: 'zw.' },
];

function computeVat(amount: number, vatRateStr: string, mode: 'netto' | 'brutto') {
  if (vatRateStr === 'zw' || !amount) {
    return { net: amount, vat: 0, gross: amount, rate: null };
  }
  const r = parseFloat(vatRateStr) / 100;
  if (mode === 'netto') {
    const gross = Math.round(amount * (1 + r) * 100) / 100;
    return { net: amount, vat: Math.round((gross - amount) * 100) / 100, gross, rate: parseFloat(vatRateStr) };
  } else {
    const net = Math.round(amount / (1 + r) * 100) / 100;
    return { net, vat: Math.round((amount - net) * 100) / 100, gross: amount, rate: parseFloat(vatRateStr) };
  }
}

function VatBlock({ amount, vatRate, mode, currency }: { amount: string; vatRate: string; mode: 'netto' | 'brutto'; currency: string }) {
  const v = computeVat(parseFloat(amount) || 0, vatRate, mode);
  if (!amount || parseFloat(amount) <= 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 p-3 bg-bg-subtle rounded-lg border border-border text-xs">
      <div>
        <p className="text-text-muted mb-0.5">Netto</p>
        <p className="font-semibold text-text-primary">{formatCurrency(v.net, currency as any)}</p>
      </div>
      <div>
        <p className="text-text-muted mb-0.5">VAT {vatRate === 'zw' ? '(zw.)' : `${vatRate}%`}</p>
        <p className="font-semibold text-text-primary">{formatCurrency(v.vat, currency as any)}</p>
      </div>
      <div>
        <p className="text-text-muted mb-0.5">Brutto</p>
        <p className="font-semibold text-accent">{formatCurrency(v.gross, currency as any)}</p>
      </div>
    </div>
  );
}

// ─── Add Cost Modal ───────────────────────────────────────────────────────────
const EMPTY_COST = { title:'', category_id:'', amount:'', currency:'PLN', exchange_rate:'1',
  vat_rate:'23', input_mode:'netto' as 'netto'|'brutto',
  cost_date: new Date().toISOString().split('T')[0], paid_by:'', project_name:'', note:'' };

function AddCostModal({ open, onClose, onSuccess, categoryOptions, employeeOptions, defaultPaidBy, prefill }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  categoryOptions: { value: string; label: string }[];
  employeeOptions: { value: string; label: string }[];
  defaultPaidBy: string;
  prefill?: Partial<typeof EMPTY_COST>;
}) {
  const [form, setForm] = useState({ ...EMPTY_COST, paid_by: defaultPaidBy });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof EMPTY_COST) => (e: React.ChangeEvent<any>) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (open) setForm({ ...EMPTY_COST, paid_by: defaultPaidBy, ...prefill });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Tytuł jest wymagany.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Podaj kwotę większą od 0.'); return; }
    if (!form.paid_by) { setError('Wskaż kto poniósł koszt.'); return; }
    setSaving(true); setError('');
    const supabase = createClient();
    const { net, vat, gross, rate } = computeVat(parseFloat(form.amount), form.vat_rate, form.input_mode);
    const exchangeRate = parseFloat(form.exchange_rate) || 1;
    const grossPln = form.currency === 'PLN' ? gross : Math.round(gross * exchangeRate * 100) / 100;
    const { error: err } = await supabase.from('costs').insert({
      title: form.title.trim(), category_id: form.category_id || null,
      amount: gross, amount_net: net, vat_rate: rate, vat_amount: vat,
      amount_pln: grossPln, currency: form.currency, exchange_rate: exchangeRate,
      cost_date: form.cost_date, paid_by: form.paid_by,
      project_name: form.project_name.trim() || null,
      note: form.note.trim() || null, created_by: form.paid_by,
    });
    setSaving(false);
    if (err) setError(err.message);
    else { setForm({ ...EMPTY_COST, paid_by: defaultPaidBy }); onSuccess(); }
  }

  return (
    <Modal open={open} onClose={() => { setError(''); setForm({ ...EMPTY_COST, paid_by: defaultPaidBy }); onClose(); }} title="Dodaj koszt" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="p-5 space-y-4">
          <Input label="Tytuł *" placeholder="np. Subskrypcja narzędzia X" value={form.title} onChange={set('title')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Kategoria" options={[{value:'',label:'Brak'}, ...categoryOptions]} value={form.category_id} onChange={set('category_id')} />
            <Select label="Waluta" options={[{value:'PLN',label:'PLN'},{value:'EUR',label:'EUR'},{value:'USD',label:'USD'}]} value={form.currency} onChange={set('currency')} />
          </div>
          {form.currency !== 'PLN' && (
            <Input label={`Kurs (1 ${form.currency} = ? PLN)`} type="number" min="0.01" step="0.0001" value={form.exchange_rate} onChange={set('exchange_rate')} />
          )}
          {/* Kwota + VAT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex bg-bg-muted rounded-lg p-0.5 text-xs">
                {(['netto','brutto'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setForm(f => ({ ...f, input_mode: m }))}
                    className={cn('px-3 py-1 rounded-md font-medium transition-colors capitalize',
                      form.input_mode === m ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted')}>
                    {m}
                  </button>
                ))}
              </div>
              <span className="text-xs text-text-muted">— tryb wprowadzania</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Kwota ${form.input_mode} *`}
                type="number" min="0.01" step="0.01"
                value={form.amount} onChange={set('amount')}
              />
              <Select label="Stawka VAT" options={VAT_OPTIONS} value={form.vat_rate} onChange={set('vat_rate')} />
            </div>
            <VatBlock amount={form.amount} vatRate={form.vat_rate} mode={form.input_mode} currency={form.currency} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" type="date" value={form.cost_date} onChange={set('cost_date')} />
            <Select label="Kto poniósł *" options={[{value:'',label:'Wybierz osobę'}, ...employeeOptions]} value={form.paid_by} onChange={set('paid_by')} />
          </div>
          <Input label="Projekt" placeholder="Opcjonalny opis projektu" value={form.project_name} onChange={set('project_name')} />
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notatka</label>
            <textarea rows={2} value={form.note} onChange={set('note')} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
          <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Zapisuję…' : 'Dodaj koszt'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const EMPTY_REV = { title:'', category_id:'', amount:'', currency:'PLN', exchange_rate:'1',
  vat_rate:'23', input_mode:'netto' as 'netto'|'brutto',
  revenue_date: new Date().toISOString().split('T')[0], invoice_number:'', status:'paid', project_name:'', note:'' };

const STATUS_LABELS: Record<string, string> = { paid: 'Opłacona', pending: 'Oczekuje', overdue: 'Przeterminowana' };
const STATUS_COLORS: Record<string, string> = { paid: '#10b981', pending: '#f59e0b', overdue: '#ef4444' };

function AddRevenueModal({ open, onClose, onSuccess, categoryOptions, prefill }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  categoryOptions: { value: string; label: string }[];
  prefill?: Partial<typeof EMPTY_REV>;
}) {
  const [form, setForm] = useState({ ...EMPTY_REV });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof EMPTY_REV) => (e: React.ChangeEvent<any>) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (open) setForm({ ...EMPTY_REV, ...prefill });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Tytuł jest wymagany.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Podaj kwotę większą od 0.'); return; }
    setSaving(true); setError('');
    const supabase = createClient();
    const { net, vat, gross, rate } = computeVat(parseFloat(form.amount), form.vat_rate, form.input_mode);
    const exchangeRate = parseFloat(form.exchange_rate) || 1;
    const grossPln = form.currency === 'PLN' ? gross : Math.round(gross * exchangeRate * 100) / 100;
    const { error: err } = await supabase.from('revenues').insert({
      title: form.title.trim(), category_id: form.category_id || null,
      amount: gross, amount_net: net, vat_rate: rate, vat_amount: vat,
      amount_pln: grossPln, currency: form.currency, exchange_rate: exchangeRate,
      revenue_date: form.revenue_date, invoice_number: form.invoice_number.trim() || null,
      status: form.status, project_name: form.project_name.trim() || null,
      note: form.note.trim() || null,
    });
    setSaving(false);
    if (err) setError(err.message);
    else { setForm({ ...EMPTY_REV }); onSuccess(); }
  }

  return (
    <Modal open={open} onClose={() => { setError(''); setForm({ ...EMPTY_REV }); onClose(); }} title="Dodaj przychód" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="p-5 space-y-4">
          <Input label="Tytuł *" placeholder="np. Projekt dla klienta X" value={form.title} onChange={set('title')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Kategoria" options={[{value:'',label:'Brak'}, ...categoryOptions]} value={form.category_id} onChange={set('category_id')} />
            <Select label="Waluta" options={[{value:'PLN',label:'PLN'},{value:'EUR',label:'EUR'},{value:'USD',label:'USD'}]} value={form.currency} onChange={set('currency')} />
          </div>
          {form.currency !== 'PLN' && (
            <Input label={`Kurs (1 ${form.currency} = ? PLN)`} type="number" min="0.01" step="0.0001" value={form.exchange_rate} onChange={set('exchange_rate')} />
          )}
          {/* Kwota + VAT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex bg-bg-muted rounded-lg p-0.5 text-xs">
                {(['netto','brutto'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setForm(f => ({ ...f, input_mode: m }))}
                    className={cn('px-3 py-1 rounded-md font-medium transition-colors capitalize',
                      form.input_mode === m ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted')}>
                    {m}
                  </button>
                ))}
              </div>
              <span className="text-xs text-text-muted">— tryb wprowadzania</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Kwota ${form.input_mode} *`}
                type="number" min="0.01" step="0.01"
                value={form.amount} onChange={set('amount')}
              />
              <Select label="Stawka VAT" options={VAT_OPTIONS} value={form.vat_rate} onChange={set('vat_rate')} />
            </div>
            <VatBlock amount={form.amount} vatRate={form.vat_rate} mode={form.input_mode} currency={form.currency} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" type="date" value={form.revenue_date} onChange={set('revenue_date')} />
            <Select label="Status *" options={[{value:'paid',label:'Opłacona'},{value:'pending',label:'Oczekuje'},{value:'overdue',label:'Przeterminowana'}]} value={form.status} onChange={set('status')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nr faktury" placeholder="FV/2026/001" value={form.invoice_number} onChange={set('invoice_number')} />
            <Input label="Projekt" placeholder="Nazwa projektu" value={form.project_name} onChange={set('project_name')} />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notatka</label>
            <textarea rows={2} value={form.note} onChange={set('note')} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
          <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Zapisuję…' : 'Dodaj przychód'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Invoice Scan Modal ───────────────────────────────────────────────────────
function InvoiceScanModal({ open, onClose, type, onExtracted }: {
  open: boolean; onClose: () => void;
  type: 'cost' | 'revenue';
  onExtracted: (data: Record<string, any>) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

  async function handleScan() {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/integrations/invoice-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_base64: base64, mime_type: file.type, type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Błąd skanowania');
      onExtracted(json.data);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Błąd skanowania');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Zaimportuj z faktury (AI)" size="sm">
      <div className="p-5 space-y-4">
        <p className="text-sm text-text-secondary">
          Wgraj zdjęcie lub PDF faktury — AI automatycznie odczyta dane i wypełni formularz.
        </p>
        <label className={cn(
          'flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
          file ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-bg-subtle'
        )}>
          <input type="file" accept={ACCEPTED} className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }} />
          {file ? (
            <>
              <FileText size={28} className="text-accent mb-2" />
              <p className="text-sm font-medium text-text-primary truncate max-w-[220px]">{file.name}</p>
              <p className="text-xs text-text-muted mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-text-muted mb-2" />
              <p className="text-sm text-text-secondary">Kliknij lub przeciągnij plik</p>
              <p className="text-xs text-text-muted mt-0.5">JPG, PNG, WEBP, PDF</p>
            </>
          )}
        </label>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleScan} disabled={!file || loading}>
          {loading ? <><Loader2 size={14} className="animate-spin" /> Skanuję…</> : 'Skanuj fakturę'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────
type CsvRow = Record<string, string>;

function parseCSV(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_żźćńółęąś]/g, '_'));
  const rows = lines.slice(1).map(line => {
    const cells = line.split(sep);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
  return { headers, rows };
}

function ImportCSVModal({ open, onClose, type, categoryOptions, employeeOptions, onSuccess }: {
  open: boolean; onClose: () => void;
  type: 'cost' | 'revenue';
  categoryOptions: { value: string; label: string }[];
  employeeOptions: { value: string; label: string }[];
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(0);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setDone(false);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.rows.length === 0) { setError('Plik nie zawiera żadnych wierszy danych.'); return; }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    };
    reader.readAsText(file, 'utf-8');
  }

  function resolve(row: CsvRow, keys: string[]): string {
    for (const k of keys) if (row[k]) return row[k];
    return '';
  }

  function findCategory(name: string): string | null {
    if (!name) return null;
    const n = name.toLowerCase();
    return categoryOptions.find(c => c.label.toLowerCase() === n)?.value ?? null;
  }

  function findEmployee(name: string): string | null {
    if (!name) return null;
    const n = name.toLowerCase();
    return employeeOptions.find(e => e.label.toLowerCase().includes(n))?.value ?? null;
  }

  async function handleImport() {
    setSaving(true); setError('');
    const supabase = createClient();
    let count = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (type === 'cost') {
          const amountStr = resolve(row, ['kwota_brutto','brutto','amount_gross','kwota','amount']);
          const netStr = resolve(row, ['kwota_netto','netto','amount_net']);
          const amount = parseFloat(amountStr.replace(',', '.')) || 0;
          const net = parseFloat(netStr.replace(',', '.')) || amount;
          const vatStr = resolve(row, ['vat_','vat','stawka_vat','vat_pct']);
          const vat_rate = vatStr === 'zw' ? null : (parseFloat(vatStr) || null);
          const dateVal = resolve(row, ['data','date','cost_date']);
          const paid_by = findEmployee(resolve(row, ['kto','kto_poni__s_','paid_by','pracownik']));
          if (!amount || !dateVal) { errors.push(`Wiersz ${i + 2}: brak kwoty lub daty`); continue; }
          const { error: err } = await supabase.from('costs').insert({
            title: resolve(row, ['tytu__','tytul','title','opis']) || 'Import CSV',
            category_id: findCategory(resolve(row, ['kategoria','category'])),
            amount,
            amount_net: net,
            vat_rate,
            amount_pln: amount,
            currency: resolve(row, ['waluta','currency']) || 'PLN',
            exchange_rate: 1,
            cost_date: dateVal,
            paid_by: paid_by || null,
            project_name: resolve(row, ['projekt','project']) || null,
            note: resolve(row, ['notatka','note']) || null,
          });
          if (err) errors.push(`Wiersz ${i + 2}: ${err.message}`);
          else count++;
        } else {
          const amountStr = resolve(row, ['kwota_brutto','brutto','amount_gross','kwota','amount']);
          const netStr = resolve(row, ['kwota_netto','netto','amount_net']);
          const amount = parseFloat(amountStr.replace(',', '.')) || 0;
          const net = parseFloat(netStr.replace(',', '.')) || amount;
          const vatStr = resolve(row, ['vat_','vat','stawka_vat','vat_pct']);
          const vat_rate = vatStr === 'zw' ? null : (parseFloat(vatStr) || null);
          const dateVal = resolve(row, ['data','date','revenue_date']);
          const statusVal = resolve(row, ['status']) || 'paid';
          if (!amount || !dateVal) { errors.push(`Wiersz ${i + 2}: brak kwoty lub daty`); continue; }
          const { error: err } = await supabase.from('revenues').insert({
            title: resolve(row, ['tytu__','tytul','title','opis']) || 'Import CSV',
            category_id: findCategory(resolve(row, ['kategoria','category'])),
            amount,
            amount_net: net,
            vat_rate,
            amount_pln: amount,
            currency: resolve(row, ['waluta','currency']) || 'PLN',
            exchange_rate: 1,
            revenue_date: dateVal,
            invoice_number: resolve(row, ['nr_faktury','nr_fv','invoice_number','faktura']) || null,
            status: ['paid','pending','overdue'].includes(statusVal) ? statusVal : 'paid',
            project_name: resolve(row, ['projekt','project']) || null,
            note: resolve(row, ['notatka','note']) || null,
          });
          if (err) errors.push(`Wiersz ${i + 2}: ${err.message}`);
          else count++;
        }
      } catch {
        errors.push(`Wiersz ${i + 2}: nieoczekiwany błąd`);
      }
    }

    setSaving(false);
    setImported(count);
    if (errors.length > 0 && count === 0) {
      setError(errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n…i ${errors.length - 3} więcej` : ''));
    } else {
      setDone(true);
      if (count > 0) onSuccess();
    }
  }

  const isCost = type === 'cost';
  const TEMPLATE_COST = 'data;tytuł;kategoria;kwota_netto;vat_;kwota_brutto;waluta;kto;projekt;notatka\n2026-01-15;Subskrypcja Notion;Narzędzia;81.30;23;100;PLN;Jan Kowalski;Projekt A;';
  const TEMPLATE_REV  = 'data;tytuł;kategoria;nr_faktury;status;kwota_netto;vat_;kwota_brutto;waluta;projekt;notatka\n2026-01-20;Usługa marketingowa;;FV/2026/001;paid;1000;23;1230;PLN;Projekt B;';

  function downloadTemplate() {
    const content = isCost ? TEMPLATE_COST : TEMPLATE_REV;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = isCost ? 'szablon_koszty.csv' : 'szablon_przychody.csv';
    a.click();
  }

  function handleClose() {
    setRows([]); setHeaders([]); setDone(false); setError(''); setSaving(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Importuj ${isCost ? 'koszty' : 'przychody'} z CSV`} size="lg">
      <div className="p-5 space-y-4">
        {done ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 size={40} className="text-green-500" />
            <p className="text-base font-semibold text-text-primary">Zaimportowano {imported} rekordów</p>
            {error && <p className="text-xs text-amber-600 text-center whitespace-pre-line">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">Plik CSV z separatorem <code className="bg-bg-muted px-1 rounded">;</code> lub <code className="bg-bg-muted px-1 rounded">,</code></p>
              <button onClick={downloadTemplate} className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
                <FileSpreadsheet size={12} /> Pobierz szablon
              </button>
            </div>
            <label className={cn(
              'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
              rows.length > 0 ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-bg-subtle'
            )}>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              {rows.length > 0 ? (
                <>
                  <CheckCircle2 size={22} className="text-accent mb-1" />
                  <p className="text-sm font-medium text-text-primary">{rows.length} wierszy gotowych do importu</p>
                  <p className="text-xs text-text-muted mt-0.5">Kliknij żeby zmienić plik</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={24} className="text-text-muted mb-2" />
                  <p className="text-sm text-text-secondary">Kliknij lub przeciągnij plik CSV</p>
                </>
              )}
            </label>
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-bg-subtle border-b border-border">
                      {headers.slice(0, 6).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                      {headers.length > 6 && <th className="px-3 py-2 text-text-muted">+{headers.length - 6}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 4).map((row, i) => (
                      <tr key={i} className="hover:bg-bg-subtle">
                        {headers.slice(0, 6).map(h => (
                          <td key={h} className="px-3 py-2 text-text-secondary truncate max-w-[100px]">{row[h] || '—'}</td>
                        ))}
                        {headers.length > 6 && <td className="px-3 py-2 text-text-muted">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 4 && (
                  <p className="px-3 py-2 text-[11px] text-text-muted border-t border-border">…i {rows.length - 4} więcej wierszy</p>
                )}
              </div>
            )}
            {error && (
              <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg whitespace-pre-line">
                {error}
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        {done ? (
          <Button variant="primary" onClick={handleClose}>Zamknij</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>Anuluj</Button>
            <Button variant="primary" onClick={handleImport} disabled={rows.length === 0 || saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Importuję…</> : `Importuj ${rows.length || ''} rekordów`}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Import Dropdown Button ───────────────────────────────────────────────────
function ImportDropdown({ onCSV, onInvoice }: { onCSV: () => void; onInvoice: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
        <Upload size={13} /> Importuj <ChevronDown size={12} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden">
            <button onClick={() => { setOpen(false); onInvoice(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-subtle transition-colors">
              <FileText size={14} className="text-accent" />
              <div className="text-left">
                <p className="font-medium text-sm">Z faktury (AI)</p>
                <p className="text-[11px] text-text-muted">Wgraj obraz lub PDF</p>
              </div>
            </button>
            <div className="border-t border-border" />
            <button onClick={() => { setOpen(false); onCSV(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-subtle transition-colors">
              <FileSpreadsheet size={14} className="text-green-500" />
              <div className="text-left">
                <p className="font-medium text-sm">Z pliku CSV</p>
                <p className="text-[11px] text-text-muted">Bulk import wielu rekordów</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Month navigator ──────────────────────────────────────────────────────────
function MonthNav({ title, onPrev, onNext, isCurrentMonth, onShowAll, hasAll }: {
  title: string; onPrev: () => void; onNext: () => void;
  isCurrentMonth: boolean; onShowAll: () => void; hasAll: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onPrev} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-semibold text-text-primary min-w-[160px] text-center">{title}</span>
      <button onClick={onNext} disabled={isCurrentMonth} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors disabled:opacity-30">
        <ChevronRight size={15} />
      </button>
      {!hasAll && (
        <button onClick={onShowAll} className="ml-1 text-xs text-accent hover:text-accent-hover">Wszystkie</button>
      )}
    </div>
  );
}

// ─── COSTS TAB ────────────────────────────────────────────────────────────────
function CostsTab({ costs, categories, employees, currentEmployeeId, refetch }: {
  costs: Cost[]; categories: any[]; employees: any[]; currentEmployeeId: string; refetch: () => void;
}) {
  const { filterMonth, setFilterMonth, prevMonth, nextMonth, isCurrentMonth, dateRange, label, title } = useMonthFilter();
  const [filterCat, setFilterCat] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [prefill, setPrefill] = useState<Partial<typeof EMPTY_COST> | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function handleExtracted(data: Record<string, any>) {
    const vatRaw = data.vat_rate != null ? String(data.vat_rate) : '23';
    const vat = VAT_OPTIONS.find(v => v.value === vatRaw) ? vatRaw : 'zw';
    setPrefill({
      title: data.title ?? data.counterparty ?? '',
      amount: String(data.amount_net ?? data.amount_gross ?? ''),
      vat_rate: vat,
      input_mode: data.amount_net != null ? 'netto' : 'brutto',
      cost_date: data.date ?? new Date().toISOString().split('T')[0],
      currency: data.currency ?? 'PLN',
    });
    setShowAdd(true);
  }

  const filtered = useMemo(() => {
    let list = [...costs];
    if (dateRange) list = list.filter(c => c.cost_date >= dateRange.from && c.cost_date <= dateRange.to);
    if (filterCat) list = list.filter(c => c.category_id === filterCat);
    return list;
  }, [costs, dateRange, filterCat]);

  const now = new Date();
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      return {
        month: MONTH_SHORT[m],
        value: costs.filter(c => { const cd = new Date(c.cost_date); return cd.getFullYear() === y && cd.getMonth() === m; })
          .reduce((s, c) => s + (c.amount_pln ?? c.amount), 0),
      };
    });
  }, [costs]);

  const personData = useMemo(() =>
    employees.map(e => ({
      name: e.name.split(' ')[0],
      value: filtered.filter(c => c.paid_by === e.id).reduce((s, c) => s + (c.amount_pln ?? c.amount), 0),
    })).filter(p => p.value > 0), [employees, filtered]);

  async function deleteCost(id: string) {
    await createClient().from('costs').delete().eq('id', id);
    refetch(); setOpenMenu(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, label, 'costs')}>
          <Download size={13} /> Eksportuj CSV
        </Button>
        <ImportDropdown onCSV={() => setShowCSV(true)} onInvoice={() => setShowInvoice(true)} />
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Dodaj koszt
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bg-base border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Ostatnie 6 miesięcy</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs><linearGradient id="gCosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [formatCurrency(Number(v)), 'Koszty']} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#gCosts)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-bg-base border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Wg. osoby</h3>
          {personData.length === 0 ? <p className="text-xs text-text-muted pt-6 text-center">Brak danych</p> : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={personData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [formatCurrency(Number(v)), '']} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
          <MonthNav title={title} onPrev={prevMonth} onNext={nextMonth} isCurrentMonth={isCurrentMonth} onShowAll={() => setFilterMonth(null)} hasAll={filterMonth === null} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{filtered.length} rekordów</span>
            <Select options={[{value:'',label:'Wszystkie kategorie'},...categories.map(c=>({value:c.id,label:c.name}))]} value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="w-44" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                {['Data','Tytuł','Kategoria','Kto poniósł','Netto','VAT','Brutto','PLN','Projekt',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-bg-subtle transition-colors">
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{formatDate(c.cost_date)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-text-primary">{c.title}</td>
                  <td className="px-4 py-2.5">{c.category ? <Badge color={c.category.color}>{c.category.name}</Badge> : <span className="text-xs text-text-muted">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={c.paid_by_employee?.name ?? '?'} size="xs" />
                      <span className="text-xs text-text-secondary">{c.paid_by_employee?.name?.split(' ')[0] ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap">{c.amount_net != null ? formatCurrency(c.amount_net, c.currency) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{c.vat_rate != null ? `${c.vat_rate}%` : 'zw.'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-text-primary whitespace-nowrap">{formatCurrency(c.amount, c.currency)}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{c.currency !== 'PLN' && c.amount_pln ? formatCurrency(c.amount_pln) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted max-w-[130px] truncate">{c.project_name ?? c.note ?? '—'}</td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                      {openMenu === c.id && (
                        <><div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 top-full mt-1 w-32 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                          <button onClick={() => deleteCost(c.id)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 size={13} /> Usuń
                          </button>
                        </div></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">Brak kosztów w tym okresie</p>
            </div>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted">Suma PLN: <span className="font-semibold text-text-primary">{formatCurrency(filtered.reduce((s,c)=>s+(c.amount_pln??c.amount),0))}</span></span>
            <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, label, 'costs')}><Download size={12} /> {filtered.length} wierszy</Button>
          </div>
        )}
      </div>

      <AddCostModal open={showAdd} onClose={() => { setShowAdd(false); setPrefill(null); }} onSuccess={() => { setShowAdd(false); setPrefill(null); refetch(); }}
        categoryOptions={categories.map(c => ({ value: c.id, label: c.name }))}
        employeeOptions={employees.map(e => ({ value: e.id, label: e.name }))}
        defaultPaidBy={currentEmployeeId}
        prefill={prefill ?? undefined} />
      <InvoiceScanModal open={showInvoice} onClose={() => setShowInvoice(false)} type="cost" onExtracted={handleExtracted} />
      <ImportCSVModal open={showCSV} onClose={() => setShowCSV(false)} type="cost"
        categoryOptions={categories.map(c => ({ value: c.id, label: c.name }))}
        employeeOptions={employees.map(e => ({ value: e.id, label: e.name }))}
        onSuccess={refetch} />
    </div>
  );
}

// ─── REVENUES TAB ─────────────────────────────────────────────────────────────
function RevenuesTab({ revenues, revenueCategories, refetch }: {
  revenues: Revenue[]; revenueCategories: any[]; refetch: () => void;
}) {
  const { filterMonth, setFilterMonth, prevMonth, nextMonth, isCurrentMonth, dateRange, label, title } = useMonthFilter();
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [prefill, setPrefill] = useState<Partial<typeof EMPTY_REV> | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function handleExtracted(data: Record<string, any>) {
    const vatRaw = data.vat_rate != null ? String(data.vat_rate) : '23';
    const vat = VAT_OPTIONS.find(v => v.value === vatRaw) ? vatRaw : 'zw';
    setPrefill({
      title: data.title ?? data.counterparty ?? '',
      amount: String(data.amount_net ?? data.amount_gross ?? ''),
      vat_rate: vat,
      input_mode: data.amount_net != null ? 'netto' : 'brutto',
      revenue_date: data.date ?? new Date().toISOString().split('T')[0],
      currency: data.currency ?? 'PLN',
      invoice_number: data.invoice_number ?? '',
    });
    setShowAdd(true);
  }

  const filtered = useMemo(() => {
    let list = [...revenues];
    if (dateRange) list = list.filter(r => r.revenue_date >= dateRange.from && r.revenue_date <= dateRange.to);
    if (filterCat) list = list.filter(r => r.category_id === filterCat);
    if (filterStatus) list = list.filter(r => r.status === filterStatus);
    return list;
  }, [revenues, dateRange, filterCat, filterStatus]);

  const now = new Date();
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      return {
        month: MONTH_SHORT[m],
        value: revenues.filter(r => { const rd = new Date(r.revenue_date); return rd.getFullYear() === y && rd.getMonth() === m; })
          .reduce((s, r) => s + (r.amount_pln ?? r.amount), 0),
      };
    });
  }, [revenues]);

  async function deleteRevenue(id: string) {
    await createClient().from('revenues').delete().eq('id', id);
    refetch(); setOpenMenu(null);
  }

  const totalPaid = filtered.filter(r => r.status === 'paid').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
  const totalPending = filtered.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
  const totalOverdue = filtered.filter(r => r.status === 'overdue').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, label, 'revenues')}>
          <Download size={13} /> Eksportuj CSV
        </Button>
        <ImportDropdown onCSV={() => setShowCSV(true)} onInvoice={() => setShowInvoice(true)} />
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Dodaj przychód
        </Button>
      </div>

      {/* KPI mini */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Opłacone', value: totalPaid, color: '#10b981', icon: ArrowUpRight },
          { label: 'Oczekuje', value: totalPending, color: '#f59e0b', icon: DollarSign },
          { label: 'Przeterminowane', value: totalOverdue, color: '#ef4444', icon: ArrowDownRight },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-bg-base border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
              <p className="text-lg font-bold text-text-primary">{formatCurrency(value)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-bg-base border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Przychody — ostatnie 6 miesięcy</h3>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs><linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [formatCurrency(Number(v)), 'Przychody']} />
            <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#gRev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
          <MonthNav title={title} onPrev={prevMonth} onNext={nextMonth} isCurrentMonth={isCurrentMonth} onShowAll={() => setFilterMonth(null)} hasAll={filterMonth === null} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">{filtered.length} rekordów</span>
            <Select options={[{value:'',label:'Wszystkie statusy'},{value:'paid',label:'Opłacone'},{value:'pending',label:'Oczekuje'},{value:'overdue',label:'Przeterminowane'}]} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-40" />
            <Select options={[{value:'',label:'Wszystkie kategorie'},...revenueCategories.map(c=>({value:c.id,label:c.name}))]} value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="w-44" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                {['Data','Tytuł','Kategoria','Status','Nr faktury','Netto','VAT','Brutto','PLN','Projekt',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-bg-subtle transition-colors">
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{formatDate(r.revenue_date)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-text-primary">{r.title}</td>
                  <td className="px-4 py-2.5">{r.category ? <Badge color={r.category.color}>{r.category.name}</Badge> : <span className="text-xs text-text-muted">—</span>}</td>
                  <td className="px-4 py-2.5"><Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{r.invoice_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap">{r.amount_net != null ? formatCurrency(r.amount_net, r.currency) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{r.vat_rate != null ? `${r.vat_rate}%` : 'zw.'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-emerald-600 whitespace-nowrap">+{formatCurrency(r.amount, r.currency)}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{r.currency !== 'PLN' && r.amount_pln ? formatCurrency(r.amount_pln) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted max-w-[120px] truncate">{r.project_name ?? '—'}</td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                      {openMenu === r.id && (
                        <><div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 top-full mt-1 w-32 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                          <button onClick={() => deleteRevenue(r.id)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 size={13} /> Usuń
                          </button>
                        </div></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center"><p className="text-sm text-text-muted">Brak przychodów w tym okresie</p></div>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted">Suma PLN: <span className="font-semibold text-emerald-600">{formatCurrency(filtered.reduce((s,r)=>s+(r.amount_pln??r.amount),0))}</span></span>
            <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, label, 'revenues')}><Download size={12} /> {filtered.length} wierszy</Button>
          </div>
        )}
      </div>

      <AddRevenueModal open={showAdd} onClose={() => { setShowAdd(false); setPrefill(null); }} onSuccess={() => { setShowAdd(false); setPrefill(null); refetch(); }}
        categoryOptions={revenueCategories.map(c => ({ value: c.id, label: c.name }))}
        prefill={prefill ?? undefined} />
      <InvoiceScanModal open={showInvoice} onClose={() => setShowInvoice(false)} type="revenue" onExtracted={handleExtracted} />
      <ImportCSVModal open={showCSV} onClose={() => setShowCSV(false)} type="revenue"
        categoryOptions={revenueCategories.map(c => ({ value: c.id, label: c.name }))}
        employeeOptions={[]}
        onSuccess={refetch} />
    </div>
  );
}

// ─── FINANCE DASHBOARD TAB ────────────────────────────────────────────────────
type ChartMode = 'all' | 'revenues' | 'costs' | 'margin';
type PeriodMode = 3 | 6 | 12 | 'ytd';

const CHART_MODES: { id: ChartMode; label: string }[] = [
  { id: 'all',      label: 'Przychody vs Koszty' },
  { id: 'revenues', label: 'Przychody' },
  { id: 'costs',    label: 'Koszty' },
  { id: 'margin',   label: 'Marża %' },
];

const PERIOD_MODES: { id: PeriodMode; label: string }[] = [
  { id: 3,     label: '3M' },
  { id: 6,     label: '6M' },
  { id: 12,    label: '12M' },
  { id: 'ytd', label: 'YTD' },
];

function FinanceDashboardTab({ costs, revenues }: { costs: Cost[]; revenues: Revenue[] }) {
  const now = new Date();
  const [chartMode, setChartMode] = useState<ChartMode>('all');
  const [period, setPeriod] = useState<PeriodMode>(6);

  // Compute how many months to show
  const monthCount = useMemo(() => {
    if (period === 'ytd') return now.getMonth() + 1;
    return period;
  }, [period, now]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: monthCount }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const rev = revenues
        .filter(r => { const rd = new Date(r.revenue_date); return rd.getFullYear() === y && rd.getMonth() === m && r.status === 'paid'; })
        .reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
      const cost = costs
        .filter(c => { const cd = new Date(c.cost_date); return cd.getFullYear() === y && cd.getMonth() === m; })
        .reduce((s, c) => s + (c.amount_pln ?? c.amount), 0);
      const zysk = rev - cost;
      const marza = rev > 0 ? parseFloat(((zysk / rev) * 100).toFixed(1)) : 0;
      return { month: MONTH_SHORT[m], przychody: rev, koszty: cost, zysk, marza };
    });
  }, [costs, revenues, monthCount]);

  // Current month KPIs
  const cmFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const cmTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const cmRev  = revenues.filter(r => r.revenue_date >= cmFrom && r.revenue_date <= cmTo && r.status === 'paid').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
  const cmCost = costs.filter(c => c.cost_date >= cmFrom && c.cost_date <= cmTo).reduce((s, c) => s + (c.amount_pln ?? c.amount), 0);
  const cmProfit = cmRev - cmCost;
  const cmMargin = cmRev > 0 ? (cmProfit / cmRev) * 100 : 0;

  const pmFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const pmTo   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const pmRev  = revenues.filter(r => r.revenue_date >= pmFrom && r.revenue_date <= pmTo && r.status === 'paid').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
  const pmCost = costs.filter(c => c.cost_date >= pmFrom && c.cost_date <= pmTo).reduce((s, c) => s + (c.amount_pln ?? c.amount), 0);

  const ytdFrom  = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const ytdRev   = revenues.filter(r => r.revenue_date >= ytdFrom && r.status === 'paid').reduce((s, r) => s + (r.amount_pln ?? r.amount), 0);
  const ytdCost  = costs.filter(c => c.cost_date >= ytdFrom).reduce((s, c) => s + (c.amount_pln ?? c.amount), 0);
  const ytdProfit = ytdRev - ytdCost;
  const ytdMargin = ytdRev > 0 ? (ytdProfit / ytdRev) * 100 : 0;

  const revChange  = pmRev  > 0 ? ((cmRev  - pmRev)  / pmRev)  * 100 : 0;
  const costChange = pmCost > 0 ? ((cmCost - pmCost) / pmCost) * 100 : 0;
  const monthName  = MONTH_LABELS[now.getMonth()];

  function Indicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
    const positive = inverted ? value <= 0 : value >= 0;
    return (
      <span className={cn('text-xs font-medium flex items-center gap-0.5', positive ? 'text-emerald-500' : 'text-red-500')}>
        {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {value >= 0 ? '+' : ''}{value.toFixed(1)}% vs poprzedni mies.
      </span>
    );
  }

  const kpis = [
    { label: `Przychody — ${monthName}`, value: cmRev,    color: '#10b981', trend: <Indicator value={revChange} />,          icon: ArrowUpRight,   sub: `YTD: ${formatCurrency(ytdRev)}` },
    { label: `Koszty — ${monthName}`,    value: cmCost,   color: '#ef4444', trend: <Indicator value={costChange} inverted />, icon: ArrowDownRight, sub: `YTD: ${formatCurrency(ytdCost)}` },
    { label: `Zysk — ${monthName}`,      value: cmProfit, color: cmProfit >= 0 ? '#6366f1' : '#ef4444', icon: DollarSign, trend: null, sub: `YTD: ${formatCurrency(ytdProfit)}` },
    { label: `Marża — ${monthName}`,     value: null, display: `${cmMargin.toFixed(1)}%`, color: cmMargin >= 0 ? '#8b5cf6' : '#ef4444', icon: Percent, trend: null, sub: `YTD: ${ytdMargin.toFixed(1)}%` },
  ];

  const chartTitle = CHART_MODES.find(m => m.id === chartMode)?.label ?? '';
  const periodLabel = period === 'ytd' ? 'od początku roku' : `ostatnie ${period} mies.`;

  const tooltipFormatter = chartMode === 'margin'
    ? (v: any) => [`${Number(v).toFixed(1)}%`, 'Marża']
    : (v: any, name: any) => [formatCurrency(Number(v)), name === 'przychody' ? 'Przychody' : name === 'koszty' ? 'Koszty' : 'Zysk'];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-bg-base border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider leading-tight">{kpi.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}18` }}>
                <kpi.icon size={13} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {kpi.display ?? formatCurrency(kpi.value ?? 0)}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
            {kpi.trend && <div className="mt-1.5">{kpi.trend}</div>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-bg-base border border-border rounded-xl p-4">
        {/* Chart header with controls */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-text-primary">
            {chartTitle} — <span className="text-text-muted font-normal">{periodLabel}</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <div className="flex items-center bg-bg-subtle border border-border rounded-lg p-0.5">
              {PERIOD_MODES.map(p => (
                <button key={String(p.id)} onClick={() => setPeriod(p.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    period === p.id ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Chart mode selector */}
            <div className="flex items-center bg-bg-subtle border border-border rounded-lg p-0.5">
              {CHART_MODES.map(m => (
                <button key={m.id} onClick={() => setChartMode(m.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                    chartMode === m.id ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                  )}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          {chartMode === 'margin' ? (
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Marża']} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 2" />
              <Bar dataKey="marza" fill="#8b5cf6" radius={[3,3,0,0]} opacity={0.25} />
              <Line type="monotone" dataKey="marza" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3.5 }} />
            </ComposedChart>
          ) : chartMode === 'revenues' ? (
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 0, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [formatCurrency(Number(v)), 'Przychody']} />
              <Bar dataKey="przychody" fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
              <Line type="monotone" dataKey="przychody" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          ) : chartMode === 'costs' ? (
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 0, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [formatCurrency(Number(v)), 'Koszty']} />
              <Bar dataKey="koszty" fill="#ef4444" radius={[3,3,0,0]} opacity={0.8} />
              <Line type="monotone" dataKey="koszty" stroke="#ef4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          ) : (
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 0, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: any) => [formatCurrency(Number(v)), name === 'przychody' ? 'Przychody' : name === 'koszty' ? 'Koszty' : 'Zysk']} />
              <Legend formatter={(v: string) => v === 'przychody' ? 'Przychody' : v === 'koszty' ? 'Koszty' : 'Zysk'} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="przychody" fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
              <Bar dataKey="koszty" fill="#6366f1" radius={[3,3,0,0]} opacity={0.85} />
              <Line type="monotone" dataKey="zysk" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Zestawienie miesięczne</h3>
          <span className="text-xs text-text-muted">{periodLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                {['Miesiąc','Przychody','Koszty','Zysk','Marża'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...monthlyData].reverse().map(row => (
                <tr key={row.month} className="hover:bg-bg-subtle transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-text-primary">{row.month}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.przychody)}</td>
                  <td className="px-4 py-3 text-sm text-text-primary">{formatCurrency(row.koszty)}</td>
                  <td className={cn('px-4 py-3 text-sm font-semibold', row.zysk >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {row.zysk >= 0 ? '+' : ''}{formatCurrency(row.zysk)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden max-w-[80px]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(row.marza, 0), 100)}%`, backgroundColor: row.marza >= 0 ? '#10b981' : '#ef4444' }} />
                      </div>
                      <span className={cn('text-xs font-medium tabular-nums', row.marza >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {row.marza.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
type Tab = 'costs' | 'revenues' | 'dashboard';

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('costs');
  const { costs, categories, loading: costsLoading, refetch: refetchCosts } = useCosts();
  const { revenues, revenueCategories, loading: revLoading, refetch: refetchRevenues } = useRevenues();
  const { employees } = useEmployees();
  const { user } = useAuth();

  const currentEmployee = useMemo(() => employees.find(e => e.user_id === user?.id), [employees, user]);
  const loading = costsLoading || revLoading;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'costs', label: 'Koszty' },
    { id: 'revenues', label: 'Przychody' },
    { id: 'dashboard', label: 'Dashboard finansowy' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Finanse</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-bg-muted rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.id ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'costs' && (
        <CostsTab costs={costs} categories={categories} employees={employees}
          currentEmployeeId={currentEmployee?.id ?? ''} refetch={refetchCosts} />
      )}
      {tab === 'revenues' && (
        <RevenuesTab revenues={revenues} revenueCategories={revenueCategories} refetch={refetchRevenues} />
      )}
      {tab === 'dashboard' && (
        <FinanceDashboardTab costs={costs} revenues={revenues} />
      )}
    </div>
  );
}
