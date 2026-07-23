import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../../api/webhook/stripe';

// Mock dependencies
vi.mock('stripe', () => ({
  Stripe: vi.fn(),
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import { Stripe } from 'stripe';
import { getAdminDb } from '../../../api/_lib/admin';

describe('POST /api/webhook/stripe', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockStripeInstance: any;
  let mockDb: any;
  let mockTransaction: any;

  beforeEach(() => {
    // Mock transaction methods
    mockTransaction = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    };

    mockDb = {
      runTransaction: vi.fn().mockImplementation((fn) => fn(mockTransaction)),
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({}),
      }),
    };

    mockReq = {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature' },
      on: vi.fn(),
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockStripeInstance = {
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    (Stripe as any).mockImplementation(() => mockStripeInstance);
    (getAdminDb as any).mockReturnValue(mockDb);

    vi.clearAllMocks();
  });

  it('rejects non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 for missing signature', async () => {
    mockReq.headers = {};
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing signature' });
  });

  it('returns 400 for invalid Stripe signature', async () => {
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    // Mock request event emitter
    let onDataCallback: any;
    (mockReq.on as any) = vi.fn((event, callback) => {
      if (event === 'data') {
        onDataCallback = callback;
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('processes checkout.session.completed event', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: { uid: 'user123', tier: 'pro' },
          customer: 'cus_test_123',
        },
      },
    };

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    // Mock request event emitter
    (mockReq.on as any) = vi.fn((event, callback) => {
      if (event === 'data') {
        // Do nothing, we'll manually call end
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      if (event === 'error') {
        // Do nothing
      }
    });

    mockTransaction.get.mockResolvedValue({ exists: true, data: () => ({}) });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockDb.runTransaction).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });

  it('silently accepts unhandled events', async () => {
    const mockEvent = {
      type: 'payment.intent.created',
      data: { object: {} },
    };

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    (mockReq.on as any) = vi.fn((event, callback) => {
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });
});
