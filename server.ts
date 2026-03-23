import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Load prompts with fallback
let localPrompts = { SYSTEM_PROMPT: '' };
try {
  // @ts-ignore - dynamic import for local dev only
  const promptsModule = await import('./src/services/prompts.json', { assert: { type: 'json' } });
  localPrompts = promptsModule.default;
} catch (e) {
  console.log('--- Notice: No local prompts.json found. Relying on environment variables. ---');
}

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || localPrompts.SYSTEM_PROMPT;

// --- Rate Limiting (Strategy C: IP-based shield) ---

// Global: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// Feature endpoints: 30 requests per hour per IP
const featureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly feature limit reached. Please try again later.' }
});

app.use(globalLimiter);

// --- In-Memory Feature Cache (Strategy D: extended caching) ---

interface CacheEntry { result: any; generatedAt: number; }
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

// --- Per-User Daily Usage Tracking (Strategy C: user-level throttle) ---

interface UserUsage { date: string; counts: Record<string, number>; }
const userUsageMap = new Map<string, UserUsage>();

const FEATURE_DAILY_LIMITS: Record<string, number> = {
  free: 3,
  pro: 15,
  builder: Infinity
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getUserUsage(uid: string, featureType: string): number {
  const usage = userUsageMap.get(uid);
  if (!usage || usage.date !== getToday()) return 0;
  return usage.counts[featureType] || 0;
}

/** Returns { allowed, remaining, limit }. Increments counter if allowed. */
function checkAndIncrementUsage(uid: string, tier: string, featureType: string): { allowed: boolean; remaining: number; limit: number } {
  const limit = FEATURE_DAILY_LIMITS[tier] ?? FEATURE_DAILY_LIMITS.free;
  if (!isFinite(limit)) return { allowed: true, remaining: Infinity, limit };

  const today = getToday();
  let usage = userUsageMap.get(uid);
  if (!usage || usage.date !== today) {
    usage = { date: today, counts: {} };
  }

  const current = usage.counts[featureType] || 0;
  if (current >= limit) {
    userUsageMap.set(uid, usage);
    return { allowed: false, remaining: 0, limit };
  }

  usage.counts[featureType] = current + 1;
  userUsageMap.set(uid, usage);
  return { allowed: true, remaining: limit - (current + 1), limit };
}

function buildUsageResponse(uid: string | undefined, tier: string | undefined, featureType: string) {
  if (!uid) return null;
  const t = tier || 'free';
  const limit = FEATURE_DAILY_LIMITS[t] ?? FEATURE_DAILY_LIMITS.free;
  const used = getUserUsage(uid, featureType);
  return {
    featureType,
    used,
    limit: isFinite(limit) ? limit : null,
    remaining: isFinite(limit) ? Math.max(0, limit - used) : null
  };
}

// --- Shared Gemini Helper ---

async function generateWithGemini(prompt: string, schema?: any, systemInstruction?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing from environment.");

  const ai = new GoogleGenAI({ apiKey });
  const modelToUse = "gemini-3-flash-preview";

  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || SYSTEM_PROMPT,
        responseMimeType: schema ? "application/json" : "text/plain",
        responseSchema: schema
      }
    });

    if (schema) {
      try {
        return JSON.parse(response.text);
      } catch (e) {
        console.error("JSON Parse Error:", response.text);
        throw new Error("AI returned invalid JSON structure.");
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
    nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [
    "headline", "pitch", "vcJustification", "categoryTags", "costEffort",
    "revenuePotentialScore", "revenueSkeleton", "unfairAdvantage",
    "potentialExit", "trendSources", "saturationLabel", "heatBadge", "nextSteps"
  ]
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intro: { type: Type.STRING },
    ideas: { type: Type.ARRAY, items: ideaSchema },
    disclaimer: { type: Type.STRING }
  },
  required: ["intro", "ideas", "disclaimer"]
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
          sector: { type: Type.STRING }
        },
        required: ["title", "description", "impact", "sector"]
      }
    },
    marketShift: { type: Type.STRING },
    opportunityAreas: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["week", "topTrends", "marketShift", "opportunityAreas"]
};

// --- Endpoints ---

app.post('/api/generate/daily', async (req, res) => {
  const { date, country, countryCount } = req.body;
  try {
    let promptStr = `Generate 35 business ideas for ${date}. Today context: ${date}.`;
    if (country && country !== 'Global' && countryCount > 0) {
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored specifically for the market and demographics in ${country}. The rest should be global/US-centric as usual. Ensure the localized ideas explicitly include the exact string "Local Market" in their categoryTags array.`;
    }

    const data = await generateWithGemini(promptStr, responseSchema);
    res.json(data);
  } catch (err: any) {
    console.error("Daily Generation Error (Falling back to mock):", err);
    res.json({
      intro: "Welcome to Trend-Equity. (Currently using cached market signals due to high demand)",
      ideas: [
        {
          headline: "AI-Powered Micro-SaaS for Niche Content Creators",
          pitch: "A suite of specific AI tools for newsletter authors and small-scale publishers to automate research and cross-platform promotion.",
          vcJustification: "Strong tailwinds in the solo-creator economy and high willingness to pay for productivity tools.",
          categoryTags: ["AI", "SaaS", "Creator Economy"],
          costEffort: "Low Capital, Medium Technical",
          revenuePotentialScore: 8,
          revenueSkeleton: "Tiered subscription model based on usage volume.",
          unfairAdvantage: "Proprietary fine-tuning on creator-specific content datasets.",
          potentialExit: "Acquisition by larger creator platforms (Substack, Beehiiv).",
          trendSources: ["Substack Growth Statistics 2026"],
          saturationLabel: "Early Adopter Stage",
          heatBadge: "Trending",
          nextSteps: ["Define 3 core 'magic' tools | 2 weeks | Dev costs | Replit", "Build MVP waitlist | 1 week | Low traction | Beehiiv", "Onboard alpha testers | 4 weeks | Engagement | X"]
        },
        {
          headline: "Autonomous Drone Delivery for Rural Pharmacies",
          pitch: "Last-mile prescription delivery via autonomous drones for underserved rural communities.",
          vcJustification: "Healthcare access gaps drive policy support and grant funding.",
          categoryTags: ["HealthTech", "Hardware", "Deep-Tech/Moonshot"],
          costEffort: "High Capital, High Technical",
          revenuePotentialScore: 9,
          revenueSkeleton: "Per-delivery fees plus pharmacy SaaS subscriptions.",
          unfairAdvantage: "FAA exemption pipeline and partnerships with rural hospital networks.",
          potentialExit: "Acquisition by Amazon Pharmacy or UPS Health.",
          trendSources: ["FAA Drone Regulations 2026", "Rural Health Equity Report"],
          saturationLabel: "Pre-Market",
          heatBadge: "Hot",
          nextSteps: ["Secure FAA Part 135 exemption | 12 weeks | Legal | FAA Portal", "Pilot with 3 rural pharmacies | 8 weeks | Partnerships | Cold outreach"]
        },
        {
          headline: "Green Subscription Boxes for Gen-Z",
          pitch: "Monthly curated sustainable product boxes with carbon-offset tracking and social sharing built in.",
          vcJustification: "Gen-Z spending on sustainable goods is growing 3x faster than general retail.",
          categoryTags: ["Consumer Apps", "Climate/Sustainability"],
          costEffort: "Medium Capital, Low Technical",
          revenuePotentialScore: 7,
          revenueSkeleton: "Monthly subscriptions at $29-$49/mo with 60% margins on curated goods.",
          unfairAdvantage: "TikTok-native unboxing virality engine.",
          potentialExit: "Acquisition by Grove Collaborative or Thrive Market.",
          trendSources: ["Deloitte Gen-Z Sustainability Survey 2026"],
          saturationLabel: "Growing",
          heatBadge: "Warm",
          nextSteps: ["Source 10 sustainable brands | 3 weeks | Partnerships | LinkedIn", "Launch TikTok pre-order campaign | 2 weeks | Low | TikTok Ads"]
        },
        {
          headline: "AI Study Buddy for Competitive Exam Prep",
          pitch: "A personalized AI tutor that adapts to individual learning patterns for national competitive exams.",
          vcJustification: "Massive TAM in education-focused markets with high willingness to pay for exam prep.",
          categoryTags: ["EdTech", "AI", "Local Market"],
          costEffort: "Medium Capital, Medium Technical",
          revenuePotentialScore: 8,
          revenueSkeleton: "Freemium with premium tiers at $15-$30/month.",
          unfairAdvantage: "Proprietary question bank trained on decade of past exam data.",
          potentialExit: "Acquisition by Byju's, Unacademy, or Chegg.",
          trendSources: ["EdTech Market Report 2026", "National Education Statistics"],
          saturationLabel: "Growing",
          heatBadge: "Trending",
          nextSteps: ["Build question bank for top 3 exams | 4 weeks | Dev | OpenAI API", "Beta launch with 500 students | 6 weeks | Marketing | Instagram"]
        },
        {
          headline: "Hyperlocal Food Waste Marketplace",
          pitch: "A marketplace connecting restaurants and grocery stores with surplus food to budget-conscious consumers at 70% discounts.",
          vcJustification: "Food waste regulation is tightening globally, creating compliance-driven demand.",
          categoryTags: ["Service/Local/On-Demand", "Climate/Sustainability", "Local Market"],
          costEffort: "Low Capital, Medium Technical",
          revenuePotentialScore: 7,
          revenueSkeleton: "15% commission on each transaction plus premium restaurant listings.",
          unfairAdvantage: "Real-time inventory integration with POS systems.",
          potentialExit: "Acquisition by DoorDash, Too Good To Go, or Uber Eats.",
          trendSources: ["EU Food Waste Directive 2026", "USDA Food Loss Report"],
          saturationLabel: "Early Adopter Stage",
          heatBadge: "Warm",
          nextSteps: ["Partner with 20 local restaurants | 3 weeks | Outreach | Google Maps", "Build mobile app MVP | 4 weeks | Dev costs | Flutter"]
        },
        {
          headline: "B2B Carbon Credit Verification Platform",
          pitch: "An AI-powered platform that automates carbon credit verification and trading for mid-market enterprises.",
          vcJustification: "Carbon markets are projected to reach $50B by 2030 with increasing regulatory pressure.",
          categoryTags: ["FinTech", "Climate/Sustainability", "SaaS"],
          costEffort: "High Capital, High Technical",
          revenuePotentialScore: 9,
          revenueSkeleton: "Per-verification fees plus annual platform subscriptions.",
          unfairAdvantage: "Satellite imagery AI that detects greenwashing in real-time.",
          potentialExit: "IPO or acquisition by Bloomberg or Refinitiv.",
          trendSources: ["World Bank Carbon Pricing Report 2026"],
          saturationLabel: "Low Competition",
          heatBadge: "Hot",
          nextSteps: ["Build satellite data pipeline | 8 weeks | Heavy Dev | AWS", "Pilot with 5 mid-market companies | 6 weeks | Sales | LinkedIn"]
        },
        {
          headline: "Regional Language Voice Commerce Assistant",
          pitch: "A voice-first shopping assistant that lets users browse and buy from local e-commerce in their native regional language.",
          vcJustification: "Voice commerce is the fastest-growing channel in multilingual markets.",
          categoryTags: ["AI", "Consumer Apps", "Local Market"],
          costEffort: "Medium Capital, High Technical",
          revenuePotentialScore: 8,
          revenueSkeleton: "Affiliate commissions plus premium merchant partnerships.",
          unfairAdvantage: "Fine-tuned ASR models for underserved regional dialects.",
          potentialExit: "Acquisition by Amazon Alexa or Google Assistant.",
          trendSources: ["Voice Commerce Trends 2026", "Regional Internet Adoption Report"],
          saturationLabel: "Pre-Market",
          heatBadge: "Trending",
          nextSteps: ["Train voice models for top 5 regional languages | 6 weeks | ML | GCP", "Partner with 3 regional e-commerce platforms | 4 weeks | BD | Email"]
        },
        {
          headline: "Peer-to-Peer EV Charging Network",
          pitch: "A platform that lets homeowners rent out their EV chargers to nearby drivers, Airbnb-style.",
          vcJustification: "EV adoption is outpacing charging infrastructure 4:1.",
          categoryTags: ["Hardware", "Service/Local/On-Demand", "Climate/Sustainability"],
          costEffort: "Medium Capital, Medium Technical",
          revenuePotentialScore: 8,
          revenueSkeleton: "20% platform fee on each charging session.",
          unfairAdvantage: "Smart pricing algorithm based on grid demand and local EV density.",
          potentialExit: "Acquisition by ChargePoint, Tesla, or Shell Recharge.",
          trendSources: ["IEA Global EV Outlook 2026"],
          saturationLabel: "Early Adopter Stage",
          heatBadge: "Hot",
          nextSteps: ["Build IoT smart lock for chargers | 6 weeks | Hardware | Arduino", "Launch in 3 high-EV-density neighborhoods | 4 weeks | Geo-targeted ads"]
        },
        {
          headline: "Local Artisan Marketplace with AR Try-On",
          pitch: "An e-commerce platform for local artisans featuring AR-powered product visualization for handmade goods.",
          vcJustification: "The handmade goods market is booming as consumers shift away from mass production.",
          categoryTags: ["Consumer Apps", "Local Market"],
          costEffort: "Medium Capital, Medium Technical",
          revenuePotentialScore: 7,
          revenueSkeleton: "12% marketplace commission plus premium storefront subscriptions.",
          unfairAdvantage: "AR pipeline that works on low-end devices without app download.",
          potentialExit: "Acquisition by Etsy or Shopify.",
          trendSources: ["Handmade Economy Report 2026", "AR Commerce Trends"],
          saturationLabel: "Growing",
          heatBadge: "Warm",
          nextSteps: ["Onboard 50 local artisans | 3 weeks | Outreach | Instagram DMs", "Build WebAR try-on prototype | 5 weeks | Dev | Three.js"]
        },
        {
          headline: "Neighborhood Micro-Investment Platform",
          pitch: "Let residents invest small amounts ($50-$500) in local businesses like cafes, gyms, and shops in exchange for revenue share and perks.",
          vcJustification: "Community-driven finance is surging as trust in traditional banking erodes.",
          categoryTags: ["FinTech", "Service/Local/On-Demand", "Local Market"],
          costEffort: "High Capital, Medium Technical",
          revenuePotentialScore: 8,
          revenueSkeleton: "2.5% platform fee on investments plus premium business analytics tier.",
          unfairAdvantage: "Hyperlocal trust graph built from neighborhood social data.",
          potentialExit: "Acquisition by Republic, Wefunder, or Block (Square).",
          trendSources: ["Community Finance Survey 2026", "SEC Reg CF Updates"],
          saturationLabel: "Low Competition",
          heatBadge: "Hot",
          nextSteps: ["Obtain SEC Reg CF compliance | 8 weeks | Legal | Attorney", "Pilot in 2 neighborhoods with 10 businesses each | 6 weeks | Outreach"]
        }
      ],
      disclaimer: "These are illustrative ideas based on recent market shifts. Do your own diligence."
    });
  }
});

app.post('/api/generate/radar', featureLimiter, async (req, res) => {
  const { uid, tier } = req.body;
  const featureType = 'radar';
  const today = getToday();
  const cacheKey = `radar_${today}`;

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily radar limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(
      "Perform a VC-grade market analysis. Provide 5 top trends, a core market shift, and 5 opportunity areas.",
      radarSchema,
      "You are a top-tier Venture Capital market analyst."
    );
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error("Radar Error (Falling back to mock):", err);
    res.json({
      week: "March 2026",
      topTrends: [
        { title: "Autonomous Grid Balancers", description: "AI-driven local energy storage and distribution optimization.", impact: "High", sector: "Energy" },
        { title: "Verticalized AI Law Assistants", description: "Hyper-specialized LLMs for specific niche legal code (e.g., Maritime Law).", impact: "Medium", sector: "LegalTech" }
      ],
      marketShift: "Transition from 'Chat-based AI' to 'Agentic-native Workflows' across all B2B sectors.",
      opportunityAreas: ["Micro-storage systems", "Privacy-first training data sets", "Agent orchestration layers"]
    });
  }
});

app.post('/api/generate/futurecasting', featureLimiter, async (req, res) => {
  const { horizon, uid, tier } = req.body;
  const featureType = 'futurecasting';
  const cacheKey = `futurecasting_${horizon || 'default'}`;

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
            losers: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "probability", "rationale", "winners", "losers"]
        }
      },
      paradigmShifts: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["horizon", "predictions", "paradigmShifts"]
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily futurecasting limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(
      `Perform deep-future simulation for: ${horizon}.`,
      schema,
      "You are a futurist and startup strategist."
    );
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error("Futurecasting Error (Falling back to mock):", err);
    res.json({
      horizon: horizon || '2030',
      predictions: [
        { title: "Personal AI Companionship Market Peaks", probability: 85, rationale: "Saturation of loneliness-driven tech in urban centers.", winners: ["Personalized LLM providers"], losers: ["Generic social media apps"] }
      ],
      paradigmShifts: ["Post-labor economy in service sectors", "Ubiquitous AR integration"]
    });
  }
});

app.post('/api/generate/action-plan', featureLimiter, async (req, res) => {
  const { idea, uid, tier } = req.body;
  const featureType = 'action-plan';
  const cacheKey = idea?.id ? `action-plan_${idea.id}` : '';

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
            milestone: { type: Type.STRING }
          },
          required: ["id", "step", "details", "milestone"]
        }
      },
      tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      risks: { type: Type.ARRAY, items: { type: Type.STRING } },
      timeline: { type: Type.STRING }
    },
    required: ["roadmap", "tools", "risks", "timeline"]
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily action plan limit reached. Upgrade for more plans.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(`Generate roadmap for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: "Action plan failed.", details: err.message });
  }
});

app.post('/api/generate/build-me', featureLimiter, async (req, res) => {
  const { idea, uid, tier } = req.body;
  const featureType = 'build-me';
  const cacheKey = idea?.id ? `build-me_${idea.id}` : '';

  const schema = {
    type: Type.OBJECT,
    properties: {
      promptPack: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { title: { type: Type.STRING }, prompt: { type: Type.STRING } },
          required: ["title", "prompt"]
        }
      },
      repoStructure: { type: Type.STRING },
      first24Hours: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["promptPack", "repoStructure", "first24Hours"]
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily build-me limit reached. Upgrade for more blueprints.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(`Generate Build-me pack for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: "Build-me failed.", details: err.message });
  }
});

app.post('/api/generate/validation', featureLimiter, async (req, res) => {
  const { idea, uid, tier } = req.body;
  const featureType = 'validation';
  const cacheKey = idea?.id ? `validation_${idea.id}` : '';

  const schema = {
    type: Type.OBJECT,
    properties: {
      landingPage: { type: Type.OBJECT, properties: { hero: { type: Type.STRING }, subHero: { type: Type.STRING }, valueProps: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["hero", "subHero", "valueProps"] },
      interviewScript: { type: Type.ARRAY, items: { type: Type.STRING } },
      smokeTest: { type: Type.STRING },
      successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["landingPage", "interviewScript", "smokeTest", "successMetrics"]
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily validation limit reached. Upgrade for more toolkits.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(`Generate validation toolkit for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: "Validation toolkit failed.", details: err.message });
  }
});

app.post('/api/generate/alerts', featureLimiter, async (req, res) => {
  const { uid, tier } = req.body;
  const featureType = 'alerts';
  const cacheKey = `alerts_${getToday()}`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: { title: { type: Type.STRING }, message: { type: Type.STRING }, type: { type: Type.STRING, enum: ["info", "success", "warning", "error"] } },
      required: ["title", "message", "type"]
    }
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      // alerts returns an array — return as-is (client expects array)
      return res.json(cached);
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({ error: 'Alert limit reached.' });
      }
    }

    const data = await generateWithGemini("Generate 3-5 high-signal Market Trend Alerts.", schema);
    setCached(cacheKey, data);
    res.json(data);
  } catch (err: any) {
    res.json([{ title: "AI Spike", message: "Market signals active.", type: "success" }]);
  }
});

app.post('/api/generate/vetting', featureLimiter, async (req, res) => {
  const { idea, uid, tier } = req.body;
  const featureType = 'vetting';
  const cacheKey = idea?.id ? `vetting_${idea.id}` : '';

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      verdict: { type: Type.STRING, enum: ["High Conviction", "Moderate", "Pass"] },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      pivotSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      comparableExits: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["score", "verdict", "strengths", "weaknesses", "pivotSuggestions", "comparableExits"]
  };

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily vetting limit reached. Upgrade for more expert analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit }
        });
      }
    }

    const data = await generateWithGemini(`Perform expert vetting for: ${idea.headline}`, schema);
    setCached(cacheKey, data);
    res.json({ ...data, _usage: buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    res.status(500).json({ error: "Vetting failed.", details: err.message });
  }
});

app.post('/api/generate/explain', featureLimiter, async (req, res) => {
  const { idea, section, context, uid, tier } = req.body;
  const featureType = 'explain';
  const cacheKey = idea?.id && section ? `explain_${idea.id}_${section.replace(/\s+/g, '_')}` : '';

  try {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    if (uid) {
      const usage = checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({ text: 'Daily explanation limit reached. Upgrade for more.', _limited: true });
      }
    }

    const data = await generateWithGemini(`Explain step "${section}" for idea: ${idea.headline}. Context: ${context}.`);
    setCached(cacheKey, data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ text: "Explanation unavailable.", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`BFF Server running on port ${port}`);
});
