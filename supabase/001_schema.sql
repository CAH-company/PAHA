-- ============================================================
-- AutomationHub — Pełny schemat bazy danych
-- Uruchom w Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- EMPLOYEES / HR
-- ============================================================

create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  phone text,
  position text,
  role text not null default 'employee'
    check (role in ('admin', 'partner', 'employee')),
  avatar_url text,
  joined_at date default current_date,
  is_active boolean default true,
  -- Uprawnienia modułowe
  access_crm_leads boolean default false,
  access_crm_clients boolean default false,
  access_accounting boolean default false,
  access_marketing boolean default false,
  access_operations boolean default false,
  access_tasks boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.employees is 'Pracownicy firmy z uprawnieniami modułowymi';

-- ============================================================
-- CRM — LEADY
-- ============================================================

create table public.leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  source text not null default 'manual'
    check (source in ('manual', 'csv', 'lemlist', 'clay', 'form')),
  external_id text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'offer_sent', 'negotiation', 'won', 'lost')),
  owner_id uuid references public.employees(id) on delete set null,
  tags text[] default '{}',
  is_archived boolean default false,
  currency text not null default 'PLN'
    check (currency in ('PLN', 'EUR', 'USD')),
  estimated_value numeric(12,2),
  notes text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.lead_activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null
    check (type in ('note', 'call', 'email', 'meeting', 'status_change')),
  content text,
  old_value text,
  new_value text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

create table public.lead_reminders (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  is_done boolean default false,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- CRM — KLIENCI
-- ============================================================

create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete set null,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  nip text,
  regon text,
  contract_number text,
  contract_date date,
  status text not null default 'active'
    check (status in ('active', 'needs_attention', 'closed')),
  total_value numeric(12,2) default 0,
  currency text not null default 'PLN'
    check (currency in ('PLN', 'EUR', 'USD')),
  owner_id uuid references public.employees(id) on delete set null,
  tags text[] default '{}',
  is_archived boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.client_activities (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  type text not null
    check (type in ('note', 'call', 'email', 'meeting', 'status_change', 'document')),
  content text,
  old_value text,
  new_value text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

create table public.client_reminders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  is_done boolean default false,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- KSIĘGOWOŚĆ
-- ============================================================

create table public.cost_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

create table public.costs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  amount_pln numeric(12,2),
  currency text not null default 'PLN'
    check (currency in ('PLN', 'EUR', 'USD')),
  exchange_rate numeric(10,4) not null default 1,
  category_id uuid references public.cost_categories(id) on delete set null,
  cost_date date not null default current_date,
  paid_by uuid references public.employees(id) on delete restrict not null,
  client_id uuid references public.clients(id) on delete set null,
  project_name text,
  attachment_url text,
  note text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOKUMENTY
-- ============================================================

create table public.document_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null
    check (type in ('contract', 'offer', 'protocol', 'brief', 'other')),
  content text not null,
  variables jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type text not null
    check (type in ('contract', 'offer', 'protocol', 'brief', 'other')),
  template_id uuid references public.document_templates(id) on delete set null,
  content text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'archived')),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  drive_file_id text,
  drive_url text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MARKETING
-- ============================================================

create table public.marketing_campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  type text not null
    check (type in ('social', 'email', 'mixed')),
  start_date date,
  end_date date,
  budget numeric(12,2),
  budget_currency text default 'PLN'
    check (budget_currency in ('PLN', 'EUR', 'USD')),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'paused', 'done')),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.social_posts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  platform text not null
    check (platform in ('facebook', 'instagram', 'linkedin', 'twitter')),
  content text,
  image_url text,
  scheduled_at timestamptz,
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'ready', 'published')),
  ai_generated boolean default false,
  ai_prompt text,
  n8n_execution_id text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  subject text not null,
  content text not null,
  provider text not null default 'resend'
    check (provider in ('resend', 'mailchimp', 'brevo')),
  external_id text,
  sent_at timestamptz,
  stats jsonb default '{}'::jsonb,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

create table public.marketing_actions (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  name text not null,
  description text,
  assigned_to uuid references public.employees(id) on delete set null,
  due_date date,
  budget numeric(12,2),
  budget_currency text default 'PLN',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ZADANIA (TASK MANAGER)
-- ============================================================

create table public.task_boards (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Główna tablica',
  created_at timestamptz default now()
);

create table public.task_columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references public.task_boards(id) on delete cascade,
  name text not null,
  color text not null default '#94a3b8',
  position integer not null default 0,
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references public.task_boards(id) on delete cascade,
  column_id uuid references public.task_columns(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date timestamptz,
  position integer not null default 0,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  google_event_id text,
  google_meet_link text,
  google_calendar_synced boolean default false,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  primary key (task_id, employee_id)
);

create table public.task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade,
  content text not null,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

create table public.task_checklists (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade unique,
  items jsonb not null default '[]'::jsonb
);

-- ============================================================
-- EMAIL (wewnętrzny klient)
-- ============================================================

create table public.email_threads (
  id uuid primary key default uuid_generate_v4(),
  subject text not null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  resend_thread_id text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

create table public.emails (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid references public.email_threads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_email text not null,
  to_email text not null,
  subject text,
  content text not null,
  resend_id text,
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'failed')),
  sent_at timestamptz,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- POWIADOMIENIA
-- ============================================================

create table public.notification_settings (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) on delete cascade unique,
  slack_enabled boolean default true,
  whatsapp_enabled boolean default false,
  whatsapp_number text,
  quiet_hours_start time default '22:00',
  quiet_hours_end time default '08:00',
  notify_task_assigned boolean default true,
  notify_task_due boolean default true,
  notify_task_comment boolean default true,
  notify_lead_status_change boolean default true,
  notify_lead_reminder boolean default true,
  notify_cost_added boolean default false,
  updated_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- USTAWIENIA APLIKACJI
-- ============================================================

create table public.app_settings (
  key text primary key,
  value text,
  is_secret boolean default false,
  label text,
  description text,
  updated_by uuid references public.employees(id) on delete set null,
  updated_at timestamptz default now()
);

-- ============================================================
-- INDEKSY
-- ============================================================

create index idx_leads_status on public.leads(status);
create index idx_leads_owner_id on public.leads(owner_id);
create index idx_leads_is_archived on public.leads(is_archived);
create index idx_leads_created_at on public.leads(created_at desc);

create index idx_clients_status on public.clients(status);
create index idx_clients_owner_id on public.clients(owner_id);
create index idx_clients_is_archived on public.clients(is_archived);

create index idx_costs_cost_date on public.costs(cost_date desc);
create index idx_costs_paid_by on public.costs(paid_by);
create index idx_costs_category_id on public.costs(category_id);

create index idx_tasks_column_id on public.tasks(column_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_created_by on public.tasks(created_by);

create index idx_lead_activities_lead_id on public.lead_activities(lead_id);
create index idx_client_activities_client_id on public.client_activities(client_id);
create index idx_task_assignees_employee_id on public.task_assignees(employee_id);

create index idx_notifications_employee_unread on public.notifications(employee_id, is_read, created_at desc);

-- ============================================================
-- UPDATED_AT — automatyczny trigger
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger trg_costs_updated_at
  before update on public.costs
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger trg_campaigns_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.employees enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_reminders enable row level security;
alter table public.clients enable row level security;
alter table public.client_activities enable row level security;
alter table public.client_reminders enable row level security;
alter table public.costs enable row level security;
alter table public.cost_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_boards enable row level security;
alter table public.task_columns enable row level security;
alter table public.documents enable row level security;
alter table public.document_templates enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.social_posts enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.marketing_actions enable row level security;
alter table public.email_threads enable row level security;
alter table public.emails enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_settings enable row level security;
alter table public.app_settings enable row level security;

-- Helper: pobierz employee dla zalogowanego użytkownika
create or replace function public.get_my_employee_id()
returns uuid language sql security definer stable as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin_or_partner()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role in ('admin', 'partner') from public.employees where user_id = auth.uid() limit 1),
    false
  );
$$;

-- EMPLOYEES
create policy "employees_select_all" on public.employees
  for select to authenticated using (true);

create policy "employees_update_own" on public.employees
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_or_partner());

create policy "employees_insert_admin" on public.employees
  for insert to authenticated
  with check (public.is_admin_or_partner());

-- LEADS
create policy "leads_select" on public.leads
  for select to authenticated
  using (
    not is_archived
    and (
      public.is_admin_or_partner()
      or exists (
        select 1 from public.employees e
        where e.user_id = auth.uid()
          and e.access_crm_leads = true
      )
    )
  );

create policy "leads_select_archived" on public.leads
  for select to authenticated
  using (
    is_archived
    and public.is_admin_or_partner()
  );

create policy "leads_insert" on public.leads
  for insert to authenticated
  with check (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_crm_leads = true
    )
  );

create policy "leads_update" on public.leads
  for update to authenticated
  using (
    public.is_admin_or_partner()
    or (owner_id = public.get_my_employee_id() and exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_crm_leads = true
    ))
  );

create policy "leads_delete_admin" on public.leads
  for delete to authenticated
  using (public.is_admin_or_partner());

-- LEAD ACTIVITIES
create policy "lead_activities_select" on public.lead_activities
  for select to authenticated using (true);

create policy "lead_activities_insert" on public.lead_activities
  for insert to authenticated with check (true);

-- LEAD REMINDERS
create policy "lead_reminders_select" on public.lead_reminders
  for select to authenticated using (true);

create policy "lead_reminders_insert" on public.lead_reminders
  for insert to authenticated with check (true);

create policy "lead_reminders_update" on public.lead_reminders
  for update to authenticated using (true);

-- CLIENTS
create policy "clients_select" on public.clients
  for select to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_crm_clients = true
    )
  );

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (public.is_admin_or_partner());

create policy "clients_update" on public.clients
  for update to authenticated
  using (public.is_admin_or_partner());

create policy "clients_delete_admin" on public.clients
  for delete to authenticated
  using (public.get_my_role() = 'admin');

-- CLIENT ACTIVITIES
create policy "client_activities_select" on public.client_activities
  for select to authenticated using (true);

create policy "client_activities_insert" on public.client_activities
  for insert to authenticated with check (true);

-- CLIENT REMINDERS
create policy "client_reminders_select" on public.client_reminders
  for select to authenticated using (true);

create policy "client_reminders_insert" on public.client_reminders
  for insert to authenticated with check (true);

create policy "client_reminders_update" on public.client_reminders
  for update to authenticated using (true);

-- COSTS
create policy "costs_select" on public.costs
  for select to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_accounting = true
    )
    or paid_by = public.get_my_employee_id()
  );

create policy "costs_insert" on public.costs
  for insert to authenticated with check (true);

create policy "costs_update" on public.costs
  for update to authenticated
  using (
    public.is_admin_or_partner()
    or paid_by = public.get_my_employee_id()
  );

create policy "costs_delete_admin" on public.costs
  for delete to authenticated
  using (public.is_admin_or_partner());

-- COST CATEGORIES
create policy "cost_categories_select" on public.cost_categories
  for select to authenticated using (true);

create policy "cost_categories_insert_admin" on public.cost_categories
  for insert to authenticated with check (public.is_admin_or_partner());

create policy "cost_categories_update_admin" on public.cost_categories
  for update to authenticated using (public.is_admin_or_partner());

-- TASKS
create policy "tasks_select" on public.tasks
  for select to authenticated using (true);

create policy "tasks_insert" on public.tasks
  for insert to authenticated with check (true);

create policy "tasks_update" on public.tasks
  for update to authenticated using (true);

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (created_by = public.get_my_employee_id() or public.is_admin_or_partner());

-- TASK ASSIGNEES
create policy "task_assignees_select" on public.task_assignees
  for select to authenticated using (true);

create policy "task_assignees_insert" on public.task_assignees
  for insert to authenticated with check (true);

create policy "task_assignees_delete" on public.task_assignees
  for delete to authenticated using (true);

-- TASK COMMENTS
create policy "task_comments_select" on public.task_comments
  for select to authenticated using (true);

create policy "task_comments_insert" on public.task_comments
  for insert to authenticated with check (true);

-- TASK CHECKLISTS
create policy "task_checklists_select" on public.task_checklists
  for select to authenticated using (true);

create policy "task_checklists_upsert" on public.task_checklists
  for all to authenticated using (true) with check (true);

-- TASK BOARDS & COLUMNS
create policy "task_boards_select" on public.task_boards
  for select to authenticated using (true);

create policy "task_boards_all_admin" on public.task_boards
  for all to authenticated using (public.is_admin_or_partner());

create policy "task_columns_select" on public.task_columns
  for select to authenticated using (true);

create policy "task_columns_all_admin" on public.task_columns
  for all to authenticated using (public.is_admin_or_partner());

-- DOCUMENTS & TEMPLATES
create policy "documents_select" on public.documents
  for select to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_operations = true
    )
  );

create policy "documents_insert" on public.documents
  for insert to authenticated
  with check (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_operations = true
    )
  );

create policy "documents_update" on public.documents
  for update to authenticated
  using (
    public.is_admin_or_partner()
    or created_by = public.get_my_employee_id()
  );

create policy "document_templates_select" on public.document_templates
  for select to authenticated using (true);

create policy "document_templates_write_admin" on public.document_templates
  for all to authenticated using (public.is_admin_or_partner());

-- MARKETING
create policy "campaigns_select" on public.marketing_campaigns
  for select to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_marketing = true
    )
  );

create policy "campaigns_write" on public.marketing_campaigns
  for all to authenticated
  using (
    public.is_admin_or_partner()
    or exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.access_marketing = true
    )
  );

create policy "social_posts_select" on public.social_posts
  for select to authenticated using (true);

create policy "social_posts_write" on public.social_posts
  for all to authenticated using (true) with check (true);

create policy "email_campaigns_select" on public.email_campaigns
  for select to authenticated using (true);

create policy "email_campaigns_write" on public.email_campaigns
  for all to authenticated using (true) with check (true);

create policy "marketing_actions_select" on public.marketing_actions
  for select to authenticated using (true);

create policy "marketing_actions_write" on public.marketing_actions
  for all to authenticated using (true) with check (true);

-- EMAIL THREADS & EMAILS
create policy "email_threads_select" on public.email_threads
  for select to authenticated using (true);

create policy "email_threads_insert" on public.email_threads
  for insert to authenticated with check (true);

create policy "emails_select" on public.emails
  for select to authenticated using (true);

create policy "emails_insert" on public.emails
  for insert to authenticated with check (true);

-- NOTIFICATIONS
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (employee_id = public.get_my_employee_id());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (employee_id = public.get_my_employee_id());

create policy "notifications_insert_service" on public.notifications
  for insert to authenticated with check (true);

create policy "notification_settings_select_own" on public.notification_settings
  for select to authenticated
  using (employee_id = public.get_my_employee_id());

create policy "notification_settings_upsert_own" on public.notification_settings
  for all to authenticated
  using (employee_id = public.get_my_employee_id())
  with check (employee_id = public.get_my_employee_id());

-- APP SETTINGS
create policy "app_settings_select_admin" on public.app_settings
  for select to authenticated
  using (public.is_admin_or_partner());

create policy "app_settings_update_admin" on public.app_settings
  for all to authenticated
  using (public.get_my_role() = 'admin');
