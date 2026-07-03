import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';

const { generateWithAI, dailyResponseSchema, getToday, normalizeAIResponse } = AI;
const CUSTOM_FEED_LIMIT = 5;
const CUSTOM_FEED_TTL_MS = 24 * 60 * 60 * 1000;

type CustomFeedStatus = 'complete' | 'partial' | 'empty';

function sanitiseRequirement(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normaliseProKeyword(value: string): string {
  return (
    value
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)[0]
      ?.slice(0, 60) || ''
  );
}

function stableId(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function getStatus(count: number): CustomFeedStatus {
  if (count === 0) return 'empty';
  if (count < CUSTOM_FEED_LIMIT) return 'partial';
  return 'complete';
}

function getMessage(status: CustomFeedStatus, count: number): string {
  if (status === 'empty') {
    return 'No strong matches were found for this requirement in the current signal set. Try a broader requirement tomorrow.';
  }
  if (status === 'partial') {
    return `Found ${count} strong match${count === 1 ? '' : 'es'} today. We only return ideas that clear the signal and feasibility bar.`;
  }
  return 'Found 5 custom feed ideas matched to your requirement and current market signals.';
}

function isFresh(generatedAt: unknown): boolean {
  if (typeof generatedAt !== 'string') return false;
  const time = Date.parse(generatedAt);
  return Number.isFinite(time) && Date.now() - time < CUSTOM_FEED_TTL_MS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  if (!authCtx) return res.status(401).json({ error: 'Authentication required.' });
  if (authCtx.tier === 'free') {
    return res
      .status(403)
      .json({ error: 'Custom requirement feeds require a Pro or Builder plan.' });
  }

  // Peek mode: return the cached feed if a fresh one exists, never generate.
  // Lets the client restore the feed (and lock the inputs) after a reload.
  const isPeek = req.body?.peek === true;

  const rawRequirement = sanitiseRequirement(req.body?.requirement);
  const requirement = authCtx.tier === 'pro' ? normaliseProKeyword(rawRequirement) : rawRequirement;
  if (!requirement && !isPeek) {
    return res.status(400).json({
      error:
        authCtx.tier === 'pro'
          ? 'Enter one keyword to generate a custom feed.'
          : 'Enter a custom requirement to generate a custom feed.',
    });
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection('user_custom_feeds').doc(authCtx.uid);
    const existing = await docRef.get();

    if (existing.exists && isFresh(existing.data()?.generatedAt)) {
      return res.json({ ...existing.data(), _cached: true });
    }
    if (isPeek) {
      return res.status(404).json({ error: 'No cached custom feed available.' });
    }

    const today = getToday();
    const signals = await fetchLiveSignals();
    const signalContext = formatSignalsForPrompt(signals);
    const tierInstruction =
      authCtx.tier === 'pro'
        ? `The user provided one keyword: "${requirement}". Generate ideas tightly related to this keyword.`
        : `The user provided natural-language requirements: "${requirement}". Treat this as hard constraints. If an idea does not satisfy the requirement, omit it.`;

    const prompt = `${signalContext || 'Use the latest available 2025-2026 market signals.'}

CUSTOM FEED TASK
${tierInstruction}

Generate up to ${CUSTOM_FEED_LIMIT} business ideas for ${today}. Use current market signals as the basis for every idea. Return fewer than ${CUSTOM_FEED_LIMIT} ideas if only fewer genuinely match. Return an empty ideas array if no high-signal ideas satisfy the requirement.

Rules:
- Do not pad weak matches to reach ${CUSTOM_FEED_LIMIT}.
- Every trendSources array must cite a specific signal, data point, or named source.
- Every idea must be feasible for the constraint stated by the user.
- Prefer practical founder-actionable ideas over abstract market commentary.`;

    const rawData = await generateWithAI(prompt, dailyResponseSchema);
    const data = normalizeAIResponse(rawData, ['ideas'], {
      intro: 'Custom feed generated from your requirement and current market signals.',
      ideas: [],
      disclaimer:
        'Custom feeds are AI-generated from market signals and should be validated independently.',
    });

    const ideas = (data.ideas || [])
      .slice(0, CUSTOM_FEED_LIMIT)
      .map((idea: any, index: number) => ({
        ...idea,
        id:
          idea.id ||
          `custom-feed-${today}-${index + 1}-${stableId(`${authCtx.uid}-${requirement}-${idea.headline || index}`)}`,
      }));
    const status = getStatus(ideas.length);
    const finalData = {
      date: today,
      intro:
        data.intro || 'Custom feed generated from your requirement and current market signals.',
      ideas,
      disclaimer:
        data.disclaimer ||
        'Custom feeds are AI-generated from market signals and should be validated independently.',
      generatedAt: new Date().toISOString(),
      customRequirement: requirement,
      customFeedStatus: status,
      customFeedMessage: getMessage(status, ideas.length),
      limit: CUSTOM_FEED_LIMIT,
      tier: authCtx.tier,
    };

    await docRef.set(finalData);
    return res.json(finalData);
  } catch (err: any) {
    console.error('[custom-feed] Generation error:', err);
    return res
      .status(503)
      .json({ error: 'Custom feed generation failed. ' + (err?.message || '') });
  }
}
