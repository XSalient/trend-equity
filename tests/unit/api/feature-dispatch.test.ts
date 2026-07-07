/**
 * Unit tests for api/generate/[feature].ts — the catch-all that routes
 * /api/generate/* requests to handlers in api/_handlers/.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlerNames = [
  'action-plan',
  'alerts',
  'analyze-idea',
  'build-me',
  'custom-feed',
  'daily',
  'evidence',
  'explain',
  'futurecasting',
  'radar',
  'validation',
  'vetting',
] as const;

vi.mock('../../../api/_handlers/action-plan', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/alerts', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/analyze-idea', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/build-me', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/custom-feed', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/daily', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/evidence', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/explain', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/futurecasting', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/radar', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/validation', () => ({ default: vi.fn() }));
vi.mock('../../../api/_handlers/vetting', () => ({ default: vi.fn() }));

import dispatch, { handlers } from '../../../api/generate/[feature]';

function makeRes() {
  const res: any = {
    statusCode: 200,
    status: vi.fn().mockImplementation(function (this: any, code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn().mockReturnValue(undefined),
  };
  return res;
}

describe('/api/generate/[feature] dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a handler for every generate endpoint', () => {
    expect(Object.keys(handlers).sort()).toEqual([...handlerNames].sort());
  });

  it.each(handlerNames)('dispatches %s to its handler with req/res', async (name) => {
    const req: any = { method: 'POST', query: { feature: name }, body: {} };
    const res = makeRes();
    await dispatch(req, res);
    expect(handlers[name]).toHaveBeenCalledWith(req, res);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown feature', async () => {
    const req: any = { method: 'POST', query: { feature: 'nope' }, body: {} };
    const res = makeRes();
    await dispatch(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown generate endpoint: nope' });
  });

  it('returns 404 when the feature param is missing or not a string', async () => {
    const res = makeRes();
    await dispatch({ method: 'POST', query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);

    const res2 = makeRes();
    await dispatch({ method: 'POST', query: { feature: ['a', 'b'] } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
  });
});
