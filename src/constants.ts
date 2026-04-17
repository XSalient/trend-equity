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

// Monthly limit for custom idea analysis (Pro/Builder only)
export const ANALYZE_IDEA_MONTHLY_LIMITS = {
  free: 0,
  pro: 5,
  builder: 20,
} as const;

// Max custom ideas that can be manually saved (separate quota from feed saves)
export const CUSTOM_SAVES_LIMITS = {
  free: 0,
  pro: 3,
  builder: 10,
} as const;

export const CATEGORIES = [
  'Digital / SaaS / AI-SaaS',
  'Physical / Sustainable / Hardware',
  'Service / Local / On-Demand',
  'Deep-Tech / Moonshot',
  'Wildcard (creative/misc)',
];
