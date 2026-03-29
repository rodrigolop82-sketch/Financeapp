import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

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

  // Expire any existing active invites for this household
  await supabase
    .from('household_invites')
    .update({ status: 'expired' })
    .eq('household_id', householdId)
    .eq('status', 'active');

  // Generate a short, shareable code (8 chars, URL-safe)
  const inviteCode = randomBytes(6).toString('base64url').substring(0, 8);

  const { data: invite, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      invite_code: inviteCode,
      created_by: user.id,
      status: 'active',
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
export async function PUT(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { code } = await request.json();

  // Validate invite
  const { data: invite } = await supabase
    .from('household_invites')
    .select('id, household_id, status, expires_at')
    .eq('invite_code', code)
    .eq('status', 'active')
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invitación no encontrada o expirada' }, { status: 404 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from('household_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 410 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', invite.household_id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Ya eres miembro de este hogar', alreadyMember: true }, { status: 409 });
  }

  // Check if user owns a different household — if so, they can still join as member
  // Add user as member
  const { error } = await supabase
    .from('household_members')
    .insert({
      household_id: invite.household_id,
      user_id: user.id,
      role: 'member',
    });

  if (error) {
    return NextResponse.json({ error: 'Error al unirse al hogar' }, { status: 500 });
  }

  return NextResponse.json({ success: true, householdId: invite.household_id });
}
