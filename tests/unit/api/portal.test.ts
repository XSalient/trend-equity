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
    syncSubscriptionToUser: vi.fn().mockResolvedValue('builder'),
  };
});

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import handler from '../../../api/portal';
import { getAuthContext } from '../../../api/_lib/auth';
import { getStripe, StripeConfigError, syncSubscriptionToUser } from '../../../api/_lib/stripe';
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

  /**
   * A live single-item subscription — the shape every paid↔paid switch needs.
   * TE-60: the item carries its **price**, because that is what Stripe prices
   * the flow against. The priceless fixture let every assertion below pass
   * while production was refusing the same flow for a price it could see and
   * the test could not.
   */
  const liveSubscription = {
    id: 'sub_123',
    status: 'active',
    items: { data: [{ id: 'si_123', price: { id: 'price_pro_live' } }] },
  };

  /** The same subscription after a switch to Builder. */
  const builderSubscription = {
    ...liveSubscription,
    items: { data: [{ id: 'si_123', price: { id: 'price_builder_live' } }] },
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
      stripeClient.subscriptions.retrieve.mockResolvedValue(builderSubscription);
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

    /**
     * TE-48. Every assertion above inspects what we *sent*; Stripe was mocked
     * to accept all of it. Production rejected the upgrade flow outright
     * because the portal configuration had `subscription_update` disabled, and
     * the whole suite stayed green through it.
     */
    describe('when Stripe refuses the flow (TE-48)', () => {
      /** The real rejection, verbatim, from a portal config that was never configured. */
      const configDisabled = () =>
        Object.assign(
          new Error(
            'This subscription cannot be updated because the subscription update feature in the portal configuration is disabled.'
          ),
          { type: 'StripeInvalidRequestError' }
        );

      it('reports a refused upgrade as a configuration fault, not a generic failure', async () => {
        stripeClient.billingPortal.sessions.create.mockRejectedValue(configDisabled());
        mockReq.body = { targetTier: 'builder' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(mockRes.status).toHaveBeenCalledWith(503);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Plan changes are temporarily unavailable. Please contact support.',
        });
      });

      it('applies the same handling to a refused cancel flow', async () => {
        stripeClient.billingPortal.sessions.create.mockRejectedValue(configDisabled());
        mockReq.body = { targetTier: 'free' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(mockRes.status).toHaveBeenCalledWith(503);
      });

      it('never silently retries as a bare session — the homepage cannot switch plans either', async () => {
        stripeClient.billingPortal.sessions.create.mockRejectedValue(configDisabled());
        mockReq.body = { targetTier: 'builder' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(stripeClient.billingPortal.sessions.create).toHaveBeenCalledTimes(1);
      });

      it('leaves a plain "Manage billing" failure as a generic 500', async () => {
        // No flow_data was sent, so the deep link cannot be what broke.
        stripeClient.billingPortal.sessions.create.mockRejectedValue(configDisabled());
        mockReq.body = {};
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to open the billing portal' });
      });

      /**
       * TE-60: the 503 is right for any refused flow, but the *log* is the
       * operator's only lead. Pointing every rejection at
       * `stripe:configure-portal` sent the next investigation to re-run a
       * script that was already correct.
       */
      it('names configure-portal only when Stripe blamed the portal configuration', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        stripeClient.billingPortal.sessions.create.mockRejectedValue(configDisabled());
        mockReq.body = { targetTier: 'builder' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(logged.mock.calls[0][0]).toContain('stripe:configure-portal');
        logged.mockRestore();
      });

      it('does not blame the configuration for a rejection about something else', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        stripeClient.billingPortal.sessions.create.mockRejectedValue(
          Object.assign(new Error('No such subscription item: si_123'), {
            type: 'StripeInvalidRequestError',
          })
        );
        mockReq.body = { targetTier: 'builder' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(logged.mock.calls[0][0]).not.toContain('stripe:configure-portal');
        expect(logged.mock.calls[0][0]).toContain('No such subscription item');
        logged.mockRestore();
      });

      it('does not mistake a transient Stripe outage for a misconfiguration', async () => {
        stripeClient.billingPortal.sessions.create.mockRejectedValue(
          Object.assign(new Error('Connection to Stripe timed out'), {
            type: 'StripeConnectionError',
          })
        );
        mockReq.body = { targetTier: 'builder' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);

        expect(mockRes.status).toHaveBeenCalledWith(500);
      });
    });

    /**
     * TE-60. The production failure the TE-48 handling misreported:
     *
     *   Cannot update the subscription `sub_…` because there are no changes to
     *   confirm. Provide a different `price` or `quantity`.
     *
     * The flow is priced off the Firestore tier; Stripe validates it against
     * the subscription item. When the user doc is stale — a portal switch whose
     * `customer.subscription.updated` never landed — the two disagree and every
     * press of UPGRADE NOW builds a no-op flow Stripe refuses. The fixture that
     * carried no price could not express this, so the suite stayed green.
     */
    describe('when Firestore and Stripe disagree about the plan (TE-60)', () => {
      beforeEach(() => {
        // Stored as pro (authedPro); Stripe already has them on Builder.
        stripeClient.subscriptions.retrieve.mockResolvedValue(builderSubscription);
        mockReq.body = { targetTier: 'builder' };
      });

      it('never sends a flow Stripe can only refuse', async () => {
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);
        expect(stripeClient.billingPortal.sessions.create).not.toHaveBeenCalled();
      });

      it('reconciles the user doc from the live subscription', async () => {
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);
        expect(syncSubscriptionToUser).toHaveBeenCalledWith(
          stripeClient,
          'user123',
          builderSubscription
        );
      });

      it('tells the caller the plan is already active, not that billing broke', async () => {
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);
        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'You are already on Builder. Your account has been refreshed.',
          reconciledTier: 'builder',
        });
      });

      it('still opens a normal upgrade flow when the prices really do differ', async () => {
        stripeClient.subscriptions.retrieve.mockResolvedValue(liveSubscription);
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);
        expect(syncSubscriptionToUser).not.toHaveBeenCalled();
        expect(flowData().subscription_update_confirm.items[0].price).toBe('price_builder_live');
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('leaves the cancel flow alone — a cancel changes no price', async () => {
        mockReq.body = { targetTier: 'free' };
        await handler(mockReq as VercelRequest, mockRes as VercelResponse);
        expect(flowData().type).toBe('subscription_cancel');
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
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
