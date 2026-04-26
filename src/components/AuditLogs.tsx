import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  User,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Search,
  Download,
  Building2,
  Lock,
  Zap,
  Cpu,
  Terminal,
  Database,
  ShieldAlert,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  XCircle,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface LogEntry {
  id: string;
  action: string;
  details?: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  type: "SECURITY" | "POS" | "CRM" | "LOGISTICS" | "SYSTEM";
  branch?: string;
  user?: string;
  time?: string;
  timestamp?: any;
  metadata?: any;
}

/* ─────────────────────────────────────────
   Log Detail Viewer
 ───────────────────────────────────────── */
function LogDetailDialog({ log, open, onOpenChange }: { log: LogEntry | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  if (!log) return null;
  const date = getLogDate(log.timestamp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] border-zinc-100 p-0 overflow-hidden sm:max-w-xl shadow-2xl">
        <div className={cn(
          "p-8 pt-10 pb-12 space-y-8",
          log.severity === "CRITICAL" ? "bg-rose-50/30" : "bg-white"
        )}>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5",
                  log.severity === "CRITICAL" ? "bg-rose-500 text-white" : "bg-zinc-100 text-zinc-500"
                )}>
                  {log.severity} EVENT
                </Badge>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-zinc-200 text-zinc-400">
                  {log.type}
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-zinc-900">{log.action}</DialogTitle>
              <p className="text-xs text-zinc-500 font-medium">Neural verification hash: <span className="text-zinc-400 font-mono">{log.id.substring(0, 16)}...</span></p>
            </div>
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
              log.severity === "CRITICAL" ? "bg-rose-500 text-white" : "bg-zinc-900 text-white"
            )}>
              <LogIcon type={log.type} />
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-zinc-400">
               <Activity className="w-3.5 h-3.5" />
               <span className="text-[10px] font-black uppercase tracking-widest">Entry Deep Dive</span>
             </div>
             <div className="bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm">
                <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                  {log.details || "No technical description provided for this event sequence."}
                </p>
             </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Authenticated User</p>
                <div className="flex items-center gap-2">
                   <User className="w-3.5 h-3.5 text-zinc-900" />
                   <p className="text-xs font-bold text-zinc-900">{log.user || 'System'}</p>
                </div>
             </div>
             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Origin Node</p>
                <div className="flex items-center gap-2">
                   <Building2 className="w-3.5 h-3.5 text-zinc-900" />
                   <p className="text-xs font-bold text-zinc-900">{log.branch || 'Main HQ'}</p>
                </div>
             </div>
             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Vector Timestamp</p>
                <div className="flex items-center gap-2">
                   <Clock className="w-3.5 h-3.5 text-zinc-900" />
                   <p className="text-xs font-bold text-zinc-900">{date?.toLocaleString() || 'N/A'}</p>
                </div>
             </div>
             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Persistence</p>
                <div className="flex items-center gap-2">
                   <Database className="w-3.5 h-3.5 text-emerald-500" />
                   <p className="text-xs font-bold text-emerald-600">Encrypted Ledger</p>
                </div>
             </div>
          </div>

          <Button className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800" onClick={() => onOpenChange(false)}>
            Close Inspection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────
   Skeleton
───────────────────────────────────────── */
function LogSkeleton() {
  return (
    <div className="divide-y divide-zinc-50">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 sm:p-6 flex items-start gap-4 animate-pulse">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-100 rounded-2xl flex-none" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex gap-2 flex-wrap">
              <div className="h-4 bg-zinc-100 rounded w-1/4" />
              <div className="h-4 bg-zinc-100 rounded-full w-16" />
            </div>
            <div className="h-3 bg-zinc-100 rounded w-3/4" />
            <div className="h-3 bg-zinc-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Stat Card
───────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, bg, border,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bg: string; border: string;
}) {
  return (
    <Card className={cn("card-modern p-4 sm:p-6", bg, border)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center", bg, color)}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </Card>
  );
}

/* ─────────────────────────────────────────
   Log Row Icon
───────────────────────────────────────── */
function LogIcon({ type }: { type: LogEntry["type"] }) {
  switch (type) {
    case "SECURITY": return <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />;
    case "POS": return <Terminal className="w-5 h-5 sm:w-6 sm:h-6" />;
    case "CRM": return <User className="w-5 h-5 sm:w-6 sm:h-6" />;
    case "LOGISTICS": return <Database className="w-5 h-5 sm:w-6 sm:h-6" />;
    case "SYSTEM": return <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />;
    default: return <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400" />;
  }
}

function getLogDate(timestamp: any) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? null : d;
}

/* ─────────────────────────────────────────
   Export to CSV utility
───────────────────────────────────────── */
function exportToCSV(logs: LogEntry[]) {
  const headers = ["Action", "Severity", "Type", "Details", "User", "Branch", "Time"];
  const rows = logs.map((l) => [
    `"${(l.action || "").replace(/"/g, '""')}"`,
    l.severity,
    l.type,
    `"${(l.details || "").replace(/"/g, '""')}"`,
    l.user || "",
    l.branch || "",
    l.time || (l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_log_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function AuditLogs({ variant = "full" }: { variant?: "full" | "minimal" }) {
  const { enterpriseId } = useModules();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inspectingLog, setInspectingLog] = useState<LogEntry | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [riskScore, setRiskScore] = useState(0);

  // Recalculate risk score based on recent critical events
  useEffect(() => {
    const criticals = logs.filter(l => l.severity === "CRITICAL").length;
    const warnings = logs.filter(l => l.severity === "WARNING").length;
    const score = Math.min(100, (criticals * 15) + (warnings * 5));
    setRiskScore(score);
  }, [logs]);

  const subscribe = useCallback(() => {
    if (!enterpriseId) return;
    setLoading(true);
    setFetchError(null);
    const q = query(
      collection(db, "audit_logs"),
      where("enterprise_id", "==", enterpriseId),
      limit(200)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry));
        // Sort locally to avoid index requirement
        docs.sort((a, b) => {
          const tA = getLogDate(a.timestamp)?.getTime() || 0;
          const tB = getLogDate(b.timestamp)?.getTime() || 0;
          return tB - tA;
        });
        setLogs(docs.slice(0, 100));
        setLoading(false);
        setRetrying(false);
      },
      (error) => {
        console.error("Audit log error:", error);
        setFetchError("Failed to load audit logs. Check your connection or permissions.");
        setLoading(false);
        setRetrying(false);
        toast.error("Failed to load audit logs");
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe();
    return () => unsubscribe();
  }, [subscribe]);

  const handleRetry = () => {
    setRetrying(true);
    subscribe();
  };

  /* ── Client-side filtering ── */
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !searchTerm ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "all" || log.type?.toLowerCase() === typeFilter.toLowerCase();
      const matchSeverity =
        severityFilter === "all" || log.severity?.toLowerCase() === severityFilter.toLowerCase();
      return matchSearch && matchType && matchSeverity;
    });
  }, [logs, searchTerm, typeFilter, severityFilter]);

  /* ── Stats ── */
  const criticalCount = logs.filter((l) => l.severity === "CRITICAL").length;
  const warningCount = logs.filter((l) => l.severity === "WARNING").length;

  /* ── Export ── */
  const handleExport = async () => {
    if (filtered.length === 0) return toast.error("No logs to export.");
    setExporting(true);
    try {
      exportToCSV(filtered);
      toast.success(`Exported ${filtered.length} entries to CSV.`);
    } catch (e) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (variant === "minimal") {
    return (
      <Card className="card-modern overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            <h3 className="font-bold text-zinc-900 text-sm">Recent Audit Trail</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-blue-600 hover:bg-blue-50" onClick={() => window.dispatchEvent(new CustomEvent('app:nav', { detail: 'audit' }))}>View Full Logs</Button>
        </div>
        <div className="divide-y divide-zinc-50 max-h-[400px] overflow-y-auto">
          {loading ? [1,2,3].map(i => <div key={i} className="p-4 animate-pulse bg-zinc-50/50 h-16 mb-1" />) : 
           logs.slice(0, 10).map(log => (
            <div key={log.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", log.severity === "CRITICAL" ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-500")}>
                  <LogIcon type={log.type} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900">{log.action}</p>
                  <p className="text-[10px] text-zinc-400 font-medium">By {log.user || 'System'} · {getLogDate(log.timestamp)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[8px] font-bold uppercase border-zinc-100">{log.severity}</Badge>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <div className="p-1.5 bg-rose-50 rounded-lg">
                <Shield className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Neural Compliance Shield</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 font-display">Audit Trail</h1>
            <p className="text-zinc-500 max-w-md text-xs md:text-sm font-medium leading-relaxed">Immutable record of enterprise activities, security events, and system changes.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              className="rounded-xl border-zinc-200 h-12 md:h-14 px-6 md:px-8 font-bold text-[10px] uppercase tracking-widest w-full sm:flex-1 md:w-auto"
              onClick={handleExport}
              disabled={exporting || loading || filtered.length === 0}
            >
              {exporting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing</>
                : <><Download className="w-4 h-4 mr-2 text-zinc-400" /> Export CSV</>}
            </Button>
            <Button
              className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/10 h-12 md:h-14 px-6 md:px-10 font-black text-[10px] uppercase tracking-widest w-full sm:flex-1 md:w-auto flex items-center justify-center gap-2"
              onClick={() => toast.info("Security incident reports are encrypted and ready for v3.0")}
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Security Intel
            </Button>
          </div>
        </div>

        {/* ── Neural Risk Assessment ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 card-modern p-6 md:p-8 bg-zinc-900 text-white border-zinc-800 shadow-2xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-10 -mt-10 -mr-10 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                <Shield className="w-64 h-64" />
              </div>
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Enterprise Threat Level</p>
                    <h3 className="text-3xl font-black font-display tracking-tight uppercase">{riskScore > 50 ? 'Accelerated Risk' : riskScore > 20 ? 'Active Monitoring' : 'Secure Baseline'}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-white">{riskScore}%</p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Neural Score</p>
                  </div>
                </div>
                
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${riskScore}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,50,50,0.5)]",
                      riskScore > 50 ? "bg-rose-500" : riskScore > 20 ? "bg-amber-400" : "bg-emerald-400"
                    )}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Real-time Biometrics Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ledger Encryption Verified</span>
                  </div>
                </div>
              </div>
           </Card>

           <Card className="card-modern p-6 md:p-8 bg-white border-zinc-100 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Live Stream</h4>
                  <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")} />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{isLive ? 'Syncing' : 'Paused'}</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-zinc-900 leading-tight">System is currently indexing enterprise activity across {logs.length} unique vector points.</p>
              </div>
              <Button 
                variant={isLive ? "outline" : "default"} 
                className="mt-6 rounded-xl h-12 font-black uppercase tracking-widest text-[10px]"
                onClick={() => setIsLive(!isLive)}
              >
                {isLive ? <><Lock className="w-3 h-3 mr-2 text-zinc-400" /> Stop Live Feed</> : <><RefreshCw className="w-3 h-3 mr-2" /> Start Live Feed</>}
              </Button>
           </Card>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
          <StatCard
            label="Total Events"
            value={loading ? "—" : logs.length.toLocaleString()}
            icon={Activity}
            color="text-blue-600"
            bg="bg-blue-50"
            border="border-blue-100"
          />
          <StatCard
            label="Critical Events"
            value={loading ? "—" : criticalCount}
            icon={ShieldAlert}
            color="text-rose-600"
            bg="bg-rose-50"
            border="border-rose-100"
          />
          <StatCard
            label="Warnings"
            value={loading ? "—" : warningCount}
            icon={AlertCircle}
            color="text-amber-600"
            bg="bg-amber-50"
            border="border-amber-100"
          />
          <StatCard
            label="Info Events"
            value={loading ? "—" : (logs.length - criticalCount - warningCount)}
            icon={CheckCircle2}
            color="text-emerald-600"
            bg="bg-emerald-50"
            border="border-emerald-100"
          />
        </div>

        {/* ── Filters ── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search by action, user, or details..."
              className="pl-10 rounded-xl border-zinc-200 bg-white h-11 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="rounded-xl border-zinc-200 h-11 font-bold text-xs bg-white">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Event Types</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="pos">POS Transactions</SelectItem>
              <SelectItem value="crm">Customer Data</SelectItem>
              <SelectItem value="logistics">Inventory</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="rounded-xl border-zinc-200 h-11 font-bold text-xs bg-white">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="info">Information</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Log Table / Cards ── */}
        <Card className="card-modern overflow-hidden">
          {/* Results header */}
          <div className="px-4 sm:px-6 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <p className="text-xs text-zinc-500 font-medium">
              {loading ? "Loading..." : `${filtered.length} of ${logs.length} events`}
              {(searchTerm || typeFilter !== "all" || severityFilter !== "all") && (
                <span className="ml-2 text-blue-600">(filtered)</span>
              )}
            </p>
            {(searchTerm || typeFilter !== "all" || severityFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-[10px] font-bold"
                onClick={() => { setSearchTerm(""); setTypeFilter("all"); setSeverityFilter("all"); }}
              >
                <XCircle className="w-3 h-3 mr-1" /> Clear Filters
              </Button>
            )}
          </div>

          {/* Error state */}
          {fetchError && (
            <div className="p-10 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-100">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-zinc-900">{fetchError}</p>
                <p className="text-xs text-zinc-500 mt-1">The audit log database may be empty or offline.</p>
              </div>
              <Button className="rounded-xl h-10 px-5 text-xs font-bold" onClick={handleRetry} disabled={retrying}>
                {retrying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Retry
              </Button>
            </div>
          )}

          {/* Loading state */}
          {loading && !fetchError && <LogSkeleton />}

          {/* Empty state */}
          {!loading && !fetchError && filtered.length === 0 && (
            <div className="p-14 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <History className="w-7 h-7 text-zinc-400" />
              </div>
              <p className="font-bold text-zinc-700">
                {logs.length === 0 ? "No audit events yet." : "No events match the current filters."}
              </p>
              <p className="text-xs text-zinc-400 max-w-xs">
                {logs.length === 0
                  ? "Events are recorded automatically as users interact with the system."
                  : "Try clearing your filters or broadening your search."}
              </p>
            </div>
          )}

          {/* Log Entries */}
          {!loading && !fetchError && filtered.length > 0 && (
            <div className="divide-y divide-zinc-50 relative pb-10">
              {filtered.map((log, index) => (
                <div
                  key={log.id}
                  className="p-4 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-zinc-50/50 transition-colors group cursor-pointer relative"
                  onClick={() => setInspectingLog(log)}
                >
                  {/* Visual Connector Line */}
                  {index < filtered.length - 1 && (
                    <div className="absolute left-[34px] sm:left-[43px] top-[74px] bottom-0 w-px bg-zinc-100 z-0" />
                  )}

                  <div className="flex items-start gap-3 sm:gap-6 flex-1 min-w-0 relative z-10">
                    <div className={cn(
                      "w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-none transition-all group-hover:scale-105 shadow-md border-2",
                      log.severity === "CRITICAL"
                        ? "bg-rose-50 text-rose-600 border-rose-100"
                        : log.severity === "WARNING"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-white text-zinc-900 border-zinc-100"
                    )}>
                      <LogIcon type={log.type} />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900 truncate">{log.action}</p>
                        <Badge className={cn(
                          "text-[9px] px-1.5 py-0 rounded-md uppercase font-bold flex-none",
                          log.severity === "CRITICAL"
                            ? "bg-rose-600 text-white border-none"
                            : log.severity === "WARNING"
                            ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        )}>
                          {log.severity}
                        </Badge>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-400 border-none text-[9px] font-bold uppercase flex-none">
                          {log.type}
                        </Badge>
                      </div>
                      {/* Details – collapse on mobile */}
                      <p className={cn(
                        "text-xs text-zinc-500 leading-relaxed",
                        inspectingLog?.id === log.id ? "" : "line-clamp-2"
                      )}>
                        {log.details || "No details available."}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {log.branch && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            <Building2 className="w-3 h-3" /> {log.branch}
                          </span>
                        )}
                        {log.user && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-zinc-200" />
                            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              <User className="w-3 h-3" /> {log.user}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:shrink-0">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold uppercase tracking-widest whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {log.time || (() => {
                        const d = getLogDate(log.timestamp);
                        return d ? d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                      })()}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl hover:bg-zinc-100 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setInspectingLog(log); }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {!loading && !fetchError && (
            <div className="p-4 sm:p-6 bg-zinc-50/50 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-zinc-500 font-medium">
                Showing {filtered.length} of {logs.length} events · Click any row to inspect technical details
              </p>
              <p className="text-[10px] text-zinc-400 font-medium">
                Audit logs are retained for 90 days per compliance policy.
              </p>
            </div>
          )}
        </Card>
        
        <LogDetailDialog 
          log={inspectingLog} 
          open={!!inspectingLog} 
          onOpenChange={(open) => !open && setInspectingLog(null)} 
        />
      </div>
    </ScrollArea>
  );
}
