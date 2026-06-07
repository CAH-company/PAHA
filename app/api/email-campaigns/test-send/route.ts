import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { to, from_name, from_email, subject, body_html } = await req.json();

  if (!to || !from_email || !subject || !body_html) {
    return NextResponse.json({ error: 'Brakuje wymaganych pól' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Brak RESEND_API_KEY — skonfiguruj Resend w ustawieniach lub zmiennych środowiskowych.' }, { status: 422 });
  }

  // Podmień zmienne na dane testowe
  const testLead = { name: 'Jan Kowalski', first_name: 'Jan', company: 'Acme Sp. z o.o.', email: to };
  const filled = body_html
    .replace(/\{\{name\}\}/g, testLead.name)
    .replace(/\{\{first_name\}\}/g, testLead.first_name)
    .replace(/\{\{company\}\}/g, testLead.company)
    .replace(/\{\{email\}\}/g, testLead.email);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      ${filled.replace(/\n/g, '<br>')}
      <br><br>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="font-size:12px;color:#94a3b8;margin:0">
        <strong style="color:#6366f1">⚡ To jest testowy email</strong> — zmienne podstawione danymi fikcyjnymi.<br>
        W prawdziwej kampanii ten email będzie zawierał personalizację odbiorcy.<br><br>
        <a href="${appUrl}" style="color:#94a3b8">Wypisz mnie z tej listy</a>
      </p>
    </div>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: `${from_name || 'Test'} <${from_email}>`,
      to,
      subject: `[TEST] ${subject}`,
      html,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
