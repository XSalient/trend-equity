import type { VercelRequest } from '@vercel/node';

export async function getRawBody(req: VercelRequest): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      resolve(data);
    });

    req.on('error', reject);
  });
}
