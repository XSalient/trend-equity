import type { VercelRequest } from '@vercel/node';

/**
 * Returns the exact bytes Stripe signed.
 *
 * Stripe's signature covers the raw payload, so any JSON round-trip breaks
 * verification. Two hosts feed this function:
 *
 *   - Vercel, with `config.api.bodyParser = false` — the stream is untouched,
 *     so it is drained here.
 *   - Express in local dev, mounted with `express.raw()` — the stream is
 *     already consumed and `req.body` holds the Buffer.
 *
 * Reading the stream unconditionally (the previous behaviour) yielded an empty
 * string whenever a body parser had run first, so every signature check failed.
 */
export async function getRawBody(req: VercelRequest): Promise<Buffer | string> {
  const stream = req as VercelRequest & { readable?: boolean; body?: unknown };

  // Drain the stream first, before touching `req.body`. On Vercel `req.body`
  // can be a lazy getter that parses on first access, so reading it here would
  // consume the very bytes we need.
  if (stream.readable === true) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  const body = stream.body;

  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return body;

  // A parsed object means a JSON body parser ran and the original bytes are
  // gone. Re-serialising would produce a different payload, so fail loudly
  // rather than silently returning a signature that can never verify.
  if (body && typeof body === 'object') {
    throw new Error(
      'Stripe webhook body was JSON-parsed before reaching the handler; raw bytes are unavailable. ' +
        'Ensure body parsing is disabled for this route.'
    );
  }

  throw new Error('Stripe webhook request had no readable body.');
}
