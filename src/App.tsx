import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  Rocket,
  Wand2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
import { TIER_LIMITS } from './constants';
import { WeeklyTrendRadar, Futurecasting, Idea } from './types';

// --- Hooks ---
import { useAuth } from './hooks/useAuth';
import { useTier } from './hooks/useTier';
import { useAlerts } from './hooks/useAlerts';
import { useIdeas } from './hooks/useIdeas';

// --- Components ---
import { ErrorBoundary } from './components/ErrorBoundary';
import { PricingSection } from './components/PricingSection';
import { Header } from './components/layout/Header';
import { AlertsPanel } from './components/layout/AlertsPanel';

// --- Tab Views ---
import { IdeaFeed } from './components/tabs/IdeaFeed';
import { WeeklyRadarTab } from './components/tabs/WeeklyRadar';
import { FuturecastingTab } from './components/tabs/Futurecasting';
import { EmailDigestTab } from './components/tabs/EmailDigest';
import { SavedIdeasTab } from './components/tabs/SavedIdeas';

// --- Utils ---
import { generateWeeklyTrendRadar, generateFuturecasting } from './services/geminiService';
import { exportToPDF, exportListToCSV, exportListToPDF } from './utils/exportUtils';

export default function App() {
  const { user, authReady, handleLogin, handleLogout, error: authError } = useAuth();
  const { tier, handleUpgrade, handleDowngrade, upgradeToBuilder } = useTier(user);
  const { alerts, showAlerts, setShowAlerts, markAlertAsRead, unreadAlertsCount } = useAlerts();
  
  const { 
    dailyGen, 
    userSaves, 
    loading, 
    generating, 
    error: ideasError, 
    filters, 
    setFilters, 
    toggleSave, 
    updateIdea, 
    getFilteredIdeas, 
    triggerGeneration,
    fetchDaily
  } = useIdeas(user, tier, authReady);

  const [activeTab, setActiveTab] = useState<'feed' | 'saved' | 'pro' | 'radar' | 'future' | 'digest'>('feed');
  const [weeklyRadar, setWeeklyRadar] = useState<WeeklyTrendRadar | null>(null);
  const [futurecasting, setFuturecasting] = useState<Futurecasting | null>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);

  const error = authError || ideasError;
  const today = new Date().toISOString().split('T')[0];

  // --- Tab Specific Actions ---
  const fetchWeeklyRadar = async () => {
    setLoadingRadar(true);
    try {
      const radar = await generateWeeklyTrendRadar();
      setWeeklyRadar(radar);
    } catch (err) {
      console.error("Failed to fetch radar:", err);
    } finally {
      setLoadingRadar(false);
    }
  };

  const fetchFuturecasting = async (horizon: '2027' | '2030' | '2035' = '2030') => {
    setLoadingFuture(true);
    try {
      const fc = await generateFuturecasting(horizon);
      setFuturecasting(fc);
    } catch (err) {
      console.error("Failed to fetch futurecasting:", err);
    } finally {
      setLoadingFuture(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'radar' && !weeklyRadar) fetchWeeklyRadar();
    if (activeTab === 'future' && !futurecasting) fetchFuturecasting();
  }, [activeTab]);

  const onToggleSaveLocal = (idea: Idea) => {
    toggleSave(idea, TIER_LIMITS, handleLogin, () => setActiveTab('pro'));
  };

  const onUpgradeToBuilder = () => upgradeToBuilder(handleLogin);

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
          {generating ? `Our AI is scanning real-time signals from Google, X, and Reddit to find today's top ${TIER_LIMITS[tier].dailyIdeas} opportunities.` : "Connecting to the VC engine..."}
        </p>
      </div>
    );
  }

  const getDynamicIntro = () => {
    const count = TIER_LIMITS[tier].dailyIdeas;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `Welcome to the ${dateStr} edition of Trend-Equity. Today we navigate the convergence of emerging market signals and high-velocity AI-native shifts. The following ${count} ideas have been filtered through our strict VC engine for maximum investability and timing relevance.`;
  };

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
        />

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {/* Intro Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] uppercase italic">
                Today's <br /> <span className="text-emerald-500">Top {TIER_LIMITS[tier].dailyIdeas}</span> Ideas
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                {getDynamicIntro()}
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
              SAVED ({userSaves.length}{tier === 'free' ? `/${TIER_LIMITS.free.monthlySaves}` : ''})
            </button>
            {tier === 'builder' && (
              <button
                onClick={() => setActiveTab('radar')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'radar' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                WEEKLY RADAR
              </button>
            )}
            {tier === 'builder' && (
              <button
                onClick={() => setActiveTab('future')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'future' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                FUTURECASTING
              </button>
            )}
            {tier !== 'free' && (
              <button
                onClick={() => setActiveTab('digest')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'digest' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                DIGEST
              </button>
            )}
            <button
              onClick={() => setActiveTab('pro')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'pro'
                  ? 'bg-zinc-800 text-white shadow-lg'
                  : tier === 'builder' ? 'text-zinc-500 hover:text-zinc-300' : 'text-emerald-500 hover:text-emerald-400'
                }`}
            >
              MANAGE PLAN
            </button>
          </div>

          {/* Feed Content */}
          <div className="space-y-6">
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
                exportToPDF={exportToPDF}
                setActiveTab={setActiveTab}
              />
            ) : activeTab === 'radar' ? (
              <WeeklyRadarTab 
                weeklyRadar={weeklyRadar}
                loadingRadar={loadingRadar}
                fetchWeeklyRadar={fetchWeeklyRadar}
              />
            ) : activeTab === 'future' ? (
              <FuturecastingTab 
                futurecasting={futurecasting}
                loadingFuture={loadingFuture}
                fetchFuturecasting={fetchFuturecasting}
              />
            ) : activeTab === 'digest' ? (
              <EmailDigestTab user={user} />
            ) : activeTab === 'saved' ? (
              <SavedIdeasTab 
                userSaves={userSaves}
                toggleSave={onToggleSaveLocal}
                updateIdea={updateIdea}
                tier={tier}
                exportToPDF={exportToPDF}
              />
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

        {/* Floating Refresh */}
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
