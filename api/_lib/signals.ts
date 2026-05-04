/**
 * Live Signal Fetcher — pre-fetches real-world market signals before idea generation
 * so the model is grounded in actual current data, not training-data trends.
 *
 * Sources (all free, no auth):
 *   - Google Trends RSS (rising searches, US, last 24h)
 *   - Product Hunt RSS (launched this week)
 *   - Reddit JSON API (hot posts, r/SaaS+startups+Entrepreneur)
 *   - HN Algolia Search API (best stories by points)
 *   - TechCrunch RSS (funding/startup news)
 *
 * Cached in-memory for 1 hour to avoid hammering APIs on every generation.
 */

export interface LiveSignals {
  googleTrends: string[];
  productHuntLaunches: string[];
  redditHotThreads: string[];
  hnDiscussions: string[];
  techCrunchFunding: string[];
  fetchedAt: string;
  sourcesCached: boolean;
}

// ── Simple RSS parser (no dependencies) ──────────────────────────────────────

function extractRssItems(xml: string, limit = 12): string[] {
  const results: string[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  // CDATA and plain title formats
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?<\/title>/i;

  const items = xml.match(itemRegex) || [];
  for (const item of items.slice(0, limit)) {
    const m = item.match(titleRegex);
    if (m?.[1]) {
      const title = m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n/g, ' ')
        .trim();
      if (title) results.push(title);
    }
  }
  return results;
}

// ── Fetch helper with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TrendEquity/1.0; +https://trend-equity.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml,application/json,*/*',
        'Cache-Control': 'no-cache',
      },
    });
  } finally {
    clearTimeout(id);
  }
}

// ── Individual source fetchers ────────────────────────────────────────────────

async function fetchGoogleTrends(): Promise<string[]> {
  try {
    const res = await fetchWithTimeout('https://trends.google.com/trending/rss?geo=US&hl=en-US');
    if (!res.ok) return [];
    const xml = await res.text();
    return extractRssItems(xml, 15);
  } catch {
    return [];
  }
}

async function fetchProductHunt(): Promise<string[]> {
  try {
    const res = await fetchWithTimeout('https://www.producthunt.com/feed');
    if (!res.ok) return [];
    const xml = await res.text();
    // PH RSS titles include the product name and tagline
    return extractRssItems(xml, 10);
  } catch {
    return [];
  }
}

async function fetchReddit(): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(
      'https://www.reddit.com/r/SaaS+startups+Entrepreneur+smallbusiness.json?sort=hot&limit=25&t=week'
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const children = json?.data?.children ?? [];
    return children
      .filter((p: any) => p.data?.ups > 30 && !p.data?.stickied)
      .slice(0, 15)
      .map((p: any) => `[r/${p.data.subreddit}] "${p.data.title}" (${p.data.ups} upvotes)`);
  } catch {
    return [];
  }
}

async function fetchHackerNews(): Promise<string[]> {
  try {
    // Filter to last 30 days so we get recent signal, not all-time classics
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const res = await fetchWithTimeout(
      `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points%3E30,created_at_i%3E${thirtyDaysAgo}&hitsPerPage=15`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    return (json.hits ?? [])
      .slice(0, 12)
      .map((h: any) => `"${h.title}" (${h.points} pts)`)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchTechCrunch(): Promise<string[]> {
  try {
    // Funding/startup news specifically
    const res = await fetchWithTimeout('https://techcrunch.com/tag/funding/feed/');
    if (!res.ok) return [];
    const xml = await res.text();
    return extractRssItems(xml, 8);
  } catch {
    return [];
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cache: { data: LiveSignals; expiresAt: number } | null = null;
const SIGNAL_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchLiveSignals(): Promise<LiveSignals> {
  if (_cache && Date.now() < _cache.expiresAt) {
    return { ..._cache.data, sourcesCached: true };
  }

  console.log('[DEBUG] Starting Promise.allSettled for signals...');
  const [trends, ph, reddit, hn, tc] = await Promise.allSettled([
    (async () => {
      console.log('[DEBUG] Fetching Google Trends...');
      const r = await fetchGoogleTrends();
      console.log('[DEBUG] Google Trends done');
      return r;
    })(),
    (async () => {
      console.log('[DEBUG] Fetching Product Hunt...');
      const r = await fetchProductHunt();
      console.log('[DEBUG] Product Hunt done');
      return r;
    })(),
    (async () => {
      console.log('[DEBUG] Fetching Reddit...');
      const r = await fetchReddit();
      console.log('[DEBUG] Reddit done');
      return r;
    })(),
    (async () => {
      console.log('[DEBUG] Fetching HN...');
      const r = await fetchHackerNews();
      console.log('[DEBUG] HN done');
      return r;
    })(),
    (async () => {
      console.log('[DEBUG] Fetching TechCrunch...');
      const r = await fetchTechCrunch();
      console.log('[DEBUG] TechCrunch done');
      return r;
    })(),
  ]);

  const signals: LiveSignals = {
    googleTrends: trends.status === 'fulfilled' ? trends.value : [],
    productHuntLaunches: ph.status === 'fulfilled' ? ph.value : [],
    redditHotThreads: reddit.status === 'fulfilled' ? reddit.value : [],
    hnDiscussions: hn.status === 'fulfilled' ? hn.value : [],
    techCrunchFunding: tc.status === 'fulfilled' ? tc.value : [],
    fetchedAt: new Date().toISOString(),
    sourcesCached: false,
  };

  const totalSignals =
    signals.googleTrends.length +
    signals.productHuntLaunches.length +
    signals.redditHotThreads.length +
    signals.hnDiscussions.length +
    signals.techCrunchFunding.length;

  // Only cache if we got meaningful data
  if (totalSignals > 0) {
    _cache = { data: signals, expiresAt: Date.now() + SIGNAL_TTL_MS };
  }

  console.log(
    `[signals] Fetched: Google=${signals.googleTrends.length}, PH=${signals.productHuntLaunches.length}, Reddit=${signals.redditHotThreads.length}, HN=${signals.hnDiscussions.length}, TC=${signals.techCrunchFunding.length}`
  );
  return signals;
}

// ── Prompt formatter ──────────────────────────────────────────────────────────

export function formatSignalsForPrompt(signals: LiveSignals): string {
  const totalSignals =
    signals.googleTrends.length +
    signals.productHuntLaunches.length +
    signals.redditHotThreads.length +
    signals.hnDiscussions.length +
    signals.techCrunchFunding.length;

  if (totalSignals === 0) return '';

  const lines: string[] = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `  LIVE MARKET SIGNALS — fetched ${signals.fetchedAt}`,
    `  Use THESE as your PRIMARY idea source. Do NOT default to`,
    `  training-data trends. Every idea must trace back to ≥1 signal`,
    `  listed below with a specific data point cited.`,
    `╚══════════════════════════════════════════════════════════════╝`,
  ];

  if (signals.googleTrends.length) {
    lines.push(
      `\n🔥 GOOGLE TRENDS — RISING SEARCHES (US, last 24h):`,
      `   Instruction: Look for gaps, underserved niches, or second-order`,
      `   opportunities triggered by these rising queries.`,
      ...signals.googleTrends.map((t, i) => `   ${i + 1}. ${t}`)
    );
  }

  if (signals.productHuntLaunches.length) {
    lines.push(
      `\n🚀 PRODUCT HUNT — LAUNCHED THIS WEEK:`,
      `   Instruction: Do NOT copy these. Use them to find what's MISSING,`,
      `   the adjacent problem, or the underserved segment they ignore.`,
      ...signals.productHuntLaunches.map((t, i) => `   ${i + 1}. ${t}`)
    );
  }

  if (signals.redditHotThreads.length) {
    lines.push(
      `\n📱 REDDIT HOT THREADS — r/SaaS, r/startups, r/Entrepreneur:`,
      `   Instruction: These are REAL founder pain points this week.`,
      `   Extract the frustration, find the product opportunity.`,
      ...signals.redditHotThreads.map((t, i) => `   ${i + 1}. ${t}`)
    );
  }

  if (signals.hnDiscussions.length) {
    lines.push(
      `\n💻 HACKER NEWS — TOP DISCUSSIONS:`,
      `   Instruction: Technical community signals. High-value problems`,
      `   that engineers are talking about = often pre-product opportunities.`,
      ...signals.hnDiscussions.map((t, i) => `   ${i + 1}. ${t}`)
    );
  }

  if (signals.techCrunchFunding.length) {
    lines.push(
      `\n💰 TECHCRUNCH — RECENT FUNDING NEWS:`,
      `   Instruction: Where capital flows = validated markets. Find the`,
      `   adjacent opportunity, underserved segment, or SMB version of`,
      `   what these companies are building for enterprise.`,
      ...signals.techCrunchFunding.map((t, i) => `   ${i + 1}. ${t}`)
    );
  }

  lines.push(
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `END OF LIVE SIGNALS. Now generate 35 ideas grounded in the above.`,
    ``,
    `CRITICAL: You MUST return a single valid JSON object — no markdown fences, no array at the top level.`,
    `Required structure:`,
    `{ "intro": "<1-2 sentence editorial intro>", "ideas": [<35 idea objects>], "disclaimer": "<disclaimer>" }`,
    `Each idea object must have: headline, pitch, vcJustification, categoryTags (array), costEffort, revenuePotentialScore (number), revenueSkeleton, unfairAdvantage, potentialExit, trendSources (array), saturationLabel, heatBadge, nextSteps (array), marketSize, competitorLandscape, regulatoryFlags.`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  );

  return lines.join('\n');
}
