import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const rid = req.nextUrl.searchParams.get('rid');

  if (!rid) {
    return new NextResponse(page('Nieprawidłowy link', 'Link wypisania jest nieprawidłowy.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const admin = createAdminClient();

  const { data: recipient } = await admin
    .from('email_campaign_recipients')
    .select('id, campaign_id, status')
    .eq('id', rid)
    .single();

  if (!recipient) {
    return new NextResponse(page('Nie znaleziono', 'Nie znaleziono tego rekordu.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (recipient.status === 'unsubscribed') {
    return new NextResponse(page('Już wypisany', 'Byłeś już wcześniej wypisany z tej kampanii.', true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  await admin
    .from('email_campaign_recipients')
    .update({ status: 'unsubscribed', next_send_at: null })
    .eq('id', rid);

  await admin.from('email_campaign_events').insert({
    campaign_id: recipient.campaign_id,
    recipient_id: rid,
    event_type: 'unsubscribed',
  });

  return new NextResponse(page('Wypisano pomyślnie', 'Zostałeś wypisany z tej kampanii mailowej. Nie będziesz już otrzymywać wiadomości z tej sekwencji.', true), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function page(title: string, message: string, success: boolean) {
  const color = success ? '#10b981' : '#ef4444';
  const icon  = success ? '✓' : '✕';
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; border-radius: 16px; padding: 48px 40px;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 400px; }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: ${color}1a;
            color: ${color}; font-size: 24px; display: flex; align-items: center;
            justify-content: center; margin: 0 auto 20px; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    p  { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
