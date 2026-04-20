import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';

export const runtime = 'nodejs';

// GET /api/mail/debug?account_id=xxx
// Zwraca listę folderów + info o INBOX — do diagnostyki
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'missing account_id' }, { status: 400 });

  const { data: account } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (!account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure,
    auth: { user: account.username, pass: account.password },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 8000,
    connectionTimeout: 8000,
  } as any);

  try {
    await client.connect();

    const folderList = await client.list();
    const folders = folderList.map((folder: any) => ({
      path: folder.path,
      name: folder.name,
      flags: [...(folder.flags ?? [])],
    }));

    // Sprawdź INBOX
    let inboxInfo: any = null;
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mb = client.mailbox as any;
        inboxInfo = {
          exists: mb?.exists,
          unseen: mb?.unseen,
          uidNext: mb?.uidNext,
          flags: mb?.flags,
        };
      } finally {
        lock.release();
      }
    } catch (e: any) {
      inboxInfo = { error: e.message };
    }

    await client.logout();

    return NextResponse.json({
      connected: true,
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_secure,
      folders,
      inbox: inboxInfo,
    });
  } catch (err: any) {
    try { await client.logout(); } catch {}
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
  }
}
