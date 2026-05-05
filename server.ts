import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import rateLimit from 'express-rate-limit';
import { getMockResponse } from './server.mocks.js';
import { getAdminDb } from './api/_lib/admin';
import { normalizeAIResponse } from './api/_lib/ai-provider';
import AI from './api/_lib/ai-provider';
const { generateWithAI, Type, getToday, dailyResponseSchema: responseSchema, ideaSchema } = AI;

console.log('[DEBUG] Server starting, imports resolved.');
// Load modules dynamically to bypass persistent tsx resolution issues
async function getUsageModule() {
  return await import('./api/_lib/usage');
}
async function getAdminAuthModule() {
  return await import('./api/_lib/admin');
}
async function getAIModule() {
  return await import('./api/_lib/ai-provider');
}
let _signals: typeof import('./api/_lib/signals') | null = null;
async function getSignalsModule() {
  if (!_signals) _signals = await import('./api/_lib/signals');
  return _signals;
}

// --- Auth helper: extract uid + tier from Bearer token ---
// --- Auth helper: extract uid + tier from Bearer token with Firestore fallback ---
async function getAuthFromRequest(
  req: express.Request
): Promise<{ uid: string; tier: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const { getAdminAuth } = await getAdminAuthModule();
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;
    let tier = (decoded as any).tier || 'free';

    // FIX: If token claim is 'free', fallback to Firestore to check for recent upgrades
    if (tier === 'free') {
      const { getAdminDb } = await getAdminAuthModule();
      const userDoc = await getAdminDb().collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data()?.tier) {
        tier = userDoc.data()?.tier;
      }
    }

    return { uid, tier };
  } catch (err) {
    console.error('[getAuthFromRequest] Auth verification failed:', err);
    return null;
  }
}

// ─── Production safety guard ──────────────────────────────────────────────────
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

// --- Rate Limiting ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const featureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly feature limit reached. Please try again later.' },
});

app.use(globalLimiter);

// --- In-Memory Feature Cache ---
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

app.post('/api/generate/daily', async (req, res) => {
  const auth = await getAuthFromRequest(req);
  console.log('[SERVER] Daily Generation Triggered. Auth success:', !!auth, 'Tier:', auth?.tier);
  if (!auth) return res.status(401).json({ error: 'Authentication required.' });

  const { uid, tier } = auth;
  const { buildDailyUsageResponse } = await getUsageModule();
  const today = new Date().toISOString().split('T')[0];

  // 1. Singleton Check: Does today already exist?
  try {
    const db = getAdminDb();
    const docRef = db.collection('daily_generations').doc(today);
    const existing = await docRef.get();

    if (existing.exists) {
      console.log(`[SERVER] Daily ideas for ${today} already exist. Returning cached version.`);
      return res.json({
        ...existing.data(),
        _usage: await buildDailyUsageResponse(uid, tier, 'daily'),
      });
    }

    // 2. Authorization: Only allow specific users or 'builder/admin' to trigger the FIRST generation
    // FIX: User requested "once for all users", so we restrict the trigger.
    if (tier !== 'builder') {
      console.warn(`[SERVER] Unauthorized generation attempt by user ${uid} with tier ${tier}`);
      return res
        .status(403)
        .json({ error: 'Daily ideas are currently being curated. Please check back shortly.' });
    }

    // 3. Locking: Use a temporary 'generating' document to prevent concurrent AI calls
    const lockRef = db.collection('locks').doc(`daily_gen_${today}`);
    const isLocked = await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists && lockSnap.data()?.status === 'generating') {
        const startedAt = lockSnap.data()?.startedAt?.toDate();
        // Timeout lock after 5 minutes in case of crash
        if (startedAt && Date.now() - startedAt.getTime() < 5 * 60 * 1000) return true;
      }
      tx.set(lockRef, { status: 'generating', startedAt: new Date(), uid });
      return false;
    });

    if (isLocked) {
      return res
        .status(429)
        .json({ error: 'Generation already in progress. Please refresh in a minute.' });
    }

    console.log(`[SERVER] Initiating singleton generation for ${today}...`);
    const { fetchLiveSignals, formatSignalsForPrompt } = await getSignalsModule();
    console.log('[DEBUG] Fetching live signals...');
    const signals = await fetchLiveSignals();
    console.log('[DEBUG] Live signals fetched:', !!signals);
    const signalContext = formatSignalsForPrompt(signals);

    const rawData = await generateWithAI(signalContext || 'Generate ideas', responseSchema);

    // Recovery & Normalization
    const data = normalizeAIResponse(rawData, ['ideas'], {
      intro: "Today's high-signal ideas, curated from live market trends.",
      ideas: [],
      disclaimer:
        'All ideas are AI-generated from real market signals. Do your own research before investing.',
      date: today,
      generatedAt: new Date().toISOString(),
    });

    // 4. Persist and Unlock
    await docRef.set({
      ...data,
      date: today,
      generatedAt: new Date().toISOString(),
    });
    await lockRef.delete();

    res.json({ ...data, _usage: await buildDailyUsageResponse(uid, tier, 'daily') });
  } catch (err: any) {
    console.error('[SERVER] Daily generation CRITICAL FAILURE:', err);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

app.post('/api/generate/analyze-idea', featureLimiter, async (req, res) => {
  const auth = await getAuthFromRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required.' });
  const { uid, tier } = auth;
  const { checkAndIncrementMonthlyUsage, buildDailyUsageResponse } = await getUsageModule();

  if (tier === 'free') return res.status(403).json({ error: 'Pro required' });

  const ideaDescription = req.body?.ideaDescription?.slice(0, 5000);
  const limit = tier === 'builder' ? 20 : 5;

  try {
    const usageCheck = await checkAndIncrementMonthlyUsage(uid, limit, 'analyze-idea');
    if (!usageCheck.allowed) return res.status(429).json({ error: 'Limit reached' });

    const prompt = `
      You are Trend-Equity's principal venture scout. A founder has submitted the following business concept for a deep VC-grade analysis:
      
      CONCEPT: "${ideaDescription}"
      
      TASK:
      Perform a comprehensive analysis and return a single JSON object. You must fill out EVERY field in the schema with high-quality, professional insights. 
      
      SPECIFIC INSTRUCTIONS:
      - headline: Create a punchy, 3-5 word headline for this idea.
      - vcJustification: Provide a 2-3 sentence high-conviction bull case. Why invest now?
      - pitch: A compelling, 1-sentence value proposition.
      - revenueSkeleton: Describe 2-3 specific monetization levers (e.g. "SaaS Subscription", "API Usage Fee").
      - unfairAdvantage: Identify a structural moat (data moat, network effects, etc.).
      - costEffort: MVP complexity (e.g. "Medium - Full stack").
      - trendSources: Cite 2-3 specific real-world signals or market shifts from 2024-2026.
      - nextSteps: Provide 3 actionable items for the first 30 days.
      - marketSize: Estimate the TAM (e.g. "$5B growing at 12% CAGR").
      - competitorLandscape: Identify 2-3 direct or indirect competitors.
      - regulatoryFlags: Identify any legal or compliance hurdles (e.g. "GDPR compliance required").
      - categoryTags: Provide 3-4 relevant tags (e.g. ["SaaS", "AI", "HealthTech"]).
      - revenuePotentialScore: A number from 1-10.
      - potentialExit: Describe the likely exit path (e.g. "Acquisition by Big Tech").
      - saturationLabel: Describe market density (e.g. "Blue Ocean" or "Competitive").
      - heatBadge: A status badge (e.g. "Exploding", "Steady", "Niche").
      
      IMPORTANT: Do not leave any fields empty. If a field is missing or says "N/A", the analysis is considered a failure.
    `;
    const rawIdea = await generateWithAI(prompt, ideaSchema);
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
      competitorLandscape: '',
      regulatoryFlags: '',
      marketSize: '',
    });

    res.json({ idea, _usage: await buildDailyUsageResponse(uid, tier, 'analyze-idea') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usage/analyze-idea', async (req, res) => {
  const auth = await getAuthFromRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required.' });
  const { uid, tier } = auth;

  const { getMonthlyUsageCount } = await getUsageModule();
  const limit = tier === 'builder' ? 20 : tier === 'pro' ? 5 : 0;
  const used = await getMonthlyUsageCount(uid, 'analyze-idea');
  res.json({
    featureType: 'analyze-idea',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: 'next month',
  });
});

/**
 * Mount remaining Vercel serverless handlers onto Express.
 * Each api/generate/*.ts exports a default function(req, res).
 * We wrap Express req/res into a minimal VercelRequest/VercelResponse-compatible shim
 * so the same handler code works for both local dev and Vercel production.
 */
async function mountVercelRoutes() {
  const routes: { method: 'post' | 'get'; path: string; file: string }[] = [
    { method: 'post', path: '/api/generate/action-plan', file: './api/generate/action-plan.ts' },
    { method: 'post', path: '/api/generate/alerts', file: './api/generate/alerts.ts' },
    { method: 'post', path: '/api/generate/build-me', file: './api/generate/build-me.ts' },
    { method: 'post', path: '/api/generate/explain', file: './api/generate/explain.ts' },
    {
      method: 'post',
      path: '/api/generate/futurecasting',
      file: './api/generate/futurecasting.ts',
    },
    { method: 'post', path: '/api/generate/radar', file: './api/generate/radar.ts' },
    { method: 'post', path: '/api/generate/validation', file: './api/generate/validation.ts' },
    { method: 'post', path: '/api/generate/vetting', file: './api/generate/vetting.ts' },
  ];

  for (const route of routes) {
    try {
      const mod = await import(route.file);
      const handler = mod.default ?? mod;
      app[route.method](route.path, async (req: express.Request, res: express.Response) => {
        try {
          await handler(req, res);
        } catch (err: any) {
          if (!res.headersSent) res.status(500).json({ error: err.message });
        }
      });
      console.log(`[routes] Mounted ${route.method.toUpperCase()} ${route.path}`);
    } catch (err: any) {
      console.warn(`[routes] Failed to mount ${route.path}:`, err.message);
    }
  }
}

mountVercelRoutes().then(() => {
  const server = app.listen(port, () => {
    console.log(`BFF Server running on port ${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${port} is already in use.`);
      console.error(`        Try running: npm run clean:ports\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });
});
