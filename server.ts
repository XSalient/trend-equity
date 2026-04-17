import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import rateLimit from 'express-rate-limit';
import { getMockResponse } from './server.mocks.js';
import { getAdminDb } from './api/_lib/admin';
import { normalizeAIResponse } from './api/_lib/ai-provider';
import AI from './api/_lib/ai-provider';
const { generateWithAI, Type, getToday, dailyResponseSchema: responseSchema, ideaSchema } = AI;

// Load modules dynamically to bypass persistent tsx resolution issues
async function getUsageModule() {
  return await import('./api/_lib/usage.ts');
}
async function getAdminAuthModule() {
  return await import('./api/_lib/admin.ts');
}
async function getAIModule() {
  return await import('./api/_lib/ai-provider');
}
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
    const { getAdminAuth } = await getAdminAuthModule();
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, tier: (decoded as any).tier || 'free' };
  } catch {
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
  console.log('[SERVER] Received POST /api/generate/daily');
  const auth = await getAuthFromRequest(req);
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
    const signals = await fetchLiveSignals();
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
    console.error('[SERVER] Daily generation failed:', err);
    res.status(500).json({ error: err.message });
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

    const prompt = `Analyze: ${ideaDescription}`;
    const idea = await generateWithAI(prompt, ideaSchema);
    idea.id = `custom-${uid}-${Date.now()}`;

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
  app.listen(port, () => {
    console.log(`BFF Server running on port ${port}`);
  });
});
