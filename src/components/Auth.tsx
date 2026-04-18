import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { auth, db, doc, setDoc, getDoc } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Command, Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const [loading, setLoading] = useState(false);
  const [signUpStep, setSignUpStep] = useState(1);


  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      console.log("Initiating Google Sign-In...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Sign-in successful:", user.email);

      // Check if user profile exists
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.log("No profile found for Google user. Creating default...");
        // Use part of email as default enterprise ID
        const emailSlug = user.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-') || user.uid.substring(0, 8);
        const defaultEnterpriseId = `ent-${emailSlug}`;
        
        const profileData = {
          fullName: user.displayName || emailSlug,
          email: user.email,
          enterprise_id: defaultEnterpriseId,
          enterpriseName: `${user.displayName || emailSlug}'s Organization`,
          role: "Owner",
          status: "ACTIVE",
          createdAt: new Date().toISOString()
        };

        await setDoc(userDocRef, profileData);

        // Initialize Enterprise Settings
        await setDoc(doc(db, "enterprise_settings", defaultEnterpriseId), {
          enterpriseName: profileData.enterpriseName,
          setupCompleted: true,
          enterprise_id: defaultEnterpriseId,
          createdAt: new Date().toISOString()
        }, { merge: true });

        console.log("Profile created with enterprise:", defaultEnterpriseId);
      }

      toast.success("Welcome to Orivo CRM");
      // Reload to ensure all context listeners (App.tsx) re-run with the new profile
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error("Google Auth Error:", error.code, error.message);
      if (error.code === 'auth/popup-blocked') {
        toast.error("Popup blocked! Please allow popups for this site.");
      } else {
        toast.error(`Auth Error: ${error.message}`);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Ensure profile exists for existing users (fail-safe)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const defaultEnterpriseId = `ent-${user.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-') || user.uid.substring(0, 8)}`;
          await setDoc(userDocRef, {
            fullName: user.email?.split('@')[0] || "User",
            email: user.email,
            enterprise_id: defaultEnterpriseId,
            enterpriseName: "My Organization",
            role: "Owner",
            status: "ACTIVE",
            createdAt: new Date().toISOString()
          });
          await setDoc(doc(db, "enterprise_settings", defaultEnterpriseId), {
            enterpriseName: "My Organization",
            enterprise_id: defaultEnterpriseId,
            setupCompleted: true
          }, { merge: true });
        }
      } else {
        if (signUpStep === 1) {
          setSignUpStep(2);
          setLoading(false);
          return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create User Profile in Firestore
        await setDoc(doc(db, "users", user.uid), {
          fullName,
          email,
          enterprise_id: enterprise, 
          enterpriseName: enterprise,
          role: "Owner",
          status: "ACTIVE",
          createdAt: new Date().toISOString()
        });

        // Initialize Enterprise Settings
        await setDoc(doc(db, "enterprise_settings", enterprise), {
          enterpriseName: enterprise,
          setupCompleted: true,
          enterprise_id: enterprise,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }

      toast.success(isLogin ? "Welcome back" : "Enterprise account provisioned");
      // Reload to ensure context syncs with Firestore
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      setLoading(false);
      console.error("Auth Error Detail:", error);
      
      // Map common Firebase Auth errors to user-friendly messages
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') message = "This email is already registered. Please sign in instead.";
      if (error.code === 'auth/weak-password') message = "The password is too weak. Please use at least 6 characters.";
      if (error.code === 'auth/operation-not-allowed') message = "Email/Password sign-in is not enabled in your Firebase project. Please enable it in the console.";
      if (error.code === 'auth/invalid-email') message = "Please enter a valid email address.";

      toast.error(message);
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
              <div className="flex flex-col items-center text-center space-y-4 mb-10">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-2xl shadow-zinc-900/20 group hover:scale-105 transition-all duration-500">
                  <Command className="w-8 h-8 text-white transition-transform group-hover:rotate-12" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-display">Orivo CRM</h1>
                  <p className="text-sm text-zinc-500 font-medium tracking-tight">The Neural Engine for Your Enterprise</p>
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
              {isLogin ? (
                <>
                  <div className="space-y-2">
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                      <Input 
                        type="email" 
                        placeholder="Email Address" 
                        className="pl-10 rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white transition-all h-12"
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
                        className="pl-10 rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white transition-all h-12"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className={cn("h-1.5 flex-1 rounded-full transition-all", signUpStep >= 1 ? "bg-zinc-900" : "bg-zinc-100")} />
                    <div className={cn("h-1.5 flex-1 rounded-full transition-all", signUpStep >= 2 ? "bg-zinc-900" : "bg-zinc-100")} />
                  </div>

                  {signUpStep === 1 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Login Credentials</Label>
                        <Input 
                          type="email" 
                          placeholder="Your Email" 
                          className="rounded-xl border-zinc-200 bg-zinc-50/50 h-12 font-medium"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Input 
                          type="password" 
                          placeholder="Create Password" 
                          className="rounded-xl border-zinc-200 bg-zinc-50/50 h-12 font-medium"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Enterprise Details</Label>
                        <Input 
                          type="text" 
                          placeholder="Your Full Name" 
                          className="rounded-xl border-zinc-200 bg-zinc-50/50 h-12 font-medium"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Input 
                          type="text" 
                          placeholder="Enterprise Name" 
                          className="rounded-xl border-zinc-200 bg-zinc-50/50 h-12 font-medium"
                          value={enterprise}
                          onChange={(e) => setEnterprise(e.target.value)}
                          required
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSignUpStep(1)}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        Back to step 1
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 font-bold shadow-xl shadow-zinc-900/10 transition-all active:scale-[0.98] mt-2 group"
                disabled={loading}
              >
                {loading ? "Processing..." : (
                  isLogin ? "Access Dashboard" : (signUpStep === 1 ? "Next: Business Profile" : "Establish Enterprise")
                )}
                {!loading && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
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

              <Button 
                variant="outline" 
                className="rounded-xl border-zinc-200 h-12 font-bold hover:bg-zinc-50 transition-all active:scale-[0.98] w-full"
                onClick={handleGoogleLogin}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </Button>

              <Button 
                variant="outline" 
                className="rounded-xl border-zinc-200 h-12 font-bold hover:bg-zinc-50 transition-all active:scale-[0.98] w-full mt-4"
                onClick={() => toast.info("Microsoft login setup is pending.")}
              >
                <div className="w-5 h-5 mr-3 flex items-center justify-center">
                   <div className="grid grid-cols-2 gap-[2px]">
                      <div className="w-2 h-2 bg-[#f25022]" />
                      <div className="w-2 h-2 bg-[#7fba00]" />
                      <div className="w-2 h-2 bg-[#00a4ef]" />
                      <div className="w-2 h-2 bg-[#ffb900]" />
                   </div>
                </div>
                Microsoft Office 365
              </Button>

            <div className="text-center pt-4">
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setSignUpStep(1);
                }}
                className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                {isLogin ? "New here? Create your Enterprise Account" : "Back to simple sign in"}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-zinc-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">AI-Powered Orivo CRM</span>
          </div>
          
          <button 
            onClick={() => {
              import("@/lib/auth-mock").then(m => m.setMockUser());
            }}
            className="text-[10px] text-zinc-300 hover:text-zinc-500 underline uppercase tracking-widest font-medium transition-colors"
          >
            Developer Bypass (Mock Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
