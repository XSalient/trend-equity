import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { TIER_LIMITS } from '../constants';
import { useTierLimits } from './useTierLimits';
import { db } from '../firebase';
import { Idea, DailyGeneration, UserSave, FilterState, Tier } from '../types';
import {
  fetchCachedCustomFeed,
  generateCustomFeed,
  generateDailyIdeas,
  setCurrentIdToken,
} from '../services/geminiService';
import { handleFirestoreError, OperationType } from '../utils/errorUtils';

/** Deterministic djb2 hash of a string — used to give ideas stable IDs from their headline. */

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)])
    ) as T;
  }
  return value;
}
function stableId(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function useIdeas(user: User | null, tier: Tier, authReady: boolean, isAdmin = false) {
  const { getCustomSavesLimit } = useTierLimits();
  const [dailyGen, setDailyGen] = useState<DailyGeneration | null>(null);
  const [userSaves, setUserSaves] = useState<UserSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFeed, setCustomFeed] = useState<DailyGeneration | null>(null);
  const [customFeedVisible, setCustomFeedVisible] = useState(false);
  const [customFeedLoading, setCustomFeedLoading] = useState(false);
  const [customFeedError, setCustomFeedError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    industries: [],
    productTypes: [],
    riskLevels: [],
    effortLevels: [],
    marketFocus: [],
    teamSize: [],
    excludeCategories: [],
    customKeywords: '',
    sortBy: 'quality',
  });

  const today = new Date().toISOString().split('T')[0];

  // --- localStorage Cache Helpers ---
  const CACHE_KEY = 'te_daily_feed';

  const getCachedFeed = (): DailyGeneration | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (cached?.date === today && cached?.ideas?.length > 0) {
        return cached as DailyGeneration;
      }
      // Stale cache (different date) — clear it
      localStorage.removeItem(CACHE_KEY);
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
    return null;
  };

  const setCachedFeed = (gen: DailyGeneration) => {
    try {
      // Strip serverTimestamp (non-serializable) before caching
      const serializable = { ...gen, generatedAt: new Date().toISOString() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
    } catch {
      // localStorage full or disabled — silently ignore
    }
  };

  // --- Fetch Daily ---
  const triggerGeneration = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      // If dailyGen already exists, this is a REFRESH (admin only)
      const isRefresh = !!dailyGen;

      const result = await generateDailyIdeas(undefined, undefined, isRefresh);
      const newGen: DailyGeneration = {
        date: today,
        intro: result.intro,
        ideas: result.ideas.map((idea: any) => ({
          ...idea,
          id: `${today}-${stableId(idea.headline)}`,
        })),
        disclaimer: result.disclaimer,
        generatedAt: new Date().toISOString(),
      };

      setDailyGen(newGen);
      setCachedFeed(newGen);
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err?.message || 'AI generation failed. Please refresh to try again.');
    } finally {
      setGenerating(false);
    }
  }, [today, tier, dailyGen]);

  const fetchDaily = useCallback(
    async (isRetry = false) => {
      if (!isRetry) setLoading(true);
      setError(null);

      // 1. Check localStorage first (instant, zero network) — BYPASS ON RETRY
      if (!isRetry) {
        const cached = getCachedFeed();
        if (cached) {
          setDailyGen(cached);
          setLoading(false);
          return;
        }
      }

      // 2. Try Firestore
      try {
        const docRef = doc(db, 'daily_generations', today);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as DailyGeneration;
          // Stale mock doc from before mock removal — discard and regenerate
          if (data._isMock) {
            localStorage.removeItem(CACHE_KEY);
            setDailyGen(null);
          } else {
            setDailyGen(data);
            setCachedFeed(data);
          }
        } else {
          // Document doesn't exist yet — this is a valid state (awaiting curation)
          setDailyGen(null);
        }
      } catch (err: any) {
        console.error('Fetch Error:', err);
        const msg = err?.message || '';
        if (msg.includes('permission-denied') || msg.includes('permissions')) {
          setError('Access denied. Please ensure you are signed in.');
        } else if (msg.includes('Quota exceeded')) {
          setError('Daily quota reached. Please try again tomorrow.');
        } else if (msg.includes('offline')) {
          setError('You appear to be offline.');
        } else {
          setError("Failed to load today's ideas.");
        }
      } finally {
        setLoading(false);
      }
    },
    [today]
  );

  useEffect(() => {
    if (!authReady) return;
    fetchDaily();
  }, [fetchDaily, authReady]);

  // --- User Profile Sync (Filters) ---
  useEffect(() => {
    if (!user) return;

    const fetchInitialFilters = async () => {
      const userRef = doc(db, 'users', user.uid);
      try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.filters) {
            setFilters((prev) => ({
              ...prev,
              ...data.filters,
              industries: data.filters.industries || [],
              productTypes: data.filters.productTypes || [],
              riskLevels: data.filters.riskLevels || [],
              effortLevels: data.filters.effortLevels || [],
              marketFocus: data.filters.marketFocus || [],
              teamSize: data.filters.teamSize || [],
              excludeCategories: data.filters.excludeCategories || [],
            }));
          }
        }
      } catch (err: any) {
        // Permission denied for new users (user doc not yet created) — silently ignore
        if (err?.code === 'permission-denied') {
          console.debug('[FILTERS] User doc not accessible, using defaults');
        } else {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      }
    };

    fetchInitialFilters();
  }, [user]);

  // --- Save Filters ---
  useEffect(() => {
    if (!user || !authReady) return;

    const saveFilters = async () => {
      const userRef = doc(db, 'users', user.uid);
      try {
        await setDoc(
          userRef,
          {
            filters,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err: any) {
        // Permission denied for new users — silently ignore (filters persist locally only)
        if (err?.code === 'permission-denied') {
          console.debug('[FILTERS] Cannot save filters to Firestore yet');
        } else {
          console.error('Failed to save filters:', err);
        }
      }
    };

    const timeoutId = setTimeout(saveFilters, 1000);
    return () => clearTimeout(timeoutId);
  }, [filters, user, authReady]);

  // --- User Saves Sync ---
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'user_saves'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const saves = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as UserSave);
        setUserSaves(saves);
      },
      (err) => {
        // Silently handle permission errors for new users
        if (err?.code === 'permission-denied') {
          console.debug('[SAVES] No permission to read saves (new user?), skipping');
          setUserSaves([]);
        } else {
          console.error('Saves Sync Error:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  const toggleSave = async (
    idea: Idea,
    TIER_LIMITS: any,
    onLoginNeeded: () => void,
    onUpgradeNeeded: () => void,
    saveType: 'feed' | 'custom' = 'feed',
    userInput?: string
  ) => {
    if (!user) {
      onLoginNeeded();
      return;
    }

    if (saveType === 'feed') {
      const saveLimit = TIER_LIMITS[tier]?.monthlySaves ?? Infinity;
      if (isFinite(saveLimit) && feedSaves.length >= saveLimit) {
        onUpgradeNeeded();
        return;
      }
    }

    const existing = userSaves.find(
      (s) => s.idea.id === idea.id && (!s.saveType || s.saveType === saveType)
    );
    try {
      if (existing) {
        await deleteDoc(doc(db, 'user_saves', existing.id!));
      } else {
        await addDoc(
          collection(db, 'user_saves'),
          stripUndefined({
            userId: user.uid,
            idea,
            savedAt: serverTimestamp(),
            saveType,
            userInput,
          })
        );
      }
    } catch (err: any) {
      console.error('Save Error:', err);
      setError('Failed to save idea. Please try again.');
    }
  };

  const updateIdea = async (updatedIdea: Idea) => {
    if (!user) return;

    setUserSaves((prev) =>
      prev.map((s) => (s.idea.id === updatedIdea.id ? { ...s, idea: updatedIdea } : s))
    );

    const existing = userSaves.find((s) => s.idea.id === updatedIdea.id);
    if (existing) {
      try {
        const saveRef = doc(db, 'user_saves', existing.id!);
        await setDoc(saveRef, { idea: updatedIdea, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `user_saves/${existing.id}`);
      }
    }

    // Custom feed ideas live only in customFeed state — without this, toolkit
    // results (roadmap, validation, build pack) generated on them are dropped.
    setCustomFeed((prev) =>
      prev && prev.ideas.some((i) => i.id === updatedIdea.id)
        ? { ...prev, ideas: prev.ideas.map((i) => (i.id === updatedIdea.id ? updatedIdea : i)) }
        : prev
    );

    if (dailyGen && dailyGen.ideas.some((i) => i.id === updatedIdea.id)) {
      const updatedFeed = {
        ...dailyGen,
        ideas: dailyGen.ideas.map((i) => (i.id === updatedIdea.id ? updatedIdea : i)),
      };
      setDailyGen(updatedFeed);
      setCachedFeed(updatedFeed);

      if (isAdmin && updatedIdea.adminReviewStatus) {
        try {
          await setDoc(
            doc(db, 'daily_generations', dailyGen.date || today),
            { ideas: updatedFeed.ideas, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.WRITE,
            `daily_generations/${dailyGen.date || today}`
          );
        }
      }
    }
  };

  const getFilteredIdeas = useCallback(
    (ideas: Idea[]) => {
      let filtered = [...ideas];

      if (filters.industries?.length > 0) {
        filtered = filtered.filter((idea) =>
          filters.industries.some((ind) => {
            const searchTerms = ind.toLowerCase().split(/[/\s-]/);
            return searchTerms.some(
              (term) =>
                idea.categoryTags.some((tag) => tag.toLowerCase().includes(term)) ||
                idea.headline.toLowerCase().includes(term) ||
                idea.pitch.toLowerCase().includes(term)
            );
          })
        );
      }

      if (filters.productTypes?.length > 0) {
        filtered = filtered.filter((idea) => {
          const isDigital = idea.categoryTags.some(
            (tag) =>
              tag.toLowerCase().includes('digital') ||
              tag.toLowerCase().includes('saas') ||
              tag.toLowerCase().includes('software') ||
              tag.toLowerCase().includes('app')
          );
          const isPhysical = idea.categoryTags.some(
            (tag) =>
              tag.toLowerCase().includes('physical') ||
              tag.toLowerCase().includes('hardware') ||
              tag.toLowerCase().includes('sustainable') ||
              tag.toLowerCase().includes('product')
          );

          if (filters.productTypes.includes('Digital') && isDigital) return true;
          if (filters.productTypes.includes('Physical') && isPhysical) return true;
          return false;
        });
      }

      if (filters.riskLevels?.length > 0) {
        filtered = filtered.filter((idea) => {
          const score = idea.revenuePotentialScore;
          const isLow = score < 5;
          const isHigh = score > 8;
          const isMedium = score >= 5 && score <= 8;

          if (filters.riskLevels.includes('Low') && isLow) return true;
          if (filters.riskLevels.includes('Medium') && isMedium) return true;
          if (filters.riskLevels.includes('High') && isHigh) return true;
          return false;
        });
      }

      if (filters.effortLevels?.length > 0) {
        filtered = filtered.filter((idea) =>
          filters.effortLevels.some((eff) =>
            idea.costEffort.toLowerCase().includes(eff.toLowerCase())
          )
        );
      }

      if (filters.marketFocus?.length > 0) {
        filtered = filtered.filter((idea) =>
          filters.marketFocus.some((m) => {
            if (m === 'Local Market') {
              return idea.categoryTags.some((tag) => tag.toLowerCase().includes('local market'));
            }
            return (
              idea.pitch.toLowerCase().includes(m.toLowerCase()) ||
              idea.trendSources.some((s) => s.toLowerCase().includes(m.toLowerCase())) ||
              idea.vcJustification.toLowerCase().includes(m.toLowerCase())
            );
          })
        );
      }

      if (filters.teamSize?.length > 0) {
        filtered = filtered.filter((idea) => {
          const costEffort = idea.costEffort.toLowerCase();
          const isSolo = costEffort.includes('solo') || costEffort.includes('low');
          const isTeam =
            costEffort.includes('team') ||
            costEffort.includes('funding') ||
            costEffort.includes('co-founder');
          const isSmall = !isSolo && !isTeam;

          if (filters.teamSize.includes('Solo-friendly') && isSolo) return true;
          if (filters.teamSize.includes('Small team (2–5)') && isSmall) return true;
          if (filters.teamSize.includes('Needs co-founder/funding round') && isTeam) return true;
          return false;
        });
      }

      if (tier === 'builder' && filters.customKeywords) {
        const keywords = filters.customKeywords
          .toLowerCase()
          .split(',')
          .map((k) => k.trim());
        filtered = filtered.filter((idea) =>
          keywords.some(
            (k) =>
              idea.headline.toLowerCase().includes(k) ||
              idea.pitch.toLowerCase().includes(k) ||
              idea.categoryTags.some((tag) => tag.toLowerCase().includes(k))
          )
        );
      }

      if (tier === 'builder' && filters.excludeCategories?.length > 0) {
        filtered = filtered.filter(
          (idea) =>
            !filters.excludeCategories.some((exc) =>
              idea.categoryTags.some((tag) => tag.toLowerCase().includes(exc.toLowerCase()))
            )
        );
      }

      filtered.sort((a, b) => {
        if (filters.sortBy === 'quality') {
          const aScore = a.qualityScore ?? a.qualityScorePrecheck ?? a.revenuePotentialScore ?? 0;
          const bScore = b.qualityScore ?? b.qualityScorePrecheck ?? b.revenuePotentialScore ?? 0;
          return bScore - aScore;
        }
        if (filters.sortBy === 'revenue') return b.revenuePotentialScore - a.revenuePotentialScore;
        if (filters.sortBy === 'effort') {
          const getEffort = (s: string) => {
            s = s.toLowerCase();
            if (s.includes('low')) return 0;
            if (s.includes('high')) return 2;
            return 1;
          };
          return getEffort(a.costEffort) - getEffort(b.costEffort);
        }
        return 0;
      });

      return filtered;
    },
    [filters, tier]
  );

  // Restore a fresh (< 24h) cached custom feed on load. The server enforces one
  // generation per 24h per user; without this, the cached feed is invisible until
  // the user presses Generate again.
  useEffect(() => {
    if (!authReady || !user || tier === 'free') return;
    let cancelled = false;
    // Ensure the ID token is set before calling the authenticated endpoint —
    // App syncs it too, but that effect races with this one on first load.
    user
      .getIdToken()
      .then((token) => {
        setCurrentIdToken(token);
        return fetchCachedCustomFeed();
      })
      .then((cached) => {
        if (cancelled || !cached?.ideas) return;
        setCustomFeed(cached);
        setCustomFeedVisible(true);
      })
      .catch(() => {
        // Fail soft — user can still generate manually
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user, tier]);

  const generateCustomRequirementFeed = useCallback(async () => {
    const requirement = filters.customKeywords.trim();
    if (!requirement) {
      setCustomFeedError(
        tier === 'builder'
          ? 'Describe the custom feed you want to generate.'
          : 'Enter one keyword to generate a custom feed.'
      );
      return;
    }

    setCustomFeedLoading(true);
    setCustomFeedError(null);
    try {
      const result = await generateCustomFeed(requirement);
      setCustomFeed(result);
      setCustomFeedVisible(true);
      // The requirement is preserved on the feed itself (customRequirement).
      // Clear it from filters so a long natural-language requirement doesn't
      // keyword-filter the daily feed down to zero results.
      setFilters((prev) => ({ ...prev, customKeywords: '' }));
    } catch (err: any) {
      setCustomFeedError(err?.message || 'Custom feed generation failed. Please try again.');
    } finally {
      setCustomFeedLoading(false);
    }
  }, [filters.customKeywords, tier]);

  const toggleCustomFeedView = useCallback(() => {
    setCustomFeedVisible((visible) => !visible);
    setCustomFeedError(null);
  }, []);
  const feedSaves = userSaves.filter((s) => !s.saveType || s.saveType === 'feed');
  const customSaves = userSaves.filter((s) => s.saveType === 'custom');

  return {
    dailyGen,
    userSaves,
    feedSaves,
    customSaves,
    loading,
    generating,
    error,
    customFeed,
    customFeedVisible,
    customFeedLoading,
    customFeedError,
    filters,
    setFilters,
    toggleSave,
    updateIdea,
    getFilteredIdeas,
    generateCustomRequirementFeed,
    toggleCustomFeedView,
    triggerGeneration,
    fetchDaily,
  };
}
