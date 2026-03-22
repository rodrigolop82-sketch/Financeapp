import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

export const PLANS = {
  monthly: {
    name: 'Mensual',
    price: 4.99,
    currency: 'USD',
    interval: 'month' as const,
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
  },
  annual: {
    name: 'Anual',
    price: 39.99,
    currency: 'USD',
    interval: 'year' as const,
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID!,
    savings: '33%',
  },
};

export const TRIAL_DAYS = 14;
