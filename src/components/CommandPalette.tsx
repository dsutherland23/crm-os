import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Search, Command, Package, Users, ShoppingCart, Wallet, 
  LayoutDashboard, BarChart3, Settings, Truck, Zap, Star,
  ArrowRight, FileText, Plus, History
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: string;
  accent: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

export function CommandPalette({ open, onClose, setActiveTab }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback((tab: string) => {
    setActiveTab(tab);
    onClose();
  }, [setActiveTab, onClose]);

  const actions: CommandAction[] = [
    {
      id: "dashboard", label: "Overview", description: "Business intelligence dashboard",
      icon: LayoutDashboard, category: "Navigate", accent: "text-blue-500",
      action: () => navigate("dashboard"), keywords: ["home", "overview", "stats"]
    },
    {
      id: "pos", label: "Point of Sale", description: "Open register & process transactions",
      icon: ShoppingCart, category: "Navigate", accent: "text-emerald-500",
      action: () => navigate("pos"), keywords: ["checkout", "sell", "register", "cash"]
    },
    {
      id: "inventory", label: "Stock Management", description: "Products, POs & stock levels",
      icon: Package, category: "Navigate", accent: "text-orange-500",
      action: () => navigate("inventory"), keywords: ["products", "inventory", "stock", "sku"]
    },
    {
      id: "crm", label: "Customers", description: "CRM & customer profiles",
      icon: Users, category: "Navigate", accent: "text-purple-500",
      action: () => navigate("crm"), keywords: ["customers", "clients", "contacts", "crm"]
    },
    {
      id: "finance", label: "Revenue & Finance", description: "Invoices, cash flow & reports",
      icon: Wallet, category: "Navigate", accent: "text-amber-500",
      action: () => navigate("finance"), keywords: ["revenue", "finance", "invoices", "money"]
    },
    {
      id: "suppliers", label: "Suppliers", description: "Vendor management & procurement",
      icon: Truck, category: "Navigate", accent: "text-cyan-500",
      action: () => navigate("suppliers"), keywords: ["vendors", "suppliers", "procurement"]
    },
    {
      id: "analytics", label: "Intelligence", description: "Advanced analytics & trends",
      icon: BarChart3, category: "Navigate", accent: "text-rose-500",
      action: () => navigate("analytics"), keywords: ["analytics", "reports", "intelligence"]
    },
    {
      id: "loyalty", label: "Loyalty Program", description: "Points, campaigns & rewards",
      icon: Star, category: "Navigate", accent: "text-yellow-500",
      action: () => navigate("loyalty"), keywords: ["loyalty", "points", "rewards", "campaigns"]
    },
    {
      id: "workflow", label: "Workflows", description: "Automation & process management",
      icon: Zap, category: "Navigate", accent: "text-indigo-500",
      action: () => navigate("workflow"), keywords: ["workflow", "automation", "process"]
    },
    {
      id: "settings", label: "System Settings", description: "Configuration & preferences",
      icon: Settings, category: "Navigate", accent: "text-zinc-500",
      action: () => navigate("settings"), keywords: ["settings", "config", "preferences"]
    },
    {
      id: "new-product", label: "Add Product", description: "Create a new inventory product",
      icon: Plus, category: "Quick Action", accent: "text-orange-500",
      action: () => { navigate("inventory"); },
      keywords: ["new product", "add product", "create product"]
    },
    {
      id: "new-invoice", label: "New Invoice", description: "Generate a financial invoice",
      icon: FileText, category: "Quick Action", accent: "text-amber-500",
      action: () => { navigate("finance"); },
      keywords: ["invoice", "new invoice", "bill"]
    },
    {
      id: "audit_logs", label: "Audit Logs", description: "System audit trail",
      icon: History, category: "Navigate", accent: "text-zinc-400",
      action: () => navigate("audit_logs"), keywords: ["audit", "logs", "history"]
    },
  ];

  const filtered = query.trim() === ""
    ? actions
    : actions.filter(a => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          (a.keywords || []).some(k => k.includes(q)) ||
          a.category.toLowerCase().includes(q)
        );
      });

  const grouped = filtered.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, CommandAction[]>);

  const flat = Object.values(grouped).flat();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[selected]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md z-[200]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[10vh] -translate-x-1/2 z-[201] w-full max-w-xl"
          >
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-zinc-900/30 border border-zinc-200/80 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-100">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
                  <Command className="w-4 h-4 text-white" />
                </div>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or jump to..."
                  className="flex-1 bg-transparent outline-none text-base font-medium text-zinc-900 placeholder:text-zinc-400"
                />
                <kbd className="hidden sm:flex h-6 items-center gap-1 px-2 rounded-lg border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[55vh] overflow-y-auto p-3 space-y-1">
                {flat.length === 0 ? (
                  <div className="py-16 text-center">
                    <Search className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-zinc-400">No results for "{query}"</p>
                    <p className="text-xs text-zinc-300 mt-1">Try another keyword or browse above</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <p className="px-3 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {category}
                      </p>
                      {items.map(item => {
                        const globalIdx = flat.indexOf(item);
                        const isSelected = globalIdx === selected;
                        return (
                          <motion.button
                            key={item.id}
                            onClick={item.action}
                            onMouseEnter={() => setSelected(globalIdx)}
                            className={cn(
                              "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-100 text-left group",
                              isSelected
                                ? "bg-zinc-900 text-white shadow-lg"
                                : "hover:bg-zinc-50 text-zinc-900"
                            )}
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                              isSelected
                                ? "bg-white/10 border-white/20"
                                : "bg-zinc-50 border-zinc-100"
                            )}>
                              <item.icon className={cn(
                                "w-4 h-4 transition-colors",
                                isSelected ? "text-white" : item.accent
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-bold truncate",
                                isSelected ? "text-white" : "text-zinc-900"
                              )}>
                                {item.label}
                              </p>
                              {item.description && (
                                <p className={cn(
                                  "text-[11px] truncate mt-0.5",
                                  isSelected ? "text-zinc-300" : "text-zinc-500"
                                )}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <ArrowRight className={cn(
                              "w-4 h-4 shrink-0 transition-all",
                              isSelected
                                ? "text-white opacity-100 translate-x-0"
                                : "text-zinc-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                            )} />
                          </motion.button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white font-mono">↑↓</kbd> Navigate</span>
                  <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white font-mono">↵</kbd> Select</span>
                </div>
                <p className="text-[10px] text-zinc-300 font-bold">{flat.length} results</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
