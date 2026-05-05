import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertCircle, RefreshCw, Calendar, Rocket, Wand2, Lock, X } from 'lucide-react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
import { TIER_LIMITS } from './constants';
import { WeeklyTrendRadar, Futurecasting, Idea } from './types';

// --- Hooks ---
import { useAuth } from './hooks/useAuth';
import { useTier } from './hooks/useTier';
import { useAlerts } from './hooks/useAlerts';
import { useIdeas } from './hooks/useIdeas';
import { useWeeklyBest } from './hooks/useWeeklyBest';
import { useAnalyzeIdea } from './hooks/useAnalyzeIdea';

// --- Components ---
import { ErrorBoundary } from './components/ErrorBoundary';
import { PricingSection } from './components/PricingSection';
import { Header } from './components/layout/Header';
import { AlertsPanel } from './components/layout/AlertsPanel';
import { IdeaFeedSkeleton, RadarSkeleton } from './components/layout/SkeletonLoaders';
import { TE100Modal } from './components/builder/TE100Modal';
import { ApiAccessModal } from './components/builder/ApiAccessModal';
import { AnalyzeIdeaModal } from './components/AnalyzeIdeaModal';

// --- Tab Views ---
import { IdeaFeed } from './components/tabs/IdeaFeed';
import { WeeklyBestTab } from './components/tabs/WeeklyBest';
import { WeeklyRadarTab } from './components/tabs/WeeklyRadar';
import { FuturecastingTab } from './components/tabs/Futurecasting';
import { EmailDigestTab } from './components/tabs/EmailDigest';
import { SavedIdeasTab } from './components/tabs/SavedIdeas';
import EnterpriseLanding from './pages/EnterpriseLanding';

// --- Utils ---
import {
  generateWeeklyTrendRadar,
  generateFuturecasting,
  setCurrentIdToken,
} from './services/geminiService';
import { exportDocument, exportListToCSV, exportListToPDF } from './utils/exportUtils';

export default function App() {
  if (window.location.pathname === '/enterprise') {
    return <EnterpriseLanding />;
  }

  const { user, authReady, handleLogin, handleLogout, error: authError } = useAuth();
  const { tier, handleUpgrade, handleDowngrade, upgradeToBuilder, tierNotification } =
    useTier(user);
  const {
    alerts,
    showAlerts,
    setShowAlerts,
    markAlertAsRead,
    unreadAlertsCount,
    loading: alertsLoading,
  } = useAlerts(user);

  const {
    dailyGen,
    userSaves,
    feedSaves,
    customSaves,
    loading,
    generating,
    error: ideasError,
    filters,
    setFilters,
    toggleSave,
    updateIdea,
    getFilteredIdeas,
    triggerGeneration,
    fetchDaily,
  } = useIdeas(user, tier, authReady);

  const analyzeIdeaHook = useAnalyzeIdea(user, tier, authReady);

  // FIX (S-2): Sync Firebase ID token into geminiService for server-side auth.
  // Token refreshes every 50 min (Firebase tokens expire in 1 hour).
  useEffect(() => {
    if (user) {
      user
        .getIdToken()
        .then(setCurrentIdToken)
        .catch(() => setCurrentIdToken(null));
      const interval = setInterval(
        async () => {
          const token = await user.getIdToken(true);
          setCurrentIdToken(token);
        },
        50 * 60 * 1000
      );
      return () => clearInterval(interval);
    } else {
      setCurrentIdToken(null);
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState<
    'feed' | 'saved' | 'weekly' | 'pro' | 'radar' | 'future' | 'digest'
  >('feed');
  const {
    weeklyBest,
    loading: loadingWeekly,
    error: errorWeekly,
    fetched: fetchedWeekly,
    fetchWeeklyBest,
  } = useWeeklyBest(tier);
  const [weeklyRadar, setWeeklyRadar] = useState<WeeklyTrendRadar | null>(null);
  const [futurecasting, setFuturecasting] = useState<Futurecasting | null>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  // FIX (U-3): Track radar/futurecasting error states so UI can show them
  const [radarError, setRadarError] = useState<string | null>(null);
  const [futureError, setFutureError] = useState<string | null>(null);

  // Builder Modal States
  const [showTE100, setShowTE100] = useState(false);
  const [showApiAccess, setShowApiAccess] = useState(false);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

  // BUG-1 / BUG-3 FIX: Auth errors get their own dismissable toast, separate from ideas retry banner.
  const [authToastVisible, setAuthToastVisible] = useState(false);
  useEffect(() => {
    if (authError) {
      setAuthToastVisible(true);
      const t = setTimeout(() => {
        setAuthToastVisible(false);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [authError]);

  const today = new Date().toISOString().split('T')[0];

  // --- Tab Specific Actions ---
  // IMPORTANT: All hooks must be declared before any conditional return (React Rules of Hooks).
  // FIX (B-3, U-3): useCallback prevents stale closure re-creation and tracks error state
  const fetchWeeklyRadar = useCallback(async () => {
    setLoadingRadar(true);
    setRadarError(null);
    try {
      const radar = await generateWeeklyTrendRadar();
      setWeeklyRadar(radar);
    } catch (err: any) {
      console.error('Failed to fetch radar:', err);
      setRadarError(err?.message || 'Radar analysis unavailable. Please try again.');
    } finally {
      setLoadingRadar(false);
    }
  }, []);

  const fetchFuturecasting = useCallback(async (horizon: '2027' | '2030' | '2035' = '2030') => {
    setLoadingFuture(true);
    setFutureError(null);
    try {
      const fc = await generateFuturecasting(horizon);
      setFuturecasting(fc);
    } catch (err: any) {
      console.error('Failed to fetch futurecasting:', err);
      setFutureError(err?.message || 'Futurecasting unavailable. Please try again.');
    } finally {
      setLoadingFuture(false);
    }
  }, []);

  // FIX (B-3): Only fetch if not already loaded and no ongoing error (prevents retry storm).
  // Guard with authReady so this never fires during the loading splash.
  useEffect(() => {
    if (!authReady) return;
    if (activeTab === 'radar' && !weeklyRadar && !loadingRadar && !radarError) fetchWeeklyRadar();
    if (activeTab === 'future' && !futurecasting && !loadingFuture && !futureError)
      fetchFuturecasting();
  }, [
    authReady,
    activeTab,
    weeklyRadar,
    futurecasting,
    loadingRadar,
    loadingFuture,
    radarError,
    futureError,
    fetchWeeklyRadar,
    fetchFuturecasting,
  ]);

  // FIX (U-4): Show a minimal loading screen while Firebase resolves auth state
  // to prevent a flash of "free tier" UI for paying users.
  // Must be AFTER all hooks above.
  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const onToggleSaveLocal = (idea: Idea) => {
    toggleSave(idea, TIER_LIMITS, handleLogin, () => setActiveTab('pro'));
  };

  const onSaveCustomIdeaLocal = (idea: Idea, userInput?: string) => {
    toggleSave(idea, TIER_LIMITS, handleLogin, () => setActiveTab('pro'), 'custom', userInput);
  };

  const onUpgradeToBuilder = () => upgradeToBuilder(handleLogin);

  const getDynamicIntro = () => {
    const count = TIER_LIMITS[tier].dailyIdeas;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `Welcome to the ${dateStr} edition of Trend-Equity. Today we navigate the convergence of emerging market signals and high-velocity AI-native shifts. The following ${count} ideas have been filtered through our strict VC engine for maximum investability and timing relevance.`;
  };

  // Full-page loader only for INITIAL Daily AI Generation
  if (generating && !dailyGen) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
          />
          <Rocket className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className="mt-8 text-xl font-semibold text-white tracking-tight">
          Generating today's feed...
        </h2>
        <p className="mt-2 text-zinc-500 text-sm max-w-xs mx-auto">
          Our AI is scanning real-time signals from Google, X, and Reddit to find today's top{' '}
          {TIER_LIMITS[tier].dailyIdeas} opportunities.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
        <Header
          user={user}
          tier={tier}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unreadAlertsCount={unreadAlertsCount}
          showAlerts={showAlerts}
          setShowAlerts={setShowAlerts}
          handleLogout={handleLogout}
          handleLogin={handleLogin}
          triggerGeneration={triggerGeneration}
          generating={generating}
        />

        <AlertsPanel
          alerts={alerts}
          showAlerts={showAlerts}
          setShowAlerts={setShowAlerts}
          markAlertAsRead={markAlertAsRead}
          loading={alertsLoading}
        />

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {/* Intro Section */}
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] uppercase italic">
            Today's <br />
            <span className="text-emerald-500">Top {TIER_LIMITS[tier].dailyIdeas}</span> Ideas
          </h2>

          {/* FIX (U-2): Tier notification toast — replaces alert() */}
          {tierNotification && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-full shadow-xl animate-fade-in">
              {tierNotification}
            </div>
          )}

          {/* Tabs — FIX (U-6): Added role="tablist" and ARIA attributes */}
          <div
            role="tablist"
            aria-label="Navigation tabs"
            className="flex flex-wrap gap-1 p-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl w-fit"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'feed'}
              aria-controls="tabpanel-feed"
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'feed' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Daily Feed
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'saved'}
              aria-controls="tabpanel-saved"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'saved' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Saved{' '}
              {userSaves.length > 0 && (
                <span className="ml-1 text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                  {userSaves.length}
                  {tier === 'free' ? `/${TIER_LIMITS.free.monthlySaves}` : ''}
                </span>
              )}
            </button>
            {tier !== 'free' && (
              <button
                role="tab"
                aria-selected={activeTab === 'weekly'}
                aria-controls="tabpanel-weekly"
                onClick={() => setActiveTab('weekly')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'weekly' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Weekly Best
              </button>
            )}
            {tier === 'builder' && (
              <button
                role="tab"
                aria-selected={activeTab === 'radar'}
                aria-controls="tabpanel-radar"
                onClick={() => setActiveTab('radar')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'radar' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Radar
              </button>
            )}
            {tier === 'builder' && (
              <button
                role="tab"
                aria-selected={activeTab === 'future'}
                aria-controls="tabpanel-future"
                onClick={() => setActiveTab('future')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'future' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Futurecasting
              </button>
            )}
            {tier !== 'free' && (
              <button
                role="tab"
                aria-selected={activeTab === 'digest'}
                aria-controls="tabpanel-digest"
                onClick={() => setActiveTab('digest')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'digest' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Digest
              </button>
            )}
            <button
              role="tab"
              aria-selected={activeTab === 'pro'}
              aria-controls="tabpanel-pro"
              onClick={() => setActiveTab('pro')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pro'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : tier === 'builder'
                    ? 'text-zinc-500 hover:text-zinc-300'
                    : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              {tier === 'free' ? 'Upgrade' : 'Plan'}
            </button>
          </div>

          {/* Feed Content — FIX (U-6): role="tabpanel" for accessibility */}
          <div role="tabpanel" id={`tabpanel-${activeTab}`} className="space-y-6">
            {activeTab === 'feed' ? (
              <IdeaFeed
                dailyGen={dailyGen}
                userSaves={userSaves}
                filters={filters}
                setFilters={setFilters}
                tier={tier}
                onExportCSV={() => exportListToCSV(dailyGen?.ideas || [], activeTab, today)}
                onExportPDF={() => exportListToPDF(dailyGen?.ideas || [], activeTab, today)}
                toggleSave={onToggleSaveLocal}
                updateIdea={updateIdea}
                getFilteredIdeas={getFilteredIdeas}
                exportToPDF={exportDocument}
                setActiveTab={setActiveTab}
                triggerGeneration={triggerGeneration}
                loading={loading}
                generating={generating}
                error={ideasError}
                user={user}
                handleLogin={handleLogin}
              />
            ) : activeTab === 'radar' ? (
              <WeeklyRadarTab
                weeklyRadar={weeklyRadar}
                loadingRadar={loadingRadar}
                fetchWeeklyRadar={fetchWeeklyRadar}
                error={radarError}
                onRetry={() => {
                  setRadarError(null);
                  fetchWeeklyRadar();
                }}
              />
            ) : activeTab === 'future' ? (
              <FuturecastingTab
                futurecasting={futurecasting}
                loadingFuture={loadingFuture}
                fetchFuturecasting={fetchFuturecasting}
                error={futureError}
                onRetry={() => {
                  setFutureError(null);
                  fetchFuturecasting();
                }}
              />
            ) : activeTab === 'digest' ? (
              <EmailDigestTab user={user} />
            ) : activeTab === 'saved' ? (
              <SavedIdeasTab
                feedSaves={feedSaves}
                customSaves={customSaves}
                toggleSave={onToggleSaveLocal}
                toggleCustomSave={onSaveCustomIdeaLocal}
                updateIdea={updateIdea}
                tier={tier}
                exportToPDF={exportDocument}
                loading={loading}
                user={user}
                handleLogin={handleLogin}
                onOpenAnalyzeModal={() => setShowAnalyzeModal(true)}
                onUpgradeNeeded={() => setActiveTab('pro')}
              />
            ) : activeTab === 'weekly' ? (
              <WeeklyBestTab
                weeklyBest={weeklyBest}
                loading={loadingWeekly}
                error={errorWeekly}
                fetched={fetchedWeekly}
                onFetch={fetchWeeklyBest}
                userSaves={userSaves}
                toggleSave={onToggleSaveLocal}
                updateIdea={updateIdea}
                tier={tier}
                exportToPDF={exportDocument}
                user={user}
                handleLogin={handleLogin}
              />
            ) : (
              <PricingSection
                currentPlan={tier}
                onUpgrade={handleUpgrade}
                onDowngrade={handleDowngrade}
                onOpenTE100={() => setShowTE100(true)}
                onOpenApiAccess={() => setShowApiAccess(true)}
              />
            )}
          </div>

          {/* Footer */}
          <footer className="pt-12 pb-20 border-t border-zinc-900 space-y-6">
            <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 space-y-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Disclaimer</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed italic">
                {dailyGen?.disclaimer ||
                  'All ideas cite real signals. Inspiration only — do your own diligence.'}
              </p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              <p>© 2026 TREND EQUITY ENGINE</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-emerald-500 transition-colors">
                  Privacy
                </a>
                <a href="#" className="hover:text-emerald-500 transition-colors">
                  Terms
                </a>
                <a href="#" className="hover:text-emerald-500 transition-colors">
                  Contact
                </a>
              </div>
            </div>
          </footer>
        </main>

        {/* Ideas error — retry button */}
        {ideasError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={() => fetchDaily(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-500 transition-all font-bold text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {ideasError} — RETRY
            </button>
          </div>
        )}

        {/* Auth error — auto-dismissing toast with close button (BUG-1 / BUG-3 fix) */}
        <AnimatePresence>
          {authToastVisible && authError && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-full shadow-2xl text-sm font-medium max-w-sm"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="truncate">{authError}</span>
              <button
                onClick={() => {
                  setAuthToastVisible(false);
                }}
                className="ml-1 flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <TE100Modal user={user} isOpen={showTE100} onClose={() => setShowTE100(false)} />
        <ApiAccessModal
          user={user}
          isOpen={showApiAccess}
          onClose={() => setShowApiAccess(false)}
        />
        <AnalyzeIdeaModal
          isOpen={showAnalyzeModal}
          onClose={() => setShowAnalyzeModal(false)}
          tier={tier}
          user={user}
          handleLogin={handleLogin}
          onAnalyzeComplete={() => {}}
          onSaveCustomIdea={onSaveCustomIdeaLocal}
          customSavesCount={customSaves.length}
          analyzeIdeaHook={analyzeIdeaHook}
          updateIdea={updateIdea}
          exportToPDF={exportDocument}
        />
      </div>
    </ErrorBoundary>
  );
}
