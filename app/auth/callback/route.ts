import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If coming from an invite link, go directly to invite page (skip onboarding check)
      if (next.startsWith('/invite/')) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Check if user has completed onboarding (has a household)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: households } = await supabase
          .from('households')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1);

        // Also check if user is a member of any household
        const { data: memberships } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .limit(1);

        // New user without household -> go to onboarding
        if ((!households || households.length === 0) && (!memberships || memberships.length === 0)) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
