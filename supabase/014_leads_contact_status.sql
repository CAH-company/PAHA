-- contact_status na leadach (używane w CRM do śledzenia sekwencji mailowych)
alter table public.leads
  add column if not exists contact_status text not null default 'not_contacted'
    check (contact_status in ('not_contacted', 'in_sequence', 'replied', 'bounced', 'unsubscribed', 'meeting_booked'));
