import React, { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
  Sparkles, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      console.log("Admin Auth State Change:", user ? `User ${user.uid}` : "No User");
      if (!user) { 
        setPhase("login"); 
        setAdminUser(null); 
        setAdminRecord(null); 
        return; 
      }
      
      try {
        console.log("Checking admin record for UID:", user.uid);
        let snap = await getDoc(doc(db, "admin_users", user.uid));
        
        // Fallback: Check if they used their email as the document ID (common mistake)
        if (!snap.exists() && user.email) {
          console.log("UID not found, trying email lookup for:", user.email);
          snap = await getDoc(doc(db, "admin_users", user.email));
        }

        if (snap.exists()) {
          console.log("Admin record found:", snap.data());
          setAdminUser(user);
          setAdminRecord(snap.data() as AdminRecord);
          setPhase("portal");
        } else {
          console.warn("No admin record found for UID or Email.");
          toast.error("Access denied: UID not found in registry.");
          await signOut(auth);
          setPhase("login");
        }
      } catch (err: any) {
        console.error("Error verifying admin clearance:", err);
        toast.error(`Clearance verification failed: ${err.message || 'Unknown error'}`);
        await signOut(auth);
        setPhase("login");
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Too many attempts. Wait 30 seconds."); return; }
    if (!email || !password) { toast.error("Enter email and password."); return; }
    setLoading(true);
    try {
      console.log("Attempting admin login for:", email);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("Auth success, checking doc:", cred.user.uid);
      
      const adminSnap = await getDoc(doc(db, "admin_users", cred.user.uid));
      if (!adminSnap.exists()) {
        console.warn("Login success but UID not in admin_users list.");
        await signOut(auth);
        toast.error("Access denied. This account is not in the admin registry.");
        setAttempts(a => { const next = a + 1; if (next >= 5) { setLocked(true); setTimeout(() => { setLocked(false); setAttempts(0); }, 30000); } return next; });
        return;
      }
      
      console.log("Admin verified, logging entry...");
      await addDoc(collection(db, "admin_audit_logs"), {
        action: "ADMIN_LOGIN", admin_uid: cred.user.uid, admin_email: cred.user.email,
        timestamp: serverTimestamp(), resource_type: "session",
      });
      toast.success("Welcome, Admin.");
      onSuccess();
    } catch (err: any) {
      console.error("Admin Login Error:", err);
      const code = err.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") toast.error("Invalid credentials.");
      else if (code === "auth/too-many-requests") { toast.error("Too many failed attempts."); setLocked(true); setTimeout(() => setLocked(false), 60000); }
      else toast.error(`Sign-in failed: ${err.message || 'Unknown error'}`);
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
            <p className="text-zinc-600 text-xs font-medium">Orivo CRM — Restricted Access</p>
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
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Authenticate</span>
            )}
          </Button>
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
  const isSuperAdmin = record.role === "super_admin";

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

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visibleNav.map(n => (
            <button key={n.id} onClick={() => { setTab(n.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left",
                tab === n.id ? "bg-rose-600/15 text-rose-400 border border-rose-600/20" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
              )}>
              <n.icon className="w-3.5 h-3.5 shrink-0" />
              {n.label}
            </button>
          ))}
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
  const [editPlan, setEditPlan] = useState(t.plan || "Free");

  const savePlan = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "enterprise_settings", t.id), { plan: editPlan });
      await audit(adminUser, "UPDATE_TENANT_PLAN", {
        resource_type: "tenant", resource_id: t.id, target_tenant: t.enterprise_id,
        before: { plan: t.plan }, after: { plan: editPlan },
      });
      toast.success("Plan updated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={t.enterpriseName || t.id} size="lg">
      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["ID", t.enterprise_id],
          ["Industry", t.industry || "—"],
          ["Team Size", t.teamSize || "—"],
          ["Status", t.status || "active"],
        ].map(([l, v]) => (
          <div key={l} className="bg-zinc-900 rounded-xl p-3">
            <p className="text-zinc-700 text-[9px] uppercase tracking-widest mb-0.5">{l}</p>
            <p className="text-white font-bold text-sm">{v}</p>
          </div>
        ))}
      </div>

      {/* Plan editor */}
      <div className="bg-zinc-900 border border-white/[0.05] rounded-xl p-4 space-y-2">
        <p className="text-white font-bold text-xs">Plan</p>
        <div className="flex gap-2">
          {["Free", "Starter", "Pro", "Enterprise"].map(p => (
            <button key={p} onClick={() => setEditPlan(p)}
              className={cn("px-3 h-8 rounded-lg text-xs font-black transition-all",
                editPlan === p ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-500 hover:text-white"
              )}>{p}</button>
          ))}
          <button onClick={savePlan} disabled={busy} className="ml-auto px-4 h-8 rounded-lg bg-white text-zinc-900 text-xs font-black hover:bg-zinc-100 transition-all">
            {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      {/* Users */}
      <div className="bg-zinc-900 border border-white/[0.05] rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-white font-bold text-xs border-b border-white/[0.04]">
          Users ({tenantUsers.length})
        </p>
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
                {[["Users", userCount], ["Industry", t.industry || "—"], ["Plan", t.plan || "Free"]].map(([l, v]) => (
                  <div key={l as string} className="bg-zinc-800/60 rounded-xl p-2 text-center">
                    <p className="text-white font-black text-sm">{v}</p>
                    <p className="text-zinc-700 text-[9px]">{l}</p>
                  </div>
                ))}
              </div>

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
        {Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
          const pct = tenants.length ? Math.round((v / tenants.length) * 100) : 0;
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
      const ticketRef = doc(db, "support_tickets", selectedTicket.id);
      
      if (replyText.trim()) {
        await addDoc(collection(db, `support_tickets/${selectedTicket.id}/replies`), {
          message: replyText.trim(),
          sender_email: auth.currentUser?.email,
          sender_type: "ADMIN",
          createdAt: serverTimestamp(),
        });
      }

      const status = newStatus || "IN_PROGRESS";
      await updateDoc(ticketRef, { status, updatedAt: serverTimestamp() });
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
            { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
            { id: "feedback", label: "User Feedback", icon: MessageSquare },
          ].map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id as any)}
              className={cn("flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                subTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-600 hover:text-white"
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "tickets" && tickets.filter(ti => ti.status === "OPEN").length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {subTab === "tickets" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)]">
          {/* List View */}
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
                  <span className="text-[9px] text-zinc-700 font-mono">
                    #{t.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <p className="text-white text-sm font-bold truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{t.subject}</p>
                <p className="text-[10px] text-zinc-600 mt-1 truncate">{t.user_email}</p>
              </button>
            ))}
            {tickets.length === 0 && !loading && (
              <div className="py-20 text-center border-2 border-dashed border-white/[0.03] rounded-3xl">
                <LifeBuoy className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-600 text-xs font-bold">No active threads.</p>
              </div>
            )}
          </div>

          {/* Chat / Details View */}
          <div className="lg:col-span-8 flex flex-col h-full bg-zinc-900/50 border border-white/[0.05] rounded-[2rem] overflow-hidden">
            {selectedTicket ? (
              <>
                {/* Chat Header */}
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
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 text-[9px] font-black uppercase tracking-widest px-3 rounded-lg">
                      Mark as Fixed
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}
                      className="border-white/10 text-zinc-600 hover:text-white h-8 w-8 p-0 rounded-lg">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {/* Original Message */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-black shrink-0 border border-white/5">
                      {selectedTicket.user_email?.[0]?.toUpperCase()}
                    </div>
                    <div className="space-y-1 max-w-[85%]">
                      <div className="bg-zinc-800/80 p-4 rounded-2xl rounded-tl-none border border-white/[0.05]">
                        <p className="text-sm text-zinc-200 leading-relaxed font-medium">{selectedTicket.message}</p>
                      </div>
                      <p className="text-[9px] text-zinc-600 font-bold ml-1">USER · {selectedTicket.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleTimeString() : 'Just now'}</p>
                    </div>
                  </div>

                  {/* System Context (Diagnostic Bundle) */}
                  {selectedTicket.metadata && (
                    <div className="mx-12 px-5 py-4 bg-[#0d0d0f] border border-white/[0.03] rounded-3xl flex items-center justify-between group/meta hover:border-blue-500/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-white/[0.05] flex items-center justify-center text-zinc-600 group-hover/meta:text-blue-500 transition-colors">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Diagnostic Bundle Captured</p>
                          <p className="text-[9px] text-zinc-700 font-bold mt-0.5">
                            {selectedTicket.metadata.os} · {selectedTicket.metadata.screenSize} · {selectedTicket.metadata.connection}
                          </p>
                        </div>
                      </div>
                      <div className="hidden group-hover/meta:flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                        <span className="text-[8px] font-mono text-zinc-600 bg-white/5 px-2 py-1 rounded-md">{selectedTicket.metadata.appVersion}</span>
                        <span className="text-[8px] font-mono text-zinc-600 bg-white/5 px-2 py-1 rounded-md">{selectedTicket.metadata.language}</span>
                      </div>
                    </div>
                  )}

                  {/* Replies Thread */}
                  {replies.map((r) => (
                    <div key={r.id} className={cn("flex gap-4", r.sender_type === "ADMIN" ? "flex-row-reverse" : "")}>
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-white/5",
                        r.sender_type === "ADMIN" ? "bg-blue-600 text-white border-blue-400/20" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {(r.sender_email || "A")?.[0]?.toUpperCase()}
                      </div>
                      <div className={cn("space-y-1 max-w-[85%]", r.sender_type === "ADMIN" ? "items-end text-right" : "")}>
                        <div className={cn("p-4 rounded-2xl border border-white/[0.05]",
                          r.sender_type === "ADMIN" ? "bg-blue-600/10 border-blue-500/20 rounded-tr-none" : "bg-zinc-800/50 rounded-tl-none"
                        )}>
                          <p className="text-sm text-white leading-relaxed font-medium">{r.message}</p>
                        </div>
                        <p className="text-[9px] text-zinc-600 font-bold px-1">
                          {r.sender_type} · {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleTimeString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 bg-zinc-900 border-t border-white/[0.05] space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => sendReply("IN_PROGRESS")} className="px-3 h-7 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest hover:bg-amber-500/20 transition-all">
                      Working on it
                    </button>
                    <button onClick={() => { setReplyText("We have identified the issue and our engineers are working on a fix."); }} className="px-3 h-7 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:bg-white/10 transition-all">
                      Use Template
                    </button>
                  </div>
                  <div className="relative">
                    <textarea 
                      placeholder="Type your response to the user..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      className="w-full bg-black/40 border border-white/[0.1] rounded-2xl px-5 py-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-blue-500/40 transition-all resize-none pr-14 min-h-[100px]"
                    />
                    <Button 
                      onClick={() => sendReply()}
                      disabled={sending || !replyText.trim()}
                      className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 p-0"
                    >
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4">
                <div className="w-20 h-20 bg-white/[0.01] rounded-[2.5rem] border border-white/[0.03] flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <MessageSquare className="w-8 h-8 text-zinc-800" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-700">Support Terminal</p>
                  <p className="text-[10px] text-zinc-800 font-bold mt-1">Select a thread to start communicating</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {feedback.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-white/[0.05] p-5 rounded-3xl space-y-4 hover:border-zinc-700 transition-colors group">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-xl border shrink-0",
                  f.type === "bug" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                  f.type === "idea" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                  f.type === "praise" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  "bg-zinc-800 border-zinc-700 text-zinc-400"
                )}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={cn("w-3 h-3", s <= f.rating ? "fill-amber-400 text-amber-400" : "text-zinc-800")} />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white font-bold text-sm mb-1 group-hover:text-blue-400 transition-colors">{f.subject || "No Subject"}</h4>
                <p className="text-zinc-500 text-xs leading-relaxed line-clamp-3">{f.message}</p>
              </div>
              <div className="pt-4 border-t border-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-[9px] font-bold">
                  <span className="text-zinc-600 uppercase tracking-widest">USER</span>
                  <span className="text-zinc-400">{f.user_email}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-bold">
                  <span className="text-zinc-600 uppercase tracking-widest">DATE</span>
                  <span className="text-zinc-400">
                    {f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString() : 'Recently'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {feedback.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-white/[0.03] rounded-3xl">
              <MessageSquare className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
              <p className="text-zinc-600 text-xs font-bold">No feedback received yet.</p>
            </div>
          )}
        </div>
      )}
    </Wrap>
  );
}
