import { describe, expect, it } from 'vitest';
import {
  assessIdeaQuality,
  cleanDailyDisclaimer,
  normalizeGeneratedIdea,
  prepareCandidatesForCritique,
} from '../../../api/_lib/idea-quality';

const GOOD_IDEA = {
  id: '1',
  headline: 'PermitFlow for Rooftop Solar Installers',
  pitch: 'Workflow software that pre-checks local permit packets for small solar installers.',
  vcJustification: 'Installer queues are growing as residential solar permits rose 18% in 2026.',
  categoryTags: ['CleanTech', 'B2B SaaS'],
  costEffort: 'Solo-Buildable',
  revenuePotentialScore: 8,
  revenueSkeleton: '$299/mo per installer office.',
  unfairAdvantage:
    'Permit dataset built from rejected applications in one state, starting with California.',
  potentialExit: 'Acquisition by solar design or installer operating software.',
  trendSources: ['SEIA 2026: residential solar installs +18% YoY'],
  saturationLabel: 'Niche',
  heatBadge: 'Hot',
  nextSteps: [
    'Interview installers | 2 days | Wrong buyer | LinkedIn',
    'Collect rejected permits | 3 days | Data access | Local offices',
    'Mock pre-check report | 2 days | Low urgency | Figma',
  ],
  marketSize: '$12B residential solar software market by 2030',
  competitorLandscape: 'Direct: Aurora Solar, OpenSolar | Edge: rejected-permit pre-checks',
  regulatoryFlags: 'Low - building permit workflow, no licensed advice.',
};

describe('idea quality gate', () => {
  it('normalizes broken heat badges and missing scalar fields', () => {
    const idea = normalizeGeneratedIdea({ headline: 'Test', heatBadge: 'ðŸ”¥' }, 4);

    expect(idea.id).toBe('5');
    expect(idea.heatBadge).toBe('Early Bird');
    expect(idea.categoryTags).toEqual([]);
  });

  it('marks action-oriented, sourced ideas as keepers', () => {
    const idea = assessIdeaQuality(GOOD_IDEA);

    expect(idea.founderFit).toBe('keeper');
    expect(idea.qualityIssues).toEqual([]);
    expect(idea.validationTest).toContain('Interview installers');
  });

  it('flags generic and capital-heavy ideas as cuts', () => {
    const idea = assessIdeaQuality({
      ...GOOD_IDEA,
      headline: 'Autonomous Vehicle Insurance Platform',
      trendSources: ['Google Trends: rising search term reflecting broad public concern'],
      unfairAdvantage: 'Proprietary AI and exclusive partnerships.',
      regulatoryFlags: 'SEC, FINRA and insurance license requirements.',
      nextSteps: ['Build MVP'],
    });

    expect(idea.founderFit).toBe('cut');
    expect(idea.qualityIssues).toContain('no_quantified_signal');
    expect(idea.qualityIssues).toContain('capital_or_access_heavy');
  });

  it('uses all candidates as fallback when the gate would starve the feed', () => {
    const weak = Array.from({ length: 3 }, (_, i) =>
      assessIdeaQuality({
        ...GOOD_IDEA,
        id: String(i),
        headline: `Autonomous Insurance ${i}`,
        trendSources: ['Google Trends: rising search term'],
        regulatoryFlags: 'SEC and FINRA requirements.',
      })
    );

    const result = prepareCandidatesForCritique(weak, 3);

    expect(result.stats.fallbackUsed).toBe(true);
    expect(result.candidatesForCritique).toHaveLength(3);
    expect(result.rejectedByGate).toHaveLength(0);
  });

  it('fixes the daily disclaimer typo', () => {
    expect(cleanDailyDisclaimer('Success depends on unforseen factors.')).toContain('unforeseen');
  });
});
