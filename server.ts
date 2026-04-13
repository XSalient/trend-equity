import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { getMockResponse } from './server.mocks.js';
import { checkAndIncrementUsage, buildUsageResponse } from './api/_lib/usage.js';
import { getAdminAuth } from './api/_lib/admin.js';
import { getToday } from './api/_lib/gemini.js';
// Signals module loaded dynamically to support tsx ESM resolution
let _signals: typeof import('./api/_lib/signals.ts') | null = null;
async function getSignalsModule() {
  if (!_signals) _signals = await import('./api/_lib/signals.ts');
  return _signals;
}

// --- Auth helper: extract uid + tier from Bearer token ---
async function getAuthFromRequest(
  req: express.Request
): Promise<{ uid: string; tier: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, tier: (decoded as any).tier || 'free' };
  } catch {
    return null;
  }
}

dotenv.config();

// ─── Production safety guard ──────────────────────────────────────────────────
// DEV_MOCK must NEVER be enabled in production. Fail fast so a mis-configured
// deploy is caught immediately rather than silently serving fake data to users.
if (process.env.DEV_MOCK === 'true' && process.env.NODE_ENV === 'production') {
  console.error(
    '\n[FATAL] DEV_MOCK=true is not allowed in production.\n' +
      '        Remove or unset DEV_MOCK from your production environment and redeploy.\n'
  );
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

const DEFAULT_SYSTEM_PROMPT = `You are Trend-Equity's principal venture scout — a seasoned analyst with deep expertise in early-stage VC, product strategy, and emerging markets. Your mission: surface business ideas that serious founders and investors would act on today.

QUALITY STANDARDS — every idea must pass all three tests:
1. SIGNAL-GROUNDED: Cite a specific, verifiable market event, data point, or regulatory shift from 2025–2026 in trendSources. Generic trends ("AI is growing") are not acceptable.
2. NON-OBVIOUS: Target second or third-order opportunities created by the trend — not the obvious direct play. If everyone sees the trend, find the problem it creates that nobody is solving yet.
3. STRUCTURAL EDGE: The unfairAdvantage field must describe a real, defensible moat — proprietary data, regulatory position, distribution lock-in, or network effects. "Better UX" and "first mover advantage" are not moats.

OUTPUT FORMAT: Respond with valid JSON matching the provided schema exactly. No markdown, no commentary outside the JSON.`;

// Load prompts with fallback
let localPrompts = { SYSTEM_PROMPT: '' };
try {
  const promptsModule = await import('./src/services/prompts.json', { assert: { type: 'json' } });
  localPrompts = promptsModule.default;
} catch (_e) {
  console.log('--- Notice: No local prompts.json found. Relying on environment variables. ---');
}

const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT || localPrompts.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

// --- Rate Limiting (Strategy C: IP-based shield) ---

// Global: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Feature endpoints: 30 requests per hour per IP
const featureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly feature limit reached. Please try again later.' },
});

app.use(globalLimiter);

// --- In-Memory Feature Cache (Strategy D: extended caching) ---

interface CacheEntry {
  result: any;
  generatedAt: number;
}
const featureCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key: string): any | null {
  if (!key) return null;
  const entry = featureCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.generatedAt > CACHE_TTL_MS) {
    featureCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key: string, result: any): void {
  if (!key) return;
  featureCache.set(key, { result, generatedAt: Date.now() });
}

// --- Shared Gemini Helper ---

async function generateWithGemini(prompt: string, schema?: any, systemInstruction?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');

  const ai = new GoogleGenAI({ apiKey });
  const modelToUse = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || SYSTEM_PROMPT,
        responseMimeType: schema ? 'application/json' : 'text/plain',
        responseSchema: schema,
      },
    });

    if (schema) {
      try {
        return JSON.parse(response.text);
      } catch (e) {
        console.error('JSON Parse Error:', response.text);
        throw new Error('AI returned invalid JSON structure.');
      }
    }
    return { text: response.text };
  } catch (err: any) {
    console.error(`Gemini Error [${modelToUse}]:`, err);
    throw err;
  }
}

// --- Data Schemas ---

const ideaSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    pitch: { type: Type.STRING },
    vcJustification: { type: Type.STRING },
    categoryTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    costEffort: { type: Type.STRING },
    revenuePotentialScore: { type: Type.NUMBER },
    revenueSkeleton: { type: Type.STRING },
    unfairAdvantage: { type: Type.STRING },
    potentialExit: { type: Type.STRING },
    trendSources: { type: Type.ARRAY, items: { type: Type.STRING } },
    saturationLabel: { type: Type.STRING },
    heatBadge: { type: Type.STRING },
    nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    marketSize: { type: Type.STRING },
    competitorLandscape: { type: Type.STRING },
    regulatoryFlags: { type: Type.STRING },
  },
  required: [
    'headline',
    'pitch',
    'vcJustification',
    'categoryTags',
    'costEffort',
    'revenuePotentialScore',
    'revenueSkeleton',
    'unfairAdvantage',
    'potentialExit',
    'trendSources',
    'saturationLabel',
    'heatBadge',
    'nextSteps',
    'marketSize',
    'competitorLandscape',
    'regulatoryFlags',
  ],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intro: { type: Type.STRING },
    ideas: { type: Type.ARRAY, items: ideaSchema },
    disclaimer: { type: Type.STRING },
  },
  required: ['intro', 'ideas', 'disclaimer'],
};

const radarSchema = {
  type: Type.OBJECT,
  properties: {
    week: { type: Type.STRING },
    topTrends: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          impact: { type: Type.STRING },
          sector: { type: Type.STRING },
        },
        required: ['title', 'description', 'impact', 'sector'],
      },
    },
    marketShift: { type: Type.STRING },
    opportunityAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['week', 'topTrends', 'marketShift', 'opportunityAreas'],
};

// --- Endpoints ---

app.post('/api/generate/daily', async (req, res) => {
  const { date, country, countryCount } = req.body;

  if (process.env.DEV_MOCK === 'true') {
    // Return a lightweight mock daily feed so the app renders without Gemini
    const ideas = Array.from({ length: 35 }, (_, i) => ({
      id: `${date}-mock-${i}`,
      headline: `[Mock] Idea ${i + 1}: ${['Agentic AI Compliance Layer', 'Embedded Finance for Gig Workers', 'Climate-Smart Agri-Tech SaaS', 'B2B Mental Health API', 'Hyperlocal EV Charging Network', 'AI-Powered Legal Contracts', 'D2C Longevity Supplements', 'Micro-SaaS for Solopreneurs', 'AR Retail Try-On Platform', 'Decentralised Identity Stack', 'GPT-Powered Tutoring App', 'Carbon Credit Marketplace', 'Real-Time Supply Chain AI', 'Sleep-Tech Wearables', 'API Economy for HR Tools', 'Quantum-Safe Encryption SaaS', 'Vertical AI for Dentists', 'Social Commerce for Gen-Z', 'Robotics-as-a-Service', 'Smart Water Management', 'AI Code Review Copilot', 'Peer-to-Peer Insurance Protocol', 'Voice Commerce Platform', 'NeuroFeedback Headband', 'Remote Work Productivity OS', 'Regenerative Fashion Platform', 'Autonomous Drone Delivery', 'Spatial Computing SDK', 'Digital Nomad Banking App', 'Anti-Hallucination AI Layer', 'Smart Home Energy OS', 'Gamified Language Learning', 'B2B Climate Reporting Tool', 'AI-Assisted Drug Discovery', 'Fractional Real Estate DAO'][i] || `Next-Gen Startup ${i + 1}`}`,
      pitch:
        'High-signal opportunity driven by converging macro trends. Early movers are seeing 3–5× faster growth with strong VC interest in 2025–2026.',
      vcJustification:
        'Strong PMF signal. Top-tier VCs have backed two analogous companies in the last 18 months.',
      categoryTags: [
        [
          'AI/SaaS',
          'FinTech',
          'HealthTech',
          'EdTech',
          'Climate/Sustainability',
          'Consumer Apps',
          'Hardware',
          'Deep-Tech/Moonshot',
          'Service/Local',
          'Other',
        ][i % 10],
        i % 3 === 0 ? 'B2B' : 'B2C',
      ],
      costEffort: [
        'Low capital / solo-founder',
        'Medium capital / small team',
        'High capital / co-founder needed',
      ][i % 3],
      revenuePotentialScore: Math.max(5, 10 - (i % 4)),
      revenueSkeleton: 'SaaS subscription ($49–$499/mo per seat) + usage-based overages',
      unfairAdvantage:
        'Proprietary training data from early enterprise clients creates compounding model accuracy advantage.',
      potentialExit:
        'Strategic acquisition by incumbent player (12–18× ARR). Comparable exits: $500M–$2B range.',
      trendSources: [
        'Google Trends spike +240% (last 30 days)',
        'YC W25 batch theme',
        'Andreessen Horowitz blog post',
      ],
      saturationLabel: i % 4 === 0 ? 'Blue Ocean' : 'Emerging',
      heatBadge: i % 5 === 0 ? 'Trending' : 'Early Bird',
      nextSteps: ['Run 20 ICP interviews', 'Build no-code MVP in 2 weeks', 'Launch on ProductHunt'],
      marketSize: '$2.4B TAM growing at 34% CAGR',
      competitorLandscape:
        i % 2 === 0
          ? 'Blue ocean — no direct competitors yet'
          : '2–3 early-stage startups; no dominant player',
      regulatoryFlags:
        i % 3 === 0 ? 'High — requires compliance review' : 'Low — no major regulatory barriers',
      timeToMarket: `${6 + (i % 12)} months`,
    }));
    return res.json({
      intro: `[DEV MOCK] Today's ${ideas.length} high-conviction opportunities — generated offline for development.`,
      ideas,
      disclaimer:
        'MOCK DATA — Not real AI output. Set DEV_MOCK=false in .env to use live Gemini generation.',
    });
  }

  try {
    // Pre-fetch live market signals to ground generation in real current data
    const { fetchLiveSignals, formatSignalsForPrompt } = await getSignalsModule();
    const signals = await fetchLiveSignals();
    const signalContext = formatSignalsForPrompt(signals);

    let promptStr = signalContext
      ? `${signalContext}\nUsing the live market signals above as your PRIMARY source, generate exactly 35 high-conviction business ideas for ${date}.\n\nREQUIREMENTS:\n- Every idea MUST cite ≥1 specific signal in trendSources — include the actual data point, not just the source name\n- Identify SECOND-ORDER opportunities: what problem does each trending signal CREATE that is currently undersolved?\n- Enforce sector diversity: no more than 3 ideas from any single sector (AI/ML, FinTech, HealthTech, EdTech, CleanTech, Consumer, B2B SaaS, Marketplace, PropTech, AgriTech, LegalTech, etc.)\n- The unfairAdvantage field must describe a STRUCTURAL edge (proprietary data, regulatory moat, distribution lock-in, network effects) — never "better UX" or "first mover"\n- Cover all effort levels: at least 8 ideas buildable solo in under 6 weeks, at least 8 requiring a small team, the rest for well-funded teams\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`
      : `Generate exactly 35 high-conviction business ideas for ${date}.\n\nREQUIREMENTS:\n- Enforce sector diversity: no more than 3 ideas from any single sector\n- Each idea must have a STRUCTURAL unfair advantage (proprietary data, regulatory moat, distribution lock-in, network effects)\n- Cover all effort levels: mix of solo-buildable, small team, and well-funded team ideas\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`;

    if (country && country !== 'Global' && countryCount > 0) {
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored for the market and demographics in ${country}. Ensure those ideas include the exact string "Local Market" in their categoryTags array.`;
    }

    const data = await generateWithGemini(promptStr, responseSchema);
    res.json(data);
  } catch (err: any) {
    console.error('Daily Generation Error:', err);
    res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
});

app.post('/api/generate/radar', featureLimiter, async (req, res) => {
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'radar';
  const cacheKey = `radar_${getToday()}`;

  if (process.env.DEV_MOCK === 'true') {
    return res.json({
      ...getMockResponse(featureType),
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

  try {
    const cached = getCached(cacheKey);
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

    const data = await generateWithGemini(
      'Perform a VC-grade market analysis. Provide 5 top trends, a core market shift, and 5 opportunity areas.',
      radarSchema,
      'You are a top-tier Venture Capital market analyst.'
    );
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('Radar Error:', err);
    res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
});

app.post('/api/generate/futurecasting', featureLimiter, async (req, res) => {
  const { horizon } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'futurecasting';
  const cacheKey = `futurecasting_${horizon || 'default'}`;

  if (process.env.DEV_MOCK === 'true') {
    const mock = getMockResponse(featureType);
    return res.json({
      ...mock,
      horizon: horizon || '2030',
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      horizon: { type: Type.STRING },
      predictions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            probability: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
            winners: { type: Type.ARRAY, items: { type: Type.STRING } },
            losers: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'probability', 'rationale', 'winners', 'losers'],
        },
      },
      paradigmShifts: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['horizon', 'predictions', 'paradigmShifts'],
  };

  try {
    const cached = getCached(cacheKey);
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
          error: 'Daily futurecasting limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      `Perform deep-future simulation for: ${horizon}.`,
      schema,
      'You are a futurist and startup strategist.'
    );
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('Futurecasting Error:', err);
    res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
});

app.post('/api/generate/action-plan', featureLimiter, async (req, res) => {
  const { idea } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'action-plan';
  const cacheKey = idea?.id ? `action-plan_${idea.id}` : '';

  if (process.env.DEV_MOCK === 'true') {
    return res.json({
      ...getMockResponse(featureType, idea),
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

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

  try {
    const cached = getCached(cacheKey);
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

    const data = await generateWithGemini(`Generate roadmap for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: 'Action plan failed.', details: err.message });
  }
});

app.post('/api/generate/build-me', featureLimiter, async (req, res) => {
  const { idea } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'build-me';
  const cacheKey = idea?.id ? `build-me_${idea.id}` : '';

  if (process.env.DEV_MOCK === 'true') {
    return res.json({
      ...getMockResponse(featureType, idea),
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      promptPack: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { title: { type: Type.STRING }, prompt: { type: Type.STRING } },
          required: ['title', 'prompt'],
        },
      },
      repoStructure: { type: Type.STRING },
      first24Hours: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['promptPack', 'repoStructure', 'first24Hours'],
  };

  try {
    const cached = getCached(cacheKey);
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
          error: 'Daily build-me limit reached. Upgrade for more blueprints.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Generate Build-me pack for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: 'Build-me failed.', details: err.message });
  }
});

app.post('/api/generate/validation', featureLimiter, async (req, res) => {
  const { idea } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'validation';
  const cacheKey = idea?.id ? `validation_${idea.id}` : '';

  if (process.env.DEV_MOCK === 'true') {
    return res.json({
      ...getMockResponse(featureType, idea),
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

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

  try {
    const cached = getCached(cacheKey);
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
          error: 'Daily validation limit reached. Upgrade for more toolkits.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      `Generate validation toolkit for: ${idea.headline}`,
      schema
    );
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: 'Validation toolkit failed.', details: err.message });
  }
});

app.post('/api/generate/alerts', featureLimiter, async (req, res) => {
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'alerts';
  const cacheKey = `alerts_${getToday()}`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        message: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['info', 'success', 'warning', 'error'] },
      },
      required: ['title', 'message', 'type'],
    },
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      // alerts returns an array — return as-is (client expects array)
      return res.json(cached);
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res.status(429).json({ error: 'Alert limit reached.' });
      }
    }

    const data = await generateWithGemini('Generate 3-5 high-signal Market Trend Alerts.', schema);
    setCached(cacheKey, data);
    res.json(data);
  } catch (err: any) {
    res.json([{ title: 'AI Spike', message: 'Market signals active.', type: 'success' }]);
  }
});

app.post('/api/generate/vetting', featureLimiter, async (req, res) => {
  const { idea } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'vetting';
  const cacheKey = idea?.id ? `vetting_${idea.id}` : '';

  if (process.env.DEV_MOCK === 'true') {
    return res.json({
      ...getMockResponse(featureType, idea),
      _mock: true,
      _usage: await buildUsageResponse(uid, tier, featureType),
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      verdict: { type: Type.STRING, enum: ['High Conviction', 'Moderate', 'Pass'] },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      pivotSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      comparableExits: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'score',
      'verdict',
      'strengths',
      'weaknesses',
      'pivotSuggestions',
      'comparableExits',
    ],
  };

  try {
    const cached = getCached(cacheKey);
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
          error: 'Daily vetting limit reached. Upgrade for more expert analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Perform expert vetting for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: 'Vetting failed.', details: err.message });
  }
});

app.post('/api/generate/explain', featureLimiter, async (req, res) => {
  const { idea, section, context } = req.body;
  const auth = await getAuthFromRequest(req);
  const uid = auth?.uid;
  const tier = auth?.tier || 'free';
  const featureType = 'explain';
  const cacheKey = idea?.id && section ? `explain_${idea.id}_${section.replace(/\s+/g, '_')}` : '';

  if (process.env.DEV_MOCK === 'true') {
    return res.json({ ...getMockResponse(featureType, idea), _mock: true });
  }

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res
          .status(429)
          .json({ text: 'Daily explanation limit reached. Upgrade for more.', _limited: true });
      }
    }

    const data = await generateWithGemini(
      `Explain step "${section}" for idea: ${idea.headline}. Context: ${context}.`
    );
    setCached(cacheKey, data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ text: 'Explanation unavailable.', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`BFF Server running on port ${port}`);
});
