import React, { useState, useEffect, lazy, Suspense } from "react";
import { Sidebar, Header } from "./components/Layout";
import { Toaster } from "@/components/ui/sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import NetworkIndicator from "@/components/NetworkIndicator";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, doc, onSnapshot, setDoc, addDoc, collection } from "@/lib/firebase";
import { toast } from "sonner";
import { getMockUser } from "./lib/auth-mock";

import Dashboard from "./components/Dashboard";
import AIInsights from "./components/AIInsights";
import CRM from "./components/CRM";
import POS from "./components/POS";
import Settings from "./components/Settings";
import Analytics from "./components/Analytics";
import AuditLogs from "./components/AuditLogs";
import Auth from "./components/Auth";
import StaffManager from "./components/StaffManager";
import VerificationGate from "./components/VerificationGate";
import AdminPortal from "./components/AdminPortal";
import Support from "./components/Support";
import { SocialHub } from "./components/SocialHub";

// Heavy data-intensive modules — lazy loaded so Firestore listeners only mount
// when the user actually navigates to that tab, preventing boot-time OOM risk.
const Inventory = lazy(() => import("./components/Inventory"));
const Revenue   = lazy(() => import("./components/Revenue"));
const Groups    = lazy(() => import("./components/Groups"));
const Loyalty   = lazy(() => import("./components/Loyalty"));
const Suppliers = lazy(() => import("./components/Suppliers"));
const Workflow  = lazy(() => import("./components/Workflow"));
import { ModuleProvider, useModules } from "./context/ModuleContext";
import { PendingActionProvider } from "./context/PendingActionContext";
import { Sparkles, Activity } from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AuthActionHandler from "./components/AuthActionHandler";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TrialBanner } from "@/components/ui/trial-banner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

function AppContent() {
  const isAdminRoute =
    window.location.hash.startsWith("#/admin") ||
    window.location.pathname === "/admin" ||
    new URLSearchParams(window.location.search).get("admin") === "1";
    
  const isSocialRoute = 
    window.location.pathname === "/connect" || 
    window.location.hash.startsWith("#/connect");

  const isAuthActionRoute = 
    new URLSearchParams(window.location.search).has("mode") && 
    new URLSearchParams(window.location.search).has("oobCode");

  if (isAuthActionRoute) return <AuthActionHandler />;
  if (isAdminRoute) return <AdminPortal />;
  if (isSocialRoute) return <SocialHub />;

  const [activeTab, setActiveTab] = useState("dashboard");
  const [settingsTab, setSettingsTab] = useState("modules");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [enterpriseLoading, setEnterpriseLoading] = useState(true);
  const { isModuleEnabled, setEnterpriseId, setBranding, enterpriseId, setUserRole, hasPermission, logout } = useModules();

  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleCompleteSetup = async () => {
    if (!user) return;
    setIsProvisioning(true);
    try {
      const { getDoc } = await import("firebase/firestore");
      const existingDoc = await getDoc(doc(db, "users", user.uid));
      const existingData = existingDoc.exists() ? (existingDoc.data() as any) : null;
      const slug = user.email?.split("@")[0].replace(/[^a-zA-Z0-9]/g, "-") || user.uid.substring(0, 8);
      const newEnterpriseId = existingData?.enterprise_id || `ent-${slug}`;

      const profileData = {
        fullName: existingData?.fullName || user.displayName || slug,
        email: existingData?.email || user.email || "",
        enterprise_id: newEnterpriseId,
        enterpriseName: existingData?.enterpriseName || `${user.displayName || slug}'s Organization`,
        industry: existingData?.industry || "Other",
        teamSize: existingData?.teamSize || "Just me",
        role: existingData?.role || "Owner",
        status: existingData?.status || "ACTIVE",
        createdAt: existingData?.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
      const entSettingsRef = doc(db, "enterprise_settings", newEnterpriseId);
      const entSettingsSnap = await getDoc(entSettingsRef);
      if (!entSettingsSnap.exists()) {
        await setDoc(entSettingsRef, {
          enterpriseName: profileData.enterpriseName,
          industry: profileData.industry,
          teamSize: profileData.teamSize,
          enterprise_id: newEnterpriseId,
          setupCompleted: true,
          createdAt: new Date().toISOString(),
          billing: {
            planId: "enterprise",
            userCount: profileData.teamSize === "Just me" ? 1 : 3,
            branchCount: 1,
            billingCycle: "monthly",
            status: "trialing",
            trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            renewalDate: new Date(Date.now() + 44 * 86400000).toISOString(),
            paymentMethod: { type: "Visa", last4: "—", expiry: "—" }
          }
        });

        await addDoc(collection(db, "branches"), {
          name: "Main Headquarters",
          status: "ACTIVE",
          enterprise_id: newEnterpriseId,
          parish: "Head Office",
          address: "Primary Business Location",
          createdAt: new Date().toISOString(),
        });
      }

      setEnterpriseId(newEnterpriseId);
      setBranding({ name: profileData.enterpriseName });
      setUserRole(profileData.role || "Owner");
      localStorage.removeItem("crm_enterprise_id");
      toast.success("Workspace ready! Loading your dashboard...");
    } catch (error: any) {
      console.error("Failed to complete setup", error);
      toast.error("Failed to create workspace: " + (error.message || "Unknown error"));
    } finally {
      setIsProvisioning(false);
    }
  };

  useEffect(() => {
    const mockUser = getMockUser();
    if (mockUser) {
      setUser(mockUser as unknown as User);
      setEnterpriseId("master-all");
      setBranding({ name: "Developer Mode" });
      setEnterpriseLoading(false);
      return;
    }

    (async () => {
      try {
        const { setPersistence, browserLocalPersistence } = await import("firebase/auth");
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        console.warn("Auth persistence hardening failed:", e);
      }
    })();

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setEnterpriseId(null);
        setEnterpriseLoading(false);
      } else {
        const cachedId = localStorage.getItem("crm_enterprise_id");
        if (cachedId) {
          setEnterpriseId(cachedId);
          setEnterpriseLoading(false);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || getMockUser()) return;
    setEnterpriseLoading(true);
    const profileRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data();
        if (profile.enterprise_id) {
          setEnterpriseId(profile.enterprise_id);
          setBranding({ name: profile.enterpriseName || profile.enterprise_id });
          setUserRole(profile.role || null);
        } else {
          setEnterpriseId(null);
          setUserRole(null);
        }
      } else {
        setEnterpriseId(null);
      }
      setEnterpriseLoading(false);
    }, (err) => {
      console.error("Profile sync failed:", err);
      setEnterpriseId(null);
      setEnterpriseLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const renderContent = () => {
    if (activeTab.startsWith("support:")) {
      const section = activeTab.split(":")[1] as any;
      return <Support section={section} />;
    }
    const fallback = <Dashboard setActiveTab={setActiveTab} />;
    switch (activeTab) {
      case "dashboard": return fallback;
      case "crm":       return hasPermission("crm")       ? <CRM />       : fallback;
      case "revenue":
      case "finance":   return hasPermission("finance")   ? <Revenue />   : fallback;
      case "groups":    return hasPermission("groups")    ? <Groups />    : fallback;
      case "loyalty":   return hasPermission("loyalty")   ? <Loyalty />   : fallback;
      case "pos":       return hasPermission("pos")       ? <POS />       : fallback;
      case "suppliers": return hasPermission("inventory") ? <Suppliers /> : fallback;
      case "inventory": return hasPermission("inventory") ? <Inventory /> : fallback;
      case "analytics": return hasPermission("analytics") ? <Analytics /> : fallback;
      case "workflow":  return hasPermission("workflow")  ? <Workflow />  : fallback;
      case "audit_logs": return hasPermission("audit_logs") ? <AuditLogs /> : fallback;
      case "ai":        return hasPermission("ai")        ? <AIInsights /> : fallback;
      case "settings":  return hasPermission("settings", "admin") ? <Settings defaultTab={settingsTab} /> : fallback;
      case "staff":     return hasPermission("staff", "admin")    ? <StaffManager /> : fallback;
      case "support":   return <Support />;
      default:          return fallback;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {user === undefined || (user && enterpriseLoading) ? (
        <motion.div 
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 overflow-hidden"
        >
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="relative">
              <RipplePulseLoader size="lg" hideLogo={true} />
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <span className="text-zinc-950 font-black text-[11px] uppercase tracking-[0.2em] translate-x-[0.1em] animate-in fade-in zoom-in duration-1000">ORIVO</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] ml-[0.3em]">{user ? "Provisioning Workspace" : "Initializing Engine"}</p>
              <div className="w-32 h-[1px] bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-1/3 animate-[progress_2s_ease-in-out_infinite]" /></div>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `@keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}} />
        </motion.div>
      ) : null}

      {user !== undefined && !enterpriseLoading && (
        <motion.div 
          key="app-shell"
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="contents"
        >
          <AnimatePresence mode="wait">
            {!user ? (
              <motion.div key="auth-gate" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.4 }} className="contents"><Auth /></motion.div>
            ) : !user.emailVerified && !getMockUser() && enterpriseId ? (
              <motion.div key="verification-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="contents"><VerificationGate user={user} /></motion.div>
            ) : !enterpriseId ? (
              <motion.div key="setup-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="contents">
                <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-600/5 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[100px]" />
                  </div>
                  <Card className="relative max-w-md w-full bg-zinc-900 border-zinc-800 p-6 sm:p-10 text-center space-y-6 rounded-3xl shadow-2xl">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto"><Sparkles className="w-8 h-8 text-amber-400" /></div>
                    <div><h2 className="text-2xl font-bold text-white">Workspace Setup Required</h2><p className="text-sm text-zinc-400 mt-3 leading-relaxed">No enterprise profile found for <strong className="text-zinc-200">{user.email}</strong>. Create your workspace now.</p></div>
                    <div className="space-y-3">
                      <Button className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold transition-all active:scale-95 shadow-lg shadow-amber-500/20" onClick={handleCompleteSetup} disabled={isProvisioning}>{isProvisioning ? "Creating..." : "Complete Setup"}</Button>
                      <Button variant="ghost" className="w-full h-10 rounded-xl text-zinc-500 hover:text-zinc-300 font-medium text-sm transition-all" onClick={() => window.location.reload()}>Retry</Button>
                      <Button variant="ghost" className="w-full text-zinc-600 text-xs font-medium hover:text-zinc-400" onClick={() => logout()}>Sign Out</Button>
                    </div>
                  </Card>
                </div>
              </motion.div>
            ) : (
              <motion.div key="authenticated-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="contents">
                <div className="h-screen bg-background font-sans text-foreground antialiased transition-colors duration-300">
                  <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
                  <div className="lg:pl-72 flex flex-col h-screen">
                    <Header onMenuClick={() => setIsMobileOpen(true)} setActiveTab={setActiveTab} activeTab={activeTab} />
                    <TrialBanner onUpgrade={() => { setSettingsTab("billing"); setActiveTab("settings"); }} />
                    <main className={cn("flex-1 overflow-x-hidden", activeTab === 'pos' ? "overflow-hidden" : "overflow-y-auto")}>
                      {/* Suspense for lazy-loaded heavy modules */}
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-zinc-200 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading module...</p>
                          </div>
                        </div>
                      }>
                        {renderContent()}
                      </Suspense>
                    </main>
                  </div>
                  {isModuleEnabled("ai") && activeTab !== "ai" && (
                    <Dialog><DialogTrigger className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-zinc-900 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 p-0 flex items-center justify-center border-none cursor-pointer"><Sparkles className="w-6 h-6 text-blue-400" /></DialogTrigger><DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden rounded-[2rem] border-zinc-200/60 shadow-2xl"><AIInsights /></DialogContent></Dialog>
                  )}
                  <Toaster position="top-right" />
                  <PWAInstallPrompt />
                  <NetworkIndicator />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ModuleProvider>
      <PendingActionProvider>
        <AppContent />
      </PendingActionProvider>
    </ModuleProvider>
  );
}
