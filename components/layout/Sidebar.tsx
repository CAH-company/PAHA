'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard,
  Users,
  Handshake,
  Archive,
  DollarSign,
  ReceiptText,
  BarChart2,
  Megaphone,
  CheckSquare,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  BotMessageSquare,
  Mail,
  Video,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { href: '/crm/leads', icon: Users, label: 'Leady' },
      { href: '/crm/clients', icon: Handshake, label: 'Klienci' },
      { href: '/crm/archive', icon: Archive, label: 'Archiwum' },
    ],
  },
  {
    title: 'Finanse',
    items: [
      { href: '/accounting', icon: DollarSign, label: 'Księgowość' },
      { href: '/quotes', icon: ReceiptText, label: 'Oferty' },
    ],
  },
  {
    title: 'Operacje',
    items: [
      { href: '/operations/agent', icon: BotMessageSquare, label: 'Agent AI' },
      { href: '/operations/meetings', icon: Video, label: 'Spotkania' },
      { href: '/operations/mail', icon: Mail, label: 'Mail' },
      { href: '/operations/meta-ads', icon: BarChart2, label: 'Meta Ads' },
      { href: '/marketing', icon: Megaphone, label: 'Email Outreach' },
    ],
  },
  {
    title: 'Zespół',
    items: [
      { href: '/tasks', icon: CheckSquare, label: 'Zadania' },
      { href: '/hr', icon: UserCog, label: 'Pracownicy' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Użytkownik';
  const displayPosition = user?.user_metadata?.position ?? user?.email ?? '';

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/operations/meta-ads') return pathname.startsWith('/operations/meta-ads');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-30 flex flex-col transition-all duration-200 ease-in-out',
        'border-r border-white/5',
        sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{ backgroundColor: 'var(--sidebar-bg)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 px-4 border-b border-white/5 flex-shrink-0',
        sidebarCollapsed ? 'justify-center' : 'gap-2.5'
      )}>
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="text-white font-semibold text-sm tracking-tight">
            AutomationHub
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.title && !sidebarCollapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--sidebar-section)' }}>
                {section.title}
              </p>
            )}
            {section.title && sidebarCollapsed && (
              <div className="h-px bg-white/5 my-2 mx-1" />
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg transition-colors duration-100 group',
                    sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
                    active
                      ? 'text-white'
                      : 'hover:text-white',
                  )}
                  style={{
                    backgroundColor: active ? 'var(--sidebar-item-active)' : 'transparent',
                    color: active ? '#fff' : 'var(--sidebar-text)',
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    size={16}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      active ? 'text-accent' : 'group-hover:text-white/80'
                    )}
                  />
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium leading-none">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: user + settings + toggle */}
      <div className="flex-shrink-0 border-t border-white/5 p-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex items-center rounded-lg transition-colors duration-100 group hover:text-white',
            sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
          )}
          style={{ color: 'var(--sidebar-text)' }}
          title={sidebarCollapsed ? 'Ustawienia' : undefined}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Ustawienia</span>}
        </Link>

        <div className={cn(
          'flex items-center rounded-lg py-2',
          sidebarCollapsed ? 'justify-center px-2' : 'px-3 gap-3'
        )}>
          <Avatar name={displayName} size="sm" className="flex-shrink-0 ring-2 ring-white/10" />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{displayName}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-text)' }}>
                {displayPosition}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--sidebar-text)' }}
          title={sidebarCollapsed ? 'Rozwiń' : 'Zwiń'}
        >
          {sidebarCollapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />
          }
        </button>
      </div>
    </aside>
  );
}
