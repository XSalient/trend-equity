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
