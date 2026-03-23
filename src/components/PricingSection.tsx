import React from 'react';
import { CheckCircle2, Sparkles, Bell, Users, Trophy, Settings } from 'lucide-react';

interface PricingSectionProps {
  currentPlan: 'free' | 'pro' | 'builder';
  onUpgrade: (plan: 'pro' | 'builder') => void;
  onDowngrade: (plan: 'free' | 'pro') => void;
  onOpenTE100?: () => void;
  onOpenApiAccess?: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ 
  currentPlan, 
  onUpgrade, 
  onDowngrade,
  onOpenTE100,
  onOpenApiAccess
}) => {
  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-black uppercase italic tracking-tight">Choose Your Path</h3>
        <p className="text-zinc-500 text-sm">No ads ever. Just high-signal opportunities.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div className={`p-6 rounded-3xl border ${currentPlan === 'free' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6 flex flex-col`}>
          <div className="space-y-1">
            <h4 className="text-lg font-black uppercase italic">Free</h4>
            <p className="text-3xl font-black">$0</p>
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
            onClick={() => currentPlan !== 'free' && onDowngrade('free')}
            disabled={currentPlan === 'free'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentPlan === 'free' ? 'bg-zinc-800 text-zinc-500 cursor-default' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
          >
            {currentPlan === 'free' ? 'CURRENT PLAN' : 'DOWNGRADE'}
          </button>
        </div>

        {/* Pro Plan */}
        <div className={`p-6 rounded-3xl border ${currentPlan === 'pro' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6 relative overflow-hidden flex flex-col`}>
          <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest rounded-bl-xl">Popular</div>
          <div className="space-y-1">
            <h4 className="text-lg font-black uppercase italic">Pro</h4>
            <p className="text-3xl font-black">$9<span className="text-sm text-zinc-500">/mo</span></p>
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
          </ul>
          <button 
            onClick={() => {
              if (currentPlan === 'free') onUpgrade('pro');
              if (currentPlan === 'builder') onDowngrade('pro');
            }}
            disabled={currentPlan === 'pro'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              currentPlan === 'builder'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ' + (currentPlan === 'pro' ? 'opacity-50 cursor-default' : 'hover:bg-emerald-500')
            }`}
          >
            {currentPlan === 'builder' ? 'DOWNGRADE' : 'UPGRADE TO PRO'}
          </button>
        </div>

        {/* Builder Plan */}
        <div className={`p-6 rounded-3xl border ${currentPlan === 'builder' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6 flex flex-col`}>
          <div className="space-y-1">
            <h4 className="text-lg font-black uppercase italic">Builder</h4>
            <p className="text-3xl font-black">$19<span className="text-sm text-zinc-500">/mo</span></p>
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-xs text-zinc-300">
              <Sparkles className="w-4 h-4 text-amber-500" /> 35 ideas / day
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
            onClick={() => currentPlan !== 'builder' && onUpgrade('builder')}
            disabled={currentPlan === 'builder'}
            className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              currentPlan === 'builder' 
                ? 'bg-zinc-800 text-zinc-500 cursor-default' 
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
            }`}
          >
            {currentPlan === 'builder' ? 'CURRENT PLAN' : 'UPGRADE TO BUILDER'}
          </button>
        </div>
      </div>

      {/* Additional Builder Features Grid */}
      {currentPlan === 'builder' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
            <Bell className="w-5 h-5 text-amber-500 mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Real-time Alerts</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
            <Users className="w-5 h-5 text-amber-500 mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Team-up Access</p>
          </div>
          <button onClick={onOpenTE100} className="p-4 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/50 transition-all rounded-2xl text-center space-y-2 cursor-pointer w-full">
            <Trophy className="w-5 h-5 text-amber-500 mx-auto group-hover:scale-110 transition-transform" />
            <p className="text-[10px] font-bold uppercase tracking-widest">TE-100 Submission</p>
          </button>
          <button onClick={onOpenApiAccess} className="p-4 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/50 transition-all rounded-2xl text-center space-y-2 cursor-pointer w-full">
            <Settings className="w-5 h-5 text-amber-500 mx-auto group-hover:scale-110 transition-transform" />
            <p className="text-[10px] font-bold uppercase tracking-widest">API Access</p>
          </button>
        </div>
      )}
    </div>
  );
};
