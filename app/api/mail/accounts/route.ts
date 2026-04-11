import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';

export const runtime = 'nodejs';

// GET — list accounts for current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from('email_accounts')
    .select('id, name, email, imap_host, imap_port, smtp_host, smtp_port, created_at')
    .eq('user_id', user.id)
    .order('created_at');

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

// POST — add account (with connection test)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username, password } = body;

  if (!name || !email || !imap_host || !smtp_host || !username || !password) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Test IMAP connection
  const client = new ImapFlow({
    host: imap_host,
    port: imap_port ?? 993,
    secure: imap_secure ?? true,
    auth: { user: username, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.logout();
  } catch (err: any) {
    return NextResponse.json({ error: 'imap_error', message: `Nie można połączyć z serwerem IMAP: ${err.message}` }, { status: 422 });
  }

  const { data, error: dbErr } = await supabase
    .from('email_accounts')
    .insert({ user_id: user.id, name, email, imap_host, imap_port: imap_port ?? 993, imap_secure: imap_secure ?? true, smtp_host, smtp_port: smtp_port ?? 587, smtp_secure: smtp_secure ?? false, username, password })
    .select('id, name, email, imap_host, imap_port, smtp_host, smtp_port, created_at')
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
