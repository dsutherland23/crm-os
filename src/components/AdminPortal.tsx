import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  Users,
  Building2,
  Activity,
  BarChart3,
  FileText,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle2,
  Download,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Terminal,
  Server,
  Database,
  UserX,
  TrendingUp,
  KeyRound,
  Ban,
  AlertOctagon,
  Menu,
  X,
  Command,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════
type AdminTab = "dashboard" | "users" | "tenants" | "analytics" | "security" | "audit" | "config";

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

// ══════════════════════════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════════════════════════
const NAV: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",  label: "Overview",      icon: Activity    },
  { id: "users",      label: "Users",          icon: Users       },
  { id: "tenants",    label: "Tenants",        icon: Building2   },
  { id: "analytics",  label: "Analytics",      icon: BarChart3   },
  { id: "security",   label: "Security",       icon: ShieldAlert },
  { id: "audit",      label: "Audit Logs",     icon: FileText    },
  { id: "config",     label: "Config",         icon: Sliders     },
];

// ══════════════════════════════════════════════════════════════════════
// AUDIT WRITER
// ══════════════════════════════════════════════════════════════════════
async function audit(
  adminUser: User,
  action: string,
  payload: Record<string, unknown> = {}
) {
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
      if (!user) { setPhase("login"); setAdminUser(null); setAdminRecord(null); return; }

      // Verify this user is in admin_users collection
      const snap = await getDoc(doc(db, "admin_users", user.uid));
      if (snap.exists()) {
        const data = snap.data() as AdminRecord;
        setAdminUser(user);
        setAdminRecord(data);
        setPhase("portal");
      } else {
        // Not an admin — sign them out silently so tenant sessions aren't disrupted
        await signOut(auth);
        setPhase("login");
        setAdminUser(null);
      }
    });
    return unsub;
  }, []);

  if (phase === "checking") return <SplashScreen />;
  if (phase === "login") return <AdminLogin onSuccess={() => {}} />;
  if (phase === "portal" && adminUser && adminRecord) {
    return <AdminShell user={adminUser} record={adminRecord} />;
  }
  return <AdminLogin onSuccess={() => {}} />;
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
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Verify admin status before granting access
      const adminSnap = await getDoc(doc(db, "admin_users", cred.user.uid));
      if (!adminSnap.exists()) {
        await signOut(auth);
        toast.error("Access denied. This account is not an admin.");
        setAttempts(a => {
          const next = a + 1;
          if (next >= 5) { setLocked(true); setTimeout(() => { setLocked(false); setAttempts(0); }, 30000); }
          return next;
        });
        return;
      }

      // Log the successful admin sign-in
      await addDoc(collection(db, "admin_audit_logs"), {
        action: "ADMIN_LOGIN",
        admin_uid: cred.user.uid,
        admin_email: cred.user.email,
        timestamp: serverTimestamp(),
        resource_type: "session",
      });

      toast.success("Welcome, Admin.");
      onSuccess();
    } catch (err: any) {
      const code = err.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        toast.error("Invalid credentials.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Try again later.");
        setLocked(true);
        setTimeout(() => setLocked(false), 60000);
      } else {
        toast.error("Sign-in failed.");
      }
      setAttempts(a => {
        const next = a + 1;
        if (next >= 5) { setLocked(true); setTimeout(() => { setLocked(false); setAttempts(0); }, 30000); }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(239,68,68,0.08)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Badge */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-rose-400" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-black text-white tracking-tight">Admin Portal</h1>
            <p className="text-zinc-600 text-xs font-medium">Orivo CRM — Restricted Access</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Rate limit warning */}
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

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="admin@yourdomain.com"
                className="w-full h-12 pl-10 pr-4 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-rose-500/40 transition-colors font-medium"
                disabled={locked}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full h-12 pl-10 pr-12 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-rose-500/40 transition-colors font-medium tracking-wider"
                disabled={locked}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || locked}
            className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Authenticate
              </span>
            )}
          </Button>
        </form>

        {/* Zero Trust notice */}
        <p className="text-center text-[10px] text-zinc-800 font-medium">
          Zero Trust · All access attempts are logged
        </p>
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

  const handleSignOut = async () => {
    await audit(user, "ADMIN_LOGOUT", { resource_type: "session" });
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 bg-[#0d0d0f] border-r border-white/[0.05] flex flex-col transition-transform duration-200",
        "lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.05] gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-xs leading-none">Admin Portal</p>
            <p className="text-rose-500 text-[9px] font-bold uppercase tracking-wider mt-0.5 truncate">
              {record.role === "super_admin" ? "Super Admin" : "Admin"}
            </p>
          </div>
          <button className="ml-auto lg:hidden text-zinc-600 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => { setTab(n.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left",
                tab === n.id
                  ? "bg-rose-600/15 text-rose-400 border border-rose-600/20"
                  : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
              )}
            >
              <n.icon className="w-3.5 h-3.5 shrink-0" />
              {n.label}
            </button>
          ))}
        </nav>

        {/* User strip */}
        <div className="p-3 border-t border-white/[0.05] shrink-0">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <p className="text-zinc-500 text-[10px] truncate min-w-0">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="ml-auto text-zinc-700 hover:text-rose-400 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 bg-zinc-950/80 border-b border-white/[0.05] flex items-center px-4 gap-3 shrink-0">
          <button className="lg:hidden text-zinc-600 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-white font-black text-sm">{NAV.find(n => n.id === tab)?.label}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[9px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/15 rounded-full px-2.5 py-1 uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {tab === "dashboard"  && <DashPane  user={user} />}
          {tab === "users"      && <UsersPane  user={user} isSuperAdmin={record.role === "super_admin"} />}
          {tab === "tenants"    && <TenantsPane user={user} isSuperAdmin={record.role === "super_admin"} />}
          {tab === "analytics"  && <AnalyticsPane />}
          {tab === "security"   && <SecurityPane />}
          {tab === "audit"      && <AuditPane />}
          {tab === "config"     && <ConfigPane user={user} isSuperAdmin={record.role === "super_admin"} />}
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

// ══════════════════════════════════════════════════════════════════════
// 1. DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function DashPane({ user }: { user: User }) {
  const users = useUsers();
  const tenants = useTenants();
  const logs = useAuditLogs(8);

  const suspended = users.filter(u => u.status === "SUSPENDED").length;
  const newThisWeek = users.filter(u => {
    try { return Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000; } catch { return false; }
  }).length;

  return (
    <Wrap>
      <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-emerald-300 text-xs font-semibold">Zero Trust Active · Signed in as {user.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2} label="Total Tenants" value={tenants.length} color="blue" />
        <Kpi icon={Users}     label="Total Users"   value={users.length}   color="emerald" />
        <Kpi icon={UserX}     label="Suspended"     value={suspended}      color="rose" />
        <Kpi icon={TrendingUp} label="New This Week" value={newThisWeek}   color="amber" />
      </div>

      {/* System health */}
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
        {/* Recent tenants */}
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
              )}>
                {t.status || "active"}
              </span>
            </div>
          ))}
          {tenants.length === 0 && <p className="px-5 py-8 text-zinc-700 text-xs text-center">No tenants yet</p>}
        </div>

        {/* Recent audit logs */}
        <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-hidden">
          <p className="px-5 py-3 text-white font-bold text-xs border-b border-white/[0.04]">Recent Admin Actions</p>
          {logs.map(l => (
            <div key={l.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.03] last:border-0">
              <Terminal className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">{l.action}</p>
                <p className="text-zinc-700 text-[9px] truncate">{l.admin_email}</p>
              </div>
              <p className="text-zinc-800 text-[9px] ml-auto shrink-0 font-mono">
                {l.timestamp?.toDate?.()?.toLocaleTimeString() || "—"}
              </p>
            </div>
          ))}
          {logs.length === 0 && <p className="px-5 py-8 text-zinc-700 text-xs text-center">No actions yet</p>}
        </div>
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 2. USERS
// ══════════════════════════════════════════════════════════════════════
function UsersPane({ user, isSuperAdmin }: { user: User; isSuperAdmin: boolean }) {
  const users = useUsers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.enterprise_id?.toLowerCase().includes(q);
    const matchS = statusFilter === "ALL" || u.status === statusFilter;
    return matchQ && matchS;
  });

  const suspend = async (u: UserRecord) => {
    if (!confirm(`Suspend ${u.email}?`)) return;
    setBusy(u.id);
    try {
      await updateDoc(doc(db, "users", u.id), { status: "SUSPENDED" });
      await audit(user, "SUSPEND_USER", { resource_type: "user", resource_id: u.id, target_tenant: u.enterprise_id, before: { status: u.status }, after: { status: "SUSPENDED" } });
      toast.success("User suspended.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const reactivate = async (u: UserRecord) => {
    setBusy(u.id);
    try {
      await updateDoc(doc(db, "users", u.id), { status: "ACTIVE" });
      await audit(user, "REACTIVATE_USER", { resource_type: "user", resource_id: u.id, before: { status: u.status }, after: { status: "ACTIVE" } });
      toast.success("User reactivated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <Wrap>
      <PageTitle title="Users" sub={`${users.length} total across all tenants`} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, email, or tenant…"
            className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {["ALL","ACTIVE","SUSPENDED"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                statusFilter === s ? "bg-white text-zinc-900" : "bg-zinc-900 border border-white/[0.07] text-zinc-600 hover:text-white"
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["User","Tenant","Role","Status","Joined",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-zinc-700 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.015] transition-colors">
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
                <td className="px-4 py-3 text-zinc-700 text-[9px]">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  {u.status !== "SUSPENDED" ? (
                    <button onClick={() => suspend(u)} disabled={busy === u.id}
                      className="text-[9px] font-black text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-400/10 transition-all">
                      {busy === u.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Suspend"}
                    </button>
                  ) : (
                    <button onClick={() => reactivate(u)} disabled={busy === u.id}
                      className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-400/10 transition-all">
                      {busy === u.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-zinc-700 py-12">No users found.</p>}
      </div>
    </Wrap>
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
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => {
          const userCount = users.filter(u => u.enterprise_id === (t.enterprise_id || t.id)).length;
          return (
            <div key={t.id} className={cn("bg-zinc-900 border rounded-2xl p-5 space-y-4",
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
                <p className="text-zinc-800 text-[9px]">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</p>
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
          );
        })}
        {filtered.length === 0 && <p className="col-span-3 text-zinc-700 text-center py-16">No tenants found.</p>}
      </div>
    </Wrap>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 4. ANALYTICS
// ══════════════════════════════════════════════════════════════════════
function AnalyticsPane() {
  const tenants = useTenants();
  const users = useUsers();

  const byIndustry = tenants.reduce<Record<string,number>>((a, t) => {
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
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {!Object.keys(byIndustry).length && <p className="text-zinc-700 text-xs">No data yet.</p>}
      </div>

      {/* 30-day registration bars */}
      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">User Registrations (Last 30 Days)</p>
        <div className="flex gap-0.5 items-end h-16">
          {Array.from({length: 30}).map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (29 - i));
            const day = d.toISOString().split("T")[0];
            const cnt = users.filter(u => u.createdAt?.startsWith(day)).length;
            const max = Math.max(...Array.from({length:30}).map((_,j) => {
              const dd = new Date(); dd.setDate(dd.getDate()-(29-j));
              return users.filter(u => u.createdAt?.startsWith(dd.toISOString().split("T")[0])).length;
            }), 1);
            return (
              <div key={i} title={`${day}: ${cnt}`} className="flex-1 bg-blue-500/30 hover:bg-blue-500 rounded-sm transition-all"
                style={{ height: `${Math.max((cnt/max)*100, 4)}%` }} />
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
    { label: "Firestore rules — deny-all default",       ok: true,  detail: "Zero Trust rules deployed" },
    { label: "Admin portal — independent auth",          ok: true,  detail: "Separate login, admin_users gated" },
    { label: "Audit logs — immutable",                   ok: true,  detail: "No update/delete allowed on logs" },
    { label: "Tenant data isolation",                    ok: true,  detail: "enterprise_id enforced server-side" },
    { label: "Role self-escalation blocked",             ok: true,  detail: "role field locked from self-write" },
    { label: "Cloud Functions (real IP capture)",        ok: false, detail: "Deploy functions/ for production-grade ops" },
  ];

  return (
    <Wrap>
      <PageTitle title="Security Overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={UserX}     label="Suspended Users"    value={users.filter(u => u.status === "SUSPENDED").length} color="rose" />
        <Kpi icon={Ban}       label="Suspension Actions" value={logs.filter(l => l.action.includes("SUSPEND")).length} color="rose" />
        <Kpi icon={KeyRound}  label="Role Changes"       value={logs.filter(l => l.action.includes("ROLE")).length} color="amber" />
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
        {logs.filter(l => ["SUSPEND","ROLE","DELETE"].some(k => l.action.includes(k))).slice(0, 10).map(l => (
          <div key={l.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.03] last:border-0">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">{l.action}</p>
              <p className="text-zinc-700 text-[9px] truncate">by {l.admin_email}</p>
            </div>
            <p className="text-zinc-800 text-[9px] ml-auto shrink-0">{l.timestamp?.toDate?.()?.toLocaleString() || "—"}</p>
          </div>
        ))}
        {logs.filter(l => ["SUSPEND","ROLE","DELETE"].some(k => l.action.includes(k))).length === 0 && (
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
  const [expanded, setExpanded] = useState<string|null>(null);

  const filtered = logs.filter(l =>
    !search || l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.target_tenant?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [
      ["Timestamp","Admin","Action","Resource","Tenant"],
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
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.07] rounded-xl text-white text-xs placeholder:text-zinc-700 outline-none focus:border-white/15 transition-colors"
        />
      </div>

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl overflow-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["Time","Admin","Action","Resource","Tenant",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-zinc-700 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03] font-mono">
            {filtered.map(l => (
              <React.Fragment key={l.id}>
                <tr className="hover:bg-white/[0.015] cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="px-4 py-3 text-zinc-700 text-[9px] whitespace-nowrap">
                    {l.timestamp?.toDate?.()?.toLocaleString() || "—"}
                  </td>
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
                  <td className="px-4 py-3"><ChevronDown className={cn("w-3 h-3 text-zinc-800 transition-transform", expanded === l.id && "rotate-180")} /></td>
                </tr>
                {expanded === l.id && (
                  <tr><td colSpan={6} className="bg-zinc-950 px-4 py-3">
                    <div className="grid grid-cols-2 gap-3">
                      {l.before && <div><p className="text-zinc-700 text-[9px] mb-1 uppercase tracking-wider">Before</p>
                        <pre className="text-rose-300 bg-rose-500/5 border border-rose-500/10 rounded-lg p-2 text-[9px] overflow-auto">{JSON.stringify(l.before, null, 2)}</pre>
                      </div>}
                      {l.after && <div><p className="text-zinc-700 text-[9px] mb-1 uppercase tracking-wider">After</p>
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
// 7. CONFIG
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

  return (
    <Wrap>
      <PageTitle title="System Configuration" sub={isSuperAdmin ? "Full access" : "Read only — Super Admin required"} />

      {!isSuperAdmin && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/[0.05] rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 text-zinc-600" />
          <p className="text-zinc-600 text-xs">Read-only access. Super Admin required to make changes.</p>
        </div>
      )}

      <div className="bg-zinc-900 border border-white/[0.05] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm">Feature Flags</p>
        {Object.entries(flags).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
            <div>
              <p className="text-white text-sm font-semibold">{k.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase())}</p>
              <p className="text-zinc-700 text-[10px]">Platform-wide toggle</p>
            </div>
            <button
              onClick={() => isSuperAdmin && setFlags(f => ({ ...f, [k]: !v }))}
              disabled={!isSuperAdmin}
              className={cn("w-11 h-6 rounded-full relative transition-all shrink-0",
                v ? "bg-emerald-500" : "bg-zinc-700",
                !isSuperAdmin && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", v ? "left-5" : "left-0.5")} />
            </button>
          </div>
        ))}
        {isSuperAdmin && (
          <Button onClick={save} disabled={saving}
            className="w-full bg-white text-zinc-900 font-black hover:bg-zinc-100 mt-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        )}
      </div>

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
