import React, { useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Command, Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { setMockUser } from "@/lib/auth-mock";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Welcome to CRM OS");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Welcome back");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created successfully");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-zinc-900/20">
            <Command className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-display">CRM OS</h1>
            <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold mt-1">Enterprise Intelligence</p>
          </div>
        </div>

        <Card className="card-modern border-zinc-200/50 shadow-2xl shadow-zinc-200/50 overflow-hidden">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold text-center">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin ? "Enter your credentials to access your dashboard" : "Join the next generation of business management"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="Email Address" 
                    className="pl-10 rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    className="pl-10 rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 font-bold shadow-lg shadow-zinc-900/20 transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-zinc-400 font-bold tracking-widest">Or Continue With</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="rounded-xl border-zinc-200 h-12 font-bold hover:bg-zinc-50 transition-all active:scale-[0.98]"
                onClick={handleGoogleLogin}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5 mr-2" alt="Google" />
                Google
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl border-zinc-200 h-12 font-bold hover:bg-zinc-50 transition-all active:scale-[0.98]"
                onClick={() => {
                  setMockUser();
                  toast.success("Joined as Developer Guest");
                }}
              >
                <Sparkles className="w-4 h-4 mr-2 text-zinc-400" />
                Guest
              </Button>
            </div>

            <div className="text-center pt-4">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-zinc-400">
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">AI-Powered Enterprise OS</span>
        </div>
      </div>
    </div>
  );
}
