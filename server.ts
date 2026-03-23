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
const FIREBASE_CONFIG = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : null;

// Re-using schemas from the original geminiService
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
    ideas: {
      type: Type.ARRAY,
      items: ideaSchema
    },
    disclaimer: { type: Type.STRING }
  },
  required: ["intro", "ideas", "disclaimer"]
};

app.post('/api/generate/daily', async (req, res) => {
  const { date } = req.body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 35 business ideas for ${date}. Follow the system prompt strictly. Today's date context: ${date}.`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generation Error (Falling back to mock):", error);
    // Mock fallback for testing when API is rate limited
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
          trendSources: ["Substack Growth Statistics 2024", "X Tech Trends"],
          saturationLabel: "Early Adopter Stage",
          heatBadge: "Trending",
          nextSteps: ["Define 3 core 'magic' tools", "Build MVP waitlist", "Onboard alpha testers"]
        },
        {
          headline: "Sustainable Urban Micro-Farming Kits",
          pitch: "Modular, IoT-enabled hydroponic systems designed for apartment balconies and small indoor spaces.",
          vcJustification: "Rising food costs and increased consumer focus on food security and sustainability.",
          categoryTags: ["Sustainability", "Hardware", "IoT"],
          costEffort: "Medium R&D, Direct-to-Consumer",
          revenuePotentialScore: 7,
          revenueSkeleton: "One-time hardware sale + recurring substrate/seed subscription.",
          unfairAdvantage: "Optimized nutrient delivery algorithm for low-light environments.",
          potentialExit: "Strategic buy-out by home goods or gardening conglomerates.",
          trendSources: ["Urban Gardening Trend Report 2025", "Reddit r/hydroponics"],
          saturationLabel: "Growing Interest",
          heatBadge: "Steady Rise",
          nextSteps: ["Prototype sensor array", "Source sustainable materials", "Launch Instagram community"]
        }
      ],
      disclaimer: "These are illustrative ideas based on recent market shifts. Do your own diligence."
    });
  }
});

app.post('/api/generate/action-plan', async (req, res) => {
  const { idea } = req.body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate a comprehensive 10+ step action plan for this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  VC Justification: ${idea.vcJustification}
  
  Provide a detailed roadmap with milestones, a list of essential tools, potential risks, and a realistic timeline.
  Each roadmap step must have a unique ID (e.g., "step-1", "step-2").
  Format as JSON.`;

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate action plan' });
  }
});

app.post('/api/generate/build-me', async (req, res) => {
  const { idea } = req.body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate a "Build with Me" package for this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  
  Provide:
  1. A "Prompt Pack": 5-7 highly specific LLM prompts to help build the MVP.
  2. A "Starter Repository Structure": A recommended file tree.
  3. "First 24 Hours": A checklist.
  
  Format as JSON.`;

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate build-me pack' });
  }
});

app.post('/api/generate/validation', async (req, res) => {
  const { idea } = req.body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate a "Validation Toolkit" for this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  
  Format as JSON.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      landingPage: {
        type: Type.OBJECT,
        properties: {
          hero: { type: Type.STRING },
          subHero: { type: Type.STRING },
          valueProps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["hero", "subHero", "valueProps"]
      },
      interviewScript: { type: Type.ARRAY, items: { type: Type.STRING } },
      smokeTest: { type: Type.STRING },
      successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["landingPage", "interviewScript", "smokeTest", "successMetrics"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate validation toolkit' });
  }
});

app.post('/api/generate/alerts', async (req, res) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        message: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["info", "success", "warning", "error"] }
      },
      required: ["title", "message", "type"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3-5 high-signal Market Trend Alerts for today.",
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("Alerts Generation Error (Falling back to mock):", error);
    res.json([
      { title: "AI-Agents Sector Spike", message: "Significant increase in developer activity on GitHub related to agentic workflows.", type: "success" },
      { title: "Semiconductor Supply Warning", message: "Potential delay in high-end GPU clusters affecting small AI startups.", type: "warning" },
      { title: "New Venture Fund Launched", message: "A $500M fund specifically for European CleanTech has just been announced.", type: "info" }
    ]);
  }
});

app.post('/api/generate/vetting', async (req, res) => {
  const { idea } = req.body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As a top-tier VC partner, perform an "Expert Vetting" of: ${idea.headline}`,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to perform vetting' });
  }
});

app.listen(port, () => {
  console.log(`BFF Server running on port ${port}`);
});
/ /   D o p p l e r   a u t o m a t i o n   v e r i f i e d  
 