import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTask } from '@/lib/tasks/create';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();

  const body = await req.json();
  const { title, description, priority, due_date, category, client_id, assignee_ids, column_id, board_id } = body;

  if (!title) return NextResponse.json({ error: 'Tytuł jest wymagany' }, { status: 400 });

  const result = await createTask({
    title, description, priority, due_date, category,
    client_id: client_id || null,
    assignee_ids: assignee_ids ?? [],
    column_id, board_id,
    created_by: emp?.id ?? null,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, task_id: result.task_id });
}
