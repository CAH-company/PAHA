'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Hash,
  FileText, Calendar, ExternalLink, FolderOpen,
  CheckCircle2, Loader2, AlertCircle, X, Copy,
  Check, Send, Tag, Clock, Pencil, Trash2,
} from 'lucide-react';
import { useClient } from '@/hooks/useClient';
import { useEmployees } from '@/hooks/useEmployees';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDate, CLIENT_STATUS_LABELS } from '@/lib/utils';
import type { ClientStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  needs_attention: '#f59e0b',
  closed: '#94a3b8',
};

// ─── ONBOARDING CARD ──────────────────────────────────────────────────────────
interface OnboardingState {
  status: 'idle' | 'loading' | 'done' | 'already_done' | 'error' | 'no_credentials';
  folderUrl?: string;
  sharedFolderUrl?: string;
  errorMsg?: string;
  emailContent?: { subject: string; html: string } | null;
  clientEmail?: string | null;
  emailSent?: boolean;
  doneAt?: string;
}

function OnboardingCard({ clientId, client, onSuccess }: {
  clientId: string;
  client: any;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<OnboardingState>(() => {
    if (client.google_drive_folder_id) {
      return {
        status: 'already_done',
        folderUrl: `https://drive.google.com/drive/folders/${client.google_drive_folder_id}`,
        sharedFolderUrl: client.google_drive_shared_folder_id
          ? `https://drive.google.com/drive/folders/${client.google_drive_shared_folder_id}`
          : undefined,
        doneAt: client.onboarding_done_at,
      };
    }
    return { status: 'idle' };
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleOnboarding = async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/integrations/google-drive/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();

      if (data.already_done) {
        setState({
          status: 'already_done',
          folderUrl: data.folder_url,
          sharedFolderUrl: data.shared_folder_url,
          doneAt: data.onboarding_done_at,
        });
        return;
      }

      if (data.error === 'no_credentials') {
        setState({ status: 'no_credentials', errorMsg: data.message });
        return;
      }

      if (data.error) {
        setState({ status: 'error', errorMsg: data.message ?? data.error });
        return;
      }

      setState({
        status: 'done',
        folderUrl: data.folder_url,
        sharedFolderUrl: data.shared_folder_url,
        emailSent: data.email_sent,
        emailContent: data.email_content,
        clientEmail: data.client_email,
      });
      onSuccess();
    } catch (err: any) {
      setState({ status: 'error', errorMsg: 'Błąd połączenia z serwerem.' });
    }
  };

  const copyEmailHtml = () => {
    if (!state.emailContent) return;
    navigator.clipboard.writeText(state.emailContent.html).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1500);
    });
  };

  const sharedFolderName = client.company
    ? `${client.name} | ${client.company}`
    : client.name;

  return (
    <div className="bg-bg-base border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <FolderOpen size={15} className="text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Onboarding klienta</h3>
          <p className="text-xs text-text-muted">Struktura folderów Google Drive</p>
        </div>
        {(state.status === 'done' || state.status === 'already_done') && (
          <div className="ml-auto flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
            <CheckCircle2 size={14} />
            {state.status === 'already_done' ? 'Gotowe' : 'Ukończono'}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Structure preview */}
        <div className="bg-bg-subtle rounded-lg p-4 text-xs font-mono space-y-1">
          <div className="flex items-center gap-1.5 text-text-muted">
            <FolderOpen size={12} className="text-amber-500" />
            <span className="text-text-secondary font-semibold">Klienci/</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted pl-4">
            <FolderOpen size={12} className="text-amber-500" />
            <span className="text-text-secondary">{client.name}/</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted pl-8">
            <FolderOpen size={12} className="text-blue-400" />
            <span>Nasze Pliki/</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted pl-8">
            <FolderOpen size={12} className="text-emerald-400" />
            <span className="text-emerald-600">{sharedFolderName}/</span>
            <span className="text-emerald-500 font-sans text-[9px] bg-emerald-50 border border-emerald-200 rounded px-1">
              udostępniony klientowi
            </span>
          </div>
        </div>

        {/* States */}
        {state.status === 'idle' && (
          <div className="space-y-3">
            {!client.email && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
                Klient nie ma adresu email — folder zostanie utworzony, ale nie zostanie automatycznie udostępniony.
              </div>
            )}
            <Button variant="primary" className="w-full" onClick={handleOnboarding}>
              <FolderOpen size={14} />
              Utwórz strukturę folderów
            </Button>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin text-accent" />
            Tworzę foldery na Google Drive…
          </div>
        )}

        {state.status === 'no_credentials' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold mb-0.5">Brak konfiguracji Google Drive</p>
                <p>Dodaj <code className="bg-red-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> do pliku <code className="bg-red-100 px-1 rounded">.env.local</code></p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setState({ status: 'idle' })}>
              Spróbuj ponownie
            </Button>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-red-500" />
              {state.errorMsg ?? 'Wystąpił błąd. Spróbuj ponownie.'}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setState({ status: 'idle' })}>
              Spróbuj ponownie
            </Button>
          </div>
        )}

        {(state.status === 'done' || state.status === 'already_done') && (
          <div className="space-y-3">
            {/* Folder links */}
            <div className="space-y-2">
              {state.folderUrl && (
                <a href={state.folderUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-bg-subtle hover:bg-bg-muted border border-border transition-colors">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={13} className="text-amber-500" />
                    <span className="text-xs font-medium text-text-primary">{client.name}</span>
                    <span className="text-[10px] text-text-muted">(cały folder)</span>
                  </div>
                  <ExternalLink size={11} className="text-text-muted" />
                </a>
              )}
              {state.sharedFolderUrl && (
                <a href={state.sharedFolderUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 transition-colors">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={13} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">{sharedFolderName}</span>
                    <span className="text-[10px] text-emerald-600">udostępniony</span>
                  </div>
                  <ExternalLink size={11} className="text-emerald-500" />
                </a>
              )}
            </div>

            {state.doneAt && (
              <p className="text-[10px] text-text-muted flex items-center gap-1">
                <Clock size={9} /> Onboarding wykonany {formatDate(state.doneAt, 'd MMM yyyy, HH:mm')}
              </p>
            )}

            {/* Email section */}
            {client.email && (
              <div className="border-t border-border pt-3">
                {state.emailSent ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 size={13} /> Email wysłany do {client.email}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted">
                      {state.status === 'already_done'
                        ? 'Wyślij klientowi link do folderu:'
                        : 'Resend nie jest skonfigurowany — wyślij email ręcznie:'}
                    </p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowEmailModal(true)}>
                      <Send size={12} /> Pokaż email do wysyłki
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email preview modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEmailModal(false)} />
          <div className="relative bg-bg-base border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Email do klienta</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyEmailHtml}>
                  {emailCopied ? <><Check size={12} className="text-emerald-500" /> Skopiowano</> : <><Copy size={12} /> Kopiuj HTML</>}
                </Button>
                <button onClick={() => setShowEmailModal(false)} className="p-1.5 rounded hover:bg-bg-subtle text-text-muted">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Do:</p>
                <p className="text-sm text-text-primary">{client.email}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Temat:</p>
                <p className="text-sm text-text-primary">Twój folder projektowy jest gotowy</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Podgląd:</p>
                <div className="border border-border rounded-lg overflow-hidden bg-white" style={{ height: 280 }}>
                  <iframe
                    srcDoc={state.emailContent?.html ?? buildFallbackEmailHtml(client.name, state.sharedFolderUrl ?? '')}
                    className="w-full h-full border-0"
                    title="Email preview"
                  />
                </div>
              </div>
              <a
                href={`mailto:${client.email}?subject=Tw%C3%B3j%20folder%20projektowy%20jest%20gotowy&body=Witaj%20${encodeURIComponent(client.name)}%2C%0A%0ATw%C3%B3j%20folder%20Drive%3A%20${encodeURIComponent(state.sharedFolderUrl ?? '')}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Mail size={14} /> Otwórz w kliencie email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EDIT CLIENT MODAL ────────────────────────────────────────────────────────
function EditClientModal({ client, open, onClose, onSuccess, ownerOptions }: {
  client: any; open: boolean; onClose: () => void; onSuccess: () => void;
  ownerOptions: { value: string; label: string }[];
}) {
  const [form, setForm] = useState({
    name: client.name ?? '',
    company: client.company ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    nip: client.nip ?? '',
    regon: client.regon ?? '',
    contract_number: client.contract_number ?? '',
    contract_date: client.contract_date ?? '',
    status: client.status as ClientStatus,
    owner_id: client.owner_id ?? '',
    notes: client.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Podaj imię i nazwisko'); return; }
    setSaving(true); setError('');
    const supabase = createSupabaseClient();
    const { error: err } = await supabase.from('clients').update({
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      nip: form.nip.trim() || null,
      regon: form.regon.trim() || null,
      contract_number: form.contract_number.trim() || null,
      contract_date: form.contract_date || null,
      status: form.status,
      owner_id: form.owner_id || null,
      notes: form.notes.trim() || null,
    }).eq('id', client.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edytuj klienta" size="lg">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię i Nazwisko *" value={form.name} onChange={e => set('name', e.target.value)} />
          <Input label="Firma" value={form.company} onChange={e => set('company', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Telefon" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <Input label="Adres" value={form.address} onChange={e => set('address', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="NIP" value={form.nip} onChange={e => set('nip', e.target.value)} />
          <Input label="REGON" value={form.regon} onChange={e => set('regon', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nr umowy" value={form.contract_number} onChange={e => set('contract_number', e.target.value)} />
          <Input label="Data umowy" type="date" value={form.contract_date} onChange={e => set('contract_date', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={e => set('status', e.target.value as ClientStatus)}
            options={[
              { value: 'active', label: 'Aktywny' },
              { value: 'needs_attention', label: 'Wymaga uwagi' },
              { value: 'closed', label: 'Zamknięty' },
            ]} />
          <Select label="Opiekun" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
            options={[{ value: '', label: 'Brak opiekuna' }, ...ownerOptions]} />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Notatki</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
        </Button>
      </div>
    </Modal>
  );
}

function buildFallbackEmailHtml(name: string, folderUrl: string) {
  return `<div style="font-family:sans-serif;padding:24px;color:#374151">
    <h2 style="color:#6366f1">Witamy na pokładzie! 🎉</h2>
    <p>Cześć <strong>${name}</strong>,</p>
    <p>Twój folder na Google Drive jest gotowy:</p>
    <p><a href="${folderUrl}" style="color:#6366f1">📁 Otwórz folder</a></p>
  </div>`;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { client, loading, notFound, refetch } = useClient(id);
  const { employees } = useEmployees();
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ownerOptions = employees.map(e => ({ value: e.id, label: e.name }));

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm(`Na pewno usunąć klienta "${client.name}"? Tej operacji nie można cofnąć.`)) return;
    setDeleting(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    setDeleting(false);
    if (error) { alert(error.message); return; }
    router.push('/crm/clients');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-text-muted">Nie znaleziono klienta.</p>
        <Link href="/crm/clients" className="text-sm text-accent hover:underline">← Wróć do listy</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link href="/crm/clients"
          className="mt-1 p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors flex-shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">{client.name}</h1>
              {client.company && (
                <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
                  <Building2 size={12} /> {client.company}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge color={STATUS_COLORS[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
                {client.contract_number && (
                  <span className="text-xs text-text-muted">#{client.contract_number}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil size={13} /> Edytuj
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={13} /> {deleting ? 'Usuwam…' : 'Usuń'}
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Onboarding */}
          <OnboardingCard clientId={client.id} client={client} onSuccess={refetch} />

          {/* Contact info */}
          <div className="bg-bg-base border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Dane kontaktowe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {client.email && (
                <InfoRow icon={Mail} label="Email">
                  <a href={`mailto:${client.email}`} className="text-accent hover:underline text-xs">{client.email}</a>
                </InfoRow>
              )}
              {client.phone && (
                <InfoRow icon={Phone} label="Telefon">
                  <a href={`tel:${client.phone}`} className="text-xs text-text-primary">{client.phone}</a>
                </InfoRow>
              )}
              {client.address && (
                <InfoRow icon={MapPin} label="Adres">
                  <span className="text-xs text-text-primary">{client.address}</span>
                </InfoRow>
              )}
              {client.nip && (
                <InfoRow icon={Hash} label="NIP">
                  <span className="text-xs text-text-primary font-mono">{client.nip}</span>
                </InfoRow>
              )}
              {client.regon && (
                <InfoRow icon={Hash} label="REGON">
                  <span className="text-xs text-text-primary font-mono">{client.regon}</span>
                </InfoRow>
              )}
            </div>
          </div>

          {/* Contract */}
          {(client.contract_number || client.contract_date) && (
            <div className="bg-bg-base border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Umowa</h3>
              <div className="grid grid-cols-2 gap-3">
                {client.contract_number && (
                  <InfoRow icon={FileText} label="Numer umowy">
                    <span className="text-xs text-text-primary font-mono">{client.contract_number}</span>
                  </InfoRow>
                )}
                {client.contract_date && (
                  <InfoRow icon={Calendar} label="Data podpisania">
                    <span className="text-xs text-text-primary">{formatDate(client.contract_date)}</span>
                  </InfoRow>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="bg-bg-base border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Notatki</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Right — 1/3 */}
        <div className="space-y-5">

          {/* Link do księgowości */}
          <div className="bg-bg-base border border-border rounded-xl p-4">
            <Link href={`/accounting?client=${client.id}`}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-medium">
              <FileText size={13} /> Przejdź do księgowości →
            </Link>
          </div>

          {/* Owner */}
          {client.owner && (
            <div className="bg-bg-base border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Opiekun</h3>
              <div className="flex items-center gap-3">
                <Avatar name={client.owner.name} size="sm" />
                <div>
                  <p className="text-xs font-medium text-text-primary">{client.owner.name}</p>
                  <p className="text-[10px] text-text-muted">{client.owner.position ?? client.owner.role}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {client.tags.length > 0 && (
            <div className="bg-bg-base border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                <Tag size={12} /> Tagi
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-bg-subtle border border-border text-xs text-text-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-bg-base border border-border rounded-xl p-5 space-y-2">
            <InfoRow icon={Calendar} label="Dodano">
              <span className="text-xs text-text-primary">{formatDate(client.created_at)}</span>
            </InfoRow>
            <InfoRow icon={Clock} label="Aktualizacja">
              <span className="text-xs text-text-primary">{formatDate(client.updated_at)}</span>
            </InfoRow>
          </div>
        </div>
      </div>

      <EditClientModal
        client={client}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={refetch}
        ownerOptions={ownerOptions}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-md bg-bg-subtle flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={11} className="text-text-muted" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
