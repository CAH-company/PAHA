-- ============================================================
-- BAZA WIEDZY (Obsidian sync)
-- ============================================================

create table public.knowledge_base (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,          -- ścieżka pliku np. "oferta/main" lub "procesy/onboarding"
  title text not null,                -- nazwa pliku bez .md
  content text not null,              -- treść markdown
  folder text,                        -- folder w vaulcie np. "oferta", "procesy"
  word_count integer generated always as (array_length(string_to_array(trim(content), ' '), 1)) stored,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

comment on table public.knowledge_base is 'Notatki z Obsidian vaultu — syncowane przez skrypt na VPS';

-- RLS
alter table public.knowledge_base enable row level security;

create policy "knowledge_base_select" on public.knowledge_base
  for select to authenticated using (true);

create policy "knowledge_base_write_admin" on public.knowledge_base
  for all to authenticated using (public.is_admin_or_partner());

-- Indeks full-text search (polski)
create index idx_knowledge_base_fts on public.knowledge_base
  using gin(to_tsvector('simple', title || ' ' || content));

create index idx_knowledge_base_folder on public.knowledge_base(folder);
