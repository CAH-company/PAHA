import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';

export const runtime = 'nodejs';

async function getAccount(supabase: any, userId: string, accountId: string) {
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

function makeClient(account: any) {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure,
    auth: { user: account.username, pass: account.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

// GET /api/mail/messages?account_id=&folder=INBOX&page=1&search=
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const folder = searchParams.get('folder') || 'INBOX';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 40;

  if (!accountId) return NextResponse.json({ error: 'missing account_id' }, { status: 400 });

  const account = await getAccount(supabase, user.id, accountId);
  if (!account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  const client = makeClient(account);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    const messages: any[] = [];
    let total = 0;

    try {
      const mailbox = client.mailbox as any;
      total = mailbox?.exists ?? 0;

      if (total === 0) {
        return NextResponse.json({ messages: [], total: 0, folder, page });
      }

      let uids: number[] = [];

      if (search) {
        // Search by subject or from
        const found = (await client.search({ or: [{ subject: search }, { from: search }] }, { uid: true })) as number[];
        uids = found.slice().reverse().slice((page - 1) * perPage, page * perPage);
        total = found.length;
      } else {
        // Fetch last N by sequence number
        const end = total;
        const start = Math.max(1, total - (page * perPage) + 1);
        const startPage = Math.max(1, total - ((page - 1) * perPage));

        const fetchRange = `${Math.max(1, startPage - perPage + 1)}:${startPage}`;

        for await (const msg of client.fetch(fetchRange, {
          envelope: true,
          flags: true,
          size: true,
          bodyStructure: true,
          internalDate: true,
        })) {
          messages.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: msg.envelope?.subject ?? '(brak tematu)',
            from: msg.envelope?.from?.[0] ?? null,
            to: msg.envelope?.to ?? [],
            date: msg.envelope?.date ?? msg.internalDate ?? null,
            seen: msg.flags?.has('\\Seen') ?? false,
            flagged: msg.flags?.has('\\Flagged') ?? false,
            answered: msg.flags?.has('\\Answered') ?? false,
            size: msg.size ?? 0,
            hasAttachment: hasAttachments(msg.bodyStructure),
          });
        }

        messages.reverse();
      }

      if (search && uids.length > 0) {
        for await (const msg of client.fetch(uids, {
          envelope: true,
          flags: true,
          size: true,
          internalDate: true,
        }, { uid: true })) {
          messages.push({
            uid: msg.uid,
            subject: msg.envelope?.subject ?? '(brak tematu)',
            from: msg.envelope?.from?.[0] ?? null,
            to: msg.envelope?.to ?? [],
            date: msg.envelope?.date ?? msg.internalDate ?? null,
            seen: msg.flags?.has('\\Seen') ?? false,
            flagged: msg.flags?.has('\\Flagged') ?? false,
            answered: msg.flags?.has('\\Answered') ?? false,
            size: msg.size ?? 0,
            hasAttachment: false,
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return NextResponse.json({ messages, total, folder, page });
  } catch (err: any) {
    console.error('[mail/messages]', err);
    try { await client.logout(); } catch {}
    return NextResponse.json({ error: 'imap_error', message: err.message }, { status: 500 });
  }
}

function hasAttachments(structure: any): boolean {
  if (!structure) return false;
  if (structure.disposition?.toLowerCase() === 'attachment') return true;
  if (structure.childNodes) {
    return structure.childNodes.some((c: any) => hasAttachments(c));
  }
  return false;
}
