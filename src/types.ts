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
    roadmap: { id: string; step: string; details: string; milestone: string; isDone?: boolean; isCustom?: boolean }[];
    tools: string[];
    risks: string[];
    timeline: string;
    generatedAt?: any;
  };
  buildWithMe?: {
    promptPack: { title: string; prompt: string }[];
    repoStructure: string;
    first24Hours: string[];
    generatedAt?: any;
  };
  validationToolkit?: {
    landingPage: { hero: string; subHero: string; valueProps: string[] };
    interviewScript: string[];
    smokeTest: string;
    successMetrics: string[];
    generatedAt?: any;
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

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: any;
  isRead: boolean;
  link?: string;
}
