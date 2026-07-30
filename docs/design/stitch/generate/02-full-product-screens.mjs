import { stitch } from "@google/stitch-sdk";
import { writeFileSync } from "node:fs";

const PROJECT_ID = "projects/13591160038311824941"; // reuse → same design system

// Craft direction shared by every screen. Emphasis on PREMIUM, SPACIOUS, REAL.
const STYLE =
  "Design this as a polished, premium production screen — not a wireframe. " +
  "Aesthetic: high-end fintech / Bloomberg-terminal calm, lots of breathing room, strong typographic hierarchy, " +
  "generous vertical rhythm, no clutter, no emoji, no ASCII symbols. Dark UI on near-black #09090b, " +
  "surfaces #18181b with hairline #27272a borders, emerald #10b981 primary, cyan #22d3ee ONLY for verified evidence/citations, " +
  "an amber-to-coral gradient ONLY for live market-signal ribbons (used sparingly). Heavy condensed italic display headings, " +
  "clean sans body, tabular numerals for scores and data. Real, specific content — never lorem. Mobile portrait. ";

const screens = [
  {
    name: "1-daily-feed",
    prompt:
      STYLE +
      "SCREEN: Daily Feed home. A top bar with a wordmark and a compact tab strip (Feed, Saved, Radar, Pricing). " +
      "A section header 'Today’s opportunities' with the date and a small 'Free · 10 today' meter. " +
      "A filter row: a search-style 'Refine by keyword' field (custom requirement feed) and chips for Software, Physical, Service, Low-capital. " +
      "Then a vertical list of 3 opportunity cards. Each card: a thin amber-to-coral live-signal ribbon at the very top " +
      "(e.g. 'Trending · Product Hunt +340%'), a bold title, a one-line pitch, a right-aligned circular potential score (e.g. 8.7 / 10), " +
      "and a compact meta row of small pills: cost/effort (e.g. 'Low capital · Software'), market size, and a save (heart) icon. " +
      "First card is visually richer to read as the featured idea. Titles: 'Audit-ready compliance copilot for fintechs', " +
      "'Rural pharmacy dispensing robotics', 'Carbon-accounting API for mid-market logistics'.",
  },
  {
    name: "2-idea-detail",
    prompt:
      STYLE +
      "SCREEN: a single Idea Detail deep-dive, scrollable. Top: back chevron, share and export (PDF) icons. " +
      "Hero block: live-signal ribbon, large title 'Audit-ready compliance copilot for fintechs', the one-line pitch, " +
      "and a stat row — Potential 8.7/10, Cost/Effort 'Medium', Timing 'Now'. " +
      "Then clearly separated sections with small uppercase labels: " +
      "'VC Analysis' (justification paragraph, plus Unfair Advantage, Revenue Model, Market Dynamics as labeled sub-blocks); " +
      "'Expert Vetting' with a verdict chip 'High Conviction' and two pivot suggestions; " +
      "'Market Evidence' rendered with cyan citation chips and 2 source links ($3.1B market · 14% CAGR · competitors Vanta, Drata) to read as verified proof; " +
      "'Execution Roadmap' as a numbered 10-step checklist with the first three steps checked; " +
      "'Validation Toolkit' as three template tiles (Landing copy, Interview script, Validation checklist); " +
      "and a compact Comments thread at the bottom. Premium spacing, each section distinct.",
  },
  {
    name: "3-analyze-my-idea",
    prompt:
      STYLE +
      "SCREEN: 'Analyze my idea' — the custom idea analysis tool. Top: title 'Analyze any idea' with a subtitle " +
      "'Full VC analysis on a concept of your own' and a small monthly quota meter 'Pro · 3 of 5 left this month'. " +
      "A large multi-line input with placeholder 'Describe your idea — who it’s for and the problem it solves', and an emerald 'Analyze' button. " +
      "Below, a completed RESULT card for a submitted idea 'On-demand EV charging for apartment blocks': " +
      "a potential score 8.1/10, a justification paragraph, revenue-model and market-size sub-blocks, an expert-vetting verdict chip, " +
      "and actions 'Save to my ideas' and 'Open full analysis'. Show honest states: the quota meter and a subtle note that analyses are saved. Calm, focused, single-column.",
  },
  {
    name: "4-saved-library",
    prompt:
      STYLE +
      "SCREEN: 'My library' (Saved). A segmented control: 'Saved ideas', 'My analyses', 'Building'. " +
      "Under Saved ideas: a 2-item list of saved opportunity cards with score and a small 'new evidence' cyan badge on one. " +
      "A 'Your latest analysis' highlighted card surfacing the most recent custom analysis ('On-demand EV charging', 8.1). " +
      "A 'What you’re building' section with two roadmap progress rows, each a labeled title, an emerald progress bar " +
      "(one at 70% '7 of 10 steps', one at 20%) and the next step in muted text. Clean, personal, the sense of an accruing workspace.",
  },
  {
    name: "5-today-dashboard",
    prompt:
      STYLE +
      "SCREEN: 'Today' — a subscriber home dashboard that opens on the user’s own state, not a generic feed. " +
      "A greeting 'Good morning, Dev-Raj' and a subtle status line '10 new · 3 fit you · 6-day streak'. " +
      "Stacked dashboard modules, each a bordered surface with a small uppercase label and generous padding: " +
      "'Your radar' — two followed spaces, 'AI compliance' with a warm coral momentum badge '+240% this week' and 'Dev tooling' shown quiet, plus a 'Follow a space' add-row; " +
      "'What you’re building' — two roadmap progress bars with next-step text; " +
      "'Our track record' — a single credibility stat 'Ideas scored 8+, six months on: 7 of 10 gained real traction' with a cyan 'See how we grade' link; " +
      "'Today’s feed' — collapsed to two compact rows and a 'See all' link, clearly the smallest module. The personal modules dominate.",
  },
  {
    name: "6-market-intelligence",
    prompt:
      STYLE +
      "SCREEN: 'Market Intelligence' for the Builder tier, with two stacked panels. " +
      "Panel 1 'Weekly Trend Radar' — a macro view: 3 emerging shift rows, each with a shift name (e.g. 'Compliance automation', 'On-device AI', 'Climate logistics'), " +
      "a small momentum sparkline, a direction arrow, and a one-line 'why it matters'. " +
      "Panel 2 'Futurecasting' — three horizon cards laid out as 2027, 2030, 2035, each with a bold prediction headline, a short rationale, and an impact tag. " +
      "Distinct, editorial, data-forward. Premium spacing; this is the flagship paid intelligence surface.",
  },
  {
    name: "7-pricing-upgrade",
    prompt:
      STYLE +
      "SCREEN: Pricing framed around the user’s job, with an upgrade sheet overlaid. " +
      "Three plan cards stacked or in a scroll: 'Discover — Free — See what’s out there', " +
      "'Evaluate — Pro · $9/mo — Know if it’s real before you commit' marked Most popular and visually anchored in emerald, " +
      "'Execute — Builder · $19/mo — Go build it'. Each uses an 'Everything in the previous plan, plus' grouping with 3-4 concrete feature lines. " +
      "Overlaid at the bottom, a rounded bottom-sheet upgrade modal titled 'See if this market is real' with three emerald check bullets " +
      "(real market size with sources, who the competitors are, why-now timing), a cyan 'Sample it free on this idea' button and an emerald 'Start Pro' button. " +
      "The sheet reads as contextual, in-place conversion, not a separate page.",
  },
  {
    name: "8-enterprise",
    prompt:
      STYLE +
      "SCREEN: Enterprise landing for investors and corporate innovation teams. A confident hero: eyebrow 'For funds & innovation teams', " +
      "headline 'Deal-flow intelligence, before it’s obvious', and a subhead about sector monitoring and white-space analysis. " +
      "Three value rows with concise labels: 'Deal-flow intelligence', 'Sector trend monitoring', 'White-space analysis', each with a one-line description. " +
      "A credibility strip. Then a clean 'Request access' lead-capture form: fund/company name, work email, and a role selector, with an emerald submit button " +
      "and a small reassurance line that a real person follows up. More restrained and corporate than the consumer screens, same dark premium system.",
  },
];

const project = stitch.project(PROJECT_ID);
const out = { project: PROJECT_ID, screens: [] };

for (const s of screens) {
  console.log(`\nGenerating: ${s.name} …`);
  const t0 = Date.now();
  try {
    const screen = await project.generate(s.prompt, "MOBILE", "GEMINI_3_PRO");
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    let image = null;
    try {
      image = await screen.getImage();
    } catch {}
    const rec = { name: s.name, id: screen?.data?.name ?? screen?.data?.id, image, secs };
    out.screens.push(rec);
    console.log(`  done in ${secs}s · id=${rec.id}`);
  } catch (e) {
    console.log(`  FAILED: ${e?.message}`);
    out.screens.push({ name: s.name, error: e?.message });
  }
  writeFileSync("./result2.json", JSON.stringify(out, null, 2));
}
console.log("\nAll done. Wrote result2.json");
await stitch.close?.();
