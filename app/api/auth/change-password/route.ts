import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { new_password } = await req.json();
  if (!new_password || new_password.length < 8) {
    return NextResponse.json({ error: 'Hasło musi mieć min. 8 znaków' }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
