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

  describe('tierForPriceId', () => {
    it('maps configured price ids to tiers', async () => {
      process.env.STRIPE_PRICE_PRO = 'price_pro_123';
      process.env.STRIPE_PRICE_BUILDER = 'price_builder_456';
      const { tierForPriceId } = await load();
      expect(tierForPriceId('price_pro_123')).toBe('pro');
      expect(tierForPriceId('price_builder_456')).toBe('builder');
      expect(tierForPriceId('price_unknown')).toBeNull();
      expect(tierForPriceId(undefined)).toBeNull();
      expect(tierForPriceId(null)).toBeNull();
    });

    it('returns null when the price env vars are unset', async () => {
      const { tierForPriceId } = await load();
      expect(tierForPriceId('price_pro_123')).toBeNull();
    });
  });

  describe('updateSubscriptionState', () => {
    const setupDb = async () => {
      const set = vi.fn().mockResolvedValue(undefined);
      const doc = vi.fn(() => ({ set }));
      const collection = vi.fn(() => ({ doc }));
      const { getAdminDb } = await import('../../../api/_lib/admin');
      (getAdminDb as any).mockReturnValue({ collection });
      return { set, doc, collection };
    };

    it('mirrors status, cancel flag and period end onto the user doc', async () => {
      const { set, doc, collection } = await setupDb();
      const { updateSubscriptionState } = await load();

      await updateSubscriptionState({
        uid: 'user123',
        tier: 'builder',
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: 1800000000,
      });

      expect(collection).toHaveBeenCalledWith('users');
      expect(doc).toHaveBeenCalledWith('user123');
      const [payload, options] = set.mock.calls[0];
      expect(options).toEqual({ merge: true });
      expect(payload).toMatchObject({
        tier: 'builder',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: true,
        proEndDate: new Date(1800000000 * 1000),
      });
    });

    // Deletion and the proEndDate backstop own downgrades — an `updated` event
    // must never be able to strip paid access.
    it('never writes tier when the price maps to no known tier', async () => {
      const { set } = await setupDb();
      const { updateSubscriptionState } = await load();

      await updateSubscriptionState({
        uid: 'user123',
        tier: null,
        status: 'past_due',
        cancelAtPeriodEnd: false,
      });

      const [payload] = set.mock.calls[0];
      expect(payload).not.toHaveProperty('tier');
      expect(payload).not.toHaveProperty('proEndDate');
      expect(payload.subscriptionStatus).toBe('past_due');
    });

    // TE-47: an explicit null means "the user reversed the scheduled switch",
    // which a truthiness check would silently drop — leaving the UI promising
    // a downgrade that is no longer coming.
    it('clears a pending switch when passed null, and leaves it alone when absent', async () => {
      const { set } = await setupDb();
      const { updateSubscriptionState } = await load();

      await updateSubscriptionState({
        uid: 'user123',
        status: 'active',
        cancelAtPeriodEnd: false,
        pendingTier: null,
        pendingTierDate: null,
      });
      expect(set.mock.calls[0][0]).toMatchObject({ pendingTier: null, pendingTierDate: null });

      await updateSubscriptionState({ uid: 'user123', status: 'active', cancelAtPeriodEnd: false });
      expect(set.mock.calls[1][0]).not.toHaveProperty('pendingTier');
    });

    it('records the scheduled tier and its effective date', async () => {
      const { set } = await setupDb();
      const { updateSubscriptionState } = await load();

      await updateSubscriptionState({
        uid: 'user123',
        tier: 'builder',
        status: 'active',
        cancelAtPeriodEnd: false,
        pendingTier: 'pro',
        pendingTierDate: 1800000000,
      });

      expect(set.mock.calls[0][0]).toMatchObject({
        tier: 'builder', // still Builder — the user keeps what they paid for
        pendingTier: 'pro',
        pendingTierDate: new Date(1800000000 * 1000),
      });
    });
  });

  describe('resolveScheduledTierChange (TE-47)', () => {
    const future = Math.floor(Date.now() / 1000) + 86_400;
    const past = Math.floor(Date.now() / 1000) - 86_400;

    const stripeWith = (schedule: unknown) => ({
      subscriptionSchedules: { retrieve: vi.fn().mockResolvedValue(schedule) },
    });

    beforeEach(() => {
      process.env.STRIPE_PRICE_PRO = 'price_pro_live';
      process.env.STRIPE_PRICE_BUILDER = 'price_builder_live';
    });

    it('reads the upcoming phase price as the pending tier', async () => {
      const { resolveScheduledTierChange } = await load();
      const stripe = stripeWith({
        status: 'active',
        phases: [
          { start_date: past, items: [{ price: 'price_builder_live' }] },
          { start_date: future, items: [{ price: 'price_pro_live' }] },
        ],
      });

      const result = await resolveScheduledTierChange(
        stripe as any,
        {
          schedule: 'sub_sched_1',
        } as any
      );

      expect(result).toEqual({ tier: 'pro', effectiveAt: future });
    });

    it('reports nothing pending when the subscription has no schedule', async () => {
      const { resolveScheduledTierChange } = await load();
      const result = await resolveScheduledTierChange({} as any, { schedule: null } as any);
      expect(result).toEqual({ tier: null, effectiveAt: null });
    });

    it('ignores a released schedule — that is history, not intent', async () => {
      const { resolveScheduledTierChange } = await load();
      const stripe = stripeWith({
        status: 'released',
        phases: [{ start_date: future, items: [{ price: 'price_pro_live' }] }],
      });

      const result = await resolveScheduledTierChange(
        stripe as any,
        {
          schedule: 'sub_sched_1',
        } as any
      );
      expect(result.tier).toBeNull();
    });

    it('ignores phases that have already started', async () => {
      const { resolveScheduledTierChange } = await load();
      const stripe = stripeWith({
        status: 'active',
        phases: [{ start_date: past, items: [{ price: 'price_pro_live' }] }],
      });

      const result = await resolveScheduledTierChange(
        stripe as any,
        {
          schedule: 'sub_sched_1',
        } as any
      );
      expect(result.tier).toBeNull();
    });

    // A webhook must not 500 over display metadata: Stripe would retry and
    // replay a state write that already succeeded.
    it('degrades to nothing pending when the schedule lookup throws', async () => {
      const { resolveScheduledTierChange } = await load();
      const stripe = {
        subscriptionSchedules: { retrieve: vi.fn().mockRejectedValue(new Error('boom')) },
      };

      const result = await resolveScheduledTierChange(
        stripe as any,
        {
          schedule: 'sub_sched_1',
        } as any
      );
      expect(result).toEqual({ tier: null, effectiveAt: null });
    });
  });

  describe('extendSubscription', () => {
    const setupBatchDb = async () => {
      const batchSet = vi.fn();
      const commit = vi.fn().mockResolvedValue(undefined);
      const docs: Record<string, unknown> = {};
      const collection = vi.fn((name: string) => ({
        doc: vi.fn((id: string) => {
          const ref = { collection: name, id };
          docs[`${name}/${id}`] = ref;
          return ref;
        }),
      }));
      const { getAdminDb } = await import('../../../api/_lib/admin');
      (getAdminDb as any).mockReturnValue({
        collection,
        batch: vi.fn(() => ({ set: batchSet, commit })),
      });
      return { batchSet, commit };
    };

    it('extends the period and writes a renewal audit row keyed on the invoice id', async () => {
      const { batchSet, commit } = await setupBatchDb();
      const { extendSubscription } = await load();

      await extendSubscription({
        uid: 'user123',
        currentPeriodEnd: 1800000000,
        invoiceId: 'in_123',
        amountPaid: 900,
        currency: 'usd',
        subscriptionId: 'sub_123',
      });

      expect(batchSet).toHaveBeenCalledTimes(2);
      const userWrite = batchSet.mock.calls.find((c: any[]) => c[0].collection === 'users')!;
      expect(userWrite[1]).toMatchObject({
        proEndDate: new Date(1800000000 * 1000),
        subscriptionStatus: 'active',
      });
      const auditWrite = batchSet.mock.calls.find(
        (c: any[]) => c[0].collection === 'stripe_transactions'
      )!;
      expect(auditWrite[0].id).toBe('in_123');
      expect(auditWrite[1]).toMatchObject({
        uid: 'user123',
        type: 'renewal',
        amount: 900,
        currency: 'usd',
        stripeSubscriptionId: 'sub_123',
      });
      expect(commit).toHaveBeenCalled();
    });

    it('skips the audit row when there is no invoice id', async () => {
      const { batchSet } = await setupBatchDb();
      const { extendSubscription } = await load();

      await extendSubscription({ uid: 'user123', currentPeriodEnd: 1800000000 });

      expect(batchSet).toHaveBeenCalledTimes(1);
      expect(batchSet.mock.calls[0][0].collection).toBe('users');
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
