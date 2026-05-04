import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Idea, UserLatestIdea, AnalyzeIdeaUsage, Tier } from '../types';
import { analyzeCustomIdea, fetchAnalyzeIdeaUsage } from '../services/geminiService';
import { useTierLimits } from './useTierLimits';

export function useAnalyzeIdea(user: User | null, tier: Tier, authReady: boolean) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzedIdea, setAnalyzedIdea] = useState<Idea | null>(null);
  const [usage, setUsage] = useState<AnalyzeIdeaUsage | null>(null);
  const [latestIdea, setLatestIdea] = useState<UserLatestIdea | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const { getAnalyzeLimit } = useTierLimits();

  // Fetch the user's latest analyzed idea from Firestore on mount
  useEffect(() => {
    if (!authReady || !user || tier === 'free') return;
    setLoadingLatest(true);
    const docRef = doc(db, 'user_latest_idea', user.uid);
    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          setLatestIdea(snap.data() as UserLatestIdea);
        }
      })
      .catch((err) => console.error('[useAnalyzeIdea] Failed to fetch latest idea:', err))
      .finally(() => setLoadingLatest(false));
  }, [user, tier]);

  // Pre-fetch monthly usage so the modal can show remaining count immediately
  useEffect(() => {
    if (!user || tier === 'free') return;
    fetchAnalyzeIdeaUsage().then((u) => {
      if (u) setUsage(u);
    });
  }, [user, tier]);

  const analyze = useCallback(
    async (ideaDescription: string): Promise<Idea | null> => {
      if (!user) return null;
      setIsAnalyzing(true);
      setAnalyzeError(null);
      try {
        const result = await analyzeCustomIdea(ideaDescription);
        const idea = result.idea;

        if (result._usage) setUsage(result._usage);
        setAnalyzedIdea(idea);

        try {
          // Auto-save to user_latest_idea/{uid} — overwrites any previous entry
          const latestRef = doc(db, 'user_latest_idea', user.uid);
          const latestDoc: UserLatestIdea = {
            userId: user.uid,
            idea,
            analyzedAt: serverTimestamp(),
            inputDescription: ideaDescription.slice(0, 5000),
          };
          await setDoc(latestRef, latestDoc);
          // Update local state (serverTimestamp won't be available immediately, use Date)
          setLatestIdea({ ...latestDoc, analyzedAt: new Date().toISOString() });
        } catch (saveErr) {
          console.error('[useAnalyzeIdea] Failed to save latest idea:', saveErr);
          // Don't fail the whole analysis, but set a non-blocking warning if needed
        }

        return idea;
      } catch (err: any) {
        console.error('[useAnalyzeIdea] Analysis error:', err);
        setAnalyzeError(err?.message || 'Analysis failed. Please try again.');
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [user]
  );

  const clearAnalyzedIdea = useCallback(() => setAnalyzedIdea(null), []);

  const updateAnalyzedIdea = useCallback(
    async (updatedIdea: Idea) => {
      if (!user) return;
      setAnalyzedIdea(updatedIdea);

      try {
        const latestRef = doc(db, 'user_latest_idea', user.uid);
        await setDoc(
          latestRef,
          { idea: updatedIdea, updatedAt: serverTimestamp() },
          { merge: true }
        );
        // Also update latestIdea state
        if (latestIdea) {
          setLatestIdea((prev) => (prev ? { ...prev, idea: updatedIdea } : null));
        }
      } catch (err) {
        console.error('[useAnalyzeIdea] Failed to update latest idea:', err);
      }
    },
    [user, latestIdea]
  );

  return {
    isAnalyzing,
    analyzeError,
    setAnalyzeError,
    analyzedIdea,
    clearAnalyzedIdea,
    usage,
    latestIdea,
    loadingLatest,
    analyze,
    updateAnalyzedIdea,
  };
}
