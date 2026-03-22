import React, { useState, useEffect, useCallback, Component } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Idea, DailyGeneration, UserSave, FilterState } from './types';
import { generateDailyIdeas } from './services/geminiService';
import { 
  TrendingUp, 
  Zap, 
  DollarSign, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Bookmark, 
  BookmarkCheck,
  LogOut,
  LogIn,
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Rocket,
  CheckCircle2,
  Wand2,
  Crown,
  Lock,
  Download,
  Shield,
  BarChart3,
  Users,
  Trophy,
  Bell,
  Settings,
  FileText,
  Share2,
  Sparkles,
  Filter,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

// --- Components ---
import { ErrorBoundary } from './components/ErrorBoundary';
import { IdeaCard } from './components/IdeaCard';
import { PricingSection } from './components/PricingSection';
import { FilterBar } from './components/FilterBar';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dailyGen, setDailyGen] = useState<DailyGeneration | null>(null);
  const [userSaves, setUserSaves] = useState<UserSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'saved' | 'pro'>('feed');
  const [tier, setTier] = useState<'free' | 'pro' | 'builder'>('free');
  const [filters, setFilters] = useState<FilterState>({
    industries: [],
    riskLevels: [],
    effortLevels: [],
    marketFocus: [],
    teamSize: [],
    excludeCategories: [],
    customKeywords: '',
    sortBy: 'revenue'
  });

  const today = new Date().toISOString().split('T')[0];

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // Fetch user data from Firestore to get the correct tier
        const userRef = doc(db, 'users', u.uid);
        getDoc(userRef).then(docSnap => {
          if (docSnap.exists()) {
            setTier(docSnap.data().tier || 'free');
          } else {
            setTier('free');
          }
        });
      } else {
        setTier('free');
        setUserSaves([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      // Handle user closing the popup gracefully
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      console.error("Login Error:", err);
      setError("Failed to sign in. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  const upgradeToBuilder = () => {
    if (!user) {
      handleLogin();
      return;
    }
    setTier('builder');
    alert("Upgraded to Builder Tier! Full suite unlocked.");
  };

  const handleUpgrade = async (plan: 'pro' | 'builder') => {
    if (!user) {
      handleLogin();
      return;
    }
    setTier(plan);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { tier: plan, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
    alert(`Upgraded to ${plan.toUpperCase()}!`);
  };

  const handleDowngrade = async (plan: 'free' | 'pro') => {
    setTier(plan);
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { tier: plan, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
    alert(`Downgraded to ${plan.toUpperCase()}.`);
  };

  // --- Filtering Logic ---
  const getFilteredIdeas = useCallback((ideas: Idea[]) => {
    let filtered = [...ideas];

    // 1. Industry
    if (filters.industries.length > 0) {
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

    // 2. Risk (Scale is 0-10)
    if (filters.riskLevels.length > 0) {
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

    // 3. Effort
    if (filters.effortLevels.length > 0) {
      filtered = filtered.filter(idea => 
        filters.effortLevels.some(eff => idea.costEffort.toLowerCase().includes(eff.toLowerCase()))
      );
    }

    // 4. Market
    if (filters.marketFocus.length > 0) {
      filtered = filtered.filter(idea => 
        filters.marketFocus.some(m => 
          idea.pitch.toLowerCase().includes(m.toLowerCase()) ||
          idea.trendSources.some(s => s.toLowerCase().includes(m.toLowerCase())) ||
          idea.vcJustification.toLowerCase().includes(m.toLowerCase())
        )
      );
    }

    // 5. Team
    if (filters.teamSize.length > 0) {
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

    // 6. Custom Keywords (Builder)
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

    // 7. Exclude Categories (Builder)
    if (tier === 'builder' && filters.excludeCategories.length > 0) {
      filtered = filtered.filter(idea => 
        !filters.excludeCategories.some(exc => 
          idea.categoryTags.some(tag => tag.toLowerCase().includes(exc.toLowerCase()))
        )
      );
    }

    // 8. Sorting
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
      return 0; // Default newest (already sorted by generation)
    });

    return filtered;
  }, [filters, tier]);

  // --- User Profile Sync ---
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tier) setTier(data.tier);
        if (data.filters) setFilters(data.filters);
      } else {
        // Initialize user document
        setDoc(userRef, {
          userId: user.uid,
          tier: 'pro', // Default for logged in users
          filters: {
            industries: [],
            riskLevels: [],
            effortLevels: [],
            marketFocus: [],
            teamSize: [],
            excludeCategories: [],
            customKeywords: '',
            sortBy: 'revenue'
          },
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Save Filters to Profile ---
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

    const timeoutId = setTimeout(saveFilters, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [filters, user, authReady]);

  // --- Data Fetching ---
  const fetchDaily = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'daily_generations', today);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (err: any) {
        // If it's a transient error, we might want to handle it here
        const msg = err?.message || "";
        if (msg.includes("Quota exceeded")) {
          setError("Daily quota reached. Please try again tomorrow.");
          setLoading(false);
          return;
        }
        throw err; // Re-throw for outer catch
      }

      if (docSnap.exists()) {
        setDailyGen(docSnap.data() as DailyGeneration);
      } else {
        // Trigger generation if not found
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
  }, [today, authReady]);

  useEffect(() => {
    if (!authReady) return;
    fetchDaily();
  }, [fetchDaily, authReady]);

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

  const triggerGeneration = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateDailyIdeas(today);
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
  };

  const toggleSave = async (idea: Idea) => {
    if (!user) {
      handleLogin();
      return;
    }

    const isFree = tier === 'free';
    if (isFree && userSaves.length >= 5) {
      alert("Free tier limit reached: 5 saves/month. Upgrade to Pro for unlimited saves.");
      setActiveTab('pro');
      return;
    }

    const existing = userSaves.find(s => s.idea.id === idea.id);
    try {
      if (existing) {
        try {
          await deleteDoc(doc(db, 'user_saves', existing.id!));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `user_saves/${existing.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'user_saves'), {
            userId: user.uid,
            idea,
            savedAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'user_saves');
        }
      }
    } catch (err: any) {
      console.error("Save Error:", err);
    }
  };

  const updateIdea = async (updatedIdea: Idea) => {
    if (!user) return;

    // 1. Update local saves
    setUserSaves(prev => prev.map(s => s.idea.id === updatedIdea.id ? { ...s, idea: updatedIdea } : s));

    // 2. Update Firestore if saved
    const existing = userSaves.find(s => s.idea.id === updatedIdea.id);
    if (existing) {
      try {
        const saveRef = doc(db, 'user_saves', existing.id!);
        await setDoc(saveRef, { idea: updatedIdea, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `user_saves/${existing.id}`);
      }
    }
    
    // 3. Update local dailyGen if it's from today
    if (dailyGen && dailyGen.ideas.some(i => i.id === updatedIdea.id)) {
      const updatedDailyGen = {
        ...dailyGen,
        ideas: dailyGen.ideas.map(i => i.id === updatedIdea.id ? updatedIdea : i)
      };
      setDailyGen(updatedDailyGen);
      // We don't necessarily need to update Firestore for daily_generations here, 
      // as it's a global feed, but we could if we wanted to cache it for everyone.
      // For now, let's keep it local to the user's session or their saved ideas.
    }
  };

  const exportToPDF = (idea: Idea, format: 'pdf' | 'notion' | 'gdocs' = 'pdf') => {
    if (format !== 'pdf' && tier === 'free') {
      alert("Template exports (Notion/GDocs) are Pro features. Upgrade now!");
      setActiveTab('pro');
      return;
    }

    if (format === 'notion' || format === 'gdocs') {
      alert(`Generating ${format === 'notion' ? 'Notion' : 'Google Docs'} template... Check your email/dashboard.`);
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    // Title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(idea.headline.toUpperCase(), margin, y);
    y += 15;

    // Pitch
    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    const pitchLines = doc.splitTextToSize(`"${idea.pitch}"`, 170);
    doc.text(pitchLines, margin, y);
    y += pitchLines.length * 7 + 10;

    // VC Justification
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("VC JUSTIFICATION", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const vcLines = doc.splitTextToSize(idea.vcJustification, 170);
    doc.text(vcLines, margin, y);
    y += vcLines.length * 6 + 10;

    // Unfair Advantage
    doc.setFont("helvetica", "bold");
    doc.text("UNFAIR ADVANTAGE", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const uaLines = doc.splitTextToSize(idea.unfairAdvantage, 170);
    doc.text(uaLines, margin, y);
    y += uaLines.length * 6 + 10;

    // Revenue Model
    doc.setFont("helvetica", "bold");
    doc.text("REVENUE MODEL", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const revLines = doc.splitTextToSize(idea.revenueSkeleton, 170);
    doc.text(revLines, margin, y);
    y += revLines.length * 6 + 10;

    // Next Steps
    if (idea.nextSteps && idea.nextSteps.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("ACTIONABLE NEXT STEPS", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      idea.nextSteps.forEach((step, i) => {
        const stepLines = doc.splitTextToSize(`${i + 1}. ${step}`, 160);
        doc.text(stepLines, margin + 5, y);
        y += stepLines.length * 6 + 2;
      });
    }

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated by Trend-Equity on ${new Date().toLocaleDateString()}`, margin, 280);

    doc.save(`${idea.headline.replace(/\s+/g, '_')}_Pitch_Deck.pdf`);
  };

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
          />
          <Rocket className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className="mt-8 text-xl font-bold text-white tracking-tight">
          {generating ? "Generating Daily VC Feed..." : "Loading Trend Equity..."}
        </h2>
        <p className="mt-2 text-zinc-500 text-sm max-w-xs">
          {generating ? "Our AI is scanning real-time signals from Google, X, and Reddit to find today's top 20 opportunities." : "Connecting to the VC engine..."}
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-black tracking-tighter uppercase italic hidden sm:block">Trend Equity</h1>
              </div>
              <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
              <div className="flex items-center gap-2 text-emerald-500">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <div className="flex items-center gap-1">
                    {tier !== 'free' && (
                      <button 
                        onClick={() => triggerGeneration()}
                        disabled={generating}
                        className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors disabled:opacity-50"
                        title="Force Refresh Feed"
                      >
                        <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button 
                      onClick={handleLogout}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-4 w-px bg-zinc-800 mx-1" />
                  <button 
                    onClick={() => setActiveTab('pro')}
                    className="text-right hover:opacity-80 transition-opacity group"
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <Crown className={`w-3 h-3 ${
                        tier === 'builder' ? 'text-amber-500' : 
                        tier === 'pro' ? 'text-emerald-500' : 
                        'text-zinc-500'
                      }`} />
                      <p className={`text-[10px] font-bold uppercase tracking-widest leading-none ${
                        tier === 'builder' ? 'text-amber-500' : 
                        tier === 'pro' ? 'text-emerald-500' : 
                        'text-zinc-500'
                      }`}>
                        {tier === 'builder' ? 'Builder' : tier === 'pro' ? 'Pro' : 'Free'}
                      </p>
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate max-w-[80px] group-hover:text-emerald-400 transition-colors">{user.displayName || user.email}</p>
                  </button>
                </>
              )}
              {!user && (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  SIGN IN
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {/* Intro Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] uppercase italic">
                Today's <br /> <span className="text-emerald-500">Top {tier === 'free' ? '10' : '25'}</span> Ideas
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                {dailyGen?.intro || "Fresh opportunities derived from real-time signals and vetted through strict VC logic."}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 p-1 bg-zinc-900 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              DAILY FEED
            </button>
            <button 
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'saved' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              SAVED ({userSaves.length}{tier === 'free' ? '/5' : ''})
            </button>
            <button 
              onClick={() => setActiveTab('pro')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pro' 
                  ? 'bg-zinc-800 text-white shadow-lg' 
                  : tier === 'builder' ? 'text-zinc-500 hover:text-zinc-300' : 'text-emerald-500 hover:text-emerald-400'
              }`}
            >
              MANAGE PLAN
            </button>
          </div>

          {/* Feed */}
          <div className="space-y-6">
            {activeTab === 'feed' ? (
              <>
                <FilterBar 
                  filters={filters} 
                  setFilters={setFilters} 
                  tier={tier} 
                />

                {getFilteredIdeas(dailyGen?.ideas || []).slice(0, tier === 'free' ? 10 : 25).map((idea, i) => (
                  <IdeaCard 
                    key={idea.id} 
                    idea={idea} 
                    isSaved={userSaves.some(s => s.idea.id === idea.id)}
                    onToggleSave={() => toggleSave(idea)}
                    onUpdateIdea={updateIdea}
                    isSaving={false}
                    tier={tier}
                    onExport={(fmt) => exportToPDF(idea, fmt)}
                  />
                ))}
                
                {tier === 'free' && dailyGen && dailyGen.ideas.length > 10 && (
                  <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500" />
                    <Lock className="w-10 h-10 text-zinc-700 mx-auto" />
                    <div className="space-y-2">
                      <h3 className="text-xl font-black uppercase italic tracking-tight">Unlock {dailyGen.ideas.length - 10} More Ideas</h3>
                      <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                        Pro & Builder users get 25 ideas daily, unlimited saves, and priority email digests.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('pro')}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-widest rounded-full transition-all shadow-lg shadow-emerald-900/40"
                    >
                      View Pricing
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === 'saved' ? (
              userSaves.length > 0 ? (
                userSaves.map((save) => (
                  <IdeaCard 
                    key={save.id} 
                    idea={save.idea} 
                    isSaved={true}
                    onToggleSave={() => toggleSave(save.idea)}
                    onUpdateIdea={updateIdea}
                    isSaving={false}
                    tier={tier}
                    onExport={(fmt) => exportToPDF(save.idea, fmt)}
                  />
                ))
              ) : (
                <div className="py-20 text-center space-y-4">
                  <Bookmark className="w-12 h-12 text-zinc-800 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-zinc-400 font-bold">No saved ideas yet</p>
                    <p className="text-zinc-600 text-xs">Ideas you bookmark will appear here for later review.</p>
                  </div>
                </div>
              )
            ) : (
              <PricingSection 
                currentPlan={tier} 
                onUpgrade={handleUpgrade} 
                onDowngrade={handleDowngrade} 
              />
            )}
          </div>

          {/* Footer */}
          <footer className="pt-12 pb-20 border-t border-zinc-900 space-y-6">
            <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 space-y-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Disclaimer</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed italic">
                {dailyGen?.disclaimer || "All ideas cite real signals. Inspiration only — do your own diligence."}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              <p>© 2026 TREND EQUITY ENGINE</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a>
                <a href="#" className="hover:text-emerald-500 transition-colors">Terms</a>
                <a href="#" className="hover:text-emerald-500 transition-colors">Contact</a>
              </div>
            </div>
          </footer>
        </main>

        {/* Floating Refresh (Admin/Dev only or for everyone if error) */}
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button 
              onClick={() => fetchDaily(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-500 transition-all font-bold text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {error} - RETRY
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
