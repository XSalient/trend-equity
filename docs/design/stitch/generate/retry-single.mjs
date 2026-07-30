import { stitch } from "@google/stitch-sdk";
import { readFileSync, writeFileSync } from "node:fs";
const STYLE="Design this as a polished, premium production screen — not a wireframe. Aesthetic: high-end fintech / Bloomberg-terminal calm, lots of breathing room, strong typographic hierarchy, generous vertical rhythm, no clutter, no emoji, no ASCII symbols. Dark UI on near-black #09090b, surfaces #18181b with hairline #27272a borders, emerald #10b981 primary, cyan #22d3ee ONLY for verified evidence/citations, an amber-to-coral gradient ONLY for live market-signal ribbons. Heavy condensed italic display headings, clean sans body, tabular numerals. Real, specific content — never lorem. Mobile portrait. ";
const prompt=STYLE+"SCREEN: 'Analyze my idea' — the custom idea analysis tool. Top: title 'Analyze any idea' with subtitle 'Full VC analysis on a concept of your own' and a small monthly quota meter 'Pro · 3 of 5 left this month'. A large multi-line input with placeholder 'Describe your idea — who it’s for and the problem it solves', and an emerald 'Analyze' button. Below, a completed RESULT card for 'On-demand EV charging for apartment blocks': potential score 8.1/10, a justification paragraph, revenue-model and market-size sub-blocks, an expert-vetting verdict chip 'High Conviction', and actions 'Save to my ideas' and 'Open full analysis'. Show the quota meter and a subtle note that analyses are saved. Calm, focused, single-column.";
const project=stitch.project("projects/13591160038311824941");
let screen, lastErr;
for(let a=1;a<=4;a++){ try{ console.log("attempt",a); screen=await project.generate(prompt,"MOBILE","GEMINI_3_PRO"); break; }catch(e){ lastErr=e?.message; console.log("  fail:",lastErr); await new Promise(r=>setTimeout(r,a*4000)); } }
if(!screen){ console.log("gave up:",lastErr); process.exit(1); }
let image=null; try{ image=await screen.getImage(); }catch{}
const rec={name:"3-analyze-my-idea",id:screen?.data?.name??screen?.data?.id,image,secs:"retry"};
const r=JSON.parse(readFileSync("./result2.json","utf8"));
r.screens=r.screens.map(s=>s.name==="3-analyze-my-idea"?rec:s);
writeFileSync("./result2.json",JSON.stringify(r,null,2));
console.log("done id=",rec.id);
await stitch.close?.();
