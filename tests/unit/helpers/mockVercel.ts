/**
 * Minimal mock for Vercel's VercelRequest / VercelResponse.
 * Allows calling API handlers directly in unit tests without an HTTP server.
 */
import { vi } from 'vitest';

export function createMockRequest(
  overrides: {
    method?: string;
    body?: Record<string, any>;
    query?: Record<string, string>;
  } = {}
) {
  return {
    method: overrides.method ?? 'POST',
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    headers: {},
  } as any;
}

export function createMockResponse() {
  const res: any = {
    _status: 200,
    _body: undefined,
    statusCode: 200,
  };

  res.status = vi.fn((code: number) => {
    res._status = code;
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((body: any) => {
    res._body = body;
    return res;
  });

  res.send = vi.fn((body: any) => {
    res._body = body;
    return res;
  });

  res.setHeader = vi.fn(() => res);
  res.end = vi.fn(() => res);

  return res;
}
