import { stitch } from '@google/stitch-sdk';
import { writeFileSync } from 'node:fs';

const COMMON =
  "Mobile app home screen for 'Trend Equity', an AI startup-idea discovery app. " +
  'Dark theme: near-black background (#09090b), zinc surfaces (#18181b) with subtle 1px borders (#27272a), ' +
  "primary accent emerald green (#10b981), a warm amber-to-coral 'heat' accent (#fbbf24 to #fb7185) used ONLY for live market-signal ribbons, " +
  'and a cool cyan accent (#22d3ee) used ONLY for verified market evidence. ' +
  'Display headings are heavy, italic, tight. High contrast, clean, generous spacing, mobile-first. ';

const screens = [
  {
    name: '1-first-run-activation',
    prompt:
      COMMON +
      'PURPOSE: first-run / anonymous visitor — prove the product is real in five seconds. ' +
      "Top app bar: hamburger menu, italic uppercase wordmark 'TREND EQUITY', and a green 'Sign in' link on the right. " +
      "Welcome hero: large headline 'Ten startup ideas every morning — grounded in live market signals, checked against real evidence.' " +
      "with subtext 'So you build on proof, not a chatbot's guess.' Then a row of three small dotted source labels: 'Product Hunt', 'Hacker News', 'Google Trends'. " +
      "A full-width emerald primary button 'See today's ideas' with tiny caption below 'Free · no card'. " +
      "Then a FEATURED, fully-unlocked idea card: at its very top a warm amber/coral signal ribbon reading '▲ TRENDING · Product Hunt +340% · HN front page'; " +
      "title 'Audit-ready compliance copilot for fintechs'; an emerald score badge '8.7'; a row of small info chips '$3.1B market', '14% CAGR', 'Vanta, Drata', '4 next steps'; " +
      "and an emerald note '✦ One full idea, unlocked. Every idea has this depth inside.' " +
      "Then a SECOND idea card 'Rural pharmacy dispensing robotics' score '8.2' whose market-evidence rows are blurred behind a cyan lock chip labeled '🔒 Market Evidence — See the proof · Pro'.",
  },
  {
    name: '2-free-signed-in-conversion',
    prompt:
      COMMON +
      "PURPOSE: a signed-in FREE user — let them sample the paid 'aha' and convert in place, never teleport to a pricing page. " +
      "Top app bar: hamburger menu, italic uppercase wordmark 'TREND EQUITY', and a small grey 'Free' status pill on the right. " +
      "A slim 'today delta' strip: '✦ 10 new today · you saved 2' with a cyan sub-line '▸ 1 has fresh evidence since you looked'. " +
      "An idea card with a warm signal ribbon '▲ TRENDING · Product Hunt +340%', title 'Audit-ready compliance copilot for fintechs', emerald score '8.7', " +
      "a line 'Full pitch and VC analysis — included free', then a blurred cyan market-evidence teaser, and an action row of three buttons: " +
      "a cyan-outlined '🔍 Evidence · Pro', a '♡ Save', and a '⋯' button. " +
      'Overlaid at the bottom, a rounded bottom-sheet modal (as if it slid up when Evidence was tapped) with a drag handle and a close X, ' +
      "headline '🔒 See if this market is real', a small 'Market Evidence gives you' label, three emerald checkmark bullets: " +
      "'Real market size, with live sources', 'Who the competitors actually are', 'Why now — the timing evidence'; " +
      "a cyan primary button 'Sample it free on this idea', an emerald button 'Start Pro · $9/mo', and a quiet grey link 'Already building? Builder'.",
  },
  {
    name: '3-subscriber-today-retention',
    prompt:
      COMMON +
      "PURPOSE: a paying Builder subscriber home called 'Today' — open on the user's OWN state, not a generic feed, so leaving feels like a loss. " +
      "Top app bar: hamburger menu, italic uppercase title 'TODAY', and an emerald 'Builder' status pill. " +
      "A greeting 'Good morning, Dev-Raj'. A delta strip '✦ 10 new · 3 fit you · 🔥 6-day streak' with cyan sub-line '▸ 2 saved ideas moved'. " +
      'Then stacked dashboard modules, each a bordered card with a small uppercase label: ' +
      "(1) '📡 YOUR RADAR' listing followed spaces — 'AI compliance' with a warm coral '▲ +240% on PH', 'Dev tooling' greyed '▬ quiet', and an emerald '+ Follow a space' link. " +
      "(2) '🛠 WHAT YOU'RE BUILDING' with two roadmap progress rows: 'Compliance copilot' emerald progress bar at 70% '7/10' and next step 'ship evidence-collector MVP'; 'Rural pharmacy robotics' bar at 20% '2/10'. " +
      "(3) '📊 OUR TRACK RECORD' reading 'Ideas scored 8+, 6 months on: 7/10 moved' in cyan, with a link 'See how we grade — misses included'. " +
      "(4) '🗞 TODAY'S FEED' collapsed to just two rows ('Compliance copilot 8.7', 'Rural pharmacy robotics 8.2') and a '▸ 8 more' link, plus a 'See all' link. " +
      'The personal modules dominate; the feed is clearly the smallest, last module.',
  },
];

const out = { project: null, screens: [] };

console.log('Creating project…');
const project = await stitch.createProject('Trend Equity — Mobile Home Screens');
out.project = project?.data?.name ?? project?.data?.id ?? '(created)';
console.log('Project:', out.project);

for (const s of screens) {
  console.log(`\nGenerating: ${s.name} …`);
  const t0 = Date.now();
  const screen = await project.generate(s.prompt, 'MOBILE', 'GEMINI_3_PRO');
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  let image = null,
    htmlRef = null;
  try {
    image = await screen.getImage();
  } catch (e) {
    console.log('  getImage failed:', e?.message);
  }
  try {
    htmlRef = await screen.getHtml();
  } catch (e) {
    console.log('  getHtml failed:', e?.message);
  }
  const rec = { name: s.name, id: screen?.data?.name ?? screen?.data?.id, image, htmlRef, secs };
  out.screens.push(rec);
  console.log(`  done in ${secs}s · id=${rec.id}`);
  console.log(`  image=${image}`);
}

console.log('\nDownloading self-contained assets…');
try {
  const trace = await project.downloadAssets('./out');
  out.download = trace;
  console.log('  downloaded', JSON.stringify(trace, null, 2).slice(0, 1500));
} catch (e) {
  console.log('  downloadAssets failed:', e?.message);
}

writeFileSync('./result.json', JSON.stringify(out, null, 2));
console.log('\nWrote result.json');
await stitch.close?.();
