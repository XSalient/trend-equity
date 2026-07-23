import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Stripe } from 'stripe';
import { getAdminDb, getAdminAuth } from '../_lib/admin';
import { getRawBody } from './_lib/body-parser';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-06-24.dahlia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const body = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Verify Stripe signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Extract user info from metadata
      const uid = session.metadata?.uid;
      const tier = session.metadata?.tier as 'pro' | 'builder';

      if (!uid || !tier) {
        console.error('Missing metadata in session:', session.id);
        return res.status(400).json({ error: 'Missing metadata' });
      }

      if (!['pro', 'builder'].includes(tier)) {
        console.error('Invalid tier in metadata:', tier);
        return res.status(400).json({ error: 'Invalid tier' });
      }

      // Atomic Firestore transaction: update tier + proEndDate
      const db = getAdminDb();
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await transaction.get(userRef);

        // Double-check user exists
        if (!userSnap.exists) {
          throw new Error(`User ${uid} not found`);
        }

        // Calculate proEndDate (30 days from now)
        const proEndDate = new Date();
        proEndDate.setDate(proEndDate.getDate() + 30);

        // Update user tier + proEndDate + stripe customer ID
        transaction.update(userRef, {
          tier,
          proEndDate: proEndDate,
          stripeCustomerId: session.customer as string,
          stripeSessionId: session.id,
          updatedAt: new Date(),
        });

        // Log the transaction for audit trail (optional)
        const auditRef = db.collection('stripe_transactions').doc(`${uid}_${Date.now()}`);
        transaction.set(auditRef, {
          uid,
          tier,
          stripeSessionId: session.id,
          amount: session.amount_total,
          currency: session.currency,
          completedAt: new Date(),
        });
      });

      console.log(`✓ Upgraded user ${uid} to ${tier} tier`);
      return res.status(200).json({ received: true });
    }

    // Handle subscription renewal (charge.succeeded)
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge;
      const uid = charge.metadata?.uid;

      if (uid) {
        // Extend proEndDate by 30 days
        const db = getAdminDb();
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const currentEndDate = userSnap.data()?.proEndDate?.toDate() || new Date();
          const newEndDate = new Date(currentEndDate);
          newEndDate.setDate(newEndDate.getDate() + 30);

          await userRef.update({
            proEndDate: newEndDate,
            updatedAt: new Date(),
          });

          console.log(`✓ Renewed subscription for user ${uid}`);
        }
      }
    }

    // Handle customer.subscription.deleted (cancellation)
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const uid = subscription.metadata?.uid;

      if (uid) {
        // Downgrade to free
        const db = getAdminDb();
        await db.collection('users').doc(uid).update({
          tier: 'free',
          proEndDate: null,
          updatedAt: new Date(),
        });

        console.log(`✓ Downgraded user ${uid} to free tier (subscription cancelled)`);
      }
    }

    // Silently accept other events
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
