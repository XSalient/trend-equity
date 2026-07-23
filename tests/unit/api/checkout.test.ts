import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../../api/checkout';

// Mock dependencies
vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('stripe', () => ({
  Stripe: vi.fn(),
}));

import { getAuthContext } from '../../../api/_lib/auth';
import { Stripe } from 'stripe';

describe('POST /api/checkout', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockStripeInstance: any;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer token123' },
      body: { tier: 'pro' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Reset mocks
    vi.clearAllMocks();

    // Mock Stripe instance
    mockStripeInstance = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/pay/cs_test_123',
            client_secret: 'cs_test_123_secret',
          }),
        },
      },
    };

    (Stripe as any).mockImplementation(() => mockStripeInstance);
  });

  it('rejects non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 401 for unauthenticated requests', async () => {
    (getAuthContext as any).mockResolvedValue(null);
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid tier', async () => {
    (getAuthContext as any).mockResolvedValue({ uid: 'user123', tier: 'free', isAdmin: false });
    mockReq.body = { tier: 'invalid' };
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid tier' });
  });

  it('rejects if user already has this tier or higher', async () => {
    (getAuthContext as any).mockResolvedValue({ uid: 'user123', tier: 'pro', isAdmin: false });
    mockReq.body = { tier: 'pro' };
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'User already has this tier or higher',
    });
  });

  it('creates a checkout session for free user upgrading to pro', async () => {
    (getAuthContext as any).mockResolvedValue({ uid: 'user123', tier: 'free', isAdmin: false });
    mockReq.body = { tier: 'pro' };

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: { uid: 'user123', tier: 'pro' },
      })
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });
  });

  it('creates a checkout session for free user upgrading to builder', async () => {
    (getAuthContext as any).mockResolvedValue({ uid: 'user456', tier: 'free', isAdmin: false });
    mockReq.body = { tier: 'builder' };

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: { uid: 'user456', tier: 'builder' },
      })
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('handles Stripe errors gracefully', async () => {
    (getAuthContext as any).mockResolvedValue({ uid: 'user123', tier: 'free', isAdmin: false });
    mockReq.body = { tier: 'pro' };

    mockStripeInstance.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'));

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Failed to create checkout session',
    });
  });
});
