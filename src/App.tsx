import React, { useState, useEffect } from "react";
import { Sidebar, Header } from "./components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, doc, getDoc } from "@/lib/firebase";
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
import { ModuleProvider, useModules } from "./context/ModuleContext";
import { Sparkles } from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { isModuleEnabled, setEnterpriseId, setBranding, enterpriseId } = useModules();

  useEffect(() => {
    const mockUser = getMockUser();
    
    // Use mock user if developer bypass is active
    if (mockUser) {
      setUser(mockUser);
      setEnterpriseId("master-all");
      setLoading(false);
      import("./lib/seed").then(({ seedClientData }) => seedClientData("master-all"));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("Auth State Changed. User:", fbUser?.email);
      setUser(fbUser);
      try {
        if (fbUser) {
          console.log("Fetching profile for UID:", fbUser.uid);
          const userDoc = await getDoc(doc(db, "users", fbUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as any;
            console.log("Profile found:", profile);
            if (profile.enterprise_id) {
              setEnterpriseId(profile.enterprise_id);
              setBranding({ name: profile.enterpriseName || profile.enterprise_id });
              const { seedClientData } = await import("./lib/seed");
              seedClientData(profile.enterprise_id);
            } else {
              console.warn("Profile exists but enterprise_id is missing!");
              setEnterpriseId(null);
            }
          } else {
            console.warn("No user profile found in Firestore for UID:", fbUser.uid);
            setEnterpriseId(null);
          }
        } else {
          setEnterpriseId(null);
        }
      } catch (error) {
        console.error("Profile fetch failed:", error);
        setEnterpriseId(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
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
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <RipplePulseLoader size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!enterpriseId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <Card className="max-w-md w-full card-modern p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">Initialize Workspace</h2>
            <p className="text-sm text-zinc-500 mt-2">We couldn't find an existing enterprise profile for your account. Let's get you set up.</p>
          </div>
          <Button 
            className="w-full h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all shadow-lg"
            onClick={() => window.location.reload()}
          >
            Retry Synchronization
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-zinc-500 font-medium"
            onClick={() => auth.signOut()}
          >
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

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
        
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>

      {/* Global AI Copilot Floating Button */}
      {isModuleEnabled("ai") && activeTab !== "ai" && (
        <Dialog>
          <DialogTrigger
            render={
              <Button 
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-zinc-900 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 group z-50 p-0 flex items-center justify-center border-none"
              >
                <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform text-blue-400" />
              </Button>
            }
          />
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
