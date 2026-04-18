import React, { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendEmailVerification, signOut, User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, RefreshCw, LogOut, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VerificationGate({ user }: { user: User }) {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        toast.success("Email verified! Welcome to the enterprise.");
        window.location.reload(); // Force app state refresh
      } else {
        toast.error("Email not verified yet. Please check your inbox.");
      }
    } catch (error) {
      toast.error("Failed to refresh status.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendEmailVerification(user);
      toast.success("Verification email resent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-30" />

      <Card className="max-w-[480px] w-full p-10 space-y-8 border-zinc-200/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] bg-white/80 backdrop-blur-xl relative z-10 transition-all">
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-zinc-900/20 animate-in zoom-in-50 duration-500">
            <Mail className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Verify your identity</h1>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
              We've sent a verification link to <span className="text-zinc-900 font-bold">{user.email}</span>. 
              Click the link to launch your enterprise workspace.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={handleCheckStatus}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
              <>
                I've verified my email
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>

          <Button 
            variant="ghost" 
            onClick={handleResend}
            disabled={resending}
            className="w-full h-12 rounded-2xl text-zinc-600 font-bold text-sm hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"
          >
            {resending ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
              <>
                Didn't receive it? <span className="text-zinc-900 underline underline-offset-4 decoration-zinc-300">Resend email</span>
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-zinc-100 flex items-center justify-center gap-6">
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 text-[11px] font-bold text-rose-500 uppercase tracking-wider hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </Card>
    </div>
  );
}
