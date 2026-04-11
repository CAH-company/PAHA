import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Fetch to get file_path for storage cleanup
  const { data: tmpl } = await supabase
    .from('document_templates')
    .select('file_path, created_by')
    .eq('id', params.id)
    .single();

  if (!tmpl) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (tmpl.created_by !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await supabase.storage.from('document-templates').remove([tmpl.file_path]);
  await supabase.from('document_templates').delete().eq('id', params.id);

  return NextResponse.json({ success: true });
}
