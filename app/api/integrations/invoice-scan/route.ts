import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Get API key
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const { data } = await supabase.from('app_settings').select('anthropic_api_key').maybeSingle();
    apiKey = data?.anthropic_api_key ?? undefined;
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'no_api_key', message: 'Brak klucza Anthropic API. Dodaj ANTHROPIC_API_KEY do .env.local' }, { status: 422 });
  }

  const { file_base64, mime_type } = await req.json();
  if (!file_base64 || !mime_type) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `Przeanalizuj ten dokument (faktura, paragon lub zestawienie) i wyodrębnij dane finansowe.
Zwróć TYLKO JSON bez żadnego dodatkowego tekstu:
{
  "title": "krótki tytuł/opis transakcji (np. nazwa usługi lub dostawcy)",
  "invoice_number": "numer faktury lub null",
  "date": "data w formacie YYYY-MM-DD lub null",
  "currency": "waluta (PLN/EUR/USD) lub PLN jeśli nie widać",
  "vat_rate": liczba lub null (np. 23, 8, 5, 0; null jeśli zwolnione),
  "amount_net": liczba netto lub null,
  "amount_vat": liczba kwoty VAT lub null,
  "amount_gross": liczba brutto (wymagane),
  "counterparty": "nazwa kontrahenta/dostawcy lub null",
  "project_name": null
}
Jeśli nie możesz odczytać wartości, wpisz null. Kwoty jako liczby bez spacji i walut.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime_type as any,
              data: file_base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonText);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('[invoice-scan]', err);
    return NextResponse.json({ error: 'scan_error', message: err.message ?? 'Błąd skanowania faktury' }, { status: 500 });
  }
}
