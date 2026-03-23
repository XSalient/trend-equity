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
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Idea, DailyGeneration, UserSave, FilterState, Tier } from '../types';
import { generateDailyIdeas } from '../services/geminiService';
import { handleFirestoreError, OperationType } from '../utils/errorUtils';

export function useIdeas(user: User | null, tier: Tier, authReady: boolean) {
  const [dailyGen, setDailyGen] = useState<DailyGeneration | null>(null);
  const [userSaves, setUserSaves] = useState<UserSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    industries: [],
    productTypes: [],
    riskLevels: [],
    effortLevels: [],
    marketFocus: [],
    teamSize: [],
    excludeCategories: [],
    customKeywords: '',
    sortBy: 'revenue'
  });

  const today = new Date().toISOString().split('T')[0];

  // --- Fetch Daily ---
  const triggerGeneration = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      // Determine user locale/country
      const getCountryName = () => {
        try {
          const localeString = navigator.language; // e.g. "en-US", "fr-FR", "en"
          const region = localeString.split('-')[1];
          if (region) {
            const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
            return displayNames.of(region) || 'Global';
          }
        } catch (e) {
          // Fallback
        }
        return 'Global';
      };
      
      const country = getCountryName();
      const countryCount = tier === 'builder' ? 5 : tier === 'pro' ? 3 : 1;

      const result = await generateDailyIdeas(today, country, countryCount);
      const newGen: DailyGeneration = {
        date: today,
        intro: result.intro,
        ideas: result.ideas.map((idea: any, index: number) => ({
          ...idea,
          id: `${today}-${index}`
        })),
        disclaimer: result.disclaimer,
        generatedAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, 'daily_generations', today), newGen);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `daily_generations/${today}`);
      }
      setDailyGen(newGen);
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError("AI generation failed. Please refresh to try again.");
    } finally {
      setGenerating(false);
    }
  }, [today, generating, tier]);

  const fetchDaily = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'daily_generations', today);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("Quota exceeded")) {
          setError("Daily quota reached. Please try again tomorrow.");
          setLoading(false);
          return;
        }
        throw err;
      }

      if (docSnap.exists()) {
        setDailyGen(docSnap.data() as DailyGeneration);
      } else {
        await triggerGeneration();
      }
    } catch (err: any) {
      console.error("Fetch Error:", err);
      const msg = err?.message || "";
      if (msg.includes("Quota exceeded")) {
        setError("Daily quota reached. Please try again tomorrow.");
      } else if (msg.includes("offline")) {
        setError("You appear to be offline.");
      } else {
        setError("Failed to load today's ideas.");
      }
    } finally {
      setLoading(false);
    }
  }, [today, triggerGeneration]);

  useEffect(() => {
    if (!authReady) return;
    fetchDaily();
  }, [fetchDaily, authReady]);

  // --- User Profile Sync (Filters) ---
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.filters) {
          setFilters(prev => ({
            ...prev,
            ...data.filters,
            industries: data.filters.industries || [],
            productTypes: data.filters.productTypes || [],
            riskLevels: data.filters.riskLevels || [],
            effortLevels: data.filters.effortLevels || [],
            marketFocus: data.filters.marketFocus || [],
            teamSize: data.filters.teamSize || [],
            excludeCategories: data.filters.excludeCategories || []
          }));
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Save Filters ---
  useEffect(() => {
    if (!user || !authReady) return;

    const saveFilters = async () => {
      const userRef = doc(db, 'users', user.uid);
      try {
        await setDoc(userRef, {
          filters,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save filters:", err);
      }
    };

    const timeoutId = setTimeout(saveFilters, 1000);
    return () => clearTimeout(timeoutId);
  }, [filters, user, authReady]);

  // --- User Saves Sync ---
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'user_saves'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const saves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSave));
      setUserSaves(saves);
    }, (err) => {
      console.error("Saves Sync Error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSave = async (idea: Idea, TIER_LIMITS: any, onLoginNeeded: () => void, onUpgradeNeeded: () => void) => {
    if (!user) {
      onLoginNeeded();
      return;
    }

    const isFree = tier === 'free';
    if (isFree && userSaves.length >= 5) {
      onUpgradeNeeded();
      return;
    }

    const existing = userSaves.find(s => s.idea.id === idea.id);
    try {
      if (existing) {
        await deleteDoc(doc(db, 'user_saves', existing.id!));
      } else {
        await addDoc(collection(db, 'user_saves'), {
          userId: user.uid,
          idea,
          savedAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error("Save Error:", err);
    }
  };

  const updateIdea = async (updatedIdea: Idea) => {
    if (!user) return;

    setUserSaves(prev => prev.map(s => s.idea.id === updatedIdea.id ? { ...s, idea: updatedIdea } : s));

    const existing = userSaves.find(s => s.idea.id === updatedIdea.id);
    if (existing) {
      try {
        const saveRef = doc(db, 'user_saves', existing.id!);
        await setDoc(saveRef, { idea: updatedIdea, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `user_saves/${existing.id}`);
      }
    }

    if (dailyGen && dailyGen.ideas.some(i => i.id === updatedIdea.id)) {
      setDailyGen({
        ...dailyGen,
        ideas: dailyGen.ideas.map(i => i.id === updatedIdea.id ? updatedIdea : i)
      });
    }
  };

  const getFilteredIdeas = useCallback((ideas: Idea[]) => {
    let filtered = [...ideas];

    if (filters.industries?.length > 0) {
      filtered = filtered.filter(idea =>
        filters.industries.some(ind => {
          const searchTerms = ind.toLowerCase().split(/[\/\s-]/);
          return searchTerms.some(term =>
            idea.categoryTags.some(tag => tag.toLowerCase().includes(term)) ||
            idea.headline.toLowerCase().includes(term) ||
            idea.pitch.toLowerCase().includes(term)
          );
        })
      );
    }

    if (filters.productTypes?.length > 0) {
      filtered = filtered.filter(idea => {
        const isDigital = idea.categoryTags.some(tag =>
          tag.toLowerCase().includes('digital') ||
          tag.toLowerCase().includes('saas') ||
          tag.toLowerCase().includes('software') ||
          tag.toLowerCase().includes('app')
        );
        const isPhysical = idea.categoryTags.some(tag =>
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
      filtered = filtered.filter(idea => {
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
      filtered = filtered.filter(idea =>
        filters.effortLevels.some(eff => idea.costEffort.toLowerCase().includes(eff.toLowerCase()))
      );
    }

    if (filters.marketFocus?.length > 0) {
      filtered = filtered.filter(idea =>
        filters.marketFocus.some(m =>
          idea.pitch.toLowerCase().includes(m.toLowerCase()) ||
          idea.trendSources.some(s => s.toLowerCase().includes(m.toLowerCase())) ||
          idea.vcJustification.toLowerCase().includes(m.toLowerCase())
        )
      );
    }

    if (filters.teamSize?.length > 0) {
      filtered = filtered.filter(idea => {
        const costEffort = idea.costEffort.toLowerCase();
        const isSolo = costEffort.includes('solo') || costEffort.includes('low');
        const isTeam = costEffort.includes('team') || costEffort.includes('funding') || costEffort.includes('co-founder');
        const isSmall = !isSolo && !isTeam;

        if (filters.teamSize.includes('Solo-friendly') && isSolo) return true;
        if (filters.teamSize.includes('Small team (2–5)') && isSmall) return true;
        if (filters.teamSize.includes('Needs co-founder/funding round') && isTeam) return true;
        return false;
      });
    }

    if (tier === 'builder' && filters.customKeywords) {
      const keywords = filters.customKeywords.toLowerCase().split(',').map(k => k.trim());
      filtered = filtered.filter(idea =>
        keywords.some(k =>
          idea.headline.toLowerCase().includes(k) ||
          idea.pitch.toLowerCase().includes(k) ||
          idea.categoryTags.some(tag => tag.toLowerCase().includes(k))
        )
      );
    }

    if (tier === 'builder' && filters.excludeCategories?.length > 0) {
      filtered = filtered.filter(idea =>
        !filters.excludeCategories.some(exc =>
          idea.categoryTags.some(tag => tag.toLowerCase().includes(exc.toLowerCase()))
        )
      );
    }

    filtered.sort((a, b) => {
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
  }, [filters, tier]);

  return { 
    dailyGen, 
    userSaves, 
    loading, 
    generating, 
    error, 
    filters, 
    setFilters, 
    toggleSave, 
    updateIdea, 
    getFilteredIdeas, 
    triggerGeneration,
    fetchDaily
  };
}
