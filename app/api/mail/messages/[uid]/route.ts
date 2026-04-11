import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const folder = searchParams.get('folder') || 'INBOX';

  if (!accountId) return NextResponse.json({ error: 'missing account_id' }, { status: 400 });

  const { data: account, error: dbErr } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (dbErr || !account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure,
    auth: { user: account.username, pass: account.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let result: any = null;

    try {
      const uid = parseInt(params.uid, 10);
      const msg = await client.fetchOne(`${uid}`, { source: true, flags: true, envelope: true }, { uid: true });

      if (!msg || !msg.source) return NextResponse.json({ error: 'message_not_found' }, { status: 404 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = await (simpleParser as any)(msg.source);

      // Mark as read
      await client.messageFlagsAdd(`${uid}`, ['\\Seen'], { uid: true });

      result = {
        uid,
        subject: parsed.subject ?? '(brak tematu)',
        from: parsed.from?.value ?? [],
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.flatMap((t: any) => t.value) : parsed.to.value) : [],
        cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.flatMap((t: any) => t.value) : parsed.cc.value) : [],
        date: parsed.date ?? null,
        html: parsed.html || null,
        text: parsed.text || null,
        inReplyTo: parsed.inReplyTo ?? null,
        messageId: parsed.messageId ?? null,
        attachments: (parsed.attachments ?? []).map((a: any) => ({
          filename: a.filename ?? 'attachment',
          contentType: a.contentType,
          size: a.size,
        })),
      };
    } finally {
      lock.release();
    }

    await client.logout();
    return NextResponse.json({ message: result });
  } catch (err: any) {
    console.error('[mail/messages/uid]', err);
    try { await client.logout(); } catch {}
    return NextResponse.json({ error: 'imap_error', message: err.message }, { status: 500 });
  }
}
