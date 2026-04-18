import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  Users,
  Plus,
  Search,
  Trash2,
  Calendar,
  Target,
  Loader2,
  AlertTriangle,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "@/lib/firebase";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface Rule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface GroupDoc {
  id: string;
  name: string;
  description?: string;
  type: "Dynamic" | "Manual";
  rules: Rule[];
  member_count: number;
  last_synced: string;
  created_at?: any;
}

const FIELD_LABELS: Record<string, string> = {
  balance: "Account Balance",
  loyalty_points: "Loyalty Points",
  segment: "Customer Segment",
  days_since_active: "Days Since Last Active",
  tags: "Contains Tag",
};

const OPERATOR_LABELS: Record<string, string> = {
  ">": "Greater Than",
  ">=": "Greater Than or Equal",
  "<": "Less Than",
  "<=": "Less Than or Equal",
  "==": "Equals",
  "!=": "Does Not Equal",
  "contains": "Contains",
};

/* ─────────────────────────────────────────
   Skeleton
───────────────────────────────────────── */
function GroupSkeleton() {
  return (
    <div className="divide-y divide-zinc-50">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 sm:p-6 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex-none" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-zinc-100 rounded w-1/3" />
            <div className="h-3 bg-zinc-100 rounded w-1/4" />
          </div>
          <div className="h-7 bg-zinc-100 rounded-full w-14 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Mobile Group Card
───────────────────────────────────────── */
interface GroupCardProps { group: GroupDoc; onDelete: () => void; }
function GroupCard({ group, onDelete }: GroupCardProps) {
  return (
    <div className="p-4 flex items-start gap-3 hover:bg-zinc-50/50 transition-colors">
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-none",
        group.type === "Dynamic" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
      )}>
        {group.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 text-sm truncate">{group.name}</p>
            {group.description && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{group.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={cn(
                "text-[10px] font-bold",
                group.type === "Dynamic"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              )}>
                {group.type}
              </Badge>
              <Badge className="rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                {(group.member_count || 0).toLocaleString()} members
              </Badge>
              <span className="text-[10px] text-zinc-400">
                Synced {group.last_synced ? new Date(group.last_synced).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-w-[32px] text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Builder Dialog
───────────────────────────────────────── */
interface BuilderProps {
  open: boolean;
  onClose: () => void;
}

function GroupBuilderDialog({ open, onClose }: BuilderProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Dynamic" | "Manual">("Dynamic");
  const [rules, setRules] = useState<Rule[]>([
    { id: Date.now().toString(), field: "balance", operator: ">", value: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setDescription(""); setType("Dynamic");
    setRules([{ id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleAddRule = () => {
    setRules((prev) => [...prev, { id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
  };

  const handleUpdateRule = useCallback((id: string, key: keyof Rule, val: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }, []);

  const handleRemoveRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Group name is required.");
    if (type === "Dynamic") {
      const invalid = rules.find((r) => !r.value.trim());
      if (invalid) return toast.error("All rule values must be filled in.");
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "customer_groups"), {
        name: name.trim(),
        description: description.trim(),
        type,
        rules: type === "Dynamic" ? rules : [],
        member_count: 0,
        last_synced: new Date().toISOString(),
        created_at: serverTimestamp(),
      });
      toast.success("Group created successfully!");
      handleClose();
    } catch (e: any) {
      toast.error("Failed to create group: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 sm:p-8 bg-zinc-900 text-white">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-white">Create Customer Group</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Define rules to automatically segment customers, or create a manual group.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Name & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Group Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. VIP Customers"
                  className="h-12 rounded-xl bg-zinc-50 border-zinc-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Group Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "Dynamic" | "Manual")}>
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Dynamic">Dynamic (Rule-based)</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Description</Label>
              <Input
                placeholder="Briefly describe who belongs in this group..."
                className="h-12 rounded-xl bg-zinc-50 border-zinc-200"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Dynamic Rules */}
            {type === "Dynamic" && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-zinc-900">Dynamic Rules</Label>
                  <Button variant="outline" size="sm" className="rounded-lg text-xs font-bold h-8" onClick={handleAddRule}>
                    <Plus className="w-3 h-3 mr-1" /> Add Rule
                  </Button>
                </div>
                <AnimatePresence>
                  {rules.map((rule, idx) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row gap-2 p-4 border border-zinc-100 rounded-xl bg-white shadow-sm">
                        <span className="text-xs font-bold text-zinc-400 sm:hidden uppercase">Rule {idx + 1}</span>
                        <Select value={rule.field} onValueChange={(v) => handleUpdateRule(rule.id, "field", v)}>
                          <SelectTrigger className="h-10 rounded-lg bg-zinc-50 border-zinc-200 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {Object.entries(FIELD_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={rule.operator} onValueChange={(v) => handleUpdateRule(rule.id, "operator", v)}>
                          <SelectTrigger className="h-10 rounded-lg bg-zinc-50 border-zinc-200 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {Object.entries(OPERATOR_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 flex-1">
                          <Input
                            placeholder="Value..."
                            className="h-10 rounded-lg bg-zinc-50 border-zinc-200 flex-1"
                            value={rule.value}
                            onChange={(e) => handleUpdateRule(rule.id, "value", e.target.value)}
                          />
                          {rules.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 min-w-[40px] text-rose-500 hover:bg-rose-50 rounded-lg"
                              onClick={() => handleRemoveRule(rule.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  All rules are combined with AND logic. Members must match every condition.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-5 sm:p-6 bg-zinc-50 border-t border-zinc-100">
          <Button variant="ghost" className="rounded-xl font-bold px-5" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 shadow-lg shadow-blue-600/20"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────
   Delete Confirm Dialog
───────────────────────────────────────── */
interface DeleteDialogProps {
  group: GroupDoc | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirmDialog({ group, onConfirm, onCancel, deleting }: DeleteDialogProps) {
  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-zinc-100 p-6">
        <DialogHeader>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-4 border border-rose-100">
            <Trash2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Delete Group?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{group?.name}</strong>? This cannot be undone and will remove the segment from all linked workflows.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex gap-3">
          <Button variant="outline" className="rounded-xl font-bold flex-1" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex-1 shadow-lg shadow-rose-600/20"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : "Delete Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function Groups() {
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<GroupDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "customer_groups"), orderBy("created_at", "desc")),
      (snapshot) => {
        setGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc)));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "customer_groups");
        setLoading(false);
        toast.error("Failed to load groups.");
      }
    );
    return () => unsub();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!groupToDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "customer_groups", groupToDelete.id));
      toast.success("Group deleted.");
      setGroupToDelete(null);
    } catch (e: any) {
      toast.error("Failed to delete group: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() =>
    groups.filter((g) =>
      g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [groups, searchQuery]
  );

  const dynamicCount = groups.filter((g) => g.type === "Dynamic").length;
  const totalMembers = groups.reduce((acc, g) => acc + (g.member_count || 0), 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Command className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Segmentation & Automations</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 font-display">Customer Groups</h1>
            <p className="text-zinc-500 text-sm">Dynamic rule-based segments for targeted marketing and workflows.</p>
          </div>
          <Button
            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-5 font-bold text-xs self-start sm:self-auto"
            onClick={() => setIsBuilderOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Group
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="card-modern p-4 sm:p-6 border-blue-100 bg-blue-50/30">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Active</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : groups.length}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Total Groups</p>
          </Card>
          <Card className="card-modern p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <Target className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-100 text-[10px]">Dynamic</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : dynamicCount}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Rule-Based Segments</p>
          </Card>
          <Card className="card-modern p-4 sm:p-6 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-100 text-[10px]">Live</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : totalMembers.toLocaleString()}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Total Members</p>
          </Card>
        </div>

        {/* ── Table / Cards ── */}
        <Card className="card-modern overflow-hidden">
          <CardHeader className="border-b border-zinc-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold">All Segments</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {loading ? "Loading..." : `${filtered.length} of ${groups.length} groups shown`}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder="Filter groups..."
                  className="pl-10 rounded-xl border-zinc-200 h-10 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          {/* Mobile view */}
          <div className="block sm:hidden">
            {loading ? (
              <GroupSkeleton />
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="font-bold text-zinc-600">
                  {searchQuery ? "No groups match your search." : "No groups yet."}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-zinc-400 mt-1">Create your first segment to get started.</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {filtered.map((group, i) =>
                  React.createElement(GroupCard, {
                    key: group.id,
                    group,
                    onDelete: () => setGroupToDelete(group)
                  })
                )}
              </div>
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="py-4 px-6 text-left font-bold text-zinc-900 text-sm">Group Name</th>
                  <th className="py-4 px-6 text-left font-bold text-zinc-900 text-sm">Type</th>
                  <th className="py-4 px-6 text-center font-bold text-zinc-900 text-sm">Members</th>
                  <th className="py-4 px-6 text-left font-bold text-zinc-900 text-sm">Last Synced</th>
                  <th className="py-4 px-6 text-right font-bold text-zinc-900 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center">
                      <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                      <p className="font-bold text-zinc-600">
                        {searchQuery ? "No groups match your search." : "No customer groups found."}
                      </p>
                      {!searchQuery && (
                        <Button
                          className="mt-4 rounded-xl bg-zinc-900 text-white text-xs font-bold h-9 px-5"
                          onClick={() => setIsBuilderOpen(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Create First Group
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((group) => (
                    <tr key={group.id} className="border-t border-zinc-50 hover:bg-zinc-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-zinc-900 text-sm">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-zinc-500 mt-0.5">{group.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Badge
                          variant="outline"
                          className={group.type === "Dynamic"
                            ? "bg-orange-50 text-orange-700 border-orange-200 text-[10px] font-bold"
                            : "bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold"}
                        >
                          {group.type}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge className="rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs">
                          {(group.member_count || 0).toLocaleString()}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-xs text-zinc-400">
                        {group.last_synced ? new Date(group.last_synced).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          onClick={() => setGroupToDelete(group)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <GroupBuilderDialog open={isBuilderOpen} onClose={() => setIsBuilderOpen(false)} />
      <DeleteConfirmDialog
        group={groupToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setGroupToDelete(null)}
        deleting={deleting}
      />
    </ScrollArea>
  );
}
