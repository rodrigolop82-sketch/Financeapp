import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getEffectivePlan, hasSeatFor, memberAccessFor } from '@/lib/plans';
import { guestHousehold, loadInvite } from '@/lib/unir-server';
import { mergeErrorText } from '@/lib/unir';
import { firstName } from '@/lib/hogar';

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

// POST: generate a new invite link
export async function POST(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { householdId } = await request.json();

  // Verify caller is the owner
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single();

  if (!household || household.owner_id !== user.id) {
    return NextResponse.json({ error: 'Solo el dueño puede generar invitaciones' }, { status: 403 });
  }

  // Cualquier plan invita: el acceso (completo o solo ver) se decide al aceptar.
  // Expire any existing active invites for this household
  await supabase
    .from('household_invites')
    .update({ status: 'expired' })
    .eq('household_id', householdId)
    .eq('status', 'active');

  // Generate a short, shareable code (8 chars, URL-safe)
  const inviteCode = randomBytes(6).toString('base64url').substring(0, 8);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invite, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      invite_code: inviteCode,
      created_by: user.id,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error al crear invitación' }, { status: 500 });
  }

  return NextResponse.json({ invite });
}

// GET: validate an invite code and return household info
export async function GET(request: Request) {
  const supabase = createSupabase();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from('household_invites')
    .select('id, household_id, invite_code, status, expires_at, created_by')
    .eq('invite_code', code)
    .eq('status', 'active')
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invitación no encontrada o expirada' }, { status: 404 });
  }

  // Check expiration
  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from('household_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 410 });
  }

  // Get household info
  const { data: household } = await supabase
    .from('households')
    .select('id, name, owner_id')
    .eq('id', invite.household_id)
    .single();

  // Get owner name
  const { data: owner } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', household?.owner_id)
    .single();

  return NextResponse.json({
    invite,
    household: { name: household?.name },
    owner: { name: owner?.full_name || owner?.email },
  });
}

// PUT: accept an invite (join the household)
// Un usuario tiene un solo hogar activo: si trae datos propios, primero pasa
// por "Unir dos cuentas" (/unir); si no, se une aquí con merge_households
// (que archiva su hogar vacío).
export async function PUT(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { code } = await request.json();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const inv = await loadInvite(admin, code);
  if (!inv) return NextResponse.json({ error: 'Invitación no encontrada o expirada' }, { status: 404 });

  const { data: existing } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', inv.household.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing || inv.household.owner_id === user.id) {
    return NextResponse.json({ error: 'Ya eres miembro de este hogar', alreadyMember: true }, { status: 409 });
  }

  // ¿Trae historia propia? Entonces se une con el flujo de 4 pasos.
  const own = await guestHousehold(admin, user.id);
  if (own) {
    const [{ count: txs }, { count: goals }, { count: debts }] = await Promise.all([
      admin.from('transactions').select('id', { count: 'exact', head: true }).eq('household_id', own),
      admin.from('financial_goals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      admin.from('debts').select('id', { count: 'exact', head: true }).eq('household_id', own),
    ]);
    if ((txs ?? 0) + (goals ?? 0) + (debts ?? 0) > 0) {
      return NextResponse.json({ needsMerge: true }, { status: 409 });
    }
  }

  const { data, error } = await supabase.rpc('merge_households', { p_invite_code: code, p_choices: {} });
  if (error) {
    // Sin la migración de unir cuentas: el alta de antes.
    if (error.code === 'PGRST202' || /merge_households/.test(error.message)) {
      const { count: others } = await admin
        .from('household_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('household_id', inv.household.id)
        .eq('role', 'member');
      if (!hasSeatFor(others ?? 0)) return NextResponse.json({ error: 'Este hogar ya tiene a sus 2 personas' }, { status: 409 });
      const ownerPlan = (await getEffectivePlan(inv.household.owner_id)).plan;
      const { error: insertError } = await supabase.from('household_members').insert({
        household_id: inv.household.id, user_id: user.id, role: 'member', access: memberAccessFor(ownerPlan),
      });
      if (insertError) return NextResponse.json({ error: 'Error al unirse al hogar' }, { status: 500 });
      return NextResponse.json({ success: true, householdId: inv.household.id });
    }
    const errCode = (error.message || '').match(/[a-z_]+/)?.[0] ?? 'unknown';
    const { data: owner } = await admin.from('users').select('full_name, email').eq('id', inv.household.owner_id).single();
    return NextResponse.json(
      { error: mergeErrorText(errCode, firstName(owner?.full_name, owner?.email)), code: errCode, alreadyMember: errCode === 'already_member' },
      { status: errCode === 'invite_invalid' ? 404 : 409 },
    );
  }

  return NextResponse.json({ success: true, householdId: inv.household.id, ...(data as Record<string, unknown>) });
}
