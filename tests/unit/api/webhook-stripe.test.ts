import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../../api/_lib/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../../api/_lib/stripe')>(
    '../../../api/_lib/stripe'
  );
  return {
    StripeConfigError: actual.StripeConfigError,
    getPeriodEnd: actual.getPeriodEnd,
    tierForPriceId: actual.tierForPriceId,
    getStripe: vi.fn(),
    provisionSubscription: vi.fn(),
    extendSubscription: vi.fn(),
    downgradeToFree: vi.fn(),
    resolveUid: vi.fn(),
    // TE-60: the price → tier mapping, the schedule read and the doc write all
    // live behind this one call now (shared with api/portal.ts). What lands in
    // the user doc is asserted against a real Firestore mock in
    // stripe-lib.test.ts; the webhook's own job is resolving the uid and
    // handing the subscription over.
    syncSubscriptionToUser: vi.fn().mockResolvedValue('builder'),
  };
});

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import handler, { config } from '../../../api/webhook/stripe';
import { getAdminDb } from '../../../api/_lib/admin';
import {
  getStripe,
  provisionSubscription,
  extendSubscription,
  downgradeToFree,
  resolveUid,
  syncSubscriptionToUser,
} from '../../../api/_lib/stripe';

describe('POST /api/webhook/stripe', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let stripeClient: any;

  const rawBody = Buffer.from(JSON.stringify({ id: 'evt_1' }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_testsecret';

    mockReq = {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature' },
      // Mirrors express.raw() / bodyParser:false — raw bytes are on req.body.
      body: rawBody,
    } as Partial<VercelRequest>;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    stripeClient = {
      webhooks: { constructEvent: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
    };

    (getStripe as any).mockReturnValue(stripeClient);

    // Default Firestore stub so the handlers that touch it don't explode.
    (getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'ref' })) })),
      runTransaction: vi.fn(async (fn: any) =>
        fn({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() })
      ),
    });
  });

  // Regression: Vercel parses bodies by default, which destroys the signed bytes.
  it('disables the platform body parser', () => {
    expect(config).toEqual({ api: { bodyParser: false } });
  });

  it('rejects non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when the signature header is missing', async () => {
    mockReq.headers = {};
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing signature' });
  });

  it('returns 503 when the webhook secret is not configured', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = '';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(503);
  });

  it('returns 400 for an invalid signature', async () => {
    stripeClient.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('verifies the signature against the exact raw bytes', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(stripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
      rawBody,
      'test-signature',
      'whsec_testsecret'
    );
  });

  it('provisions the tier on checkout.session.completed', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
          metadata: { uid: 'user123', tier: 'pro' },
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          amount_total: 900,
          currency: 'usd',
        },
      },
    });
    (provisionSubscription as any).mockResolvedValue({ tier: 'pro', applied: true });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(provisionSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user123', tier: 'pro', sessionId: 'cs_test_123' })
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });

  it('acks without retrying when session metadata is missing', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_456', payment_status: 'paid', metadata: {} } },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(provisionSubscription).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  // Regression: renewals used charge.metadata.uid, which is never populated.
  it('resolves the uid from the subscription on invoice.payment_succeeded', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_1',
          subscription: 'sub_test_123',
          customer: 'cus_test_123',
          amount_paid: 900,
          currency: 'usd',
        },
      },
    });
    (resolveUid as any).mockResolvedValue('user123');
    stripeClient.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1800000000 }] },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(resolveUid).toHaveBeenCalledWith(
      stripeClient,
      expect.objectContaining({ subscriptionId: 'sub_test_123', customerId: 'cus_test_123' })
    );
    // TE-42: renewal writes carry the invoice id (audit-row idempotency key).
    expect(extendSubscription).toHaveBeenCalledWith({
      uid: 'user123',
      currentPeriodEnd: 1800000000,
      invoiceId: 'in_1',
      amountPaid: 900,
      currency: 'usd',
      subscriptionId: 'sub_test_123',
    });
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  // TE-42: purchases record Stripe's real billing anchor, not "now + 30 days".
  it('provisions checkout.session.completed with the real current_period_end', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_period',
          payment_status: 'paid',
          metadata: { uid: 'user123', tier: 'pro' },
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          amount_total: 900,
          currency: 'usd',
        },
      },
    });
    stripeClient.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1800000000 }] },
    });
    (provisionSubscription as any).mockResolvedValue({ tier: 'pro', applied: true });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(stripeClient.subscriptions.retrieve).toHaveBeenCalledWith('sub_test_123');
    expect(provisionSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ currentPeriodEnd: 1800000000 })
    );
  });

  it('still provisions when the period-end lookup fails', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_perr',
          payment_status: 'paid',
          metadata: { uid: 'user123', tier: 'pro' },
          subscription: 'sub_test_123',
        },
      },
    });
    stripeClient.subscriptions.retrieve.mockRejectedValue(new Error('Stripe down'));
    (provisionSubscription as any).mockResolvedValue({ tier: 'pro', applied: true });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(provisionSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ currentPeriodEnd: null })
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('downgrades to free on customer.subscription.deleted', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_test_123', metadata: { uid: 'user123' } } },
    });
    (resolveUid as any).mockResolvedValue('user123');

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(downgradeToFree).toHaveBeenCalledWith('user123');
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('mirrors subscription.updated onto the user doc (plan switch + cancel flag)', async () => {
    (resolveUid as any).mockResolvedValue('user123');
    const subscription = {
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: true,
      metadata: { uid: 'user123' },
      items: { data: [{ price: { id: 'price_builder_456' }, current_period_end: 1799999999 }] },
    };
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: subscription },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(syncSubscriptionToUser).toHaveBeenCalledWith(stripeClient, 'user123', subscription);
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('acks subscription.updated without writing when the uid cannot be resolved', async () => {
    (resolveUid as any).mockResolvedValue(null);
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_123', status: 'active', metadata: {}, items: { data: [] } },
      },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(syncSubscriptionToUser).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('acks invoice.payment_failed and marks the user past_due with an alert', async () => {
    (resolveUid as any).mockResolvedValue('user123');
    const txSet = vi.fn();
    const txGet = vi.fn().mockResolvedValue({ exists: false });
    (getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'ref' })) })),
      runTransaction: vi.fn(async (fn: any) => fn({ get: txGet, set: txSet })),
    });
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(txSet).toHaveBeenCalledTimes(2); // user doc + alert doc
    const userPayload = txSet.mock.calls[0][1];
    expect(userPayload).toMatchObject({ subscriptionStatus: 'past_due' });
    // Dunning must never drop the tier — Stripe retries may still recover it.
    expect(userPayload).not.toHaveProperty('tier');
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  // Stripe retries dunning invoices; the alert doc id embeds the invoice id so
  // the user isn't spammed with one alert per retry.
  it('does not restack the alert when the same failed invoice replays', async () => {
    (resolveUid as any).mockResolvedValue('user123');
    const txSet = vi.fn();
    (getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'ref' })) })),
      runTransaction: vi.fn(async (fn: any) =>
        fn({ get: vi.fn().mockResolvedValue({ exists: true }), set: txSet })
      ),
    });
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(txSet).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('acks unhandled event types', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      received: true,
      ignored: 'payment_intent.created',
    });
  });

  it('returns 500 so Stripe retries when provisioning fails transiently', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_789',
          payment_status: 'paid',
          metadata: { uid: 'user123', tier: 'pro' },
        },
      },
    });
    (provisionSubscription as any).mockRejectedValue(new Error('Firestore unavailable'));

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
