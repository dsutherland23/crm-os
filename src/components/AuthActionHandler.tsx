import React, { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { 
  applyActionCode, 
  checkActionCode, 
  confirmPasswordReset, 
  verifyPasswordResetCode 
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles,
  Command,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ActionMode = "verifyEmail" | "resetPassword" | "recoverEmail" | "unknown";

export default function AuthActionHandler() {
  const [mode, setMode] = useState<ActionMode>("unknown");
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "input">("loading");
  const [error, setError] = useState<string | null>(null);
  
  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode") as ActionMode;
    const codeParam = params.get("oobCode");

    if (!modeParam || !codeParam) {
      setMode("unknown");
      setStatus("error");
      setError("Invalid or missing action parameters.");
      return;
    }

    setMode(modeParam);
    setOobCode(codeParam);

    handleAction(modeParam, codeParam);
  }, []);

  const handleAction = async (actionMode: ActionMode, code: string) => {
    try {
      switch (actionMode) {
        case "verifyEmail":
          await applyActionCode(auth, code);
          setStatus("success");
          break;
        
        case "resetPassword":
          const email = await verifyPasswordResetCode(auth, code);
          setUserEmail(email);
          setStatus("input");
          break;

        case "recoverEmail":
          // Handle email recovery if needed
          setStatus("error");
          setError("Email recovery is not yet implemented.");
          break;

        default:
          setStatus("error");
          setError("Unsupported action mode.");
      }
    } catch (err: any) {
      console.error("Auth action error:", err);
      setStatus("error");
      setError(err.message || "The action link has expired or is invalid.");
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (!oobCode) return;

    setStatus("loading");
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("success");
      toast.success("Password updated successfully!");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Failed to reset password.");
    }
  };

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold text-zinc-900">Validating Request</h2>
            <p className="text-sm text-zinc-500">Securing your identity pipeline...</p>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-rose-100 rounded-full blur-2xl opacity-50" />
            <div className="relative w-24 h-24 bg-white border-2 border-rose-100 rounded-3xl flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/10">
              <XCircle className="w-12 h-12" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight leading-tight">ACTION EXPIRED</h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
              {error || "This link has already been used or is no longer valid. For security, these links expire quickly."}
            </p>
          </div>

          <Button 
            onClick={() => window.location.href = "/"}
            className="w-full h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 shadow-xl shadow-zinc-900/20"
          >
            Return to Dashboard
          </Button>
        </div>
      );
    }

    if (status === "success") {
      const isVerify = mode === "verifyEmail";
      return (
        <div className="space-y-8 text-center animate-in fade-in zoom-in duration-700">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-emerald-100 rounded-full blur-2xl opacity-50" />
            <div className="relative w-24 h-24 bg-white border-2 border-emerald-100 rounded-3xl flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-amber-400 animate-bounce" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase">
              {isVerify ? "Identity Verified" : "Password Reset"}
            </h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
              {isVerify 
                ? "Your email has been successfully authenticated. Your enterprise workspace is now ready." 
                : "Your security credentials have been updated. You can now sign in with your new password."}
            </p>
          </div>

          <Button 
            onClick={() => window.location.href = "/"}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xl shadow-blue-600/30 group"
          >
            Launch Platform
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      );
    }

    if (status === "input" && mode === "resetPassword") {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-900/20">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">New Password</h2>
              <p className="text-xs text-zinc-400 font-medium">{userEmail}</p>
            </div>
          </div>

          <form onSubmit={handlePasswordReset} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Secure Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 rounded-xl bg-white border-zinc-200 pl-4 pr-10 font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium ml-1">Use at least 8 characters with numbers & symbols.</p>
            </div>

            <Button 
              type="submit"
              className="w-full h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 shadow-xl shadow-zinc-900/20 group"
            >
              Update Credentials
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-50 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:40px_40px] opacity-25" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-100 rounded-full blur-[120px] opacity-40 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-[120px] opacity-40 animate-pulse" style={{ animationDelay: "1s" }} />

      <Card className="max-w-[420px] w-full p-8 sm:p-10 border-white/50 bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] rounded-[2.5rem] relative z-10 border-2">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center border-2 border-zinc-50 p-4">
             <div className="w-full h-full bg-zinc-900 rounded-2xl flex items-center justify-center">
                <Command className="w-8 h-8 text-white" />
             </div>
          </div>
        </div>

        <div className="pt-10">
          {renderContent()}
        </div>

        {/* Brand Footer */}
        <div className="mt-12 pt-6 border-t border-zinc-100/60 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Orivo Secure Gateway</span>
          </div>
          <p className="text-[9px] text-zinc-400 font-medium">Verified Enterprise Authentication System v2.1</p>
        </div>
      </Card>

      {/* Floating Sparkles for Vibe */}
      <div className="fixed top-12 left-12 animate-bounce opacity-20"><Sparkles className="w-6 h-6 text-blue-400" /></div>
      <div className="fixed bottom-12 right-12 animate-bounce opacity-20" style={{ animationDelay: "0.5s" }}><Sparkles className="w-6 h-6 text-indigo-400" /></div>
    </div>
  );
}
