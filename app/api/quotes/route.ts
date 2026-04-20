import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_line_items(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const quotes = (data ?? []).map((q: any) => ({
    ...q,
    items: (q.quote_line_items ?? []).sort((a: any, b: any) => a.position - b.position),
  }));

  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { items, ...quoteData } = body;

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({ ...quoteData, created_by: employee?.id ?? null })
    .select('id')
    .single();

  if (error || !quote) return NextResponse.json({ error: error?.message }, { status: 500 });

  if (Array.isArray(items) && items.length > 0) {
    const lineItems = items.map((item: any, idx: number) => ({
      quote_id: quote.id,
      position: idx,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_net: item.unit_price_net,
      vat_rate: item.vat_rate,
      amount_net: item.amount_net,
      vat_amount: item.vat_amount,
      amount_gross: item.amount_gross,
    }));

    await supabase.from('quote_line_items').insert(lineItems);
  }

  return NextResponse.json({ id: quote.id }, { status: 201 });
}
