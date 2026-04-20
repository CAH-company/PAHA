'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail, Plus, Trash2, Search, RefreshCw, Send, Reply, Forward,
  Paperclip, Star, StarOff, ChevronDown, X, Loader2, AlertCircle,
  Inbox, Settings, CheckCircle2, Eye, EyeOff, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailAccount {
  id: string;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  created_at: string;
}

interface MessageSummary {
  uid: number;
  subject: string;
  from: { name?: string; address: string } | null;
  to: { name?: string; address: string }[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  size: number;
  hasAttachment: boolean;
}

interface MessageDetail {
  uid: number;
  subject: string;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  cc: { name?: string; address: string }[];
  date: string | null;
  html: string | null;
  text: string | null;
  inReplyTo: string | null;
  messageId: string | null;
  attachments: { filename: string; contentType: string; size: number }[];
}

// ─── Provider presets ─────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: 'gmail',   label: 'Gmail',           imap_host: 'imap.gmail.com',            imap_port: 993, imap_secure: true,  smtp_host: 'smtp.gmail.com',            smtp_port: 587, smtp_secure: false },
  { id: 'outlook', label: 'Outlook / Office', imap_host: 'outlook.office365.com',     imap_port: 993, imap_secure: true,  smtp_host: 'smtp.office365.com',        smtp_port: 587, smtp_secure: false },
  { id: 'yahoo',   label: 'Yahoo Mail',       imap_host: 'imap.mail.yahoo.com',       imap_port: 993, imap_secure: true,  smtp_host: 'smtp.mail.yahoo.com',       smtp_port: 465, smtp_secure: true },
  { id: 'custom',  label: 'Inny (własny)',    imap_host: '',                          imap_port: 993, imap_secure: true,  smtp_host: '',                          smtp_port: 587, smtp_secure: false },
];

const EMPTY_ACC = { name: '', email: '', provider: 'gmail', imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: true, smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: false, username: '', password: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAddr(a: { name?: string; address: string } | null) {
  if (!a) return '—';
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function formatDate(d: string | null) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' });
  if (isThisYear) return date.toLocaleDateString('pl', { day: 'numeric', month: 'short' });
  return date.toLocaleDateString('pl', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(a: { name?: string; address: string } | null) {
  if (!a) return '?';
  const src = a.name || a.address;
  return src.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(s: string) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % colors.length;
  return colors[h];
}

// ─── Add Account Modal ────────────────────────────────────────────────────────
function AddAccountModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (acc: EmailAccount) => void }) {
  const [form, setForm] = useState({ ...EMPTY_ACC });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof EMPTY_ACC) => (e: React.ChangeEvent<any>) => setForm(f => ({ ...f, [k]: e.target.value }));

  function applyProvider(providerId: string) {
    const p = PROVIDERS.find(p => p.id === providerId);
    if (!p) return;
    setForm(f => ({ ...f, provider: providerId, imap_host: p.imap_host, imap_port: p.imap_port, imap_secure: p.imap_secure, smtp_host: p.smtp_host, smtp_port: p.smtp_port, smtp_secure: p.smtp_secure }));
  }

  useEffect(() => { if (open) setForm({ ...EMPTY_ACC }); }, [open]);

  async function handleSave() {
    if (!form.name || !form.email || !form.username || !form.password) { setError('Wypełnij wszystkie wymagane pola.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/mail/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.message ?? json.error ?? 'Błąd połączenia'); return; }
    onSuccess(json.account);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Dodaj skrzynkę mailową" size="lg">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nazwa wyświetlana *" value={form.name} onChange={set('name')} placeholder="Moja skrzynka" />
          <Input label="Adres email *" type="email" value={form.email} onChange={set('email')} placeholder="jan@firma.pl" />
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Dostawca</label>
          <div className="grid grid-cols-4 gap-2">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => applyProvider(p.id)}
                className={cn('px-3 py-2 text-xs rounded-lg border transition-colors text-left',
                  form.provider === p.id ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border text-text-secondary hover:border-border-strong')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {form.provider === 'gmail' && (
          <div className="text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg">
            Gmail wymaga <strong>hasła aplikacji</strong> (App Password), nie hasła konta. Włącz 2FA → Ustawienia konta Google → Bezpieczeństwo → Hasła aplikacji.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Login (username) *" value={form.username} onChange={set('username')} placeholder="jan@firma.pl" />
          <Input label="Hasło / App Password *" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
        </div>

        {form.provider === 'custom' && (
          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-1">Serwer IMAP (odbieranie)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Host IMAP" value={form.imap_host} onChange={set('imap_host')} placeholder="imap.example.com" />
              </div>
              <Input label="Port" type="number" value={String(form.imap_port)} onChange={e => setForm(f => ({ ...f, imap_port: parseInt(e.target.value) || 993 }))} />
            </div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Serwer SMTP (wysyłanie)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Host SMTP" value={form.smtp_host} onChange={set('smtp_host')} placeholder="smtp.example.com" />
              </div>
              <Input label="Port" type="number" value={String(form.smtp_port)} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Łączę…</> : 'Dodaj i przetestuj'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
interface ComposeProps {
  open: boolean;
  onClose: () => void;
  account: EmailAccount | null;
  replyTo?: MessageDetail | null;
  forwardOf?: MessageDetail | null;
}

function ComposeModal({ open, onClose, account, replyTo, forwardOf }: ComposeProps) {
  const getInitialForm = useCallback(() => {
    if (replyTo) {
      const replyAddr = replyTo.from[0]?.address ?? '';
      return { to: replyAddr, cc: '', subject: replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`, body: `\n\n---\nOd: ${formatAddr(replyTo.from[0])}\nData: ${replyTo.date ? new Date(replyTo.date).toLocaleString('pl') : ''}\nTemat: ${replyTo.subject}\n\n${replyTo.text ?? ''}`, inReplyTo: replyTo.messageId ?? '' };
    }
    if (forwardOf) {
      return { to: '', cc: '', subject: forwardOf.subject.startsWith('Fwd:') ? forwardOf.subject : `Fwd: ${forwardOf.subject}`, body: `\n\n---\nOd: ${formatAddr(forwardOf.from[0])}\nData: ${forwardOf.date ? new Date(forwardOf.date).toLocaleString('pl') : ''}\nTemat: ${forwardOf.subject}\n\n${forwardOf.text ?? ''}`, inReplyTo: '' };
    }
    return { to: '', cc: '', subject: '', body: '', inReplyTo: '' };
  }, [replyTo, forwardOf]);

  const [form, setForm] = useState(getInitialForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => { if (open) { setForm(getInitialForm()); setError(''); setSent(false); } }, [open, getInitialForm]);

  async function handleSend() {
    if (!form.to.trim()) { setError('Podaj adres odbiorcy.'); return; }
    if (!form.subject.trim()) { setError('Podaj temat.'); return; }
    if (!account) { setError('Wybierz skrzynkę.'); return; }
    setSending(true); setError('');
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: account.id,
        to: form.to,
        cc: form.cc || undefined,
        subject: form.subject,
        text: form.body,
        in_reply_to: form.inReplyTo || undefined,
      }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) { setError(json.message ?? 'Błąd wysyłania'); return; }
    setSent(true);
    setTimeout(onClose, 1200);
  }

  return (
    <Modal open={open} onClose={onClose} title={replyTo ? 'Odpowiedz' : forwardOf ? 'Przekaż dalej' : 'Nowa wiadomość'} size="xl">
      {sent ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <CheckCircle2 size={40} className="text-green-500" />
          <p className="text-base font-semibold text-text-primary">Wysłano!</p>
        </div>
      ) : (
        <>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm border-b border-border pb-3">
              <span className="text-text-muted w-12 flex-shrink-0">Od:</span>
              <span className="text-text-primary font-medium">{account ? `${account.name} <${account.email}>` : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted w-12 flex-shrink-0">Do:</span>
              <input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                className="flex-1 text-sm bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted"
                placeholder="adresat@domena.pl" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted w-12 flex-shrink-0">DW:</span>
              <input value={form.cc} onChange={e => setForm(f => ({ ...f, cc: e.target.value }))}
                className="flex-1 text-sm bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted"
                placeholder="opcjonalnie" />
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <span className="text-sm text-text-muted w-12 flex-shrink-0">Temat:</span>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="flex-1 text-sm bg-transparent border-none outline-none text-text-primary font-medium placeholder:text-text-muted"
                placeholder="Temat wiadomości" />
            </div>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={10}
              className="w-full text-sm bg-bg-subtle border border-border rounded-lg px-3 py-2 text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono"
              placeholder="Treść wiadomości…"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex justify-between items-center px-5 py-4 border-t border-border bg-bg-subtle">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="primary" onClick={handleSend} disabled={sending}>
              {sending ? <><Loader2 size={14} className="animate-spin" /> Wysyłam…</> : <><Send size={14} /> Wyślij</>}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Message List Item ────────────────────────────────────────────────────────
function MessageItem({ msg, selected, onClick }: { msg: MessageSummary; selected: boolean; onClick: () => void }) {
  const from = msg.from;
  const color = avatarColor(from?.address ?? '?');
  return (
    <button onClick={onClick}
      className={cn('w-full text-left px-4 py-3 border-b border-border transition-colors flex items-start gap-3 group',
        selected ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-bg-subtle',
        !msg.seen && 'bg-bg-base'
      )}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color }}>
        {initials(from)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn('text-sm truncate', !msg.seen ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
            {from?.name || from?.address || '—'}
          </span>
          <span className="text-[11px] text-text-muted flex-shrink-0">{formatDate(msg.date)}</span>
        </div>
        <p className={cn('text-xs truncate', !msg.seen ? 'font-medium text-text-primary' : 'text-text-muted')}>
          {msg.subject}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {!msg.seen && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
          {msg.flagged && <Star size={10} className="text-amber-400 fill-amber-400" />}
          {msg.answered && <Reply size={10} className="text-text-muted" />}
          {msg.hasAttachment && <Paperclip size={10} className="text-text-muted" />}
        </div>
      </div>
    </button>
  );
}

// ─── Message Detail ───────────────────────────────────────────────────────────
function MessageView({ msg, onReply, onForward, onDelete }: {
  msg: MessageDetail;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
}) {
  const [showHtml, setShowHtml] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (showHtml && msg.html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#374151;margin:16px;word-break:break-word;}a{color:#6366f1;}img{max-width:100%;height:auto;}</style></head><body>${msg.html}</body></html>`);
        doc.close();
        // Auto-resize
        const resize = () => {
          if (iframeRef.current && doc.body) {
            iframeRef.current.style.height = doc.body.scrollHeight + 32 + 'px';
          }
        };
        setTimeout(resize, 100);
      }
    }
  }, [msg.html, showHtml]);

  const from = msg.from[0];
  const color = avatarColor(from?.address ?? '?');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <h2 className="text-base font-semibold text-text-primary mb-3 leading-snug">{msg.subject}</h2>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: color }}>
            {initials(from ?? null)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-text-primary">{from?.name || from?.address || '—'}</span>
                {from?.name && <span className="text-xs text-text-muted ml-1">&lt;{from.address}&gt;</span>}
              </div>
              <span className="text-xs text-text-muted flex-shrink-0">
                {msg.date ? new Date(msg.date).toLocaleString('pl', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Do: {msg.to.map(t => t.name || t.address).join(', ')}
              {msg.cc.length > 0 && <> · DW: {msg.cc.map(t => t.name || t.address).join(', ')}</>}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-2 border-b border-border flex items-center gap-2 flex-shrink-0 bg-bg-subtle">
        <Button variant="outline" size="sm" onClick={onReply}><Reply size={13} /> Odpowiedz</Button>
        <Button variant="outline" size="sm" onClick={onForward}><Forward size={13} /> Przekaż</Button>
        <div className="flex-1" />
        {msg.html && (
          <button onClick={() => setShowHtml(s => !s)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors">
            {showHtml ? <><EyeOff size={12} /> Tekst</> : <><Eye size={12} /> HTML</>}
          </button>
        )}
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {msg.attachments.length > 0 && (
          <div className="px-6 py-3 border-b border-border bg-bg-subtle flex flex-wrap gap-2">
            {msg.attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-base border border-border rounded-lg text-xs text-text-secondary">
                <Paperclip size={11} className="text-text-muted" />
                <span>{a.filename}</span>
                <span className="text-text-muted">({(a.size / 1024).toFixed(0)} KB)</span>
              </div>
            ))}
          </div>
        )}

        {showHtml && msg.html ? (
          <iframe ref={iframeRef} className="w-full border-none min-h-[200px]" sandbox="allow-same-origin" title="email" />
        ) : (
          <pre className="px-6 py-4 text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
            {msg.text ?? '(brak treści)'}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MailPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<MessageDetail | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [compose, setCompose] = useState<{ open: boolean; reply?: MessageDetail; forward?: MessageDetail }>({ open: false });
  const [folder, setFolder] = useState('INBOX');
  const [folders, setFolders] = useState<string[]>([]);

  // Load accounts
  useEffect(() => {
    fetch('/api/mail/accounts')
      .then(r => r.json())
      .then(d => {
        setAccounts(d.accounts ?? []);
        if (d.accounts?.length > 0) setSelectedAccount(d.accounts[0]);
      });
  }, []);

  // Foldery ładowane razem z wiadomościami (jedno połączenie IMAP)

  // Load messages when account or search changes
  const loadMessages = useCallback(async (account: EmailAccount, searchTerm = '', loadFolders = false) => {
    setLoading(true); setError(''); setSelectedMsg(null); setSelectedUid(null);
    const params = new URLSearchParams({ account_id: account.id, folder });
    if (searchTerm) params.set('search', searchTerm);
    if (loadFolders) params.set('include_folders', 'true');
    const res = await fetch(`/api/mail/messages?${params}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.message ?? 'Błąd wczytywania'); return; }
    setMessages(json.messages ?? []);
    if (json.folders) {
      setFolders(json.folders);
      if (json.total === 0 && json.folders.some((p: string) => p.includes('All Mail'))) {
        const allMail = json.folders.find((p: string) => p.includes('All Mail'));
        if (allMail) setFolder(allMail);
      }
    }
  }, [folder]);

  useEffect(() => {
    if (selectedAccount) {
      // Pierwsze ładowanie — pobierz też foldery razem z wiadomościami (1 połączenie IMAP)
      const isFirstLoad = folders.length === 0;
      loadMessages(selectedAccount, search, isFirstLoad);
    }
  }, [selectedAccount, search, loadMessages]);

  async function openMessage(uid: number) {
    if (!selectedAccount) return;
    setSelectedUid(uid);
    setMsgLoading(true);
    const res = await fetch(`/api/mail/messages/${uid}?account_id=${selectedAccount.id}&folder=${folder}`);
    const json = await res.json();
    setMsgLoading(false);
    if (!res.ok) { setError(json.message ?? 'Błąd'); return; }
    setSelectedMsg(json.message);
    // Mark as read in list
    setMessages(msgs => msgs.map(m => m.uid === uid ? { ...m, seen: true } : m));
  }

  async function deleteMessage() {
    if (!selectedAccount || !selectedUid) return;
    await fetch(`/api/mail/messages/${selectedUid}?account_id=${selectedAccount.id}&folder=${folder}`, { method: 'DELETE' });
    setMessages(msgs => msgs.filter(m => m.uid !== selectedUid));
    setSelectedMsg(null); setSelectedUid(null);
  }

  async function removeAccount(id: string) {
    await fetch(`/api/mail/accounts/${id}`, { method: 'DELETE' });
    setAccounts(a => {
      const next = a.filter(x => x.id !== id);
      if (selectedAccount?.id === id) setSelectedAccount(next[0] ?? null);
      return next;
    });
  }

  const unread = messages.filter(m => !m.seen).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-4 overflow-hidden">

      {/* ── Left: Accounts + folder ───────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-border bg-bg-subtle flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Skrzynki</span>
            <button onClick={() => setShowAdd(true)} className="p-1 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {accounts.map(acc => (
              <div key={acc.id}
                className={cn('group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                  selectedAccount?.id === acc.id ? 'bg-accent/10 text-accent' : 'hover:bg-bg-muted text-text-secondary')}>
                <div onClick={() => setSelectedAccount(acc)} className="flex items-center gap-2 flex-1 min-w-0">
                  <Mail size={14} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{acc.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{acc.email}</p>
                  </div>
                </div>
                <button onClick={() => removeAccount(acc.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-500 transition-all">
                  <X size={12} />
                </button>
              </div>
            ))}
            {accounts.length === 0 && (
              <button onClick={() => setShowAdd(true)}
                className="w-full text-left px-2 py-2 text-xs text-text-muted hover:text-accent transition-colors flex items-center gap-1.5">
                <Plus size={12} /> Dodaj skrzynkę
              </button>
            )}
          </div>
        </div>

        {selectedAccount && (
          <div className="px-4 py-3 space-y-0.5 max-h-64 overflow-y-auto">
            {(folders.length > 0 ? folders : ['INBOX']).map(f => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                  folder === f ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-muted'
                )}
              >
                <Inbox size={13} className="flex-shrink-0" />
                <span className="truncate">{f.split('/').pop()}</span>
                {f === folder && unread > 0 && (
                  <span className="ml-auto text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5 font-bold">{unread}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {selectedAccount && (
          <div className="px-4 py-3 border-t border-border">
            <Button variant="primary" size="sm" className="w-full justify-center" onClick={() => setCompose({ open: true })}>
              <Pencil size={13} /> Nowa wiadomość
            </Button>
          </div>
        )}
      </div>

      {/* ── Middle: Message list ──────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col bg-bg-base">
        <div className="px-3 py-3 border-b border-border flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
              placeholder="Szukaj…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg-base focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button onClick={() => selectedAccount && loadMessages(selectedAccount, search)}
            className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <div className="p-4 text-xs text-red-500 bg-red-500/10 m-3 rounded-lg flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {error}
            </div>
          ) : !selectedAccount ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Mail size={32} className="text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Dodaj skrzynkę mailową żeby zacząć</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
                <Plus size={13} /> Dodaj skrzynkę
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Inbox size={28} className="text-text-muted mb-2" />
              <p className="text-sm text-text-muted">Brak wiadomości</p>
            </div>
          ) : (
            messages.map(msg => (
              <MessageItem key={msg.uid} msg={msg} selected={selectedUid === msg.uid} onClick={() => openMessage(msg.uid)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Message detail ─────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col bg-bg-base overflow-hidden">
        {msgLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : selectedMsg ? (
          <MessageView
            msg={selectedMsg}
            onReply={() => setCompose({ open: true, reply: selectedMsg })}
            onForward={() => setCompose({ open: true, forward: selectedMsg })}
            onDelete={deleteMessage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Mail size={40} className="text-text-muted mb-4 opacity-40" />
            <p className="text-sm text-text-muted">Wybierz wiadomość z listy</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddAccountModal open={showAdd} onClose={() => setShowAdd(false)}
        onSuccess={acc => { setAccounts(a => [...a, acc]); setSelectedAccount(acc); }} />
      <ComposeModal
        open={compose.open}
        onClose={() => setCompose({ open: false })}
        account={selectedAccount}
        replyTo={compose.reply}
        forwardOf={compose.forward}
      />
    </div>
  );
}
