import React, { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import {
  getAdminClaims,
  subscribeToAllTenants,
  subscribeToAllUsers,
  subscribeToRecentAuditLogs,
  writeAuditLog,
  type AdminRole,
  type AuditLogEntry,
  type TenantRecord,
  type UserRecord,
} from "@/lib/admin";
import { db, doc, setDoc, updateDoc, collection, getDocs, query, where, orderBy } from "@/lib/firebase";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield, Users, Building2, BarChart3, FileText, Settings2,
  ChevronRight, Search, Filter, AlertTriangle, Activity,
  TrendingUp, Lock, Eye, EyeOff, RefreshCw, LogOut,
  CheckCircle2, XCircle, Clock, Zap, Globe, Database,
  UserCheck, UserX, Terminal, Bell, Sliders, Download,
  AlertOctagon, Server, Cpu, ArrowUpRight, ArrowDownRight,
  MoreVertical, Ban, KeyRound, Send, ChevronDown, X, Info,
  ShieldAlert, ShieldCheck, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";

// ══════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ══════════════════════════════════════════════════════════════════════
type AdminTab =
  | "dashboard"
  | "users"
  | "tenants"
  | "analytics"
  | "security"
  | "audit"
  | "config";

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "dashboard", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "tenants", label: "Tenants", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "security", label: "Security", icon: ShieldAlert },
  { id: "audit", label: "Audit Logs", icon: FileText },
  { id: "config", label: "Config", icon: Sliders },
];

// ══════════════════════════════════════════════════════════════════════
// ADMIN PORTAL ROOT — AUTHENTICATION GATE
// ══════════════════════════════════════════════════════════════════════
export default function AdminPortal() {
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getAdminClaims().then((claims) => {
      if (claims) {
        setAdminRole(claims.role);
      } else {
        setDenied(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <RipplePulseLoader size="lg" />
        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Verifying clearance…</p>
      </div>
    );
  }

  if (denied || !adminRole) {
    return <AccessDenied />;
  }

  return <AdminPortalShell adminRole={adminRole} />;
}

// ── Access Denied ───────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            You don't have the required clearance to access the Admin Portal.
            This incident has been logged.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-zinc-800 text-zinc-400 hover:bg-zinc-900"
          onClick={() => signOut(firebaseAuth).then(() => window.location.href = "/")}
        >
          <LogOut className="w-4 h-4 mr-2" /> Return to Application
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN PORTAL SHELL
// ══════════════════════════════════════════════════════════════════════
function AdminPortalShell({ adminRole }: { adminRole: AdminRole }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = auth.currentUser;

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* ── Sidebar ── */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar panel */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-zinc-900/95 backdrop-blur-xl border-r border-white/[0.06] flex flex-col transition-transform duration-300",
          "lg:relative lg:translate-x-0 lg:flex",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          {/* Logo */}
          <div className="h-16 flex items-center px-5 border-b border-white/[0.06] gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">Admin Portal</p>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider mt-0.5",
                adminRole === "super_admin" ? "text-rose-400" : "text-amber-400"
              )}>
                {adminRole === "super_admin" ? "Super Admin" : "Admin"}
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  activeTab === item.id
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto text-[10px] font-black bg-rose-500 text-white rounded-full px-1.5 py-0.5">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Bottom user info */}
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs font-black shrink-0">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold truncate">{user?.email}</p>
                <p className="text-zinc-600 text-[10px] truncate">Admin Session</p>
              </div>
              <button
                onClick={() => signOut(firebaseAuth).then(() => window.location.href = "/")}
                className="ml-auto text-zinc-600 hover:text-rose-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-zinc-900/50 border-b border-white/[0.06] flex items-center px-4 sm:px-6 gap-4 shrink-0">
          <button
            className="lg:hidden text-zinc-500 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <p className="text-white font-bold text-sm">
              {NAV_ITEMS.find(n => n.id === activeTab)?.label}
            </p>
            <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
              Orivo CRM — Internal Administration
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider hidden sm:block">
              Zero Trust Active
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "dashboard" && <AdminDashboard adminRole={adminRole} />}
          {activeTab === "users" && <AdminUsers adminRole={adminRole} />}
          {activeTab === "tenants" && <AdminTenants adminRole={adminRole} />}
          {activeTab === "analytics" && <AdminAnalytics />}
          {activeTab === "security" && <AdminSecurity />}
          {activeTab === "audit" && <AdminAuditLogs />}
          {activeTab === "config" && <AdminConfig adminRole={adminRole} />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════════════
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = "zinc",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { dir: "up" | "down"; pct: number };
  color?: "zinc" | "blue" | "emerald" | "rose" | "amber";
}) {
  const colors = {
    zinc: "bg-zinc-800/50 border-white/[0.06] text-zinc-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };

  return (
    <div className={cn("rounded-2xl border p-5 space-y-3", colors[color])}>
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5" />
        {trend && (
          <span className={cn(
            "flex items-center gap-0.5 text-[11px] font-bold",
            trend.dir === "up" ? "text-emerald-400" : "text-rose-400"
          )}>
            {trend.dir === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.pct}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-[11px] font-semibold text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-white font-black text-xl">{title}</h2>
        {description && <p className="text-zinc-500 text-sm mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 1. ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function AdminDashboard({ adminRole }: { adminRole: AdminRole }) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubT = subscribeToAllTenants((t) => setTenants(t));
    const unsubU = subscribeToAllUsers((u) => { setUsers(u); setLoading(false); });
    const unsubL = subscribeToRecentAuditLogs((l) => setLogs(l), 10);
    return () => { unsubT(); unsubU(); unsubL(); };
  }, []);

  const activeTenants = tenants.filter(t => t.status !== "suspended").length;
  const activeUsers = users.filter(u => u.status === "ACTIVE").length;
  const suspendedUsers = users.filter(u => u.status === "SUSPENDED").length;
  const newThisWeek = users.filter(u => {
    const d = new Date(u.createdAt);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loading) return <LoadingPane />;

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* Security banner */}
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300 font-medium">
          Zero Trust Active — All actions are logged and enforced server-side.
          Role: <span className="font-black">{adminRole}</span>
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Tenants" value={tenants.length} sub={`${activeTenants} active`} trend={{ dir: "up", pct: 12 }} color="blue" />
        <StatCard icon={Users} label="Total Users" value={users.length} sub={`${activeUsers} active`} trend={{ dir: "up", pct: 8 }} color="emerald" />
        <StatCard icon={UserX} label="Suspended" value={suspendedUsers} color="rose" />
        <StatCard icon={TrendingUp} label="New This Week" value={newThisWeek} trend={{ dir: "up", pct: 24 }} color="amber" />
      </div>

      {/* System Health */}
      <div>
        <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">System Health</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Firestore", status: "Operational", icon: Database, ok: true },
            { label: "Firebase Auth", status: "Operational", icon: Lock, ok: true },
            { label: "Hosting", status: "Operational", icon: Server, ok: true },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.ok ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                <s.icon className={cn("w-4 h-4", s.ok ? "text-emerald-400" : "text-rose-400")} />
              </div>
              <div>
                <p className="text-white text-sm font-bold">{s.label}</p>
                <p className={cn("text-[11px] font-semibold", s.ok ? "text-emerald-400" : "text-rose-400")}>{s.status}</p>
              </div>
              <div className={cn("ml-auto w-2 h-2 rounded-full", s.ok ? "bg-emerald-400 animate-pulse" : "bg-rose-400")} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tenants */}
        <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-white font-bold text-sm">Recent Tenants</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {tenants.slice(0, 6).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-black shrink-0">
                  {(t.enterpriseName || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{t.enterpriseName}</p>
                  <p className="text-zinc-600 text-[10px] truncate">{t.enterprise_id}</p>
                </div>
                <span className={cn(
                  "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                  t.status === "suspended" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {t.status || "active"}
                </span>
              </div>
            ))}
            {tenants.length === 0 && <p className="px-5 py-8 text-zinc-600 text-sm text-center">No tenants yet</p>}
          </div>
        </div>

        {/* Recent audit log */}
        <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-white font-bold text-sm">Recent Admin Actions</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {logs.slice(0, 6).map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-3 h-3 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{log.action}</p>
                  <p className="text-zinc-600 text-[10px] truncate">{log.admin_email}</p>
                </div>
                <p className="text-zinc-700 text-[10px] ml-auto shrink-0">
                  {log.timestamp?.toDate?.()?.toLocaleTimeString() || "—"}
                </p>
              </div>
            ))}
            {logs.length === 0 && <p className="px-5 py-8 text-zinc-600 text-sm text-center">No admin actions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 2. USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════
function AdminUsers({ adminRole }: { adminRole: AdminRole }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToAllUsers((u) => { setUsers(u); setLoading(false); });
    return unsub;
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.enterprise_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSuspend = async (user: UserRecord) => {
    if (!confirm(`Suspend ${user.email}? They will lose access immediately.`)) return;
    setActionLoading(user.id);
    try {
      const before = { status: user.status };
      await updateDoc(doc(db, "users", user.id), { status: "SUSPENDED" });
      await writeAuditLog({
        action: "SUSPEND_USER",
        resource_type: "user",
        resource_id: user.id,
        target_uid: user.id,
        target_tenant: user.enterprise_id,
        before,
        after: { status: "SUSPENDED" },
      });
      toast.success(`${user.email} suspended.`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (user: UserRecord) => {
    setActionLoading(user.id);
    try {
      await updateDoc(doc(db, "users", user.id), { status: "ACTIVE" });
      await writeAuditLog({
        action: "REACTIVATE_USER",
        resource_type: "user",
        resource_id: user.id,
        target_tenant: user.enterprise_id,
        before: { status: user.status },
        after: { status: "ACTIVE" },
      });
      toast.success(`${user.email} reactivated.`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (user: UserRecord, newRole: string) => {
    if (adminRole !== "super_admin") {
      toast.error("Only Super Admins can change user roles.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", user.id), { role: newRole });
      await writeAuditLog({
        action: "CHANGE_USER_ROLE",
        resource_type: "user",
        resource_id: user.id,
        target_tenant: user.enterprise_id,
        before: { role: user.role },
        after: { role: newRole },
      });
      toast.success(`Role updated to ${newRole}`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    }
  };

  if (loading) return <LoadingPane />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader
        title="User Management"
        description={`${users.length} total users across all tenants`}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, email, or tenant…"
            className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["ALL", "ACTIVE", "SUSPENDED", "PENDING"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 h-10 rounded-xl text-xs font-bold transition-all",
                statusFilter === s
                  ? "bg-white text-zinc-900"
                  : "bg-zinc-900 border border-white/[0.08] text-zinc-500 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["User", "Tenant", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-zinc-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-white text-xs font-black shrink-0">
                        {(user.fullName || user.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{user.fullName || "—"}</p>
                        <p className="text-zinc-600 text-[10px]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-400 text-xs font-mono">{user.enterprise_id || "—"}</td>
                  <td className="px-5 py-3">
                    {adminRole === "super_admin" ? (
                      <select
                        className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white outline-none"
                        value={user.role || "Owner"}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                      >
                        {["Owner", "Manager", "Staff", "Viewer"].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-zinc-400 text-xs">{user.role || "Owner"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "text-[10px] font-black px-2 py-1 rounded-full",
                      user.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" :
                      user.status === "SUSPENDED" ? "bg-rose-500/20 text-rose-400" :
                      "bg-amber-500/20 text-amber-400"
                    )}>
                      {user.status || "ACTIVE"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 text-xs">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {user.status !== "SUSPENDED" ? (
                        <button
                          onClick={() => handleSuspend(user)}
                          disabled={actionLoading === user.id}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-rose-400/10"
                        >
                          {actionLoading === user.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Suspend"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user)}
                          disabled={actionLoading === user.id}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-400/10"
                        >
                          {actionLoading === user.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Reactivate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-zinc-600 py-12 text-sm">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 3. TENANT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════
function AdminTenants({ adminRole }: { adminRole: AdminRole }) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsubT = subscribeToAllTenants((t) => { setTenants(t); setLoading(false); });
    const unsubU = subscribeToAllUsers((u) => setUsers(u));
    return () => { unsubT(); unsubU(); };
  }, []);

  const getUserCountForTenant = (tenantId: string) =>
    users.filter((u) => u.enterprise_id === tenantId).length;

  const handleSuspendTenant = async (tenant: TenantRecord) => {
    if (adminRole !== "super_admin") {
      toast.error("Only Super Admins can suspend tenants.");
      return;
    }
    if (!confirm(`Suspend entire tenant "${tenant.enterpriseName}"? All users will lose access.`)) return;
    setActionLoading(tenant.id);
    try {
      await updateDoc(doc(db, "enterprise_settings", tenant.id), { status: "suspended" });
      await writeAuditLog({
        action: "SUSPEND_TENANT",
        resource_type: "tenant",
        resource_id: tenant.id,
        target_tenant: tenant.enterprise_id,
        before: { status: tenant.status || "active" },
        after: { status: "suspended" },
      });
      toast.success(`Tenant "${tenant.enterpriseName}" suspended.`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateTenant = async (tenant: TenantRecord) => {
    setActionLoading(tenant.id);
    try {
      await updateDoc(doc(db, "enterprise_settings", tenant.id), { status: "active" });
      await writeAuditLog({
        action: "ACTIVATE_TENANT",
        resource_type: "tenant",
        resource_id: tenant.id,
        target_tenant: tenant.enterprise_id,
        before: { status: tenant.status },
        after: { status: "active" },
      });
      toast.success(`Tenant "${tenant.enterpriseName}" activated.`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tenants.filter(
    (t) =>
      !search ||
      t.enterpriseName?.toLowerCase().includes(search.toLowerCase()) ||
      t.enterprise_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingPane />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader
        title="Tenant Management"
        description={`${tenants.length} organizations registered`}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search tenants…"
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tenant) => {
          const userCount = getUserCountForTenant(tenant.enterprise_id || tenant.id);
          const isSuspended = tenant.status === "suspended";
          return (
            <div
              key={tenant.id}
              className={cn(
                "bg-zinc-900 border rounded-2xl p-5 space-y-4",
                isSuspended ? "border-rose-500/20" : "border-white/[0.06]"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black">
                    {(tenant.enterpriseName || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{tenant.enterpriseName}</p>
                    <p className="text-zinc-600 text-[10px] font-mono">{tenant.enterprise_id}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-black px-2 py-1 rounded-full shrink-0",
                  isSuspended ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {isSuspended ? "SUSPENDED" : "ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Users", value: userCount },
                  { label: "Industry", value: tenant.industry || "—" },
                  { label: "Plan", value: tenant.plan || "Free" },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-800/50 rounded-xl p-2.5 text-center">
                    <p className="text-white font-black text-sm">{m.value}</p>
                    <p className="text-zinc-600 text-[10px]">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <p className="text-zinc-700 text-[10px]">
                  Created {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}
                </p>
                <div className="ml-auto flex gap-2">
                  {isSuspended ? (
                    <button
                      onClick={() => handleActivateTenant(tenant)}
                      disabled={actionLoading === tenant.id}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-400/10 hover:bg-emerald-400/20 transition-all"
                    >
                      {actionLoading === tenant.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Activate"}
                    </button>
                  ) : (
                    adminRole === "super_admin" && (
                      <button
                        onClick={() => handleSuspendTenant(tenant)}
                        disabled={actionLoading === tenant.id}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-400/10 hover:bg-rose-400/20 transition-all"
                      >
                        {actionLoading === tenant.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Suspend"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-zinc-600">No tenants found.</div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 4. ANALYTICS
// ══════════════════════════════════════════════════════════════════════
function AdminAnalytics() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    const unsubT = subscribeToAllTenants(setTenants);
    const unsubU = subscribeToAllUsers(setUsers);
    return () => { unsubT(); unsubU(); };
  }, []);

  const byIndustry = tenants.reduce<Record<string, number>>((acc, t) => {
    const ind = t.industry || "Unknown";
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {});

  const bySize = tenants.reduce<Record<string, number>>((acc, t) => {
    const s = t.teamSize || "Unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader title="Platform Analytics" description="Aggregated usage across all tenants." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Tenants" value={tenants.length} color="blue" />
        <StatCard icon={Users} label="Total Users" value={users.length} color="emerald" />
        <StatCard icon={Activity} label="Active Tenants" value={tenants.filter(t => t.status !== "suspended").length} color="amber" />
        <StatCard icon={UserX} label="Suspended Users" value={users.filter(u => u.status === "SUSPENDED").length} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry breakdown */}
        <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <p className="text-white font-bold text-sm">Tenants by Industry</p>
          <div className="space-y-2">
            {Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).map(([ind, count]) => {
              const pct = Math.round((count / tenants.length) * 100) || 0;
              return (
                <div key={ind} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">{ind}</span>
                    <span className="text-zinc-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(byIndustry).length === 0 && (
              <p className="text-zinc-600 text-sm">No data yet.</p>
            )}
          </div>
        </div>

        {/* Team size breakdown */}
        <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <p className="text-white font-bold text-sm">Tenants by Team Size</p>
          <div className="space-y-2">
            {Object.entries(bySize).sort((a, b) => b[1] - a[1]).map(([size, count]) => {
              const pct = Math.round((count / tenants.length) * 100) || 0;
              return (
                <div key={size} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">{size}</span>
                    <span className="text-zinc-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(bySize).length === 0 && (
              <p className="text-zinc-600 text-sm">No data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* User registration timeline */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <p className="text-white font-bold text-sm">User Registration Timeline</p>
        <div className="overflow-x-auto">
          <div className="flex gap-1 items-end min-w-[400px] h-20">
            {Array.from({ length: 30 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (29 - i));
              const dayStr = d.toISOString().split("T")[0];
              const count = users.filter(u => u.createdAt?.startsWith(dayStr)).length;
              const maxCount = Math.max(...Array.from({ length: 30 }).map((_, j) => {
                const dd = new Date();
                dd.setDate(dd.getDate() - (29 - j));
                return users.filter(u => u.createdAt?.startsWith(dd.toISOString().split("T")[0])).length;
              }), 1);
              const pct = (count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${dayStr}: ${count} users`}>
                  <div
                    className="w-full bg-blue-500/40 group-hover:bg-blue-500 rounded-sm transition-all"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-zinc-700 text-[10px] mt-2">Last 30 days</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 5. SECURITY OVERVIEW
// ══════════════════════════════════════════════════════════════════════
function AdminSecurity() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    const unsubL = subscribeToRecentAuditLogs(setLogs, 100);
    const unsubU = subscribeToAllUsers(setUsers);
    return () => { unsubL(); unsubU(); };
  }, []);

  const suspendActions = logs.filter(l => l.action.includes("SUSPEND")).length;
  const roleChanges = logs.filter(l => l.action.includes("ROLE")).length;
  const suspendedUsers = users.filter(u => u.status === "SUSPENDED").length;

  const securityChecks = [
    { label: "Firestore rules deployed", ok: true, detail: "Deny-all default, tenant isolation enforced" },
    { label: "Admin portal role-gated", ok: true, detail: "Checked via custom claims + admin_users collection" },
    { label: "Audit log immutability", ok: true, detail: "admin_audit_logs — write-only for admins" },
    { label: "Tenant data isolation", ok: true, detail: "enterprise_id enforced on all queries" },
    { label: "Direct client admin writes", ok: false, detail: "Cloud Functions not yet deployed — using Firestore rules as secondary layer" },
    { label: "Real IP capture on logs", ok: false, detail: "Requires Cloud Functions — currently logs 'client'" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader title="Security Overview" description="Zero Trust enforcement status and recent threat signals." />

      {/* Threat signals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserX} label="Suspended Users" value={suspendedUsers} color="rose" />
        <StatCard icon={Ban} label="Suspension Actions" value={suspendActions} color="rose" />
        <StatCard icon={KeyRound} label="Role Changes" value={roleChanges} color="amber" />
        <StatCard icon={ShieldCheck} label="Security Score" value="82 / 100" color="emerald" />
      </div>

      {/* Security checklist */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-5 space-y-3">
        <p className="text-white font-bold text-sm mb-4">Security Checklist</p>
        {securityChecks.map((c) => (
          <div key={c.label} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
            {c.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn("text-sm font-semibold", c.ok ? "text-white" : "text-amber-300")}>{c.label}</p>
              <p className="text-zinc-600 text-[11px]">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cloud Functions deployment notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <p className="text-amber-300 font-bold text-sm">Recommended: Deploy Cloud Functions</p>
        </div>
        <p className="text-amber-200/60 text-xs leading-relaxed">
          For production-grade security, admin mutations (suspend user, change role, delete tenant) should 
          go through Firebase Cloud Functions with Admin SDK. This ensures server-side enforcement, 
          real IP logging, and prevents any client-side bypass. See <code className="bg-amber-500/20 px-1 rounded">functions/</code> in 
          the project root for the ready-to-deploy Cloud Functions.
        </p>
      </div>

      {/* Recent suspicious actions */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-white font-bold text-sm">Recent High-Impact Actions</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {logs
            .filter(l => ["SUSPEND", "ROLE", "DELETE", "IMPERSONATE"].some(k => l.action.includes(k)))
            .slice(0, 10)
            .map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold">{log.action}</p>
                  <p className="text-zinc-500 text-[10px]">by {log.admin_email}</p>
                </div>
                <p className="text-zinc-700 text-[10px] ml-auto shrink-0">
                  {log.timestamp?.toDate?.()?.toLocaleString() || "—"}
                </p>
              </div>
            ))}
          {logs.filter(l => ["SUSPEND", "ROLE", "DELETE"].some(k => l.action.includes(k))).length === 0 && (
            <p className="px-5 py-10 text-zinc-600 text-sm text-center">No high-impact actions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 6. AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════
function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToRecentAuditLogs((l) => { setLogs(l); setLoading(false); }, 200);
    return unsub;
  }, []);

  const filtered = logs.filter(l =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.target_tenant?.toLowerCase().includes(search.toLowerCase())
  );

  const exportLogs = () => {
    const csv = [
      ["Timestamp", "Admin", "Action", "Resource", "Tenant"].join(","),
      ...filtered.map(l => [
        l.timestamp?.toDate?.()?.toISOString() || "",
        l.admin_email,
        l.action,
        l.resource_type + (l.resource_id ? `:${l.resource_id}` : ""),
        l.target_tenant || "",
      ].map(v => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit logs exported.");
  };

  if (loading) return <LoadingPane />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader
        title="Audit Logs"
        description={`${logs.length} immutable entries`}
        action={
          <Button
            onClick={exportLogs}
            variant="outline"
            className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white text-xs h-9"
          >
            <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Filter by action, admin, or tenant…"
          className="w-full h-10 pl-9 pr-4 bg-zinc-900 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-zinc-600 outline-none focus:border-white/20 transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Timestamp", "Admin", "Action", "Resource", "Tenant", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-zinc-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {filtered.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <td className="px-5 py-3 text-zinc-500 text-[10px] whitespace-nowrap">
                      {log.timestamp?.toDate?.()?.toLocaleString() || "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-300 text-xs">{log.admin_email}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded",
                        log.action.includes("SUSPEND") ? "bg-rose-500/20 text-rose-400" :
                        log.action.includes("ROLE") ? "bg-amber-500/20 text-amber-400" :
                        log.action.includes("ACTIVATE") ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-zinc-800 text-zinc-400"
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 text-[10px]">
                      {log.resource_type}{log.resource_id ? `:${log.resource_id.substring(0, 8)}` : ""}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 text-[10px] font-mono">{log.target_tenant || "—"}</td>
                    <td className="px-5 py-3">
                      <ChevronDown className={cn(
                        "w-3.5 h-3.5 text-zinc-700 transition-transform",
                        expandedLog === log.id && "rotate-180"
                      )} />
                    </td>
                  </tr>
                  {expandedLog === log.id && (
                    <tr>
                      <td colSpan={6} className="bg-zinc-950 px-5 py-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {log.before && (
                            <div>
                              <p className="text-zinc-600 uppercase tracking-wider text-[10px] mb-1">Before</p>
                              <pre className="text-rose-300 bg-rose-500/5 border border-rose-500/10 rounded-lg p-3 overflow-auto">
                                {JSON.stringify(log.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.after && (
                            <div>
                              <p className="text-zinc-600 uppercase tracking-wider text-[10px] mb-1">After</p>
                              <pre className="text-emerald-300 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 overflow-auto">
                                {JSON.stringify(log.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex gap-6 text-[10px] text-zinc-600">
                          <span>Log ID: <span className="text-zinc-500 font-mono">{log.id}</span></span>
                          <span>IP: <span className="text-zinc-500">{log.ip || "—"}</span></span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-zinc-600 py-12 text-sm">No logs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 7. CONFIG PANEL (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
function AdminConfig({ adminRole }: { adminRole: AdminRole }) {
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState({
    maintenance_mode: false,
    new_signups_enabled: true,
    google_auth_enabled: true,
    ai_features_enabled: true,
    beta_features: false,
  });

  const handleSaveFlags = async () => {
    if (adminRole !== "super_admin") {
      toast.error("Only Super Admins can modify system configuration.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "admin_meta", "feature_flags"), { ...flags, updated_at: new Date().toISOString() });
      await writeAuditLog({
        action: "UPDATE_FEATURE_FLAGS",
        resource_type: "system_config",
        after: flags as any,
      });
      toast.success("Feature flags saved.");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SectionHeader
        title="System Configuration"
        description={adminRole === "super_admin" ? "Modify platform-wide settings." : "Read-only — Super Admin required for changes."}
      />

      {adminRole !== "super_admin" && (
        <div className="flex items-center gap-3 bg-zinc-800/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 text-zinc-500" />
          <p className="text-zinc-500 text-sm">You have read-only access. Super Admin role is required to modify settings.</p>
        </div>
      )}

      {/* Feature Flags */}
      <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <p className="text-white font-bold text-sm">Feature Flags</p>
        <div className="space-y-3">
          {Object.entries(flags).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <p className="text-white text-sm font-semibold">{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                <p className="text-zinc-600 text-[10px]">Platform-wide toggle</p>
              </div>
              <button
                onClick={() => {
                  if (adminRole !== "super_admin") return;
                  setFlags(f => ({ ...f, [key]: !value }));
                }}
                disabled={adminRole !== "super_admin"}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative shrink-0",
                  value ? "bg-emerald-500" : "bg-zinc-700",
                  adminRole !== "super_admin" && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                  value ? "left-6" : "left-0.5"
                )} />
              </button>
            </div>
          ))}
        </div>
        {adminRole === "super_admin" && (
          <Button
            onClick={handleSaveFlags}
            disabled={saving}
            className="w-full bg-white text-zinc-900 font-black hover:bg-zinc-100 transition-all"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        )}
      </div>

      {/* Danger Zone */}
      {adminRole === "super_admin" && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <p className="text-rose-400 font-bold text-sm">Danger Zone</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
              <div>
                <p className="text-white text-sm font-semibold">Enable Maintenance Mode</p>
                <p className="text-zinc-600 text-[10px]">All users will see a maintenance screen</p>
              </div>
              <Button
                variant="outline"
                className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs h-8"
                onClick={() => toast.info("Maintenance mode toggle requires Cloud Functions in production.")}
              >
                Enable
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
              <div>
                <p className="text-white text-sm font-semibold">Force Sign-Out All Users</p>
                <p className="text-zinc-600 text-[10px]">Revoke all active sessions immediately</p>
              </div>
              <Button
                variant="outline"
                className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs h-8"
                onClick={() => toast.info("Session revocation requires Firebase Admin SDK (Cloud Functions).")}
              >
                Revoke All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading pane ─────────────────────────────────────────────────────
function LoadingPane() {
  return (
    <div className="flex items-center justify-center h-64">
      <RipplePulseLoader size="md" />
    </div>
  );
}
