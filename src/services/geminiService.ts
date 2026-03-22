import { GoogleGenAI, Type } from "@google/genai";
import { Idea } from "../types";

import prompts from './prompts.json';

const SYSTEM_PROMPT = prompts.SYSTEM_PROMPT;

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

export async function generateDailyIdeas(date: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Use exponential backoff for quota issues
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
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

      return JSON.parse(response.text);
    } catch (error: any) {
      if (error.status === "RESOURCE_EXHAUSTED" || error.message?.includes("429")) {
        retryCount++;
        if (retryCount === maxRetries) throw error;
        // Wait before retrying: 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      } else {
        throw error;
      }
    }
  }
}

export async function generateFullActionPlan(idea: Idea) {
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text);
}

export async function explainPlanSection(idea: Idea, section: string, context: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `As a VC advisor, explain this specific section of the action plan for "${idea.headline}":
  Section: ${section}
  Context: ${context}
  
  Provide a deep dive into why this is important, how to execute it effectively, and what common pitfalls to avoid. 
  Keep it concise but highly actionable.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a senior VC advisor helping a founder execute their business plan."
    }
  });

  return response.text;
}

export async function generateBuildWithMe(idea: Idea) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate a "Build with Me" package for this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  
  Provide:
  1. A "Prompt Pack": 5-7 highly specific LLM prompts to help build the MVP (e.g., system architecture, database schema, landing page copy, initial API routes).
  2. A "Starter Repository Structure": A recommended file tree for the project.
  3. "First 24 Hours": A checklist of exactly what to do in the first 24 hours of building.
  
  Format as JSON.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      promptPack: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            prompt: { type: Type.STRING }
          },
          required: ["title", "prompt"]
        }
      },
      repoStructure: { type: Type.STRING },
      first24Hours: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["promptPack", "repoStructure", "first24Hours"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text);
}

export async function generateValidationToolkit(idea: Idea) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate a "Validation Toolkit" for this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  
  Provide:
  1. "Landing Page Copy": Hero headline, sub-headline, and 3 key value propositions for a smoke test.
  2. "Customer Interview Script": 5 critical questions to ask potential customers.
  3. "Smoke Test Strategy": A specific way to test demand with $0-$100 budget.
  4. "Success Metrics": What numbers indicate this idea is worth pursuing.
  
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text);
}

export async function generateAlerts() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Generate 3-5 "Market Trend Alerts" for today. 
  These should be high-signal, actionable alerts about emerging business opportunities, market shifts, or regulatory changes.
  Each alert should have a title, a brief message, and a type (info, success, warning, error).
  Format as JSON.`;

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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text);
}

export async function generateWeeklyTrendRadar() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Generate a "Weekly Trend Radar" for the current week. 
  Analyze the top 5 emerging market trends, shifts in consumer behavior, and high-potential opportunity areas.
  Format as JSON.`;

  const schema = {
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  return JSON.parse(response.text);
}

export async function generateFuturecasting(horizon: '2027' | '2030' | '2035') {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Perform a "Futurecasting" analysis for the year ${horizon}. 
  Predict 3 major paradigm shifts and 5 specific industry predictions with probability scores.
  Identify potential winners and losers for each prediction.
  Format as JSON.`;

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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  return JSON.parse(response.text);
}

export async function generateExpertVetting(idea: Idea) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `As a top-tier VC partner, perform an "Expert Vetting" of this business idea:
  Headline: ${idea.headline}
  Pitch: ${idea.pitch}
  VC Justification: ${idea.vcJustification}
  
  Provide a score (0-100), a verdict (High Conviction, Moderate, or Pass), and a deep analysis of strengths, weaknesses, and pivot suggestions.
  Format as JSON.`;

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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  return JSON.parse(response.text);
}
