import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  Wallet, 
  Settings, 
  BarChart3, 
  Sparkles,
  Truck,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  Command,
  Star,
  ChevronRight,
  History,
  Zap,
  Building2,
  Globe,
  MapPin,
  Check,
  ChevronsUpDown,
  ShieldCheck,
  Share2,
  MessageSquarePlus,
  FileText,
  ScrollText,
  LifeBuoy,
  Activity,
  Headphones,
  Trash2,
  ChevronUp,
  Lock,
  ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useModules } from "@/context/ModuleContext";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc } from "@/lib/firebase";
import { toast } from "sonner";
import { OrbitalClock } from "@/components/ui/orbital-clock";
import NotificationsMenu from "./NotificationsMenu";
import { usePendingAction } from "@/context/PendingActionContext";
import { clearMockUser, getMockUser } from "@/lib/auth-mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CommandPalette } from "./CommandPalette";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { isModuleEnabled, branding, posSession, enterpriseId, grantedOverrides, addOverride, logout, userRole, hasPermission } = useModules();
  const { setPendingAction } = usePendingAction();
  const [supportOpen, setSupportOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const [accessPrompt, setAccessPrompt] = useState<{ itemLabel: string; targetTab: string } | null>(null);
  const [overridePin, setOverridePin] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    if (!enterpriseId) return;
    const unsub = onSnapshot(
      query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snap) => setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
    );
    return () => unsub();
  }, [enterpriseId]);

  const handleOverridePin = (digit: string) => {
    if (overridePin.length >= 4) return;
    const next = overridePin + digit;
    setOverridePin(next);
    if (next.length === 4) {
      const supervisor = staffList.find(s =>
        s.pin === next &&
        (s.payGrade === "SUPERVISOR" || s.payGrade === "EXECUTIVE")
      );
      if (supervisor) {
        if (accessPrompt?.targetTab) {
          addOverride(accessPrompt.targetTab);
          setActiveTab(accessPrompt.targetTab);
          setIsMobileOpen(false);
        }
        setAccessPrompt(null);
        setOverridePin("");
        setOverrideError("");
        toast.success(`Override granted by ${supervisor.name}`);
      } else {
        setOverrideError("Invalid PIN or insufficient grade");
        setTimeout(() => { setOverridePin(""); setOverrideError(""); }, 1200);
      }
    }
  };

  // Auto-collapse logic: If open and not interacted with for 10 seconds, close (unless active)
  useEffect(() => {
    if (!supportOpen) return;
    const isOnSupportPage = activeTab.startsWith("support:");
    const timer = setTimeout(() => {
      if (!isOnSupportPage) {
        setSupportOpen(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [supportOpen, lastInteraction, activeTab]);

  const resetInactivity = () => setLastInteraction(Date.now());

  useEffect(() => {
    if (activeTab.startsWith("support:")) setSupportOpen(true);
  }, [activeTab]);

  const supportItems = [
    { id: "share",       label: "Share with friends",    icon: Share2,            accent: true },
    { id: "feedback",    label: "Suggestions & Feedback", icon: MessageSquarePlus, accent: true },
    { id: "privacy",     label: "Privacy Policy",         icon: FileText,          accent: false },
    { id: "terms",       label: "Terms & Conditions",     icon: ScrollText,        accent: false },
    { id: "help",        label: "Help Center",            icon: LifeBuoy,          accent: false },
    { id: "status",      label: "System Status",          icon: Activity,          accent: false },
    { id: "contact",     label: "Contact Support",        icon: Headphones,        accent: false },
    { id: "delete",      label: "Delete Account",         icon: Trash2,            accent: false, danger: true },
  ];

  const handleProtectedLogout = async () => {
    if (posSession && posSession.payGrade !== "EXECUTIVE" && posSession.payGrade !== "SUPERVISOR") {
      if (hasPermission("pos")) {
        toast.error("Register Still Active", {
          description: "You must close your register and end your shift on the POS page before signing out."
        });
        setActiveTab("pos");
        setPendingAction({ module: "pos", action: "CLOSE_REGISTER" });
        setIsMobileOpen(false);
        return;
      }
    }
    await logout();
  };

  const handleSupportItem = (id: string) => {
    if (id === "delete") { setShowDeleteConfirm(true); return; }
    setActiveTab(`support:${id}`);
    setIsMobileOpen(false);
  };

  const menuItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard, enabled: true },
    { id: "crm", label: "Customers", icon: Users, enabled: isModuleEnabled("crm") && hasPermission("crm") },
    { id: "suppliers", label: "Suppliers", icon: Truck, enabled: isModuleEnabled("inventory") && hasPermission("inventory") },
    { id: "pos", label: "Point of Sale", icon: ShoppingCart, enabled: isModuleEnabled("pos") && hasPermission("pos") },
    { id: "inventory", label: "Stock Management", icon: Package, enabled: isModuleEnabled("inventory") && hasPermission("inventory") },
    { id: "finance", label: "Revenue", icon: Wallet, enabled: isModuleEnabled("finance") && hasPermission("finance") },
    { id: "workflow", label: "Workflows", icon: Zap, enabled: isModuleEnabled("workflow") && hasPermission("workflow") },
    { id: "groups", label: "Groups", icon: Command, enabled: isModuleEnabled("groups") && hasPermission("groups") },
    { id: "loyalty", label: "Loyalty", icon: Star, enabled: isModuleEnabled("loyalty") && hasPermission("loyalty") },
    { id: "analytics", label: "Intelligence", icon: BarChart3, enabled: isModuleEnabled("analytics") && hasPermission("analytics") },
    { id: "ai", label: "Copilot", icon: Sparkles, enabled: isModuleEnabled("ai") && hasPermission("ai") },
    { id: "audit_logs", label: "Audit Logs", icon: History, enabled: isModuleEnabled("audit_logs") && hasPermission("audit_logs") },
    { id: "staff", label: "Staff", icon: ShieldCheck, enabled: hasPermission("staff") },
    { id: "settings", label: "System", icon: Settings, enabled: hasPermission("settings") },
  ].filter(item => item.enabled);

  // ── Dynamic Access Control ───────────────────────────────────────
  // Auto-redirect if user lands on a restricted page or loses access dynamically
  useEffect(() => {
    if (activeTab === "dashboard" || activeTab.startsWith("support:")) return;
    
    // special case for settings which requires admin
    if (activeTab === "settings" && !hasPermission("settings", "admin")) {
      setActiveTab("dashboard");
      return;
    }
    
    if (!hasPermission(activeTab) && !grantedOverrides.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, hasPermission, grantedOverrides]);

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transition-all duration-500 ease-in-out lg:translate-x-0 p-4",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full bg-zinc-950 rounded-3xl flex flex-col overflow-hidden border border-zinc-800 shadow-2xl">
          {/* Brand */}
          <div className="p-8">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300">
                {branding.logo ? (
                  <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                      <Command className="w-6 h-6" />
                   </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-white tracking-tight font-display truncate">{branding.name || 'Orivo CRM'}</h1>
                <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Enterprise Suite</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 px-4 overflow-y-auto overscroll-contain transition-all duration-300 hide-scrollbar scroll-smooth">
            <div className="space-y-6 py-4">
              <div>
                <p className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Main Menu</p>
                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const isExecutive = posSession?.payGrade === "EXECUTIVE";
                    const isSupervisor = posSession?.payGrade === "SUPERVISOR";
                    
                    const isLocked = (() => {
                      if (isExecutive || userRole === "Owner") return false;
                      if (grantedOverrides.includes(item.id)) return false;
                      
                      // Check if they have at least viewer access to even see the button
                      // If they have NO access, it's filtered out by .filter(item.enabled) above.
                      // If they have viewer access, they can see it.
                      // If it's a critical area like settings, we might still want to show it as locked for lower tiers.
                      
                      if (item.id === "settings") return !hasPermission("settings", "admin");
                      
                      return !hasPermission(item.id);
                    })();

                    const requiredGrade = item.id === "settings" ? "EXECUTIVE" : "SUPERVISOR";

                    return (
                      <button
                        key={item.id}
                        title={isLocked ? `${item.label} — Requires ${requiredGrade} grade or above` : undefined}
                        onClick={() => {
                          if (isLocked) {
                            setAccessPrompt({ itemLabel: item.label, targetTab: item.id });
                            return;
                          }
                          setActiveTab(item.id);
                          setIsMobileOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                          isLocked
                            ? "opacity-30 cursor-not-allowed text-zinc-600 hover:opacity-40 hover:bg-zinc-800/20"
                            : activeTab === item.id 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className={cn(
                            "w-5 h-5 transition-colors",
                            isLocked ? "text-zinc-700" : activeTab === item.id ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                          )} />
                          <span>{item.label}</span>
                        </div>
                        {isLocked ? (
                          <div className="relative">
                            <Lock className="w-3 h-3 text-zinc-700" />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 w-max max-w-[160px] px-2.5 py-1.5 bg-zinc-950 text-white text-[10px] font-bold rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 border border-zinc-800 scale-90 group-hover:scale-100 origin-right">
                              Requires {requiredGrade}+
                              <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-zinc-950 border-r border-t border-zinc-800 rotate-45" />
                            </div>
                          </div>
                        ) : activeTab === item.id ? (
                          <motion.div layoutId="active-pill" className="w-1.5 h-1.5 rounded-full bg-white" />
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="px-4 py-4 bg-zinc-800/30 rounded-2xl border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">AI Status</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Neural Engine</span>
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0">Online</Badge>
                </div>
              </div>

              {/* ── SUPPORT SECTION ── */}
              <div onMouseMove={resetInactivity}>
                <button
                  onClick={() => setSupportOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 hover:text-zinc-400 transition-colors group"
                >
                  <span>Support</span>
                  <ChevronUp className={cn(
                    "w-3 h-3 transition-transform duration-300",
                    supportOpen ? "rotate-0" : "rotate-180"
                  )} />
                </button>

                <motion.div
                  onMouseMove={resetInactivity}
                  initial={false}
                  animate={{ height: supportOpen ? "auto" : 0, opacity: supportOpen ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <nav className="space-y-0.5">
                    {supportItems.map((item) => {
                      const isActive = activeTab === `support:${item.id}`;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSupportItem(item.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                            item.danger
                              ? "text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10"
                              : isActive
                              ? "bg-zinc-800 text-white"
                              : item.accent
                              ? "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          )}
                        >
                          <item.icon className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            item.danger
                              ? "text-zinc-600 group-hover:text-rose-400"
                              : item.accent
                              ? "text-cyan-400"
                              : isActive
                              ? "text-white"
                              : "text-zinc-500 group-hover:text-zinc-300"
                          )} />
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <motion.div layoutId="support-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </motion.div>
              </div>

            </div>
          </div>

          {/* Supervisor Override Dialog */}
          <Dialog open={!!accessPrompt} onOpenChange={(open) => { if (!open) { setAccessPrompt(null); setOverridePin(""); setOverrideError(""); } }}>
            <DialogContent className="sm:max-w-[360px] rounded-3xl border-amber-100 p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 border-b border-amber-100">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <DialogTitle className="text-xl font-bold text-zinc-900">
                  {accessPrompt?.targetTab === "settings" ? "Executive Access Required" : "Supervisor Required"}
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-500 mt-1">
                  <strong className="text-zinc-700">{accessPrompt?.itemLabel}</strong> requires {accessPrompt?.targetTab === "settings" ? "EXECUTIVE" : "SUPERVISOR or EXECUTIVE"} grade access.
                  <br /><br />
                  Enter an authorized PIN to override and continue.
                </DialogDescription>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex justify-center gap-3">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all duration-150",
                      overrideError ? "bg-rose-500 border-rose-500 animate-pulse" : overridePin.length > i ? "bg-amber-500 border-amber-500" : "border-zinc-300"
                    )} />
                  ))}
                </div>
                {overrideError && (
                  <p className="text-center text-xs font-bold text-rose-500">{overrideError}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onClick={() => handleOverridePin(n.toString())}
                      className="h-12 rounded-xl border border-zinc-200 bg-white text-zinc-900 font-bold text-lg hover:bg-amber-50 hover:border-amber-200 transition-all active:scale-95 shadow-sm">
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setOverridePin("")} className="h-12 rounded-xl border border-zinc-200 bg-white text-zinc-500 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 transition-all active:scale-95">Clear</button>
                  <button onClick={() => handleOverridePin("0")} className="h-12 rounded-xl border border-zinc-200 bg-white text-zinc-900 font-bold text-lg hover:bg-amber-50 hover:border-amber-200 transition-all active:scale-95 shadow-sm">0</button>
                  <button onClick={() => setOverridePin(p => p.slice(0,-1))} className="h-12 rounded-xl border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50 transition-all active:scale-95">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Account Confirm Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="sm:max-w-[400px] rounded-3xl border-rose-100 p-6">
              <DialogHeader>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-4 border border-rose-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <DialogTitle className="text-xl font-bold text-zinc-900">Delete Account?</DialogTitle>
                <DialogDescription className="text-sm text-zinc-500 mt-1">
                  This action is <strong>permanent and irreversible</strong>. All your enterprise data, branches, customers, and transactions will be permanently erased.
                  <br /><br />
                  Please contact <strong>support@orivo.app</strong> or use the Contact Support page to initiate an account deletion request reviewed by our team.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl border-zinc-200 font-bold">Cancel</Button>
                <Button
                  onClick={() => { setShowDeleteConfirm(false); setActiveTab("support:contact"); setIsMobileOpen(false); }}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 font-bold"
                >
                  Contact Support
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Active POS Session Indicator */}
          {posSession && activeTab !== "pos" && (
            <div className="mx-4 mb-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Terminal Active</p>
                <p className="text-xs font-semibold text-zinc-300 truncate">{posSession.staffName}</p>
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{posSession.payGrade}</p>
              </div>
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
          )}

          {/* Clock */}
          <div className="hidden lg:flex justify-center py-2">
            <div className="scale-[0.65] origin-center h-40 flex items-center justify-center">
              <OrbitalClock />
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 mt-auto">
            <div className="p-4 bg-zinc-800/40 rounded-2xl border border-zinc-700/30 flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-zinc-700/50 ring-2 ring-blue-500/20">
                <AvatarImage src={auth.currentUser?.photoURL || "https://picsum.photos/seed/user/200"} />
                <AvatarFallback className="bg-zinc-800 text-zinc-400">
                  {auth.currentUser?.displayName?.charAt(0) || auth.currentUser?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {auth.currentUser?.displayName || "User"}
                </p>
                <p className="text-[10px] text-zinc-500 truncate font-mono uppercase">
                  {auth.currentUser?.email}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleProtectedLogout}
                className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Header({ onMenuClick, setActiveTab, activeTab }: { onMenuClick: () => void, setActiveTab?: (tab: string) => void, activeTab?: string }) {
  const { activeBranch, setActiveBranch, hasActiveTransaction, currency, setCurrency, formatCurrency, enterpriseId, posSession, updateShiftStatus, clearSession, shiftTimePolicies, logout } = useModules();
  const { setPendingAction } = usePendingAction();
  const [branches, setBranches] = useState<any[]>([]);
  const [pendingBranchTarget, setPendingBranchTarget] = useState<string | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-Currency Detection State
  const [detectedCurrency, setDetectedCurrency] = useState<string | null>(null);

  useEffect(() => {
    if (!enterpriseId) return;
    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubBranches();
  }, [enterpriseId]);

  useEffect(() => {
    // Check if we already prompted the user
    if (localStorage.getItem("crm_currency_prompted")) return;

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let localCurrency = "USD";
      if (timeZone.includes("Jamaica")) localCurrency = "JMD";
      else if (timeZone.includes("Port_of_Spain")) localCurrency = "TTD";
      else if (timeZone.includes("Antigua") || timeZone.includes("St_Lucia") || timeZone.includes("Grenada")) localCurrency = "XCD";
      else if (timeZone.includes("Barbados")) localCurrency = "BBD";
      else if (timeZone.includes("Nassau")) localCurrency = "BSD";

      if (localCurrency !== currency) {
        setDetectedCurrency(localCurrency);
      }
    } catch (e) {
      console.warn("Timezone detection unavailable");
    }
  }, [currency]);

  const acceptCurrencySwitch = () => {
    if (detectedCurrency) {
      setCurrency(detectedCurrency);
      localStorage.setItem("crm_currency_prompted", "true");
      setDetectedCurrency(null);
      toast.success(`Currency switched to ${detectedCurrency}`);
    }
  };

  const declineCurrencySwitch = () => {
    localStorage.setItem("crm_currency_prompted", "true");
    setDetectedCurrency(null);
  };

  const handleBranchSelect = (branchId: string) => {
    if (hasActiveTransaction && branchId !== activeBranch) {
      setPendingBranchTarget(branchId);
    } else {
      setActiveBranch(branchId);
    }
  };

  const confirmBranchSwitch = () => {
    if (pendingBranchTarget) {
      setActiveBranch(pendingBranchTarget);
      setPendingBranchTarget(null);
    }
  };

  const activeBranchName = activeBranch === "all" ? "Global Operations" : branches.find((b: { id: string, name: string }) => b.id === activeBranch)?.name || "Main Branch";

  // ── Shift Lock Overlay Logic ────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [overTime, setOverTime] = useState(false);
  const isOnShiftBreak = posSession && posSession.shiftStatus !== "ACTIVE";

  useEffect(() => {
    if (!isOnShiftBreak || !posSession?.statusSince) { setElapsed(0); setOverTime(false); return; }
    const tick = setInterval(() => {
      const secs = Math.floor((Date.now() - new Date(posSession.statusSince).getTime()) / 1000);
      setElapsed(secs);
      const allowedMins = posSession.shiftStatus === "ON_BREAK" ? shiftTimePolicies.breakDuration
        : posSession.shiftStatus === "ON_LUNCH" ? shiftTimePolicies.lunchDuration
        : shiftTimePolicies.meetingDuration;
      const graceSecs = shiftTimePolicies.gracePeriod * 60;
      setOverTime(secs > (allowedMins * 60) + graceSecs);
    }, 1000);
    return () => clearInterval(tick);
  }, [isOnShiftBreak, posSession?.statusSince, posSession?.shiftStatus, shiftTimePolicies]);

  const handleReturnToWork = async () => {
    if (!posSession?.sessionId) return;
    try {
      const newStatus = "ACTIVE";
      await updateDoc(doc(db, "pos_sessions", posSession.sessionId), {
        status: newStatus, lastActivity: new Date().toISOString(), enterprise_id: enterpriseId
      });
      await addDoc(collection(db, "audit_logs"), {
        action: "Shift Status Change",
        details: `${posSession.staffName} returned to work from ${posSession.shiftStatus}`,
        timestamp: new Date().toISOString(), user: posSession.staffName, enterprise_id: enterpriseId
      });
      updateShiftStatus(newStatus);
      toast.success("Welcome back! Status set to Active.");
    } catch(e: any) { 
       toast.error(e.message?.includes("permissions") ? "Permission Denied" : "Failed to update status."); 
    }
  };

  const handleProtectedLogout = async () => {
    if (posSession && posSession.payGrade !== "EXECUTIVE" && posSession.payGrade !== "SUPERVISOR") {
      toast.error("Register Still Active", {
        description: "Standard accounts must close their register before signing out. Opening settlement..."
      });
      setActiveTab?.("pos");
      setPendingAction({ module: "pos", action: "CLOSE_REGISTER" });
      return;
    }
    await logout();
  };

  const fmtSecs = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const statusMeta = {
    ON_BREAK:   { label: "On Break",     emoji: "☕", ringColor: "ring-amber-500",  textColor: "text-amber-400",  badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/30",  gradientCls: "from-amber-950 via-zinc-950 to-zinc-950" },
    ON_LUNCH:   { label: "Lunch Break",  emoji: "🍽️", ringColor: "ring-sky-500",    textColor: "text-sky-400",    badgeCls: "bg-sky-500/20 text-sky-300 border-sky-500/30",        gradientCls: "from-sky-950 via-zinc-950 to-zinc-950" },
    IN_MEETING: { label: "In Meeting",   emoji: "📋", ringColor: "ring-purple-500", textColor: "text-purple-400", badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/30", gradientCls: "from-purple-950 via-zinc-950 to-zinc-950" },
  } as const;
  const currentMeta = (posSession?.shiftStatus && posSession.shiftStatus !== "ACTIVE") ? statusMeta[posSession.shiftStatus as keyof typeof statusMeta] : null;

  return (
    <>
      <AnimatePresence>
        {isOnShiftBreak && currentMeta && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-gradient-to-b", currentMeta.gradientCls)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg space-y-12 text-center"
            >
              <div className="space-y-4">
                <Badge className={cn("px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-[0.2em]", currentMeta.badgeCls)}>
                  {currentMeta.label}
                </Badge>
                <h2 className="text-5xl font-black text-white tracking-tight flex items-center justify-center gap-4">
                  {currentMeta.emoji} Status Locked
                </h2>
                <p className="text-zinc-400 font-medium">Please select Return to Work once your session is complete.</p>
              </div>

              <div className="relative flex items-center justify-center py-12">
                <div className={cn(
                  "w-64 h-64 rounded-full border-4 border-zinc-900 flex flex-col items-center justify-center relative transition-all duration-500",
                  currentMeta.ringColor,
                  overTime && "animate-pulse scale-105 ring-8 ring-rose-500/30 border-rose-900"
                )}>
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] absolute top-12">Elapsed Time</span>
                  <span className={cn("text-6xl font-black tracking-tighter", currentMeta.textColor, overTime && "text-rose-400")}>
                    {fmtSecs(elapsed)}
                  </span>
                  {overTime && (
                    <motion.span 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-rose-400 text-[10px] font-black uppercase tracking-widest absolute bottom-12"
                    >
                      Over Allotted Time
                    </motion.span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button 
                  size="lg"
                  className="h-16 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 font-black text-sm transition-all active:scale-95 shadow-2xl shadow-white/10"
                  onClick={handleReturnToWork}
                >
                  <Zap className="w-4 h-4 mr-2 fill-current" />
                  Return to Work
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="h-16 rounded-2xl border-zinc-800 bg-zinc-900/50 text-white hover:bg-zinc-800 font-bold text-sm transition-all"
                  onClick={() => {
                    setActiveTab?.("pos");
                    updateShiftStatus("ACTIVE");
                    setPendingAction({ module: "pos", action: "CLOSE_REGISTER" });
                  }}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Registry Check Off
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="h-16 rounded-2xl border-zinc-800 bg-zinc-900/50 text-white hover:bg-rose-900/20 hover:text-rose-400 hover:border-rose-900 font-bold text-sm transition-all"
                  onClick={handleProtectedLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out of Website
                </Button>
              </div>
              
              <p className="text-zinc-600 text-[10px] font-medium tracking-widest uppercase">
                Enterprise ID: {enterpriseId?.substring(0,12)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between px-6 lg:px-10 bg-zinc-50/80 backdrop-blur-xl border-b border-zinc-200/50">
      <div className="flex items-center gap-6 flex-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden hover:bg-zinc-200" 
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        {/* FIX: Search bar now visible on mobile — field staff on tablets need quick search access */}
        <button
          onClick={() => setCmdPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-full border border-zinc-200/50 w-full max-w-[160px] sm:max-w-xs md:max-w-md group hover:ring-2 hover:ring-blue-500/20 hover:border-blue-500/50 transition-all duration-300 text-left"
        >
          <Search className="w-4 h-4 text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
          <span className="bg-transparent border-none outline-none text-sm w-full text-zinc-400 min-w-0 select-none">Search or jump to...</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100 shrink-0">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger 
            render={
              <button className="hidden sm:flex items-center gap-2 h-auto py-1.5 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:text-zinc-900 shadow-sm transition-all text-left outline-none focus:ring-2 focus:ring-blue-500/20">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center border",
                    activeBranch === "all" ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                  )}>
                    {activeBranch === "all" ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-0.5">
                      {activeBranch === "all" ? "Business View" : "Location View"}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 leading-none">{activeBranchName}</span>
                  </div>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 ml-2" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-[280px] rounded-2xl p-2 border-zinc-200 shadow-xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2 py-1.5 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                Organizational Scope
              </DropdownMenuLabel>
              
              <DropdownMenuItem 
                className={cn("rounded-xl p-2 mb-1 cursor-pointer transition-colors", activeBranch === "all" && "bg-indigo-50/50")}
                onClick={() => handleBranchSelect("all")}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200/50">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-zinc-900">Global Operations</span>
                      <span className="text-[10px] text-zinc-500 font-medium">All Branches & Teams</span>
                    </div>
                  </div>
                  {activeBranch === "all" && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-zinc-100" />
            
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1.5">
                Specific Locations
              </DropdownMenuLabel>

              <ScrollArea className="max-h-[240px]">
                {branches.map(branch => (
                  <DropdownMenuItem 
                    key={branch.id} 
                    className={cn("rounded-xl p-2 cursor-pointer transition-colors", activeBranch === branch.id && "bg-emerald-50/50")}
                    onClick={() => handleBranchSelect(branch.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200/50">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-900">{branch.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium capitalize">{branch.parish || 'Branch Location'} • {branch.status || 'Active'}</span>
                        </div>
                      </div>
                      {activeBranch === branch.id && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* POS Operator Session Chip */}
        {posSession && activeTab !== "pos" && (
          <DropdownMenu>
            <DropdownMenuTrigger 
              render={
                <button className="outline-none appearance-none border-none bg-transparent p-0 text-left">
                  <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 shadow-sm hover:bg-emerald-100/50 transition-colors cursor-pointer">
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                        {posSession.staffName.substring(0,2).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                    </div>
                    <div className="flex flex-col leading-none text-left">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Terminal Active</span>
                      <span className="text-xs font-bold text-zinc-800 leading-tight truncate max-w-[80px]">{posSession.staffName}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border shrink-0",
                      posSession.payGrade === "EXECUTIVE" ? "bg-purple-50 text-purple-600 border-purple-200" :
                      posSession.payGrade === "SUPERVISOR" ? "bg-blue-50 text-blue-600 border-blue-200" :
                      "bg-zinc-100 text-zinc-500 border-zinc-200"
                    )}>{posSession.payGrade}</span>
                  </div>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-zinc-200 shadow-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1.5">
                  Shift Operations
                </DropdownMenuLabel>
                <DropdownMenuItem 
                  className="rounded-xl p-2 cursor-pointer"
                  onClick={async () => {
                    if (!posSession?.sessionId) return;
                    try {
                      const newStatus = "ON_BREAK";
                      await updateDoc(doc(db, "pos_sessions", posSession.sessionId), { 
                        status: newStatus, 
                        lastActivity: new Date().toISOString(),
                        enterprise_id: enterpriseId
                      });
                      await addDoc(collection(db, "audit_logs"), { 
                        action: "Shift Status Change", 
                        details: `${posSession.staffName} started break`, 
                        timestamp: new Date().toISOString(), 
                        user: posSession.staffName, 
                        enterprise_id: enterpriseId 
                      });
                      updateShiftStatus(newStatus);
                      toast.info("Status: On Break");
                    } catch(e: any) { 
                      console.error("Break update failed:", e);
                      toast.error(e.message?.includes("permissions") ? "Permission Denied" : "Update failed"); 
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center"><Zap className="w-4 h-4" /></div>
                    <span className="font-bold text-sm">Start Break</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="rounded-xl p-2 cursor-pointer"
                  onClick={async () => {
                    if (!posSession?.sessionId) return;
                    try {
                      const newStatus = "ON_LUNCH";
                      await updateDoc(doc(db, "pos_sessions", posSession.sessionId), { 
                        status: newStatus, 
                        lastActivity: new Date().toISOString(),
                        enterprise_id: enterpriseId
                      });
                      await addDoc(collection(db, "audit_logs"), { 
                        action: "Shift Status Change", 
                        details: `${posSession.staffName} started lunch`, 
                        timestamp: new Date().toISOString(), 
                        user: posSession.staffName, 
                        enterprise_id: enterpriseId 
                      });
                      updateShiftStatus(newStatus);
                      toast.info("Status: On Lunch");
                    } catch(e: any) { 
                      console.error("Lunch update failed:", e);
                      toast.error(e.message?.includes("permissions") ? "Update failed" : "Permission Denied"); 
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Activity className="w-4 h-4" /></div>
                    <span className="font-bold text-sm">Start Lunch</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="rounded-xl p-2 cursor-pointer"
                  onClick={() => {
                    setActiveTab?.("pos");
                    setPendingAction({ module: "pos", action: "CLOSE_REGISTER" });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center"><ClipboardCheck className="w-4 h-4" /></div>
                    <span className="font-bold text-sm">Registry Check Off</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="rounded-xl p-2 cursor-pointer"
                  onClick={async () => {
                    if (!posSession?.sessionId) return;
                    try {
                      const newStatus = "IN_MEETING";
                      await updateDoc(doc(db, "pos_sessions", posSession.sessionId), { 
                        status: newStatus, 
                        lastActivity: new Date().toISOString(),
                        enterprise_id: enterpriseId
                      });
                      await addDoc(collection(db, "audit_logs"), { 
                        action: "Shift Status Change", 
                        details: `${posSession.staffName} entered meeting`, 
                        timestamp: new Date().toISOString(), 
                        user: posSession.staffName, 
                        enterprise_id: enterpriseId 
                      });
                      updateShiftStatus(newStatus);
                      toast.info("Status: In Meeting");
                    } catch(e: any) { 
                      console.error("Meeting update failed:", e);
                      toast.error(e.message?.includes("permissions") ? "Permission Denied" : "Update failed"); 
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><Users className="w-4 h-4" /></div>
                    <span className="font-bold text-sm">Meeting</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-1 bg-zinc-100" />
              <DropdownMenuItem 
                className="rounded-xl p-3 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 border border-transparent hover:border-rose-100"
                onClick={handleProtectedLogout}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shadow-sm"><LogOut className="w-5 h-5" /></div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-sm">Sign Out of Website</span>
                    <span className="text-[10px] text-rose-400 font-medium">Exit system & go to login screen</span>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-2">
          <NotificationsMenu />
          <div className="h-8 w-[1px] bg-zinc-200 mx-2" />
          <Button variant="ghost" size="icon" className="hover:bg-zinc-200 rounded-xl" onClick={() => setActiveTab?.("settings")}>
            <Settings className="w-5 h-5 text-zinc-600" />
          </Button>
        </div>
      </div>
    </header>

    <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} setActiveTab={(tab) => { setActiveTab?.(tab); }} />

    <Dialog open={!!pendingBranchTarget} onOpenChange={(open) => !open && setPendingBranchTarget(null)}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl border-zinc-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-900">Change Location?</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            You currently have items in your active cart. Switching operation locations will flush your Point of Sale system and delete the current order in progress. 
            <br/><br/>
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={() => setPendingBranchTarget(null)}
            className="rounded-xl border-zinc-200 font-bold"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmBranchSwitch}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 font-bold"
          >
            Switch & Clear Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!detectedCurrency} onOpenChange={(open) => !open && declineCurrencySwitch()}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl border-indigo-100 p-6 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Globe className="w-48 h-48" />
        </div>
        <DialogHeader className="relative">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100">
            <Globe className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-zinc-900">Regional Settings Detected</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            We noticed you are operating from the Caribbean region. 
            <br/><br/>
            Would you like to automatically convert your display format from <strong>{currency}</strong> to <strong>{detectedCurrency}</strong> in the Point of Sale and Financial ledgers?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-8 flex gap-3 sm:justify-end relative">
          <Button 
            variant="ghost" 
            onClick={declineCurrencySwitch}
            className="rounded-xl font-bold hover:bg-zinc-100"
          >
            Keep {currency}
          </Button>
          <Button 
            onClick={acceptCurrencySwitch}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold"
          >
            Switch to {detectedCurrency}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
