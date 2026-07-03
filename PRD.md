# Product Requirements Document (PRD): Trend Equity

## 1. Product Overview

**Trend Equity** is a high-conviction business opportunity platform that delivers data-driven startup ideas daily. It leverages AI (Gemini) to analyze current trends, market shifts, and cultural events to provide entrepreneurs with actionable, VC-ready business concepts.

### 1.1. Mission

To empower entrepreneurs by providing high-signal business opportunities and the roadmap to execute them, reducing the friction between "idea" and "execution."

---

## 2. Target Audience

- **Aspiring Entrepreneurs:** Individuals looking for their next big project.
- **Serial Founders:** Experienced builders seeking validated market gaps.
- **Side-Hustlers:** Professionals looking for high-potential, low-effort business models.
- **Investors/VCs:** Staying ahead of emerging trends and early-stage concepts.
- **Corporate Innovation Teams:** Monitoring sector shifts and white space analysis for strategic planning.

---

## 3. User Tiers & Monetization

Trend Equity uses a tiered subscription model:

| Feature                    | Free              | Pro                        | Builder                           | Enterprise (Validation)           |
| :------------------------- | :---------------- | :------------------------- | :-------------------------------- | :------------------------------- |
| **Daily Ideas**            | 10 ideas / day    | 25 ideas / day             | 35 ideas / day                    | Custom / Full Access             |
| **Saves**                  | 5 saves / month   | Unlimited                  | Unlimited                         | Unlimited                        |
| **Custom Idea Analysis**   | —                 | 5 / month                  | 20 / month                        | Unlimited                        |
| **Custom Requirement Feed** | Locked            | 1 keyword, 5 ideas / 24h   | Natural language, 5 ideas / 24h   | Custom thesis feeds             |
| **Exporting**              | PDF Pitch Deck    | PDF, Notion/GDocs (clipboard) | PDF, Notion/GDocs (clipboard)  | Custom Data Integration (API)    |
| **Analysis**               | Basic VC Analysis | Full VC Analysis           | Full VC Analysis + Expert Vetting | Proprietary Thesis Alignment     |
| **Execution**              | 3 Next Steps      | 7 Next Steps               | Full 10+ Step Roadmap             | Full 10+ Step Roadmap            |
| **Weekly Best**            | —                 | ✓                          | ✓                                 | ✓                                |
| **Advanced Tools**         | Locked            | Email Digest *(planned)*   | Radar, Futurecasting, TE100, API  | Custom Alerts + Dashboard        |
| **Community**              | Read-only         | Post & Reply               | Priority Threads                  | Private Slack/Discord Connect    |

---

## 4. Key Features

### 4.1. Daily Feed

- A curated list of business opportunities refreshed every 24 hours.
- Contextualized insights based on current dates and global trends.
- **Signal Sources:** AI-driven scanning of Hacker News, Reddit, X (Twitter), and industry reports.

### 4.2. Idea Cards

- **Headline & Pitch:** Concise summary of the opportunity.
- **Potential Score:** A 1-10 rating of revenue potential.
- **Cost & Effort:** Assessment of technical and financial requirements.
- **Expert Vetting:** AI-driven score, verdict (High Conviction, Moderate, Pass), and pivot suggestions.
- **Next Steps:** Tier-based roadmap for immediate execution.

### 4.3. Market Intelligence (Pro/Builder)

- **Weekly Best (Pro/Builder):** Aggregated top-performing ideas based on user engagement and market signals.
- **Weekly Trend Radar (Builder):** Macro analysis of emerging market shifts and opportunity areas.
- **Futurecasting (Builder):** Long-term predictions for 2027, 2030, and 2035 horizons with rationale and impact analysis.
- **Email Digest (Pro/Builder):** Daily or weekly summaries of high-signal opportunities. *(UI shipped; backend delivery in development.)*

### 4.3b. Custom Idea Analysis (Pro/Builder)

- **Analyze Any Idea:** Submit a custom business concept for full AI-driven VC analysis outside the daily feed.
- **Monthly Quota:** Pro users receive 5 analyses/month; Builder users receive 20 analyses/month.
- **Output:** Same VC analysis depth as feed ideas — justification, revenue model, unfair advantage, market size, competitor landscape, and regulatory flags.
- **Persistence:** Most recent analysis is stored per-user in `user_latest_idea/{uid}` and surfaced in the Saved tab.


### 4.3c. Custom Requirement Feed (Pro/Builder)

- **Purpose:** Generate a focused feed from current market signals based on user-defined requirements rather than browsing only the global daily feed.
- **Free:** Control is visible but locked/disabled as an upgrade path.
- **Pro:** One keyword can be submitted per 24-hour window; returns up to 5 matching ideas.
- **Builder:** Natural-language requirements can be submitted per 24-hour window; returns up to 5 matching ideas.
- **Caching:** The first custom feed generated in a 24-hour window is cached per user and returned on repeat requests until the window expires.
- **Result States:** The API must distinguish complete results (5 ideas), partial results (1-4 ideas), and empty results (0 ideas) so the UI can explain whether strong signal-backed matches were found.

### 4.4. VC Analysis & Vetting

- **VC Justification:** Why this idea is venture-backable.
- **Unfair Advantage:** Moats, patents, or unique distribution channels.
- **Revenue Model:** Detailed breakdown of SaaS, Marketplace, or Service models.
- **Market Dynamics:** Analysis of market size, competitor landscape, and regulatory flags.

### 4.5. Builder-Specific Features

- **Full Action Plan:** AI-generated 10+ step roadmap with milestones, tools, and risks.
- **Plan Customization:** Add custom steps, remove steps, and mark steps as completed.
- **VC Deep Dive:** AI-driven explanations for specific plan sections (Roadmap, Stack, Risks).
- **Persistence:** Customized plans are saved and cached for fast viewing in the "Saved" tab.
- **Build with Me:** Automated generation of prompt packs and starter repository structures.
- **TE100 & API Access:** Priority access to the top 100 trending ideas and programmatic API integration.
- **Validation Toolkit:** Frameworks for testing demand, including landing page copy and interview scripts.

### 4.6. Exporting & Sharing

- One-click export to **PDF** (generated client-side via jsPDF).
- **Notion / Google Docs:** Generates formatted Markdown copied to clipboard for direct paste — no OAuth integration required.
- **CSV Export:** Bulk export of idea lists for external analysis.

### 4.7. Community & Interaction

- **Idea Threads:** Real-time commenting and feedback loop for every business concept.
- **Alerts System:** Instant notifications for system updates, trend shifts, or community replies.

### 4.8. Enterprise Landing Page (`/enterprise`)

- **B2B Positioning:** A dedicated landing page targeted at VCs and Corporate Innovation teams.
- **Messaging:** Focused on "Deal Flow Intelligence," "Sector Trend Monitoring," and "White Space Analysis."
- **Lead Capture:** Integrated submission form for investment teams to request early access.
- **Persistence:** Leads are captured in the `enterprise_leads` Firestore collection with source tracking.

---

## 5. Technical Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4.0, Vite 6.
- **Mobile:** Capacitor 8 (Android & iOS integration).
- **Animations:** Motion (framer-motion v12).
- **Icons:** Lucide-React.
- **Backend/Database:** Firebase (Authentication & Firestore); Vercel Serverless Functions (production API); Express BFF (local dev only, port 3001).
- **AI Engine:** Google Gemini SDK (`@google/genai`).
- **PDF Generation:** jsPDF.

---

## 6. User Experience (UX) Design

- **Dark Mode First:** A premium, high-tech aesthetic using Zinc and Emerald color palettes.
- **Mobile-First & Native:** Fully responsive web design with native mobile support via Capacitor.
- **Accessibility:** ARIA-compliant navigation, semantic HTML, and inclusive UI patterns.
- **Performance:** Optimized loading with Skeleton Screens and optimistic UI states.
- **Interactive Feedback:** Real-time saving, filtering, and community engagement.

---

## 7. Future Roadmap

- **Co-founder Matching:** Connect users interested in building the same concept.
- **Live Market Data:** Integration with real-time stock, crypto, and market sentiment APIs.
- **Advanced Analytics:** Dashboard for tracking personal portfolio performance and trend hit rates.
- **Native Push Notifications:** Enhanced mobile engagement via Capacitor plugins.
