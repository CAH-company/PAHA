import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: meeting, error } = await supabase
    .from('meeting_transcripts')
    .select('id, raw_transcript, participants')
    .eq('id', params.id)
    .single();

  if (error || !meeting) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const transcript = meeting.raw_transcript ?? '';
  if (transcript.length < 50) {
    return NextResponse.json({ error: 'no_transcript' }, { status: 422 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const { data } = await supabase.from('app_settings').select('anthropic_api_key').maybeSingle();
    if (!data?.anthropic_api_key) {
      return NextResponse.json({ error: 'no_api_key' }, { status: 422 });
    }
  }

  const svc = createServiceClient();
  await svc.from('meeting_transcripts').update({ status: 'processing' }).eq('id', params.id);

  const participants: string[] = Array.isArray(meeting.participants) ? meeting.participants : [];
  const participantList = participants.length > 0
    ? `Uczestnicy spotkania: ${participants.join(', ')}.`
    : '';

  try {
    const client = new Anthropic({ apiKey: apiKey! });

    const prompt = `${participantList}

Przeanalizuj poniższą transkrypcję spotkania i wyodrębnij wszystkie zadania, ustalenia i działania do wykonania.

Dla każdego zadania zwróć JSON z polami:
- title: krótki tytuł zadania (max 80 znaków)
- description: szczegółowy opis co trzeba zrobić (1-3 zdania)
- priority: "low" | "normal" | "high" | "urgent"
- suggested_assignee: imię osoby z transkrypcji która ma to zrobić, lub null
- due_date: data w formacie YYYY-MM-DD jeśli wspomniana, lub null
- category: "general" | "client" | "onboarding" | "documentation" | "marketing" | "hr" | "operations"

Zwróć TYLKO JSON bez dodatkowego tekstu:
{
  "summary": "1-2 zdania podsumowania spotkania",
  "tasks": [...]
}

Transkrypcja:
---
${transcript.slice(0, 150000)}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonText);

    await svc.from('meeting_transcripts').update({
      status: 'done',
      extracted_tasks: parsed,
      processed_at: new Date().toISOString(),
    }).eq('id', params.id);

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: any) {
    await svc.from('meeting_transcripts').update({
      status: 'error',
      error_message: err?.message ?? 'Błąd przetwarzania',
    }).eq('id', params.id);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
