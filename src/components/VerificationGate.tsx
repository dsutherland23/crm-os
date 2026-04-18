import React, { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { sendEmailVerification, signOut, User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, RefreshCw, LogOut, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export default function VerificationGate({ user }: { user: User }) {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // ── Auto-poll every 4 seconds ──────────────────────────────────────
  // Firebase caches `emailVerified` in the JWT. We call reload()
  // to fetch the latest state from the server, then navigate if verified.
  const checkVerification = useCallback(async (showToast = false) => {
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        toast.success("Email verified! Launching your workspace…");
        // Brief delay so the user sees the toast, then hard reload forces
        // the new token to propagate through App.tsx guards
        setTimeout(() => window.location.reload(), 800);
        return true;
      } else if (showToast) {
        toast.error("Not verified yet — please click the link in your email.");
      }
    } catch {
      if (showToast) toast.error("Could not check status. Please try again.");
    }
    return false;
  }, []);

  // Auto-polling: check every 4 seconds silently
  useEffect(() => {
    const interval = setInterval(async () => {
      const verified = await checkVerification(false);
      if (verified) clearInterval(interval);
      setPollCount((c) => c + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [checkVerification]);

  const handleCheckStatus = async () => {
    setLoading(true);
    await checkVerification(true);
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.success("Verification email resent! Check your inbox.");
      }
    } catch (error: any) {
      if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please wait a minute before resending.");
      } else {
        toast.error(error.message || "Failed to resend email.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-50 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 pointer-events-none" />
      {/* Orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-30" />

      <Card className="max-w-[460px] w-full p-8 sm:p-10 space-y-8 border-zinc-200/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2rem] bg-white/90 backdrop-blur-xl relative z-10">

        {/* Header */}
        <div className="space-y-5 text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-zinc-900/20">
              <Mail className="w-10 h-10 text-white" />
            </div>
            {/* Pulsing "checking" indicator */}
            <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
              <Clock className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: "3s" }} />
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              Verify your email
            </h1>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
              A verification link was sent to{" "}
              <span className="text-zinc-900 font-bold">{user.email}</span>.{" "}
              Click the link in that email to continue.
            </p>
          </div>
        </div>

        {/* Auto-check notice */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <RefreshCw className="w-4 h-4 text-blue-500 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
          <p className="text-xs font-medium text-blue-700">
            Checking automatically… once you click the link this page will update instantly.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {[
            { n: 1, label: "Open the email from Orivo CRM" },
            { n: 2, label: 'Click "Verify my email"' },
            { n: 3, label: "Return here — you'll be logged in automatically" },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-500 shrink-0">
                {s.n}
              </div>
              <span className="text-sm text-zinc-600 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleCheckStatus}
            disabled={loading}
            className="w-full h-13 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                I've verified — check now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resending}
            className="w-full h-11 rounded-2xl text-zinc-500 font-semibold text-sm hover:bg-zinc-100 hover:text-zinc-900 transition-all"
          >
            {resending ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Didn't receive it?{" "}
            <span className="text-zinc-900 font-bold underline underline-offset-4 decoration-zinc-300 ml-1">
              Resend email
            </span>
          </Button>
        </div>

        {/* Sign out */}
        <div className="pt-2 border-t border-zinc-100 flex items-center justify-center">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 text-[11px] font-bold text-rose-400 uppercase tracking-wider hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Use a different account
          </button>
        </div>
      </Card>
    </div>
  );
}
