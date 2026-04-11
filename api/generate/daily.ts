import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, dailyResponseSchema } from '../_lib/gemini';
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getRecentIdeaHeadlines } from '../_lib/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date, country, countryCount } = req.body;

  try {
    const [signals, recentHeadlines] = await Promise.all([
      fetchLiveSignals(),
      getRecentIdeaHeadlines(date),
    ]);
    const signalContext = formatSignalsForPrompt(signals);

    const dedupeBlock = recentHeadlines.length > 0
      ? `\n\nDO NOT REPEAT RECENT IDEAS — these headlines were already generated in the past 3 days. Generate completely different problem spaces, target markets, and business models:\n${recentHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}\n`
      : '';

    let promptStr = signalContext
      ? `${signalContext}${dedupeBlock}\nUsing the live market signals above as your PRIMARY source, generate exactly 35 high-conviction business ideas for ${date}.\n\nREQUIREMENTS:\n- Every idea MUST cite ≥1 specific signal in trendSources — include the actual data point, not just the source name\n- Identify SECOND-ORDER opportunities: what problem does each trending signal CREATE that is currently undersolved?\n- Enforce sector diversity: no more than 3 ideas from any single sector (AI/ML, FinTech, HealthTech, EdTech, CleanTech, Consumer, B2B SaaS, Marketplace, PropTech, AgriTech, LegalTech, etc.)\n- The unfairAdvantage field must describe a STRUCTURAL edge (proprietary data, regulatory moat, distribution lock-in, network effects) — never "better UX" or "first mover"\n- Cover all effort levels: at least 8 ideas buildable solo in under 6 weeks, at least 8 requiring a small team, the rest for well-funded teams\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`
      : `Generate exactly 35 high-conviction business ideas for ${date}.${dedupeBlock}\n\nREQUIREMENTS:\n- Enforce sector diversity: no more than 3 ideas from any single sector\n- Each idea must have a STRUCTURAL unfair advantage (proprietary data, regulatory moat, distribution lock-in, network effects)\n- Cover all effort levels: mix of solo-buildable, small team, and well-funded team ideas\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`;

    if (country && country !== 'Global' && countryCount > 0) {
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored for the market and demographics in ${country}. Ensure those ideas include the exact string "Local Market" in their categoryTags array.`;
    }

    const data = await generateWithGemini(promptStr, dailyResponseSchema);
    return res.json(data);
  } catch (err: any) {
    console.error('Daily Generation Error:', err);
    return res.status(503).json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
}
