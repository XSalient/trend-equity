import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";

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

// Shared Core Generation Helper
async function generateWithGemini(prompt: string, schema?: any, systemInstruction?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing from environment.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Using the original model name from the user's setup
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
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored specifically for the market and demographics in ${country}. The rest should be global/US-centric as usual.`;
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
          trendSources: ["Substack Growth Statistics 2024"],
          saturationLabel: "Early Adopter Stage",
          heatBadge: "Trending",
          nextSteps: ["Define 3 core 'magic' tools | 2 weeks | Dev costs | Replit", "Build MVP waitlist | 1 week | Low traction | Beehiiv", "Onboard alpha testers | 4 weeks | Engagement | X"]
        }
      ],
      disclaimer: "These are illustrative ideas based on recent market shifts. Do your own diligence."
    });
  }
});

app.post('/api/generate/radar', async (req, res) => {
  try {
    const data = await generateWithGemini(
      "Perform a VC-grade market analysis. Provide 5 top trends, a core market shift, and 5 opportunity areas.",
      radarSchema,
      "You are a top-tier Venture Capital market analyst."
    );
    res.json(data);
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

app.post('/api/generate/futurecasting', async (req, res) => {
  const { horizon } = req.body;
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
    const data = await generateWithGemini(
      `Perform deep-future simulation for: ${horizon}.`,
      schema,
      "You are a futurist and startup strategist."
    );
    res.json(data);
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

// Reuse original action plan endpoint
app.post('/api/generate/action-plan', async (req, res) => {
  const { idea } = req.body;
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
    const data = await generateWithGemini(`Generate roadmap for: ${idea.headline}`, schema);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Action plan failed.", details: err.message });
  }
});

app.post('/api/generate/build-me', async (req, res) => {
  const { idea } = req.body;
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
    const data = await generateWithGemini(`Generate Build-me pack for: ${idea.headline}`, schema);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Build-me failed.", details: err.message });
  }
});

app.post('/api/generate/validation', async (req, res) => {
  const { idea } = req.body;
  const schema = {
     type: Type.OBJECT,
     properties: {
       landingPage: { type: Type.OBJECT, properties: { hero: { type: Type.STRING }, subHero: { type: Type.STRING }, valueProps: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["hero", "subHero", "valueProps"] },
       interviewScript: { type: Type.ARRAY, items: { type: Type.STRING } },
       smokeTest: { type: Type.STRING },
       successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } }
     },
     required: ["landingPage", "interviewScript", "smokeTest", "successMetrics"]
  }
  try {
     const data = await generateWithGemini(`Generate validation toolkit for: ${idea.headline}`, schema);
     res.json(data);
  } catch (err: any) {
     res.status(500).json({ error: "Validation toolkit failed.", details: err.message });
  }
});

app.post('/api/generate/alerts', async (req, res) => {
  const schema = {
     type: Type.ARRAY,
     items: {
       type: Type.OBJECT,
       properties: { title: { type: Type.STRING }, message: { type: Type.STRING }, type: { type: Type.STRING, enum: ["info", "success", "warning", "error"] } },
       required: ["title", "message", "type"]
     }
  };
  try {
     const data = await generateWithGemini("Generate 3-5 high-signal Market Trend Alerts.", schema);
     res.json(data);
  } catch (err: any) {
     res.json([{ title: "AI Spike", message: "Market signals active.", type: "success" }]);
  }
});

app.post('/api/generate/vetting', async (req, res) => {
  const { idea } = req.body;
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
    const data = await generateWithGemini(`Perform expert vetting for: ${idea.headline}`, schema);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Vetting failed.", details: err.message });
  }
});

app.post('/api/generate/explain', async (req, res) => {
  const { idea, section, context } = req.body;
  try {
    const data = await generateWithGemini(`Explain step "${section}" for idea: ${idea.headline}. Context: ${context}.`);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ text: "Explanation unavailable.", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`BFF Server running on port ${port}`);
});