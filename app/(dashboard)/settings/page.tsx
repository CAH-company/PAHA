'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Check, Zap, Mail, Bell, Link2, Shield,
  Settings, Loader2, Building2, Copy, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  { id: 'general', label: 'Firma', icon: Building2 },
  { id: 'email', label: 'Email (Resend)', icon: Mail },
  { id: 'notifications', label: 'Powiadomienia', icon: Bell },
  { id: 'ai', label: 'AI Agent', icon: Zap },
  { id: 'integrations', label: 'Integracje', icon: Link2 },
  { id: 'security', label: 'Bezpieczeństwo', icon: Shield },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function useSetting(keys: string[]) {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/settings?keys=${keys.join(',')}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, setData, loading };
}

async function saveSettings(entries: { key: string; value: string; is_secret?: boolean; label?: string }[]) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  });
  return res.ok;
}

function SaveRow({ onSave, saving, saved, error }: {
  onSave: () => void; saving: boolean; saved: boolean; error?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button variant="primary" onClick={onSave} disabled={saving}>
        {saving ? <><Loader2 size={13} className="animate-spin" /> Zapisywanie...</> : 'Zapisz'}
      </Button>
      {saved && (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
          <Check size={13} /> Zapisano
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function SecretField({ label, description, value, onChange }: {
  label: string; description?: string; value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      {description && <p className="text-xs text-text-muted">{description}</p>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••••••••••••••"
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 pr-10"
        />
        <button onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function ReadonlyUrl({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <div className="flex gap-2">
        <input readOnly value={url}
          className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg-muted text-text-muted font-mono" />
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </Button>
      </div>
    </div>
  );
}

// ─── sections ─────────────────────────────────────────────────────────────────

function GeneralSection() {
  const KEYS = ['company_name', 'company_nip', 'company_address', 'company_phone', 'company_website', 'timezone', 'currency'];
  const { data, setData, loading } = useSetting(KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }

  async function save() {
    setSaving(true);
    setError('');
    const ok = await saveSettings([
      { key: 'company_name', value: data.company_name ?? '', label: 'Nazwa firmy' },
      { key: 'company_nip', value: data.company_nip ?? '', label: 'NIP' },
      { key: 'company_address', value: data.company_address ?? '', label: 'Adres' },
      { key: 'company_phone', value: data.company_phone ?? '', label: 'Telefon' },
      { key: 'company_website', value: data.company_website ?? '', label: 'Strona WWW' },
      { key: 'timezone', value: data.timezone ?? 'Europe/Warsaw', label: 'Strefa czasowa' },
      { key: 'currency', value: data.currency ?? 'PLN', label: 'Waluta' },
    ]);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError('Błąd zapisu');
  }

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm py-8"><Loader2 size={14} className="animate-spin" /> Ładowanie...</div>;

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">Profil firmy</h2>
      <p className="text-xs text-text-muted -mt-4">Te dane są wspólne dla całego zespołu i pojawiają się np. na ofertach i fakturach.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Nazwa firmy" value={data.company_name ?? ''} onChange={e => set('company_name', e.target.value)} placeholder="Acme Sp. z o.o." />
        </div>
        <Input label="NIP" value={data.company_nip ?? ''} onChange={e => set('company_nip', e.target.value)} placeholder="0000000000" />
        <Input label="Telefon" value={data.company_phone ?? ''} onChange={e => set('company_phone', e.target.value)} placeholder="+48 000 000 000" />
        <div className="col-span-2">
          <Input label="Adres" value={data.company_address ?? ''} onChange={e => set('company_address', e.target.value)} placeholder="ul. Przykładowa 1, 00-000 Warszawa" />
        </div>
        <div className="col-span-2">
          <Input label="Strona WWW" value={data.company_website ?? ''} onChange={e => set('company_website', e.target.value)} placeholder="https://twojafirma.pl" />
        </div>
      </div>

      <hr className="border-border" />

      <div className="grid grid-cols-2 gap-4">
        <Select label="Strefa czasowa" value={data.timezone ?? 'Europe/Warsaw'}
          options={[{ value: 'Europe/Warsaw', label: 'Europe/Warsaw (UTC+1/+2)' }]}
          onChange={e => set('timezone', (e.target as HTMLSelectElement).value)} />
        <Select label="Domyślna waluta" value={data.currency ?? 'PLN'}
          options={[
            { value: 'PLN', label: 'PLN — Złoty' },
            { value: 'EUR', label: 'EUR — Euro' },
            { value: 'USD', label: 'USD — Dolar' },
          ]}
          onChange={e => set('currency', (e.target as HTMLSelectElement).value)} />
      </div>

      <SaveRow onSave={save} saving={saving} saved={saved} error={error} />
    </>
  );
}

function AISection() {
  const KEYS = [
    'anthropic_api_key', 'agent_model',
    'automation_provider', 'automation_anthropic_model', 'gemini_api_key', 'gemini_model',
  ];
  const { data, setData, loading } = useSetting(KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }

  const automationProvider = data.automation_provider ?? 'anthropic';

  async function save() {
    setSaving(true);
    setError('');
    const ok = await saveSettings([
      { key: 'anthropic_api_key', value: data.anthropic_api_key ?? '', is_secret: true, label: 'Anthropic API Key' },
      { key: 'agent_model', value: data.agent_model ?? 'claude-sonnet-4-6', label: 'Model Agenta AI' },
      { key: 'automation_provider', value: automationProvider, label: 'Dostawca automatyzacji AI' },
      { key: 'automation_anthropic_model', value: data.automation_anthropic_model ?? 'claude-haiku-4-5-20251001', label: 'Model Anthropic (automatyzacje)' },
      { key: 'gemini_api_key', value: data.gemini_api_key ?? '', is_secret: true, label: 'Gemini API Key' },
      { key: 'gemini_model', value: data.gemini_model ?? 'gemini-2.0-flash', label: 'Model Gemini' },
    ]);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError('Błąd zapisu');
  }

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm py-8"><Loader2 size={14} className="animate-spin" /> Ładowanie...</div>;

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">AI Agent</h2>

      {/* Agent AI — zawsze Anthropic */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Agent AI (Operacje)</p>
          <p className="text-xs text-text-muted mt-0.5">Asystent w zakładce Operacje — zawsze korzysta z Claude.</p>
        </div>
        <SecretField
          label="Anthropic API Key"
          description="Klucz z console.anthropic.com (sk-ant-...)"
          value={data.anthropic_api_key ?? ''}
          onChange={v => set('anthropic_api_key', v)}
        />
        <Select
          label="Model agenta"
          value={data.agent_model ?? 'claude-sonnet-4-6'}
          options={[
            { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (najlepszy)' },
            { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (zalecany)' },
            { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (najtańszy)' },
          ]}
          onChange={e => set('agent_model', (e.target as HTMLSelectElement).value)}
        />
      </div>

      {/* Automatyzacje AI — Anthropic lub Gemini */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Automatyzacje AI</p>
          <p className="text-xs text-text-muted mt-0.5">
            Do prostych zadań: wyciąganie tasków z transkrypcji, generowanie faktur AI.
            Można użyć Gemini za darmo.
          </p>
        </div>

        <Select
          label="Dostawca"
          value={automationProvider}
          options={[
            { value: 'anthropic', label: 'Anthropic (Claude) — ten sam klucz co Agent' },
            { value: 'gemini', label: 'Google Gemini — darmowy (1500 req/dzień)' },
          ]}
          onChange={e => set('automation_provider', (e.target as HTMLSelectElement).value)}
        />

        {automationProvider === 'anthropic' && (
          <Select
            label="Model (automatyzacje)"
            value={data.automation_anthropic_model ?? 'claude-haiku-4-5-20251001'}
            options={[
              { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (najtańszy, zalecany)' },
              { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
            ]}
            onChange={e => set('automation_anthropic_model', (e.target as HTMLSelectElement).value)}
          />
        )}

        {automationProvider === 'gemini' && (
          <>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              Klucz z <strong>aistudio.google.com</strong> — darmowy, nie wymaga karty.
            </div>
            <SecretField
              label="Google AI Studio API Key"
              value={data.gemini_api_key ?? ''}
              onChange={v => set('gemini_api_key', v)}
            />
            <Select
              label="Model Gemini"
              value={data.gemini_model ?? 'gemini-2.0-flash'}
              options={[
                { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (zalecany, darmowy)' },
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (darmowy)' },
                { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (płatny)' },
              ]}
              onChange={e => set('gemini_model', (e.target as HTMLSelectElement).value)}
            />
          </>
        )}
      </div>

      <SaveRow onSave={save} saving={saving} saved={saved} error={error} />
    </>
  );
}

function IntegrationsSection() {
  const KEYS = ['fathom_webhook_secret', 'leads_webhook_secret', 'meta_verify_token', 'meta_app_secret', 'meta_page_access_token'];
  const { data, setData, loading } = useSetting(KEYS);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [metaTest, setMetaTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [metaTesting, setMetaTesting] = useState(false);

  function set(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }

  async function saveKey(keys: { key: string; label: string }[]) {
    const id = keys[0].key;
    setSaving(id);
    setErrors(e => ({ ...e, [id]: '' }));
    const ok = await saveSettings(keys.map(k => ({ key: k.key, value: data[k.key] ?? '', is_secret: true, label: k.label })));
    setSaving(null);
    if (ok) { setSaved(id); setTimeout(() => setSaved(null), 2500); }
    else setErrors(e => ({ ...e, [id]: 'Błąd zapisu' }));
  }

  async function testMetaToken() {
    setMetaTesting(true);
    setMetaTest(null);
    try {
      const res = await fetch('/api/meta-leads/retry');
      const d = await res.json();
      if (d.ok) {
        const expiry = d.expires_at === 'never (non-expiring token)'
          ? 'token bezterminowy'
          : `wygasa ${new Date(d.expires_at).toLocaleDateString('pl-PL')}`;
        const leadsOk = d.has_leads_retrieval;
        setMetaTest({
          ok: leadsOk,
          text: leadsOk
            ? `Token OK · uprawnienie leads_retrieval ✓ · ${expiry}`
            : `Token aktywny ale BRAK leads_retrieval · ${expiry} — wygeneruj nowy token z tym uprawnieniem`,
        });
      } else {
        setMetaTest({ ok: false, text: d.error ?? 'Nieznany błąd' });
      }
    } catch {
      setMetaTest({ ok: false, text: 'Błąd sieci' });
    } finally {
      setMetaTesting(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://twoja-domena.vercel.app';

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm py-8"><Loader2 size={14} className="animate-spin" /> Ładowanie...</div>;

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">Integracje</h2>

      {/* Fathom */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Mail size={14} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Fathom</p>
            <p className="text-xs text-text-muted">Transkrypcje spotkań → automatyczne taski przez AI</p>
          </div>
        </div>
        <ReadonlyUrl
          label="Webhook URL — wklej w Fathom → Settings → Integrations"
          url={`${origin}/api/webhooks/fathom`}
        />
        <SecretField
          label="Webhook Secret (whsec_...)"
          description="Skopiuj z panelu Fathom po dodaniu webhooka"
          value={data.fathom_webhook_secret ?? ''}
          onChange={v => set('fathom_webhook_secret', v)}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm"
            disabled={saving === 'fathom_webhook_secret'}
            onClick={() => saveKey([{ key: 'fathom_webhook_secret', label: 'Fathom Webhook Secret' }])}>
            {saving === 'fathom_webhook_secret' ? <Loader2 size={12} className="animate-spin" /> : 'Zapisz'}
          </Button>
          {saved === 'fathom_webhook_secret' && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Zapisano</span>}
        </div>
      </div>

      {/* Leads webhook — generic (Clay, Lemlist, Typeform, formularze) */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Link2 size={14} className="text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">CRM Webhook — ogólny</p>
            <p className="text-xs text-text-muted">Przyjmuje leady z Clay, Lemlist, Typeform i własnych formularzy</p>
          </div>
        </div>
        <ReadonlyUrl
          label="Webhook URL"
          url={`${origin}/api/webhooks/lead`}
        />
        <SecretField
          label="API Key (opcjonalny)"
          description="Jeśli ustawiony — wymagany w nagłówku x-api-key przy każdym żądaniu"
          value={data.leads_webhook_secret ?? ''}
          onChange={v => set('leads_webhook_secret', v)}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm"
            disabled={saving === 'leads_webhook_secret'}
            onClick={() => saveKey([{ key: 'leads_webhook_secret', label: 'Leads Webhook Secret' }])}>
            {saving === 'leads_webhook_secret' ? <Loader2 size={12} className="animate-spin" /> : 'Zapisz'}
          </Button>
          {saved === 'leads_webhook_secret' && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Zapisano</span>}
        </div>
      </div>

      {/* Meta Lead Ads webhook */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Meta Lead Ads</p>
            <p className="text-xs text-text-muted">Automatycznie dodaje leady z formularzy Meta Lead Ads do CRM</p>
          </div>
        </div>
        <ReadonlyUrl
          label="Callback URL — wklej w Meta for Developers → Webhooks"
          url={`${origin}/api/webhooks/meta-lead`}
        />
        <SecretField
          label="Verify Token"
          description="Dowolny tekst — wpisz ten sam token w panelu Meta przy konfiguracji webhooka"
          value={data.meta_verify_token ?? ''}
          onChange={v => set('meta_verify_token', v)}
        />
        <SecretField
          label="App Secret"
          description="Klucz tajny aplikacji z Meta for Developers → Twoja App → Ustawienia → Podstawowe"
          value={data.meta_app_secret ?? ''}
          onChange={v => set('meta_app_secret', v)}
        />
        <SecretField
          label="Page Access Token"
          description="Token dostępu do Strony — Graph API Explorer → wybierz Stronę → wygeneruj token z uprawnieniem leads_retrieval"
          value={data.meta_page_access_token ?? ''}
          onChange={v => set('meta_page_access_token', v)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm"
            disabled={saving === 'meta_verify_token'}
            onClick={() => saveKey([
              { key: 'meta_verify_token',      label: 'Meta Webhook Verify Token' },
              { key: 'meta_app_secret',        label: 'Meta App Secret' },
              { key: 'meta_page_access_token', label: 'Meta Page Access Token' },
            ])}>
            {saving === 'meta_verify_token' ? <Loader2 size={12} className="animate-spin" /> : 'Zapisz'}
          </Button>
          <Button variant="outline" size="sm" disabled={metaTesting} onClick={testMetaToken}>
            {metaTesting ? <><Loader2 size={12} className="animate-spin" /> Testowanie…</> : 'Testuj token'}
          </Button>
          {saved === 'meta_verify_token' && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Zapisano</span>}
          {errors.meta_verify_token && <span className="text-xs text-red-500">{errors.meta_verify_token}</span>}
        </div>
        {metaTest && (
          <p className={`text-xs mt-1 ${metaTest.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {metaTest.text}
          </p>
        )}
      </div>
    </>
  );
}

function SecuritySection() {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword() {
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: 'Hasła się nie zgadzają' }); return; }
    if (newPwd.length < 8) { setPwdMsg({ ok: false, text: 'Hasło musi mieć min. 8 znaków' }); return; }
    setPwdSaving(true);
    setPwdMsg(null);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
    });
    setPwdSaving(false);
    if (res.ok) {
      setPwdMsg({ ok: true, text: 'Hasło zmienione' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } else {
      const d = await res.json();
      setPwdMsg({ ok: false, text: d.error ?? 'Błąd zmiany hasła' });
    }
  }

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">Bezpieczeństwo</h2>

      {/* Change password */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={15} className="text-text-muted" />
          <p className="text-sm font-semibold text-text-primary">Zmiana hasła</p>
        </div>
        <SecretField label="Obecne hasło" value={currentPwd} onChange={setCurrentPwd} />
        <SecretField label="Nowe hasło" value={newPwd} onChange={setNewPwd} />
        <SecretField label="Powtórz nowe hasło" value={confirmPwd} onChange={setConfirmPwd} />
        {pwdMsg && (
          <p className={cn('text-xs px-3 py-2 rounded-lg border', pwdMsg.ok
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : 'text-red-600 bg-red-50 border-red-200')}>
            {pwdMsg.text}
          </p>
        )}
        <Button variant="primary" onClick={changePassword} disabled={pwdSaving || !currentPwd || !newPwd}>
          {pwdSaving ? <><Loader2 size={13} className="animate-spin" /> Zapisywanie...</> : 'Zmień hasło'}
        </Button>
      </div>

      {/* Webhook secrets info */}
      <div className="border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} className="text-text-muted" />
          <p className="text-sm font-semibold text-text-primary">Klucze webhooków</p>
        </div>
        <p className="text-xs text-text-muted">
          Wszystkie klucze i sekrety webhooków konfigurujesz w zakładce{' '}
          <strong className="text-text-secondary">Integracje</strong>.
          Są przechowywane w zaszyfrowanej bazie Supabase i nie są dostępne publicznie.
        </p>
        <div className="mt-2 space-y-1.5">
          {[
            { name: 'Fathom Webhook Secret', key: 'fathom_webhook_secret' },
            { name: 'Leads Webhook Secret', key: 'leads_webhook_secret' },
            { name: 'PhantomBuster API Key', key: 'phantombuster_api_key' },
            { name: 'Anthropic API Key', key: 'anthropic_api_key' },
            { name: 'Gemini API Key', key: 'gemini_api_key' },
          ].map(({ name }) => (
            <div key={name} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{name}</span>
              <span className="text-text-muted font-mono">••••••••</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function EmailSection() {
  const KEYS = ['resend_api_key', 'resend_from_email', 'resend_from_name', 'resend_reply_to', 'resend_webhook_secret', 'campaign_max_per_run'];
  const { data, setData, loading } = useSetting(KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);

  function set(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }

  async function save() {
    setSaving(true);
    const ok = await saveSettings([
      { key: 'resend_api_key',        value: data.resend_api_key        ?? '', is_secret: true, label: 'Resend API Key' },
      { key: 'resend_from_email',     value: data.resend_from_email     ?? '', label: 'Email nadawcy' },
      { key: 'resend_from_name',      value: data.resend_from_name      ?? '', label: 'Nazwa nadawcy' },
      { key: 'resend_reply_to',       value: data.resend_reply_to       ?? '', label: 'Reply-To' },
      { key: 'resend_webhook_secret', value: data.resend_webhook_secret ?? '', is_secret: true, label: 'Resend Webhook Secret' },
      { key: 'campaign_max_per_run',  value: data.campaign_max_per_run  ?? '50', label: 'Maks emaili / uruchomienie' },
    ]);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError('Błąd zapisu');
  }

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm py-8"><Loader2 size={14} className="animate-spin" /> Ładowanie...</div>;

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">Email — Resend</h2>
      <div className="p-3 bg-accent-subtle border border-accent/20 rounded-lg text-xs text-text-secondary">
        Resend służy do wysyłania kampanii emailowych. Klucze możesz też ustawić w zmiennych środowiskowych Vercel — te ustawienia mają priorytet.
      </div>
      <SecretField
        label="Resend API Key"
        description="Klucz API z panelu resend.com → API Keys"
        value={data.resend_api_key ?? ''}
        onChange={v => set('resend_api_key', v)}
      />
      <Input label="Email nadawcy" value={data.resend_from_email ?? ''}
        onChange={e => set('resend_from_email', e.target.value)}
        placeholder="hej@twojafirma.pl" />
      <Input label="Nazwa nadawcy" value={data.resend_from_name ?? ''}
        onChange={e => set('resend_from_name', e.target.value)}
        placeholder="Jan Kowalski / Twoja Firma" />
      <Input label="Reply-To email" value={data.resend_reply_to ?? ''}
        onChange={e => set('resend_reply_to', e.target.value)}
        placeholder="odpowiedzi@twojafirma.pl" />

      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1">Webhook URL</p>
          <p className="text-xs text-text-muted mb-2">Wklej ten adres w Resend → Webhooks → Add Webhook. Zaznacz events: delivered, opened, clicked, bounced.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-bg-subtle border border-border rounded-md px-3 py-2 text-text-primary font-mono truncate">
              {origin}/api/email-campaigns/webhook
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(`${origin}/api/email-campaigns/webhook`)}
              className="p-2 rounded-md border border-border hover:bg-bg-subtle transition-colors text-text-muted hover:text-text-primary">
              <Copy size={13} />
            </button>
          </div>
        </div>
        <SecretField
          label="Resend Webhook Secret"
          description="Signing secret z Resend po dodaniu webhooka (zaczyna się od whsec_)"
          value={data.resend_webhook_secret ?? ''}
          onChange={v => set('resend_webhook_secret', v)}
        />
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1">Kampanie — limity wysyłki</p>
          <p className="text-xs text-text-muted mb-3">Cron uruchamia się co godzinę. Globalny limit kontroluje ile emaili łącznie (we wszystkich kampaniach) wyśle w jednym uruchomieniu.</p>
          <div className="flex items-center gap-3">
            <input
              type="number" min={1} max={1000}
              value={data.campaign_max_per_run ?? '50'}
              onChange={e => set('campaign_max_per_run', e.target.value)}
              className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-sm text-text-muted">emaili / uruchomienie crona (globalnie)</span>
          </div>
        </div>
      </div>

      <SaveRow onSave={save} saving={saving} saved={saved} error={error} />
    </>
  );
}

function NotificationsSection() {
  const KEYS = ['slack_webhook_url', 'slack_channel'];
  const { data, setData, loading } = useSetting(KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }

  async function save() {
    setSaving(true);
    const ok = await saveSettings([
      { key: 'slack_webhook_url', value: data.slack_webhook_url ?? '', is_secret: true, label: 'Slack Webhook URL' },
      { key: 'slack_channel', value: data.slack_channel ?? '', label: 'Kanał Slack' },
    ]);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm py-8"><Loader2 size={14} className="animate-spin" /> Ładowanie...</div>;

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">Powiadomienia — Slack</h2>
      <SecretField
        label="Slack Webhook URL"
        description="URL webhooka z konfiguracji Slack App"
        value={data.slack_webhook_url ?? ''}
        onChange={v => set('slack_webhook_url', v)}
      />
      <Input label="Nazwa kanału" value={data.slack_channel ?? ''}
        onChange={e => set('slack_channel', e.target.value)}
        placeholder="#automationhub-alerts" />
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-secondary">Które zdarzenia powiadamiać:</p>
        {[
          { label: 'Nowe przypisanie zadania', defaultChecked: true },
          { label: 'Zadanie zbliżające się terminu', defaultChecked: true },
          { label: 'Zmiana statusu leada', defaultChecked: true },
          { label: 'Nowy koszt dodany', defaultChecked: false },
        ].map(({ label, defaultChecked }) => (
          <label key={label} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked={defaultChecked} className="accent-indigo-500" />
            <span className="text-sm text-text-primary">{label}</span>
          </label>
        ))}
      </div>
      <SaveRow onSave={save} saving={saving} saved={saved} />
    </>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [section, setSection] = useState('general');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Ustawienia</h1>

      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-0.5">
            {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                  section === id
                    ? 'bg-accent-subtle text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary'
                )}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 bg-bg-base border border-border rounded-xl p-5 space-y-6">
          {section === 'general' && <GeneralSection />}
          {section === 'email' && <EmailSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'ai' && <AISection />}
          {section === 'integrations' && <IntegrationsSection />}
          {section === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}
