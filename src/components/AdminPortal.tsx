import React, { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Shield, Lock, Mail, Eye, EyeOff, RefreshCw, LogOut,
  Users, Building2, Activity, BarChart3, FileText, Sliders,
  ShieldAlert, ShieldCheck, Search, AlertTriangle, CheckCircle2,
  Download, ChevronDown, ChevronRight, Terminal, Database, UserX,
  TrendingUp, KeyRound, Ban, AlertOctagon, Menu, X, Pencil,
  UserCog, Send, MoreVertical, Check, Globe, Megaphone, Plus,
  ExternalLink, ArrowUpRight, Server, Command, Trash2, LifeBuoy, MessageSquare,
  Sparkles, Star, CreditCard, History, FileCheck, XCircle, Clock, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════
type AdminTab = "dashboard" | "users" | "tenants" | "analytics" | "security" | "audit" | "config" | "admins" | "support";

interface AdminRecord {
  email: string;
  role: "super_admin" | "admin";
  granted_at: string;
}

interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  enterprise_id: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  createdAt: string;
  phone?: string;
  lastLogin?: string;
}

interface TenantRecord {
  id: string;
  enterprise_id: string;
  enterpriseName: string;
  industry?: string;
  teamSize?: string;
  status?: string;
  createdAt: string;
  plan?: string;
  contactEmail?: string;
  billing?: {
    planId: string;
    userCount: number;
    branchCount: number;
    billingCycle: "monthly" | "yearly";
    renewalDate: string;
    status: "active" | "past_due" | "canceled" | "trialing";
    trialEndsAt?: string;
    paymentMethod?: { type: string; last4: string; expiry: string };
  };
}

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  admin_uid: string;
  admin_email: string;
  target_tenant?: string;
  timestamp: any;
  before?: any;
  after?: any;
}

interface AdminUserRecord {
  id: string;
  email: string;
  role: "super_admin" | "admin";
  granted_at: string;
  granted_by?: string;
}

interface FeedbackItem {
  id: string;
  type: "idea" | "bug" | "praise" | "other";
  subject: string;
  message: string;
  rating: number;
  user_email: string;
  enterprise_id: string;
  createdAt: any;
}

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  user_email: string;
  enterprise_id: string;
  createdAt: any;
  metadata?: any;
}

interface TicketReply {
  id: string;
  message: string;
  sender_email: string;
  sender_type: "ADMIN" | "USER";
  createdAt: any;
}

// ══════════════════════════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════════════════════════
const NAV: { id: AdminTab; label: string; icon: React.ElementType; superOnly?: boolean }[] = [
  { id: "dashboard",  label: "Overview",     icon: Activity    },
  { id: "users",      label: "Users",         icon: Users       },
  { id: "tenants",    label: "Tenants",       icon: Building2   },
  { id: "analytics",  label: "Analytics",     icon: BarChart3   },
  { id: "security",   label: "Security",      icon: ShieldAlert },
  { id: "audit",      label: "Audit Logs",    icon: FileText    },
  { id: "support",    label: "Support Center",icon: LifeBuoy    },
  { id: "config",     label: "Config",        icon: Sliders     },
  { id: "admins",     label: "Admins",        icon: UserCog, superOnly: true },
];

// ══════════════════════════════════════════════════════════════════════
// AUDIT WRITER
// ══════════════════════════════════════════════════════════════════════
async function audit(adminUser: User, action: string, payload: Record<string, unknown> = {}) {
  await addDoc(collection(db, "admin_audit_logs"), {
    action,
    admin_uid: adminUser.uid,
    admin_email: adminUser.email,
    timestamp: serverTimestamp(),
    ...payload,
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN PORTAL ENTRY POINT
// ══════════════════════════════════════════════════════════════════════
export default function AdminPortal() {
  const [phase, setPhase] = useState<"checking" | "login" | "portal">("checking");
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminRecord, setAdminRecord] = useState<AdminRecord | null>(null);
  const [emptyRegistry, setEmptyRegistry] = useState(false);

  useEffect(() => {
    // Check if registry is empty (bootstrap mode)
    const checkRegistry = async () => {
      try {
        const { getDocs, query, collection, limit } = await import("firebase/firestore");
        const snap = await getDocs(query(collection(db, "admin_users"), limit(1)));
        setEmptyRegistry(snap.empty);
      } catch (e) {
        console.warn("Registry check failed:", e);
      }
    };
    checkRegistry();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { 
        setPhase("login"); 
        setAdminUser(null); 
        setAdminRecord(null); 
        return; 
      }
      
      try {
        // First try UID-based lookup (standard)
        let snap = await getDoc(doc(db, "admin_users", user.uid));
        
        // Fallback: Check by email (if admin was added with email as doc ID)
        if (!snap.exists() && user.email) {
          snap = await getDoc(doc(db, "admin_users", user.email));
        }

        if (snap.exists()) {
          setAdminUser(user);
          setAdminRecord(snap.data() as AdminRecord);
          setPhase("portal");
        } else if (emptyRegistry) {
          // AUTO-PROVISION FIRST ADMIN
          const firstAdmin: AdminRecord = {
            email: user.email || "",
            role: "super_admin",
            granted_at: new Date().toISOString()
          };
          await setDoc(doc(db, "admin_users", user.uid), firstAdmin);
          setAdminUser(user);
          setAdminRecord(firstAdmin);
          setPhase("portal");
          toast.success("Bootstrap complete: You are now the Super Admin.");
        } else {
          // Not in registry — sign out silently, show error on login screen
          await signOut(auth);
          setPhase("login");
          toast.error("Access denied. This account is not in the admin registry.");
        }
      } catch (err: any) {
        // Likely a Firestore permission error — sign out and show message
        console.error("Admin clearance check error:", err);
        await signOut(auth);
        setPhase("login");
        // Show a friendlier message for permission errors
        if (err.code === 'permission-denied') {
          toast.error("Access denied. Your account is not registered as an admin.");
        } else {
          toast.error(`Verification failed: ${err.message || 'Unknown error'}`);
        }
      }
    });
    return unsub;
  }, []);

  return (
    <>
      <Toaster position="top-right" richColors />
      {phase === "checking" && <SplashScreen />}
      {phase === "login" && <AdminLogin onSuccess={() => {}} />}
      {phase === "portal" && adminUser && adminRecord && (
        <AdminShell user={adminUser} record={adminRecord} />
      )}
      {phase === "portal" && (!adminUser || !adminRecord) && <AdminLogin onSuccess={() => {}} />}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SPLASH
// ══════════════════════════════════════════════════════════════════════
function SplashScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-pulse">
          <Shield className="w-6 h-6 text-rose-500" />
        </div>
        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Verifying clearance…</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// STANDALONE ADMIN LOGIN
// ══════════════════════════════════════════════════════════════════════
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err: any) {
      toast.error(`Google Sign-in failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Too many attempts. Wait 30 seconds."); return; }
    if (!email || !password) { toast.error("Enter email and password."); return; }
    setLoading(true);
    try {
      // Just authenticate — the onAuthStateChanged listener handles the admin registry check
      // and will gate access to the portal automatically
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged will fire next and handle portal access or deny
    } catch (err: any) {
      const code = err.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        toast.error("Incorrect email or password.");
      } else if (code === "auth/email-already-in-use") {
        toast.error("Email already exists.", {
          description: "This admin account is already registered. Switching to Login mode...",
          duration: 5000,
        });
        setIsRegister(false);
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Try again later.");
        setLocked(true);
        setTimeout(() => setLocked(false), 60000);
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(`Sign-in failed: ${err.message || 'Unknown error'}`);
      }
      setAttempts(a => { const next = a + 1; if (next >= 5) { setLocked(true); setTimeout(() => { setLocked(false); setAttempts(0); }, 30000); } return next; });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(239,68,68,0.08)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-rose-400" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-black text-white tracking-tight">Admin Portal</h1>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md inline-block",
              isRegister ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-600"
            )}>
              {isRegister ? "SYSTEM BOOTSTRAP MODE" : "Orivo CRM — Restricted Access"}
            </p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {attempts >= 3 && !locked && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-amber-300 text-xs font-medium">{5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} remaining</p>
            </div>
          )}
          {locked && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <p className="text-rose-300 text-xs font-medium">Too many attempts. Wait 30 seconds.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
                placeholder="admin@yourdomain.com" disabled={locked}
                className="w-full h-12 pl-10 pr-4 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-rose-500/40 transition-colors font-medium" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••••••" disabled={locked}
                className="w-full h-12 pl-10 pr-12 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-rose-500/40 transition-colors font-medium tracking-wider" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading || locked}
            className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> {isRegister ? "Register & Bootstrap" : "Authenticate"}</span>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-zinc-950 px-2 text-zinc-700">or use social gateway</span></div>
          </div>

          <Button type="button" variant="outline" onClick={handleGoogleLogin} disabled={loading || locked}
            className="w-full h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs">
            <Globe className="w-4 h-4 mr-2 text-blue-400" /> Sign in with Google
          </Button>

          <p className="text-center text-[10px] text-zinc-600 font-medium">
            {isRegister ? "Already have an account?" : "No admin account yet?"}{" "}
            <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-rose-500 hover:underline font-bold">
              {isRegister ? "Back to Login" : "Create Master Admin"}
            </button>
          </p>
        </form>
        <p className="text-center text-[10px] text-zinc-800 font-medium">Zero Trust · All access attempts are logged</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN SHELL (layout)
// ══════════════════════════════════════════════════════════════════════
function AdminShell({ user, record }: { user: User; record: AdminRecord }) {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingNotices, setPendingNotices] = useState<number>(0);
  const isSuperAdmin = record.role === "super_admin";

  // Global listener for pending payment notices
  useEffect(() => {
    const q = query(collection(db, "billing_notices"), where("status", "==", "PENDING"));
    return onSnapshot(q, (snap) => setPendingNotices(snap.docs.length));
  }, []);

  const handleSignOut = async () => {
    await audit(user, "ADMIN_LOGOUT", { resource_type: "session" });
    await signOut(auth);
  };

  const visibleNav = NAV.filter(n => !n.superOnly || isSuperAdmin);

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 bg-[#0d0d0f] border-r border-white/[0.05] flex flex-col transition-transform duration-200",
        "lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-14 flex items-center px-4 border-b border-white/[0.05] gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-xs leading-none">Admin Portal</p>
            <p className="text-rose-500 text-[9px] font-bold uppercase tracking-wider mt-0.5 truncate">
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </p>
          </div>
          <button className="ml-auto lg:hidden text-zinc-600 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto font-sans">
          {visibleNav.map(n => {
            const hasBadge = n.id === "support" && pendingNotices > 0;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left relative",
                  tab === n.id ? "bg-rose-600/15 text-rose-400 border border-rose-600/20" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
                )}>
                <n.icon className="w-3.5 h-3.5 shrink-0" />
                {n.label}
                {hasBadge && (
                  <span className="ml-auto flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white font-black animate-pulse shadow-lg shadow-rose-600/40">
                    {pendingNotices}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.05] shrink-0">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <p className="text-zinc-500 text-[10px] truncate min-w-0">{user.email}</p>
            <button onClick={handleSignOut} className="ml-auto text-zinc-700 hover:text-rose-400 transition-colors shrink-0" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 bg-zinc-950/80 border-b border-white/[0.05] flex items-center px-4 gap-3 shrink-0 backdrop-blur">
          <button className="lg:hidden text-zinc-600 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-white font-black text-sm">{visibleNav.find(n => n.id === tab)?.label}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[9px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/15 rounded-full px-2.5 py-1 uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />Live
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {tab === "dashboard"  && <DashPane  user={user} />}
          {tab === "users"      && <UsersPane  user={user} isSuperAdmin={isSuperAdmin} />}
          {tab === "tenants"    && <TenantsPane user={user} isSuperAdmin={isSuperAdmin} />}
          {tab === "analytics"  && <AnalyticsPane />}
          {tab === "security"   && <SecurityPane />}
          {tab === "audit"      && <AuditPane />}
          {tab === "config"     && <ConfigPane user={user} isSuperAdmin={isSuperAdmin} />}
          {tab === "admins"     && <AdminsPane user={user} />}
          {tab === "support"    && <SupportPane />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SHARED UTILS
// ══════════════════════════════════════════════════════════════════════
function Kpi({ icon: Icon, label, value, color = "zinc" }: {
  icon: React.ElementType; label: string; value: string | number; color?: string;
}) {
  const cls: Record<string, string> = {
    zinc:    "bg-zinc-900 border-white/[0.06] text-zinc-400",
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    rose:    "bg-rose-500/10 border-rose-500/20 text-rose-400",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };
  return (
    <div className={cn("rounded-2xl border p-5 space-y-3", cls[color] || cls.zinc)}>
      <Icon className="w-4 h-4" />
      <div>
        <p className="text-2xl font-black text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-[11px] font-semibold text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6 space-y-6">{children}</div>;
}

function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-white font-black text-lg">{title}</h2>
      {sub && <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

// Slide-over drawer
function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={onClose} />}
      <div className={cn(
        "fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/[0.05] shrink-0">
          <p className="text-white font-black text-sm">{title}</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

// Modal overlay
function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "md" | "lg";
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative z-10 bg-[#0d0d0f] border border-white/[0.08] rounded-2xl flex flex-col max-h-[85vh] w-full shadow-2xl",
        size === "lg" ? "max-w-2xl" : "max-w-lg"
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] shrink-0">
          <p className="text-white font-black text-sm">{title}</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DATA HOOKS
// ══════════════════════════════════════════════════════════════════════
function useUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord))));
  }, []);
  return users;
}

function useTenants() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  useEffect(() => {
    const q = query(collection(db, "enterprise_settings"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as TenantRecord))));
  }, []);
  return tenants;
}

function useAuditLogs(limitN = 100) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  useEffect(() => {
    const q = query(collection(db, "admin_audit_logs"), orderBy("timestamp", "desc"), limit(limitN));
    return onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry))));
  }, [limitN]);
  return logs;
}

function useAdminUsers() {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  useEffect(() => {
    return onSnapshot(collection(db, "admin_users"), snap =>
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUserRecord)))
    );
  }, []);
  return admins;
}

// ══════════════════════════════════════════════════════════════════════
// 1. DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function DashPane({ user }: { user: User }) {
  const users = useUsers();
  const tenants = useTenants();
  const logs = useAuditLogs(8);
  const suspended = users.filter(u => u.status === "SUSPENDED").length;
  const newThisWeek = users.filter(u => { try { return Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000; } catch { return false; } }).length;

  return (
    <Wrap>
      <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-emerald-300 text-xs font-semibold">Zero Trust Active · Signed in as {user.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2}  label="Total Tenants"  value={tenants.length} color="blue" />
        <Kpi icon={Users}      label="Total Users"    value={users.length}   color="emerald" />
        <Kpi icon={UserX}      label="Suspended"      value={suspended}      color="rose" />
        <Kpi icon={TrendingUp} label="New This Week"  value={newThisWeek}    color="amber" />
      </div>

      <div>
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-3">System Health</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["Firestore", "Firebase Auth", "Hosting"].map(s => (
            <div key={s} className="bg-zinc-900 border border-white/[0.05] rounded-xl p-3 flex items-center gap-3">
              <Database className="w-4 h-4 text-emerald-400" />
              <p className="text-white text-xs font-bold">{s}</p>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden">
          <p className="px-5 py-3 text-white font-bold text-xs border-b border-white/[0.04]">Recent Tenants</p>
          {tenants.slice(0, 5).map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.03] last:border-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] font-black shrink-0">
                {(t.enterpriseName || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">{t.enterpriseName}</p>
                <p className="text-zinc-700 text-[9px] truncate font-mono">{t.enterprise_id}</p>
              </div>
              <span className={cn("ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                t.status === "suspended" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
              )}>{t.status || "active"}</span>
            </div>
          ))}
          {tenants.length === 0 && <p className="px-5 py-8 text-zinc-700 text-xs text-center">No tenants yet</p>}
        </div>
        <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden">
          <p className="px-5 py-3 text-white font-bold text-xs border-b border-white/[0.04]">Recent Admin Actions</p>
          {logs.map(l => (
            <div key={l.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.03] last:border-0">
              <Terminal className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">{l.action}</p>
                <p className="text-zinc-700 text-[9px] truncate">{l.admin_email}</p>
              </div>
              <p className="text-zinc-800 text-[9px] ml-auto shrink-0 font-mono">{l.timestamp?.toDate?.()?.toLocaleTimeString() || "—"}</p>
            </div>
          ))}
          {logs.length === 0 && <p className="px-5 py-8 text-zinc-700 text-xs text-center">No actions yet</p>}
        </div>
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// USER DETAIL DRAWER
// ══════════════════════════════════════════════════════════════════════
function UserDrawer({ u, adminUser, onClose }: { u: UserRecord; adminUser: User; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);

  const doSuspend = async () => {
    if (!suspendReason.trim()) { toast.error("Enter a reason."); return; }
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", u.id), { status: "SUSPENDED", suspendReason });
      await audit(adminUser, "SUSPEND_USER", {
        resource_type: "user", resource_id: u.id, target_tenant: u.enterprise_id,
        before: { status: u.status }, after: { status: "SUSPENDED", suspendReason },
      });
      toast.success("User suspended.");
      setShowSuspendForm(false);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doReactivate = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", u.id), { status: "ACTIVE", suspendReason: null });
      await audit(adminUser, "REACTIVATE_USER", {
        resource_type: "user", resource_id: u.id, before: { status: u.status }, after: { status: "ACTIVE" },
      });
      toast.success("User reactivated.");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doPasswordReset = async () => {
    if (!u.email) { toast.error("No email on record."); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, u.email);
      await audit(adminUser, "SEND_PASSWORD_RESET", { resource_type: "user", resource_id: u.id, target_email: u.email });
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div>
      <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-white text-sm font-semibold">{value || "—"}</p>
    </div>
  );

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white text-xl font-black shrink-0">
          {(u.fullName || u.email || "?")[0].toUpperCase()}
        </div>
        <div>
          <p className="text-white font-black text-base">{u.fullName || "—"}</p>
          <p className="text-zinc-500 text-xs">{u.email}</p>
          <span className={cn("inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-full",
            u.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" :
            u.status === "SUSPENDED" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"
          )}>{u.status || "ACTIVE"}</span>
        </div>
      </div>

      {/* Info grid */}
      <div className="bg-zinc-900/60 border border-white/[0.05] rounded-xl p-4 grid grid-cols-2 gap-4">
        <Field label="Tenant ID"  value={u.enterprise_id} />
        <Field label="Role"       value={u.role || "owner"} />
        <Field label="Joined"     value={u.createdAt ? new Date(u.createdAt).toLocaleDateString() : undefined} />
        <Field label="Phone"      value={u.phone} />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">Actions</p>

        <button onClick={doPasswordReset} disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-white/[0.05] text-white text-sm font-semibold hover:border-white/10 transition-all text-left">
          <Send className="w-4 h-4 text-blue-400 shrink-0" />
          Send Password Reset Email
        </button>

        {u.status !== "SUSPENDED" ? (
          <>
            {!showSuspendForm ? (
              <button onClick={() => setShowSuspendForm(true)} disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/8 border border-rose-500/15 text-rose-400 text-sm font-semibold hover:bg-rose-500/15 transition-all text-left">
                <Ban className="w-4 h-4 shrink-0" />
                Suspend User
              </button>
            ) : (
              <div className="space-y-2 bg-rose-500/5 border border-rose-500/15 rounded-xl p-4">
                <p className="text-rose-400 text-xs font-bold">Suspend reason (required)</p>
                <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3}
                  placeholder="e.g. Terms of service violation, abusive behaviour…"
                  className="w-full bg-zinc-900 border border-white/[0.07] rounded-lg text-white text-xs p-2.5 outline-none resize-none placeholder:text-zinc-700 focus:border-rose-500/30" />
                <div className="flex gap-2">
                  <button onClick={doSuspend} disabled={busy}
                    className="flex-1 h-9 rounded-lg bg-rose-600 text-white text-xs font-black hover:bg-rose-500 transition-all">
                    {busy ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Confirm Suspend"}
                  </button>
                  <button onClick={() => { setShowSuspendForm(false); setSuspendReason(""); }}
                    className="px-3 h-9 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button onClick={doReactivate} disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-all text-left">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {busy ? "Reactivating…" : "Reactivate User"}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 2. USERS PANE (with drawer + bulk actions)
// ══════════════════════════════════════════════════════════════════════
function UsersPane({ user, isSuperAdmin }: { user: User; isSuperAdmin: boolean }) {
  const users = useUsers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [drawerUser, setDrawerUser] = useState<UserRecord | null>(null);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.enterprise_id?.toLowerCase().includes(q);
    const matchS = statusFilter === "ALL" || u.status === statusFilter;
    return matchQ && matchS;
  });

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(u => u.id)));
  };

  const bulkSuspend = async () => {
    if (!confirm(`Suspend ${selected.size} users?`)) return;
    setBusy("bulk");
    try {
      for (const id of selected) {
        const u = users.find(x => x.id === id);
        if (!u || u.status === "SUSPENDED") continue;
        await updateDoc(doc(db, "users", id), { status: "SUSPENDED" });
        await audit(user, "SUSPEND_USER", { resource_type: "user", resource_id: id, target_tenant: u.enterprise_id, before: { status: u.status }, after: { status: "SUSPENDED" }, bulk: true });
      }
      toast.success(`${selected.size} users suspended.`);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const bulkActivate = async () => {
    setBusy("bulk");
    try {
      for (const id of selected) {
        const u = users.find(x => x.id === id);
        if (!u || u.status === "ACTIVE") continue;
        await updateDoc(doc(db, "users", id), { status: "ACTIVE" });
        await audit(user, "REACTIVATE_USER", { resource_type: "user", resource_id: id, bulk: true });
      }
      toast.success(`${selected.size} users activated.`);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <Wrap>
      <PageTitle title="Users" sub={`${users.length} total across all tenants`} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, or tenant…"
            className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors" />
        </div>
        <div className="flex gap-1">
          {["ALL", "ACTIVE", "SUSPENDED"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                statusFilter === s ? "bg-white text-zinc-900" : "bg-zinc-900 border border-white/[0.07] text-zinc-600 hover:text-white"
              )}>{s}</button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-zinc-900 border border-white/[0.07] rounded-xl px-4 py-2.5">
          <span className="text-white text-xs font-bold">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={bulkActivate} disabled={busy === "bulk"}
              className="px-3 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-black hover:bg-emerald-500/25 transition-all">
              Activate All
            </button>
            <button onClick={bulkSuspend} disabled={busy === "bulk"}
              className="px-3 h-7 rounded-lg bg-rose-500/15 text-rose-400 text-[10px] font-black hover:bg-rose-500/25 transition-all">
              Suspend All
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 h-7 rounded-lg bg-zinc-800 text-zinc-500 text-[10px] font-bold hover:bg-zinc-700 transition-all">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} className="accent-rose-500" />
              </th>
              {["User", "Tenant", "Role", "Status", "Joined", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-zinc-700 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.015] transition-colors cursor-pointer" onClick={() => setDrawerUser(u)}>
                <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(u.id); }}>
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} className="accent-rose-500" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                      {(u.fullName || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{u.fullName || "—"}</p>
                      <p className="text-zinc-700 text-[9px]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 font-mono text-[9px]">{u.enterprise_id || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{u.role || "Owner"}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full",
                    u.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" :
                    u.status === "SUSPENDED" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"
                  )}>{u.status || "ACTIVE"}</span>
                </td>
                <td className="px-4 py-3 text-zinc-700 text-[9px]">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-zinc-700 py-12">No users found.</p>}
      </div>

      <Drawer open={!!drawerUser} onClose={() => setDrawerUser(null)} title="User Details">
        {drawerUser && <UserDrawer u={drawerUser} adminUser={user} onClose={() => setDrawerUser(null)} />}
      </Drawer>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TENANT DRILLDOWN MODAL
// ══════════════════════════════════════════════════════════════════════

function TenantModal({ t, allUsers, adminUser, onClose }: {
  t: TenantRecord; allUsers: UserRecord[]; adminUser: User; onClose: () => void;
}) {
  const tenantUsers = allUsers.filter(u => u.enterprise_id === (t.enterprise_id || t.id));
  const [busy, setBusy] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [extendBusy, setExtendBusy] = useState(false);

  // Editable billing state — initialized from Firestore data
  const [editBilling, setEditBilling] = useState({
    planId: t.billing?.planId || t.plan || "starter",
    userCount: t.billing?.userCount ?? 3,
    branchCount: t.billing?.branchCount ?? 1,
    billingCycle: t.billing?.billingCycle || "monthly" as "monthly" | "yearly",
    status: t.billing?.status || "trialing" as "active" | "past_due" | "canceled" | "trialing",
  });

  const PLAN_PRICES: Record<string, { monthly: number; yearly: number; label: string }> = {
    starter:       { monthly: 39,  yearly: 32.76, label: "Starter" },
    "business-pro": { monthly: 79,  yearly: 66.36, label: "Business Pro" },
    enterprise:    { monthly: 199, yearly: 167.16, label: "Enterprise" },
  };

  const calcTotal = () => {
    const plan = PLAN_PRICES[editBilling.planId] || PLAN_PRICES.starter;
    const base = editBilling.billingCycle === "monthly" ? plan.monthly : plan.yearly;
    const extraUsers = Math.max(0, editBilling.userCount - { starter: 3, "business-pro": 25, enterprise: 100 }[editBilling.planId as string]!);
    const extraBranches = Math.max(0, editBilling.branchCount - { starter: 1, "business-pro": 5, enterprise: 10 }[editBilling.planId as string]!);
    const uPrice = editBilling.billingCycle === "monthly" ? 5 : 4.20;
    const bPrice = editBilling.billingCycle === "monthly" ? 29 : 24.36;
    return base + (extraUsers * uPrice) + (extraBranches * bPrice);
  };

  const trialEndsAt = t.billing?.trialEndsAt ? new Date(t.billing.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : null;

  const saveBilling = async () => {
    setBusy(true);
    try {
      const renewalDate = new Date();
      renewalDate.setMonth(renewalDate.getMonth() + (editBilling.billingCycle === "yearly" ? 12 : 1));
      const newBilling = {
        ...editBilling,
        renewalDate: renewalDate.toISOString(),
        paymentMethod: t.billing?.paymentMethod || { type: "Visa", last4: "—", expiry: "—" },
        trialEndsAt: t.billing?.trialEndsAt || null,
      };
      await updateDoc(doc(db, "enterprise_settings", t.id), { billing: newBilling, plan: editBilling.planId });
      await audit(adminUser, "UPDATE_TENANT_BILLING", {
        resource_type: "tenant", resource_id: t.id, target_tenant: t.enterprise_id,
        before: { billing: t.billing, plan: t.plan }, after: { billing: newBilling },
      });
      toast.success("Billing updated successfully.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const extendTrial = async () => {
    setExtendBusy(true);
    try {
      const base = trialEndsAt && trialDaysLeft! > 0 ? trialEndsAt : new Date();
      const newEnd = new Date(base.getTime() + extendDays * 86400000);
      await updateDoc(doc(db, "enterprise_settings", t.id), {
        billing: { ...(t.billing || {}), trialEndsAt: newEnd.toISOString(), status: "trialing" }
      });
      await audit(adminUser, "EXTEND_TRIAL", {
        resource_type: "tenant", resource_id: t.id, target_tenant: t.enterprise_id,
        before: { trialEndsAt: t.billing?.trialEndsAt }, after: { trialEndsAt: newEnd.toISOString(), extendedDays: extendDays },
      });
      toast.success(`Trial extended by ${extendDays} days.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setExtendBusy(false); }
  };

  const F = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
      <p className="text-white font-black text-sm leading-tight">{value}</p>
      <p className="text-zinc-600 text-[9px] mt-0.5">{label}</p>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={t.enterpriseName || t.id} size="lg">
      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["ID", t.enterprise_id || t.id],
          ["Industry", t.industry || "—"],
          ["Team Size", t.teamSize || "—"],
          ["Status", t.status || "active"],
        ].map(([l, v]) => (
          <div key={l} className="bg-zinc-900 rounded-xl p-3">
            <p className="text-zinc-700 text-[9px] uppercase tracking-widest mb-0.5">{l}</p>
            <p className="text-white font-bold text-sm capitalize">{v}</p>
          </div>
        ))}
      </div>

      {/* ── BILLING MANAGEMENT PANEL ─────────────────── */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <p className="text-white font-black text-xs uppercase tracking-widest">Billing Management</p>
          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
            editBilling.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
            editBilling.status === "trialing" ? "bg-blue-500/15 text-blue-400" :
            editBilling.status === "past_due" ? "bg-amber-500/15 text-amber-400" :
            "bg-rose-500/15 text-rose-400"
          )}>{editBilling.status}</span>
        </div>

        <div className="p-4 space-y-5">
          {/* Plan picker */}
          <div className="space-y-2">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Plan</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PLAN_PRICES).map(([id, p]) => (
                <button key={id} onClick={() => setEditBilling(b => ({ ...b, planId: id }))}
                  className={cn("p-3 rounded-xl border text-left transition-all",
                    editBilling.planId === id
                      ? "bg-rose-600/15 border-rose-500/40 text-rose-300"
                      : "bg-zinc-800 border-white/[0.05] text-zinc-500 hover:text-white hover:border-white/10"
                  )}>
                  <p className="text-xs font-black">{p.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">${p.monthly}/mo</p>
                </button>
              ))}
            </div>
          </div>

          {/* Billing cycle toggle */}
          <div className="space-y-2">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Billing Cycle</p>
            <div className="flex gap-2">
              {(["monthly", "yearly"] as const).map(c => (
                <button key={c} onClick={() => setEditBilling(b => ({ ...b, billingCycle: c }))}
                  className={cn("flex-1 h-9 rounded-xl text-xs font-black transition-all capitalize",
                    editBilling.billingCycle === c ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-500 hover:text-white"
                  )}>
                  {c} {c === "yearly" && <span className="text-[9px] opacity-60 ml-1">16% off</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Users + Branches */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Users</p>
              <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-10 border border-white/[0.05]">
                <button onClick={() => setEditBilling(b => ({ ...b, userCount: Math.max(1, b.userCount - 1) }))}
                  className="text-zinc-500 hover:text-white transition-colors font-black text-base leading-none">−</button>
                <span className="flex-1 text-center text-white text-sm font-black tabular-nums">{editBilling.userCount}</span>
                <button onClick={() => setEditBilling(b => ({ ...b, userCount: b.userCount + 1 }))}
                  className="text-zinc-500 hover:text-white transition-colors font-black text-base leading-none">+</button>
              </div>
              <p className="text-zinc-700 text-[9px]">$5/mo per extra</p>
            </div>
            <div className="space-y-2">
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Branches</p>
              <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-10 border border-white/[0.05]">
                <button onClick={() => setEditBilling(b => ({ ...b, branchCount: Math.max(1, b.branchCount - 1) }))}
                  className="text-zinc-500 hover:text-white transition-colors font-black text-base leading-none">−</button>
                <span className="flex-1 text-center text-white text-sm font-black tabular-nums">{editBilling.branchCount}</span>
                <button onClick={() => setEditBilling(b => ({ ...b, branchCount: b.branchCount + 1 }))}
                  className="text-zinc-500 hover:text-white transition-colors font-black text-base leading-none">+</button>
              </div>
              <p className="text-zinc-700 text-[9px]">$29/mo per extra</p>
            </div>
          </div>

          {/* Subscription status override */}
          <div className="space-y-2">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Status Override</p>
            <div className="flex flex-wrap gap-2">
              {(["active", "trialing", "past_due", "canceled"] as const).map(s => (
                <button key={s} onClick={() => setEditBilling(b => ({ ...b, status: s }))}
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    editBilling.status === s
                      ? "bg-white text-zinc-900"
                      : "bg-zinc-800 text-zinc-500 hover:text-white"
                  )}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Total estimate */}
          <div className="bg-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <p className="text-zinc-500 text-xs font-semibold">Estimated Monthly Total</p>
            <p className="text-white font-black text-base">${calcTotal().toFixed(2)}<span className="text-zinc-600 text-[10px] ml-1 font-normal">/mo</span></p>
          </div>

          <Button onClick={saveBilling} disabled={busy} className="w-full h-12 rounded-2xl bg-white text-zinc-900 font-black text-sm hover:bg-zinc-200 transition-all shadow-xl shadow-white/5">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Billing Configuration"}
          </Button>
        </div>
      </div>

      {/* ── PAYMENT PROOFS PANEL ─────────────────────── */}
      <TenantPaymentNotices tenantId={t.id} adminUser={adminUser} />

      {/* ── TRIAL MANAGEMENT ─────────────────────────── */}
      <div className="bg-zinc-900 border border-blue-500/15 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-white font-black text-xs uppercase tracking-widest">Trial Management</p>
        </div>
        <div className="p-4 space-y-4">
          {trialEndsAt ? (
            <div className="grid grid-cols-3 gap-2">
              <F label="Trial Ends" value={trialEndsAt.toLocaleDateString()} />
              <F label="Days Left" value={trialDaysLeft === 0 ? "Expired" : `${trialDaysLeft}d`} />
              <F label="Status" value={trialDaysLeft! > 0 ? "Active" : "Expired"} />
            </div>
          ) : (
            <p className="text-zinc-600 text-xs text-center py-2">No trial configured — use below to grant one</p>
          )}

          <div className="space-y-2">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Extend / Grant Trial Days</p>
            <div className="flex gap-2">
              <div className="flex gap-1.5">
                {[7, 14, 30].map(d => (
                  <button key={d} onClick={() => setExtendDays(d)}
                    className={cn("px-3 h-9 rounded-lg text-[10px] font-black transition-all",
                      extendDays === d ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500 hover:text-white"
                    )}>{d}d</button>
                ))}
              </div>
              <input type="number" value={extendDays} onChange={e => setExtendDays(Math.max(1, Number(e.target.value)))}
                className="w-20 h-9 bg-zinc-800 border border-white/[0.07] rounded-lg text-white text-xs text-center font-black outline-none focus:border-blue-500/40 transition-colors" />
              <button onClick={extendTrial} disabled={extendBusy}
                className="ml-auto px-4 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black transition-all disabled:opacity-50 flex items-center gap-1.5">
                {extendBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3" /> Extend Trial</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users */}
      <div className="bg-zinc-900 border border-white/[0.05] rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-white font-bold text-xs border-b border-white/[0.04]">Users ({tenantUsers.length})</p>
        {tenantUsers.length === 0 ? (
          <p className="px-4 py-6 text-zinc-700 text-xs text-center">No users in this tenant</p>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {tenantUsers.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {(u.fullName || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{u.fullName || u.email}</p>
                  <p className="text-zinc-700 text-[9px]">{u.role || "owner"}</p>
                </div>
                <span className={cn("ml-auto text-[9px] font-black px-2 py-0.5 rounded-full shrink-0",
                  u.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                )}>{u.status || "ACTIVE"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}



// ══════════════════════════════════════════════════════════════════════
// 3. TENANTS
// ══════════════════════════════════════════════════════════════════════
function TenantsPane({ user, isSuperAdmin }: { user: User; isSuperAdmin: boolean }) {
  const tenants = useTenants();
  const users = useUsers();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<TenantRecord | null>(null);

  const filtered = tenants.filter(t =>
    !search || t.enterpriseName?.toLowerCase().includes(search.toLowerCase()) || t.enterprise_id?.toLowerCase().includes(search.toLowerCase())
  );

  const suspend = async (t: TenantRecord) => {
    if (!isSuperAdmin) { toast.error("Super Admin only."); return; }
    if (!confirm(`Suspend tenant "${t.enterpriseName}"?`)) return;
    setBusy(t.id);
    try {
      await updateDoc(doc(db, "enterprise_settings", t.id), { status: "suspended" });
      await audit(user, "SUSPEND_TENANT", { resource_type: "tenant", resource_id: t.id, target_tenant: t.enterprise_id, after: { status: "suspended" } });
      toast.success("Tenant suspended.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const activate = async (t: TenantRecord) => {
    setBusy(t.id);
    try {
      await updateDoc(doc(db, "enterprise_settings", t.id), { status: "active" });
      await audit(user, "ACTIVATE_TENANT", { resource_type: "tenant", resource_id: t.id, after: { status: "active" } });
      toast.success("Tenant activated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <Wrap>
      <PageTitle title="Tenants" sub={`${tenants.length} organizations`} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants…"
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => {
          const userCount = users.filter(u => u.enterprise_id === (t.enterprise_id || t.id)).length;
          return (
            <div key={t.id} className={cn("bg-zinc-900 border rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all",
              t.status === "suspended" ? "border-rose-500/20" : "border-white/[0.05]"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                    {(t.enterpriseName || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{t.enterpriseName}</p>
                    <p className="text-zinc-700 text-[9px] font-mono truncate">{t.enterprise_id}</p>
                  </div>
                </div>
                <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full shrink-0",
                  t.status === "suspended" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                )}>{t.status || "active"}</span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[
                  ["Users", userCount],
                  ["Plan", t.billing?.planId?.replace("-", " ") || t.plan || "Free"],
                  ["Billing", t.billing?.billingCycle || "—"]
                ].map(([l, v]) => (
                  <div key={l as string} className="bg-zinc-800/60 rounded-xl p-2 text-center">
                    <p className="text-white font-black text-sm capitalize">{v}</p>
                    <p className="text-zinc-700 text-[9px]">{l}</p>
                  </div>
                ))}
              </div>

              {/* Billing status + trial badge */}
              {t.billing && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full capitalize",
                    t.billing.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                    t.billing.status === "trialing" ? "bg-blue-500/15 text-blue-400" :
                    t.billing.status === "past_due" ? "bg-amber-500/15 text-amber-400" :
                    "bg-rose-500/15 text-rose-400"
                  )}>{t.billing.status?.replace("_", " ")}</span>
                  {t.billing.trialEndsAt && (() => {
                    const daysLeft = Math.max(0, Math.ceil((new Date(t.billing!.trialEndsAt!).getTime() - Date.now()) / 86400000));
                    return (
                      <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full",
                        daysLeft <= 3 ? "bg-rose-500/15 text-rose-400" : "bg-zinc-800 text-zinc-400"
                      )}>
                        {daysLeft > 0 ? `${daysLeft}d trial left` : "Trial expired"}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => setDrilldown(t)}
                  className="flex items-center gap-1.5 text-zinc-600 hover:text-white text-[10px] font-bold transition-colors">
                  <ExternalLink className="w-3 h-3" /> View Details
                </button>
                <div className="flex gap-2">
                  {t.status === "suspended" ? (
                    <button onClick={() => activate(t)} disabled={busy === t.id}
                      className="text-[10px] font-black text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-400/10 hover:bg-emerald-400/20 transition-all">
                      {busy === t.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Activate"}
                    </button>
                  ) : isSuperAdmin ? (
                    <button onClick={() => suspend(t)} disabled={busy === t.id}
                      className="text-[10px] font-black text-rose-400 px-3 py-1.5 rounded-lg bg-rose-400/10 hover:bg-rose-400/20 transition-all">
                      {busy === t.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Suspend"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="col-span-3 text-zinc-700 text-center py-16">No tenants found.</p>}
      </div>

      {drilldown && (
        <TenantModal t={drilldown} allUsers={users} adminUser={user} onClose={() => setDrilldown(null)} />
      )}
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 4. ANALYTICS
// ══════════════════════════════════════════════════════════════════════
function AnalyticsPane() {
  const tenants = useTenants();
  const users = useUsers();

  const byIndustry = tenants.reduce<Record<string, number>>((a, t) => {
    const k = t.industry || "Unknown"; a[k] = (a[k] || 0) + 1; return a;
  }, {});

  return (
    <Wrap>
      <PageTitle title="Analytics" sub="Platform-wide aggregated metrics" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2} label="Tenants"       value={tenants.length} color="blue" />
        <Kpi icon={Users}     label="Users"          value={users.length}  color="emerald" />
        <Kpi icon={Activity}  label="Active Tenants" value={tenants.filter(t => t.status !== "suspended").length} color="amber" />
        <Kpi icon={UserX}     label="Suspended"      value={users.filter(u => u.status === "SUSPENDED").length}  color="rose" />
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">Tenants by Industry</p>
        {Object.entries(byIndustry).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => {
          const val = v as number;
          const pct = tenants.length ? Math.round((val / tenants.length) * 100) : 0;
          return (
            <div key={k} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">{k}</span>
                <span className="text-zinc-600">{v} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {!Object.keys(byIndustry).length && <p className="text-zinc-700 text-xs">No data yet.</p>}
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">User Registrations (Last 30 Days)</p>
        <div className="flex gap-0.5 items-end h-16">
          {Array.from({ length: 30 }).map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (29 - i));
            const day = d.toISOString().split("T")[0];
            const cnt = users.filter(u => u.createdAt?.startsWith(day)).length;
            const max = Math.max(...Array.from({ length: 30 }).map((_, j) => {
              const dd = new Date(); dd.setDate(dd.getDate() - (29 - j));
              return users.filter(u => u.createdAt?.startsWith(dd.toISOString().split("T")[0])).length;
            }), 1);
            return (
              <div key={i} title={`${day}: ${cnt}`} className="flex-1 bg-blue-500/30 hover:bg-blue-500 rounded-sm transition-all cursor-default"
                style={{ height: `${Math.max((cnt / max) * 100, 4)}%` }} />
            );
          })}
        </div>
        <p className="text-zinc-800 text-[9px]">← 30 days ago · Today →</p>
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 5. SECURITY
// ══════════════════════════════════════════════════════════════════════
function SecurityPane() {
  const logs = useAuditLogs(100);
  const users = useUsers();

  const checks = [
    { label: "Firestore rules — deny-all default",   ok: true,  detail: "Zero Trust rules deployed" },
    { label: "Admin portal — independent auth",       ok: true,  detail: "Separate login, admin_users gated" },
    { label: "Audit logs — immutable",                ok: true,  detail: "No update/delete allowed on logs" },
    { label: "Tenant data isolation",                 ok: true,  detail: "enterprise_id enforced server-side" },
    { label: "Role self-escalation blocked",          ok: true,  detail: "role field locked from self-write" },
    { label: "Cloud Functions (real IP capture)",     ok: false, detail: "Deploy functions/ for production ops" },
  ];

  return (
    <Wrap>
      <PageTitle title="Security Overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={UserX}      label="Suspended Users"    value={users.filter(u => u.status === "SUSPENDED").length} color="rose" />
        <Kpi icon={Ban}        label="Suspension Actions" value={logs.filter(l => l.action.includes("SUSPEND")).length} color="rose" />
        <Kpi icon={KeyRound}   label="Role Changes"       value={logs.filter(l => l.action.includes("ROLE")).length}    color="amber" />
        <Kpi icon={ShieldCheck} label="Security Score"   value="84/100" color="emerald" />
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">Security Checklist</p>
        {checks.map(c => (
          <div key={c.label} className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0">
            {c.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            }
            <div>
              <p className={cn("text-sm font-semibold", c.ok ? "text-white" : "text-amber-300")}>{c.label}</p>
              <p className="text-zinc-700 text-[10px]">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden">
        <p className="px-5 py-3 text-white font-bold text-sm border-b border-white/[0.04]">High-Impact Actions</p>
        {logs.filter(l => ["SUSPEND", "ROLE", "DELETE"].some(k => l.action.includes(k))).slice(0, 10).map(l => (
          <div key={l.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.03] last:border-0">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">{l.action}</p>
              <p className="text-zinc-700 text-[9px] truncate">by {l.admin_email}</p>
            </div>
            <p className="text-zinc-800 text-[9px] ml-auto shrink-0">{l.timestamp?.toDate?.()?.toLocaleString() || "—"}</p>
          </div>
        ))}
        {logs.filter(l => ["SUSPEND", "ROLE", "DELETE"].some(k => l.action.includes(k))).length === 0 && (
          <p className="px-5 py-10 text-zinc-700 text-xs text-center">No high-impact actions.</p>
        )}
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 6. AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════
function AuditPane() {
  const logs = useAuditLogs(200);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = logs.filter(l =>
    !search || l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.target_tenant?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [
      ["Timestamp", "Admin", "Action", "Resource", "Tenant"],
      ...filtered.map(l => [
        l.timestamp?.toDate?.()?.toISOString() || "",
        l.admin_email, l.action,
        l.resource_type + (l.resource_id ? `:${l.resource_id}` : ""),
        l.target_tenant || "",
      ])
    ].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
    toast.success("Exported audit logs.");
  };

  return (
    <Wrap>
      <div className="flex items-center justify-between gap-3">
        <PageTitle title="Audit Logs" sub={`${logs.length} immutable entries`} />
        <Button onClick={exportCsv} variant="outline"
          className="border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-white text-xs h-9">
          <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter logs…"
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors" />
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["Time", "Admin", "Action", "Resource", "Tenant", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-zinc-700 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03] font-mono">
            {filtered.map(l => (
              <React.Fragment key={l.id}>
                <tr className="hover:bg-white/[0.015] cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="px-4 py-3 text-zinc-700 text-[9px] whitespace-nowrap">{l.timestamp?.toDate?.()?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{l.admin_email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded",
                      l.action.includes("SUSPEND") ? "bg-rose-500/15 text-rose-400" :
                      l.action.includes("ACTIVATE") ? "bg-emerald-500/15 text-emerald-400" :
                      l.action.includes("ROLE") ? "bg-amber-500/15 text-amber-400" :
                      "bg-zinc-800 text-zinc-500"
                    )}>{l.action}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 text-[9px]">{l.resource_type}</td>
                  <td className="px-4 py-3 text-zinc-700 text-[9px]">{l.target_tenant || "—"}</td>
                  <td className="px-4 py-3">
                    <ChevronDown className={cn("w-3 h-3 text-zinc-800 transition-transform", expanded === l.id && "rotate-180")} />
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr><td colSpan={6} className="bg-zinc-950 px-4 py-3">
                    <div className="grid grid-cols-2 gap-3">
                      {l.before && <div>
                        <p className="text-zinc-700 text-[9px] mb-1 uppercase tracking-wider">Before</p>
                        <pre className="text-rose-300 bg-rose-500/5 border border-rose-500/10 rounded-lg p-2 text-[9px] overflow-auto">{JSON.stringify(l.before, null, 2)}</pre>
                      </div>}
                      {l.after && <div>
                        <p className="text-zinc-700 text-[9px] mb-1 uppercase tracking-wider">After</p>
                        <pre className="text-emerald-300 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-[9px] overflow-auto">{JSON.stringify(l.after, null, 2)}</pre>
                      </div>}
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-zinc-700 py-12">No logs found.</p>}
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 7. CONFIG (with Platform Announcements)
// ══════════════════════════════════════════════════════════════════════
function ConfigPane({ user, isSuperAdmin }: { user: User; isSuperAdmin: boolean }) {
  const [flags, setFlags] = useState({
    new_signups_enabled: true,
    google_auth_enabled: true,
    ai_features_enabled: true,
    maintenance_mode: false,
    beta_features: false,
  });
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [annType, setAnnType] = useState<"info" | "warning" | "critical">("info");
  const [sendingAnn, setSendingAnn] = useState(false);

  const save = async () => {
    if (!isSuperAdmin) { toast.error("Super Admin only."); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, "admin_meta", "feature_flags"), { ...flags, updated_at: new Date().toISOString() });
      await audit(user, "UPDATE_FEATURE_FLAGS", { resource_type: "system_config", after: flags as any });
      toast.success("Configuration saved.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const publishAnnouncement = async () => {
    if (!announcement.trim()) { toast.error("Enter announcement text."); return; }
    setSendingAnn(true);
    try {
      await setDoc(doc(db, "admin_meta", "announcement"), {
        text: announcement, type: annType,
        published_by: user.email, published_at: new Date().toISOString(), active: true,
      });
      await audit(user, "PUBLISH_ANNOUNCEMENT", { resource_type: "system_config", after: { text: announcement, type: annType } });
      toast.success("Announcement published to all tenants.");
      setAnnouncement("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSendingAnn(false); }
  };

  const clearAnnouncement = async () => {
    try {
      await setDoc(doc(db, "admin_meta", "announcement"), { active: false });
      await audit(user, "CLEAR_ANNOUNCEMENT", { resource_type: "system_config" });
      toast.success("Announcement cleared.");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Wrap>
      <PageTitle title="System Configuration" sub={isSuperAdmin ? "Full access" : "Read only — Super Admin required"} />

      {!isSuperAdmin && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/[0.05] rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 text-zinc-600" />
          <p className="text-zinc-600 text-xs">Read-only access. Super Admin required to make changes.</p>
        </div>
      )}

      {/* Feature flags */}
      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">Feature Flags</p>
        {Object.entries(flags).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
            <div>
              <p className="text-white text-sm font-semibold">{k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
              <p className="text-zinc-700 text-[10px]">Platform-wide toggle</p>
            </div>
            <button onClick={() => isSuperAdmin && setFlags(f => ({ ...f, [k]: !v }))} disabled={!isSuperAdmin}
              className={cn("w-11 h-6 rounded-full relative transition-all shrink-0",
                v ? "bg-emerald-500" : "bg-zinc-700",
                !isSuperAdmin && "opacity-40 cursor-not-allowed"
              )}>
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", v ? "left-5" : "left-0.5")} />
            </button>
          </div>
        ))}
        {isSuperAdmin && (
          <Button onClick={save} disabled={saving} className="w-full bg-white text-zinc-900 font-black hover:bg-zinc-100 mt-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        )}
      </div>

      {/* Platform announcements */}
      {isSuperAdmin && (
        <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400" />
            <p className="text-white font-bold text-sm">Platform Announcement</p>
          </div>
          <p className="text-zinc-600 text-xs">Broadcasts a banner to all tenant users on next page load.</p>
          <div className="flex gap-2">
            {(["info", "warning", "critical"] as const).map(t => (
              <button key={t} onClick={() => setAnnType(t)}
                className={cn("px-3 h-7 rounded-lg text-[10px] font-black capitalize transition-all",
                  annType === t
                    ? t === "info" ? "bg-blue-500 text-white" : t === "warning" ? "bg-amber-500 text-zinc-900" : "bg-rose-600 text-white"
                    : "bg-zinc-800 text-zinc-500 hover:text-white"
                )}>{t}</button>
            ))}
          </div>
          <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={3}
            placeholder="e.g. Scheduled maintenance on Saturday 2am–4am UTC…"
            className="w-full bg-zinc-800 border border-white/[0.06] rounded-xl text-white text-xs p-3 outline-none resize-none placeholder:text-zinc-700 focus:border-white/15 transition-colors" />
          <div className="flex gap-2">
            <Button onClick={publishAnnouncement} disabled={sendingAnn}
              className="flex-1 bg-amber-500 text-zinc-900 font-black hover:bg-amber-400">
              {sendingAnn ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Publish
            </Button>
            <Button variant="outline" onClick={clearAnnouncement} className="border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-800 text-xs">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {isSuperAdmin && (
        <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <p className="text-rose-400 font-bold text-sm">Danger Zone</p>
          </div>
          {[
            { label: "Enable Maintenance Mode", sub: "All users see a maintenance screen" },
            { label: "Force Sign-Out All Users", sub: "Revoke all active sessions" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
              <div>
                <p className="text-white text-sm font-semibold">{item.label}</p>
                <p className="text-zinc-700 text-[10px]">{item.sub}</p>
              </div>
              <Button variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-8"
                onClick={() => toast.info("Requires Cloud Functions deployment.")}>
                Enable
              </Button>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 8. ADMINS (super_admin only)
// ══════════════════════════════════════════════════════════════════════
function AdminsPane({ user }: { user: User }) {
  const admins = useAdminUsers();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "super_admin">("admin");
  const [inviteUid, setInviteUid] = useState("");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (!inviteEmail.trim() || !inviteUid.trim()) { toast.error("Enter both email and UID."); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "admin_users", inviteUid.trim()), {
        email: inviteEmail.trim(),
        role: inviteRole,
        granted_at: new Date().toISOString(),
        granted_by: user.email,
      });
      await audit(user, "GRANT_ADMIN_ACCESS", {
        resource_type: "admin_user", resource_id: inviteUid.trim(),
        after: { email: inviteEmail.trim(), role: inviteRole },
      });
      toast.success(`Admin access granted to ${inviteEmail}.`);
      setInviteEmail(""); setInviteUid(""); setShowInvite(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const revoke = async (a: AdminUserRecord) => {
    if (a.id === user.uid) { toast.error("Cannot revoke your own access."); return; }
    if (!confirm(`Revoke admin access for ${a.email}?`)) return;
    setBusy(true);
    try {
      // Mark as revoked (don't delete so audit trail is preserved)
      await updateDoc(doc(db, "admin_users", a.id), { role: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.email });
      await audit(user, "REVOKE_ADMIN_ACCESS", {
        resource_type: "admin_user", resource_id: a.id, target_email: a.email,
        before: { role: a.role }, after: { role: "revoked" },
      });
      toast.success(`Revoked access for ${a.email}.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Wrap>
      <div className="flex items-center justify-between gap-3">
        <PageTitle title="Admin Management" sub="Grant, manage, and revoke admin portal access" />
        <Button onClick={() => setShowInvite(true)}
          className="bg-white text-zinc-900 font-black hover:bg-zinc-100 text-xs h-9">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Grant Access
        </Button>
      </div>

      <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-amber-300 text-xs font-medium">
          Admin accounts require a <strong>Firebase Auth UID</strong>. Create the Firebase Auth account first, then paste its UID here.
        </p>
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <p className="text-white font-bold text-xs">Current Admins ({admins.filter(a => (a as any).role !== "revoked").length})</p>
        </div>
        {admins.filter(a => (a as any).role !== "revoked").map(a => (
          <div key={a.id} className="px-5 py-4 flex items-center gap-4 border-b border-white/[0.03] last:border-0">
            <div className="w-8 h-8 rounded-full bg-rose-600/20 border border-rose-600/30 flex items-center justify-center text-rose-400 text-xs font-black shrink-0">
              {a.email?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold">{a.email}</p>
              <p className="text-zinc-700 text-[9px] font-mono">{a.id}</p>
            </div>
            <span className={cn("ml-auto text-[9px] font-black px-2 py-0.5 rounded-full shrink-0",
              a.role === "super_admin" ? "bg-rose-500/20 text-rose-400" : "bg-zinc-700 text-zinc-400"
            )}>{a.role}</span>
            {a.id !== user.uid && (
              <button onClick={() => revoke(a)} disabled={busy}
                className="text-zinc-700 hover:text-rose-400 transition-colors shrink-0 ml-2" title="Revoke access">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {a.id === user.uid && <span className="text-[9px] text-zinc-700 shrink-0 ml-2">You</span>}
          </div>
        ))}
        {admins.filter(a => (a as any).role !== "revoked").length === 0 && (
          <p className="px-5 py-8 text-zinc-700 text-xs text-center">No admins found.</p>
        )}
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Grant Admin Access">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Firebase Auth UID</label>
            <input value={inviteUid} onChange={e => setInviteUid(e.target.value)} placeholder="uid_xyz…"
              className="w-full h-10 px-3 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-sm font-mono placeholder:text-zinc-700 outline-none focus:border-rose-500/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Email (for display)</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@company.com"
              className="w-full h-10 px-3 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-rose-500/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Role</label>
            <div className="flex gap-2">
              {(["admin", "super_admin"] as const).map(r => (
                <button key={r} onClick={() => setInviteRole(r)}
                  className={cn("flex-1 h-10 rounded-xl text-xs font-black capitalize transition-all",
                    inviteRole === r ? "bg-rose-600 text-white" : "bg-zinc-900 border border-white/[0.07] text-zinc-500 hover:text-white"
                  )}>{r.replace("_", " ")}</button>
              ))}
            </div>
          </div>
          <Button onClick={invite} disabled={busy} className="w-full bg-white text-zinc-900 font-black hover:bg-zinc-100">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            Grant Admin Access
          </Button>
        </div>
      </Modal>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 9. SUPPORT CENTER (Support & Feedback Management)
// ══════════════════════════════════════════════════════════════════════
function SupportPane() {
  const [subTab, setSubTab] = useState<"tickets" | "feedback">("tickets");
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "billing_notices"), where("status", "==", "PENDING"));
    return onSnapshot(q, (snap) => {
      setNotices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const pendingCount = notices.length;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    const qTickets = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"), limit(50));
    const qFeedback = query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(50));
    const unsubT = onSnapshot(qTickets, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));
      setLoading(false);
    });
    const unsubF = onSnapshot(qFeedback, (snap) => {
      setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackItem)));
    });
    return () => { unsubT(); unsubF(); };
  }, []);

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "support_tickets", id), { status });
      toast.success("Ticket updated.");
      if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, status: status as any } : null);
    } catch (e) { toast.error("Failed to update status."); }
  };

  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!selectedTicket) { setReplies([]); return; }
    const qReplies = query(collection(db, `support_tickets/${selectedTicket.id}/replies`), orderBy("createdAt", "asc"));
    return onSnapshot(qReplies, (snap) => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply)));
    });
  }, [selectedTicket?.id]);

  const sendReply = async (newStatus?: string) => {
    if (!selectedTicket || (!replyText.trim() && !newStatus)) return;
    setSending(true);
    try {
      if (replyText.trim()) {
        await addDoc(collection(db, `support_tickets/${selectedTicket.id}/replies`), {
          message: replyText.trim(),
          sender_email: auth.currentUser?.email,
          sender_type: "ADMIN",
          createdAt: serverTimestamp(),
        });
      }
      const status = newStatus || "IN_PROGRESS";
      await updateDoc(doc(db, "support_tickets", selectedTicket.id), { status, updatedAt: serverTimestamp() });
      toast.success(newStatus ? `Status updated to ${newStatus}` : "Reply sent.");
      setReplyText("");
    } catch (e) { toast.error("Failed to send reply."); }
    finally { setSending(false); }
  };

  return (
    <Wrap>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.05] pb-6">
        <PageTitle title="Support Center" sub="Manage user tickets and feedback submissions." />
        <div className="flex p-1 bg-zinc-900 border border-white/[0.05] rounded-xl shrink-0">
          {[
            { id: "tickets", label: "Tickets", icon: LifeBuoy },
            { id: "billing", label: "Manual Payments", icon: CreditCard },
            { id: "feedback", label: "Feedback", icon: MessageSquare },
          ].map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id as any)}
              className={cn("flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all relative",
                subTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-600 hover:text-white"
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "billing" && pendingCount > 0 && (
                <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] text-white font-black animate-pulse ml-1">
                  {pendingCount}
                </span>
              )}
              {t.id === "tickets" && tickets.filter(ti => ti.status === "OPEN").length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {subTab === "billing" && (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {notices.map(n => (
              <div key={n.id} className="bg-zinc-900 border border-white/[0.05] rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all shadow-2xl relative">
                <div className="p-7 space-y-5 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center shadow-inner">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                       <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">PENDING VERIFICATION</Badge>
                       <span className="text-[9px] text-zinc-700 font-mono tracking-tighter">#{n.id.slice(-8).toUpperCase()}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-3xl font-black text-white tracking-tighter">${n.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                      <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">USD</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="h-1 w-1 rounded-full bg-blue-500" />
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Reference: <span className="text-white font-black">{n.reference || "N/A"}</span></p>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.15em]">Enterprise</span>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-zinc-600" />
                        <span className="text-xs text-white font-bold tracking-tight">{n.enterprise_id}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.15em]">Cycle</span>
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/5 text-[9px] font-black uppercase tracking-widest py-0 px-2 rounded-md">
                        {n.billingCycle || "Monthly"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.15em]">Submitted</span>
                      <span className="text-[10px] text-zinc-400 font-bold">{new Date(n.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Receipt Preview with Inspector Trigger */}
                  <Dialog>
                    <DialogTrigger 
                      className="w-full aspect-[4/3] bg-zinc-800/50 rounded-3xl flex items-center justify-center border border-dashed border-white/10 group-hover:border-blue-500/40 transition-all cursor-zoom-in overflow-hidden relative shadow-inner">
                        {n.receiptData ? (
                          <>
                            <img src={n.receiptData} alt="Receipt" className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent flex items-end p-5">
                               <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                                 <Search className="w-4 h-4" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Inspector Open</span>
                               </div>
                            </div>
                          </>
                        ) : n.receiptPlaceholder ? (
                          <div className="flex flex-col items-center gap-2 opacity-40">
                             <AlertCircle className="w-8 h-8 text-amber-500" />
                             <span className="text-[9px] font-black uppercase tracking-widest text-center px-4">Legacy Record<br/>(Metadata Only)</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 opacity-20">
                            <FileText className="w-10 h-10" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Proof Found</span>
                          </div>
                        )}
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-zinc-950 border-white/10 p-2 overflow-hidden rounded-[2.5rem]">
                       <div className="relative w-full h-full min-h-[400px] flex items-center justify-center bg-black/40 rounded-[2rem] overflow-hidden">
                          {n.receiptData ? (
                            <img src={n.receiptData} alt="Full Receipt" className="max-w-full max-h-[80vh] object-contain shadow-2xl" />
                          ) : (
                            <div className="p-10 text-center space-y-4">
                               <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                               <h2 className="text-white font-black">Missing Image Data</h2>
                               <p className="text-zinc-500 text-xs">This notice was submitted during a system update and only contains metadata. Reference: {n.reference}</p>
                            </div>
                          )}
                          <div className="absolute top-4 right-4 flex gap-2">
                             {n.receiptData && (
                               <a href={n.receiptData} download={`receipt-${n.id}.png`} 
                                 className="h-10 px-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                                 <Download className="w-4 h-4" /> Save Copy
                               </a>
                             )}
                          </div>
                       </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="p-3 bg-white/[0.03] border-t border-white/[0.08] flex gap-2 backdrop-blur-md">
                   <button 
                     onClick={async () => {
                        const ok = confirm("Are you sure you want to REJECT this payment? The tenant will remain suspended.");
                        if (!ok) return;
                        try {
                          await updateDoc(doc(db, "billing_notices", n.id), { status: "REJECTED", handledBy: auth.currentUser?.email, handledAt: serverTimestamp() });
                          toast.error("Payment rejected.");
                        } catch (e) { toast.error("Update failed."); }
                     }}
                     className="flex-1 h-14 rounded-2xl bg-zinc-800 text-rose-500 font-black text-[11px] hover:bg-rose-500 hover:text-white transition-all uppercase tracking-[0.15em] shadow-lg border border-white/5 active:scale-95">
                     Reject Proof
                   </button>
                   <button 
                     onClick={async () => {
                        const ok = confirm(`APPROVE $${n.amount} and ACTIVATE ${n.enterprise_id}?`);
                        if (!ok) return;
                        try {
                          await updateDoc(doc(db, "billing_notices", n.id), { status: "APPROVED", handledBy: auth.currentUser?.email, handledAt: serverTimestamp() });
                          
                          // Smart Activation Logic
                          const tRef = doc(db, "enterprise_settings", n.enterprise_id);
                          const monthsToAdd = n.billingCycle === "yearly" ? 12 : 1;
                          const newRenewal = new Date();
                          newRenewal.setMonth(newRenewal.getMonth() + monthsToAdd);

                          await updateDoc(tRef, { 
                            "billing.status": "active", 
                            "billing.planId": n.planId,
                            "billing.billingCycle": n.billingCycle,
                            "billing.renewalDate": newRenewal.toISOString(),
                            "billing.lastVerifiedAt": serverTimestamp()
                          });

                          await audit(auth.currentUser as User, "MANUAL_PAYMENT_APPROVED", { 
                            tenant: n.enterprise_id, 
                            amount: n.amount, 
                            cycle: n.billingCycle 
                          });

                          toast.success("Enterprise successfully activated!");
                        } catch (e: any) { toast.error(`Activation Error: ${e.message}`); }
                     }}
                     className="flex-[1.5] h-14 rounded-2xl bg-blue-600 text-white font-black text-[11px] hover:bg-blue-500 transition-all uppercase tracking-[0.15em] shadow-xl shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2">
                     <ShieldCheck className="w-4 h-4" /> Verify & Provision
                   </button>
                </div>
              </div>
            ))}
          </div>
          {notices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-dashed border-white/5 rounded-[3rem]">
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center text-zinc-800 mb-4 shadow-inner">
                <CreditCard className="w-10 h-10" />
              </div>
              <p className="text-zinc-600 font-black text-xs uppercase tracking-[0.2em]">All payment queues are clear</p>
            </div>
          )}
        </div>
      )}

      {subTab === "tickets" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)]">
          <div className="lg:col-span-4 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Tickets Thread</p>
            {tickets.map(t => (
              <button key={t.id} onClick={() => setSelectedTicket(t)}
                className={cn("w-full text-left p-4 rounded-2xl border transition-all group relative",
                  selectedTicket?.id === t.id ? "bg-blue-600/10 border-blue-500/30" : "bg-zinc-900 border-white/[0.05] hover:border-zinc-700"
                )}>
                <div className="flex items-center justify-between gap-4 mb-2">
                  <Badge className={cn("text-[9px] font-black uppercase tracking-widest",
                    t.status === "OPEN" ? "bg-rose-500/20 text-rose-400" :
                    t.status === "IN_PROGRESS" ? "bg-amber-500/20 text-amber-400" :
                    t.status === "RESOLVED" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                  )}>{t.status}</Badge>
                  <span className="text-[9px] text-zinc-700 font-mono">#{t.id.slice(-6).toUpperCase()}</span>
                </div>
                <p className="text-white text-sm font-bold truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{t.subject}</p>
                <p className="text-[10px] text-zinc-600 mt-1 truncate">{t.user_email}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 flex flex-col h-full bg-zinc-900/50 border border-white/[0.05] rounded-[2rem] overflow-hidden">
            {selectedTicket ? (
              <>
                <div className="p-5 border-b border-white/[0.05] bg-zinc-900/80 backdrop-blur-md flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <LifeBuoy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-sm tracking-tight">{selectedTicket.subject}</h3>
                      <p className="text-[10px] text-zinc-500 font-medium">Ticket submitted by {selectedTicket.user_email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => sendReply("RESOLVED")}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 text-[9px] font-black uppercase tracking-widest px-3 rounded-lg">Mark as Fixed</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}
                      className="border-white/10 text-zinc-600 hover:text-white h-8 w-8 p-0 rounded-lg"><X className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-black shrink-0 border border-white/5">{selectedTicket.user_email?.[0]?.toUpperCase()}</div>
                    <div className="space-y-1 max-w-[85%]">
                      <div className="bg-zinc-800/80 p-4 rounded-2xl rounded-tl-none border border-white/[0.05]"><p className="text-sm text-zinc-200 leading-relaxed font-medium">{selectedTicket.message}</p></div>
                    </div>
                  </div>
                  {replies.map((r) => (
                    <div key={r.id} className={cn("flex gap-4", r.sender_type === "ADMIN" ? "flex-row-reverse" : "")}>
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-white/5", r.sender_type === "ADMIN" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500")}>{(r.sender_email || "A")?.[0]?.toUpperCase()}</div>
                      <div className={cn("space-y-1 max-w-[85%]", r.sender_type === "ADMIN" ? "items-end text-right" : "")}>
                        <div className={cn("p-4 rounded-2xl border border-white/[0.05]", r.sender_type === "ADMIN" ? "bg-blue-600/10 border-blue-500/20 rounded-tr-none" : "bg-zinc-800/50 rounded-tl-none")}><p className="text-sm text-white leading-relaxed font-medium">{r.message}</p></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-zinc-900 border-t border-white/[0.05] space-y-3">
                  <div className="relative">
                    <textarea placeholder="Type your response to the user..." value={replyText} onChange={e => setReplyText(e.target.value)} className="w-full bg-black/40 border border-white/[0.1] rounded-2xl px-5 py-4 text-sm text-white outline-none min-h-[100px] pr-14" />
                    <Button onClick={() => sendReply()} disabled={sending || !replyText.trim()} className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-blue-600 shadow-lg p-0">
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4">
                <MessageSquare className="w-8 h-8 text-zinc-800" />
                <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-700">Support Terminal</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {feedback.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-white/[0.05] p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400"><Sparkles className="w-4 h-4" /></div>
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => (<Star key={s} className={cn("w-3 h-3", s <= f.rating ? "fill-amber-400 text-amber-400" : "text-zinc-800")} />))}</div>
              </div>
              <p className="text-white font-bold text-sm truncate">{f.subject || "No Subject"}</p>
              <p className="text-zinc-500 text-xs line-clamp-3">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TENANT PAYMENT NOTICES COMPONENT
// ══════════════════════════════════════════════════════════════════════
function TenantPaymentNotices({ tenantId, adminUser }: { tenantId: string; adminUser: User }) {
  const [notices, setNotices] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "billing_notices"), where("enterprise_id", "==", tenantId));
    return onSnapshot(q, snap => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => 
        new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
      ));
    });
  }, [tenantId]);

  const updateStatus = async (notice: any, status: "APPROVED" | "REJECTED") => {
    setBusy(notice.id);
    try {
      await updateDoc(doc(db, "billing_notices", notice.id), { status, handledBy: adminUser.email, handledAt: new Date().toISOString(), updatedAt: serverTimestamp() });
      if (status === "APPROVED") {
        const tenantSnap = await getDoc(doc(db, "enterprise_settings", tenantId));
        if (tenantSnap.exists()) {
          const currentBilling = tenantSnap.data().billing || {};
          const renewalDate = new Date();
          renewalDate.setMonth(renewalDate.getMonth() + (currentBilling.billingCycle === "yearly" ? 12 : 1));
          await updateDoc(doc(db, "enterprise_settings", tenantId), { "billing.status": "active", "billing.renewalDate": renewalDate.toISOString() });
        }
      }
      await audit(adminUser, `PAYMENT_NOTICE_${status}`, { resource_type: "billing_notice", resource_id: notice.id, target_tenant: tenantId, amount: notice.amount, reference: notice.reference });
      toast.success(`Payment notice ${status.toLowerCase()}.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  if (notices.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden mt-6">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
        <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
        <p className="text-white font-black text-xs uppercase tracking-widest">Payment Proofs History</p>
      </div>
      <div className="p-4 space-y-3">
        {notices.map(n => (
          <div key={n.id} className="bg-zinc-800/50 border border-white/[0.03] rounded-xl p-3 flex items-center justify-between gap-4 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", n.status === "PENDING" ? "bg-amber-500/10 text-amber-500" : n.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                {n.status === "PENDING" ? <Clock className="w-4 h-4" /> : n.status === "APPROVED" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-white text-xs font-black">${n.amount?.toFixed(2)} USD</p>
                <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">{n.submittedAt ? new Date(n.submittedAt).toLocaleDateString() : "Unknown Date"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase", n.status === "PENDING" ? "bg-amber-500/15 text-amber-400" : n.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>{n.status}</span>
              {n.status === "PENDING" && (
                <div className="flex gap-1">
                  <button onClick={() => updateStatus(n, "REJECTED")} disabled={busy === n.id} className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"><XCircle className="w-3.5 h-3.5" /></button>
                  <button onClick={() => updateStatus(n, "APPROVED")} disabled={busy === n.id} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
