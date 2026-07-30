# Product Requirements Document (PRD): Trend Equity

## 1. Product Overview

**Trend Equity** is a personal opportunity-radar and execution platform. It monitors current market signals, identifies high-conviction business opportunities, verifies them with evidence, and helps entrepreneurs decide what to validate and build.

### 1.1 Mission

Help entrepreneurs move from market change to an evidence-based decision and then to accountable execution, reducing wasted time on generic or unverified ideas.

### 1.2 Core product loop

**Follow a market → detect a meaningful change → verify the opportunity → decide → validate → build → track.**

The daily idea feed is an entry point to this loop, not the complete product.

---

## 2. Target Audience

- **Aspiring entrepreneurs:** looking for a credible opportunity and a practical starting point.
- **Serial founders:** monitoring markets and validating new wedges.
- **Side-hustlers:** seeking opportunities that fit their time, budget, and skills.
- **Investors and VCs:** identifying early shifts and opportunity spaces.
- **Corporate innovation teams:** monitoring sectors and white space.

---

## 3. User Tiers and Monetization

Trend Equity uses a three-tier consumer model plus Enterprise. The target promises below supersede the earlier 10/25/35 partially locked free-feed model. Current code still contains old limits until the tier-v2 migration is implemented.

| Capability | Discover — Free | Evaluate — Pro | Execute — Builder | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| **Core promise** | Evaluate one real opportunity completely | Continuously discover and evaluate qualified opportunities | Validate and execute a chosen opportunity | Custom opportunity intelligence |
| **Daily opportunities** | **1 complete Idea of the Day** | All opportunities passing the daily quality standard, subject to an operational cap | Same qualified set as Pro | Custom feeds and full access |
| **Idea evaluation** | Full evaluation of the featured idea | Full evaluation of all qualified ideas | Full evaluation plus execution workflows | Proprietary thesis alignment |
| **Market evidence** | Included for the featured idea, with real source links | Included across qualified ideas and custom analyses | Included | Custom research |
| **Saves** | 5 concurrent saves | Unlimited | Unlimited | Unlimited |
| **Custom idea analysis** | Not included | 5 per month | 20 per month | Custom or unlimited |
| **Custom requirement feed** | Not included | Focused requirement feed | Advanced natural-language requirement feed | Custom thesis feeds |
| **Monitoring and personalization** | Not included beyond the daily featured idea | Founder-fit ranking, saved-idea changes, thesis monitoring as implemented | Advanced radar, futurecasting, and alerts | Custom monitoring and dashboards |
| **Execution** | Concise starter next steps inside the featured evaluation | Validation toolkit and intermediate action support | Full customizable roadmap, tracked validation, build packs, and accountability | Custom roadmap and advisory workflow |
| **Exporting** | PDF/share for the featured idea | PDF, CSV, Notion/Google Docs clipboard | Same plus advanced portfolio exports | Custom integration/API |
| **Community** | Read-only discussion and reactions | Post and reply | Priority/build-oriented participation | Private community or workspace integration |
| **Advanced intelligence** | Not included | Weekly Best and appropriate digest | Weekly Radar, Futurecasting, TE100, and API-oriented access | Custom intelligence |

### 3.1 Free completeness rule

The Free Idea of the Day has **no blurred sections, disabled evidence controls, or paywalls inside the idea**. It includes, when the data exists:

- live-signal context and provenance;
- headline, pitch, score, cost/effort, and timing;
- complete VC analysis;
- market size, competitors, regulatory risks, revenue model, and realistic moat;
- search-grounded market evidence and source links;
- a concise starter action plan;
- save/share actions after sign-in.

Paid value starts when the user asks for more breadth or a recurring workflow: more opportunities, custom analysis, continuous monitoring, validation tracking, advanced exports, or execution tools.

### 3.2 Quality determines quantity

New product and marketing copy must not guarantee 10, 25, or 35 ideas. Pro and Builder receive all opportunities that pass the daily publishing standard, up to an operational cap. If none passes, the product shows an honest unavailable state rather than publishing a weak idea to satisfy a count.

---

## 4. Key Features

### 4.1 Daily opportunity service

- A curated set of qualified opportunities refreshed every 24 hours.
- One stable `featuredIdeaId` designates the complete Free Idea of the Day.
- Anonymous and signed-in Free users receive one full server-authorized idea.
- Pro and Builder receive the qualified daily set.
- Signal sources currently include Google Trends, Product Hunt, Reddit, Hacker News, and TechCrunch.
- Quantitative signal claims require structured provenance: source, URL or source ID, timestamp, metric, current value, comparison value/window, delta, and data-quality state.
- Until structured metrics exist, the UI uses honest provenance labels without invented percentages.

### 4.2 Idea evaluation

Each complete evaluation can include:

- headline and concise pitch;
- potential score and justification;
- cost/effort and timing;
- unfair advantage or realistic moat;
- revenue model;
- market size and competitor landscape;
- regulatory and structural risks;
- expert-vetting verdict and pivots when supported;
- search-grounded evidence and citations;
- immediate next steps.

### 4.3 Custom idea analysis — Pro and Builder

- Submit a user-owned concept for rigorous AI-driven analysis.
- Pro quota: 5 per month.
- Builder quota: 20 per month.
- Output includes the same evaluation depth as a complete feed idea.
- The most recent result is persisted in `user_latest_idea/{uid}` and surfaced in the user library.

### 4.4 Custom requirement feed — Pro and Builder

- Generate a focused feed from current market signals using user requirements.
- Pro supports a focused keyword or constrained request.
- Builder supports richer natural-language requirements.
- Results are cached per user for 24 hours.
- The API distinguishes complete, partial, and empty results rather than padding low-quality output.

### 4.5 Personal opportunity radar — paid, phased

- Users follow markets, keywords, sectors, or saved ideas.
- The system detects meaningful changes and records why they matter.
- Alerts and digests are personal and trigger-based, not generic “new ideas” broadcasts.
- Push notifications ship only after the radar produces a useful personal trigger.

### 4.6 Validation and execution workspace

**Pro:**

- validation toolkit generation;
- landing-page copy, interview scripts, and validation checklists;
- intermediate action support.

**Builder:**

- full 10+ step roadmap with milestones, tools, and risks;
- step customization and completion tracking;
- tracked experiments, notes, outcomes, and go/no-go decisions;
- build packs and starter-repository prompts;
- cross-idea “What I’m building” view;
- progress/accountability and ship-log.

### 4.7 Saved library and personal Today view

- Saved ideas, custom analyses, tracked experiments, and build progress accrue in a user-owned workspace.
- Saved ideas may show new evidence or meaningful market movement.
- Paying users eventually open on a personal Today view: what changed, what needs action, and what progressed.
- The generic daily feed becomes one module within the paid workspace.

### 4.8 Market intelligence

- **Weekly Best — Pro/Builder:** strongest qualified opportunities and relevant changes.
- **Weekly Trend Radar — Builder:** emerging shifts with evidence and implications.
- **Futurecasting — Builder:** longer-horizon predictions with explicit rationale and uncertainty.
- **Track record:** may be public only after prediction outcomes have a defined review and grading workflow. Publish-time snapshots alone are not a hit rate.

### 4.9 Exporting and sharing

- Free: PDF/share of the featured idea.
- Pro/Builder: PDF, CSV, and formatted Markdown for Notion/Google Docs clipboard.
- Enterprise: custom data integration or API access.

### 4.10 Community and co-founder features

- Public idea threads and reactions may support evaluation and feedback.
- Free remains read-only for comments; Pro+ may post.
- Co-founder matching is future work. A cosmetic “seeking partner” toggle must not be marketed as matching until a genuine opt-in builders list, discovery flow, privacy model, and contact path exist.

### 4.11 Enterprise

- Dedicated positioning for investors and corporate innovation teams.
- Deal-flow intelligence, sector monitoring, and white-space analysis.
- Anonymous lead capture through the serverless enterprise endpoint.
- Custom feeds, dashboards, research, and integration based on contract.

---

## 5. Conversion and Subscription Experience

- The Free Idea of the Day remains uninterrupted.
- Upgrade prompts appear after the complete idea or when the user requests a paid job such as seeing all ideas, custom analysis, radar, validation, or roadmap execution.
- Context is preserved; users are not teleported to an unrelated pricing screen.
- Discover / Evaluate / Execute is the canonical plan framing.
- A reverse trial is a later isolated experiment, not part of the initial tier-v2 launch.
- Cancellation flows should capture a concise reason and may offer a suitable pause, downgrade, or retention option without trapping the user.

---

## 6. Analytics and Success Measures

### 6.1 Funnel events

Track at minimum:

- landing viewed;
- featured idea viewed and depth reached;
- evidence source opened;
- save/sign-in attempted and completed;
- more ideas or custom analysis requested;
- contextual upgrade prompt viewed;
- checkout started and completed;
- day-2 and day-7 return.

Anonymous activation must not disappear solely because there is no account ID. Use privacy-respecting session or aggregate event handling.

### 6.2 North-star direction

The long-term north-star is **Weekly Active Operators**: users who complete a meaningful opportunity-intelligence or execution action, not merely open the app.

Examples include reviewing a change, saving with intent, updating a validation experiment, completing a roadmap step, or acting on a thesis alert.

---

## 7. Technical Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite 6.
- **Mobile:** Capacitor 8.
- **Backend:** Firebase Authentication and Firestore; Vercel Serverless Functions; Express BFF for local development.
- **AI engine:** Google Gemini through the unified provider layer.
- **Evidence:** Google Search grounding.
- **Payments:** Stripe for web subscription lifecycle; native Android paid distribution requires an explicit Play Billing or eligible alternative-billing architecture decision before launch.
- **Export:** jsPDF and structured client exports.

---

## 8. Security and Entitlement Requirements

- The server re-reads tier from Firestore; the client never grants a tier.
- Free clients receive one full featured idea through a server-side projection. The paid set must not be sent to the browser and hidden with CSS or array slicing.
- Featured evidence is precomputed or cached so Free cannot invoke arbitrary paid evidence generation for other ideas.
- New user fields require Firestore-rule allowlist review.
- Account-scoped state is cleared on sign-out and account switch.
- Checkout remains free-to-paid only; paid plan changes and cancellation use the Customer Portal.

---

## 9. UX Requirements

- Dark-mode-first, mobile-first, accessible, and responsive.
- Signal provenance and verified evidence are visually distinct from promotional copy.
- No unsupported numerical signal decoration.
- Loading, empty, error, anonymous, Free, Pro, Builder, and tier-loading states are designed explicitly.
- A passing API call is not a completed journey; each action must have a usable end state.

---

## 10. Implementation Reference

Canonical tier-v2 strategy and migration plan:

`docs/superpowers/plans/2026-07-30-one-complete-free-idea-strategy.md`

Cross-agent status and continuation guide:

`docs/PROJECT_HANDOFF.md`
