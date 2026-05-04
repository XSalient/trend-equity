import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithAI, Type, normalizeAIResponse } from '../_lib/ai-provider';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    landingPage: {
      type: Type.OBJECT,
      properties: {
        hero: { type: Type.STRING },
        subHero: { type: Type.STRING },
        valueProps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['hero', 'subHero', 'valueProps'],
    },
    interviewScript: { type: Type.ARRAY, items: { type: Type.STRING } },
    smokeTest: { type: Type.STRING },
    successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['landingPage', 'interviewScript', 'smokeTest', 'successMetrics'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const { idea, refresh } = req.body;

  // FIX (B-9, D-1): Validate required input
  if (!idea || typeof idea !== 'object') {
    return res.status(400).json({ error: 'Missing required field: idea' });
  }
  if (!idea.headline || typeof idea.headline !== 'string') {
    return res.status(400).json({ error: 'Missing required field: idea.headline' });
  }

  const safeHeadline = idea.headline
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 200);

  const featureType = 'validation';
  // Bumping version to v3 to clear any corrupted cache
  const cacheKey = idea?.id ? `validation_v3_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached && !refresh) {
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
          error: 'Daily validation limit reached. Upgrade for more toolkits.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const pitch = idea.pitch || '';
    const justification = idea.vcJustification || '';

    const prompt = `
      You are a specialized GTM (Go-To-Market) strategist. Create a professional validation toolkit for the following business idea:
      
      HEADLINE: ${safeHeadline}
      PITCH: ${pitch}
      CONTEXT: ${justification}
      
      TASK:
      Generate a validation strategy to prove market demand before building.
      Include:
      1. High-conversion landing page copy (hero, subhero, and 3 specific value props).
      2. A 5-question problem-interview script for potential customers.
      3. A specific 'smoke test' strategy (e.g. ad campaign, waitlist, pre-order).
      4. 3 success metrics to track.
      
      IMPORTANT: You MUST use camelCase for all keys (e.g., landingPage, interviewScript, smokeTest, successMetrics). Return valid JSON matching the schema.
    `;

    const rawData = await generateWithAI(prompt, schema);

    const data = normalizeAIResponse(rawData, ['interviewScript', 'successMetrics'], {
      landingPage: {
        hero: 'Landing page being drafted...',
        subHero: '',
        valueProps: [],
      },
      interviewScript: [],
      smokeTest: 'Smoke test strategy being designed...',
      successMetrics: [],
      generatedAt: new Date().toISOString(),
    });

    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[validation] Generation error:', err);
    return res
      .status(500)
      .json({ error: 'Validation toolkit generation failed. Please try again.', _details: err?.message });
  }
}
