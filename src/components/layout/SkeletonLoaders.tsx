import React from 'react';
import { motion } from 'motion/react';

export const IdeaCardSkeleton = () => (
  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 space-y-6 animate-pulse">
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div className="h-4 w-2/3 bg-zinc-800 rounded-md" />
        <div className="h-4 w-12 bg-zinc-800 rounded-md" />
      </div>
      <div className="h-3 w- كامل bg-zinc-800 rounded-md" />
      <div className="h-3 w-5/6 bg-zinc-800 rounded-md" />
    </div>
    <div className="flex gap-2">
      <div className="h-5 w-16 bg-zinc-800 rounded-md" />
      <div className="h-5 w-20 bg-zinc-800 rounded-md" />
      <div className="h-5 w-14 bg-zinc-800 rounded-md" />
    </div>
    <div className="space-y-2 pt-2">
      <div className="h-2 w-full bg-zinc-800 rounded-full" />
      <div className="h-10 w-full bg-zinc-800/50 rounded-xl" />
    </div>
  </div>
);

export const IdeaFeedSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-6">
    {Array.from({ length: count }).map((_, i) => (
      <IdeaCardSkeleton key={i} />
    ))}
  </div>
);

export const ToolkitSkeleton = () => (
  <div className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl space-y-6 mt-2 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-4 w-32 bg-zinc-800 rounded-md" />
      <div className="h-4 w-4 bg-zinc-800 rounded-md" />
    </div>
    <div className="space-y-4">
      <div className="h-24 w-full bg-zinc-800/30 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 w-full bg-zinc-800/30 rounded-xl" />
        <div className="h-32 w-full bg-zinc-800/30 rounded-xl" />
      </div>
    </div>
  </div>
);

export const RadarSkeleton = () => (
  <div className="bg-zinc-900/30 border border-emerald-500/10 rounded-2xl p-8 text-center space-y-8 animate-pulse">
    <div className="space-y-2 max-w-sm mx-auto">
      <div className="h-6 w-48 bg-emerald-500/10 rounded-md mx-auto" />
      <div className="h-4 w-full bg-zinc-800 rounded-md" />
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-6 bg-zinc-800/20 rounded-2xl border border-white/5 space-y-4">
          <div className="h-4 w-1/2 bg-zinc-800 rounded-md" />
          <div className="h-3 w-full bg-zinc-800 rounded-md" />
          <div className="h-3 w-3/4 bg-zinc-800 rounded-md" />
        </div>
      ))}
    </div>
  </div>
);
