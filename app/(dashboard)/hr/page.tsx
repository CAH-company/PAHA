'use client';

import { useState } from 'react';
import { Plus, Mail, Phone } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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

export default function HRPage() {
  const { employees, loading } = useEmployees();
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);

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
        <Button variant="primary" size="sm">
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
              <Button variant="outline" size="sm" onClick={() => setEditingEmployee(emp.id)}>
                Edytuj uprawnienia
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit permissions modal */}
      {editingEmployee && (() => {
        const emp = employees.find(e => e.id === editingEmployee)!;
        return (
          <Modal open={true} onClose={() => setEditingEmployee(null)} title={`Uprawnienia — ${emp.name}`}>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-bg-subtle rounded-lg">
                <p className="text-xs text-text-muted mb-2">Rola systemowa</p>
                <div className="flex gap-2">
                  {(['employee', 'partner', 'admin'] as const).map(role => (
                    <button key={role}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        emp.role === role
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
                      <div className={`relative w-9 h-5 rounded-full transition-colors ${
                        emp[key as keyof typeof emp] ? 'bg-accent' : 'bg-bg-muted'
                      }`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          emp[key as keyof typeof emp] ? 'translate-x-4' : 'translate-x-0.5'
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
              <Button variant="ghost" className="text-red-500 hover:text-red-600">Dezaktywuj konto</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingEmployee(null)}>Anuluj</Button>
                <Button variant="primary">Zapisz</Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
