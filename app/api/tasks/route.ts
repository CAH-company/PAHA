import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  // Wywołanie z agenta (internal) lub z przeglądarki (user session)
  const isInternal = req.headers.get('x-internal') === process.env.SUPABASE_SERVICE_ROLE_KEY;
  let creatorId: string | null = null;

  if (!isInternal) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: emp } = await admin.from('employees').select('id').eq('user_id', user.id).single();
    creatorId = emp?.id ?? null;
  }

  const body = await req.json();
  const {
    title,
    description,
    priority = 'normal',
    due_date,
    category = 'general',
    client_id,
    assignee_ids = [],   // uuid[]
    column_id,          // jeśli nie podany — bierze pierwszą kolumnę
    board_id,
  } = body;

  if (!title) return NextResponse.json({ error: 'Tytuł jest wymagany' }, { status: 400 });

  // Znajdź pierwszą kolumnę jeśli nie podano
  let targetColumnId = column_id;
  let targetBoardId = board_id;

  if (!targetColumnId) {
    const { data: boards } = await admin.from('task_boards').select('id').limit(1);
    targetBoardId = boards?.[0]?.id;
    if (targetBoardId) {
      const { data: cols } = await admin
        .from('task_columns')
        .select('id')
        .eq('board_id', targetBoardId)
        .order('position', { ascending: true })
        .limit(1);
      targetColumnId = cols?.[0]?.id;
    }
  }

  // Pobierz max pozycję w kolumnie
  const { data: lastTask } = await admin
    .from('tasks')
    .select('position')
    .eq('column_id', targetColumnId)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = (lastTask?.position ?? -1) + 1;

  // Utwórz zadanie
  const { data: task, error } = await admin
    .from('tasks')
    .insert({
      title,
      description: description ?? null,
      priority,
      due_date: due_date ?? null,
      category,
      client_id: client_id ?? null,
      column_id: targetColumnId ?? null,
      board_id: targetBoardId ?? null,
      position,
      created_by: creatorId,
    })
    .select('id')
    .single();

  if (error || !task) {
    return NextResponse.json({ error: error?.message ?? 'Błąd tworzenia zadania' }, { status: 500 });
  }

  // Przypisz osoby
  if (assignee_ids.length > 0) {
    await admin.from('task_assignees').insert(
      assignee_ids.map((emp_id: string) => ({ task_id: task.id, employee_id: emp_id }))
    );
  }

  return NextResponse.json({ ok: true, task_id: task.id });
}
