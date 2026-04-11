'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell, Moon, Sun, Search, LogOut } from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';
import { useUIStore } from '@/store/ui';
import { createClient } from '@/lib/supabase/client';

const BREADCRUMB_MAP: Record<string, string[]> = {
  '/dashboard': ['Dashboard'],
  '/crm/leads': ['CRM', 'Leady'],
  '/crm/clients': ['CRM', 'Klienci'],
  '/crm/archive': ['CRM', 'Archiwum'],
  '/accounting': ['Finanse', 'Księgowość'],
  '/operations': ['Operacje', 'Dokumenty'],
  '/marketing': ['Operacje', 'Marketing'],
  '/tasks': ['Zespół', 'Zadania'],
  '/hr': ['Zespół', 'Pracownicy'],
  '/settings': ['Ustawienia'],
};

function getBreadcrumbs(pathname: string): string[] {
  // exact match
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  // partial match
  for (const key of Object.keys(BREADCRUMB_MAP)) {
    if (pathname.startsWith(key) && key !== '/dashboard') {
      return BREADCRUMB_MAP[key];
    }
  }
  return ['AutomationHub'];
}

export function Topbar() {
  const pathname = usePathname();
  const { sidebarCollapsed, darkMode, toggleDarkMode } = useUIStore();
  const [notifOpen, setNotifOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const breadcrumbs = getBreadcrumbs(pathname);
  const notifications: [] = [];
  const unread = 0;

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 z-20 flex items-center justify-between px-5 border-b border-border bg-bg-base',
        'transition-all duration-200',
        sidebarCollapsed ? 'left-[60px]' : 'left-[220px]'
      )}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-text-muted">/</span>}
            <span className={cn(
              i === breadcrumbs.length - 1
                ? 'text-text-primary font-semibold'
                : 'text-text-muted'
            )}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
          <Search size={16} />
        </button>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors"
          title={darkMode ? 'Tryb jasny' : 'Tryb ciemny'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-bg-base border border-border rounded-xl shadow-xl z-20 overflow-hidden animate-scale-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-text-primary">Powiadomienia</h3>
                  {unread > 0 && (
                    <button className="text-xs text-accent hover:text-accent-hover">
                      Oznacz wszystkie jako przeczytane
                    </button>
                  )}
                </div>
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {notifications.map((notif: any) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'px-4 py-3 hover:bg-bg-subtle cursor-pointer transition-colors',
                        !notif.is_read && 'bg-accent-subtle/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {!notif.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                        )}
                        {notif.is_read && <div className="w-1.5 h-1.5 mt-1.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary leading-relaxed">{notif.title}</p>
                          {notif.body && (
                            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{notif.body}</p>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">{formatTimeAgo(notif.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-md hover:bg-bg-muted text-text-muted hover:text-red-400 transition-colors"
          title="Wyloguj się"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
