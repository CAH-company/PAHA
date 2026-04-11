-- ============================================================
-- AutomationHub — Tabela przychodów
-- Uruchom w Supabase SQL Editor
-- ============================================================

create table public.revenue_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#10b981',
  created_at timestamptz default now()
);

create table public.revenues (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  amount_pln numeric(12,2),
  currency text not null default 'PLN'
    check (currency in ('PLN', 'EUR', 'USD')),
  exchange_rate numeric(10,4) not null default 1,
  category_id uuid references public.revenue_categories(id) on delete set null,
  revenue_date date not null default current_date,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text,
  status text not null default 'paid'
    check (status in ('paid', 'pending', 'overdue')),
  project_name text,
  note text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indeksy
create index idx_revenues_revenue_date on public.revenues(revenue_date desc);
create index idx_revenues_status on public.revenues(status);
create index idx_revenues_category_id on public.revenues(category_id);
create index idx_revenues_client_id on public.revenues(client_id);

-- Updated_at trigger
create trigger trg_revenues_updated_at
  before update on public.revenues
  for each row execute function public.set_updated_at();

-- RLS
alter table public.revenue_categories enable row level security;
alter table public.revenues enable row level security;

create policy "revenue_categories_select" on public.revenue_categories
  for select to authenticated using (true);

create policy "revenue_categories_write_admin" on public.revenue_categories
  for all to authenticated using (public.is_admin_or_partner());

create policy "revenues_select" on public.revenues
  for select to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_accounting = true
    )
  );

create policy "revenues_insert" on public.revenues
  for insert to authenticated
  with check (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_accounting = true
    )
  );

create policy "revenues_update" on public.revenues
  for update to authenticated
  using (public.is_admin_or_partner());

create policy "revenues_delete" on public.revenues
  for delete to authenticated
  using (public.is_admin_or_partner());

-- Domyślne kategorie przychodów
insert into public.revenue_categories (name, color) values
  ('Usługi', '#10b981'),
  ('Prowizja', '#6366f1'),
  ('Produkty', '#3b82f6'),
  ('Subskrypcja', '#8b5cf6'),
  ('Inne', '#94a3b8');
