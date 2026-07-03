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
  sortBy: 'quality' | 'revenue' | 'newest' | 'effort';
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
  /** Grounded market research with real citation URLs (on-demand, Google Search grounding) */
  evidence?: {
    competitors: { name: string; oneLiner: string }[];
    marketSizeCited: string;
    whyNowEvidence: string;
    sources: { title: string; url: string }[];
    evidenceScore: number;
    generatedAt?: string;
  };
  /** Composite score (1-10) assigned by the independent critic model; null if critique failed */
  qualityScore?: number | null;
  qualityScorePrecheck?: number;
  founderFit?: 'keeper' | 'salvageable' | 'cut';
  qualityIssues?: string[];
  buyer?: string;
  firstWedge?: string;
  validationTest?: string;
  killReason?: string;
  adminReviewStatus?: 'published' | 'needs_narrowing' | 'rejected';
  critique?: {
    problemSeverity: number;
    timing: number;
    moat: number;
    feasibility: number;
    founderAccessibility: number;
    reason: string;
  };
  criticModel?: string;
}

export interface DailyGeneration {
  date: string;
  intro: string;
  ideas: Idea[];
  disclaimer: string;
  generatedAt: any;
  promptVersion?: string;
  qualityStats?: {
    candidates?: number;
    scored?: number;
    publishedCount?: number;
    rejectedCount?: number;
    avgPublishedScore?: number | null;
    threshold?: number;
    criticModel?: string;
    failOpen?: boolean;
    semanticDupesDropped?: number;
    gate?: {
      inputCount: number;
      publishableCount: number;
      fallbackUsed: boolean;
      rejectedByGate: number;
      issueCounts: Record<string, number>;
    };
  };
  _isMock?: boolean; // legacy flag — stale docs from before mock removal
}

export interface UserSave {
  id?: string;
  userId: string;
  idea: Idea;
  savedAt: any;
  saveType?: 'feed' | 'custom';
  userInput?: string; // preserve original user description for custom ideas
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
  riskMitigation: string[];
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
