import React, { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// FIX: Added isPOS prop so the POS page can render a full-width blocking
// warning instead of the subtle bottom pill. A cashier must never close the
// tab while offline — Firebase queues writes locally, but they are lost if
// the browser process terminates before reconnection.
interface NetworkIndicatorProps {
  isPOS?: boolean;
}

export default function NetworkIndicator({ isPOS = false }: NetworkIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      setShowSyncing(true);
      setTimeout(() => {
        setIsSyncing(false);
        setTimeout(() => setShowSyncing(false), 2000);
      }, 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── POS Mode: Full-width blocking warning banner ─────────────────────
  // FIX: When the cashier is offline in POS mode, show a highly visible red
  // banner that explicitly warns them NOT to close the browser tab.
  // Firebase's offline persistence will queue writes, but they are lost if
  // the tab is closed or the browser crashes before reconnection.
  if (isPOS) {
    return (
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="pos-offline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-center gap-3 border-b-2 border-rose-700 shadow-lg">
              <AlertTriangle className="w-5 h-5 flex-none animate-pulse" />
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-wider">
                  ⚠️ You are offline — Transactions are queued locally
                </p>
                <p className="text-[10px] text-rose-100 mt-0.5 font-medium">
                  DO NOT close this tab or refresh until you reconnect. Your pending transactions will be lost.
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 flex-none animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Default Mode: Subtle bottom pill ────────────────────────────────
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        {!isOnline ? (
          <motion.div
            key="offline"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-amber-400/50 backdrop-blur-md"
          >
            <CloudOff className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Offline Mode — Saved Locally</span>
          </motion.div>
        ) : showSyncing ? (
          <motion.div
            key="syncing"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-zinc-900 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-zinc-800 backdrop-blur-md"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <Cloud className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider">
              {isSyncing ? "Auto-Syncing to Cloud..." : "Database Synchronized"}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
