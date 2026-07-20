import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithAI, Type, normalizeAIResponse } from '../_lib/ai-provider';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext, requireTier } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    promptPack: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          prompt: { type: Type.STRING },
        },
        required: ['title', 'prompt'],
      },
    },
    repoStructure: { type: Type.STRING },
    first24Hours: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['promptPack', 'repoStructure', 'first24Hours'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  if (!authCtx) return res.status(401).json({ error: 'Authentication required.' });
  const tierCheck = requireTier(authCtx, 'builder');
  if (tierCheck) return res.status(tierCheck.status).json(tierCheck.body);
  const { uid, tier } = authCtx;

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

  const featureType = 'build-me';
  // Bumping version to v3 to clear any corrupted cache
  const cacheKey = idea?.id ? `build-me_v3_${String(idea.id).slice(0, 100)}` : '';

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
        error: 'Daily build-me limit reached. Upgrade for more blueprints.',
        _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
      });
    }

    console.log('[build-me] Generating for:', safeHeadline);

    const rawData = await generateWithAI(
      `Act as a Senior Technical Lead. Create a high-value "Build-with-Me" starter pack for this startup idea: ${safeHeadline}

      PITCH: ${idea.pitch || ''}

      TASK:
      1. PROMPT PACK: Provide 3 high-leverage AI prompts (System Design, Data Schema, and Core Feature Logic) that a developer can copy-paste into an LLM to start implementation.
      2. REPO STRUCTURE: Provide a clean, text-based visual tree of the recommended file structure (e.g., using ├── and └── characters). Do not return a JSON array.
      3. FIRST 24 HOURS: List 5-7 technical tasks to get a functional MVP live within one day.

      IMPORTANT: 
      - Return exactly 3 prompts in the promptPack array.
      - repoStructure must be a single string formatted as a visual file tree.`,
      schema
    );

    const data = normalizeAIResponse(rawData, ['promptPack', 'first24Hours'], {
      promptPack: [],
      repoStructure: 'Project structure being generated...',
      first24Hours: [],
      generatedAt: new Date().toISOString(),
    });

    // FIX: Ensure repoStructure is a string and formatted if AI returned an array
    if (Array.isArray(data.repoStructure)) {
      data.repoStructure = data.repoStructure.join('\n');
    } else if (typeof data.repoStructure !== 'string') {
      data.repoStructure = String(data.repoStructure || '');
    }

    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[build-me] Generation error:', err);
    return res.status(500).json({
      error: 'Build pack generation failed. Please try again.',
      _details: err?.message,
    });
  }
}
