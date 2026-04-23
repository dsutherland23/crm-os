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
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: true,
        };
        await sendEmailVerification(auth.currentUser, actionCodeSettings);
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-950 relative overflow-hidden">
      {/* Premium Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#18181b,0%,#09090b_100%)]" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <Card className="max-w-[480px] w-full p-8 sm:p-12 border-white/5 bg-zinc-900/50 backdrop-blur-3xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)] rounded-[3rem] relative z-10 border">
        
        {/* Floating Logo / Icon Section */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center p-4 group">
            <div className="w-full h-full bg-zinc-950 rounded-[1.8rem] flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
               <Mail className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-10 space-y-10">
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest mx-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              Security Protocol Active
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Awaiting Verification
            </h1>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
              We've dispatched an authentication link to <span className="text-white font-bold">{user.email}</span>.
            </p>
          </div>

          {/* Auto-check progress indicator */}
          <div className="relative h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 w-1/3 animate-[progress_3s_ease-in-out_infinite]" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="group p-5 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all duration-300">
               <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm shrink-0">1</div>
                  <div className="space-y-1">
                     <h4 className="text-sm font-bold text-white">Check Inbox</h4>
                     <p className="text-[11px] text-zinc-500 font-medium">Look for an email from Orivo CRM with the verification link.</p>
                  </div>
               </div>
            </div>
            <div className="group p-5 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all duration-300">
               <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm shrink-0">2</div>
                  <div className="space-y-1">
                     <h4 className="text-sm font-bold text-white">Activate Account</h4>
                     <p className="text-[11px] text-zinc-500 font-medium">Click the link. This portal will update instantly upon success.</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleCheckStatus}
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-white text-zinc-950 font-bold text-sm hover:bg-zinc-100 transition-all shadow-xl shadow-white/5 group"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  I've Clicked the Link
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full h-10 text-zinc-500 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              {resending && <RefreshCw className="w-3 h-3 animate-spin" />}
              Didn't get the email? <span className="text-blue-400 hover:underline">Resend Transmission</span>
            </button>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col items-center gap-4">
             <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] hover:text-rose-500 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign in with different identity
              </button>
          </div>
        </div>
      </Card>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}} />
    </div>
  );
}
