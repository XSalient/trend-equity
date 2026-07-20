import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithAI, Type, normalizeAIResponse } from '../_lib/ai-provider';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext, requireTier } from '../_lib/auth';
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
  if (!authCtx) return res.status(401).json({ error: 'Authentication required.' });
  const tierCheck = requireTier(authCtx, 'builder');
  if (tierCheck) return res.status(tierCheck.status).json(tierCheck.body);
  const { uid, tier } = authCtx;

  const { idea, refresh } = req.body;

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
    if (cached && !refresh) {
      return res.json({
        ...cached,
        _cached: true,
        _usage: await buildUsageResponse(uid, tier, featureType),
      });
    }

    const usage = await checkAndIncrementUsage(uid, tier, featureType);
    if (!usage.allowed) {
      return res.status(429).json({
        error: 'Daily action plan limit reached. Upgrade for more plans.',
        _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
      });
    }

    const prompt = `
      You are Trend-Equity's principal product strategist. Generate a high-conviction implementation roadmap for the startup idea: "${safeHeadline}".
      
      TASK:
      Create a detailed 4-phase roadmap (30-60-90 day + scaling) and identifying necessary tools and risks.
      
      REQUIRED JSON STRUCTURE:
      - roadmap: An array of objects, each with:
        - id: string (e.g. "step-1")
        - step: string (Phase name or main task)
        - details: string (2-3 sentences of specific implementation advice)
        - milestone: string (A clear KPI or output for this step)
      - tools: An array of 5-7 specific technical tools or platforms (e.g. "Vercel", "Supabase", "Stripe").
      - risks: An array of 3-4 specific business or technical risks.
      - timeline: A short string summarizing the total time to MVP.
      
      IMPORTANT: You MUST return a valid JSON object matching the schema. No conversational text.
    `;

    const rawData = await generateWithAI(prompt, schema);

    const data = normalizeAIResponse(rawData, ['roadmap', 'tools', 'risks'], {
      roadmap: [],
      tools: [],
      risks: [],
      timeline: 'Execution timeline being calculated...',
      generatedAt: new Date().toISOString(),
    });

    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[action-plan] Generation error:', err);
    // FIX (S-7): Never expose internal error details to clients
    return res.status(500).json({ error: 'Action plan generation failed. Please try again.' });
  }
}
