import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { items, ...quoteData } = body;

  const { error } = await supabase
    .from('quotes')
    .update(quoteData)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace line items if provided
  if (Array.isArray(items)) {
    await supabase.from('quote_line_items').delete().eq('quote_id', params.id);

    if (items.length > 0) {
      const lineItems = items.map((item: any, idx: number) => ({
        quote_id: params.id,
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
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('quotes').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
