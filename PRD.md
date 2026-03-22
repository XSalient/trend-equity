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

---

## 3. User Tiers & Monetization
Trend Equity uses a tiered subscription model:

| Feature | Free | Pro | Builder |
| :--- | :--- | :--- | :--- |
| **Daily Ideas** | 10 ideas / day | 25 ideas / day | 25 ideas / day |
| **Saves** | 5 saves / month | Unlimited | Unlimited |
| **Exporting** | PDF Pitch Deck | PDF, Notion, GDocs | PDF, Notion, GDocs |
| **Analysis** | Basic VC Analysis | Full VC Analysis | Full VC Analysis |
| **Execution** | 3 Next Steps | 7 Next Steps | Full 10+ Step Roadmap |
| **Advanced Tools** | Locked | Validation Toolkit | Progress Tracker + Build with Me |

---

## 4. Key Features

### 4.1. Daily Feed
- A curated list of business opportunities refreshed every 24 hours.
- Contextualized insights based on current dates and global trends.

### 4.2. Idea Cards
- **Headline & Pitch:** Concise summary of the opportunity.
- **Potential Score:** A 1-10 rating of revenue potential.
- **Cost & Effort:** Assessment of technical and financial requirements.
- **Exit Strategy:** Potential acquisition targets or IPO paths.
- **Actionable Next Steps:** Tier-based roadmap for immediate execution.

### 4.3. VC Analysis (Expanded View)
- **VC Justification:** Why this idea is venture-backable.
- **Unfair Advantage:** Moats, patents, or unique distribution channels.
- **Revenue Model:** How the business makes money (SaaS, Marketplace, etc.).
- **Trend Sources:** Real-world signals (Hacker News, Reddit, Industry Reports).

### 4.4. Builder-Specific Features
- **Full Action Plan:** AI-generated 10+ step roadmap with milestones, tools, and risks.
- **Build with Me:** Automated generation of prompt packs and starter repository structures.
- **Validation Toolkit:** Frameworks for testing market demand.

### 4.5. Exporting & Sharing
- One-click export to PDF, Notion, or Google Docs for pitch preparation.

---

## 5. Technical Stack
- **Frontend:** React 18+, TypeScript, Tailwind CSS.
- **Animations:** Motion (framer-motion).
- **Icons:** Lucide-React.
- **Backend/Database:** Firebase (Authentication & Firestore).
- **AI Engine:** Google Gemini API (`gemini-3-flash-preview`).
- **PDF Generation:** jsPDF.

---

## 6. User Experience (UX) Design
- **Dark Mode First:** A premium, high-tech aesthetic using Zinc and Emerald color palettes.
- **Mobile-First:** Fully responsive design for on-the-go trend tracking.
- **Minimalist Interface:** Focus on high-signal content with collapsible analysis sections.
- **Interactive Feedback:** Real-time saving, filtering, and generation states.

---

## 7. Future Roadmap
- **Community Features:** Discussion threads for specific ideas.
- **Co-founder Matching:** Connect users interested in the same idea.
- **Live Market Data:** Integration with real-time stock and crypto APIs for deeper trend analysis.
- **Mobile App:** Native iOS/Android applications for push notifications on new trends.
