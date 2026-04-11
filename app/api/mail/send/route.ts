import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { account_id, to, cc, subject, html, text, in_reply_to, references } = await req.json();

  if (!account_id || !to || !subject) {
    return NextResponse.json({ error: 'missing_fields', message: 'Wymagane: account_id, to, subject' }, { status: 400 });
  }

  const { data: account, error: dbErr } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', account_id)
    .eq('user_id', user.id)
    .single();

  if (dbErr || !account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: { user: account.username, pass: account.password },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.sendMail({
      from: `${account.name} <${account.email}>`,
      to,
      cc: cc || undefined,
      subject,
      html: html || undefined,
      text: text || undefined,
      inReplyTo: in_reply_to || undefined,
      references: references || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[mail/send]', err);
    return NextResponse.json({ error: 'smtp_error', message: err.message }, { status: 500 });
  }
}
