import React, { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Bell,
  Users,
  Trophy,
  Settings,
  AlertTriangle,
  X,
  ArrowDown,
  FileText,
  Bookmark,
  Mail,
  Wrench,
  Eye,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WaitlistModal } from './WaitlistModal';

interface PricingSectionProps {
  currentPlan: 'free' | 'pro' | 'builder';
  onUpgrade: (plan: 'pro' | 'builder') => void;
  onDowngrade: (plan: 'free' | 'pro') => void;
  onOpenTE100?: () => void;
  onOpenApiAccess?: () => void;
}

type PlanKey = 'free' | 'pro' | 'builder';

// Define what each tier offers so we can compute losses on downgrade
const TIER_FEATURES: Record<string, { label: string; tiers: string[] }[]> = {
  pro: [
    { label: 'Up to 25 ideas / day (vs 10 on Free)', tiers: ['pro', 'builder'] },
    { label: 'Unlimited Daily Feed Saves', tiers: ['pro', 'builder'] },
    { label: 'Analyze 5 Custom Ideas / mo', tiers: ['pro', 'builder'] },
    { label: '1-keyword custom feed: 5 ideas / 24h', tiers: ['pro', 'builder'] },
    { label: 'Save 3 Custom Ideas to Library', tiers: ['pro', 'builder'] },
    { label: 'Notion / GDocs Templates', tiers: ['pro', 'builder'] },
    { label: 'Priority Email Digest', tiers: ['pro', 'builder'] },
    { label: 'Validation Toolkit', tiers: ['pro', 'builder'] },
  ],
  builder: [
    { label: 'Up to 35 ideas / day', tiers: ['builder'] },
    { label: 'Analyze 20 Custom Ideas / mo', tiers: ['builder'] },
    { label: 'Save 10 Custom Ideas to Library', tiers: ['builder'] },
    { label: 'Natural-language custom requirement feed', tiers: ['builder'] },
    { label: 'Build with Me Suite', tiers: ['builder'] },
    { label: 'Advanced Alerts', tiers: ['builder'] },
    { label: 'Weekly Trend Radar', tiers: ['builder'] },
    { label: 'Futurecasting Engine', tiers: ['builder'] },
    { label: 'Expert Vetting', tiers: ['builder'] },
    { label: 'TE-100 Submission', tiers: ['builder'] },
    { label: 'API Access', tiers: ['builder'] },
    { label: 'Find Co-Founder', tiers: ['builder'] },
  ],
};

function getFeaturesLost(from: string, to: string): string[] {
  const allFeatures = [...TIER_FEATURES.builder, ...TIER_FEATURES.pro];
  return allFeatures
    .filter((f) => f.tiers.includes(from) && !f.tiers.includes(to))
    .map((f) => f.label);
}

// Feature showcase items per tier (displayed below the cards)
const TIER_SHOWCASE: Record<PlanKey, { icon: React.ReactNode; label: string; onClick?: string }[]> =
  {
    free: [
      { icon: <Eye className="w-5 h-5 text-emerald-500 mx-auto" />, label: '10 Ideas Daily' },
      { icon: <Bookmark className="w-5 h-5 text-emerald-500 mx-auto" />, label: '5 Saves / Month' },
      { icon: <FileText className="w-5 h-5 text-emerald-500 mx-auto" />, label: 'PDF Export' },
    ],
    pro: [
      { icon: <Eye className="w-5 h-5 text-emerald-500 mx-auto" />, label: '25 Ideas Daily' },
      { icon: <Bookmark className="w-5 h-5 text-emerald-500 mx-auto" />, label: 'Unlimited Saves' },
      { icon: <FileText className="w-5 h-5 text-emerald-500 mx-auto" />, label: 'Notion / GDocs' },
      { icon: <Mail className="w-5 h-5 text-emerald-500 mx-auto" />, label: 'Email Digest' },
      {
        icon: <Sparkles className="w-5 h-5 text-emerald-500 mx-auto" />,
        label: 'Keyword Custom Feed',
      },
      {
        icon: <Wrench className="w-5 h-5 text-emerald-500 mx-auto" />,
        label: 'Validation Toolkit',
      },
    ],
    builder: [
      { icon: <Wand2 className="w-5 h-5 text-amber-500 mx-auto" />, label: '20 Analyses / mo' },
      {
        icon: <Sparkles className="w-5 h-5 text-amber-500 mx-auto" />,
        label: 'Custom Requirement Feed',
      },
      { icon: <Bookmark className="w-5 h-5 text-amber-500 mx-auto" />, label: '10 Custom Saves' },
      { icon: <Bell className="w-5 h-5 text-amber-500 mx-auto" />, label: 'Real-time Alerts' },
      { icon: <Users className="w-5 h-5 text-amber-500 mx-auto" />, label: 'Team-up Access' },
      {
        icon: <Trophy className="w-5 h-5 text-amber-500 mx-auto" />,
        label: 'TE-100 Submission',
        onClick: 'te100',
      },
      {
        icon: <Settings className="w-5 h-5 text-amber-500 mx-auto" />,
        label: 'API Access',
        onClick: 'api',
      },
    ],
  };

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentPlan,
  onUpgrade,
  onDowngrade,
  onOpenTE100,
  onOpenApiAccess,
}) => {
  const [pendingDowngrade, setPendingDowngrade] = useState<'free' | 'pro' | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistTier, setWaitlistTier] = useState<'pro' | 'builder'>('pro');
  const validPlans: PlanKey[] = ['free', 'pro', 'builder'];
  const safePlan: PlanKey = validPlans.includes(currentPlan) ? currentPlan : 'free';
  const [selectedTier, setSelectedTier] = useState<PlanKey>(safePlan);

  const featuresLost = pendingDowngrade ? getFeaturesLost(currentPlan, pendingDowngrade) : [];

  const handleDowngradeClick = (targetPlan: 'free' | 'pro') => {
    setPendingDowngrade(targetPlan);
  };

  const confirmDowngrade = () => {
    if (pendingDowngrade) {
      onDowngrade(pendingDowngrade);
      setPendingDowngrade(null);
    }
  };

  const handleShowcaseClick = (item: { onClick?: string }) => {
    if (item.onClick === 'te100') onOpenTE100?.();
    if (item.onClick === 'api') onOpenApiAccess?.();
  };

  // Border/highlight color for selected tier
  const getCardStyle = (tier: PlanKey) => {
    const isSelected = selectedTier === tier;
    const isCurrent = currentPlan === tier;
    if (isSelected && tier === 'builder')
      return 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30';
    if (isSelected) return 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30';
    if (isCurrent) return 'border-zinc-600 bg-zinc-900/50';
    return 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600';
  };

  const showcaseColor = selectedTier === 'builder' ? 'amber' : 'emerald';

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-black uppercase italic tracking-tight">Choose Your Path</h3>
        <p className="text-zinc-500 text-sm">No ads ever. Just high-signal opportunities.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div
          onClick={() => setSelectedTier('free')}
          className={`p-6 rounded-3xl border ${getCardStyle('free')} space-y-6 flex flex-col cursor-pointer transition-all duration-200`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-lg font-black uppercase italic">Free</h4>
              <p className="text-3xl font-black">$0</p>
            </div>
            {currentPlan === 'free' && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                Current
              </span>
            )}
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-xs text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 10 ideas / day
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 5 saves / month
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> PDF Export
            </li>
          </ul>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentPlan !== 'free') handleDowngradeClick('free');
            }}
            disabled={currentPlan === 'free'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentPlan === 'free' ? 'bg-zinc-800 text-zinc-500 cursor-default' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
          >
            {currentPlan === 'free' ? 'CURRENT PLAN' : 'DOWNGRADE'}
          </button>
        </div>

        {/* Pro Plan */}
        <div
          onClick={() => setSelectedTier('pro')}
          className={`p-6 rounded-3xl border ${getCardStyle('pro')} space-y-6 relative overflow-hidden flex flex-col cursor-pointer transition-all duration-200`}
        >
          <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
            Popular
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-lg font-black uppercase italic">Pro</h4>
              <p className="text-3xl font-black">
                $9<span className="text-sm text-zinc-500">/mo</span>
              </p>
            </div>
            {currentPlan === 'pro' && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                Current
              </span>
            )}
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 25 ideas / day
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited Saves
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Notion/GDocs Templates
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Priority Email Digest
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Validation Toolkit
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1-keyword custom feed
            </li>
          </ul>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentPlan === 'free') {
                setWaitlistTier('pro');
                setWaitlistOpen(true);
              }
              if (currentPlan === 'builder') handleDowngradeClick('pro');
            }}
            disabled={currentPlan === 'pro'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              currentPlan === 'builder'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ' +
                  (currentPlan === 'pro' ? 'opacity-50 cursor-default' : 'hover:bg-emerald-500')
            }`}
          >
            {currentPlan === 'pro'
              ? 'CURRENT PLAN'
              : currentPlan === 'builder'
                ? 'DOWNGRADE'
                : 'JOIN WAITLIST'}
          </button>
        </div>

        {/* Builder Plan */}
        <div
          onClick={() => setSelectedTier('builder')}
          className={`p-6 rounded-3xl border ${getCardStyle('builder')} space-y-6 flex flex-col cursor-pointer transition-all duration-200`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-lg font-black uppercase italic">Builder</h4>
              <p className="text-3xl font-black">
                $19<span className="text-sm text-zinc-500">/mo</span>
              </p>
            </div>
            {currentPlan === 'builder' && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                Current
              </span>
            )}
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> 35 ideas / day
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Natural-language custom feed
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Build with Me Suite
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Advanced Alerts
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Weekly Trend Radar
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Futurecasting Engine
            </li>
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> Expert Vetting
            </li>
          </ul>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentPlan !== 'builder') {
                setWaitlistTier('builder');
                setWaitlistOpen(true);
              }
            }}
            disabled={currentPlan === 'builder'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              currentPlan === 'builder'
                ? 'bg-zinc-800 text-zinc-500 cursor-default'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
            }`}
          >
            {currentPlan === 'builder' ? 'CURRENT PLAN' : 'JOIN WAITLIST'}
          </button>
        </div>
      </div>

      {/* Enterprise Upgrade Option */}
      <div
        onClick={() => (window.location.href = '/enterprise')}
        className="p-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-emerald-500/20 border border-emerald-500/30 cursor-pointer group hover:scale-[1.01] transition-all duration-300"
      >
        <div className="bg-zinc-950 p-6 rounded-[22px] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
              <Users className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-black uppercase italic tracking-tight">
                  Enterprise Intelligence
                </h4>
                <span className="px-2 py-0.5 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest rounded-full">
                  New
                </span>
              </div>
              <p className="text-zinc-500 text-xs max-w-md">
                Custom deal flow intelligence and sector white space analysis for VC partners and
                corporate innovation teams.
              </p>
            </div>
          </div>
          <button className="whitespace-nowrap px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-lg shadow-emerald-500/20">
            Request Early Access
          </button>
        </div>
      </div>

      {/* Tier Feature Showcase (dynamic based on selected/previewed tier) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTier}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-3 pt-4"
        >
          <p
            className={`text-center text-xs font-bold uppercase tracking-widest text-${showcaseColor}-500/70`}
          >
            {selectedTier === currentPlan
              ? `Your ${selectedTier.toUpperCase()} Features`
              : `Preview: ${selectedTier.toUpperCase()} Features`}
          </p>
          <div
            className={`grid grid-cols-2 md:grid-cols-${Math.max((TIER_SHOWCASE[selectedTier] ?? TIER_SHOWCASE['free']).length, 3)} gap-4`}
          >
            {(TIER_SHOWCASE[selectedTier] ?? TIER_SHOWCASE['free']).map((item, i) => {
              const isClickable = item.onClick && currentPlan === 'builder';
              const Wrapper = isClickable ? 'button' : 'div';
              return (
                <Wrapper
                  key={item.label}
                  onClick={isClickable ? () => handleShowcaseClick(item) : undefined}
                  className={`p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2 transition-all ${
                    isClickable
                      ? 'hover:bg-zinc-800/80 hover:border-emerald-500/50 cursor-pointer'
                      : ''
                  } ${selectedTier !== currentPlan ? 'opacity-60' : ''}`}
                >
                  {item.icon}
                  <p className="text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                </Wrapper>
              );
            })}
          </div>
          {selectedTier !== currentPlan && (
            <p className="text-center text-[10px] text-zinc-600 italic">
              {['free', 'pro', 'builder'].indexOf(selectedTier) >
              ['free', 'pro', 'builder'].indexOf(currentPlan)
                ? 'Upgrade to unlock these features'
                : 'These are the features available on this plan'}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        tier={waitlistTier}
      />

      {/* Downgrade Confirmation Modal */}
      <AnimatePresence>
        {pendingDowngrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setPendingDowngrade(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tight">
                      Confirm Downgrade
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {currentPlan.toUpperCase()} → {pendingDowngrade.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPendingDowngrade(null)}
                  className="p-1 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Features You'll Lose */}
              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-300 font-medium">
                  You will lose access to{' '}
                  <span className="text-amber-400 font-bold">{featuresLost.length} features</span>:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {featuresLost.map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl"
                    >
                      <X className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-zinc-800 flex gap-3">
                <button
                  onClick={() => setPendingDowngrade(null)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
                >
                  Keep {currentPlan.toUpperCase()}
                </button>
                <button
                  onClick={confirmDowngrade}
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600/80 hover:bg-red-500 text-white transition-all flex items-center justify-center gap-2"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  Downgrade to {pendingDowngrade.toUpperCase()}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
