-- ============================================================
-- AutomationHub — Seed data (dane startowe)
-- Uruchom PO 001_schema.sql
-- ============================================================

-- ============================================================
-- Kategorie kosztów (domyślne)
-- ============================================================

insert into public.cost_categories (name, color) values
  ('Marketing',       '#8b5cf6'),
  ('Wynajem',         '#6366f1'),
  ('Oprogramowanie',  '#3b82f6'),
  ('Transport',       '#10b981'),
  ('Wynagrodzenia',   '#f59e0b'),
  ('Sprzęt',          '#ef4444'),
  ('Inne',            '#94a3b8');

-- ============================================================
-- Tablica zadań i kolumny domyślne
-- ============================================================

insert into public.task_boards (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Główna tablica');

insert into public.task_columns (board_id, name, color, position) values
  ('00000000-0000-0000-0000-000000000001', 'Do zrobienia',    '#94a3b8', 0),
  ('00000000-0000-0000-0000-000000000001', 'W toku',          '#3b82f6', 1),
  ('00000000-0000-0000-0000-000000000001', 'Do sprawdzenia',  '#f59e0b', 2),
  ('00000000-0000-0000-0000-000000000001', 'Zrobione',        '#10b981', 3);

-- ============================================================
-- Ustawienia aplikacji (domyślne klucze)
-- ============================================================

insert into public.app_settings (key, label, description, is_secret) values
  ('resend_api_key',                'Resend API Key',            'Klucz API do wysyłania emaili',                 true),
  ('resend_from_email',             'Email nadawcy',             'np. hej@twojafirma.pl',                        false),
  ('resend_from_name',              'Nazwa nadawcy',             'np. AutomationHub / Twoja Firma',              false),
  ('resend_reply_to',               'Reply-To email',            'Email do odpowiedzi od klientów',              false),
  ('slack_webhook_url',             'Slack Webhook URL',         'URL webhooka z ustawień Slack App',            true),
  ('slack_channel_name',            'Nazwa kanału Slack',        'np. #automationhub-alerts',                    false),
  ('slack_notify_task_assigned',    'Slack: nowe zadanie',       'Powiadom o przypisaniu zadania',               false),
  ('slack_notify_cost_added',       'Slack: nowy koszt',         'Powiadom admina o nowym koszcie',              false),
  ('anthropic_api_key',             'Anthropic API Key',         'Klucz do Claude API (agent marketingowy)',     true),
  ('google_drive_default_folder_id','Domyślny folder Drive',     'ID folderu na firmowym Drive (opcjonalnie)',   false),
  ('n8n_base_url',                  'n8n Base URL',              'np. https://n8n.twojafirma.pl',                false),
  ('n8n_api_key',                   'n8n API Key',               'Klucz API do n8n',                            true),
  ('app_name',                      'Nazwa aplikacji',           'Wyświetlana w headerze i emailach',            false),
  ('app_timezone',                  'Strefa czasowa',            'np. Europe/Warsaw',                            false),
  ('default_currency',              'Domyślna waluta',           'PLN | EUR | USD',                             false);

update public.app_settings set value = 'AutomationHub' where key = 'app_name';
update public.app_settings set value = 'Europe/Warsaw' where key = 'app_timezone';
update public.app_settings set value = 'PLN' where key = 'default_currency';

-- ============================================================
-- Szablony dokumentów
-- ============================================================

insert into public.document_templates (name, type, content, variables) values
  ('Umowa o współpracy', 'contract',
   '<h1>Umowa o współpracy</h1><p>Zawarta dnia {{contract_date}} pomiędzy:</p><p><strong>{{company_name}}</strong></p><p>a</p><p><strong>{{client_name}}</strong>, {{client_address}}, NIP: {{client_nip}}</p><h2>§1 Przedmiot umowy</h2><p>{{service_description}}</p><h2>§2 Wynagrodzenie</h2><p>Strony ustalają wynagrodzenie w wysokości {{price}} zł netto.</p>',
   '[{"key":"contract_date","label":"Data umowy"},{"key":"company_name","label":"Nazwa firmy"},{"key":"client_name","label":"Nazwa klienta"},{"key":"client_address","label":"Adres klienta"},{"key":"client_nip","label":"NIP klienta"},{"key":"service_description","label":"Opis usługi"},{"key":"price","label":"Cena netto"}]'::jsonb),
  ('Oferta handlowa', 'offer',
   '<h1>Oferta handlowa</h1><p>Data: {{offer_date}}</p><p>Dla: <strong>{{client_name}}</strong></p><h2>Zakres usług</h2><p>{{service_scope}}</p><h2>Wycena</h2><p>{{pricing_table}}</p><p>Oferta ważna do: {{valid_until}}</p>',
   '[{"key":"offer_date","label":"Data oferty"},{"key":"client_name","label":"Nazwa klienta"},{"key":"service_scope","label":"Zakres usług"},{"key":"pricing_table","label":"Tabela cenowa"},{"key":"valid_until","label":"Ważna do"}]'::jsonb),
  ('Protokół odbioru', 'protocol',
   '<h1>Protokół odbioru</h1><p>Data: {{protocol_date}}</p><p>Projekt: {{project_name}}</p><p>Klient: {{client_name}}</p><h2>Zakres prac</h2><p>{{work_scope}}</p><h2>Uwagi</h2><p>{{notes}}</p>',
   '[{"key":"protocol_date","label":"Data protokołu"},{"key":"project_name","label":"Nazwa projektu"},{"key":"client_name","label":"Nazwa klienta"},{"key":"work_scope","label":"Zakres prac"},{"key":"notes","label":"Uwagi"}]'::jsonb),
  ('Brief projektu', 'brief',
   '<h1>Brief projektu</h1><p>Klient: {{client_name}}</p><p>Data: {{brief_date}}</p><h2>Cel projektu</h2><p>{{project_goal}}</p><h2>Grupa docelowa</h2><p>{{target_audience}}</p><h2>Zakres</h2><p>{{scope}}</p><h2>Budżet</h2><p>{{budget}}</p>',
   '[{"key":"client_name","label":"Nazwa klienta"},{"key":"brief_date","label":"Data briefu"},{"key":"project_goal","label":"Cel projektu"},{"key":"target_audience","label":"Grupa docelowa"},{"key":"scope","label":"Zakres"},{"key":"budget","label":"Budżet"}]'::jsonb);
