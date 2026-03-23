import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { Alert } from '../../types';

interface AlertsPanelProps {
  alerts: Alert[];
  showAlerts: boolean;
  setShowAlerts: (show: boolean) => void;
  markAlertAsRead: (id: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  showAlerts,
  setShowAlerts,
  markAlertAsRead
}) => {
  return (
    <AnimatePresence>
      {showAlerts && (
        <div className="fixed inset-0 z-[60] flex justify-end p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Market Alerts</h3>
              <button onClick={() => setShowAlerts(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => markAlertAsRead(alert.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${alert.isRead ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60' : 'bg-zinc-800/50 border-white/5 hover:border-emerald-500/30'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${alert.type === 'success' ? 'bg-emerald-500' :
                        alert.type === 'warning' ? 'bg-amber-500' :
                          alert.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">{alert.title}</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-zinc-800 mx-auto" />
                  <p className="text-xs text-zinc-500">No new alerts today.</p>
                </div>
              )}
            </div>
            <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Powered by VC Logic Engine</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
