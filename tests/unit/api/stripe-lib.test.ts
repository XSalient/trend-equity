import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import { getRawBody } from '../../../api/webhook/_lib/body-parser';

const ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_BUILDER',
  'APP_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const;

describe('api/_lib/stripe configuration guards', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  const load = () => import('../../../api/_lib/stripe');

  describe('getStripe', () => {
    it('throws StripeConfigError when the secret key is absent', async () => {
      const { getStripe, StripeConfigError } = await load();
      expect(() => getStripe()).toThrow(StripeConfigError);
    });

    // Regression: `.env` shipped the stub `sk_test_`, which built a client that
    // failed later with an opaque error instead of at configuration time.
    it('rejects the placeholder secret key `sk_test_`', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_';
      const { getStripe, StripeConfigError } = await load();
      expect(() => getStripe()).toThrow(StripeConfigError);
    });

    it('accepts a well-formed test key', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake123';
      const { getStripe } = await load();
      expect(getStripe()).toBeTruthy();
    });
  });

  describe('getPriceId', () => {
    // Regression: the old check only rejected the literal string 'placeholder',
    // so the stub `price_` passed straight through to the Stripe API.
    it.each(['', 'price_', 'price_short'])('rejects the stub value %o', async (value) => {
      process.env.STRIPE_PRICE_PRO = value;
      const { getPriceId, StripeConfigError } = await load();
      expect(() => getPriceId('pro')).toThrow(StripeConfigError);
    });

    it('returns a configured price id', async () => {
      process.env.STRIPE_PRICE_BUILDER = 'price_1TwAlfIdBbgqt2LeUABAlTHP';
      const { getPriceId } = await load();
      expect(getPriceId('builder')).toBe('price_1TwAlfIdBbgqt2LeUABAlTHP');
    });
  });

  describe('getAppUrl', () => {
    it('falls back to localhost when nothing is set', async () => {
      const { getAppUrl } = await load();
      expect(getAppUrl()).toBe('http://localhost:3000');
    });

    it('ignores the `MY_APP_URL` placeholder that shipped in .env', async () => {
      process.env.APP_URL = 'MY_APP_URL';
      process.env.VERCEL_URL = 'trend-equity-xyz.vercel.app';
      const { getAppUrl } = await load();
      expect(getAppUrl()).toBe('https://trend-equity-xyz.vercel.app');
    });

    it('prefers APP_URL and strips trailing slashes', async () => {
      process.env.APP_URL = 'https://trend-equity.vercel.app/';
      process.env.VERCEL_URL = 'trend-equity-xyz.vercel.app';
      const { getAppUrl } = await load();
      expect(getAppUrl()).toBe('https://trend-equity.vercel.app');
    });
  });

  describe('getPeriodEnd', () => {
    it('reads the legacy top-level field', async () => {
      const { getPeriodEnd } = await load();
      expect(getPeriodEnd({ current_period_end: 123 } as any)).toBe(123);
    });

    it('reads the per-item field used by recent API versions', async () => {
      const { getPeriodEnd } = await load();
      expect(getPeriodEnd({ items: { data: [{ current_period_end: 456 }] } } as any)).toBe(456);
    });

    it('returns null when neither is present', async () => {
      const { getPeriodEnd } = await load();
      expect(getPeriodEnd({ items: { data: [] } } as any)).toBeNull();
    });
  });
});

describe('webhook raw body parser', () => {
  // Regression: the old implementation always read the stream, which had
  // already been consumed by a body parser — yielding '' and failing every
  // signature check.
  it('returns a pre-read Buffer body untouched', async () => {
    const buffer = Buffer.from('{"id":"evt_1"}');
    await expect(getRawBody({ body: buffer } as any)).resolves.toBe(buffer);
  });

  it('returns a pre-read string body untouched', async () => {
    await expect(getRawBody({ body: '{"id":"evt_1"}' } as any)).resolves.toBe('{"id":"evt_1"}');
  });

  it('throws rather than re-serialising an already JSON-parsed body', async () => {
    await expect(getRawBody({ body: { id: 'evt_1' } } as any)).rejects.toThrow(
      /raw bytes are unavailable/
    );
  });

  it('reads the stream when it is still readable', async () => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const req = {
      readable: true,
      on: (event: string, cb: (arg?: unknown) => void) => {
        handlers[event] = cb;
        if (event === 'error') {
          setTimeout(() => {
            handlers.data?.(Buffer.from('{"id":'));
            handlers.data?.(Buffer.from('"evt_1"}'));
            handlers.end?.();
          }, 0);
        }
      },
    };

    const body = await getRawBody(req as any);
    expect(body.toString()).toBe('{"id":"evt_1"}');
  });

  // On Vercel `req.body` can be a lazy getter that parses on first access, so
  // the raw stream must be drained before `req.body` is ever touched.
  it('prefers the live stream over req.body', async () => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    let bodyAccessed = false;
    const req = {
      readable: true,
      get body() {
        bodyAccessed = true;
        return { id: 'parsed' };
      },
      on: (event: string, cb: (arg?: unknown) => void) => {
        handlers[event] = cb;
        if (event === 'error') {
          setTimeout(() => {
            handlers.data?.(Buffer.from('{"id":"evt_1"}'));
            handlers.end?.();
          }, 0);
        }
      },
    };

    const body = await getRawBody(req as any);
    expect(body.toString()).toBe('{"id":"evt_1"}');
    expect(bodyAccessed).toBe(false);
  });
});
