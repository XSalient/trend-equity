export type Tier = 'free' | 'pro' | 'builder';

export interface FilterState {
  industries: string[];
  riskLevels: string[];
  effortLevels: string[];
  marketFocus: string[];
  teamSize: string[];
  excludeCategories: string[];
  customKeywords: string;
  sortBy: 'revenue' | 'newest' | 'effort';
}

export interface Idea {
  id: string;
  headline: string;
  pitch: string;
  vcJustification: string;
  categoryTags: string[];
  costEffort: string;
  revenuePotentialScore: number;
  revenueSkeleton: string;
  unfairAdvantage: string;
  potentialExit: string;
  trendSources: string[];
  saturationLabel: string;
  heatBadge: string;
  nextSteps: string[];
  fullActionPlan?: {
    roadmap: { step: string; details: string; milestone: string }[];
    tools: string[];
    risks: string[];
    timeline: string;
  };
}

export interface DailyGeneration {
  date: string;
  intro: string;
  ideas: Idea[];
  disclaimer: string;
  generatedAt: any;
}

export interface UserSave {
  id?: string;
  userId: string;
  idea: Idea;
  savedAt: any;
}
