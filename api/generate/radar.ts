import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, radarSchema, getToday } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { uid, tier } = req.body;
  const featureType = 'radar';
  const cacheKey = `radar_${getToday()}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily radar limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      'Perform a VC-grade market analysis. Provide 5 top trends, a core market shift, and 5 opportunity areas.',
      radarSchema,
      'You are a top-tier Venture Capital market analyst.'
    );
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('Radar Error (Falling back to mock):', err);
    return res.json({
      week: 'March 2026',
      topTrends: [
        { title: 'Autonomous Grid Balancers', description: 'AI-driven local energy storage and distribution optimization.', impact: 'High', sector: 'Energy' },
        { title: 'Verticalized AI Law Assistants', description: 'Hyper-specialized LLMs for niche legal code.', impact: 'Medium', sector: 'LegalTech' },
      ],
      marketShift: "Transition from 'Chat-based AI' to 'Agentic-native Workflows' across all B2B sectors.",
      opportunityAreas: ['Micro-storage systems', 'Privacy-first training data sets', 'Agent orchestration layers'],
    });
  }
}
