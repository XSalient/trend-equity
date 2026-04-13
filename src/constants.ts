export const TIER_LIMITS = {
  free: {
    dailyIdeas: 10,
    monthlySaves: 5,
    exportFormats: ['pdf'] as const,
    roadmapSteps: 3,
  },
  pro: {
    dailyIdeas: 25,
    monthlySaves: Infinity,
    exportFormats: ['pdf', 'notion', 'gdocs'] as const,
    roadmapSteps: 7,
  },
  builder: {
    dailyIdeas: 35,
    monthlySaves: Infinity,
    exportFormats: ['pdf', 'notion', 'gdocs'] as const,
    roadmapSteps: 10,
  },
};

export type Tier = keyof typeof TIER_LIMITS;

export const CATEGORIES = [
  'Digital / SaaS / AI-SaaS',
  'Physical / Sustainable / Hardware',
  'Service / Local / On-Demand',
  'Deep-Tech / Moonshot',
  'Wildcard (creative/misc)',
];
