import React, { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function NetworkIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      setShowSyncing(true);
      // Simulate sync duration
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
