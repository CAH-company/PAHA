import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Notification } from '@/types';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!emp) { setLoading(false); return; }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const notifs = (data ?? []) as Notification[];
    setNotifications(notifs);
    setUnread(notifs.filter((n) => !n.is_read).length);
    setLoading(false);
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!emp) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('employee_id', emp.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return { notifications, unread, loading, refetch: fetchNotifications, markAllRead };
}
