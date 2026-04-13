# Konfiguracja Obsidian Sync na VPS (Debian)

## Co to robi
Skrypt `sync-obsidian.sh` co 15 minut:
1. Robi `git pull` z repo `CAH-company/knowledge-base`
2. Czyta każdy plik `.md` z vaultu
3. Wrzuca/aktualizuje go do tabeli `knowledge_base` w Supabase
4. Agent przy każdej rozmowie ładuje całą tabelę do system promptu

---

## Krok 1 — Supabase: uruchom migrację

Wejdź na supabase.com → twój projekt → **SQL Editor** → wklej i uruchom:

```
supabase/009_knowledge_base.sql
```

---

## Krok 2 — VPS: sklonuj aplikację i vault

```bash
# Sklonuj aplikację (jeśli jeszcze nie ma)
git clone https://github.com/CAH-company/PAHA.git /opt/paha

# Sklonuj vault Obsidiana
git clone https://github.com/CAH-company/knowledge-base.git /opt/obsidian-vault

# Nadaj uprawnienia do skryptu
chmod +x /opt/paha/scripts/sync-obsidian.sh
```

---

## Krok 3 — VPS: zainstaluj zależności skryptu

```bash
apt-get update
apt-get install -y git curl jq
```

---

## Krok 4 — VPS: przetestuj skrypt ręcznie

```bash
export SUPABASE_URL="https://TWOJ_PROJEKT.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."   # service_role key z Supabase → Settings → API

VAULT_DIR=/opt/obsidian-vault \
SUPABASE_URL=$SUPABASE_URL \
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
/opt/paha/scripts/sync-obsidian.sh
```

Sprawdź logi — powinno pokazać `✓ nazwa-pliku` dla każdej notatki.
Zweryfikuj w Supabase → Table Editor → `knowledge_base` czy są rekordy.

---

## Krok 5 — VPS: ustaw zmienne środowiskowe na stałe

Utwórz plik z konfiguracją:

```bash
nano /etc/sync-obsidian.env
```

Wklej:
```
VAULT_DIR=/opt/obsidian-vault
SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

Zabezpiecz plik:
```bash
chmod 600 /etc/sync-obsidian.env
```

---

## Krok 6 — VPS: ustaw cron co 15 minut

```bash
crontab -e
```

Dodaj linię:
```
*/15 * * * * source /etc/sync-obsidian.env && /opt/paha/scripts/sync-obsidian.sh >> /var/log/sync-obsidian.log 2>&1
```

---

## Krok 7 — Obsidian: plugin Git (na twoim komputerze)

Plugin Git jest już zainstalowany i repo podpięte.
Upewnij się że w ustawieniach pluginu masz:
- `Vault backup interval` → `15` minut
- `Auto backup after file change` → włączone

Od teraz flow wygląda tak:
```
Piszesz notatkę w Obsidianie
    ↓ (co 15 min, plugin Git)
GitHub: CAH-company/knowledge-base
    ↓ (co 15 min, cron na VPS)
Supabase: tabela knowledge_base
    ↓ (przy każdej rozmowie)
Agent ma aktualną wiedzę o firmie
```

---

## Diagnostyka

### Sprawdź logi synca:
```bash
tail -f /var/log/sync-obsidian.log
```

### Sprawdź czy vault jest aktualny:
```bash
cd /opt/obsidian-vault && git log --oneline -5
```

### Sprawdź zawartość bazy wiedzy w Supabase:
```sql
select title, folder, word_count, synced_at from knowledge_base order by synced_at desc;
```

### Wymuś ręczny sync:
```bash
source /etc/sync-obsidian.env && /opt/paha/scripts/sync-obsidian.sh
```
