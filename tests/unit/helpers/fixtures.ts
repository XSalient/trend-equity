/**
 * Shared test fixtures used across unit tests.
 */

export const MOCK_IDEA = {
  id: 'idea-001',
  headline: 'B2B Carbon Credit Verification Platform',
  pitch: 'An AI platform that automates carbon credit verification for mid-market enterprises.',
  vcJustification: 'Carbon markets growing 200% YoY; no dedicated SMB tooling exists.',
  categoryTags: ['FinTech', 'CleanTech', 'SaaS'],
  costEffort: 'High Capital, High Technical',
  revenuePotentialScore: 9,
  revenueSkeleton: '$499–$1,499/mo SaaS per company.',
  unfairAdvantage: 'Proprietary verification algorithm with 500+ audit trail data points.',
  potentialExit: 'IPO or acquisition by Bloomberg or Refinitiv.',
  trendSources: ['Bloomberg 2025: carbon credit market +200% YoY'],
  saturationLabel: 'Low Competition',
  heatBadge: 'Hot',
  nextSteps: ['Build MVP | 4 weeks | React + Node.js'],
  marketSize: '$50B market by 2030',
  competitorLandscape: 'Direct: Xpansiv (enterprise-only). Edge: SMB pricing.',
  regulatoryFlags: 'Medium — SEC climate disclosure rules 2026.',
};

export const MOCK_LOCAL_IDEA = {
  ...MOCK_IDEA,
  id: 'idea-local-001',
  headline: 'Local Trades Booking Platform for India',
  categoryTags: ['Marketplace', 'Local Market', 'Service'],
};

export const MOCK_LOW_SCORE_IDEA = {
  ...MOCK_IDEA,
  id: 'idea-low-001',
  headline: 'Low-Revenue Test Idea',
  revenuePotentialScore: 3,
  costEffort: 'Low Capital, Low Technical',
};

export const MOCK_DIGITAL_IDEA = {
  ...MOCK_IDEA,
  id: 'idea-digital-001',
  headline: 'SaaS Analytics Dashboard',
  categoryTags: ['SaaS', 'Analytics'],
};

export const MOCK_PHYSICAL_IDEA = {
  ...MOCK_IDEA,
  id: 'idea-physical-001',
  headline: 'Sustainable Hardware Product',
  categoryTags: ['Physical', 'Hardware', 'Sustainable'],
};

/** Generate a set of 35 varied mock ideas for daily generation tests */
export function generateMockIdeas(count = 35) {
  const categories = [
    ['FinTech', 'SaaS'],
    ['HealthTech', 'Consumer'],
    ['EdTech', 'Marketplace'],
    ['CleanTech', 'B2B SaaS'],
    ['LegalTech', 'AI'],
  ];
  const efforts = [
    'Low Capital, Low Technical',
    'Medium Capital, Medium Technical',
    'High Capital, High Technical',
  ];
  const badges = ['Hot', 'Trending', 'Warm'];
  const saturations = ['Low Competition', 'Early Adopter Stage', 'Growing'];

  return Array.from({ length: count }, (_, i) => ({
    id: `idea-${String(i).padStart(3, '0')}`,
    headline: `Test Business Idea ${i + 1}`,
    pitch: `Pitch for idea ${i + 1}: solving a real problem in the market.`,
    vcJustification: `Strong market signal for idea ${i + 1}.`,
    categoryTags: categories[i % categories.length],
    costEffort: efforts[i % efforts.length],
    revenuePotentialScore: 5 + (i % 5),
    revenueSkeleton: `$${(i + 1) * 99}/mo SaaS.`,
    unfairAdvantage: `Structural moat for idea ${i + 1}.`,
    potentialExit: 'Acquisition by major industry player.',
    trendSources: [`Signal source for idea ${i + 1}`],
    saturationLabel: saturations[i % saturations.length],
    heatBadge: badges[i % badges.length],
    nextSteps: [`Step 1 for idea ${i + 1} | 2 weeks`],
    marketSize: `$${(i + 1) * 5}B market`,
    competitorLandscape: 'Low competition.',
    regulatoryFlags: 'Low.',
  }));
}

export const MOCK_DAILY_GENERATION = {
  date: new Date().toISOString().split('T')[0],
  intro: 'Welcome to today\'s AI-generated business ideas.',
  ideas: generateMockIdeas(35),
  disclaimer: 'These are AI-generated ideas. Do your own diligence.',
  generatedAt: new Date().toISOString(),
};

export const MOCK_RADAR_RESPONSE = {
  week: new Date().toISOString().split('T')[0],
  topTrends: [
    { title: 'Agentic AI workflows', description: 'Shift from chat to autonomous AI agents.', impact: 'High', sector: 'AI/ML' },
    { title: 'Climate compliance software', description: 'SEC rules driving new SaaS demand.', impact: 'High', sector: 'CleanTech' },
    { title: 'B2B vertical AI', description: 'Domain-specific models outperforming general models.', impact: 'Medium', sector: 'B2B SaaS' },
    { title: 'Healthcare AI diagnostics', description: 'FDA approvals accelerating AI clinical tools.', impact: 'High', sector: 'HealthTech' },
    { title: 'Immigration tech surge', description: 'Filing volume +19% YoY creating tooling gap.', impact: 'Medium', sector: 'LegalTech' },
  ],
  marketShift: "Transition from 'AI features' to 'AI-native workflows' across all B2B sectors.",
  opportunityAreas: [
    'Vertical AI with proprietary data',
    'Compliance automation for SMBs',
    'Agent orchestration layers',
    'Climate data infrastructure',
    'Healthcare workflow automation',
  ],
};

export const MOCK_FUTURECASTING_RESPONSE = {
  horizon: '2030',
  predictions: [
    {
      title: 'Personal AI Agents Become Standard',
      probability: 88,
      rationale: 'LLM cost curves follow Moore\'s Law; by 2030 every knowledge worker will have a dedicated AI agent.',
      winners: ['AI agent platform providers', 'Vertical SaaS companies with AI layers'],
      losers: ['Generic horizontal SaaS', 'Offshore data entry services'],
    },
    {
      title: 'Carbon Credit Markets Reach Maturity',
      probability: 74,
      rationale: 'Regulatory tailwinds from EU CSRD and SEC climate disclosure rules create mandatory market participation.',
      winners: ['Carbon registry tech companies', 'ESG data providers'],
      losers: ['Companies without sustainability programs'],
    },
  ],
  paradigmShifts: [
    'Post-SaaS era: pay-per-outcome rather than per-seat pricing',
    'AI replaces 40% of white-collar administrative tasks',
    'Physical-digital convergence in manufacturing and logistics',
  ],
};

export const MOCK_ACTION_PLAN_RESPONSE = {
  roadmap: [
    { id: 'step-1', step: 'Validate demand', details: 'Run 20 customer interviews with target ICPs.', milestone: 'Week 2' },
    { id: 'step-2', step: 'Build MVP', details: 'Core feature set only — no auth, no payments yet.', milestone: 'Week 6' },
    { id: 'step-3', step: 'Launch beta', details: 'Onboard 10 design partners at $0.', milestone: 'Week 8' },
    { id: 'step-4', step: 'Charge first customers', details: 'Convert 3 beta users to paid at $499/mo.', milestone: 'Week 12' },
  ],
  tools: ['Next.js', 'Supabase', 'Stripe', 'Resend', 'Vercel'],
  risks: ['Regulatory changes in carbon markets', 'Long enterprise sales cycles'],
  timeline: '12 weeks to first paying customer',
};

export const MOCK_USAGE_RESPONSE = {
  featureType: 'action-plan',
  used: 1,
  limit: 3,
  remaining: 2,
};
