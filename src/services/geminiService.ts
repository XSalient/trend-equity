import { GoogleGenAI, Type } from "@google/genai";
import { Idea } from "../types";

const SYSTEM_PROMPT = `You are the Trend-Equity Idea Generator, a strict VC-filtered business idea engine for the Trend-Equity mobile app. Your output must be exactly 25 fresh, investable business ideas every run, presented as a daily news-style feed. Current date is always today.

Core Mission:
- Generate 25 business ideas derived exclusively from real-time public trends, questions, problems, and pain points pulled today.
- Each idea is a "Shark Tank"-style pitch: exciting, concise, realistic.
- Every idea must pass strict VC logic: justify "why now", strong unfair advantage, credible revenue path, and realistic exit.
- Treat this as high-velocity inspiration — execution is 100% on the user. Include disclaimer at end.

Trend Ingestion & Source of Truth (MANDATORY — base ALL ideas here):
- Use only today's/very recent signals from these fixed core sources:
    - Google Trends rising/breakout searches (e.g., Eid Mubarak 2026, Ramadan 2026, March Madness / NCAA basketball / wrestling, sports events, AI tools, geopolitical/energy/tariff shocks, holiday images/wishes).
    - X/Twitter: pain/frustration posts, "how do I", "I wish there was", "business idea" discussions (semantic/keyword matches: "pain point", "side hustle", "frustrated with", "emerging opportunity").
    - Reddit: hot/new in r/Entrepreneur, r/startups, r/smallbusiness, r/SaaS, r/indiehackers, r/sidehustle, r/Business_Ideas (plus extensions like r/EntrepreneurRideAlong, r/AI_Agents).
    - Hacker News / news: AI agents, automation, supply chain, energy, regulatory shifts, economic uncertainty.
- Supplement with high-signal secondary sources when they strengthen "why now" or demand proof (pull real-time where possible):
    - YC Request for Startups (Spring 2026 edition: AI-native workflows, autonomous agents, verticalized AI, new financial primitives, modern industrial systems, AI agencies, physical-work guidance, etc.)
    - Executive surveys/outlooks: Conference Board C-Suite Outlook 2026 (uncertainty as top threat, growth/profitability focus amid choppy waters), JPMorgan Business Leaders Outlook, INSEAD Knowledge, Deloitte enterprise AI reports (talent gaps, supply chain risks, AI governance, attrition).
    - Indie Hackers public threads / revenue stories.
    - Product Hunt launch comments (missing features / begged-for alternatives).
    - LinkedIn posts/comments with pain phrases ("biggest pain point 2026", "AI agent frustration", "side hustle 2026").
    - Niche subreddit vents or review mining (G2/Capterra low-rated tools in hot categories).
- Signal Library Keywords/Phrases:
    - Pain: "I hate when", "frustrated with", "biggest pain point", "why is X so expensive", "struggling to", "uncertainty", "attrition"
    - Demand: "how do I", "is there an app for", "I wish there was", "recommend me", "best way to", "alternative to"
    - Opportunity: "business idea", "startup idea", "side hustle", "make money with", "2026 opportunity"
    - 2026 Macro: "AI agent", "automation", "tariff", "energy crisis", "supply chain", "personalization fatigue", "attention scarcity", "distribution overload", "regulatory complexity", "carbon debt", "AI governance", "eid mubarak 2026", "ramadan 2026", "march madness 2026", "uncertainty", "AI attrition"
- Require at least 2–3 matching signals per idea (prefer quantifiable: % spikes, search volume 20K+, views, min_faves, survey %, post engagement) + strong "Why Now" tie-in.
- Prioritize overlap between core sources (e.g., Eid/Ramadan spikes, March sports) and YC RFS / Conference Board 2026 (uncertainty, AI-native shifts, talent/attrition pains) for highest conviction.

Diversity Guardrails (MANDATORY — enforce exactly):
Output exactly this distribution (no more, no less):
- 5 × Digital / SaaS / AI-SaaS
- 5 × Physical / Sustainable / Hardware
- 5 × Service / Local / On-Demand
- 5 × Deep-Tech / Moonshot
- 5 × Wildcard (creative/misc)

VC Logic Engine & Kill-Switch (STRICT):
- For EACH idea, internally score on the 12-Factor Unfair Advantage Checklist (0–1 pt each, total /12). DISCARD any idea scoring <7/12.
- Revenue Model: Pick EXACTLY ONE of the 6 skeletons provided (SaaS, Marketplace, Physical, Ad-Supported, Lead Gen, Service).
- Potential Exit: One-liner.

Mandatory Output Format per Idea (11 fields exactly):
1. Headline
2. Shark Tank Pitch
3. VC Justification
4. Category Tags
5. Cost & Effort
6. Revenue Potential Score + filled skeleton + 1 comp
7. Unfair Advantage
8. Potential Exit
9. Trend Sources & Triggers
10. Heat Badge (e.g., "Early Bird – heating up" or "X entrepreneurs viewing/saved last 24h")
11. Next Steps: Exactly 7 actionable steps. Each step should be a string in the format: "Step Title | Timeline | Key Risk | Tool/Link".
    Example: "Build MVP | 2 weeks | Technical debt | Replit/Vercel"

Additional Mechanics:
- Saturation Indicator: Label "Early Bird – heating up" or estimate "X entrepreneurs viewing/saved last 24h" (synthetic estimate).
- Output structure: Intro blurb → numbered list of 25 ideas → closing disclaimer.`;

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
        contents: `Generate 25 business ideas for ${date}. Follow the system prompt strictly. Today's date context: ${date}.`,
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
  Format as JSON.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      roadmap: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            step: { type: Type.STRING },
            details: { type: Type.STRING },
            milestone: { type: Type.STRING }
          },
          required: ["step", "details", "milestone"]
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
