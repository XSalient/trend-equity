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
import { Idea, DailyGeneration, UserSave } from './types';
import { generateDailyIdeas } from './services/geminiService';
import { 
  TrendingUp, 
  Zap, 
  DollarSign, 
  Target, 
  ExternalLink, 
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
  BookOpen,
  Bell,
  Settings,
  Plus,
  FileText,
  Share2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }
  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 text-center">
          <div className="max-w-md space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-zinc-400">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// --- Components ---

interface IdeaCardProps {
  idea: Idea;
  isSaved: boolean;
  onToggleSave: () => void;
  isSaving: boolean;
  tier: 'free' | 'pro' | 'builder';
  onExport?: (format: 'pdf' | 'notion' | 'gdocs') => void;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ 
  idea, 
  isSaved, 
  onToggleSave, 
  isSaving,
  tier,
  onExport
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isFree = tier === 'free';
  const isBuilder = tier === 'builder';
  const isPro = tier === 'pro';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors group"
    >
      <div className="p-5 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-2 items-center">
              {idea.categoryTags.map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {idea.heatBadge || 'Early Bird'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white leading-tight group-hover:text-emerald-400 transition-colors">{idea.headline}</h3>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <div className="relative group/export">
                <button 
                  className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors bg-zinc-800/50 rounded-full"
                  title="Export Pitch Deck"
                >
                  <Download className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50 p-1">
                  <button 
                    onClick={() => onExport('pdf')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> PDF Pitch Deck
                  </button>
                  {!isFree ? (
                    <>
                      <button 
                        onClick={() => onExport('notion')}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                      >
                        <Share2 className="w-4 h-4" /> Notion Template
                      </button>
                      <button 
                        onClick={() => onExport('gdocs')}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Google Docs
                      </button>
                    </>
                  ) : (
                    <div className="px-3 py-2 border-t border-zinc-800 mt-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Upgrade for Notion/GDocs</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button 
              onClick={onToggleSave}
              disabled={isSaving}
              className={`p-2 rounded-full transition-colors ${isSaved ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'}`}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />)}
            </button>
          </div>
        </div>

        {/* Pitch */}
        <p className="text-zinc-300 text-sm leading-relaxed italic border-l-2 border-emerald-500/30 pl-4 py-1">
          "{idea.pitch}"
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Potential Score</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${idea.revenuePotentialScore}%` }} />
              </div>
              <span className="text-xs font-mono text-emerald-400">{idea.revenuePotentialScore}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Cost & Effort</span>
            <p className="text-xs text-zinc-300 font-medium">{idea.costEffort}</p>
          </div>
          <div className="space-y-1 hidden md:block">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Exit Strategy</span>
            <p className="text-xs text-zinc-300 font-medium truncate">{idea.potentialExit}</p>
          </div>
        </div>

        {/* Next Steps (Preview) */}
        {idea.nextSteps && idea.nextSteps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Actionable Next Steps</span>
              {isFree && <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Basic Plan</span>}
            </div>
            <div className="grid gap-2">
              {idea.nextSteps.slice(0, isFree ? 2 : 3).map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Sections */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 flex items-center justify-between text-xs font-bold text-zinc-400 hover:text-white transition-colors py-2 px-3 bg-zinc-800/30 rounded-lg"
            >
              {isExpanded ? 'HIDE VC ANALYSIS' : 'VIEW VC ANALYSIS & SOURCES'}
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {isBuilder && (
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                onClick={() => alert("Build with Me: Generating prompt pack and starter repo...")}
              >
                <Wand2 className="w-4 h-4" />
                BUILD WITH ME
              </button>
            )}
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4 pt-2"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">VC Justification</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.vcJustification}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Unfair Advantage</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.unfairAdvantage}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-500">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Revenue Model</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 font-mono">
                    {idea.revenueSkeleton}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Trend Sources</span>
                  </div>
                  <ul className="space-y-1.5">
                    {idea.trendSources.map((source, i) => (
                      <li key={i} className="text-[11px] text-zinc-500 flex gap-2 items-start">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        {source}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Full Next Steps */}
                {idea.nextSteps && idea.nextSteps.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Full Action Plan</span>
                    </div>
                    <div className="space-y-2 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.nextSteps.slice(0, isFree ? 3 : undefined).map((step, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs text-zinc-300">
                          <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-emerald-500 shrink-0">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </div>
                      ))}
                      {isFree && idea.nextSteps.length > 3 && (
                        <div className="pt-2 text-center">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Upgrade to Pro for full plan</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pro/Builder Features */}
                {!isFree && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">
                      <BarChart3 className="w-3 h-3" />
                      Validation Toolkit
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">
                      <Shield className="w-3 h-3" />
                      Progress Tracker
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

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

  const today = new Date().toISOString().split('T')[0];

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // For demo: if logged in, you are "Pro" by default
        setTier('pro');
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

  // --- Data Fetching ---
  useEffect(() => {
    if (!authReady) return;

    const fetchDaily = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'daily_generations', today);
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `daily_generations/${today}`);
          return;
        }

        if (docSnap.exists()) {
          setDailyGen(docSnap.data() as DailyGeneration);
        } else {
          // Trigger generation if not found
          await triggerGeneration();
        }
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError("Failed to load today's ideas.");
      } finally {
        setLoading(false);
      }
    };

    fetchDaily();
  }, [today, authReady]);

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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tighter uppercase italic">Trend Equity</h1>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Crown className={`w-3 h-3 ${tier === 'builder' ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <p className={`text-[10px] font-bold uppercase tracking-widest leading-none ${tier === 'builder' ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {tier === 'builder' ? 'Builder Tier' : 'Pro Tier'}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-300 truncate max-w-[100px]">{user.displayName || user.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
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
            <div className="flex items-center gap-2 text-emerald-500">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] uppercase italic">
              Today's <br /> <span className="text-emerald-500">Top {tier === 'free' ? '10' : '25'}</span> Ideas
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
              {dailyGen?.intro || "Fresh opportunities derived from real-time signals and vetted through strict VC logic."}
            </p>
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
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'pro' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-500 hover:text-emerald-400'}`}
            >
              UPGRADE
            </button>
          </div>

          {/* Feed */}
          <div className="space-y-6">
            {activeTab === 'feed' ? (
              <>
                {dailyGen?.ideas.slice(0, tier === 'free' ? 10 : 25).map((idea, i) => (
                  <IdeaCard 
                    key={idea.id} 
                    idea={idea} 
                    isSaved={userSaves.some(s => s.idea.id === idea.id)}
                    onToggleSave={() => toggleSave(idea)}
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
              /* Upgrade / Pricing Tab */
              <div className="space-y-8 py-4">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black uppercase italic tracking-tight">Choose Your Path</h3>
                  <p className="text-zinc-500 text-sm">No ads ever. Just high-signal opportunities.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Free */}
                  <div className={`p-6 rounded-3xl border ${tier === 'free' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6`}>
                    <div className="space-y-1">
                      <h4 className="text-lg font-black uppercase italic">Free</h4>
                      <p className="text-3xl font-black">$0</p>
                    </div>
                    <ul className="space-y-3">
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
                    <button className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-widest cursor-default">
                      Current Plan
                    </button>
                  </div>

                  {/* Pro */}
                  <div className={`p-6 rounded-3xl border ${tier === 'pro' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest rounded-bl-xl">Popular</div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-black uppercase italic">Pro</h4>
                      <p className="text-3xl font-black">$9<span className="text-sm text-zinc-500">/mo</span></p>
                    </div>
                    <ul className="space-y-3">
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
                        if (!user) handleLogin();
                        else setTier('pro');
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${tier === 'pro' ? 'bg-zinc-800 text-zinc-400 cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'}`}
                    >
                      {tier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                    </button>
                  </div>

                  {/* Builder */}
                  <div className={`p-6 rounded-3xl border ${tier === 'builder' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50'} space-y-6`}>
                    <div className="space-y-1">
                      <h4 className="text-lg font-black uppercase italic">Builder</h4>
                      <p className="text-3xl font-black">$19<span className="text-sm text-zinc-500">/mo</span></p>
                    </div>
                    <ul className="space-y-3">
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
                      onClick={upgradeToBuilder}
                      className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${tier === 'builder' ? 'bg-zinc-800 text-zinc-400 cursor-default' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'}`}
                    >
                      {tier === 'builder' ? 'Current Plan' : 'Become a Builder'}
                    </button>
                  </div>
                </div>

                {/* Additional Builder Features Grid */}
                {tier === 'builder' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
                      <Bell className="w-5 h-5 text-amber-500 mx-auto" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Real-time Alerts</p>
                    </div>
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
                      <Users className="w-5 h-5 text-amber-500 mx-auto" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Team-up Access</p>
                    </div>
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
                      <Trophy className="w-5 h-5 text-amber-500 mx-auto" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">TE-100 Submission</p>
                    </div>
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-2">
                      <Settings className="w-5 h-5 text-amber-500 mx-auto" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">API Access</p>
                    </div>
                  </div>
                )}
              </div>
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
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-500 transition-all font-bold text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {error} - REFRESH
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
