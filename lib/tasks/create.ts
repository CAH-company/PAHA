import { createAdminClient } from '@/lib/supabase/admin';

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  category?: string;
  client_id?: string | null;
  assignee_ids?: string[];
  column_id?: string;
  board_id?: string;
  created_by?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<{ ok: true; task_id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  let targetColumnId = input.column_id;
  let targetBoardId = input.board_id;

  if (!targetColumnId) {
    // Znajdź istniejący board
    let { data: boards } = await admin.from('task_boards').select('id').limit(1);

    // Jeśli nie ma żadnego — utwórz domyślny
    if (!boards?.length) {
      const { data: newBoard } = await admin
        .from('task_boards')
        .insert({ name: 'Główna tablica' })
        .select('id')
        .single();
      if (newBoard) {
        // Utwórz domyślne kolumny
        await admin.from('task_columns').insert([
          { board_id: newBoard.id, name: 'Do zrobienia', color: '#94a3b8', position: 0 },
          { board_id: newBoard.id, name: 'W toku', color: '#6366f1', position: 1 },
          { board_id: newBoard.id, name: 'Gotowe', color: '#10b981', position: 2 },
        ]);
        boards = [newBoard];
      }
    }

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

  const { data: lastTask } = await admin
    .from('tasks')
    .select('position')
    .eq('column_id', targetColumnId)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = (lastTask?.position ?? -1) + 1;

  const { data: task, error } = await admin
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'normal',
      due_date: input.due_date ?? null,
      category: input.category ?? 'general',
      client_id: input.client_id ?? null,
      column_id: targetColumnId ?? null,
      board_id: targetBoardId ?? null,
      position,
      created_by: input.created_by ?? null,
    })
    .select('id')
    .single();

  if (error || !task) {
    return { ok: false, error: error?.message ?? 'Błąd tworzenia zadania' };
  }

  if (input.assignee_ids?.length) {
    await admin.from('task_assignees').insert(
      input.assignee_ids.map(emp_id => ({ task_id: task.id, employee_id: emp_id }))
    );
  }

  return { ok: true, task_id: task.id };
}
