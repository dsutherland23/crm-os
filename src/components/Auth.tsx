import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth, db, doc, setDoc, getDoc } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  Sparkles,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  User,
  Check,
  ChevronLeft,
  Shield,
  Zap,
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { CpuArchitecture } from "@/components/ui/cpu-architecture";

// ─── Password strength ──────────────────────────────────────────────
function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Too weak", color: "bg-rose-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-amber-400" };
  if (score === 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

// ─── Slug generation ────────────────────────────────────────────────
function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Floating stat card ─────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, delay = 0 }: { icon: React.ElementType; value: string; label: string; delay?: number }) {
  return (
    <div
      className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-xl"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-black text-white leading-none">{value}</p>
        <p className="text-[10px] text-white/60 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

const INDUSTRIES = [
  "Retail & Commerce",
  "Healthcare & Dental",
  "Food & Beverage",
  "Real Estate",
  "Financial Services",
  "Professional Services",
  "Manufacturing",
  "Education",
  "Technology",
  "Other",
];

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];

const STEP_META = [
  { label: "Access", desc: "Secure your account" },
  { label: "Profile", desc: "Who are you?" },
  { label: "Enterprise", desc: "Your organization" },
];

export default function Auth() {
  // Mode
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);

  // Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [enterpriseName, setEnterpriseName] = useState("");
  const [enterpriseSlug, setEnterpriseSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");

  // State
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Slug auto-generation
  useEffect(() => {
    if (!slugEdited && enterpriseName) {
      setEnterpriseSlug(toSlug(enterpriseName));
    }
  }, [enterpriseName, slugEdited]);

  const strength = getPasswordStrength(password);

  // ─── Validation ──────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
      if (!password || password.length < 6) errs.password = "Password must be at least 6 characters";
    }
    if (s === 2) {
      if (!fullName.trim()) errs.fullName = "Full name is required";
    }
    if (s === 3) {
      if (!enterpriseName.trim()) errs.enterpriseName = "Enterprise name is required";
      if (!enterpriseSlug.trim()) errs.enterpriseSlug = "Slug is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Google Auth ─────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        const emailSlug = user.email?.split("@")[0].replace(/[^a-zA-Z0-9]/g, "-") || user.uid.substring(0, 8);
        const defaultEnterpriseId = `ent-${emailSlug}`;
        await setDoc(userDocRef, {
          fullName: user.displayName || emailSlug,
          email: user.email,
          enterprise_id: defaultEnterpriseId,
          enterpriseName: `${user.displayName || emailSlug}'s Organization`,
          role: "Owner",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, "enterprise_settings", defaultEnterpriseId), {
          enterpriseName: `${user.displayName || emailSlug}'s Organization`,
          setupCompleted: true,
          enterprise_id: defaultEnterpriseId,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }
      toast.success("Welcome to Orivo CRM");
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      if (error.code === "auth/popup-blocked") toast.error("Popup blocked. Please allow popups for this site.");
      else toast.error(error.message);
    }
  };

  // ─── Email Sign-in ───────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1)) return;
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, "users", cred.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        const defaultId = `ent-${email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "-")}`;
        await setDoc(userDocRef, {
          fullName: email.split("@")[0],
          email,
          enterprise_id: defaultId,
          enterpriseName: "My Organization",
          role: "Owner",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, "enterprise_settings", defaultId), { enterpriseName: "My Organization", enterprise_id: defaultId, setupCompleted: true }, { merge: true });
      }
      toast.success("Welcome back!");
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      let msg = error.message;
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") msg = "Invalid email or password.";
      if (error.code === "auth/user-not-found") msg = "No account found with this email.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Email Sign-up ───────────────────────────────────────────────
  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) {
      toast.error("Please fill in all required fields to continue.");
      return;
    }
    if (step < 3) { setStep(step + 1); return; }
    
    // Final step — create account
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const finalId = enterpriseSlug || toSlug(enterpriseName) || `ent-${user.uid.substring(0, 8)}`;
      
      // 2026 Best Practice: Show "Provisioning" state while backend operations finish
      // The use of onSnapshot in App.tsx will automatically bridge the navigation
      // as soon as the Firestore writes below are committed.
      
      await setDoc(doc(db, "users", user.uid), {
        fullName,
        email,
        enterprise_id: finalId,
        enterpriseName,
        industry,
        teamSize,
        role: "Owner",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });
      
      await setDoc(doc(db, "enterprise_settings", finalId), {
        enterpriseName,
        industry,
        teamSize,
        enterprise_id: finalId,
        setupCompleted: true,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // send email verification
      await sendEmailVerification(user);
      
      setDone(true);
      setVerificationSent(true);
      toast.success("Enterprise configured successfully!");
    } catch (error: any) {
      let msg = error.message;
      if (error.code === "auth/email-already-in-use") msg = "This email is already registered. Sign in instead.";
      if (error.code === "auth/weak-password") msg = "Password is too weak. Use at least 6 characters.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Success / Verification Screen ───────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-zinc-950" />
        {/* Animated orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md space-y-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30">
            <Mail className="w-10 h-10 text-white" />
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Check your inbox 📬
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed">
              We sent a verification link to{" "}
              <span className="text-white font-bold">{email}</span>.
              <br />
              Click the link in that email to activate your enterprise workspace.
            </p>
          </div>

          {/* Steps */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 text-left">
            {[
              { n: "1", text: "Open the email from Orivo CRM" },
              { n: "2", text: "Click \"Verify my email\" in the message" },
              { n: "3", text: "Come back here and sign in" },
            ].map((step) => (
              <div key={step.n} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {step.n}
                </div>
                <span className="text-zinc-300 text-sm font-medium">{step.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              className="w-full h-14 rounded-2xl bg-white text-zinc-900 font-black text-base hover:bg-zinc-100 transition-all shadow-xl"
              onClick={() => {
                setDone(false);
                setStep(1);
                setIsLogin(true);
              }}
            >
              I verified my email — Sign In
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <button
              type="button"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
              onClick={async () => {
                try {
                  const user = (await import("firebase/auth")).getAuth().currentUser;
                  if (user) {
                    await (await import("firebase/auth")).sendEmailVerification(user);
                    toast.success("Verification email resent!");
                  }
                } catch {
                  toast.error("Couldn't resend. Try again in a minute.");
                }
              }}
            >
              Didn't get it? <span className="underline underline-offset-4">Resend email</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── LEFT: Brand Panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] bg-zinc-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-blue-600/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Command className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">Orivo CRM</span>
          <span className="ml-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">2026</span>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-[10px] font-bold text-white/70 uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-blue-400" />
              AI-Native Enterprise Platform
            </div>
            <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
              The CRM that<br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
                thinks ahead.
              </span>
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-sm">
              Unified intelligence across sales, inventory, revenue, and operations — built for modern enterprises.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2">
            {["Real-time Analytics", "AI Insights", "Multi-branch", "Invoice Engine", "POS System"].map(f => (
              <span key={f} className="text-[11px] font-bold text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                {f}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users} value="500+" label="Enterprises Onboarded" delay={0} />
            <StatCard icon={BarChart3} value="99.9%" label="Uptime SLA" delay={100} />
            <StatCard icon={Zap} value="< 200ms" label="Avg. Response Time" delay={200} />
            <StatCard icon={Shield} value="SOC 2" label="Compliant & Encrypted" delay={300} />
          </div>
        </div>

        {/* Bottom trust */}
        <div className="relative z-10 flex items-center gap-6 text-zinc-600 text-xs font-medium">
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> 256-bit AES</span>
          <span>·</span>
          <span>GDPR Ready</span>
          <span>·</span>
          <span>SOC 2 Type II</span>
          <span>·</span>
          <span>ISO 27001</span>
        </div>
      </div>

      {/* ── RIGHT: Auth Panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-zinc-50 relative">
        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />

        <div className="w-full max-w-[420px] relative z-10 space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Command className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg text-zinc-900">Orivo CRM</span>
          </div>

          {/* Header */}
          <div className="space-y-6 text-center pb-8">
            <div className="w-full flex items-center justify-center relative h-64 -mt-16 -mb-6">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none transform scale-125 md:scale-150">
                <CpuArchitecture 
                  width="400" 
                  height="200" 
                  text="CRM"
                  className="text-zinc-400/40 dark:text-zinc-700/40 opacity-80" 
                />
              </div>
            </div>
            <div className="space-y-3 relative z-10">
              <h1 className="text-4xl sm:text-5xl font-black text-zinc-900 tracking-tight leading-none uppercase">
                {isLogin ? "Welcome back" : STEP_META[step - 1].label}
              </h1>
              <p className="text-zinc-500 text-sm font-medium">
                {isLogin
                  ? "Sign in to access your enterprise dashboard."
                  : STEP_META[step - 1].desc}
              </p>
            </div>
          </div>

          {/* Signup step indicator */}
          {!isLogin && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {STEP_META.map((s, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all",
                        i + 1 < step ? "bg-emerald-500 text-white" :
                        i + 1 === step ? "bg-zinc-900 text-white" :
                        "bg-zinc-200 text-zinc-400"
                      )}>
                        {i + 1 < step ? <Check className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors hidden sm:block", i + 1 === step ? "text-zinc-900" : "text-zinc-400")}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEP_META.length - 1 && (
                      <div className={cn("flex-1 h-[2px] rounded-full transition-all", i + 1 < step ? "bg-emerald-500" : "bg-zinc-200")} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── SIGN-IN FORM ── */}
          {isLogin ? (
            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    className={cn("pl-10 h-12 rounded-xl bg-white border-zinc-200 font-medium transition-all focus-visible:ring-2 focus-visible:ring-zinc-900/10", errors.email && "border-rose-400 focus-visible:ring-rose-400/20")}
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                  <button type="button" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={cn("pl-10 pr-10 h-12 rounded-xl bg-white border-zinc-200 font-medium transition-all focus-visible:ring-2 focus-visible:ring-zinc-900/10", errors.password && "border-rose-400")}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.password}</p>}
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all group">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Access Dashboard
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200" /></div>
                <div className="relative flex justify-center"><span className="bg-zinc-50 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em]">or continue with</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={handleGoogleLogin} className="h-11 rounded-xl border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50 transition-all">
                  <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </Button>
                <Button type="button" variant="outline" onClick={() => toast.info("Microsoft SSO coming soon.")} className="h-11 rounded-xl border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50 transition-all">
                  <div className="grid grid-cols-2 gap-[2px] w-4 h-4 mr-2 shrink-0">
                    <div className="bg-[#f25022]" /><div className="bg-[#7fba00]" />
                    <div className="bg-[#00a4ef]" /><div className="bg-[#ffb900]" />
                  </div>
                  Microsoft
                </Button>
              </div>
            </form>
          ) : (
            /* ── SIGN-UP WIZARD ── */
            <form onSubmit={handleNextStep} className="space-y-5" noValidate>

              {/* Step 1: Credentials */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Work Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                      <Input
                        type="email"
                        placeholder="you@company.com"
                        className={cn("pl-10 h-12 rounded-xl bg-white border-zinc-200 font-medium", errors.email && "border-rose-400")}
                        value={email}
                        onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                        autoComplete="email"
                      />
                      {email && !errors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                        <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    {errors.email && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        className={cn("pl-10 pr-10 h-12 rounded-xl bg-white border-zinc-200 font-medium", errors.password && "border-rose-400")}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {password && (
                      <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300", i <= strength.score ? strength.color : "bg-zinc-100")} />
                          ))}
                        </div>
                        <p className={cn("text-[11px] font-bold pl-0.5", strength.score <= 1 ? "text-rose-500" : strength.score <= 2 ? "text-amber-500" : strength.score <= 3 ? "text-blue-500" : "text-emerald-500")}>
                          {strength.label}
                        </p>
                      </div>
                    )}
                    {errors.password && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.password}</p>}
                  </div>

                  <div className="pt-1">
                    <Button type="button" variant="outline" onClick={handleGoogleLogin} className="w-full h-11 rounded-xl border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50">
                      <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Continue with Google instead
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Profile */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                      <Input
                        type="text"
                        placeholder="Jane Doe"
                        className={cn("pl-10 h-12 rounded-xl bg-white border-zinc-200 font-medium", errors.fullName && "border-rose-400")}
                        value={fullName}
                        onChange={e => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: "" })); }}
                        autoFocus
                      />
                      {fullName.trim().length >= 2 && (
                        <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    {errors.fullName && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Your Industry</label>
                    <div className="grid grid-cols-2 gap-2">
                      {INDUSTRIES.map(ind => (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => setIndustry(ind)}
                          className={cn(
                            "text-left px-3 py-2.5 rounded-xl border text-xs font-bold transition-all",
                            industry === ind
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                          )}
                        >
                          {ind}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Enterprise */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Enterprise Name</label>
                    <div className="relative group">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                      <Input
                        type="text"
                        placeholder="Acme Corporation"
                        className={cn("pl-10 h-12 rounded-xl bg-white border-zinc-200 font-medium", errors.enterpriseName && "border-rose-400")}
                        value={enterpriseName}
                        onChange={e => { setEnterpriseName(e.target.value); setErrors(p => ({ ...p, enterpriseName: "" })); }}
                        autoFocus
                      />
                    </div>
                    {errors.enterpriseName && <p className="text-[11px] text-rose-500 font-medium pl-1">{errors.enterpriseName}</p>}
                  </div>

                  {/* Slug */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Enterprise ID (slug)</label>
                    <div className="flex items-center rounded-xl border border-zinc-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-zinc-900/10">
                      <span className="pl-4 text-xs font-bold text-zinc-400 select-none shrink-0">orivo.io/</span>
                      <input
                        type="text"
                        className="flex-1 h-12 px-2 bg-transparent text-sm font-bold text-zinc-900 outline-none"
                        value={enterpriseSlug}
                        onChange={e => { setEnterpriseSlug(toSlug(e.target.value)); setSlugEdited(true); }}
                        placeholder="acme-corporation"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-1">This is your unique workspace identifier. Cannot be changed later.</p>
                  </div>

                  {/* Team size */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Team Size</label>
                    <div className="flex flex-wrap gap-2">
                      {TEAM_SIZES.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setTeamSize(size)}
                          className={cn(
                            "px-4 py-2 rounded-xl border text-xs font-bold transition-all",
                            teamSize === size
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center gap-3 pt-1">
                {step > 1 && (
                  <Button type="button" variant="outline" className="h-12 rounded-xl border-zinc-200 font-bold text-zinc-600 hover:bg-zinc-100 px-4" onClick={() => setStep(step - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 hover:scale-[1.01] active:scale-[0.99] transition-all group">
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : step < 3 ? (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  ) : (
                    <>
                      Launch Enterprise
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Switch mode */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep(1); setErrors({}); }}
              className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
            >
              {isLogin ? (
                <span>Don't have an account? <span className="font-bold text-zinc-900 underline underline-offset-2">Create one free</span></span>
              ) : (
                <span>Already have an account? <span className="font-bold text-zinc-900 underline underline-offset-2">Sign in</span></span>
              )}
            </button>
          </div>

          {/* Trust footer */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SOC 2</span>
              <span>·</span>
              <span>GDPR</span>
              <span>·</span>
              <span>256-bit AES</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => import("@/lib/auth-mock").then(m => m.setMockUser())}
                className="text-zinc-300 hover:text-zinc-500 transition-colors"
              >
                Dev Bypass
              </button>
            </div>
            
            <div className="text-center">
              <a 
                href="https://www.instagram.com/socialkon10_cre8tive/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-zinc-300 hover:text-zinc-500 transition-colors uppercase tracking-[0.15em]"
              >
                created by <span className="text-zinc-400">Socialkon10 Marketing</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
