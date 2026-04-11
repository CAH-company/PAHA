'use client';

import { type User } from '@supabase/supabase-js';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-bg-subtle">
      <Sidebar />
      <Topbar />
      <main
        className={cn(
          'pt-14 min-h-screen transition-all duration-200',
          sidebarCollapsed ? 'pl-[60px]' : 'pl-[220px]'
        )}
      >
        <div className="p-6 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <AuthProvider initialUser={user}>
      <ShellInner>{children}</ShellInner>
    </AuthProvider>
  );
}
