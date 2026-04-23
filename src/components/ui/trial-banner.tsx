"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, Clock } from "lucide-react";
import { useModules } from "@/context/ModuleContext";
import { cn } from "@/lib/utils";

export function TrialBanner({ onUpgrade }: { onUpgrade?: () => void }) {
  const { billing } = useModules();
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });
  const [totalDays] = useState(14);

  const isTrialing = billing.status === "trialing" && billing.trialEndsAt;

  useEffect(() => {
    if (!billing.trialEndsAt) return;
    const update = () => {
      const end = new Date(billing.trialEndsAt!).getTime();
      const diff = Math.max(0, end - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setTimeLeft({ days, hours, minutes });
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [billing.trialEndsAt]);

  if (!isTrialing || dismissed) return null;

  const daysLeft = timeLeft.days;
  const progressPct = Math.max(0, Math.min(100, (daysLeft / totalDays) * 100));
  const isUrgent = daysLeft <= 3;
  const isExpiring = daysLeft <= 7;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="overflow-hidden"
      >
        <div
          className={cn(
            "relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium",
            isUrgent
              ? "bg-rose-600"
              : isExpiring
              ? "bg-amber-500"
              : "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600"
          )}
        >
          {/* Animated shimmer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />
          </div>

          {/* Icon */}
          <div className="shrink-0 flex items-center justify-center">
            {isUrgent ? (
              <Clock className="w-4 h-4 text-white animate-pulse" />
            ) : (
              <Zap className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Main message */}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
            <span className="text-white text-xs font-black uppercase tracking-wide shrink-0">
              {isUrgent ? "⚠️ Trial Expiring Soon" : "Free Trial"}
            </span>

            {/* Countdown */}
            <div className="flex items-center gap-2 shrink-0">
              {[
                { val: timeLeft.days, label: "d" },
                { val: timeLeft.hours, label: "h" },
                { val: timeLeft.minutes, label: "m" },
              ].map(({ val, label }) => (
                <span
                  key={label}
                  className="inline-flex items-baseline gap-0.5 bg-white/20 px-1.5 py-0.5 rounded-md text-white text-xs font-black tabular-nums"
                >
                  {String(val).padStart(2, "0")}
                  <span className="text-white/70 font-normal text-[9px]">{label}</span>
                </span>
              ))}
              <span className="text-white/80 text-xs font-medium">remaining</span>
            </div>

            {/* Progress bar */}
            <div className="hidden sm:block flex-1 max-w-[120px]">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isUrgent ? "bg-white" : "bg-white/80"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95",
              isUrgent
                ? "bg-white text-rose-600 hover:bg-rose-50"
                : "bg-white text-blue-700 hover:bg-blue-50"
            )}
          >
            Upgrade Now →
          </button>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
            aria-label="Dismiss trial banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
