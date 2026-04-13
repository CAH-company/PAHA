'use client';

import { useState } from 'react';
import { Plus, Mail, Phone, Send } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ROLE_LABELS, formatDate } from '@/lib/utils';

const ROLE_COLORS: Record<string, string> = {
  admin: '#6366f1',
  partner: '#8b5cf6',
  employee: '#3b82f6',
};

const MODULE_PERMISSIONS = [
  { key: 'access_crm_leads', label: 'CRM — Leady' },
  { key: 'access_crm_clients', label: 'CRM — Klienci' },
  { key: 'access_accounting', label: 'Księgowość' },
  { key: 'access_marketing', label: 'Marketing' },
  { key: 'access_operations', label: 'Operacje / Dokumenty' },
];

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Pracownik' },
  { value: 'partner', label: 'Partner' },
  { value: 'admin', label: 'Admin' },
];

type PermissionsState = {
  role: 'admin' | 'partner' | 'employee';
  access_crm_leads: boolean;
  access_crm_clients: boolean;
  access_accounting: boolean;
  access_marketing: boolean;
  access_operations: boolean;
  is_active: boolean;
};

export default function HRPage() {
  const { employees, loading, refetch } = useEmployees();
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermissionsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'employee', position: '' });
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [inviteError, setInviteError] = useState('');

  async function handleInvite() {
    setInviteStatus('loading');
    setInviteError('');
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? 'Wystąpił błąd');
        setInviteStatus('error');
        return;
      }
      setInviteStatus('success');
    } catch {
      setInviteError('Błąd połączenia z serwerem');
      setInviteStatus('error');
    }
  }

  function openEdit(empId: string) {
    const emp = employees.find(e => e.id === empId)!;
    setPerms({
      role: emp.role as 'admin' | 'partner' | 'employee',
      access_crm_leads: emp.access_crm_leads,
      access_crm_clients: emp.access_crm_clients,
      access_accounting: emp.access_accounting,
      access_marketing: emp.access_marketing,
      access_operations: emp.access_operations,
      is_active: emp.is_active,
    });
    setEditingEmployee(empId);
  }

  async function savePerms() {
    if (!editingEmployee || !perms) return;
    setSaving(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('employees').update(perms).eq('id', editingEmployee);
    setSaving(false);
    setEditingEmployee(null);
    refetch();
  }

  async function deactivate() {
    if (!editingEmployee) return;
    setSaving(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('employees').update({ is_active: false }).eq('id', editingEmployee);
    setSaving(false);
    setEditingEmployee(null);
    refetch();
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteForm({ name: '', email: '', role: 'employee', position: '' });
    setInviteStatus('idle');
    setInviteError('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Pracownicy</h1>
        <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
          <Plus size={14} />
          Zaproś pracownika
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-bg-base border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={emp.name} size="lg" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{emp.name}</h3>
                  <p className="text-xs text-text-muted">{emp.position ?? '—'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge color={ROLE_COLORS[emp.role]}>{ROLE_LABELS[emp.role]}</Badge>
                <Badge color={emp.is_active ? '#10b981' : '#94a3b8'}>
                  {emp.is_active ? 'Aktywny' : 'Nieaktywny'}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Mail size={11} className="text-text-muted" />
                {emp.email}
              </div>
              {emp.phone && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Phone size={11} className="text-text-muted" />
                  {emp.phone}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">od {formatDate(emp.joined_at)}</span>
              <Button variant="outline" size="sm" onClick={() => openEdit(emp.id)}>
                Edytuj uprawnienia
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={closeInvite} title="Zaproś pracownika">
        {inviteStatus === 'success' ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Send size={20} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-text-primary">Zaproszenie wysłane!</p>
            <p className="text-xs text-text-muted">
              Link aktywacyjny został wysłany na <span className="font-medium text-text-primary">{inviteForm.email}</span>.<br />
              Pracownik ustawi własne hasło po kliknięciu w link.
            </p>
            <Button variant="primary" size="sm" onClick={closeInvite}>Gotowe</Button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <Input
                label="Imię i nazwisko"
                placeholder="Jan Kowalski"
                value={inviteForm.name}
                onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Email"
                placeholder="jan@firma.pl"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Stanowisko (opcjonalnie)"
                placeholder="np. Specjalista ds. sprzedaży"
                value={inviteForm.position}
                onChange={e => setInviteForm(f => ({ ...f, position: e.target.value }))}
              />
              <Select
                label="Rola"
                value={inviteForm.role}
                options={ROLE_OPTIONS}
                onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
              />
              {inviteStatus === 'error' && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {inviteError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-subtle">
              <Button variant="ghost" onClick={closeInvite}>Anuluj</Button>
              <Button
                variant="primary"
                onClick={handleInvite}
                disabled={!inviteForm.name || !inviteForm.email || inviteStatus === 'loading'}
              >
                {inviteStatus === 'loading' ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Edit permissions modal */}
      {editingEmployee && perms && (() => {
        const emp = employees.find(e => e.id === editingEmployee)!;
        return (
          <Modal open={true} onClose={() => setEditingEmployee(null)} title={`Uprawnienia — ${emp.name}`}>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-bg-subtle rounded-lg">
                <p className="text-xs text-text-muted mb-2">Rola systemowa</p>
                <div className="flex gap-2">
                  {(['employee', 'partner', 'admin'] as const).map(role => (
                    <button key={role}
                      onClick={() => setPerms(p => p ? { ...p, role } : p)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        perms.role === role
                          ? 'border-accent bg-accent text-white'
                          : 'border-border text-text-secondary hover:border-border-strong'
                      }`}>
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Dostęp do modułów</p>
                <div className="space-y-2.5">
                  {MODULE_PERMISSIONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-text-primary">{label}</span>
                      <div
                        onClick={() => setPerms(p => p ? { ...p, [key]: !p[key as keyof PermissionsState] } : p)}
                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                          perms[key as keyof PermissionsState] ? 'bg-accent' : 'bg-bg-muted'
                        }`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          perms[key as keyof PermissionsState] ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </label>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Zadania</span>
                    <span className="text-xs text-emerald-500 font-medium">Zawsze włączone ✓</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between px-5 py-4 border-t border-border bg-bg-subtle">
              <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={deactivate} disabled={saving}>
                Dezaktywuj konto
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingEmployee(null)}>Anuluj</Button>
                <Button variant="primary" onClick={savePerms} disabled={saving}>
                  {saving ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
