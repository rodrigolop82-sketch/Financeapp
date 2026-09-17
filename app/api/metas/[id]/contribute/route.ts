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

const MILESTONE_CHECKS = [
  { pct: 25, bonus: 50, label: '¡Primer cuarto completado! 🌿' },
  { pct: 50, bonus: 100, label: '¡A la mitad del camino! ⚡' },
  { pct: 75, bonus: 200, label: '¡Ya casi llegas! 🔥' },
  { pct: 100, bonus: 500, label: '🏆 ¡Meta lograda!' },
];

function calcPoints(amount: number, prevTotal: number, newTotal: number, target: number) {
  const basePoints = Math.max(1, Math.floor(amount / 10));
  let milestoneBonus = 0;
  const milestones: string[] = [];

  if (target > 0) {
    const prevPct = (prevTotal / target) * 100;
    const newPct = (newTotal / target) * 100;
    for (const m of MILESTONE_CHECKS) {
      if (prevPct < m.pct && newPct >= m.pct) {
        milestoneBonus += m.bonus;
        milestones.push(m.label);
      }
    }
  }

  return { basePoints, milestoneBonus, milestones, total: basePoints + milestoneBonus };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { amount, note } = await request.json();
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }

  const { data: goal } = await supabase
    .from('saving_goals')
    .select('id, target_amount, current_amount, total_points, status')
    .eq('id', params.id)
    .single();

  if (!goal) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
  if (goal.status === 'completed') {
    return NextResponse.json({ error: 'Esta meta ya fue completada' }, { status: 400 });
  }

  const prevTotal = Number(goal.current_amount);
  const newTotal = prevTotal + Number(amount);
  const target = Number(goal.target_amount);
  const points = calcPoints(Number(amount), prevTotal, newTotal, target);
  const newTotalPoints = Number(goal.total_points) + points.total;
  const newStatus = target > 0 && newTotal >= target ? 'completed' : goal.status;

  await supabase.from('saving_goal_contributions').insert({
    goal_id: params.id,
    user_id: user.id,
    amount: Number(amount),
    note: note || '',
    points_earned: points.total,
  });

  await supabase.from('saving_goals').update({
    current_amount: newTotal,
    total_points: newTotalPoints,
    status: newStatus,
  }).eq('id', params.id);

  return NextResponse.json({
    success: true,
    pointsEarned: points.total,
    basePoints: points.basePoints,
    milestoneBonus: points.milestoneBonus,
    milestones: points.milestones,
    newTotal,
    newTotalPoints,
    completed: newStatus === 'completed',
  });
}
