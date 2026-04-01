import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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

// GET: list household members + pending invites
export async function GET(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId requerido' }, { status: 400 });

  // Get household owner info
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single();

  // Get members from household_members
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at, users(email, display_name)')
    .eq('household_id', householdId);

  const memberList = members || [];

  // Ensure owner is included in the list
  if (household) {
    const ownerInList = memberList.some(m => m.user_id === household.owner_id);
    if (!ownerInList) {
      const { data: ownerProfile } = await adminClient
        .from('users')
        .select('email, full_name')
        .eq('id', household.owner_id)
        .single();

      if (ownerProfile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memberList.unshift({
          user_id: household.owner_id,
          role: 'owner',
          joined_at: '',
          users: { email: ownerProfile.email, display_name: ownerProfile.full_name },
        } as any);
      }
    }
  }

  // Get pending invites (active, not expired)
  const { data: invites } = await adminClient
    .from('household_invites')
    .select('id, invite_code, status, created_at, expires_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  // Classify invites
  const now = new Date();
  const pendingInvites = (invites || []).map(inv => {
    const expired = new Date(inv.expires_at) < now;
    const status = inv.status === 'active' && !expired ? 'pendiente' : 'expirada';
    return {
      id: inv.id,
      invite_code: inv.invite_code,
      status,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    };
  });

  return NextResponse.json({ members: memberList, invites: pendingInvites });
}

// POST: invite a member by email
export async function POST(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { householdId, email } = await request.json();

  // Verify caller is the owner
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single();

  if (!household || household.owner_id !== user.id) {
    return NextResponse.json({ error: 'Solo el dueño puede invitar miembros' }, { status: 403 });
  }

  // Find the user by email — use service role to bypass RLS on users table
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: targetUser } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: 'Usuario no encontrado. Debe registrarse primero.' }, { status: 404 });
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ error: 'No puedes invitarte a ti mismo' }, { status: 400 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', targetUser.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Este usuario ya es miembro del hogar' }, { status: 409 });
  }

  // Add member
  const { error } = await supabase
    .from('household_members')
    .insert({
      household_id: householdId,
      user_id: targetUser.id,
      role: 'member',
    });

  if (error) {
    return NextResponse.json({ error: 'Error al agregar miembro' }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: targetUser.id });
}

// DELETE: remove a member
export async function DELETE(request: Request) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { householdId, userId } = await request.json();

  // Verify caller is the owner
  const { data: household } = await supabase
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .single();

  if (!household || household.owner_id !== user.id) {
    return NextResponse.json({ error: 'Solo el dueño puede eliminar miembros' }, { status: 403 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }

  await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);

  return NextResponse.json({ success: true });
}
