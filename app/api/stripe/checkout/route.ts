import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe, PLANS, TRIAL_DAYS } from '@/lib/stripe';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { plan } = await request.json();
  const planConfig = plan === 'annual' ? PLANS.annual : PLANS.monthly;

  const session = await stripe.checkout.sessions.create({
    customer_email: user.email!,
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { user_id: user.id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/cuenta?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cuenta?cancelled=true`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
