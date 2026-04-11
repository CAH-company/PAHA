import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Jesteś inteligentnym asystentem biznesowym firmy. Masz dostęp do danych firmowych i pomagasz zespołowi w codziennej pracy.

Możesz pomóc w:
- Analizowaniu danych firmowych (leady, klienci, finanse, zadania)
- Tworzeniu dokumentów biznesowych (oferty, umowy, podsumowania)
- Odpowiadaniu na pytania o firmę na podstawie dostępnych danych
- Planowaniu i organizacji pracy

Odpowiadaj w języku polskim. Bądź konkretny, rzeczowy i profesjonalny. Jeśli tworzysz dokument lub listę, formatuj je czytelnie używając markdown.`;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get API key from app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'anthropic_api_key')
      .maybeSingle();

    const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'no_api_key', message: 'Brak klucza API Anthropic. Skonfiguruj go w Ustawieniach.' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, context } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Bad request', { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });

    // Build system with optional context (RAG/Drive results injected here later)
    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\n--- KONTEKST Z BAZY WIEDZY ---\n${context}`
      : SYSTEM_PROMPT;

    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemWithContext,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const data = JSON.stringify({ text: chunk.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('[agent/route]', err);
    return new Response(
      JSON.stringify({ error: 'server_error', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
