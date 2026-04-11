-- ============================================================
-- AutomationHub — Tabela powiadomień
-- Uruchom w Supabase SQL Editor
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_employee_id on public.notifications(employee_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.user_id = auth.uid()
    )
  );

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.user_id = auth.uid()
    )
  );

create policy "notifications_insert_admin" on public.notifications
  for insert to authenticated
  with check (public.is_admin_or_partner());

create policy "notifications_delete_admin" on public.notifications
  for delete to authenticated
  using (public.is_admin_or_partner());
