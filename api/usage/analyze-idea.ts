import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext } from '../_lib/auth';
import { getMonthlyUsageCount, buildMonthlyUsageResponse } from '../_lib/usage';
import { getTierConfig, getAnalyzeIdeaLimit } from '../_lib/tier-config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  if (!authCtx) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { uid, tier } = authCtx;

  const config = await getTierConfig();
  const limit = getAnalyzeIdeaLimit(tier, config);

  const usage = await buildMonthlyUsageResponse(uid, limit, 'analyze-idea');
  return res.json(usage);
}
