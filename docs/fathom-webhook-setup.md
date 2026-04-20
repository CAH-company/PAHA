# Integracja Fathom → AutomationHub

Po skończonym spotkaniu Fathom automatycznie wysyła transkrypcję do aplikacji. Claude Haiku analizuje ją i wyciąga taski, które możesz zaakceptować w panelu Operacje → Spotkania.

---

## Krok 1 — Zmienna środowiskowa na Vercelu

1. Wejdź na [vercel.com](https://vercel.com) → Twój projekt → **Settings** → **Environment Variables**
2. Dodaj nową zmienną:
   - **Name:** `FATHOM_WEBHOOK_SECRET`
   - **Value:** sekret skopiowany z Fathoma (zaczyna się od `whsec_...`)
3. Kliknij **Save**, następnie **Deployments** → **Redeploy** (żeby zmienna weszła w życie)

---

## Krok 2 — Webhook w Fathomie

1. Zaloguj się na [fathom.video](https://fathom.video) → **Settings** → **Integrations** (lub **Webhooks**)
2. Dodaj nowy webhook:
   - **URL:** `https://TWOJA-DOMENA.vercel.app/api/webhooks/fathom`
   - **Event:** `Meeting completed` / `Transcript ready` (cokolwiek dostępne)
3. Skopiuj wygenerowany sekret (`whsec_...`) i wklej go w Vercel (Krok 1)

---

## Krok 3 — Migracja bazy danych

Jeśli jeszcze nie uruchamiałeś migracji, wejdź w **Supabase** → **SQL Editor** i wykonaj plik:

```
supabase/013_meetings.sql
```

Tworzy tabelę `meeting_transcripts` gdzie lądują transkrypcje i wyciągnięte taski.

---

## Jak to działa

```
Fathom (spotkanie kończy się)
  → webhook POST /api/webhooks/fathom
    → weryfikacja HMAC-SHA256 (whsec_...)
      → zapis transkrypcji do meeting_transcripts (status: pending)
        → Claude Haiku analizuje transkrypcję w tle
          → taski zapisane w meeting_transcripts (status: done)
            → widoczne w Operacje → Spotkania
```

1. Spotkanie kończy się w Fathomie
2. Fathom wysyła webhook → transkrypcja zapisuje się w bazie
3. Claude Haiku (najtańszy model) automatycznie wyciąga taski, priorytety, osoby
4. W aplikacji: **Operacje → Spotkania** → widzisz spotkanie z listą proponowanych zadań
5. Zaznaczasz które taski chcesz → klikasz **Dodaj zadania** → trafiają na Tablicę zadań

---

## Wymagane zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `FATHOM_WEBHOOK_SECRET` | Sekret `whsec_...` z panelu Fathom |
| `ANTHROPIC_API_KEY` | Klucz API Anthropic (do Claude Haiku) |

`ANTHROPIC_API_KEY` powinien już być ustawiony jeśli korzystasz z agenta AI w aplikacji.

---

## Testowanie

Możesz przetestować czy endpoint działa bez prawdziwego spotkania — wyślij ręcznie POST z dowolnym JSON na:

```
https://TWOJA-DOMENA.vercel.app/api/webhooks/fathom
```

Jeśli `FATHOM_WEBHOOK_SECRET` nie jest ustawiony, weryfikacja podpisu jest pomijana (tryb deweloperski). Ustaw go zawsze na produkcji.
