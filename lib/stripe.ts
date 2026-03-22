import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Keep backward compat - lazy getter
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  monthly: {
    name: 'Mensual',
    price: 4.99,
    currency: 'USD',
    interval: 'month' as const,
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
  },
  annual: {
    name: 'Anual',
    price: 39.99,
    currency: 'USD',
    interval: 'year' as const,
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID || '',
    savings: '33%',
  },
};

export const TRIAL_DAYS = 14;
