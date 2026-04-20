-- ============================================================
-- AutomationHub — Transkrypcje spotkań (Fathom webhook)
-- ============================================================

create table public.meeting_transcripts (
  id uuid primary key default uuid_generate_v4(),
  fathom_id text unique,
  title text,
  meeting_date timestamptz,
  duration_minutes integer,
  participants jsonb not null default '[]',
  raw_transcript text,
  raw_payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  error_message text,
  extracted_tasks jsonb,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_meetings_status on public.meeting_transcripts(status);
create index idx_meetings_created_at on public.meeting_transcripts(created_at desc);

alter table public.meeting_transcripts enable row level security;
create policy "meetings_all" on public.meeting_transcripts for all using (true) with check (true);

-- Akceptacja tasków przez przypisanego pracownika
alter table public.task_assignees
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists meeting_id uuid references public.meeting_transcripts(id) on delete set null;
