import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          step: { type: Type.STRING },
          details: { type: Type.STRING },
          milestone: { type: Type.STRING },
        },
        required: ['id', 'step', 'details', 'milestone'],
      },
    },
    tools: { type: Type.ARRAY, items: { type: Type.STRING } },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    timeline: { type: Type.STRING },
  },
  required: ['roadmap', 'tools', 'risks', 'timeline'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth context from verified token (S-2)
  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const { idea } = req.body;

  // FIX (B-8, D-1): Validate required input before use
  if (!idea || typeof idea !== 'object') {
    return res.status(400).json({ error: 'Missing required field: idea' });
  }
  if (!idea.headline || typeof idea.headline !== 'string') {
    return res.status(400).json({ error: 'Missing required field: idea.headline' });
  }

  // Sanitise headline before embedding in prompt (S-6)
  const safeHeadline = idea.headline
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 200);

  const featureType = 'action-plan';
  const cacheKey = idea?.id ? `action-plan_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        _cached: true,
        _usage: await buildUsageResponse(uid, tier, featureType),
      });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily action plan limit reached. Upgrade for more plans.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      `Generate a detailed action plan and roadmap for building this startup idea: ${safeHeadline}`,
      schema
    );
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[action-plan] Generation error:', err);
    // FIX (S-7): Never expose internal error details to clients
    return res.status(500).json({ error: 'Action plan generation failed. Please try again.' });
  }
}
