-- Email accounts for the Mail module
create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text not null,
  imap_host text not null,
  imap_port int not null default 993,
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port int not null default 587,
  smtp_secure boolean not null default false,
  username text not null,
  password text not null,
  created_at timestamptz default now()
);

alter table public.email_accounts enable row level security;

create policy "users_own_accounts" on public.email_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
