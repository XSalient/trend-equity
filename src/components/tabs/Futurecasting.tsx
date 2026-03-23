import React from 'react';
import { RefreshCw, Loader2, Sparkles, Zap } from 'lucide-react';
import { Futurecasting } from '../../types';

interface FuturecastingTabProps {
  futurecasting: Futurecasting | null;
  loadingFuture: boolean;
  fetchFuturecasting: (horizon?: '2027' | '2030' | '2035') => void;
}

export const FuturecastingTab: React.FC<FuturecastingTabProps> = ({
  futurecasting,
  loadingFuture,
  fetchFuturecasting
}) => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-24 h-24 text-amber-500" />
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase italic tracking-tight">Futurecasting Engine</h3>
            <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest">Horizon: {futurecasting?.horizon || '2030'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => fetchFuturecasting(e.target.value as any)}
              className="bg-zinc-800 border border-zinc-700 text-white text-[10px] font-bold uppercase rounded-lg px-2 py-1 outline-none"
            >
              <option value="2027">2027</option>
              <option value="2030">2030</option>
              <option value="2035">2035</option>
            </select>
            <RefreshCw className={`w-5 h-5 text-amber-500 ${loadingFuture ? 'animate-spin' : ''}`} onClick={() => fetchFuturecasting()} />
          </div>
        </div>

        {loadingFuture ? (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Simulating future paradigms...</p>
          </div>
        ) : futurecasting ? (
          <div className="space-y-8 relative z-10">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase italic text-amber-500 tracking-widest">Paradigm Shifts</h4>
              <div className="space-y-2">
                {futurecasting.paradigmShifts.map((shift, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-100 leading-relaxed">{shift}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase italic text-zinc-500 tracking-widest">Industry Predictions</h4>
              <div className="space-y-4">
                {futurecasting.predictions.map((pred, i) => (
                  <div key={i} className="p-4 bg-zinc-800/50 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase italic text-white">{pred.title}</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${pred.probability}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-amber-500">{pred.probability}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed italic">"{pred.rationale}"</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Winners</p>
                        <p className="text-[10px] text-zinc-300">{pred.winners.join(', ')}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-widest text-red-500">Losers</p>
                        <p className="text-[10px] text-zinc-300">{pred.losers.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-4">
            <Sparkles className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-xs text-zinc-500">Select a horizon and click refresh to generate predictions.</p>
          </div>
        )}
      </div>
    </div>
  );
};
