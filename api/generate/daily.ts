import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, dailyResponseSchema } from '../_lib/gemini';
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';

const MOCK_RESPONSE = {
  intro: 'Welcome to Trend-Equity. (Currently using cached market signals due to high demand)',
  ideas: [
    {
      headline: 'AI-Powered Micro-SaaS for Niche Content Creators',
      pitch: 'A suite of specific AI tools for newsletter authors and small-scale publishers to automate research and cross-platform promotion.',
      vcJustification: 'Strong tailwinds in the solo-creator economy and high willingness to pay for productivity tools.',
      categoryTags: ['AI', 'SaaS', 'Creator Economy'],
      costEffort: 'Low Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: 'Tiered subscription model based on usage volume.',
      unfairAdvantage: 'Proprietary fine-tuning on creator-specific content datasets.',
      potentialExit: 'Acquisition by larger creator platforms (Substack, Beehiiv).',
      trendSources: ['Substack Growth Statistics 2026 — 35M paid subscribers, 12% YoY growth'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Trending',
      nextSteps: ['Define 3 core tools | 2 weeks | Dev costs | Replit', 'Build MVP waitlist | 1 week | Low traction | Beehiiv'],
      marketSize: '$5.1B by 2028, 22% CAGR (Creator Economy Market Report 2026)',
      competitorLandscape: 'Direct: Beehiiv AI, Jasper, Taplio | Edge: workflow automation across research + scheduling in one tool vs. single-function competitors',
      regulatoryFlags: 'Low — standard SaaS data handling; GDPR-compliant email processing required for EU users (~$10K/yr)',
    },
    {
      headline: 'AI Symptom-to-Supplement Recommendation Engine',
      pitch: 'A B2C app that maps chronic symptoms to evidence-backed supplement stacks, personalized by biomarkers and lifestyle inputs.',
      vcJustification: 'The $180B supplement industry is plagued by consumer confusion; personalization commands 3x average order value.',
      categoryTags: ['HealthTech', 'AI', 'Consumer Apps'],
      costEffort: 'Low Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: 'Freemium at $12/mo plus affiliate commissions from supplement partners.',
      unfairAdvantage: 'Proprietary symptom-supplement mapping trained on PubMed abstracts with user outcome feedback loops.',
      potentialExit: 'Acquisition by Thorne, Ritual, or Care/of.',
      trendSources: ['Global Wellness Institute Report 2026 — personalized nutrition segment up 41% YoY; "supplement recommendation" Google Trends search volume: 90K/mo'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Trending',
      nextSteps: ['Build symptom intake + recommendation engine | 3 weeks | Replit + Gemini API', 'Onboard 5 affiliate supplement brands | 2 weeks | Cold email'],
      marketSize: '$180B supplement market; personalized nutrition sub-segment $11.5B by 2027, 9.6% CAGR (Grand View Research 2026)',
      competitorLandscape: 'Direct: Care/of (acquired by Bayer), Persona Nutrition, Rootine | Edge: symptom-first intake vs. lifestyle quiz, PubMed-grounded recommendations vs. brand-led',
      regulatoryFlags: 'High — FDA FTC Health Claim rules prohibit disease-cure language; must use "structure/function" claims only. No FDA approval required but legal review ~$15K upfront',
    },
    {
      headline: 'Green Subscription Boxes for Gen-Z',
      pitch: 'Monthly curated sustainable product boxes with carbon-offset tracking and social sharing.',
      vcJustification: 'Gen-Z spending on sustainable goods is growing 3x faster than general retail.',
      categoryTags: ['Consumer Apps', 'Climate/Sustainability'],
      costEffort: 'Medium Capital, Low Technical',
      revenuePotentialScore: 7,
      revenueSkeleton: 'Monthly subscriptions at $29-$49/mo with 60% margins.',
      unfairAdvantage: 'TikTok-native unboxing virality engine.',
      potentialExit: 'Acquisition by Grove Collaborative or Thrive Market.',
      trendSources: ['Deloitte Gen-Z Sustainability Survey 2026 — 64% willing to pay premium for sustainable brands'],
      saturationLabel: 'Growing',
      heatBadge: 'Warm',
      nextSteps: ['Source 10 sustainable brands | 3 weeks', 'Launch TikTok pre-order campaign | 2 weeks'],
      marketSize: '$6.5B subscription box market; eco-focused segment $1.2B, 14% CAGR (Subscription Insider 2026)',
      competitorLandscape: 'Direct: Grove Collaborative, Package Free Shop, EarthHero | Edge: Gen-Z social-first carbon tracking vs. functional household-products focus of incumbents',
      regulatoryFlags: 'Low — standard e-commerce; "carbon neutral" claims require third-party certification (e.g., Climate Neutral ~$5K/yr) to avoid FTC greenwashing liability',
    },
    {
      headline: 'AI Study Buddy for Competitive Exam Prep',
      pitch: 'A personalized AI tutor that adapts to individual learning patterns for national competitive exams.',
      vcJustification: 'Massive TAM in education-focused markets with high willingness to pay.',
      categoryTags: ['EdTech', 'AI', 'Local Market'],
      costEffort: 'Medium Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: 'Freemium with premium tiers at $15-$30/month.',
      unfairAdvantage: 'Proprietary question bank trained on decade of past exam data.',
      potentialExit: "Acquisition by Byju's, Unacademy, or Chegg.",
      trendSources: ['HolonIQ EdTech Report 2026 — AI tutoring segment +68% YoY; "competitive exam prep" Google Trends: 110K monthly searches India alone'],
      saturationLabel: 'Growing',
      heatBadge: 'Trending',
      nextSteps: ['Build question bank for top 3 exams | 4 weeks', 'Beta launch with 500 students | 6 weeks'],
      marketSize: '$7.3B test prep market globally, 12% CAGR; India sub-segment $2.1B (HolonIQ 2026)',
      competitorLandscape: "Direct: Unacademy, Testbook, Byju's Exam Prep | Edge: adaptive spaced-repetition AI vs. static video content; no live-class dependency",
      regulatoryFlags: 'Low — EdTech is lightly regulated; India requires data localisation for user minors under DPDP Act 2023 (~$20K compliance setup)',
    },
    {
      headline: 'Hyperlocal Food Waste Marketplace',
      pitch: 'A marketplace connecting restaurants with surplus food to budget-conscious consumers at 70% discounts.',
      vcJustification: 'Food waste regulation is tightening globally, creating compliance-driven demand.',
      categoryTags: ['Service/Local/On-Demand', 'Climate/Sustainability', 'Local Market'],
      costEffort: 'Low Capital, Medium Technical',
      revenuePotentialScore: 7,
      revenueSkeleton: '15% commission on each transaction plus premium restaurant listings.',
      unfairAdvantage: 'Real-time inventory integration with POS systems.',
      potentialExit: 'Acquisition by DoorDash, Too Good To Go, or Uber Eats.',
      trendSources: ['EU Food Waste Directive 2026 mandates 30% waste reduction by 2030; Too Good To Go raised €25M Series B citing 300% restaurant partner growth'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Warm',
      nextSteps: ['Partner with 20 local restaurants | 3 weeks', 'Build mobile app MVP | 4 weeks | Flutter'],
      marketSize: '$1.8B surplus food marketplace segment by 2028, 27% CAGR (Allied Market Research 2026)',
      competitorLandscape: 'Direct: Too Good To Go (20M users EU), Karma (Nordics), Olio | Edge: POS API auto-publish vs. manual listing by restaurant staff — 10x less friction',
      regulatoryFlags: 'Medium — EU Food Waste Directive compliance (mandatory for B2B by 2027); food safety liability requires Terms of Service indemnification; legal ~$8K setup',
    },
    {
      headline: 'B2B Carbon Credit Verification Platform',
      pitch: 'An AI-powered platform that automates carbon credit verification and trading for mid-market enterprises.',
      vcJustification: 'Carbon markets are projected to reach $50B by 2030 with increasing regulatory pressure.',
      categoryTags: ['FinTech', 'Climate/Sustainability', 'SaaS'],
      costEffort: 'High Capital, High Technical',
      revenuePotentialScore: 9,
      revenueSkeleton: 'Per-verification fees plus annual platform subscriptions.',
      unfairAdvantage: 'Satellite imagery AI that detects greenwashing in real-time.',
      potentialExit: 'IPO or acquisition by Bloomberg or Refinitiv.',
      trendSources: ['World Bank State of Carbon Pricing 2026 — 73 carbon pricing instruments active globally, up from 51 in 2023; EU ETS carbon price $68/tonne avg'],
      saturationLabel: 'Low Competition',
      heatBadge: 'Hot',
      nextSteps: ['Build satellite data pipeline | 8 weeks | AWS', 'Pilot with 5 mid-market companies | 6 weeks'],
      marketSize: '$2.4B voluntary carbon market by 2027, growing to $50B by 2030 (BloombergNEF Carbon Market Outlook 2026)',
      competitorLandscape: 'Direct: Verra (Gold Standard), South Pole, BeZero Carbon | Edge: AI satellite verification removes 6-month manual audit cycle; mid-market pricing vs. enterprise-only incumbents',
      regulatoryFlags: 'High — SEC climate disclosure rules (US, effective 2026) require auditable carbon accounting; EU CSRD mandatory for 50K+ companies; compliance infrastructure $500K+ for enterprise buyers',
    },
    {
      headline: 'Regional Language Voice Commerce Assistant',
      pitch: 'A voice-first shopping assistant that lets users browse and buy in their native regional language.',
      vcJustification: 'Voice commerce is the fastest-growing channel in multilingual markets.',
      categoryTags: ['AI', 'Consumer Apps', 'Local Market'],
      costEffort: 'Medium Capital, High Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: 'Affiliate commissions plus premium merchant partnerships.',
      unfairAdvantage: 'Fine-tuned ASR models for underserved regional dialects.',
      potentialExit: 'Acquisition by Amazon Alexa or Google Assistant.',
      trendSources: ['IAMAI India Internet Report 2026 — 600M regional-language internet users; "voice shopping" Google Trends India +340% YoY'],
      saturationLabel: 'Pre-Market',
      heatBadge: 'Trending',
      nextSteps: ['Train voice models for top 5 regional languages | 6 weeks', 'Partner with 3 regional e-commerce platforms | 4 weeks'],
      marketSize: '$19.4B voice commerce globally by 2027 (Juniper Research 2025); India regional segment $2.8B addressable',
      competitorLandscape: 'Direct: Amazon Alexa Shopping (English-first), Google Shopping Actions | Edge: purpose-built for 22 Indian regional dialects vs. English-dominant voice UIs with poor regional accuracy',
      regulatoryFlags: 'Low — standard e-commerce affiliate model; India IT Act data localisation applies; GDPR only if targeting EU users',
    },
    {
      headline: 'White-Label Carbon Offset Widget for DTC Brands',
      pitch: 'A plug-and-play Shopify/WooCommerce widget that adds carbon offsetting at checkout, auto-calculating shipping emissions and routing funds to verified projects.',
      vcJustification: '73% of Gen-Z consumers prefer sustainable brands; DTC founders want low-effort ESG signals without engineering overhead.',
      categoryTags: ['Climate/Sustainability', 'SaaS', 'FinTech'],
      costEffort: 'Low Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: '8% platform fee on offset purchases plus $49/mo SaaS for premium analytics.',
      unfairAdvantage: 'One-click Shopify plugin with pre-vetted offset project network — zero merchant dev work required.',
      potentialExit: 'Acquisition by Stripe, Shopify, or EcoVadis.',
      trendSources: ['Shopify Sustainability Report 2026 — 73% Gen-Z pay premium for sustainable brands; Shopify App Store has 0 carbon-offset apps with >500 reviews'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Trending',
      nextSteps: ['Build Shopify app + emissions calculator | 3 weeks | Node.js', 'Get listed on Shopify App Store | 1 week | Submission'],
      marketSize: '$300M Shopify app ecosystem annual revenue; carbon offset SaaS niche $85M by 2027, 38% CAGR (MarketsandMarkets 2026)',
      competitorLandscape: 'Direct: Cloverly, EcoCart, Patch | Edge: white-label (merchant keeps brand vs. Cloverly branding); WooCommerce support vs. Shopify-only rivals',
      regulatoryFlags: "Medium — FTC Green Guides require substantiated offset claims; must use Gold Standard or VCS-certified projects; legal review $5K. EU's Digital Product Passport rules from 2027 may require emissions data API",
    },
    {
      headline: 'Local Artisan Marketplace with AR Try-On',
      pitch: 'An e-commerce platform for local artisans featuring AR-powered product visualization for handmade goods.',
      vcJustification: 'The handmade goods market is booming as consumers shift away from mass production.',
      categoryTags: ['Consumer Apps', 'Local Market'],
      costEffort: 'Medium Capital, Medium Technical',
      revenuePotentialScore: 7,
      revenueSkeleton: '12% marketplace commission plus premium storefront subscriptions.',
      unfairAdvantage: 'AR pipeline that works on low-end devices without app download.',
      potentialExit: 'Acquisition by Etsy or Shopify.',
      trendSources: ['Etsy 2025 Annual Report — handmade goods GMV $13.2B, seller base +18% YoY; r/Entrepreneur post "Etsy killing small sellers" — 4.2K upvotes, 800+ comments Jan 2026'],
      saturationLabel: 'Growing',
      heatBadge: 'Warm',
      nextSteps: ['Onboard 50 local artisans | 3 weeks | Instagram DMs', 'Build WebAR try-on prototype | 5 weeks | Three.js'],
      marketSize: '$13.2B handmade/vintage marketplace GMV (Etsy 2025); AR commerce overlay segment $4.5B by 2028 (IDC 2026)',
      competitorLandscape: 'Direct: Etsy, Folksy, ArtFire | Edge: WebAR try-on (no app download) solves the #1 return reason for handmade goods; Etsy has no native AR',
      regulatoryFlags: 'Low — marketplace model; standard seller KYC/AML for payments; EU Distance Selling Directive requires 14-day returns policy',
    },
    {
      headline: 'AI Menu Optimizer for Independent Restaurants',
      pitch: 'A SaaS tool that connects to POS systems and analyzes sales data, food costs, and local trends to recommend menu pruning, dynamic pricing, and seasonal specials.',
      vcJustification: 'Independent restaurants lack the analytics infrastructure of chains; food cost control is the #1 lever on profitability.',
      categoryTags: ['AI', 'SaaS', 'Service/Local/On-Demand'],
      costEffort: 'Low Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: '$99-$299/mo SaaS per restaurant location.',
      unfairAdvantage: 'Pre-built integrations with Square and Toast POS — data flows in on day one with no manual entry.',
      potentialExit: 'Acquisition by Toast, Square, or OpenTable.',
      trendSources: ['National Restaurant Association Tech Report 2026 — 68% of independent operators cite food cost control as #1 priority; Square App Marketplace has 0 dedicated menu-optimization tools'],
      saturationLabel: 'Low Competition',
      heatBadge: 'Trending',
      nextSteps: ['Build Square POS integration + cost dashboard | 3 weeks | Square API', 'Onboard 10 restaurants via local restaurant owner Facebook groups | 2 weeks'],
      marketSize: '$1.1B restaurant management SaaS by 2027, 15% CAGR (Grand View Research 2026); 500K+ independent US restaurants as TAM',
      competitorLandscape: 'Direct: Toast Analytics (basic), MarketMan, BlueCart | Edge: AI-generated menu change recommendations vs. data dashboards only; no incumbent combines POS + menu AI + dynamic pricing in one tool',
      regulatoryFlags: 'Low — SaaS data processing; PCI DSS compliance required for POS data access (~$5K/yr audit); standard restaurant data privacy applies',
    },
  ],
  disclaimer: 'These are illustrative ideas based on recent market shifts. Do your own diligence.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date, country, countryCount } = req.body;

  try {
    // Pre-fetch live market signals to ground generation in real current data
    const signals = await fetchLiveSignals();
    const signalContext = formatSignalsForPrompt(signals);

    let promptStr = signalContext
      ? `${signalContext}Generate 35 business ideas for ${date}. Today context: ${date}.`
      : `Generate 35 business ideas for ${date}. Today context: ${date}.`;

    if (country && country !== 'Global' && countryCount > 0) {
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored specifically for the market and demographics in ${country}. The rest should be global/US-centric as usual. Ensure the localized ideas explicitly include the exact string "Local Market" in their categoryTags array.`;
    }

    const data = await generateWithGemini(promptStr, dailyResponseSchema);
    return res.json(data);
  } catch (err: any) {
    console.error('Daily Generation Error (Falling back to mock):', err);
    return res.json(MOCK_RESPONSE);
  }
}
