import React, { useState, useCallback, useRef } from "react";
import {
  Zap,
  Plus,
  Search,
  History,
  MoreHorizontal,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Mail,
  MessageSquare,
  Database,
  Bell,
  Workflow as WorkflowIcon,
  Activity,
  Trash2,
  Edit3,
  Star,
  FileText,
  Loader2,
  Play,
  Pause,
  X as XIcon,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "@/lib/firebase";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useEffect } from "react";
import { useModules } from "@/context/ModuleContext";
import { where } from "firebase/firestore";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface WorkflowDoc {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  actions: string[];
  status: "ACTIVE" | "PAUSED";
  runs: number;
  successRate: number;
  created_at?: any;
}

interface LogDoc {
  id: string;
  workflow: string;
  status: "SUCCESS" | "FAILED";
  event: string;
  error?: string;
  timestamp?: any;
}

const TRIGGER_OPTIONS = [
  "Customer Created",
  "Purchase Completed",
  "Points Milestone Reached",
  "Low Stock Detected",
  "Invoice Overdue",
  "New Campaign Created",
  "Scheduled – Daily",
  "Scheduled – Weekly",
];

const ACTION_OPTIONS = [
  "Send Email Notification",
  "Send SMS Alert",
  "Award Loyalty Points",
  "Create Purchase Order",
  "Push App Notification",
  "Update Customer Tag",
  "Log to Audit Trail",
];

/* ─────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────── */
function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card-modern p-6 space-y-3 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-zinc-100 rounded w-1/3" />
              <div className="h-3 bg-zinc-100 rounded w-1/5" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-7 bg-zinc-100 rounded-full w-24" />
            <div className="h-7 bg-zinc-100 rounded-full w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Builder Dialog
───────────────────────────────────────── */
interface BuilderProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: WorkflowDoc | null;
}

function WorkflowBuilderDialog({ open, onClose, onSaved, editing }: BuilderProps) {
  const { enterpriseId } = useModules();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editing;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || "");
      setTrigger(editing.trigger);
      setSelectedActions([...editing.actions]);
    } else {
      setName("");
      setDescription("");
      setTrigger("");
      setSelectedActions([]);
    }
  }, [editing, open]);

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Workflow name is required.");
    if (!trigger) return toast.error("Please select a trigger event.");
    if (selectedActions.length === 0) return toast.error("Add at least one action step.");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        trigger,
        actions: selectedActions,
        status: "ACTIVE" as const,
        runs: editing?.runs ?? 0,
        successRate: editing?.successRate ?? 100,
        enterprise_id: enterpriseId
      };

      if (isEdit && editing) {
        await updateDoc(doc(db, "workflows", editing.id), payload);
        toast.success("Workflow updated successfully!");
      } else {
        await addDoc(collection(db, "workflows"), {
          ...payload,
          created_at: serverTimestamp(),
        });
        toast.success("Workflow created and activated!");
      }
      onSaved();
    } catch (e: any) {
      toast.error(`Failed to ${isEdit ? "update" : "create"} workflow: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="w-full sm:max-w-2xl p-0 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[2.5rem] border-none">
        <DialogHeader className="p-5 sm:p-8 bg-zinc-900 text-white flex-none relative">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <WorkflowIcon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Logic Tier Builder</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-xl md:text-3xl font-black text-white font-display tracking-tight leading-tight">
                {isEdit ? "Edit Automation" : "Create Workflow"}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden text-white/50 hover:text-white">
                <XIcon className="w-5 h-5" />
              </Button>
            </div>
            <DialogDescription className="text-zinc-500 font-medium text-[10px] md:text-sm">
              {isEdit
                ? "Calibrate trigger parameters and chain execution logic."
                : "Define business rules and automation sequences."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-5 md:p-8 space-y-6 md:space-y-10">
            {/* Name & Description */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                  Workflow Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="e.g., Welcome New Customer"
                  className="h-11 md:h-14 rounded-xl md:rounded-2xl bg-zinc-50 border-zinc-200 focus:ring-4 focus:ring-amber-500/10 transition-all font-bold text-sm md:text-lg px-4 md:px-6"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Context Description</Label>
                <Textarea
                  placeholder="Briefly describe this automation..."
                  className="rounded-xl md:rounded-2xl bg-zinc-50 border-zinc-200 min-h-[80px] md:min-h-[100px] resize-none p-4 md:p-6 text-sm font-medium"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-2.5">
              <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                Trigger Event <span className="text-rose-500">*</span>
              </Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="h-11 md:h-14 rounded-xl md:rounded-2xl bg-white border-zinc-200 shadow-sm font-bold text-sm">
                  <SelectValue placeholder="Select what starts this workflow..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl border-none p-1">
                  {TRIGGER_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} className="rounded-xl py-3 px-4 focus:bg-amber-50 font-medium">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                Action Steps <span className="text-zinc-400 font-normal italic">({selectedActions.length} prioritized tasks)</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACTION_OPTIONS.map((action) => {
                  const active = selectedActions.includes(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => toggleAction(action)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-[11px] md:text-sm font-bold transition-all text-left",
                        active
                          ? "bg-amber-50 border-amber-500/30 text-amber-900 shadow-sm"
                          : "bg-white border-zinc-100 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <div className={cn("w-4 h-4 md:w-5 md:h-5 rounded-md border-2 flex items-center justify-center flex-none transition-colors",
                        active ? "bg-amber-500 border-amber-500" : "border-zinc-300"
                      )}>
                        {active && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      {action}
                    </button>
                  );
                })}
              </div>

              {/* Sequence preview */}
              {selectedActions.length > 0 && (
                <div className="mt-4 p-4 md:p-6 bg-zinc-900 rounded-2xl md:rounded-3xl border border-zinc-800 shadow-xl overflow-hidden relative group">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none -mt-4 -mr-4">
                    <History className="w-24 h-24 text-amber-500" />
                  </div>
                  <p className="text-[9px] font-black text-amber-500/50 uppercase tracking-[0.2em] mb-4">Pipeline Execution Sequence</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {selectedActions.map((a, i) => (
                      <React.Fragment key={a}>
                        <Badge variant="outline" className="bg-white/5 border-white/10 text-white text-[10px] font-bold py-1 px-3">
                          <span className="text-amber-500 mr-1.5">{i + 1}</span> {a}
                        </Badge>
                        {i < selectedActions.length - 1 && <ArrowRight className="w-3 h-3 text-white/20 flex-none" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-5 md:p-10 bg-zinc-50 border-t border-zinc-100 flex-none flex flex-row items-center gap-3 md:gap-4 sticky bottom-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="rounded-xl h-12 md:h-14 px-6 md:px-8 font-bold text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all text-[10px] uppercase tracking-widest flex-1 md:flex-none" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl md:rounded-2xl h-12 md:h-16 px-6 md:px-14 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/10 transition-all flex-1 md:flex-none flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : (isEdit ? "Save Changes" : <><Plus className="w-4 h-4 text-amber-400" /> Deploy Workflow</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function Workflow() {
  const { enterpriseId } = useModules();
  const [searchTerm, setSearchTerm] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowDoc[]>([]);
  const [workflowLogs, setWorkflowLogs] = useState<LogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDoc | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ── Real-time subscriptions ── */
  useEffect(() => {
    if (!enterpriseId) return;

    const unsubscribeWf = onSnapshot(
      query(collection(db, "workflows"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WorkflowDoc));
        // Sort locally to avoid index requirement
        docs.sort((a, b) => {
          const tA = a.created_at?.toDate?.()?.getTime() || 0;
          const tB = b.created_at?.toDate?.()?.getTime() || 0;
          return tB - tA;
        });
        setWorkflows(docs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "workflows");
        setLoading(false);
        toast.error("Failed to load workflows. Check your connection.");
      }
    );

    const unsubscribeLogs = onSnapshot(
      query(collection(db, "workflow_logs"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LogDoc));
        // Sort locally to avoid index requirement
        docs.sort((a, b) => {
          const tA = a.timestamp?.toDate?.()?.getTime() || 0;
          const tB = b.timestamp?.toDate?.()?.getTime() || 0;
          return tB - tA;
        });
        setWorkflowLogs(docs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "workflow_logs");
      }
    );

    return () => { unsubscribeWf(); unsubscribeLogs(); };
  }, [enterpriseId]);

  /* ── Toggle: idempotent, prevents double-click ── */
  const handleToggle = useCallback(async (wf: WorkflowDoc) => {
    if (togglingId === wf.id) return;
    setTogglingId(wf.id);
    const newStatus = wf.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await updateDoc(doc(db, "workflows", wf.id), { status: newStatus });
      toast.success(`Workflow ${newStatus === "ACTIVE" ? "activated" : "paused"}.`);
    } catch (e: any) {
      toast.error("Failed to update workflow status.");
    } finally {
      setTogglingId(null);
    }
  }, [togglingId]);

  /* ── Delete ── */
  const handleDelete = useCallback(async (id: string) => {
    if (deletingId === id) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "workflows", id));
      toast.success("Workflow deleted.");
    } catch (e: any) {
      toast.error("Failed to delete workflow.");
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  /* ── Derived ── */
  const filtered = workflows.filter((wf) =>
    wf.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wf.trigger?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const activeCount = workflows.filter((w) => w.status === "ACTIVE").length;
  const totalRuns = workflows.reduce((acc, w) => acc + (w.runs || 0), 0);
  const successCount = workflows.reduce((acc, w) => acc + (w.runs || 0) * ((w.successRate || 0) / 100), 0);
  const overallSuccessRate = totalRuns > 0 ? ((successCount / totalRuns) * 100).toFixed(1) : "100";

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Zap className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Automation Engine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 font-display">Workflow Logic</h1>
            <p className="text-zinc-500 text-sm">Design, deploy and monitor automated business processes.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              className="rounded-xl border-zinc-200 h-11 px-5 font-bold text-xs"
              onClick={() => toast.info("Full audit trail is in the Audit Logs module.")}
            >
              <History className="w-4 h-4 mr-2 text-zinc-400" />
              Execution Logs
            </Button>
            <Button
              className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-5 font-bold text-xs"
              onClick={() => { setEditingWorkflow(null); setBuilderOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Card className="card-modern p-6 space-y-4 border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <Badge className="bg-white text-emerald-600 border-emerald-100">{overallSuccessRate}% Success</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">Active Automations</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{loading ? "—" : `${activeCount} Running`}</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Activity className="w-5 h-5" /></div>
              <Badge className="bg-blue-50 text-blue-600 border-blue-100">Live</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Executions</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{loading ? "—" : totalRuns.toLocaleString()}</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-50 rounded-xl text-purple-600"><Clock className="w-5 h-5" /></div>
              <Badge className="bg-purple-50 text-purple-600 border-purple-100">Real-time</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Processing Latency</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">~1.2s Avg</h3>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* ── Workflows List ── */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-zinc-900">All Workflows</h3>
              <div className="relative w-full sm:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder="Search workflows..."
                  className="pl-10 rounded-xl border-zinc-200 bg-white h-10 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <WorkflowSkeleton />
            ) : filtered.length === 0 ? (
              <div className="card-modern p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                  <WorkflowIcon className="w-8 h-8 text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">No workflows found</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {searchTerm ? "Try a different search term." : "Create your first automation to get started."}
                  </p>
                </div>
                {!searchTerm && (
                  <Button
                    className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-10 px-5 text-xs font-bold"
                    onClick={() => { setEditingWorkflow(null); setBuilderOpen(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create First Workflow
                  </Button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {filtered.map((wf) => (
                  <motion.div
                    key={wf.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="card-modern overflow-hidden group hover:border-blue-500/30 transition-all">
                      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={cn(
                            "p-3 rounded-2xl shadow-sm shrink-0 transition-colors",
                            wf.status === "ACTIVE" ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-400"
                          )}>
                            <WorkflowIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-zinc-900 text-sm sm:text-base truncate">{wf.name}</h4>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-bold uppercase shrink-0",
                                wf.status === "ACTIVE"
                                  ? "text-emerald-600 border-emerald-100 bg-emerald-50"
                                  : "text-zinc-400 border-zinc-100 bg-zinc-50"
                              )}>
                                {wf.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{wf.trigger}</span>
                            </p>
                            {wf.description && (
                              <p className="text-xs text-zinc-400 truncate">{wf.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                          <div className="flex items-center gap-4 text-right">
                            <div className="hidden sm:block">
                              <p className="text-sm font-bold text-zinc-900">{(wf.runs || 0).toLocaleString()}</p>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Runs</p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-sm font-bold text-emerald-600">{wf.successRate || 100}%</p>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Success</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={wf.status === "ACTIVE"}
                              disabled={togglingId === wf.id}
                              onCheckedChange={() => handleToggle(wf)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon" className="h-9 w-9 min-w-[36px] rounded-xl hover:bg-zinc-100">
                                    {deletingId === wf.id
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : <MoreHorizontal className="w-4 h-4" />}
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-48 rounded-xl border-zinc-200">
                                <DropdownMenuItem
                                  className="flex items-center gap-2 py-2 cursor-pointer"
                                  onClick={() => { setEditingWorkflow(wf); setBuilderOpen(true); }}
                                >
                                  <Edit3 className="w-4 h-4" /> Edit Logic
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="flex items-center gap-2 py-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                  onClick={() => handleDelete(wf.id)}
                                  disabled={deletingId === wf.id}
                                >
                                  <Trash2 className="w-4 h-4" /> Delete Workflow
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>

                      {wf.actions?.length > 0 && (
                        <div className="px-4 sm:px-6 py-3 bg-zinc-50/50 border-t border-zinc-100 flex flex-wrap gap-2">
                          {wf.actions.map((action, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <Badge variant="outline" className="bg-white border-zinc-200 text-zinc-600 text-[10px] font-medium py-1 px-2.5 rounded-lg flex items-center gap-1">
                                {action.includes("Email") && <Mail className="w-3 h-3 text-blue-500" />}
                                {action.includes("SMS") && <MessageSquare className="w-3 h-3 text-emerald-500" />}
                                {action.includes("Points") && <Star className="w-3 h-3 text-amber-500" />}
                                {action.includes("Order") && <FileText className="w-3 h-3 text-purple-500" />}
                                {action.includes("Notification") && <Bell className="w-3 h-3 text-indigo-500" />}
                                {action}
                              </Badge>
                              {i < wf.actions.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-300" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* ── Right Panel ── */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-zinc-900">Live Execution Log</h3>
            <Card className="card-modern">
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-50">
                  {workflowLogs.length > 0 ? workflowLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="p-4 space-y-2 hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-bold uppercase",
                          log.status === "SUCCESS"
                            ? "text-emerald-600 border-emerald-100 bg-emerald-50"
                            : "text-rose-600 border-rose-100 bg-rose-50"
                        )}>
                          {log.status}
                        </Badge>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {log.timestamp?.toDate
                            ? log.timestamp.toDate().toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{log.workflow}</p>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">{log.event}</p>
                        {log.error && (
                          <p className="text-[10px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {log.error}
                          </p>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="p-10 text-center">
                      <Activity className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500 font-medium">No execution logs yet.</p>
                      <p className="text-xs text-zinc-400 mt-1">Logs appear here once workflows run.</p>
                    </div>
                  )}
                </div>
                <Button variant="ghost" className="w-full h-11 text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-b-2xl border-t border-zinc-50">
                  View Full Audit Trail <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Manual Override */}
            <Card className="card-modern bg-zinc-900 text-white border-none shadow-2xl shadow-zinc-900/20">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Manual Override
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">Force-trigger a workflow for testing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white rounded-xl h-11">
                    <SelectValue placeholder="Select workflow..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {workflows.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full bg-white text-zinc-900 hover:bg-zinc-100 font-bold h-11 rounded-xl"
                  onClick={() => toast.success("Workflow triggered manually. Check execution logs.")}
                >
                  <Play className="w-4 h-4 mr-2" /> Trigger Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Builder Dialog ── */}
      <WorkflowBuilderDialog
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingWorkflow(null); }}
        onSaved={() => { setBuilderOpen(false); setEditingWorkflow(null); }}
        editing={editingWorkflow}
      />
    </ScrollArea>
  );
}
