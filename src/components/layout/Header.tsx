import React from 'react';
import { TrendingUp, Calendar, RefreshCw, Bell, LogOut, LogIn, Crown } from 'lucide-react';
import { User } from 'firebase/auth';
import { Tier } from '../../types';

interface HeaderProps {
  user: User | null;
  tier: Tier;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  unreadAlertsCount: number;
  showAlerts: boolean;
  setShowAlerts: (show: boolean) => void;
  handleLogout: () => void;
  handleLogin: () => void;
  triggerGeneration: () => void;
  generating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  tier,
  setActiveTab,
  unreadAlertsCount,
  showAlerts,
  setShowAlerts,
  handleLogout,
  handleLogin,
  triggerGeneration,
  generating
}) => {
  return (
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
                    onClick={triggerGeneration}
                    disabled={generating}
                    className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors disabled:opacity-50"
                    title="Force Refresh Feed"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  </button>
                )}
                {tier === 'builder' && (
                  <button
                    onClick={() => setShowAlerts(!showAlerts)}
                    className="p-2 text-zinc-500 hover:text-white transition-colors relative"
                    title="Alerts"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadAlertsCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                    )}
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
                  <Crown className={`w-3 h-3 ${tier === 'builder' ? 'text-amber-500' :
                    tier === 'pro' ? 'text-emerald-500' :
                      'text-zinc-500'
                    }`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest leading-none ${tier === 'builder' ? 'text-amber-500' :
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
  );
};
