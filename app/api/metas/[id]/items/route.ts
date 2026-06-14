import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { name, amount } = await request.json();
  if (!name || !amount) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const { data: item, error } = await supabase
    .from('saving_goal_items')
    .insert({ goal_id: params.id, name, amount: Number(amount) })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Error al agregar componente' }, { status: 500 });

  const { data: allItems } = await supabase
    .from('saving_goal_items')
    .select('amount')
    .eq('goal_id', params.id);

  const newTarget = (allItems || []).reduce((s, i) => s + Number(i.amount), 0);
  await supabase.from('saving_goals').update({ target_amount: newTarget }).eq('id', params.id);

  return NextResponse.json({ item, newTarget });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { itemId } = await request.json();
  if (!itemId) return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });

  await supabase.from('saving_goal_items').delete().eq('id', itemId);

  const { data: remaining } = await supabase
    .from('saving_goal_items')
    .select('amount')
    .eq('goal_id', params.id);

  const newTarget = (remaining || []).reduce((s, i) => s + Number(i.amount), 0);
  if (newTarget > 0) {
    await supabase.from('saving_goals').update({ target_amount: newTarget }).eq('id', params.id);
  }

  return NextResponse.json({ success: true, newTarget });
}
