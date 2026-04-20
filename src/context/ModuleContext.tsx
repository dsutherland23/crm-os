import React, { createContext, useContext, useState, useEffect } from "react";
import { ModuleConfig } from "../types";
import { DEFAULT_MODULE_CONFIG } from "../constants";

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
  userRole: string | null;
  setUserRole: (role: string | null) => void;
  logout: () => Promise<void>;
}

export interface BrandingConfig {
  name: string;
  logo: string;
  email: string;
  phone: string;
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
  name: "Your Organization",
  logo: "",
  email: "admin@example.com",
  phone: "+1 000 000 0000",
  address: "Your Business Address",
  socials: { facebook: "", instagram: "", twitter: "", website: "" },
  disclaimer: "Terms and conditions apply."
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

  const [branding, setBrandingState] = useState<BrandingConfig>(() => {
    const saved = localStorage.getItem("crm_branding");
    return saved ? JSON.parse(saved) : DEFAULT_BRANDING;
  });

  const [enterpriseId, setEnterpriseId] = useState<string | null>(() => {
    return localStorage.getItem("crm_enterprise_id") || null;
  });

  const [posSession, setPosSession] = useState<{ 
    staffId: string; staffName: string; payGrade: string; 
    sessionId: string; staffData: any;
    shiftStatus: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING";
    statusSince: string;
  } | null>(null);
  const [grantedOverrides, setGrantedOverrides] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shiftTimePolicies, setShiftTimePolicies] = useState({ breakDuration: 15, lunchDuration: 30, meetingDuration: 60, gracePeriod: 5 });

  const updateShiftStatus = (status: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING") => {
    setPosSession(prev => prev ? { ...prev, shiftStatus: status, statusSince: new Date().toISOString() } : null);
  };

  const setBranding = (update: Partial<BrandingConfig>) => {
    setBrandingState(prev => ({ ...prev, ...update }));
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

  useEffect(() => {
    if (!posSession) setGrantedOverrides([]);
  }, [posSession]);

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
      // Use dynamic imports or similar if auth is not available here, 
      // but it's imported at the top of the file normally in this project.
      const { auth } = await import("@/lib/firebase");
      const { signOut } = await import("firebase/auth");
      const { clearMockUser, getMockUser } = await import("@/lib/auth-mock");
      
      await signOut(auth);
      
      if (getMockUser()) {
        clearMockUser();
      } else {
        window.location.reload(); // Traditional reload for real auth logout
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
      clearSession,
      userRole,
      setUserRole,
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
