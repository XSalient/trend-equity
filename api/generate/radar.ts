import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, radarSchema, getToday } = AI;
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth context from verified token (S-2)
  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const featureType = 'radar';
  const cacheKey = `radar_${getToday()}_v4`; // Bumping to v4

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
          error: 'Daily radar limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const rawData = await generateWithAI(
      `Perform an intensive VC-grade market analysis for the week of ${getToday()}. 
       1. Identify the single most significant MARKET SHIFT.
       2. Detail 5 TOP TRENDS with descriptions, sector focus, and specific market impact.
       3. List 5 OPPORTUNITY AREAS for builders and founders to target.
       Focus on real, high-signal data from the last 7 days.`,
      radarSchema
    );

    const { normalizeAIResponse } = require('../_lib/ai-provider');
    const data = normalizeAIResponse(rawData, ['topTrends', 'opportunityAreas'], {
      week: `Week of ${getToday()}`,
      topTrends: [],
      opportunityAreas: [],
      marketShift: {
        title: 'Strategic Analysis Pending',
        description: 'Deep market signals are currently being processed.',
      },
      generatedAt: new Date().toISOString(),
    });

    // --- Defensive Sanitization (Self-Healing from AI Key Drift) ---
    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      // Handle the cases where AI returns 'name', 'headline', 'signalsources', etc.
      const title = obj.title || obj.name || obj.headline || 'Analysis Component';
      const desc =
        obj.description ||
        obj.rationale ||
        obj.impact ||
        obj.text ||
        obj.signalsources ||
        obj.trendsources ||
        '';
      return { title, description: desc };
    };

    if (data.marketShift) {
      data.marketShift = sanitize(data.marketShift);
    }

    if (Array.isArray(data.topTrends)) {
      data.topTrends = data.topTrends.map((t: any) => {
        const base = sanitize(t);
        return {
          ...base,
          impact: t.impact || 'High',
          sector: t.sector || 'General',
        };
      });
    }

    if (Array.isArray(data.opportunityAreas)) {
      data.opportunityAreas = data.opportunityAreas.map((a: any) => {
        if (typeof a === 'string') return a;
        // If the AI wraps opportunity areas in objects, extract the string value
        return a.title || a.name || a.area || a.text || 'New Market Opportunity';
      });
    }

    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[radar] Generation error:', err);
    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
}
