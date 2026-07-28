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
    getPriceId: vi.fn(),
    getAppUrl: vi.fn(() => 'https://trend-equity.vercel.app'),
    provisionSubscription: vi.fn(),
  };
});

import handler from '../../../api/checkout';
import { getAuthContext } from '../../../api/_lib/auth';
import {
  getStripe,
  getPriceId,
  provisionSubscription,
  StripeConfigError,
} from '../../../api/_lib/stripe';

describe('/api/checkout', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let stripeClient: any;

  const authedFree = { uid: 'user123', tier: 'free', isAdmin: false, email: 'buyer@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer token123' },
      body: { tier: 'pro' },
      query: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    stripeClient = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/pay/cs_test_123',
          }),
          retrieve: vi.fn(),
        },
      },
    };

    (getStripe as any).mockReturnValue(stripeClient);
    (getPriceId as any).mockReturnValue('price_1TwAlRIdBbgqt2Le0cZpHTeQ');
  });

  describe('POST — create session', () => {
    it('rejects unsupported methods', async () => {
      mockReq.method = 'DELETE';
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(405);
    });

    it('returns 401 for unauthenticated requests', async () => {
      (getAuthContext as any).mockResolvedValue(null);
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 for an invalid tier', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      mockReq.body = { tier: 'enterprise' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid tier' });
    });

    it('rejects if the user already has this tier or higher', async () => {
      (getAuthContext as any).mockResolvedValue({ ...authedFree, tier: 'pro' });
      mockReq.body = { tier: 'pro' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    // Regression: customer_email was previously set to the Firebase uid, which
    // Stripe rejects with "Invalid email address" — breaking every checkout.
    it('sends the verified email as customer_email, never the uid', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      const args = stripeClient.checkout.sessions.create.mock.calls[0][0];
      expect(args.customer_email).toBe('buyer@example.com');
      expect(args.customer_email).not.toBe('user123');
      expect(args.client_reference_id).toBe('user123');
    });

    it('omits customer_email when the token carries no email claim', async () => {
      (getAuthContext as any).mockResolvedValue({ ...authedFree, email: undefined });
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      const args = stripeClient.checkout.sessions.create.mock.calls[0][0];
      expect(args).not.toHaveProperty('customer_email');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    // Regression: renewal/cancellation events do not inherit session metadata.
    it('copies uid/tier onto the subscription metadata', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      const args = stripeClient.checkout.sessions.create.mock.calls[0][0];
      expect(args.subscription_data).toEqual({ metadata: { uid: 'user123', tier: 'pro' } });
      expect(args.metadata).toEqual({ uid: 'user123', tier: 'pro' });
      expect(args.mode).toBe('subscription');
    });

    it('returns the checkout URL', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });
    });

    it('returns 503 with an actionable message when Stripe is not configured', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      (getPriceId as any).mockImplementation(() => {
        throw new StripeConfigError('STRIPE_PRICE_PRO is missing or malformed');
      });

      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ debug: expect.stringContaining('STRIPE_PRICE_PRO') })
      );
    });

    it('handles Stripe API errors', async () => {
      (getAuthContext as any).mockResolvedValue(authedFree);
      stripeClient.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'));

      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET — verify session', () => {
    beforeEach(() => {
      mockReq.method = 'GET';
      mockReq.query = { session_id: 'cs_test_123' };
      (getAuthContext as any).mockResolvedValue(authedFree);
    });

    it('rejects a malformed session id', async () => {
      mockReq.query = { session_id: 'not-a-session' };
      await handler(mockReq as VercelRequest, mockRes as VercelResponse);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('refuses to provision a session belonging to another user', async () => {
      stripeClient.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_123',
        payment_status: 'paid',
        metadata: { uid: 'someone-else', tier: 'pro' },
      });

      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(provisionSubscription).not.toHaveBeenCalled();
    });

    it('does not provision an unpaid session', async () => {
      stripeClient.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_123',
        payment_status: 'unpaid',
        metadata: { uid: 'user123', tier: 'pro' },
      });

      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(provisionSubscription).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'unpaid', tier: 'free' });
    });

    it('provisions the tier for a paid session', async () => {
      stripeClient.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_123',
        payment_status: 'paid',
        metadata: { uid: 'user123', tier: 'pro' },
        customer: 'cus_test_1',
        subscription: 'sub_test_1',
        amount_total: 900,
        currency: 'usd',
      });
      (provisionSubscription as any).mockResolvedValue({ tier: 'pro', applied: true });

      await handler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(provisionSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user123',
          tier: 'pro',
          sessionId: 'cs_test_123',
          customerId: 'cus_test_1',
          subscriptionId: 'sub_test_1',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'paid', tier: 'pro', applied: true });
    });
  });
});
