import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  TrendingUp,
  Users,
  ShoppingCart,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  FileText,
  ArrowRightLeft,
  ChevronRight,
  Zap,
  BrainCircuit,
  AlertCircle,
  Clock,
  RefreshCw,
  BarChart3,
  WifiOff,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useModules } from "@/context/ModuleContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { db, collection, query, onSnapshot, orderBy, limit, where } from "@/lib/firebase";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

const StatCardSkeleton = () => (
  <Card className="card-modern">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24 mb-2 rounded" />
      <Skeleton className="h-8 w-32 rounded" />
    </CardContent>
  </Card>
);

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  trend,
  onClick,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  trend: "up" | "down";
  onClick?: () => void;
}) => (
  <Card
    className={cn(
      "card-modern group transition-all duration-300",
      onClick && "cursor-pointer hover:border-blue-500/50 hover:-translate-y-0.5 hover:shadow-lg"
    )}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => e.key === "Enter" && onClick?.()}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-100 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5",
            trend === "up"
              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : "bg-rose-50 text-rose-600 border-rose-100"
          )}
        >
          {trend === "up" ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {change}
        </Badge>
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{value}</h3>
          <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">vs last period</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

const QuickAction = ({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Button
    variant="outline"
    className={cn(
      "h-auto min-h-[72px] py-3 px-2 rounded-2xl flex flex-col items-center gap-2 border-zinc-200",
      "hover:border-blue-500/50 hover:bg-blue-50/50 transition-all group",
      "focus-visible:ring-2 focus-visible:ring-blue-500",
      disabled && "opacity-50 cursor-not-allowed"
    )}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
  >
    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-[11px] font-bold text-zinc-700 text-center leading-tight">{label}</span>
  </Button>
);

interface ActionableInsightProps {
  type: "alert" | "insight";
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  status: string;
}

const ActionableInsight: React.FC<ActionableInsightProps> = ({
  type,
  title,
  description,
  actionLabel,
  onAction,
  status,
}) => (
  <div className="p-4 rounded-2xl border border-zinc-100 bg-white hover:shadow-md transition-all flex items-start gap-3 group">
    <div
      className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
        type === "alert" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
      )}
    >
      {type === "alert" ? <AlertCircle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-bold text-zinc-900 leading-tight">{title}</h4>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-bold uppercase tracking-widest shrink-0 px-1.5",
            status === "CRITICAL" && "border-rose-200 text-rose-600 bg-rose-50",
            status === "OPPORTUNITY" && "border-blue-200 text-blue-600 bg-blue-50",
            status === "OPTIMAL" && "border-emerald-200 text-emerald-600 bg-emerald-50",
            status === "INFO" && "border-zinc-200 text-zinc-500"
          )}
        >
          {status}
        </Badge>
      </div>
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{description}</p>
      <Button
        size="sm"
        variant="secondary"
        className="rounded-lg h-8 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-900 hover:text-white transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAction();
        }}
      >
        {actionLabel}
        <ChevronRight className="w-3 h-3 ml-1" />
      </Button>
    </div>
  </div>
);

// Error boundary fallback for individual widgets
const WidgetError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
    <WifiOff className="w-8 h-8 text-zinc-300" />
    <p className="text-sm text-zinc-500 font-medium">Failed to load data</p>
    <Button size="sm" variant="outline" onClick={onRetry} className="rounded-lg gap-2">
      <RefreshCw className="w-3 h-3" /> Retry
    </Button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP FOR CHART
// ─────────────────────────────────────────────────────────────
const CustomChartTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl shadow-xl p-3 min-w-[120px]">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm font-bold text-blue-600">{formatCurrency(payload[0]?.value || 0)}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────
export default function Dashboard({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const { activeBranch, formatCurrency, enterpriseId } = useModules();

  // ── State ──────────────────────────────────────────────────
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [loadingMap, setLoadingMap] = useState({
    transactions: true,
    customers: true,
    inventory: true,
    logs: true,
  });
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({
    transactions: null,
    customers: null,
    inventory: null,
    logs: null,
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Prevent duplicate subscription triggers
  const subscriptionRef = useRef<(() => void)[]>([]);

  // ── Data Subscriptions with error handling ─────────────────
  const subscribe = useCallback(() => {
    // Teardown any existing
    subscriptionRef.current.forEach((u) => u());
    subscriptionRef.current = [];

    if (!enterpriseId) return;

    setLoadingMap({ transactions: true, customers: true, inventory: true, logs: true });
    setErrorMap({ transactions: null, customers: null, inventory: null, logs: null });

    // 1. Transactions
    const txQuery =
        ? query(collection(db, "transactions"), where("enterprise_id", "==", enterpriseId), orderBy("timestamp", "desc"), limit(100))
        : query(
            collection(db, "transactions"),
            where("enterprise_id", "==", enterpriseId),
            where("branch_id", "==", activeBranch),
            orderBy("timestamp", "desc"),
            limit(100)
          );

    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingMap((p) => ({ ...p, transactions: false }));
      },
      (err) => {
        console.error("Transactions listener:", err);
        setErrorMap((p) => ({ ...p, transactions: err.code }));
        setLoadingMap((p) => ({ ...p, transactions: false }));
      }
    );

    // 2. Customers
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId)),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingMap((p) => ({ ...p, customers: false }));
      },
      (err) => {
        console.error("Customers listener:", err);
        setErrorMap((p) => ({ ...p, customers: err.code }));
        setLoadingMap((p) => ({ ...p, customers: false }));
      }
    );

    // 3. Inventory
    const invQuery =
      activeBranch === "all"
        ? query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId))
        : query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId), where("branch_id", "==", activeBranch));

    const unsubInv = onSnapshot(
      invQuery,
      (snap) => {
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingMap((p) => ({ ...p, inventory: false }));
      },
      (err) => {
        console.error("Inventory listener:", err);
        setErrorMap((p) => ({ ...p, inventory: err.code }));
        setLoadingMap((p) => ({ ...p, inventory: false }));
      }
    );

    // 4. Audit Logs
    const unsubLogs = onSnapshot(
      query(collection(db, "audit_logs"), where("enterprise_id", "==", enterpriseId), orderBy("timestamp", "desc"), limit(5)),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingMap((p) => ({ ...p, logs: false }));
      },
      (err) => {
        console.error("Audit logs listener:", err);
        setErrorMap((p) => ({ ...p, logs: err.code }));
        setLoadingMap((p) => ({ ...p, logs: false }));
      }
    );

    subscriptionRef.current = [unsubTx, unsubCustomers, unsubInv, unsubLogs];
  }, [activeBranch, enterpriseId]);

  useEffect(() => {
    subscribe();
    return () => subscriptionRef.current.forEach((u) => u());
  }, [subscribe]);

  // ── Derived Metrics ────────────────────────────────────────
  const metrics = useMemo(() => {
    const revenue = transactions.reduce((acc, tx) => acc + (Number(tx.total) || 0), 0);
    const orders = transactions.length;
    const customerCount = customers.filter((c) => c.status !== "Archived").length;
    const inventoryValue = inventory.reduce(
      (acc, item) => acc + (Number(item.stock) || 0) * (Number(item.retail_price || item.price || item.cost) || 0),
      0
    );
    return { revenue, orders, customers: customerCount, inventory: inventoryValue };
  }, [transactions, customers, inventory]);

  // ── Chart Data ─────────────────────────────────────────────
  const chartData = useMemo(() => {
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        name: DAY_LABELS[d.getDay()],
        date: d.toISOString().split("T")[0],
        sales: 0,
      };
    });

    transactions.forEach((tx) => {
      const raw = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp || 0);
      const txDate = raw.toISOString().split("T")[0];
      const day = days.find((d) => d.date === txDate);
      if (day) day.sales += Number(tx.total) || 0;
    });

    return days;
  }, [transactions]);

  // ── AI Insights ────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: any[] = [];

    const lowStock = inventory.filter((i) => Number(i.stock) <= Number(i.min_stock || 5));
    if (lowStock.length > 0) {
      list.push({
        type: "alert",
        title: "Low Stock Alert",
        description: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} running low. "${lowStock[0]?.name || "Unknown"}" has ${lowStock[0]?.stock} units remaining.`,
        actionLabel: "Restock Now",
        status: "CRITICAL",
        actionTab: "inventory",
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inactiveVIPs = customers.filter((c) => {
      const last = c.last_purchase_date?.toDate
        ? c.last_purchase_date.toDate()
        : new Date(c.last_purchase_date || 0);
      return last < thirtyDaysAgo && Number(c.total_spent || c.spend || 0) > 1000;
    });
    if (inactiveVIPs.length > 0) {
      list.push({
        type: "insight",
        title: "VIP Re-engagement",
        description: `${inactiveVIPs.length} high-value customer${inactiveVIPs.length > 1 ? "s" : ""} inactive 30+ days. "${inactiveVIPs[0]?.name}" is a prime target.`,
        actionLabel: "Send Offer",
        status: "OPPORTUNITY",
        actionTab: "crm",
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const todayRevenue = transactions
      .filter((tx) => {
        const raw = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp || 0);
        return raw.toISOString().split("T")[0] === todayStr;
      })
      .reduce((acc, tx) => acc + Number(tx.total || 0), 0);
    const avgDaily = metrics.revenue / 7;
    if (todayRevenue > avgDaily * 1.5 && avgDaily > 0) {
      list.push({
        type: "insight",
        title: "Revenue Spike Detected",
        description: `Today's revenue of ${formatCurrency(todayRevenue)} is ${Math.round((todayRevenue / avgDaily) * 100)}% of the weekly average.`,
        actionLabel: "View Analytics",
        status: "INFO",
        actionTab: "analytics",
      });
    }

    if (list.length === 0) {
      list.push({
        type: "insight",
        title: "All Systems Nominal",
        description: "No critical alerts or anomalies detected. Operations are running smoothly.",
        actionLabel: "View Analytics",
        status: "OPTIMAL",
        actionTab: "analytics",
      });
    }

    return list.slice(0, 3);
  }, [inventory, customers, transactions, metrics.revenue, formatCurrency]);

  // ── Sync handler (idempotent guard) ───────────────────────
  const handleRegenerate = useCallback(() => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    subscribe();
    setTimeout(() => {
      setIsRegenerating(false);
      toast.success("Intelligence synced with latest data");
    }, 1200);
  }, [isRegenerating, subscribe]);

  // ── Quick Action dispatcher ────────────────────────────────
  // Uses requestAnimationFrame instead of setTimeout for deterministic timing
  const dispatchAction = useCallback(
    (tab: string, action: string) => {
      setActiveTab?.(tab);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("app:action", { detail: action }));
        });
      });
    },
    [setActiveTab]
  );

  // ── Aggregate loading state ────────────────────────────────
  const isInitialLoad =
    Object.values(loadingMap).every(Boolean) && transactions.length === 0;

  const hasAnyError = Object.values(errorMap).some(Boolean);

  // ────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <BrainCircuit className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Neural Command Center
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900">
              Command Center
            </h1>
            <p className="text-sm text-zinc-500">
              Real-time operational overview across all branches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sync button */}
            <Button
              className={cn(
                "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg h-11 px-5 font-bold text-xs gap-2",
                "transition-all duration-200 active:scale-95"
              )}
              onClick={handleRegenerate}
              disabled={isRegenerating}
              aria-label="Sync data"
            >
              <RefreshCw className={cn("w-4 h-4", isRegenerating && "animate-spin")} />
              <span>{isRegenerating ? "Syncing…" : "Sync Data"}</span>
            </Button>
          </div>
        </div>

        {/* ── Connection error banner ──────────────────────────── */}
        {hasAnyError && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700">
            <WifiOff className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Connection issue detected</p>
              <p className="text-xs opacity-80">Some data may be stale. Check your internet or Firebase settings.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={subscribe}
              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-100 h-9 text-xs font-bold gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Retry All
            </Button>
          </div>
        )}

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <QuickAction icon={Plus} label="New Sale" onClick={() => dispatchAction("pos", "NEW_SALE")} />
            <QuickAction icon={Users} label="Add Customer" onClick={() => dispatchAction("crm", "ADD_CUSTOMER")} />
            <QuickAction icon={FileText} label="Invoice" onClick={() => dispatchAction("revenue", "CREATE_INVOICE")} />
            <QuickAction icon={Package} label="Add Product" onClick={() => dispatchAction("inventory", "ADD_PRODUCT")} />
            <QuickAction icon={ArrowRightLeft} label="Transfer" onClick={() => dispatchAction("inventory", "TRANSFER_STOCK")} />
            <QuickAction icon={Sparkles} label="AI Report" onClick={() => dispatchAction("ai", "AI_REPORT")} />
          </div>
        </div>

        {/* ── KPI Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isInitialLoad ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Gross Revenue"
                value={formatCurrency(metrics.revenue)}
                change="+14.2%"
                icon={TrendingUp}
                trend="up"
                onClick={() => setActiveTab?.("revenue")}
              />
              <StatCard
                title="Customers"
                value={metrics.customers.toLocaleString()}
                change="+8.1%"
                icon={Users}
                trend="up"
                onClick={() => setActiveTab?.("crm")}
              />
              <StatCard
                title="Total Orders"
                value={metrics.orders.toLocaleString()}
                change="-2.4%"
                icon={ShoppingCart}
                trend="down"
                onClick={() => setActiveTab?.("pos")}
              />
              <StatCard
                title="Inventory Value"
                value={formatCurrency(metrics.inventory)}
                change="+5.2%"
                icon={Package}
                trend="up"
                onClick={() => setActiveTab?.("inventory")}
              />
            </>
          )}
        </div>

        {/* ── Chart + Briefing ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Performance Chart */}
          <Card className="lg:col-span-2 card-modern overflow-hidden">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base lg:text-xl font-bold">Performance Trajectory</CardTitle>
                  <CardDescription>Revenue over the last 7 days</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">
                  <Activity className="w-3 h-3 mr-1" /> Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-4 px-2 sm:px-6">
              {loadingMap.transactions ? (
                <Skeleton className="h-[240px] sm:h-[320px] w-full rounded-2xl" />
              ) : errorMap.transactions ? (
                <WidgetError onRetry={subscribe} />
              ) : chartData.every((d) => d.sales === 0) ? (
                <div className="h-[240px] sm:h-[320px] flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <BarChart3 className="w-10 h-10 opacity-30" />
                  <span className="text-sm font-medium">No transaction data yet</span>
                </div>
              ) : (
                <div className="h-[240px] sm:h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                      <defs>
                        <linearGradient id="colorSalesDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                        width={48}
                      />
                      <Tooltip content={<CustomChartTooltip formatCurrency={formatCurrency} />} />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSalesDash)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#3b82f6" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Morning Briefing */}
          <Card className="card-modern flex flex-col">
            <CardHeader className="border-b border-zinc-100 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-base font-bold">Morning Briefing</CardTitle>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase">
                  Live
                </Badge>
              </div>
              <CardDescription className="mt-1">Real-time operational insights</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-3 overflow-y-auto">
              {(loadingMap.inventory || loadingMap.customers) ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-2xl border border-zinc-100 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-2/3 rounded" />
                    <Skeleton className="h-7 w-24 rounded-lg mt-1" />
                  </div>
                ))
              ) : (
                insights.map((insight, idx) => (
                  <ActionableInsight
                    key={idx}
                    type={insight.type}
                    title={insight.title}
                    description={insight.description}
                    actionLabel={insight.actionLabel}
                    status={insight.status}
                    onAction={() => {
                      setActiveTab?.(insight.actionTab);
                      toast.success(`Navigating to ${insight.actionTab}`);
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── System Activity ──────────────────────────────────── */}
        <Card className="card-modern">
          <CardHeader className="border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base lg:text-lg font-bold">System Activity</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-lg gap-1"
                onClick={() => setActiveTab?.("audit")}
              >
                View Full Log <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMap.logs ? (
              <div className="divide-y divide-zinc-50">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-5 flex items-center gap-4">
                    <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-48 rounded" />
                      <Skeleton className="h-3 w-32 rounded" />
                    </div>
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                ))}
              </div>
            ) : errorMap.logs ? (
              <WidgetError onRetry={subscribe} />
            ) : auditLogs.length === 0 ? (
              <div className="p-10 text-center text-zinc-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No activity recorded yet</p>
                <p className="text-xs mt-1 opacity-70">Actions across the CRM will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {auditLogs.map((log, i) => {
                  const ts = log.timestamp?.toDate
                    ? log.timestamp.toDate()
                    : log.timestamp
                    ? new Date(log.timestamp)
                    : null;
                  const timeStr = ts
                    ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now";
                  const dateStr = ts
                    ? ts.toLocaleDateString([], { month: "short", day: "numeric" })
                    : "";

                  return (
                    <div
                      key={log.id || i}
                      className="p-4 sm:p-5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors"
                    >
                      <div className="p-2 rounded-xl bg-zinc-100 text-blue-500 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{log.action}</p>
                        <p className="text-xs text-zinc-500 truncate">{log.details}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-zinc-700">{log.user_id || log.user || "System"}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {dateStr} {timeStr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}
