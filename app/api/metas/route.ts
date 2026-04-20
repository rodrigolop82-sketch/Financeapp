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

export async function GET(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId requerido' }, { status: 400 });

  const { data: goals } = await supabase
    .from('saving_goals')
    .select('*')
    .eq('household_id', householdId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return NextResponse.json({ goals: goals || [] });
}

export async function POST(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { householdId, name, description, emoji, targetAmount, targetDate, items } = await request.json();

  if (!householdId || !name) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const itemsArray = Array.isArray(items) ? items : [];
  const itemsTotal = itemsArray.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0);
  const finalTarget = itemsTotal > 0 ? itemsTotal : Number(targetAmount) || 0;

  const { data: goal, error } = await supabase
    .from('saving_goals')
    .insert({
      household_id: householdId,
      name,
      description: description || '',
      emoji: emoji || '🎯',
      target_amount: finalTarget,
      target_date: targetDate || null,
    })
    .select()
    .single();

  if (error || !goal) {
    return NextResponse.json({ error: 'Error al crear la meta' }, { status: 500 });
  }

  if (itemsArray.length > 0) {
    await supabase.from('saving_goal_items').insert(
      itemsArray.map((item: { name: string; amount: number }) => ({
        goal_id: goal.id,
        name: item.name,
        amount: Number(item.amount),
      }))
    );
  }

  return NextResponse.json({ goal });
}
