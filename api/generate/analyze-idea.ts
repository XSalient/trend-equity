import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, ideaSchema, DEFAULT_SYSTEM_PROMPT } = AI;
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementMonthlyUsage, buildMonthlyUsageResponse } from '../_lib/usage';
import { getTierConfig, getAnalyzeIdeaLimit } from '../_lib/tier-config';

const ANALYZE_IDEA_SYSTEM_PROMPT =
  DEFAULT_SYSTEM_PROMPT +
  '\n\nThe user has described their own business idea. Your job is to rigorously evaluate it — not to encourage it. Apply your full VC-grade critical framework. Be honest about market saturation, competitive dynamics, and structural risks.';

function sanitiseInput(value: unknown, maxLen = 5000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, maxLen);
}

function buildPrompt(description: string): string {
  return `Analyze the following business idea and produce a complete VC-grade evaluation.

The user's idea:
"${description}"

REQUIREMENTS:
- Treat this as a real early-stage startup pitch being evaluated for investment
- Cite a specific, verifiable 2025–2026 market signal or data point in trendSources that is directly relevant to this idea (positive OR negative)
- Identify the non-obvious second-order opportunity within the idea's space — what problem does this market create that is currently undersolved?
- The unfairAdvantage MUST describe a real structural moat THIS specific idea could realistically build (proprietary data, regulatory position, distribution lock-in, or network effects)
- Be honest about saturationLabel — if the space is crowded, say so clearly
- heatBadge must reflect the CURRENT market moment for this specific category
- nextSteps must be concretely tailored to this specific idea, not generic startup advice
- revenuePotentialScore must be a genuine assessment (1–10), not inflated
- If the idea has fundamental problems, surface them honestly in competitorLandscape and regulatoryFlags`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth required
  const authCtx = await getAuthContext(req);
  if (!authCtx) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { uid, tier } = authCtx;

  // Free tier blocked
  if (tier === 'free') {
    return res.status(403).json({
      error: 'Custom idea analysis requires a Pro or Builder plan.',
      upgradeRequired: true,
    });
  }

  // Input validation + sanitisation
  const raw = req.body?.ideaDescription;
  const ideaDescription = sanitiseInput(raw, 5000);
  if (ideaDescription.length < 20) {
    console.warn('[analyze-idea] Input too short:', ideaDescription.length);
    return res.status(400).json({ error: 'Please describe your idea in at least 20 characters.' });
  }

  // Load tier config + check monthly quota
  const config = await getTierConfig();
  const limit = getAnalyzeIdeaLimit(tier, config);

  const usageCheck = await checkAndIncrementMonthlyUsage(uid, limit, 'analyze-idea');
  if (!usageCheck.allowed) {
    console.info('[analyze-idea] Quota exceeded for user:', uid);
    const usage = await buildMonthlyUsageResponse(uid, limit, 'analyze-idea');
    return res.status(429).json({
      error: `Monthly analysis limit reached (${limit}/month). Resets ${usage?.resetsAt ?? 'next month'}.`,
      _usage: usage,
    });
  }

  try {
    console.info('[analyze-idea] Starting AI generation for user:', uid);
    const prompt = buildPrompt(ideaDescription);
    const rawIdea = await generateWithAI(prompt, ideaSchema, ANALYZE_IDEA_SYSTEM_PROMPT);

    const { normalizeAIResponse } = require('../_lib/ai-provider');
    const idea = normalizeAIResponse(rawIdea, ['categoryTags', 'nextSteps', 'trendSources'], {
      id: `custom-${uid}-${Date.now()}`,
      headline: 'Idea Analysis',
      pitch: 'Analysis in progress...',
      vcJustification: '',
      categoryTags: [],
      costEffort: 'Unknown',
      revenuePotentialScore: 5,
      revenueSkeleton: '',
      unfairAdvantage: '',
      potentialExit: '',
      trendSources: [],
      saturationLabel: 'Unknown',
      heatBadge: 'Stable',
      nextSteps: [],
    });

    const usage = await buildMonthlyUsageResponse(uid, limit, 'analyze-idea');
    return res.json({ idea, _usage: usage });
  } catch (err: any) {
    console.error('[analyze-idea] Critical failure:', err);
    // Return specific status if it's likely a timeout or API error
    const status = err?.message?.includes('timeout') ? 504 : 503;
    return res.status(status).json({
      error: 'AI analysis temporarily unavailable. Please try again later.',
      details: err?.message,
    });
  }
}
