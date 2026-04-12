/**
 * Shared mock API response data for Playwright E2E tests.
 * All tests use route interception + localStorage injection so
 * they run without Gemini or Firestore calls.
 */

const today = new Date().toISOString().split('T')[0];

const CATEGORIES = [
  ['FinTech', 'SaaS'],
  ['HealthTech', 'Consumer'],
  ['EdTech', 'Marketplace'],
  ['CleanTech', 'B2B SaaS'],
  ['LegalTech', 'AI'],
  ['AgriTech', 'Logistics'],
  ['B2B SaaS', 'Security'],
];
const EFFORT = ['Low Capital, Low Technical', 'Medium Capital, Medium Technical', 'High Capital, High Technical'];

function makeIdea(i: number) {
  return {
    id: `idea-${String(i).padStart(3, '0')}`,
    headline: `Test Business Idea ${i + 1}`,
    pitch: `Detailed pitch for idea ${i + 1}: solving a real market problem.`,
    vcJustification: `Strong VC thesis for idea ${i + 1} backed by market data.`,
    categoryTags: CATEGORIES[i % CATEGORIES.length],
    costEffort: EFFORT[i % EFFORT.length],
    revenuePotentialScore: 5 + (i % 5),
    revenueSkeleton: `$${(i + 1) * 99}/mo SaaS per customer.`,
    unfairAdvantage: `Structural moat: proprietary data network for idea ${i + 1}.`,
    potentialExit: 'Acquisition by major industry incumbent or Series B → IPO.',
    trendSources: [`Bloomberg 2026: market signal for idea ${i + 1}`],
    saturationLabel: ['Low Competition', 'Early Adopter Stage', 'Growing'][i % 3],
    heatBadge: ['Hot', 'Trending', 'Warm'][i % 3],
    nextSteps: [`Build MVP for idea ${i + 1} | 4 weeks | Node.js + React`],
    marketSize: `$${(i + 5) * 2}B addressable market by 2030`,
    competitorLandscape: `Limited direct competition for idea ${i + 1}.`,
    regulatoryFlags: ['Low', 'Medium', 'High'][i % 3],
  };
}

export const MOCK_IDEAS = Array.from({ length: 35 }, (_, i) => makeIdea(i));

/** A Local Market idea for localisation filter tests */
export const LOCAL_MARKET_IDEA = {
  ...makeIdea(35),
  id: 'idea-local',
  headline: 'Local Trades Platform for India',
  categoryTags: ['Marketplace', 'Local Market', 'Service'],
  pitch: 'A localised booking platform for skilled tradespeople in India.',
};

export const MOCK_DAILY_RESPONSE = {
  date: today,
  intro: `Welcome to today's AI-generated business ideas for ${today}.`,
  ideas: [...MOCK_IDEAS, LOCAL_MARKET_IDEA],
  disclaimer: 'These are AI-generated ideas for illustrative purposes. Do your own diligence.',
};

export const MOCK_RADAR_RESPONSE = {
  week: today,
  topTrends: [
    { title: 'Agentic AI workflows', description: 'Shift from chat to autonomous agents.', impact: 'High', sector: 'AI/ML' },
    { title: 'Climate compliance SaaS', description: 'SEC rules driving new tooling demand.', impact: 'High', sector: 'CleanTech' },
    { title: 'B2B vertical AI', description: 'Domain-specific models outperforming general.', impact: 'Medium', sector: 'B2B SaaS' },
    { title: 'Healthcare AI diagnostics', description: 'FDA approvals accelerating clinical AI.', impact: 'High', sector: 'HealthTech' },
    { title: 'Immigration tech surge', description: 'Filing volume up 19% YoY.', impact: 'Medium', sector: 'LegalTech' },
  ],
  marketShift: "Transition from 'AI features' to 'AI-native workflows' across all B2B sectors.",
  opportunityAreas: ['Vertical AI with proprietary data', 'Compliance automation', 'Agent orchestration', 'Climate infrastructure', 'Healthcare automation'],
  _usage: { featureType: 'radar', used: 1, limit: 3, remaining: 2 },
};

export const MOCK_FUTURECASTING_RESPONSE = {
  horizon: '2030',
  predictions: [
    {
      title: 'Personal AI Agents Become Standard',
      probability: 88,
      rationale: 'LLM cost curves follow Moore\'s Law.',
      winners: ['AI platform providers'],
      losers: ['Generic horizontal SaaS'],
    },
    {
      title: 'Carbon Markets Reach Maturity',
      probability: 74,
      rationale: 'Regulatory tailwinds from EU CSRD.',
      winners: ['Carbon registry tech'],
      losers: ['Carbon-heavy industries'],
    },
  ],
  paradigmShifts: ['Post-SaaS era: pay-per-outcome pricing', 'AI replaces 40% of admin tasks'],
  _usage: { featureType: 'futurecasting', used: 1, limit: 3, remaining: 2 },
};

export const MOCK_ACTION_PLAN = {
  roadmap: [
    { id: '1', step: 'Validate demand', details: 'Run 20 customer interviews.', milestone: 'Week 2' },
    { id: '2', step: 'Build MVP', details: 'Core feature set, no auth yet.', milestone: 'Week 6' },
    { id: '3', step: 'Launch beta', details: 'Onboard 10 design partners.', milestone: 'Week 8' },
  ],
  tools: ['Next.js', 'Supabase', 'Stripe'],
  risks: ['Regulatory changes', 'Long sales cycles'],
  timeline: '12 weeks to first paying customer',
  _usage: { featureType: 'action-plan', used: 1, limit: 3, remaining: 2 },
};

export const MOCK_VETTING = {
  score: 82,
  verdict: 'High Conviction',
  strengths: ['Large addressable market', 'Clear structural moat', 'Strong timing signal'],
  weaknesses: ['High capital requirements', 'Long enterprise sales cycle'],
  pivotSuggestions: ['Start with SMB segment', 'Consider API-first distribution'],
  comparableExits: ['Acquired by Bloomberg $400M', 'IPO at $1.2B'],
  _usage: { featureType: 'vetting', used: 1, limit: 3, remaining: 2 },
};

/** Inject mock daily data into localStorage so the app skips API call */
export async function injectMockDailyFeed(page: any, ideas = MOCK_DAILY_RESPONSE.ideas) {
  const mockData = { ...MOCK_DAILY_RESPONSE, ideas, date: today };
  await page.addInitScript((data: any) => {
    localStorage.setItem('te_daily_feed', JSON.stringify(data));
  }, mockData);
}

/** Intercept all generate API calls and return mock responses */
export async function interceptAllApis(page: any) {
  await page.route('**/api/generate/daily', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DAILY_RESPONSE) });
  });
  await page.route('**/api/generate/radar', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RADAR_RESPONSE) });
  });
  await page.route('**/api/generate/futurecasting', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_FUTURECASTING_RESPONSE) });
  });
  await page.route('**/api/generate/action-plan', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTION_PLAN) });
  });
  await page.route('**/api/generate/vetting', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VETTING) });
  });
  await page.route('**/api/generate/alerts', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}
