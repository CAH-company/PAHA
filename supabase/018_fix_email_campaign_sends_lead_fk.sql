-- Naprawa: email_campaign_sends.lead_id blokował usuwanie leadów
-- (brak ON DELETE CASCADE, w odróżnieniu od email_campaign_recipients.lead_id,
-- która już ma CASCADE — to był brakujący przypadek).
-- Po tej migracji usunięcie leada usuwa też jego logi wysyłek kampanii.

alter table public.email_campaign_sends
  drop constraint if exists email_campaign_sends_lead_id_fkey;

alter table public.email_campaign_sends
  add constraint email_campaign_sends_lead_id_fkey
    foreign key (lead_id) references public.leads(id) on delete cascade;
