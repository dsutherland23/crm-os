import React, { createContext, useContext, useState, useEffect } from "react";
import { ModuleConfig } from "../types";
import { DEFAULT_MODULE_CONFIG } from "../constants";
import { db, doc, onSnapshot, query, collection, where } from "@/lib/firebase";
import { PLAN_LIMITS } from "../constants/plan-limits";
import { toast } from "sonner";

interface ModuleContextType {
  config: ModuleConfig;
  toggleModule: (moduleName: keyof ModuleConfig) => void;
  isModuleEnabled: (moduleName: keyof ModuleConfig) => boolean;
  activeBranch: string;
  setActiveBranch: (branchId: string) => void;
  dateRange: { from: string; to: string };
  setDateRange: (range: { from: string; to: string }) => void;
  hasActiveTransaction: boolean;
  setHasActiveTransaction: (val: boolean) => void;
  currency: string;
  setCurrency: (currencyCode: string) => void;
  formatCurrency: (amount: number) => string;
  topSpenderThreshold: number;
  setTopSpenderThreshold: (amount: number) => void;
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  branding: BrandingConfig;
  setBranding: (branding: Partial<BrandingConfig>) => void;
  enterpriseId: string | null;
  setEnterpriseId: (id: string | null) => void;
  posSession: { 
    staffId: string; staffName: string; payGrade: string; 
    sessionId: string; staffData: any;
    shiftStatus: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING";
    statusSince: string; // ISO timestamp
  } | null;
  setPosSession: (session: { 
    staffId: string; staffName: string; payGrade: string; 
    sessionId: string; staffData: any;
    shiftStatus: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING";
    statusSince: string;
  } | null) => void;
  updateShiftStatus: (status: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING") => void;
  shiftTimePolicies: { breakDuration: number; lunchDuration: number; meetingDuration: number; gracePeriod: number };
  setShiftTimePolicies: (p: { breakDuration: number; lunchDuration: number; meetingDuration: number; gracePeriod: number }) => void;
  clearSession: () => void;
  grantedOverrides: string[];
  addOverride: (tabId: string) => void;
  checkLimit: (resource: "users" | "branches") => { allowed: boolean; current: number; max: number; message?: string };
  setUserRole: (role: string | null) => void;
  userRole: string | null;
  rolePermissions: Record<string, string | boolean> | null;
  hasPermission: (moduleId: string, level?: "viewer" | "editor" | "admin") => boolean;
  billing: BillingConfig;
  updateBilling: (update: Partial<BillingConfig>) => Promise<void>;
  taxRate: number;
  setTaxRate: (rate: number) => Promise<void>;
  autoCloseTime: string;
  setAutoCloseTime: (time: string) => Promise<void>;
  autoCloseEnabled: boolean;
  setAutoCloseEnabled: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

export interface BillingConfig {
  planId: string;
  userCount: number;
  branchCount: number;
  billingCycle: "monthly" | "yearly";
  renewalDate: string;
  paymentMethod: {
    type: string;
    last4: string;
    expiry: string;
  };
  status: "active" | "past_due" | "canceled" | "trialing";
  trialEndsAt?: string;
}

export interface BrandingConfig {
  name: string;
  logo: string;
  email: string;
  phone: string;
  officePhone: string;
  address: string;
  socials: {
    facebook: string;
    instagram: string;
    twitter: string;
    website: string;
  };
  disclaimer: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  name: "ORIVOCRM PRO",
  logo: "",
  email: "connect@orivocrm.pro",
  phone: "+1 888-ORIVO-CRM",
  officePhone: "+1 888-OFFICE-01",
  address: "Orivo HQ, Digital Valley, Cloud Suite 101",
  socials: { 
    facebook: "https://facebook.com/orivocrm", 
    instagram: "https://instagram.com/orivocrm", 
    twitter: "https://twitter.com/orivocrm", 
    website: "https://orivocrm.pro" 
  },
  disclaimer: "By transacting with our organization, you agree to our terms of service. All rights reserved v2026."
};

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

// Baseline 2026 Mock Exchange Rates relative to Anchor (USD)
const FX_RATES: Record<string, { rate: number, symbol: string }> = {
  "USD": { rate: 1, symbol: "$" },
  "JMD": { rate: 155.20, symbol: "J$" },
  "TTD": { rate: 6.78, symbol: "TT$" },
  "XCD": { rate: 2.70, symbol: "EC$" },
  "BBD": { rate: 2.02, symbol: "Bds$" },
  "BSD": { rate: 1.00, symbol: "B$" },
  "EUR": { rate: 0.92, symbol: "€" },
  "GBP": { rate: 0.79, symbol: "£" }
};

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ModuleConfig>(() => {
    const saved = localStorage.getItem("crm_os_modules");
    return saved ? JSON.parse(saved) : DEFAULT_MODULE_CONFIG;
  });

  const [activeBranch, setActiveBranch] = useState("all");
  const [hasActiveTransaction, setHasActiveTransaction] = useState(false);
  const [currency, setCurrency] = useState(() => localStorage.getItem("crm_display_currency") || "USD");
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => (localStorage.getItem("crm_theme") as any) || "system");
  const [topSpenderThreshold, setTopSpenderThreshold] = useState(() => {
    const saved = localStorage.getItem("crm_top_spender_threshold");
    return saved ? parseFloat(saved) : 1000;
  });

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
    to: new Date().toISOString()
  });

  const [taxRate, setTaxRateState] = useState(15);
  const [autoCloseTime, setAutoCloseTimeState] = useState("22:00");
  const [autoCloseEnabled, setAutoCloseEnabledState] = useState(false);

  const [branding, setBrandingState] = useState<BrandingConfig>(() => {
    const saved = localStorage.getItem("crm_branding");
    return saved ? JSON.parse(saved) : DEFAULT_BRANDING;
  });

  const [billing, setBillingState] = useState<BillingConfig>({
    planId: "enterprise",
    userCount: 3,
    branchCount: 1,
    billingCycle: "monthly",
    renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    paymentMethod: { type: "Visa", last4: "4242", expiry: "08/27" },
    status: "trialing",
    trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  });

  const [enterpriseId, setEnterpriseId] = useState<string | null>(() => {
    return localStorage.getItem("crm_enterprise_id") || null;
  });

  // Listen for Cloud Branding & Config Sync
  useEffect(() => {
    if (!enterpriseId) return;

    const unsub = onSnapshot(doc(db, "enterprise_settings", enterpriseId), (docSnap) => {
       if (docSnap.exists()) {
         const data = docSnap.data();
         if (data.branding) setBrandingState(data.branding);
         if (data.topSpenderThreshold !== undefined) setTopSpenderThreshold(Number(data.topSpenderThreshold));
         if (data.currency) setCurrency(data.currency);
         if (data.billing) setBillingState(data.billing);
         if (data.taxRate !== undefined) setTaxRateState(Number(data.taxRate));
         if (data.autoCloseTime) setAutoCloseTimeState(data.autoCloseTime);
         if (data.autoCloseEnabled !== undefined) setAutoCloseEnabledState(data.autoCloseEnabled);
         if (data.modules) setConfig(prev => ({ ...DEFAULT_MODULE_CONFIG, ...prev, ...data.modules }));
       }
    });

    const unsubUsers = onSnapshot(query(collection(db, "users"), where("enterprise_id", "==", enterpriseId)), (snap) => {
      setBillingState(prev => ({ ...prev, userCount: snap.size }));
    });
    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snap) => {
      setBillingState(prev => ({ ...prev, branchCount: snap.size }));
    });

    return () => { unsub(); unsubUsers(); unsubBranches(); };
  }, [enterpriseId]);

  const [posSession, setPosSessionState] = useState<{ 
    staffId: string; staffName: string; payGrade: string; 
    sessionId: string; staffData: any;
    shiftStatus: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING";
    statusSince: string;
  } | null>(() => {
    const saved = localStorage.getItem("crm_pos_session_v2");
    return saved ? JSON.parse(saved) : null;
  });

  const setPosSession = (session: any) => {
    setPosSessionState(session);
    if (session) localStorage.setItem("crm_pos_session_v2", JSON.stringify(session));
    else localStorage.removeItem("crm_pos_session_v2");
  };
  const [grantedOverrides, setGrantedOverrides] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string | boolean> | null>(null);
  const [shiftTimePolicies, setShiftTimePolicies] = useState({ breakDuration: 15, lunchDuration: 30, meetingDuration: 60, gracePeriod: 5 });

  // Listen for Role Permissions in Real-time
  useEffect(() => {
    if (!enterpriseId || !userRole || userRole === "Owner") {
      setRolePermissions(null);
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, "roles"), where("enterprise_id", "==", enterpriseId), where("name", "==", userRole)),
      (snapshot) => {
        if (!snapshot.empty) {
          const roleData = snapshot.docs[0].data();
          setRolePermissions(roleData.permissions || {});
        } else {
          setRolePermissions(null);
        }
      }
    );

    return () => unsub();
  }, [enterpriseId, userRole]);

  const updateShiftStatus = (status: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING") => {
    if (posSession) {
      setPosSession({ ...posSession, shiftStatus: status, statusSince: new Date().toISOString() });
    }
  };

  const setBranding = (update: Partial<BrandingConfig>) => {
    setBrandingState(prev => ({ ...prev, ...update }));
  };

  const setTaxRate = async (rate: number) => {
    if (!enterpriseId) return;
    setTaxRateState(rate);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "enterprise_settings", enterpriseId), {
        taxRate: rate,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to update tax rate:", error);
      toast.error("Failed to sync tax rate to cloud");
    }
  };

  const setAutoCloseTime = async (time: string) => {
    if (!enterpriseId) return;
    setAutoCloseTimeState(time);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "enterprise_settings", enterpriseId), {
        autoCloseTime: time,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to update autoCloseTime:", error);
    }
  };

  const setAutoCloseEnabled = async (enabled: boolean) => {
    if (!enterpriseId) return;
    setAutoCloseEnabledState(enabled);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "enterprise_settings", enterpriseId), {
        autoCloseEnabled: enabled,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to update autoCloseEnabled:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem("crm_os_modules", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem("crm_display_currency", currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem("crm_theme", theme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes if in 'system' mode
  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("crm_top_spender_threshold", topSpenderThreshold.toString());
  }, [topSpenderThreshold]);

  useEffect(() => {
    localStorage.setItem("crm_branding", JSON.stringify(branding));
  }, [branding]);

  useEffect(() => {
    if (enterpriseId) localStorage.setItem("crm_enterprise_id", enterpriseId);
    else localStorage.removeItem("crm_enterprise_id");
  }, [enterpriseId]);

  const toggleModule = (moduleName: keyof ModuleConfig) => {
    setConfig(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const isModuleEnabled = (moduleName: keyof ModuleConfig) => {
    return config[moduleName];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      currencyDisplay: "symbol",
      minimumFractionDigits: 2
    }).format(amount);
  };

  const addOverride = (tabId: string) => {
    setGrantedOverrides(prev => [...new Set([...prev, tabId])]);
  };

  const clearSession = () => {
    setPosSession(null);
    setGrantedOverrides([]);
  };

  const logout = async () => {
    try {
      clearSession();
      setPosSession(null); // Use the new function to clear state and localStorage
      const { auth } = await import("@/lib/firebase");
      const { signOut } = await import("firebase/auth");
      const { clearMockUser, getMockUser } = await import("@/lib/auth-mock");
      
      await signOut(auth);
      
      if (getMockUser()) {
        clearMockUser();
      } else {
        window.location.reload(); 
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const checkLimit = (resource: "users" | "branches") => {
    const limits = PLAN_LIMITS[billing.planId as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.starter;
    const current = resource === "users" ? billing.userCount : billing.branchCount;
    const max = resource === "users" ? limits.maxUsers : limits.maxBranches;
    
    return {
      allowed: current < max,
      current,
      max,
      message: current >= max 
        ? `You've reached the limit of ${max} ${resource} for the ${limits.name} plan. Upgrade to increase your capacity.`
        : undefined
    };
  };

  const hasPermission = (moduleId: string, level: "viewer" | "editor" | "admin" = "viewer") => {
    // Normalization: Map UI tabs to their respective backend module IDs
    const normalizedId = moduleId === "suppliers" ? "inventory" : 
                         moduleId === "revenue" ? "finance" : 
                         moduleId;

    // Plan Gating: Check if feature is included in the current plan
    const limits = PLAN_LIMITS[billing.planId as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.starter;
    if (!limits.features.includes(normalizedId) && !["dashboard", "settings", "support", "staff", "billing"].includes(normalizedId)) {
      return false;
    }

    if (grantedOverrides.includes(normalizedId)) return true;

    if (posSession) {
      // FIX: Use case-insensitive comparison to protect against schema drift (e.g., "executive" vs "EXECUTIVE")
      if (posSession.payGrade?.toLowerCase() === "executive") return true;
      if (!rolePermissions) return false;

      const perm = rolePermissions[normalizedId];
      if (perm === true || perm === "admin") return true;
      if (level === "admin") return perm === "admin";
      if (level === "editor") return perm === "editor" || perm === "admin";
      if (level === "viewer") return perm === "viewer" || perm === "editor" || perm === "admin";
      return false;
    }

    // FIX: Case-insensitive role check — "owner", "Owner", "OWNER" all grant full access
    if (userRole?.toLowerCase() === "owner") return true;
    if (!rolePermissions) return false;

    const perm = rolePermissions[normalizedId];
    if (perm === true || perm === "admin") return true;
    if (level === "admin") return perm === "admin";
    if (level === "editor") return perm === "editor" || perm === "admin";
    if (level === "viewer") return perm === "viewer" || perm === "editor" || perm === "admin";
    
    return false;
  };

  const updateBilling = async (update: Partial<BillingConfig>) => {
    const oldPlan = billing.planId;
    const newBilling = { ...billing, ...update };
    setBillingState(newBilling);
    
    // Notifications for plan changes
    if (update.planId && update.planId !== oldPlan) {
      const oldWeight = oldPlan === "enterprise" ? 3 : oldPlan === "professional" ? 2 : 1;
      const newWeight = update.planId === "enterprise" ? 3 : update.planId === "professional" ? 2 : 1;
      
      const { toast } = await import("sonner");
      if (newWeight > oldWeight) {
        toast.success("Account Upgraded!", {
          description: `You are now on the ${PLAN_LIMITS[update.planId as keyof typeof PLAN_LIMITS].name} plan. New features unlocked!`
        });
      } else {
        toast.warning("Plan Downgraded", {
          description: `Your account has been moved to the ${PLAN_LIMITS[update.planId as keyof typeof PLAN_LIMITS].name} plan. Some features may be restricted.`
        });
      }
    }

    if (enterpriseId) {
      try {
        const { setDoc, doc, serverTimestamp } = await import("@/lib/firebase");
        await setDoc(doc(db, "enterprise_settings", enterpriseId), {
          billing: newBilling,
          billingUpdated: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync billing:", err);
      }
    }
  };

  return (
    <ModuleContext.Provider value={{ 
      config, 
      toggleModule, 
      isModuleEnabled,
      activeBranch,
      setActiveBranch,
      dateRange,
      setDateRange,
      hasActiveTransaction,
      setHasActiveTransaction,
      currency,
      setCurrency,
      formatCurrency,
      topSpenderThreshold,
      setTopSpenderThreshold,
      theme,
      setTheme,
      branding,
      setBranding,
      enterpriseId,
      setEnterpriseId,
      posSession,
      setPosSession,
      updateShiftStatus,
      shiftTimePolicies,
      setShiftTimePolicies,
      grantedOverrides,
      addOverride,
      checkLimit,
      clearSession,
      userRole,
      setUserRole,
      rolePermissions,
      hasPermission,
      billing,
      updateBilling,
      taxRate,
      setTaxRate,
      autoCloseTime,
      setAutoCloseTime,
      autoCloseEnabled,
      setAutoCloseEnabled,
      logout
    }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error("useModules must be used within a ModuleProvider");
  }
  return context;
}
