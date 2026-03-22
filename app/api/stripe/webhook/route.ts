import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId && session.subscription) {
        const subResponse = await stripe.subscriptions.retrieve(session.subscription as string);
        const sub = subResponse as unknown as Stripe.Subscription;
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: sub.id,
          plan: sub.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
          status: sub.status === 'trialing' ? 'trialing' : 'active',
          current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
        }, { onConflict: 'user_id' });

        await supabaseAdmin.from('users').update({ plan: 'premium' }).eq('id', userId);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subUpdated = event.data.object as unknown as Stripe.Subscription & { current_period_end: number };
      const userIdUpdated = subUpdated.metadata?.user_id;
      if (userIdUpdated) {
        const statusMap: Record<string, string> = {
          active: 'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
        };
        await supabaseAdmin.from('subscriptions').update({
          status: statusMap[subUpdated.status] || subUpdated.status,
          current_period_end: new Date(subUpdated.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', subUpdated.id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as unknown as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (userId) {
        await supabaseAdmin.from('subscriptions').update({ status: 'cancelled' })
          .eq('stripe_subscription_id', subscription.id);
        await supabaseAdmin.from('users').update({ plan: 'free' }).eq('id', userId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
