import AI from './ai-provider';
const { generateWithAI, Type } = AI;

// Fallback / default strings for system prompt and quality block
export const DEFAULT_QUALITY_BLOCK = `REQUIREMENTS FOR EVERY IDEA:
- Cite ≥1 specific signal in trendSources — include the actual data point, not just the source name
- Find SECOND-ORDER opportunities: what problem does the signal CREATE downstream that is currently undersolved?
- Enforce sector diversity: no more than 3 ideas from any single sector (AI/ML, FinTech, HealthTech, EdTech, CleanTech, Consumer, B2B SaaS, Marketplace, PropTech, AgriTech, LegalTech, GovTech, etc.)
- unfairAdvantage must describe a STRUCTURAL edge (proprietary data, regulatory moat, distribution lock-in, network effects) — never "better UX" or "first mover"
- Spread effort levels: at least 8 solo-buildable (<6 weeks), at least 8 small-team, the rest for well-funded teams
- At least 20% of ideas should address markets outside the US
- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`;

export const META_OPTIMIZER_SYSTEM_PROMPT = `You are a meta-prompt optimizer and senior prompt engineer. Your role is to analyze a business idea generation system's performance, critique its outputs like a strict early-stage VC, inspect user reactions and comments, and output an improved, refined instruction set (system prompt and quality block).`;

export async function getDynamicPrompt(db: any) {
  try {
    const docRef = db.collection('config').doc('generation_prompt');
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      return {
        systemPrompt: data.systemPrompt || AI.DEFAULT_SYSTEM_PROMPT,
        qualityBlock: data.qualityBlock || DEFAULT_QUALITY_BLOCK,
        version: data.version || 1,
      };
    }
  } catch (err) {
    console.error('[prompt-optimizer] Error reading dynamic prompt:', err);
  }
  return {
    systemPrompt: AI.DEFAULT_SYSTEM_PROMPT,
    qualityBlock: DEFAULT_QUALITY_BLOCK,
    version: 0,
  };
}

export async function runSelfImprovement(db: any, force = false): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const configRef = db.collection('config').doc('generation_prompt');

  // Check if we already optimized today (unless force is true)
  if (!force) {
    const configSnap = await configRef.get();
    if (configSnap.exists) {
      const lastRun = configSnap.data().lastOptimized;
      if (lastRun === today) {
        console.log('[prompt-optimizer] Self-improvement already ran today. Skipping.');
        return;
      }
    }
  }

  console.log('[prompt-optimizer] Starting self-improvement / prompt refinement pipeline...');

  // 1. Fetch recent daily generations (past 3 days)
  let recentIdeas: any[] = [];
  try {
    const dailySnap = await db
      .collection('daily_generations')
      .orderBy('date', 'desc')
      .limit(3)
      .get();
    for (const doc of dailySnap.docs) {
      const ideas = doc.data().ideas || [];
      recentIdeas = recentIdeas.concat(
        ideas.map((idea: any) => ({
          id: idea.id,
          headline: idea.headline,
          pitch: idea.pitch,
          vcJustification: idea.vcJustification,
          unfairAdvantage: idea.unfairAdvantage,
          categoryTags: idea.categoryTags,
          dateGenerated: doc.id,
        }))
      );
    }
  } catch (err) {
    console.error('[prompt-optimizer] Error fetching recent ideas:', err);
  }

  if (recentIdeas.length === 0) {
    console.log('[prompt-optimizer] No recent ideas to critique or optimize. Skipping.');
    return;
  }

  // 2. Fetch recent user reactions (past 7 days)
  const likedIds = new Set<string>();
  const dislikedIds = new Set<string>();
  try {
    const reactionsSnap = await db.collection('idea_reactions').limit(200).get();
    for (const doc of reactionsSnap.docs) {
      const r = doc.data();
      if (r.type === 'up' || r.type === 'building') {
        likedIds.add(r.ideaId);
      } else if (r.type === 'down') {
        dislikedIds.add(r.ideaId);
      }
    }
  } catch (err) {
    console.error('[prompt-optimizer] Error fetching reactions:', err);
  }

  // 3. Fetch recent user comments
  let commentContext = '';
  try {
    const commentsSnap = await db.collection('comments').limit(100).get();
    const commentList: string[] = [];
    for (const doc of commentsSnap.docs) {
      const c = doc.data();
      const matchingIdea = recentIdeas.find((i) => i.id === c.ideaId);
      const headline = matchingIdea ? matchingIdea.headline : 'Unknown Idea';
      commentList.push(`Idea "${headline}": "${c.text}"`);
    }
    if (commentList.length > 0) {
      commentContext = `\nUSER COMMENTS ON IDEAS:\n${commentList.join('\n')}\n`;
    }
  } catch (err) {
    console.error('[prompt-optimizer] Error fetching comments:', err);
  }

  // Group ideas into positive/negative sets based on reactions
  const likedIdeas = recentIdeas.filter((i) => likedIds.has(i.id));
  const dislikedIdeas = recentIdeas.filter((i) => dislikedIds.has(i.id));

  // 4. AI VC Critique Step: Evaluate the generated ideas for quality, repetition, and depth
  const critiquePrompt = `Analyze the following business ideas generated by our system recently:
${JSON.stringify(recentIdeas.slice(0, 15), null, 2)}

Provide a strict, professional VC critique of these ideas. Identify:
1. Any repetitive templates or clichés (e.g., too many "AI wrapper" ideas or basic marketplaces).
2. Ideas that have unrealistic regulatory, cost, or execution assumptions.
3. Ideas that lack a genuine, defensible structural moat.

Be brief and highly critical.`;

  let aiCritique = '';
  try {
    console.log('[prompt-optimizer] Generating AI VC Critique...');
    aiCritique = await generateWithAI(
      critiquePrompt,
      null,
      'You are a senior Venture Capital partner reviewing startup ideas for investment viability.'
    );
  } catch (err) {
    console.error('[prompt-optimizer] AI critique failed:', err);
    aiCritique = 'Unable to generate critique due to model error.';
  }

  // 5. Meta-Prompt Optimization: Optimize instructions based on feedback & critique
  const currentPromptData = await getDynamicPrompt(db);

  const optimizationPrompt = `Optimize the system prompt and quality instructions for our daily business idea generator.

CURRENT SYSTEM PROMPT:
"""
${currentPromptData.systemPrompt}
"""

CURRENT QUALITY BLOCK:
"""
${currentPromptData.qualityBlock}
"""

FEEDBACK & CRITIQUE DATA:
${likedIdeas.length > 0 ? `\nUSER LIKED IDEAS:\n${JSON.stringify(likedIdeas.slice(0, 5), null, 2)}\n` : ''}
${dislikedIdeas.length > 0 ? `\nUSER DISLIKED IDEAS:\n${JSON.stringify(dislikedIdeas.slice(0, 5), null, 2)}\n` : ''}
${commentContext}
AI SELF-CRITIQUE:
"""
${aiCritique}
"""

INSTRUCTIONS:
1. Analyze the AI critique and user feedback to identify recurring failures, weak ideas, or boring patterns.
2. Refine the QUALITY BLOCK and SYSTEM PROMPT to explicitly forbid those weak/boring patterns, sharpen quality requirements (especially around structural moats and second-order problems), and reinforce positive traits.
3. Maintain the core output format requirement (returning valid JSON) and general persona.
4. Output the refined prompts in the requested JSON schema.`;

  const optimizationSchema = {
    type: Type.OBJECT,
    properties: {
      systemPrompt: { type: Type.STRING },
      qualityBlock: { type: Type.STRING },
    },
    required: ['systemPrompt', 'qualityBlock'],
  };

  try {
    console.log('[prompt-optimizer] Calling Meta-Prompt Optimizer...');
    const result = await generateWithAI(
      optimizationPrompt,
      optimizationSchema,
      META_OPTIMIZER_SYSTEM_PROMPT
    );
    const newVersion = currentPromptData.version + 1;

    console.log(
      `[prompt-optimizer] Refinement complete. Saving version ${newVersion} to Firestore...`
    );
    await configRef.set({
      systemPrompt: result.systemPrompt,
      qualityBlock: result.qualityBlock,
      version: newVersion,
      lastOptimized: today,
      optimizedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[prompt-optimizer] Prompt optimization failed:', err);
  }
}
