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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: goal } = await supabase
    .from('saving_goals')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!goal) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });

  const [{ data: items }, { data: contributions }] = await Promise.all([
    supabase.from('saving_goal_items').select('*').eq('goal_id', params.id).order('created_at'),
    supabase
      .from('saving_goal_contributions')
      .select('*')
      .eq('goal_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({ goal, items: items || [], contributions: contributions || [] });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  await supabase.from('saving_goals').delete().eq('id', params.id);

  return NextResponse.json({ success: true });
}
