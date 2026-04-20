import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { action } = await req.json(); // 'accept' | 'reject'

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!employee) return NextResponse.json({ error: 'no_employee' }, { status: 422 });

  const update =
    action === 'reject'
      ? { rejected_at: new Date().toISOString(), accepted_at: null }
      : { accepted_at: new Date().toISOString(), rejected_at: null };

  const { error } = await supabase
    .from('task_assignees')
    .update(update)
    .eq('task_id', params.id)
    .eq('employee_id', employee.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
