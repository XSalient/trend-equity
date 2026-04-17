import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ANALYZE_IDEA_MONTHLY_LIMITS, CUSTOM_SAVES_LIMITS } from '../constants';

export interface TierLimits {
  analyze_idea_monthly: { pro: number; builder: number };
  custom_saves: { pro: number; builder: number };
}

interface TierLimitsContextType {
  limits: TierLimits;
  loading: boolean;
  getAnalyzeLimit: (tier: string) => number;
  getCustomSavesLimit: (tier: string) => number;
}

const DEFAULT_LIMITS: TierLimits = {
  analyze_idea_monthly: {
    pro: ANALYZE_IDEA_MONTHLY_LIMITS.pro,
    builder: ANALYZE_IDEA_MONTHLY_LIMITS.builder,
  },
  custom_saves: {
    pro: CUSTOM_SAVES_LIMITS.pro,
    builder: CUSTOM_SAVES_LIMITS.builder,
  },
};

const TierLimitsContext = createContext<TierLimitsContextType | undefined>(undefined);

export const TierLimitsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [limits, setLimits] = useState<TierLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'app_config', 'tier_limits');

    // Single shared listener for the entire app
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setLimits({
            analyze_idea_monthly: {
              ...DEFAULT_LIMITS.analyze_idea_monthly,
              ...(data.analyze_idea_monthly || {}),
            },
            custom_saves: {
              ...DEFAULT_LIMITS.custom_saves,
              ...(data.custom_saves || {}),
            },
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[TierLimitsProvider] Failed to fetch remote limits, using defaults:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getAnalyzeLimit = (tier: string) => {
    if (tier === 'builder') return limits.analyze_idea_monthly.builder;
    if (tier === 'pro') return limits.analyze_idea_monthly.pro;
    return 0;
  };

  const getCustomSavesLimit = (tier: string) => {
    if (tier === 'builder') return limits.custom_saves.builder;
    if (tier === 'pro') return limits.custom_saves.pro;
    return 0;
  };

  return (
    <TierLimitsContext.Provider value={{ limits, loading, getAnalyzeLimit, getCustomSavesLimit }}>
      {children}
    </TierLimitsContext.Provider>
  );
};

export const useTierLimitsContext = () => {
  const context = useContext(TierLimitsContext);
  if (context === undefined) {
    throw new Error('useTierLimitsContext must be used within a TierLimitsProvider');
  }
  return context;
};
