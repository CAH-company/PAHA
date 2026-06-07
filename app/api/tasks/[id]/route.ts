import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function resolveEmployee(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('employees').select('id, role').eq('user_id', userId).single();
  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const body = await req.json();

  const updates: Record<string, any> = {};
  if ('title'       in body) updates.title       = body.title;
  if ('description' in body) updates.description = body.description ?? null;
  if ('priority'    in body) updates.priority    = body.priority;
  if ('due_date'    in body) updates.due_date    = body.due_date ?? null;
  if ('category'    in body) updates.category    = body.category;
  if ('client_id'   in body) updates.client_id   = body.client_id ?? null;
  if ('column_id'   in body) updates.column_id   = body.column_id;
  if ('position'    in body) updates.position    = body.position;

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from('tasks').update(updates).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ('assignee_ids' in body) {
    await admin.from('task_assignees').delete().eq('task_id', params.id);
    if (body.assignee_ids?.length) {
      await admin.from('task_assignees').insert(
        body.assignee_ids.map((emp_id: string) => ({ task_id: params.id, employee_id: emp_id }))
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const emp = await resolveEmployee(supabase, user.id);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Tylko twórca zadania lub admin/partner może je usunąć
  const { data: task } = await admin.from('tasks').select('created_by').eq('id', params.id).single();
  if (!task) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

  const isPrivileged = ['admin', 'partner'].includes(emp.role);
  if (!isPrivileged && task.created_by !== emp.id) {
    return NextResponse.json({ error: 'Brak uprawnień do usunięcia tego zadania' }, { status: 403 });
  }

  const { error } = await admin.from('tasks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
