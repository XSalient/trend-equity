export type Tier = 'free' | 'pro' | 'builder';

export interface FilterState {
  industries: string[];
  productTypes: string[];
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
    roadmap: {
      id: string;
      step: string;
      details: string;
      milestone: string;
      isDone?: boolean;
      isCustom?: boolean;
    }[];
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
  expertVetting?: ExpertVetting;
  seekingPartner?: boolean;
  marketSize?: string;
  competitorLandscape?: string;
  regulatoryFlags?: string;
}

export interface DailyGeneration {
  date: string;
  intro: string;
  ideas: Idea[];
  disclaimer: string;
  generatedAt: any;
  _isMock?: boolean; // legacy flag — stale docs from before mock removal
}

export interface UserSave {
  id?: string;
  userId: string;
  idea: Idea;
  savedAt: any;
  saveType?: 'feed' | 'custom'; // omission treated as 'feed' (backwards compat)
}

export interface UserLatestIdea {
  userId: string;
  idea: Idea;
  analyzedAt: any; // Firestore Timestamp
  inputDescription: string; // original text the user entered
}

export interface AnalyzeIdeaUsage {
  featureType: 'analyze-idea';
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string; // ISO date string "YYYY-MM-DD" (first day of next month)
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

export interface WeeklyTrendRadar {
  week: string;
  topTrends: { title: string; description: string; impact: string; sector: string }[];
  marketShift: {
    title: string;
    description: string;
  };
  opportunityAreas: string[];
  generatedAt: any;
}

export interface Futurecasting {
  horizon: '2027' | '2030' | '2035';
  predictions: {
    title: string;
    probability: number;
    rationale: string;
    winners: string[];
    losers: string[];
  }[];
  paradigmShifts: {
    title: string;
    rationale: string;
    impact: string;
  }[];
  generatedAt: any;
}

export interface ExpertVetting {
  ideaId: string;
  score: number;
  verdict: 'High Conviction' | 'Moderate' | 'Pass';
  strengths: string[];
  weaknesses: string[];
  pivotSuggestions: string[];
  comparableExits: string[];
  generatedAt: any;
}

export type WeeklyBestIdea = Idea & { recurrenceCount: number };

export interface Comment {
  id: string;
  ideaId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  timestamp: any;
}
