import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

function verifyWebhook(secret: string, headers: Record<string, string>, rawBody: string): boolean {
  const webhookId = headers['webhook-id'];
  const webhookTimestamp = headers['webhook-timestamp'];
  const webhookSignature = headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const timestamp = parseInt(webhookTimestamp, 10);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const secretPart = secret.includes('_') ? secret.split('_')[1] : secret;
  const secretBytes = Buffer.from(secretPart, 'base64');

  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  const signatures = webhookSignature.split(' ').map(sig => {
    const parts = sig.split(',');
    return parts.length > 1 ? parts[1] : parts[0];
  });

  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(sig)
      );
    } catch {
      return false;
    }
  });
}

function extractFromPayload(payload: any): {
  fathomId: string | null;
  title: string;
  meetingDate: string | null;
  durationMinutes: number | null;
  participants: string[];
  transcript: string;
} {
  // Fathom.video webhook payload — handles common field names
  const data = payload?.data ?? payload;

  const transcript =
    data?.transcript?.text ??
    data?.transcript ??
    data?.full_transcript ??
    data?.transcription ??
    '';

  const participants: string[] = [];
  if (Array.isArray(data?.attendees)) {
    data.attendees.forEach((a: any) => {
      const name = a?.name ?? a?.display_name ?? a?.email;
      if (name) participants.push(name);
    });
  } else if (Array.isArray(data?.participants)) {
    data.participants.forEach((p: any) => {
      const name = p?.name ?? p?.display_name ?? p?.email;
      if (name) participants.push(name);
    });
  }

  const rawDate = data?.started_at ?? data?.meeting_date ?? data?.date ?? data?.created_at;
  const duration =
    data?.duration_minutes ??
    (data?.duration ? Math.round(data.duration / 60) : null);

  return {
    fathomId: data?.id ?? payload?.id ?? null,
    title: data?.title ?? data?.name ?? 'Spotkanie bez tytułu',
    meetingDate: rawDate ?? null,
    durationMinutes: duration,
    participants,
    transcript: typeof transcript === 'string' ? transcript : '',
  };
}

function buildPrompt(participants: string[], transcript: string) {
  const participantList = participants.length > 0
    ? `Uczestnicy spotkania: ${participants.join(', ')}.`
    : '';
  return `${participantList}

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
}

async function getAiSettings() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['automation_provider', 'anthropic_api_key', 'automation_anthropic_model', 'gemini_api_key', 'gemini_model']);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value ?? '';
  return map;
}

async function processWithAI(meetingId: string, transcript: string, participants: string[]) {
  const supabase = createServiceClient();

  await supabase.from('meeting_transcripts').update({ status: 'processing' }).eq('id', meetingId);

  try {
    const settings = await getAiSettings();
    const provider = settings.automation_provider || 'anthropic';
    const prompt = buildPrompt(participants, transcript);
    let text = '';

    if (provider === 'gemini') {
      const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY || '';
      if (!apiKey) throw new Error('Brak klucza Gemini API');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: settings.gemini_model || 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      text = result.response.text();
    } else {
      const apiKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) throw new Error('Brak klucza Anthropic API');
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: settings.automation_anthropic_model || 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    }

    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonText);

    await supabase.from('meeting_transcripts').update({
      status: 'done',
      extracted_tasks: parsed,
      processed_at: new Date().toISOString(),
    }).eq('id', meetingId);
  } catch (err: any) {
    await supabase.from('meeting_transcripts').update({
      status: 'error',
      error_message: err?.message ?? 'Błąd przetwarzania',
    }).eq('id', meetingId);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.FATHOM_WEBHOOK_SECRET ?? '';

  if (secret) {
    const valid = verifyWebhook(secret, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    }, rawBody);

    if (!valid) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { fathomId, title, meetingDate, durationMinutes, participants, transcript } =
    extractFromPayload(payload);

  const supabase = createServiceClient();

  // Upsert — Fathom może wysłać ten sam event dwa razy (retry)
  const { data: meeting, error } = await supabase
    .from('meeting_transcripts')
    .upsert({
      fathom_id: fathomId,
      title,
      meeting_date: meetingDate,
      duration_minutes: durationMinutes,
      participants,
      raw_transcript: transcript,
      raw_payload: payload,
      status: 'pending',
    }, { onConflict: 'fathom_id', ignoreDuplicates: false })
    .select('id')
    .single();

  if (error || !meeting) {
    console.error('[fathom-webhook] DB error:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // Fire and forget — Fathom dostaje 200 natychmiast, Haiku przetwarza w tle
  if (transcript.length > 100) {
    processWithAI(meeting.id, transcript, participants).catch(console.error);
  }

  return NextResponse.json({ ok: true, id: meeting.id });
}
