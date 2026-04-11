'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Trash2, Upload, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, Download, ChevronDown, Search, Tag, Clock, User,
  FileSpreadsheet, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useClients } from '@/hooks/useClients';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DocTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_name: string;
  variables: string[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'oferta',       label: 'Oferta',        color: '#6366f1' },
  { value: 'umowa',        label: 'Umowa',          color: '#10b981' },
  { value: 'prezentacja',  label: 'Prezentacja',    color: '#f59e0b' },
  { value: 'raport',       label: 'Raport',         color: '#3b82f6' },
  { value: 'inne',         label: 'Inne',           color: '#94a3b8' },
];

// Variables auto-filled from client data
const SYSTEM_VARS: { key: string; label: string; source: string }[] = [
  { key: 'nazwa_klienta',  label: 'Imię i nazwisko klienta', source: 'CRM' },
  { key: 'firma',          label: 'Nazwa firmy',             source: 'CRM' },
  { key: 'email',          label: 'Email klienta',           source: 'CRM' },
  { key: 'telefon',        label: 'Telefon klienta',         source: 'CRM' },
  { key: 'adres',          label: 'Adres klienta',           source: 'CRM' },
  { key: 'nip',            label: 'NIP',                     source: 'CRM' },
  { key: 'regon',          label: 'REGON',                   source: 'CRM' },
  { key: 'numer_umowy',    label: 'Numer umowy',             source: 'CRM' },
  { key: 'data_umowy',     label: 'Data umowy',              source: 'CRM' },
  { key: 'data',           label: 'Data dzisiejsza',         source: 'auto' },
  { key: 'data_dlugia',    label: 'Data słowna',             source: 'auto' },
  { key: 'rok',            label: 'Rok',                     source: 'auto' },
  { key: 'miesiac',        label: 'Miesiąc',                 source: 'auto' },
];

function getCategoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ─── Upload Template Modal ────────────────────────────────────────────────────
function UploadModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (t: DocTemplate) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('oferta');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setFile(null); setName(''); setDescription(''); setCategory('oferta'); setError(''); } }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, '').replace(/[_-]/g, ' '));
  }

  async function handleSave() {
    if (!file) { setError('Wybierz plik .docx'); return; }
    if (!name.trim()) { setError('Podaj nazwę szablonu'); return; }
    setSaving(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name.trim());
    fd.append('description', description.trim());
    fd.append('category', category);
    const res = await fetch('/api/documents/templates', { method: 'POST', body: fd });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.message ?? json.error ?? 'Błąd przesyłania'); return; }
    onSuccess(json.template);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Dodaj szablon dokumentu" size="md">
      <div className="p-5 space-y-4">
        <label className={cn(
          'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
          file ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-bg-subtle'
        )}>
          <input type="file" accept=".docx" className="hidden" onChange={handleFile} />
          {file ? (
            <>
              <FileText size={28} className="text-accent mb-2" />
              <p className="text-sm font-medium text-text-primary">{file.name}</p>
              <p className="text-xs text-text-muted mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-text-muted mb-2" />
              <p className="text-sm text-text-secondary">Przeciągnij lub kliknij — plik .docx</p>
              <p className="text-xs text-text-muted mt-0.5">Użyj placeholderów: {'{nazwa_klienta}'}, {'{data}'} itp.</p>
            </>
          )}
        </label>

        <Input label="Nazwa szablonu *" value={name} onChange={e => setName(e.target.value)} placeholder="np. Oferta handlowa 2026" />
        <Input label="Opis (opcjonalnie)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Krótki opis szablonu" />
        <Select label="Kategoria" value={category} onChange={e => setCategory(e.target.value)}
          options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))} />

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center px-5 py-4 border-t border-border bg-bg-subtle">
        <a href="#" onClick={e => { e.preventDefault(); window.open('https://docxtemplater.com/demo/', '_blank'); }}
          className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
          <ExternalLink size={11} /> Jak tworzyć szablony?
        </a>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Przesyłam…</> : 'Dodaj szablon'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Generate Modal ───────────────────────────────────────────────────────────
function GenerateModal({ template, open, onClose }: { template: DocTemplate | null; open: boolean; onClose: () => void }) {
  const { clients } = useClients();
  const [clientId, setClientId] = useState('');
  const [outputName, setOutputName] = useState('');
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url?: string; download?: boolean; fileName?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && template) {
      setClientId('');
      setOutputName(template.name);
      setResult(null); setError('');
      // Init extra vars for manual variables
      const manualVars = (template.variables ?? []).filter(v => !SYSTEM_VARS.some(sv => sv.key === v));
      setExtraVars(Object.fromEntries(manualVars.map(v => [v, ''])));
    }
  }, [open, template]);

  const autoVars = (template?.variables ?? []).filter(v => SYSTEM_VARS.some(sv => sv.key === v));
  const manualVars = (template?.variables ?? []).filter(v => !SYSTEM_VARS.some(sv => sv.key === v));

  const selectedClient = clients.find(c => c.id === clientId);

  async function handleGenerate() {
    if (!template) return;
    setGenerating(true); setError('');
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template.id,
        client_id: clientId || null,
        extra_vars: extraVars,
        output_name: outputName,
      }),
    });

    setGenerating(false);

    if (res.headers.get('Content-Type')?.includes('wordprocessingml')) {
      // No Drive → download directly
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${outputName}.docx`; a.click();
      URL.revokeObjectURL(url);
      setResult({ download: true, fileName: `${outputName}.docx` });
      return;
    }

    const json = await res.json();
    if (!res.ok) { setError(json.message ?? json.error ?? 'Błąd generowania'); return; }
    setResult({ url: json.drive_url, fileName: json.file_name });
  }

  if (!template) return null;

  const catMeta = getCategoryMeta(template.category);

  return (
    <Modal open={open} onClose={onClose} title="Generuj dokument" size="lg">
      {result ? (
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 size={44} className="text-green-500" />
          <div>
            <p className="text-base font-semibold text-text-primary">Dokument wygenerowany!</p>
            <p className="text-sm text-text-muted mt-1">{result.fileName}</p>
          </div>
          {result.url ? (
            <div className="flex gap-2">
              <a href={result.url} target="_blank" rel="noreferrer">
                <Button variant="primary"><ExternalLink size={14} /> Otwórz na Google Drive</Button>
              </a>
              <Button variant="outline" onClick={onClose}>Zamknij</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <p className="text-xs text-text-muted">Plik pobrany lokalnie (brak konfiguracji Google Drive)</p>
              <Button variant="outline" onClick={onClose}>Zamknij</Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="p-5 space-y-5">
            {/* Template info */}
            <div className="flex items-center gap-3 p-3 bg-bg-subtle rounded-xl border border-border">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${catMeta.color}18` }}>
                <FileText size={18} style={{ color: catMeta.color }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{template.name}</p>
                <p className="text-xs text-text-muted">{template.file_name}</p>
              </div>
              <Badge color={catMeta.color} className="ml-auto">{catMeta.label}</Badge>
            </div>

            {/* Select client */}
            <Select
              label="Klient (opcjonalnie — uzupełni dane automatycznie)"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              options={[
                { value: '', label: 'Bez klienta / ręczne dane' },
                ...clients.map(c => ({ value: c.id, label: c.name + (c.company ? ` — ${c.company}` : '') })),
              ]}
            />

            {/* Auto variables preview */}
            {autoVars.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Zmienne auto-uzupełniane</p>
                <div className="grid grid-cols-2 gap-2">
                  {autoVars.map(v => {
                    const meta = SYSTEM_VARS.find(sv => sv.key === v)!;
                    const isClient = meta.source === 'CRM';
                    const preview = isClient && selectedClient
                      ? (selectedClient as any)[v.replace('nazwa_klienta', 'name').replace('firma', 'company').replace('numer_umowy', 'contract_number')] ?? ''
                      : meta.source === 'auto' ? `(${meta.label})` : '—';
                    return (
                      <div key={v} className="flex items-center justify-between px-3 py-2 bg-bg-subtle rounded-lg border border-border text-xs">
                        <span className="text-text-muted font-mono">{`{${v}}`}</span>
                        <span className={cn('text-text-secondary truncate max-w-[120px]', !preview && 'text-text-muted italic')}>
                          {preview || (isClient ? 'brak klienta' : '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual variables */}
            {manualVars.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Zmienne do ręcznego wypełnienia</p>
                <div className="space-y-2">
                  {manualVars.map(v => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted bg-bg-subtle border border-border px-2 py-1.5 rounded-md w-40 flex-shrink-0">{`{${v}}`}</span>
                      <input
                        value={extraVars[v] ?? ''}
                        onChange={e => setExtraVars(ev => ({ ...ev, [v]: e.target.value }))}
                        placeholder={`Wartość dla {${v}}`}
                        className="flex-1 text-sm border border-border rounded-md px-3 py-1.5 bg-bg-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output name */}
            <Input label="Nazwa pliku wynikowego" value={outputName} onChange={e => setOutputName(e.target.value)} />

            {/* Drive info */}
            {clientId && selectedClient && (
              <div className={cn('text-xs px-3 py-2 rounded-lg flex items-center gap-2',
                (selectedClient as any).google_drive_folder_id ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600')}>
                {(selectedClient as any).google_drive_folder_id
                  ? <><CheckCircle2 size={12} /> Plik zostanie zapisany w folderze Drive klienta</>
                  : <><AlertCircle size={12} /> Klient nie ma folderu Drive — plik trafi do głównego folderu Klienci lub zostanie pobrany lokalnie</>}
              </div>
            )}
            {!clientId && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <AlertCircle size={12} /> Bez wybranego klienta plik zostanie pobrany lokalnie (brak folderu Drive do zapisania)
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 size={14} className="animate-spin" /> Generuję…</> : 'Generuj dokument'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onGenerate, onDelete }: {
  template: DocTemplate;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const catMeta = getCategoryMeta(template.category);

  return (
    <div className="bg-bg-base border border-border rounded-xl p-4 hover:border-border-strong transition-colors group flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${catMeta.color}18` }}>
          <FileText size={20} style={{ color: catMeta.color }} />
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)}
            className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                <button onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={13} /> Usuń szablon
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-sm font-semibold text-text-primary leading-snug">{template.name}</h3>
        {template.description && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{template.description}</p>}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge color={catMeta.color}>{catMeta.label}</Badge>
        {template.variables.length > 0 && (
          <span className="text-[10px] text-text-muted bg-bg-subtle border border-border px-1.5 py-0.5 rounded-md">
            {template.variables.length} zmiennych
          </span>
        )}
      </div>

      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.variables.slice(0, 4).map(v => (
            <span key={v} className="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded">{`{${v}}`}</span>
          ))}
          {template.variables.length > 4 && (
            <span className="text-[10px] text-text-muted">+{template.variables.length - 4}</span>
          )}
        </div>
      )}

      <Button variant="primary" size="sm" className="w-full justify-center" onClick={onGenerate}>
        Generuj dokument
      </Button>
    </div>
  );
}

// ─── Variables Reference ──────────────────────────────────────────────────────
function VarsReference() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors">
        <Tag size={12} /> Dostępne zmienne <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 p-3 bg-bg-subtle border border-border rounded-xl">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {SYSTEM_VARS.map(v => (
              <div key={v.key} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-accent">{`{${v.key}}`}</span>
                <span className="text-text-muted">{v.label}</span>
                <span className={cn('text-[10px] px-1 rounded ml-auto', v.source === 'CRM' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-green-500/10 text-green-500')}>
                  {v.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<DocTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  useEffect(() => {
    fetch('/api/documents/templates')
      .then(r => r.json())
      .then(d => { setTemplates(d.templates ?? []); setLoading(false); });
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/templates/${id}`, { method: 'DELETE' });
    if (res.ok) setTemplates(ts => ts.filter(t => t.id !== id));
  }

  const filtered = templates.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    const matchCat = !filterCat || t.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Szablony dokumentów</h1>
          <p className="text-sm text-text-muted mt-0.5">Generuj dokumenty z szablonów DOCX z danymi klientów</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
          <Plus size={14} /> Dodaj szablon
        </Button>
      </div>

      {/* Variables reference */}
      <VarsReference />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj szablonów…"
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-base focus:outline-none focus:ring-2 focus:ring-accent/30 w-52" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilterCat('')}
            className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', !filterCat ? 'bg-accent text-white' : 'bg-bg-subtle text-text-muted hover:text-text-primary')}>
            Wszystkie
          </button>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setFilterCat(c.value === filterCat ? '' : c.value)}
              className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', filterCat === c.value ? 'text-white' : 'bg-bg-subtle text-text-muted hover:text-text-primary')}
              style={filterCat === c.value ? { backgroundColor: c.color } : {}}>
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-muted ml-auto">{filtered.length} szablonów</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-subtle border border-border flex items-center justify-center">
            <FileText size={28} className="text-text-muted" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">Brak szablonów</p>
            <p className="text-xs text-text-muted mt-1">Dodaj swój pierwszy szablon .docx z placeholderami</p>
          </div>
          <Button variant="primary" onClick={() => setShowUpload(true)}>
            <Upload size={14} /> Dodaj szablon
          </Button>

          {/* How it works */}
          <div className="max-w-lg w-full mt-4 p-4 bg-bg-subtle border border-border rounded-xl">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Jak to działa?</p>
            <ol className="space-y-2 text-sm text-text-secondary">
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>Stwórz dokument Word (.docx) z placeholderami w klamrach, np. <code className="bg-bg-muted px-1 rounded text-xs">{'{nazwa_klienta}'}</code>, <code className="bg-bg-muted px-1 rounded text-xs">{'{data}'}</code></li>
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>Wgraj szablon klikając "Dodaj szablon" — system wykryje zmienne automatycznie</li>
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>Kliknij "Generuj dokument", wybierz klienta — dane uzupełnią się z CRM</li>
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>Gotowy plik .docx trafia automatycznie do folderu klienta na Google Drive</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(t => (
            <TemplateCard key={t.id} template={t}
              onGenerate={() => setGenerateTarget(t)}
              onDelete={() => handleDelete(t.id)} />
          ))}
        </div>
      )}

      <UploadModal open={showUpload} onClose={() => setShowUpload(false)}
        onSuccess={t => setTemplates(ts => [t, ...ts])} />
      <GenerateModal template={generateTarget} open={!!generateTarget}
        onClose={() => setGenerateTarget(null)} />
    </div>
  );
}
