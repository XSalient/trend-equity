import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, dailyResponseSchema } from '../_lib/gemini';

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
      trendSources: ['Substack Growth Statistics 2026'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Trending',
      nextSteps: ['Define 3 core tools | 2 weeks | Dev costs | Replit', 'Build MVP waitlist | 1 week | Low traction | Beehiiv'],
    },
    {
      headline: 'Autonomous Drone Delivery for Rural Pharmacies',
      pitch: 'Last-mile prescription delivery via autonomous drones for underserved rural communities.',
      vcJustification: 'Healthcare access gaps drive policy support and grant funding.',
      categoryTags: ['HealthTech', 'Hardware', 'Deep-Tech/Moonshot'],
      costEffort: 'High Capital, High Technical',
      revenuePotentialScore: 9,
      revenueSkeleton: 'Per-delivery fees plus pharmacy SaaS subscriptions.',
      unfairAdvantage: 'FAA exemption pipeline and rural hospital partnerships.',
      potentialExit: 'Acquisition by Amazon Pharmacy or UPS Health.',
      trendSources: ['FAA Drone Regulations 2026'],
      saturationLabel: 'Pre-Market',
      heatBadge: 'Hot',
      nextSteps: ['Secure FAA Part 135 exemption | 12 weeks | Legal', 'Pilot with 3 rural pharmacies | 8 weeks | Partnerships'],
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
      trendSources: ['Deloitte Gen-Z Sustainability Survey 2026'],
      saturationLabel: 'Growing',
      heatBadge: 'Warm',
      nextSteps: ['Source 10 sustainable brands | 3 weeks', 'Launch TikTok pre-order campaign | 2 weeks'],
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
      trendSources: ['EdTech Market Report 2026'],
      saturationLabel: 'Growing',
      heatBadge: 'Trending',
      nextSteps: ['Build question bank for top 3 exams | 4 weeks', 'Beta launch with 500 students | 6 weeks'],
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
      trendSources: ['EU Food Waste Directive 2026'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Warm',
      nextSteps: ['Partner with 20 local restaurants | 3 weeks', 'Build mobile app MVP | 4 weeks | Flutter'],
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
      trendSources: ['World Bank Carbon Pricing Report 2026'],
      saturationLabel: 'Low Competition',
      heatBadge: 'Hot',
      nextSteps: ['Build satellite data pipeline | 8 weeks | AWS', 'Pilot with 5 mid-market companies | 6 weeks'],
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
      trendSources: ['Voice Commerce Trends 2026'],
      saturationLabel: 'Pre-Market',
      heatBadge: 'Trending',
      nextSteps: ['Train voice models for top 5 regional languages | 6 weeks', 'Partner with 3 regional e-commerce platforms | 4 weeks'],
    },
    {
      headline: 'Peer-to-Peer EV Charging Network',
      pitch: "A platform that lets homeowners rent out their EV chargers to nearby drivers, Airbnb-style.",
      vcJustification: 'EV adoption is outpacing charging infrastructure 4:1.',
      categoryTags: ['Hardware', 'Service/Local/On-Demand', 'Climate/Sustainability'],
      costEffort: 'Medium Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: '20% platform fee on each charging session.',
      unfairAdvantage: 'Smart pricing algorithm based on grid demand and local EV density.',
      potentialExit: 'Acquisition by ChargePoint, Tesla, or Shell Recharge.',
      trendSources: ['IEA Global EV Outlook 2026'],
      saturationLabel: 'Early Adopter Stage',
      heatBadge: 'Hot',
      nextSteps: ['Build IoT smart lock for chargers | 6 weeks | Hardware', 'Launch in 3 high-EV-density neighborhoods | 4 weeks'],
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
      trendSources: ['Handmade Economy Report 2026'],
      saturationLabel: 'Growing',
      heatBadge: 'Warm',
      nextSteps: ['Onboard 50 local artisans | 3 weeks | Instagram DMs', 'Build WebAR try-on prototype | 5 weeks | Three.js'],
    },
    {
      headline: 'Neighborhood Micro-Investment Platform',
      pitch: 'Let residents invest small amounts ($50-$500) in local businesses in exchange for revenue share and perks.',
      vcJustification: 'Community-driven finance is surging as trust in traditional banking erodes.',
      categoryTags: ['FinTech', 'Service/Local/On-Demand', 'Local Market'],
      costEffort: 'High Capital, Medium Technical',
      revenuePotentialScore: 8,
      revenueSkeleton: '2.5% platform fee on investments plus premium business analytics tier.',
      unfairAdvantage: 'Hyperlocal trust graph built from neighborhood social data.',
      potentialExit: 'Acquisition by Republic, Wefunder, or Block (Square).',
      trendSources: ['Community Finance Survey 2026'],
      saturationLabel: 'Low Competition',
      heatBadge: 'Hot',
      nextSteps: ['Obtain SEC Reg CF compliance | 8 weeks | Legal', 'Pilot in 2 neighborhoods with 10 businesses each | 6 weeks'],
    },
  ],
  disclaimer: 'These are illustrative ideas based on recent market shifts. Do your own diligence.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date, country, countryCount } = req.body;

  try {
    let promptStr = `Generate 35 business ideas for ${date}. Today context: ${date}.`;
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
