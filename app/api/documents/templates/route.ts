import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PizZip from 'pizzip';

export const runtime = 'nodejs';

// Extract {placeholder} variables from DOCX XML
function extractVariables(buffer: Buffer): string[] {
  try {
    const zip = new PizZip(buffer);
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
    const found = new Set<string>();
    for (const f of xmlFiles) {
      if (zip.files[f]) {
        const content = zip.files[f].asText();
        // Strip XML tags to get plain text, then find {variable} patterns
        const plain = content.replace(/<[^>]+>/g, ' ');
        let m: RegExpExecArray | null;
        const re = /\{([a-zA-Z0-9_żźćńółęąś]+)\}/g;
        while ((m = re.exec(plain)) !== null) found.add(m[1]);
      }
    }
    return Array.from(found);
  } catch {
    return [];
  }
}

// GET — list templates
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from('document_templates')
    .select('id, name, description, category, file_name, variables, created_at')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// POST — upload template (multipart/form-data)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const name = (form.get('name') as string | null)?.trim();
  const description = (form.get('description') as string | null)?.trim() || null;
  const category = (form.get('category') as string | null) || 'inne';

  if (!file || !name) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!file.name.endsWith('.docx')) return NextResponse.json({ error: 'only_docx', message: 'Obsługiwane są tylko pliki .docx' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const variables = extractVariables(buffer);

  // Upload to Supabase Storage
  const filePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: storErr } = await supabase.storage
    .from('document-templates')
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (storErr) return NextResponse.json({ error: storErr.message }, { status: 500 });

  // Save metadata
  const { data: tmpl, error: dbErr } = await supabase
    .from('document_templates')
    .insert({ name, description, category, file_path: filePath, file_name: file.name, variables, created_by: user.id })
    .select()
    .single();

  if (dbErr) {
    await supabase.storage.from('document-templates').remove([filePath]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ template: tmpl });
}
