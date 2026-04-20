import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface TaskToConfirm {
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string | null;
  category?: string;
  assignee_id?: string | null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { tasks }: { tasks: TaskToConfirm[] } = await req.json();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'no_tasks' }, { status: 400 });
  }

  // Get default board and first column
  const { data: board } = await supabase
    .from('task_boards')
    .select('id')
    .limit(1)
    .single();

  if (!board) return NextResponse.json({ error: 'no_board' }, { status: 422 });

  const { data: columns } = await supabase
    .from('task_columns')
    .select('id, position')
    .eq('board_id', board.id)
    .order('position', { ascending: true });

  const defaultColumn = columns?.[0];
  if (!defaultColumn) return NextResponse.json({ error: 'no_column' }, { status: 422 });

  // Get current employee
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const createdIds: string[] = [];

  for (const t of tasks) {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        board_id: board.id,
        column_id: defaultColumn.id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority ?? 'normal',
        due_date: t.due_date ?? null,
        category: t.category ?? 'general',
        created_by: employee?.id ?? null,
      })
      .select('id')
      .single();

    if (error || !task) continue;

    createdIds.push(task.id);

    // Assign + mark as needing acceptance
    if (t.assignee_id) {
      await supabase.from('task_assignees').insert({
        task_id: task.id,
        employee_id: t.assignee_id,
        meeting_id: params.id,
      });
    }
  }

  return NextResponse.json({ ok: true, created: createdIds.length });
}
