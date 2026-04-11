import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // Sprawdź czy wywołujący jest adminem/partnerem
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!caller || !['admin', 'partner'].includes(caller.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, role = 'employee', position } = body;

  if (!name || !email) {
    return NextResponse.json({ error: 'Imię i email są wymagane' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Utwórz użytkownika i wyślij magic link zaproszenia
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });

  if (inviteError) {
    // Jeśli użytkownik już istnieje w auth, kontynuuj — może nie ma jeszcze rekordu employee
    if (!inviteError.message.includes('already been registered')) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }
  }

  // Sprawdź czy rekord employee już istnieje
  const { data: existing } = await admin
    .from('employees')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Pracownik z tym emailem już istnieje' }, { status: 409 });
  }

  // Utwórz rekord pracownika (user_id podepniemy przez trigger lub po pierwszym logowaniu)
  const userId = invited?.user?.id ?? null;

  const { error: insertError } = await admin.from('employees').insert({
    user_id: userId,
    name,
    email,
    role,
    position: position || null,
    is_active: true,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
