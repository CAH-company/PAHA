'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Zap, Mail, Bell, Link2, Shield, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const SIDEBAR_ITEMS = [
  { id: 'general', label: 'Ogólne', icon: Settings },
  { id: 'email', label: 'Email (Resend)', icon: Mail },
  { id: 'notifications', label: 'Powiadomienia', icon: Bell },
  { id: 'ai', label: 'AI Agent', icon: Zap },
  { id: 'integrations', label: 'Integracje', icon: Link2 },
  { id: 'security', label: 'Bezpieczeństwo', icon: Shield },
];

function SecretInput({ label, description }: { label: string; description?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      {description && <p className="text-xs text-text-muted">{description}</p>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={show ? 'text' : 'password'} placeholder="••••••••••••••••••••"
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 pr-10" />
          <button onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <Button variant="primary" size="md">Zapisz</Button>
      </div>
    </div>
  );
}

function AISection() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['anthropic_api_key', 'anthropic_model'])
      .then(({ data }) => {
        if (!data) return;
        const key = data.find(r => r.key === 'anthropic_api_key')?.value ?? '';
        const mdl = data.find(r => r.key === 'anthropic_model')?.value ?? 'claude-sonnet-4-6';
        setApiKey(key);
        setModel(mdl);
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('app_settings').upsert([
      { key: 'anthropic_api_key', value: apiKey, is_secret: true, label: 'Anthropic API Key' },
      { key: 'anthropic_model', value: model, is_secret: false, label: 'Model Claude' },
    ], { onConflict: 'key' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-text-muted text-sm py-8">
      <Loader2 size={14} className="animate-spin" /> Ładowanie...
    </div>
  );

  return (
    <>
      <h2 className="text-base font-semibold text-text-primary">AI Agent — Anthropic</h2>
      <div className="p-3 bg-accent-subtle border border-accent/20 rounded-lg text-xs text-text-secondary">
        Klucz API jest przechowywany w bazie danych projektu (Supabase). Nie jest widoczny publicznie.
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-text-secondary">Anthropic API Key</label>
        <p className="text-xs text-text-muted">Klucz z console.anthropic.com</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 pr-10"
            />
            <button onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>
      <Select
        label="Model"
        value={model}
        options={[
          { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (zalecany)' },
          { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (najlepszy, wolniejszy)' },
          { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (najszybszy, tańszy)' },
        ]}
        onChange={e => setModel(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={saving || !apiKey}>
          {saving ? <><Loader2 size={13} className="animate-spin" /> Zapisywanie...</> : 'Zapisz'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <Check size={13} /> Zapisano
          </span>
        )}
      </div>
    </>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState('general');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Ustawienia</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
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

        {/* Content */}
        <div className="flex-1 bg-bg-base border border-border rounded-xl p-5 space-y-6">
          {section === 'general' && (
            <>
              <h2 className="text-base font-semibold text-text-primary">Ogólne</h2>
              <Input label="Nazwa aplikacji" defaultValue="AutomationHub" />
              <Select label="Strefa czasowa" defaultValue="Europe/Warsaw"
                options={[{ value: 'Europe/Warsaw', label: 'Europe/Warsaw (UTC+1/+2)' }]} />
              <Select label="Domyślna waluta" defaultValue="PLN"
                options={[{ value: 'PLN', label: 'PLN — Złoty polski' }, { value: 'EUR', label: 'EUR — Euro' }, { value: 'USD', label: 'USD — Dolar' }]} />
              <Select label="Motyw domyślny" defaultValue="light"
                options={[{ value: 'light', label: 'Jasny' }, { value: 'dark', label: 'Ciemny' }, { value: 'system', label: 'Systemowy' }]} />
              <Button variant="primary">Zapisz ustawienia</Button>
            </>
          )}

          {section === 'email' && (
            <>
              <h2 className="text-base font-semibold text-text-primary">Email — Resend</h2>
              <div className="p-3 bg-accent-subtle border border-accent/20 rounded-lg text-xs text-text-secondary">
                ℹ️ Resend służy do wysyłania emaili bezpośrednio z aplikacji do klientów i powiadomień systemowych.
              </div>
              <SecretInput label="Resend API Key" description="Klucz API z panelu Resend" />
              <Input label="Email nadawcy" placeholder="hej@twojafirma.pl" />
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Check size={14} className="text-emerald-500" />
                <span className="text-xs text-emerald-700">Domena zweryfikowana</span>
              </div>
              <Input label="Nazwa nadawcy" placeholder="Jan Kowalski / Twoja Firma" />
              <Input label="Reply-To email" placeholder="odpowiedzi@twojafirma.pl" />
              <Button variant="outline" size="sm">Wyślij testowy email</Button>
            </>
          )}

          {section === 'ai' && <AISection />}

          {section === 'notifications' && (
            <>
              <h2 className="text-base font-semibold text-text-primary">Powiadomienia — Slack</h2>
              <SecretInput label="Slack Webhook URL" description="URL webhooka z konfiguracji Slack App" />
              <Input label="Nazwa kanału" placeholder="#automationhub-alerts" />
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
              <Button variant="primary">Zapisz</Button>
            </>
          )}

          {(section === 'integrations' || section === 'security') && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
                {section === 'integrations' ? <Link2 size={20} className="text-text-muted" /> : <Shield size={20} className="text-text-muted" />}
              </div>
              <p className="text-sm font-medium text-text-primary">Wkrótce dostępne</p>
              <p className="text-xs text-text-muted mt-1">Ta sekcja jest w przygotowaniu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
