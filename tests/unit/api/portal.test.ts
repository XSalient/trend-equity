import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../../api/_lib/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../../api/_lib/stripe')>(
    '../../../api/_lib/stripe'
  );
  return {
    StripeConfigError: actual.StripeConfigError,
    getStripe: vi.fn(),
    getAppUrl: vi.fn(() => 'https://trend-equity.vercel.app'),
    getPriceId: vi.fn((tier: string) =>
      tier === 'builder' ? 'price_builder_live' : 'price_pro_live'
    ),
  };
});

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import handler from '../../../api/portal';
import { getAuthContext } from '../../../api/_lib/auth';
import { getStripe, StripeConfigError } from '../../../api/_lib/stripe';
import { getAdminDb } from '../../../api/_lib/admin';

describe('POST /api/portal', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let stripeClient: any;

  const authedPro = { uid: 'user123', tier: 'pro', isAdmin: false };

  const mockUserDoc = (data: Record<string, unknown> | undefined) => {
    (getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: !!data, data: () => data }),
        })),
      })),
    });
  };

  /** A live single-item subscription — the shape every paid↔paid switch needs. */
  const liveSubscription = {
    id: 'sub_123',
    status: 'active',
    items: { data: [{ id: 'si_123' }] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { method: 'POST', headers: { authorization: 'Bearer token123' }, body: {} };
    mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    stripeClient = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' }),
        },
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue(liveSubscription),
      },
    };
    (getStripe as any).mockReturnValue(stripeClient);
    (getAuthContext as any).mockResolvedValue(authedPro);
    mockUserDoc({ stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123' });
  });

  /** The `flow_data` the handler passed to Stripe, or undefined for the homepage. */
  const flowData = () => stripeClient.billingPortal.sessions.create.mock.calls[0][0].flow_data;

  it('rejects non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 for unauthenticated requests', async () => {
    (getAuthContext as any).mockResolvedValue(null);
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when the user has no Stripe customer', async () => {
    mockUserDoc({ tier: 'free' });
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('creates a portal session for the stored customer and returns its url', async () => {
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(stripeClient.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://trend-equity.vercel.app/?tab=pro',
    });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ url: 'https://billing.stripe.com/p/session_123' });
  });

  it('returns 503 when Stripe is not configured', async () => {
    (getStripe as any).mockImplementation(() => {
      throw new StripeConfigError('STRIPE_SECRET_KEY is missing');
    });
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(503);
  });

  /**
   * TE-47. Before this, the handler took no target at all and every press
   * landed on the portal homepage — the assertion above passed the whole time.
   */
  describe('targetTier deep links (TE-47)', () => {
    it('opens the prorated confirm flow for a pro → builder upgrade', async () => {
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(flowData()).toEqual({
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: 'sub_123',
          items: [{ id: 'si_123', price: 'price_builder_live', quantity: 1 }],
        },
        after_completion: {
          type: 'redirect',
          redirect: { return_url: 'https://trend-equity.vercel.app/?tab=pro' },
        },
      });
    });

    it('uses the same confirm flow for a builder → pro downgrade', async () => {
      // Deferral to the period end is the portal configuration's job
      // (schedule_at_period_end), not something the session can request.
      (getAuthContext as any).mockResolvedValue({ ...authedPro, tier: 'builder' });
      mockReq.body = { targetTier: 'pro' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(flowData().type).toBe('subscription_update_confirm');
      expect(flowData().subscription_update_confirm.items[0].price).toBe('price_pro_live');
    });

    it('opens the cancel flow when the target is free', async () => {
      mockReq.body = { targetTier: 'free' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(flowData()).toMatchObject({
        type: 'subscription_cancel',
        subscription_cancel: { subscription: 'sub_123' },
      });
      // A cancel needs no item re-pricing.
      expect(stripeClient.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('ignores a target equal to the tier the server already has', async () => {
      mockReq.body = { targetTier: 'pro' }; // authCtx.tier is 'pro'
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
    });

    it('never trusts the body for the tier — the flow follows the server tier', async () => {
      // A builder hint from a free-tier caller must not produce an upgrade
      // flow priced off the request. (The tier itself is still only ever
      // written by the webhook.)
      (getAuthContext as any).mockResolvedValue({ ...authedPro, tier: 'builder' });
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
    });

    it('rejects a malformed target rather than passing it to Stripe', async () => {
      mockReq.body = { targetTier: 'enterprise' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('falls back to the portal homepage when the user has no subscription id', async () => {
      mockUserDoc({ stripeCustomerId: 'cus_123' });
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('falls back to the portal homepage when the subscription lookup fails', async () => {
      stripeClient.subscriptions.retrieve.mockRejectedValue(new Error('No such subscription'));
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('refuses to guess which line to re-price on a multi-item subscription', async () => {
      stripeClient.subscriptions.retrieve.mockResolvedValue({
        ...liveSubscription,
        items: { data: [{ id: 'si_1' }, { id: 'si_2' }] },
      });
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
    });

    it('does not open an update flow on a cancelled subscription', async () => {
      stripeClient.subscriptions.retrieve.mockResolvedValue({
        ...liveSubscription,
        status: 'canceled',
      });
      mockReq.body = { targetTier: 'builder' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(flowData()).toBeUndefined();
    });
  });
});
