import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `Jesteś inteligentnym asystentem biznesowym firmy CAH (Cracow Automation Hub). Pomagasz zespołowi w codziennej pracy.

Masz dostęp do narzędzi które pozwalają ci sprawdzać dane w czasie rzeczywistym:
- search_crm: wyszukiwanie leadów i klientów
- get_emails: pobieranie ostatnich emaili
Używaj tych narzędzi gdy użytkownik pyta o konkretne dane. Nie zmyślaj danych — jeśli nie wiesz, użyj narzędzia.

Odpowiadaj po polsku. Bądź konkretny i rzeczowy.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_crm',
    description: 'Wyszukuje leady i klientów w CRM.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Imię, firma, email lub fragment nazwy' },
        type: { type: 'string', enum: ['leads', 'clients', 'both'], description: 'Co szukać' },
        status: { type: 'string', description: 'Status leada: new, contacted, offer_sent, negotiation, won, lost' },
        limit: { type: 'number', description: 'Max wyników (domyślnie 10)' },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_emails',
    description: 'Pobiera ostatnie emaile lub szuka po temacie/nadawcy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Szukana fraza w temacie lub treści' },
        limit: { type: 'number', description: 'Liczba emaili (domyślnie 10)' },
      },
      required: [],
    },
  },
];

async function executeTool(name: string, input: Record<string, any>, supabaseUrl: string, supabaseKey: string): Promise<string> {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  if (name === 'search_crm') {
    const limit = input.limit ?? 10;
    const results: any[] = [];
    if (input.type === 'leads' || input.type === 'both') {
      let url = `${supabaseUrl}/rest/v1/leads?select=name,company,email,status,estimated_value,currency&limit=${limit}&order=created_at.desc`;
      if (input.query) url += `&or=(name.ilike.*${input.query}*,company.ilike.*${input.query}*,email.ilike.*${input.query}*)`;
      if (input.status) url += `&status=eq.${input.status}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (Array.isArray(data)) results.push(...data.map((r: any) => ({ ...r, _type: 'lead' })));
    }
    if (input.type === 'clients' || input.type === 'both') {
      let url = `${supabaseUrl}/rest/v1/clients?select=name,company,email,status,total_value,currency&limit=${limit}&order=created_at.desc`;
      if (input.query) url += `&or=(name.ilike.*${input.query}*,company.ilike.*${input.query}*,email.ilike.*${input.query}*)`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (Array.isArray(data)) results.push(...data.map((r: any) => ({ ...r, _type: 'client' })));
    }
    if (results.length === 0) return 'Brak wyników dla podanych kryteriów.';
    return JSON.stringify(results, null, 2);
  }

  if (name === 'get_emails') {
    const limit = input.limit ?? 10;
    let url = `${supabaseUrl}/rest/v1/emails?select=from_email,to_email,subject,content,direction,sent_at&limit=${limit}&order=created_at.desc`;
    if (input.query) url += `&or=(subject.ilike.*${input.query}*,content.ilike.*${input.query}*)`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return 'Brak emaili.';
    return JSON.stringify(data, null, 2);
  }

  return 'Nieznane narzędzie.';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('app_settings')
      .select('key, value')
      .in('key', ['anthropic_api_key', 'anthropic_model']);

    const apiKey = settings?.find(s => s.key === 'anthropic_api_key')?.value ?? process.env.ANTHROPIC_API_KEY;
    const model = settings?.find(s => s.key === 'anthropic_model')?.value ?? 'claude-sonnet-4-6';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'no_api_key', message: 'Brak klucza API Anthropic.' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Załaduj bazę wiedzy
    const { data: knowledge } = await supabase
      .from('knowledge_base')
      .select('title, folder, content')
      .order('folder', { ascending: true });

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (knowledge && knowledge.length > 0) {
      const knowledgeText = knowledge
        .map(k => `### ${k.folder ? k.folder + ' / ' : ''}${k.title}\n${k.content}`)
        .join('\n\n---\n\n');
      systemPrompt += `\n\n═══════════════════════════════\nBAZA WIEDZY FIRMY\n═══════════════════════════════\n\n${knowledgeText}`;
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Bad request', { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          let currentMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          }));

          // Rundy tool use (bez streamingu — potrzebujemy pełnej odpowiedzi żeby przetworzyć narzędzia)
          for (let round = 0; round < 4; round++) {
            const response = await anthropic.messages.create({
              model,
              max_tokens: 4096,
              system: systemPrompt,
              tools: TOOLS,
              messages: currentMessages,
            });

            const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

            if (toolUseBlocks.length === 0) {
              // Brak tool use — przerwijamy pętlę i streamujemy finalną odpowiedź
              break;
            }

            // Wykonaj narzędzia
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              if (block.type !== 'tool_use') continue;
              send({ tool: block.name });
              const result = await executeTool(block.name, block.input as Record<string, any>, supabaseUrl, supabaseKey);
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
            }

            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ];
          }

          // Finalna odpowiedź — prawdziwy streaming
          const stream = anthropic.messages.stream({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages: currentMessages,
          });

          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta' &&
              chunk.delta.text
            ) {
              send({ text: chunk.delta.text });
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (e: any) {
          send({ error: e.message ?? 'Nieznany błąd' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'server_error', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
