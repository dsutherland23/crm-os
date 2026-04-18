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
  ChevronsUpDown
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
import { collection, onSnapshot } from "@/lib/firebase";
import { toast } from "sonner";
import { OrbitalClock } from "@/components/ui/orbital-clock";
import NotificationsMenu from "./NotificationsMenu";
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

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { isModuleEnabled, branding } = useModules();

  const handleLogout = async () => {
    try {
      if (getMockUser()) {
        clearMockUser();
        toast.success("Logged out from Developer Mode");
        return;
      }
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error("Logout failed");
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard, enabled: true },
    { id: "crm", label: "Customers", icon: Users, enabled: isModuleEnabled("crm") },
    { id: "pos", label: "Point of Sale", icon: ShoppingCart, enabled: isModuleEnabled("pos") },
    { id: "inventory", label: "Stock Management", icon: Package, enabled: isModuleEnabled("inventory") },
    { id: "revenue", label: "Revenue", icon: Wallet, enabled: isModuleEnabled("finance") },
    { id: "workflow", label: "Workflows", icon: Zap, enabled: isModuleEnabled("workflow") },
    { id: "groups", label: "Groups", icon: Command, enabled: true },
    { id: "loyalty", label: "Loyalty", icon: Star, enabled: true },
    { id: "analytics", label: "Intelligence", icon: BarChart3, enabled: isModuleEnabled("analytics") },
    { id: "ai", label: "Copilot", icon: Sparkles, enabled: isModuleEnabled("ai") },
    { id: "audit", label: "Audit Logs", icon: History, enabled: isModuleEnabled("audit_logs") },
    { id: "settings", label: "System", icon: Settings, enabled: true },
  ].filter(item => item.enabled);

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
                <h1 className="text-base font-bold text-white tracking-tight font-display truncate">{branding.name || 'CRM OS'}</h1>
                <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Enterprise Suite</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-6 py-4">
              <div>
                <p className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Main Menu</p>
                <nav className="space-y-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                        activeTab === item.id 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn(
                          "w-5 h-5 transition-colors",
                          activeTab === item.id ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                        )} />
                        <span>{item.label}</span>
                      </div>
                      {activeTab === item.id && (
                        <motion.div layoutId="active-pill" className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  ))}
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
            </div>
          </ScrollArea>

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
                onClick={handleLogout}
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

export function Header({ onMenuClick, setActiveTab }: { onMenuClick: () => void, setActiveTab?: (tab: string) => void }) {
  const { activeBranch, setActiveBranch, hasActiveTransaction, currency, setCurrency, formatCurrency } = useModules();
  const [branches, setBranches] = useState<any[]>([]);
  const [pendingBranchTarget, setPendingBranchTarget] = useState<string | null>(null);

  // Auto-Currency Detection State
  const [detectedCurrency, setDetectedCurrency] = useState<string | null>(null);

  useEffect(() => {
    const unsubBranches = onSnapshot(collection(db, "branches"), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubBranches();
  }, []);

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

  return (
    <>
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
        
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full border border-zinc-200/50 w-full max-w-md group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all duration-300">
          <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search commands or ask AI..." 
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-zinc-400 text-zinc-700"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger 
            className="hidden sm:flex items-center gap-2 h-auto py-1.5 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:text-zinc-900 shadow-sm transition-all text-left outline-none focus:ring-2 focus:ring-blue-500/20"
          >
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
          </DropdownMenuTrigger>
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

        <div className="flex items-center gap-2">
          <NotificationsMenu />
          <div className="h-8 w-[1px] bg-zinc-200 mx-2" />
          <Button variant="ghost" size="icon" className="hover:bg-zinc-200 rounded-xl" onClick={() => setActiveTab?.("settings")}>
            <Settings className="w-5 h-5 text-zinc-600" />
          </Button>
        </div>
      </div>
    </header>

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
