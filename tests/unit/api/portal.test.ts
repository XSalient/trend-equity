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

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { method: 'POST', headers: { authorization: 'Bearer token123' } };
    mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    stripeClient = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' }),
        },
      },
    };
    (getStripe as any).mockReturnValue(stripeClient);
    (getAuthContext as any).mockResolvedValue(authedPro);
    mockUserDoc({ stripeCustomerId: 'cus_123' });
  });

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
});
