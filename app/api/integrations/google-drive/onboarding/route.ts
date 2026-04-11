import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const KLIENCI_FOLDER_ID = '11JJOb3zt66KuQ8B5XK93HeJgJnwY5VJJ';

function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('no_credentials');

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function createFolder(drive: any, name: string, parentId: string): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return res.data.id as string;
}

async function shareFolder(drive: any, fileId: string, email: string) {
  await drive.permissions.create({
    fileId,
    sendNotificationEmail: false,   // we send our own email
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: email,
    },
  });
}

function folderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: 'missing client_id' }, { status: 400 });

  // Fetch client
  const { data: clientData, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, company, email, google_drive_folder_id, google_drive_shared_folder_id, onboarding_done_at')
    .eq('id', client_id)
    .maybeSingle();

  if (clientErr || !clientData) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  }

  // Already done?
  if (clientData.google_drive_folder_id) {
    return NextResponse.json({
      already_done: true,
      folder_url: folderUrl(clientData.google_drive_folder_id),
      shared_folder_url: clientData.google_drive_shared_folder_id
        ? folderUrl(clientData.google_drive_shared_folder_id)
        : null,
      onboarding_done_at: clientData.onboarding_done_at,
    });
  }

  // Check credentials
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'no_credentials', message: 'Brak klucza Service Account Google. Dodaj GOOGLE_SERVICE_ACCOUNT_KEY do .env.local' }, { status: 422 });
  }

  try {
    const drive = getDriveClient();

    // Folder names
    const clientFolderName = clientData.name;                // "Jan Kowalski"
    const sharedFolderName = clientData.company
      ? `${clientData.name} | ${clientData.company}`
      : clientData.name;                                     // "Jan Kowalski | Acme Sp. z o.o."

    // 1. Create top-level client folder inside Klienci/
    const clientFolderId = await createFolder(drive, clientFolderName, KLIENCI_FOLDER_ID);

    // 2. Create subfolders
    const [, sharedFolderId] = await Promise.all([
      createFolder(drive, 'Nasze Pliki', clientFolderId),
      createFolder(drive, sharedFolderName, clientFolderId),
    ]);

    // 3. Share the client-facing folder (if email exists)
    if (clientData.email) {
      await shareFolder(drive, sharedFolderId, clientData.email);
    }

    // 4. Save to DB
    const now = new Date().toISOString();
    await supabase
      .from('clients')
      .update({
        google_drive_folder_id: clientFolderId,
        google_drive_shared_folder_id: sharedFolderId,
        onboarding_done_at: now,
      })
      .eq('id', client_id);

    // 5. Build email content
    const emailContent = buildOnboardingEmail({
      clientName: clientData.name,
      folderUrl: folderUrl(sharedFolderId),
    });

    // Email sending via Resend — do skonfigurowania później
    const emailSent = false;

    return NextResponse.json({
      success: true,
      folder_url: folderUrl(clientFolderId),
      shared_folder_url: folderUrl(sharedFolderId),
      email_sent: emailSent,
      email_content: !emailSent && clientData.email ? emailContent : null,
      client_email: clientData.email ?? null,
    });
  } catch (err: any) {
    if (err.message === 'no_credentials') {
      return NextResponse.json({ error: 'no_credentials', message: 'Brak klucza Service Account Google.' }, { status: 422 });
    }
    console.error('[google-drive/onboarding]', err);
    return NextResponse.json({ error: 'drive_error', message: err.message ?? 'Błąd Google Drive' }, { status: 500 });
  }
}

function buildOnboardingEmail({ clientName, folderUrl }: { clientName: string; folderUrl: string }) {
  const subject = `Twój folder projektowy jest gotowy`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #6366f1; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">Witamy na pokładzie! 🎉</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Cześć <strong>${clientName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Przygotowaliśmy dla Ciebie dedykowany folder na Google Drive, gdzie będziemy umieszczać wszystkie dokumenty związane z naszą współpracą — oferty, umowy, pliki projektowe.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${folderUrl}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
          📁 Otwórz swój folder
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        Folder jest udostępniony tylko Tobie. Zaloguj się kontem Google powiązanym z tym adresem email, aby uzyskać dostęp.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
