import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Stripe } from 'stripe';
import { getAuthContext } from './_lib/auth';

/**
 * STRIPE SETUP GUIDE (TE-08)
 *
 * Before deploying, configure Stripe prices:
 *
 * 1. Create Products in Stripe Dashboard (https://dashboard.stripe.com/products)
 *    - Product 1: Name "Pro", Monthly price $9 USD, recurring
 *    - Product 2: Name "Builder", Monthly price $19 USD, recurring
 *    - Copy the Price IDs (format: price_1xxx...xxx)
 *
 * 2. Set environment variables:
 *    STRIPE_SECRET_KEY=sk_test_...           (test key, replace with live key in prod)
 *    STRIPE_PRICE_PRO=price_1xxx...xxx       (Pro monthly price ID)
 *    STRIPE_PRICE_BUILDER=price_1yyy...yyy   (Builder monthly price ID)
 *
 * 3. Register Webhook in Stripe Dashboard:
 *    - Settings → Webhooks → Add endpoint
 *    - Endpoint URL: https://your-domain.vercel.app/api/webhook/stripe
 *    - Events: checkout.session.completed, charge.succeeded, customer.subscription.deleted
 *    - Copy the Signing Secret
 *    - Set STRIPE_WEBHOOK_SECRET environment variable
 *
 * 4. Test locally:
 *    - Use test keys (pk_test_... and sk_test_...)
 *    - Use Stripe test card: 4242 4242 4242 4242 (any exp/CVC)
 *    - Stripe CLI can forward webhooks: stripe listen --forward-to localhost:3001/api/webhook/stripe
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-06-24.dahlia',
});

const STRIPE_PRICES: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly_placeholder',
  builder: process.env.STRIPE_PRICE_BUILDER || 'price_builder_monthly_placeholder',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authCtx = await getAuthContext(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier } = req.body;

    if (!tier || !['pro', 'builder'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    // Validate Stripe configuration
    const priceId = STRIPE_PRICES[tier as 'pro' | 'builder'];
    if (priceId.includes('placeholder')) {
      console.error(
        'CRITICAL: Stripe price IDs not configured. Set STRIPE_PRICE_PRO and STRIPE_PRICE_BUILDER env vars.'
      );
      return res.status(500).json({
        error: 'Payment system not configured. Contact support.',
        debug: 'Missing Stripe price IDs - STRIPE_PRICE_PRO or STRIPE_PRICE_BUILDER not set',
      });
    }

    // If user is already on a higher or equal tier, reject
    const tierRank: Record<string, number> = { free: 0, pro: 1, builder: 2 };
    if (tierRank[authCtx.tier] >= tierRank[tier as string]) {
      return res.status(400).json({ error: 'User already has this tier or higher' });
    }

    // Create Stripe checkout session
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}?checkout=success&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?tab=pro`,
      customer_email: authCtx.uid, // Use uid as customer identifier
      metadata: {
        uid: authCtx.uid,
        tier,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Return more detailed error info in development
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
      return res.status(500).json({
        error: 'Failed to create checkout session',
        details: errorMessage,
      });
    }

    // Check for specific Stripe errors
    if (errorMessage.includes('No such price')) {
      return res.status(500).json({
        error: 'Payment configuration error. Invalid price ID configured.',
      });
    }

    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
