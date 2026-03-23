import React from 'react';
import { RefreshCw, Loader2, TrendingUp } from 'lucide-react';
import { WeeklyTrendRadar } from '../../types';

interface WeeklyRadarTabProps {
  weeklyRadar: WeeklyTrendRadar | null;
  loadingRadar: boolean;
  fetchWeeklyRadar: () => void;
}

export const WeeklyRadarTab: React.FC<WeeklyRadarTabProps> = ({
  weeklyRadar,
  loadingRadar,
  fetchWeeklyRadar
}) => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase italic tracking-tight">Weekly Trend Radar</h3>
            <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest">{weeklyRadar?.week || 'Analyzing current signals...'}</p>
          </div>
          <RefreshCw className={`w-5 h-5 text-emerald-500 ${loadingRadar ? 'animate-spin' : ''}`} onClick={fetchWeeklyRadar} />
        </div>

        {loadingRadar ? (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Scanning global markets...</p>
          </div>
        ) : weeklyRadar ? (
          <div className="space-y-8">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <p className="text-sm text-emerald-200 leading-relaxed">
                <span className="font-black uppercase italic mr-2">Market Shift:</span>
                {weeklyRadar.marketShift}
              </p>
            </div>

            <div className="grid gap-4">
              {weeklyRadar.topTrends.map((trend, i) => (
                <div key={i} className="p-4 bg-zinc-800/50 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase italic text-white">{trend.title}</h4>
                    <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-[8px] font-bold uppercase rounded-full">{trend.sector}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{trend.description}</p>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Impact: {trend.impact}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase italic text-zinc-500 tracking-widest">Opportunity Areas</h4>
              <div className="flex flex-wrap gap-2">
                {weeklyRadar.opportunityAreas.map((area, i) => (
                  <span key={i} className="px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold rounded-full">{area}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-4">
            <TrendingUp className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-xs text-zinc-500">Click the refresh icon to generate this week's radar.</p>
          </div>
        )}
      </div>
    </div>
  );
};
