import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const runtime = 'nodejs';

const KLIENCI_FOLDER_ID = '11JJOb3zt66KuQ8B5XK93HeJgJnwY5VJJ';

function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

function buildSystemVars(): Record<string, string> {
  const now = new Date();
  const MONTHS = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  return {
    data: now.toLocaleDateString('pl', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    data_dlugia: `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()} r.`,
    rok: String(now.getFullYear()),
    miesiac: MONTHS[now.getMonth()],
    miesiac_numer: String(now.getMonth() + 1).padStart(2, '0'),
  };
}

function buildClientVars(client: any): Record<string, string> {
  return {
    nazwa_klienta: client.name ?? '',
    imie_nazwisko: client.name ?? '',
    firma: client.company ?? '',
    nazwa_firmy: client.company ?? '',
    email: client.email ?? '',
    telefon: client.phone ?? '',
    adres: client.address ?? '',
    nip: client.nip ?? '',
    regon: client.regon ?? '',
    numer_umowy: client.contract_number ?? '',
    data_umowy: client.contract_date
      ? new Date(client.contract_date).toLocaleDateString('pl', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '',
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { template_id, client_id, extra_vars, output_name } = await req.json();
  if (!template_id) return NextResponse.json({ error: 'missing template_id' }, { status: 400 });

  // Fetch template metadata
  const { data: tmpl, error: tmplErr } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', template_id)
    .single();
  if (tmplErr || !tmpl) return NextResponse.json({ error: 'template_not_found' }, { status: 404 });

  // Fetch client (optional)
  let clientData: any = null;
  if (client_id) {
    const { data } = await supabase.from('clients').select('*').eq('id', client_id).single();
    clientData = data;
  }

  // Download template from Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('document-templates')
    .download(tmpl.file_path);
  if (dlErr || !fileData) return NextResponse.json({ error: 'template_download_failed', message: dlErr?.message }, { status: 500 });

  const buffer = Buffer.from(await fileData.arrayBuffer());

  // Build variables
  const vars: Record<string, string> = {
    ...buildSystemVars(),
    ...(clientData ? buildClientVars(clientData) : {}),
    ...(extra_vars ?? {}),
  };

  // Generate DOCX
  let generatedBuffer: Buffer;
  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      errorLogging: false,
    });
    doc.render(vars);
    generatedBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  } catch (err: any) {
    return NextResponse.json({ error: 'generation_failed', message: err.message }, { status: 500 });
  }

  // Determine output filename
  const baseName = output_name?.trim() || tmpl.name;
  const fileName = `${baseName}.docx`.replace(/\.docx\.docx$/, '.docx');

  // Upload to Google Drive
  const drive = getDriveClient();
  let driveFileId: string | null = null;
  let driveUrl: string | null = null;

  if (drive) {
    try {
      // Determine parent folder: client's Drive folder or root Klienci
      const parentId = clientData?.google_drive_folder_id ?? KLIENCI_FOLDER_ID;

      const stream = Readable.from(generatedBuffer);
      const uploaded = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentId],
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        media: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: stream },
        fields: 'id, webViewLink',
      });
      driveFileId = uploaded.data.id ?? null;
      driveUrl = uploaded.data.webViewLink ?? null;
    } catch (driveErr: any) {
      console.error('[generate] Drive upload error:', driveErr.message);
      // Don't fail — return the file as download even if Drive fails
    }
  }

  // Log to DB
  await supabase.from('generated_documents').insert({
    template_id,
    client_id: client_id ?? null,
    file_name: fileName,
    drive_file_id: driveFileId,
    drive_url: driveUrl,
    variables_used: vars,
    created_by: user.id,
  });

  // If no Drive, return file as download
  if (!driveUrl) {
    return new NextResponse(generatedBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  }

  return NextResponse.json({ success: true, file_name: fileName, drive_url: driveUrl, drive_file_id: driveFileId });
}
