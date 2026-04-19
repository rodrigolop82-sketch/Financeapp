import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

function createUserSupabase() {
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

// Service role client — bypasses RLS for invite operations
function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST: generate a new invite link (owner only)
export async function POST(request: Request) {
  const supabase = createUserSupabase();
  const admin = createAdminSupabase();
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

  // Expire existing active invites
  await admin
    .from('household_invites')
    .update({ status: 'expired' })
    .eq('household_id', householdId)
    .eq('status', 'active');

  const inviteCode = randomBytes(6).toString('base64url').substring(0, 8);

  const { data: invite, error } = await admin
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

// GET: validate an invite code and return household info (public — anyone with the code)
export async function GET(request: Request) {
  const admin = createAdminSupabase();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
  }

  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, invite_code, status, expires_at, created_by')
    .eq('invite_code', code)
    .eq('status', 'active')
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invitación no encontrada o expirada' }, { status: 404 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await admin
      .from('household_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 410 });
  }

  const { data: household } = await admin
    .from('households')
    .select('id, name, owner_id')
    .eq('id', invite.household_id)
    .single();

  const { data: owner } = await admin
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

// PUT: accept an invite (authenticated user joins the household)
export async function PUT(request: Request) {
  const supabase = createUserSupabase();
  const admin = createAdminSupabase();

  // Identify who is accepting
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { code } = await request.json();

  // Validate invite using admin client (bypasses RLS)
  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, status, expires_at')
    .eq('invite_code', code)
    .eq('status', 'active')
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invitación no encontrada o expirada' }, { status: 404 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await admin
      .from('household_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 410 });
  }

  // Check if already a member
  const { data: existing } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', invite.household_id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Ya eres miembro de este hogar', alreadyMember: true }, { status: 409 });
  }

  // Insert member using admin client (bypasses RLS)
  const { error } = await admin
    .from('household_members')
    .insert({
      household_id: invite.household_id,
      user_id: user.id,
      role: 'member',
    });

  if (error) {
    console.error('household_members insert error:', error);
    return NextResponse.json({ error: 'Error al unirse al hogar' }, { status: 500 });
  }

  return NextResponse.json({ success: true, householdId: invite.household_id });
}
