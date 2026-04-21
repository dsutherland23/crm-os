import React, { useState, useEffect } from "react";
import { Sidebar, Header } from "./components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, doc, onSnapshot } from "@/lib/firebase";
import { getMockUser } from "./lib/auth-mock";

import Dashboard from "./components/Dashboard";
import AIInsights from "./components/AIInsights";
import CRM from "./components/CRM";
import POS from "./components/POS";
import Inventory from "./components/Inventory";
import Revenue from "./components/Revenue";
import Groups from "./components/Groups";
import Loyalty from "./components/Loyalty";
import Settings from "./components/Settings";
import Analytics from "./components/Analytics";
import AuditLogs from "./components/AuditLogs";
import Workflow from "./components/Workflow";
import Auth from "./components/Auth";
import StaffManager from "./components/StaffManager";
import VerificationGate from "./components/VerificationGate";
import AdminPortal from "./components/AdminPortal";
import Support from "./components/Support";
import { SocialHub } from "./components/SocialHub";
import { ModuleProvider, useModules } from "./context/ModuleContext";
import { Sparkles } from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

function AppContent() {
  // Navigate to /#/admin or append ?admin=1 to access the portal
  const isAdminRoute =
    window.location.hash.startsWith("#/admin") ||
    window.location.pathname === "/admin" ||
    new URLSearchParams(window.location.search).get("admin") === "1";
    
  const isSocialRoute = 
    window.location.pathname === "/connect" || 
    window.location.hash.startsWith("#/connect");

  if (isAdminRoute) return <AdminPortal />;
  if (isSocialRoute) return <SocialHub />;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still loading
  const [enterpriseLoading, setEnterpriseLoading] = useState(true);
  const { isModuleEnabled, setEnterpriseId, setBranding, enterpriseId, setUserRole } = useModules();

  // ── Step 1: Auth State Listener ─────────────────────────────────
  useEffect(() => {
    const mockUser = getMockUser();
    if (mockUser) {
      setUser(mockUser as unknown as User);
      setEnterpriseId("master-all");
      setBranding({ name: "Developer Mode" });
      setEnterpriseLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser); // null = logged out, User = logged in
      if (!fbUser) {
        setEnterpriseId(null);
        setEnterpriseLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // ── Step 2: Real-time Profile Listener (keyed to user.uid) ──────
  // Separate effect so cleanup works correctly — the key insight:
  // we watch the profile doc in real-time, so when Auth.tsx writes
  // the enterprise_id to Firestore, this immediately picks it up
  // and navigates the user forward without any reload.
  useEffect(() => {
    if (!user || getMockUser()) return;

    setEnterpriseLoading(true);
    const profileRef = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      profileRef,
      (docSnap) => {
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
          // Profile doesn't exist yet (mid-signup provisioning, wait for write)
          setEnterpriseId(null);
        }
        setEnterpriseLoading(false);
      },
      (err) => {
        console.error("Profile sync failed:", err);
        setEnterpriseId(null);
        setEnterpriseLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]); // Only re-run when the user ID changes

  const renderContent = () => {
    // Support sub-routes (e.g. "support:help", "support:status")
    if (activeTab.startsWith("support:")) {
      const section = activeTab.split(":")[1] as any;
      return <Support section={section} />;
    }
    switch (activeTab) {
      case "dashboard": return <Dashboard setActiveTab={setActiveTab} />;
      case "crm": return isModuleEnabled("crm") ? <CRM /> : <Dashboard setActiveTab={setActiveTab} />;
      case "revenue":
      case "finance": return isModuleEnabled("finance") ? <Revenue /> : <Dashboard setActiveTab={setActiveTab} />;
      case "groups": return <Groups />;
      case "loyalty": return <Loyalty />;
      case "pos": return isModuleEnabled("pos") ? <POS /> : <Dashboard setActiveTab={setActiveTab} />;
      case "inventory": return isModuleEnabled("inventory") ? <Inventory /> : <Dashboard setActiveTab={setActiveTab} />;
      case "analytics": return isModuleEnabled("analytics") ? <Analytics /> : <Dashboard setActiveTab={setActiveTab} />;
      case "workflow": return isModuleEnabled("workflow") ? <Workflow /> : <Dashboard setActiveTab={setActiveTab} />;
      case "audit": return isModuleEnabled("audit_logs") ? <AuditLogs /> : <Dashboard setActiveTab={setActiveTab} />;
      case "ai": return isModuleEnabled("ai") ? <AIInsights /> : <Dashboard setActiveTab={setActiveTab} />;
      case "settings": return <Settings />;
      case "staff": return <StaffManager />;
      case "support": return <Support />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  // ── Guard 1: Auth state not yet resolved ─────────────────────────
  if (user === undefined || (user && enterpriseLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative">
            <RipplePulseLoader size="lg" hideLogo={true} />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <span className="text-zinc-950 font-black text-[11px] uppercase tracking-[0.2em] translate-x-[0.1em] animate-in fade-in zoom-in duration-1000">
                ORIVO
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] ml-[0.3em]">
              {user ? "Provisioning Workspace" : "Initializing Engine"}
            </p>
            <div className="w-32 h-[1px] bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-1/3 animate-[progress_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}} />
      </div>
    );
  }

  // ── Guard 2: Not logged in ───────────────────────────────────────
  if (!user) {
    return <Auth />;
  }

  // ── Guard 3: Email not verified (only for non-mock, returning users) ─
  // IMPORTANT: We allow unverified users through if they have no enterprise yet
  // (they just finished signing up and are in the provisioning flow).
  // The VerificationGate will be shown AFTER their profile is written.
  if (!user.emailVerified && !getMockUser() && enterpriseId) {
    return <VerificationGate user={user} />;
  }

  // ── Guard 4: Verified but no enterprise profile yet ──────────────
  if (!enterpriseId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <Card className="max-w-md w-full card-modern p-6 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">Workspace not found</h2>
            <p className="text-sm text-zinc-500 mt-2">
              We couldn't find an enterprise profile linked to <strong>{user.email}</strong>.
              This can happen if setup didn't complete. Please try signing out and signing back in,
              or contact support.
            </p>
          </div>
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl text-zinc-600 font-bold hover:bg-zinc-100 transition-all"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-zinc-400 text-xs font-medium"
              onClick={() => auth.signOut()}
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Authenticated & provisioned: render the app ──────────────────
  return (
    <div className="h-screen bg-background font-sans text-foreground antialiased transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className="lg:pl-72 flex flex-col h-screen">
        <Header onMenuClick={() => setIsMobileOpen(true)} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* Global AI Copilot Floating Button */}
      {isModuleEnabled("ai") && activeTab !== "ai" && (
        <Dialog>
          <DialogTrigger
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-zinc-900 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 group z-50 p-0 flex items-center justify-center border-none cursor-pointer"
          >
            <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform text-blue-400" />
          </DialogTrigger>
          <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden rounded-[2rem] border-zinc-200/60 shadow-2xl">
            <AIInsights />
          </DialogContent>
        </Dialog>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <ModuleProvider>
      <AppContent />
    </ModuleProvider>
  );
}
