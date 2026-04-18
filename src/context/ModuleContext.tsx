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
  name: "CRM OS Enterprise",
  logo: "",
  email: "connect@enterprise.com",
  phone: "+1 876 555 0100",
  address: "Innovation District, Kingston, Jamaica",
  socials: { facebook: "", instagram: "", twitter: "", website: "" },
  disclaimer: "Terms and conditions apply. All rights reserved."
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

  const toggleModule = (moduleName: keyof ModuleConfig) => {
    setConfig(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const isModuleEnabled = (moduleName: keyof ModuleConfig) => {
    return config[moduleName];
  };

  const formatCurrency = (amount: number) => {
    const target = FX_RATES[currency] || FX_RATES["USD"];
    const converted = amount * target.rate;
    
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2
    }).format(converted);

    return `${formatted} ${currency}`;
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
      setBranding
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
