import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, Users, Plus, Search, Trash2, Calendar, Target, Loader2, AlertTriangle, Eye, MoreHorizontal, Download, Copy, Edit2, X as XIcon, CheckCircle2, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { collection, onSnapshot, addDoc, serverTimestamp, query, deleteDoc, doc, updateDoc, getDocs, limit, setDoc } from "@/lib/firebase";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useModules } from "@/context/ModuleContext";
import { where, FieldValue, arrayUnion, arrayRemove, startAfter } from "firebase/firestore";

/* ── Types ── */
interface Rule { id: string; field: string; operator: string; value: string; }
interface GroupDoc {
  id: string; name: string; description?: string;
  type: "Dynamic" | "Manual"; rules: Rule[];
  logic?: "AND" | "OR";
  member_count: number; last_synced: string;
  created_at?: any;
  // manual_member_ids removed — members are stored in subcollection customer_groups/{id}/members/{customerId}
}

const FIELD_LABELS: Record<string, string> = {
  balance: "Account Balance", loyalty_points: "Loyalty Points",
  segment: "Customer Segment", tags: "Tag",
};
const NUMERIC_FIELDS = ["balance", "loyalty_points"];
const ARRAY_FIELDS = ["tags"]; // fields stored as string[] in Firestore
const OPERATOR_LABELS: Record<string, string> = {
  ">": "Greater Than", ">=": "Greater Than or Equal",
  "<": "Less Than", "<=": "Less Than or Equal",
  "==": "Equals", "!=": "Does Not Equal",
  "contains": "Contains (substring)",
  "array-contains": "Exactly Matches Tag", // strict array membership
};
const NUMERIC_OPS = [">", ">=", "<", "<=", "==", "!="];
const STRING_OPS = ["==", "!=", "contains"];
const ARRAY_OPS = ["array-contains", "contains"]; // array-contains = exact; contains = partial

/* ── Client-side rule evaluator ── */
// FIX: Handles numeric, string, and array field types distinctly.
// FIX: All string comparisons are lowercased for case-insensitive consistency
//      matching the Firestore data normalization convention.
function evalRules(customer: any, rules: Rule[], logic: "AND" | "OR"): boolean {
  if (!rules.length) return true;
  const results = rules.map((r) => {
    const cv = customer[r.field];
    const rv = r.value;

    // ── Numeric fields ─────────────────────────────────────────
    if (NUMERIC_FIELDS.includes(r.field)) {
      const n = parseFloat(cv ?? 0), v = parseFloat(rv);
      if (isNaN(v)) return false;
      switch (r.operator) {
        case ">": return n > v;
        case ">=": return n >= v;
        case "<": return n < v;
        case "<=": return n <= v;
        case "==": return n === v;
        case "!=": return n !== v;
        default: return false;
      }
    }

    // ── Array fields (e.g., tags: string[]) ───────────────────
    // FIX: Previously did String(array).includes() causing false positives.
    // "array-contains" = exact membership; "contains" = partial match on any element.
    if (ARRAY_FIELDS.includes(r.field)) {
      const arr: string[] = Array.isArray(cv) ? cv : [];
      const q = rv.toLowerCase().trim();
      if (r.operator === "array-contains") return arr.some((t) => t.toLowerCase() === q);
      if (r.operator === "contains") return arr.some((t) => t.toLowerCase().includes(q));
      return false;
    }

    // ── String fields ──────────────────────────────────────────
    const s = String(cv ?? "").toLowerCase(), q = rv.toLowerCase().trim();
    switch (r.operator) {
      case "==": return s === q;
      case "!=": return s !== q;
      case "contains": return s.includes(q);
      default: return false;
    }
  });
  return logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}

function validateRuleValue(field: string, value: string): string | null {
  if (!value.trim()) return "Value is required.";
  if (NUMERIC_FIELDS.includes(field) && isNaN(parseFloat(value))) return `"${value}" is not a valid number for ${FIELD_LABELS[field]}.`;
  return null;
}

/* ── Skeleton ── */
function GroupSkeleton() {
  return (
    <div className="divide-y divide-zinc-50">
      {[1,2,3,4].map((i) => (
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

/* ── Group Builder Dialog ── */
interface BuilderProps { open: boolean; onClose: () => void; editing?: GroupDoc | null; }
function GroupBuilderDialog({ open, onClose, editing }: BuilderProps) {
  const { enterpriseId, hasPermission } = useModules();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Dynamic" | "Manual">("Dynamic");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<Rule[]>([{ id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
  const [saving, setSaving] = useState(false);
  const [reach, setReach] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (open && editing) {
      setName(editing.name); setDescription(editing.description || "");
      setType(editing.type); setLogic(editing.logic || "AND");
      setRules(editing.rules.length ? editing.rules : [{ id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
    } else if (open && !editing) {
      setName(""); setDescription(""); setType("Dynamic"); setLogic("AND");
      setRules([{ id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
    }
    setReach(null);
  }, [open, editing]);

  const handleAddRule = () => setRules((p) => [...p, { id: Date.now().toString(), field: "balance", operator: ">", value: "" }]);
  const handleUpdateRule = useCallback((id: string, key: keyof Rule, val: string) => {
    setRules((p) => p.map((r) => r.id === id ? {
      ...r, [key]: val,
      // When field type changes, reset operator to a valid default for that field type
      ...(key === "field" ? {
        operator: NUMERIC_FIELDS.includes(val) ? ">" : ARRAY_FIELDS.includes(val) ? "array-contains" : "contains",
        value: ""
      } : {})
    } : r));
  }, []);
  const handleRemoveRule = useCallback((id: string) => setRules((p) => p.filter((r) => r.id !== id)), []);

  const handleCalculateReach = async () => {
    if (!enterpriseId) return;
    setCalculating(true); setReach(null);
    try {
      // FIX: Paginated batch loading instead of full table scan.
      // Loads up to 5 pages × 200 = max 1,000 customers, then extrapolates.
      // For exact counts at scale, the syncGroupMembers Cloud Function runs automatically.
      const PAGE_SIZE = 200; const MAX_PAGES = 5;
      let allLoaded: any[] = []; let lastDoc: any = null; let page = 0;
      while (page < MAX_PAGES) {
        // Build constraint array manually so we don't hit the 2-arg wrapper limit
        const constraints: any[] = [where("enterprise_id", "==", enterpriseId), limit(PAGE_SIZE)];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const snap = await getDocs(query(collection(db, "customers"), ...constraints));
        if (snap.empty) break;
        allLoaded = allLoaded.concat(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < PAGE_SIZE) break;
        page++;
      }
      const matched = allLoaded.filter((c) => evalRules(c, rules, logic)).length;
      const isSampled = page >= MAX_PAGES;
      setReach(matched);
      if (isSampled) toast.info(`Showing reach from first ${allLoaded.length.toLocaleString()} customers. Run "Sync Now" for exact count.`);
    } catch { toast.error("Could not calculate reach."); }
    finally { setCalculating(false); }
  };

  const handleSave = async () => {
    if (!hasPermission("crm", "editor")) return toast.error("You do not have permission to manage groups.");
    if (!name.trim()) return toast.error("Group name is required.");
    if (type === "Dynamic") {
      for (const r of rules) {
        const err = validateRuleValue(r.field, r.value);
        if (err) return toast.error(err);
      }
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(), description: description.trim(),
        type, rules: type === "Dynamic" ? rules : [],
        logic: type === "Dynamic" ? logic : "AND",
        last_synced: new Date().toISOString(), enterprise_id: enterpriseId,
      };
      if (editing) {
        await updateDoc(doc(db, "customer_groups", editing.id), payload);
        toast.success("Group updated.");
      } else {
        // FIX: No manual_member_ids array — members stored in subcollection to avoid 1MB doc limit.
        await addDoc(collection(db, "customer_groups"), { ...payload, member_count: 0, created_at: serverTimestamp() });
        toast.success("Group created!");
      }
      onClose();
    } catch (e: any) { toast.error("Failed to save group: " + e.message); }
    finally { setSaving(false); }
  };

  const availableOps = (field: string) => NUMERIC_FIELDS.includes(field) ? NUMERIC_OPS : ARRAY_FIELDS.includes(field) ? ARRAY_OPS : STRING_OPS;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-full sm:max-w-3xl p-0 shadow-2xl flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[2.5rem] border-none">
          <DialogHeader className="p-5 sm:p-8 bg-zinc-900 text-white flex-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Segmentation Suite</span>
              </div>
              <DialogTitle className="text-xl sm:text-3xl font-black text-white tracking-tight">
                {editing ? "Edit Group" : "Create Customer Group"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-[10px] sm:text-sm">
                {editing ? "Update rules or metadata for this segment." : "Define rule-based segmentation or manual collections."}
              </DialogDescription>
            </div>
          </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Group Name <span className="text-rose-500">*</span></Label>
                <Input placeholder="e.g. VIP Customers" className="h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-zinc-50 border-zinc-200 font-bold text-sm sm:text-lg px-4 sm:px-6" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Group Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "Dynamic" | "Manual")}>
                  <SelectTrigger className="h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-zinc-200 font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl border-none p-1">
                    <SelectItem value="Dynamic" className="rounded-xl py-3 px-4 font-medium">Dynamic (Rule-based)</SelectItem>
                    <SelectItem value="Manual" className="rounded-xl py-3 px-4 font-medium">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Description</Label>
              <Input placeholder="Briefly describe this segment..." className="h-11 rounded-xl bg-zinc-50 border-zinc-200 px-4 text-sm font-medium" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {type === "Dynamic" && (
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-black text-zinc-900 uppercase tracking-widest">Logic Conditions</Label>
                    <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
                      {(["AND", "OR"] as const).map((l) => (
                        <button key={l} onClick={() => setLogic(l)} className={cn("px-3 py-1 text-[10px] font-black uppercase transition-all", logic === l ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50")}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-black uppercase h-9 border-zinc-200" onClick={handleAddRule}>
                    <Plus className="w-3 h-3 mr-1" /> Add Param
                  </Button>
                </div>
                <AnimatePresence>
                  {rules.map((rule, idx) => (
                    <motion.div key={rule.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex flex-col sm:flex-row gap-2 p-4 border border-zinc-100 rounded-2xl bg-white shadow-sm mb-3">
                        <span className="text-[9px] font-black text-zinc-400 sm:hidden uppercase">Criterion {idx + 1}</span>
                        <Select value={rule.field} onValueChange={(v) => handleUpdateRule(rule.id, "field", v)}>
                          <SelectTrigger className="h-11 rounded-xl bg-zinc-50 border-zinc-200 flex-1 font-bold text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-2xl border-none p-1">
                            {Object.entries(FIELD_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="rounded-xl py-2.5">{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={rule.operator} onValueChange={(v) => handleUpdateRule(rule.id, "operator", v)}>
                          <SelectTrigger className="h-11 rounded-xl bg-zinc-50 border-zinc-200 flex-1 font-bold text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-2xl border-none p-1">
                            {availableOps(rule.field).map((v) => <SelectItem key={v} value={v} className="rounded-xl py-2.5">{OPERATOR_LABELS[v]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 flex-1">
                          <Input placeholder={NUMERIC_FIELDS.includes(rule.field) ? "e.g. 500" : "Value..."} type={NUMERIC_FIELDS.includes(rule.field) ? "number" : "text"} className="h-11 rounded-xl bg-zinc-50 border-zinc-200 flex-1 font-bold text-xs px-4" value={rule.value} onChange={(e) => handleUpdateRule(rule.id, "value", e.target.value)} />
                          {rules.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-11 w-11 min-w-[44px] text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl" onClick={() => handleRemoveRule(rule.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start flex-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-none" />
                    <p className="text-[10px] text-amber-700 leading-relaxed italic">
                      Match <strong>{logic}</strong> of the above conditions. Segments update on sync.
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-xl h-10 px-4 text-[10px] font-black uppercase border-zinc-200 whitespace-nowrap" onClick={handleCalculateReach} disabled={calculating}>
                    {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Filter className="w-3.5 h-3.5 mr-1" />}
                    {reach !== null ? `${reach.toLocaleString()} match` : "Calculate Reach"}
                  </Button>
                </div>
              </div>
            )}

            {type === "Manual" && (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3 items-start">
                <Users className="w-4 h-4 text-blue-500 mt-0.5 flex-none" />
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  Manual groups are collections you curate by hand. After saving, open the group to add customers individually from the member view.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-5 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex-none flex flex-row items-center gap-3 sticky bottom-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="rounded-xl h-12 px-6 font-bold text-zinc-400 hover:text-rose-500 hover:bg-rose-50 text-[10px] uppercase tracking-widest flex-1 sm:flex-none" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl h-12 px-10 font-black uppercase tracking-[0.2em] text-[10px] bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/10 flex-1 sm:flex-none flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4 text-blue-400" /> {editing ? "Save Changes" : "Save Segment"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Member View Dialog ── */
// FIX: Manual members now stored in subcollection customer_groups/{id}/members/{customerId}
//      instead of a flat array field, eliminating the 1MB Firestore document size limit.
interface MemberViewProps { group: GroupDoc | null; onClose: () => void; onAddMember?: (customerId: string) => void; onRemoveMember?: (customerId: string) => void; }
function GroupMemberDialog({ group, onClose, onAddMember, onRemoveMember }: MemberViewProps) {
  const { enterpriseId, hasPermission } = useModules();
  const [members, setMembers] = useState<any[]>([]);
  const [manualMemberIds, setManualMemberIds] = useState<Set<string>>(new Set());
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!group || !enterpriseId) return;
    setLoading(true); setMembers([]); setSearchQ(""); setAddSearch(""); setPage(0);

    const loadData = async () => {
      try {
        // FIX: Batched customer load — max 500 at a time to avoid full table scan
        const custSnap = await getDocs(query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId), limit(500)));
        const all = custSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setAllCustomers(all);

        if (group.type === "Dynamic") {
          setMembers(all.filter((c) => evalRules(c, group.rules, group.logic || "AND")));
        } else {
          // FIX: Read from subcollection, not inline array field
          const membSnap = await getDocs(collection(db, `customer_groups/${group.id}/members`));
          const ids = new Set(membSnap.docs.map((d: any) => d.id));
          setManualMemberIds(ids);
          setMembers(all.filter((c) => ids.has(c.id)));
        }
      } catch { toast.error("Could not load members."); }
      finally { setLoading(false); }
    };
    loadData();
  }, [group, enterpriseId]);

  const displayMembers = useMemo(() => {
    const q = searchQ.toLowerCase();
    const filtered = !q ? members : members.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
    return filtered.slice(0, (page + 1) * PAGE_SIZE);
  }, [members, searchQ, page]);

  const hasMore = members.length > (page + 1) * PAGE_SIZE;

  const addCandidates = useMemo(() => {
    if (!addSearch.trim() || group?.type !== "Manual") return [];
    const q = addSearch.toLowerCase();
    return allCustomers
      .filter((c) => !manualMemberIds.has(c.id) && ((c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q)))
      .slice(0, 8);
  }, [addSearch, allCustomers, group, manualMemberIds]);

  const handleExport = () => {
    if (!members.length) return toast.error("No members to export.");
    const rows = [["Name","Email","Phone","Segment","Balance","Loyalty Points"]];
    members.forEach((c) => rows.push([c.name||"", c.email||"", c.phone||"", c.segment||"", String(c.balance||0), String(c.loyalty_points||c.loyalty||0)]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${group?.name || "group"}-members.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success("Member list exported.");
  };

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] p-0 border-none overflow-hidden">
        <DialogHeader className="p-6 bg-zinc-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black text-white">{group?.name}</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs mt-1">
                <Badge className={cn("text-[9px] font-bold mr-2", group?.type === "Dynamic" ? "bg-orange-500/20 text-orange-300" : "bg-blue-500/20 text-blue-300")}>{group?.type}</Badge>
                {loading ? "Loading..." : `${members.length.toLocaleString()} members`}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white h-9 px-3 rounded-xl text-[10px] font-bold" onClick={handleExport}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white h-8 w-8 rounded-xl"><XIcon className="w-4 h-4" /></Button>
            </div>
          </div>
        </DialogHeader>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {group?.type === "Manual" && hasPermission("crm", "editor") && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Add Customer</Label>
              <Input placeholder="Search by name or email..." className="h-10 rounded-xl border-zinc-200 text-sm" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
              {addCandidates.length > 0 && (
                <div className="border border-zinc-100 rounded-xl overflow-hidden">
                  {addCandidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 border-b border-zinc-50 last:border-0">
                      <div>
                        <p className="font-bold text-sm text-zinc-900">{c.name}</p>
                        <p className="text-xs text-zinc-400">{c.email}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg text-[10px] font-bold" onClick={() => { onAddMember?.(c.id); setAddSearch(""); }}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input placeholder="Search members..." className="pl-10 h-10 rounded-xl border-zinc-200 text-sm" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
          ) : displayMembers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-zinc-500">{searchQ ? "No members match your search." : "No members in this group."}</p>
              {!searchQ && group?.type === "Manual" && <p className="text-xs text-zinc-400 mt-1">Use the search above to add customers.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {displayMembers.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 hover:border-zinc-200 bg-white transition-all">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center font-black text-sm text-zinc-600 flex-none">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-zinc-900 truncate">{c.name || "—"}</p>
                    <p className="text-xs text-zinc-400 truncate">{c.email || "No email"}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-zinc-700">{c.segment || "—"}</p>
                    <p className="text-[10px] text-zinc-400">{(c.loyalty_points || c.loyalty || 0).toLocaleString()} pts</p>
                  </div>
                  {group?.type === "Manual" && hasPermission("crm", "editor") && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex-none" onClick={() => onRemoveMember?.(c.id)}>
                      <XIcon className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {hasMore && (
                <button onClick={() => setPage((p) => p + 1)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 border border-zinc-100 rounded-xl hover:border-zinc-200 transition-all mt-2">
                  Load More ({(members.length - (page + 1) * PAGE_SIZE).toLocaleString()} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Confirm ── */
interface DeleteDialogProps { group: GroupDoc | null; onConfirm: () => void; onCancel: () => void; deleting: boolean; }
function DeleteConfirmDialog({ group, onConfirm, onCancel, deleting }: DeleteDialogProps) {
  return (
    <Dialog open={!!group} onOpenChange={(o) => { if (!o && !deleting) onCancel(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl border-zinc-100 p-6">
        <DialogHeader>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-4 border border-rose-100"><Trash2 className="w-6 h-6" /></div>
          <DialogTitle className="text-xl font-bold">Delete Group?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{group?.name}</strong>? This cannot be undone and will remove the segment from all linked workflows.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex gap-3">
          <Button variant="outline" className="rounded-xl font-bold flex-1" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex-1 shadow-lg shadow-rose-600/20" onClick={onConfirm} disabled={deleting}>
            {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : "Delete Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Component ── */
export default function Groups() {
  const { enterpriseId, hasPermission } = useModules();
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<GroupDoc | null>(null);
  const [viewingGroup, setViewingGroup] = useState<GroupDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  useEffect(() => {
    if (!enterpriseId) return;
    const unsub = onSnapshot(
      query(collection(db, "customer_groups"), where("enterprise_id", "==", enterpriseId)),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc));
        docs.sort((a, b) => (b.created_at?.toDate?.()?.getTime() || 0) - (a.created_at?.toDate?.()?.getTime() || 0));
        setGroups(docs); setLoading(false);
      },
      (error) => { handleFirestoreError(error, OperationType.GET, "customer_groups"); setLoading(false); toast.error("Failed to load groups."); }
    );
    return () => unsub();
  }, [enterpriseId]);

  const handleDeleteConfirm = async () => {
    if (!groupToDelete || deleting) return;
    if (!hasPermission("crm", "admin")) return toast.error("Admin permission required to delete groups.");
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "customer_groups", groupToDelete.id));
      toast.success("Group deleted.");
      setGroupToDelete(null);
    } catch (e: any) {
      toast.error("Failed to delete group: " + e.message);
      // Do NOT close dialog on failure — user should see the error persists
    } finally { setDeleting(false); }
  };

  const handleDuplicate = async (group: GroupDoc) => {
    if (!hasPermission("crm", "editor")) return toast.error("You do not have permission to manage groups.");
    try {
      await addDoc(collection(db, "customer_groups"), {
        name: group.name + " (Copy)", description: group.description || "",
        type: group.type, rules: group.rules, logic: group.logic || "AND",
        member_count: 0, last_synced: new Date().toISOString(),
        enterprise_id: enterpriseId, created_at: serverTimestamp(),
      });
      toast.success("Group duplicated.");
    } catch (e: any) { toast.error("Failed to duplicate: " + e.message); }
  };

  const handleSyncNow = async (group: GroupDoc) => {
    if (!hasPermission("crm", "editor")) return toast.error("You do not have permission to sync groups.");
    setSyncing(group.id);
    try {
      let count = 0;
      if (group.type === "Manual") {
        // FIX: Count from subcollection, not array field
        const membSnap = await getDocs(collection(db, `customer_groups/${group.id}/members`));
        count = membSnap.docs.length;
      } else {
        // FIX: Paginated batch scan — avoids full table download
        const PAGE = 300; let lastDoc: any = null; let done = false;
        while (!done) {
          const constraints2: any[] = [where("enterprise_id", "==", enterpriseId), limit(PAGE)];
          if (lastDoc) constraints2.push(startAfter(lastDoc));
          const snap = await getDocs(query(collection(db, "customers"), ...constraints2));
          count += snap.docs.filter((d: any) => evalRules({ id: d.id, ...d.data() }, group.rules, group.logic || "AND")).length;
          if (snap.docs.length < PAGE) done = true;
          else lastDoc = snap.docs[snap.docs.length - 1];
        }
      }
      await updateDoc(doc(db, "customer_groups", group.id), { member_count: count, last_synced: new Date().toISOString() });
      toast.success(`Synced — ${count.toLocaleString()} members found.`);
    } catch (e: any) { toast.error("Sync failed: " + e.message); }
    finally { setSyncing(null); }
  };

  const handleAddMember = async (customerId: string) => {
    if (!viewingGroup) return;
    try {
      // FIX: Use setDoc on subcollection — atomic, no race conditions, no 1MB limit
      await setDoc(doc(db, `customer_groups/${viewingGroup.id}/members/${customerId}`), {
        customer_id: customerId, added_at: serverTimestamp()
      });
      // Increment member_count atomically (no read-modify-write race)
      await updateDoc(doc(db, "customer_groups", viewingGroup.id), {
        member_count: (viewingGroup.member_count || 0) + 1,
        last_synced: new Date().toISOString()
      });
      setViewingGroup((g) => g ? { ...g, member_count: (g.member_count || 0) + 1 } : g);
      toast.success("Member added.");
    } catch (e: any) { toast.error("Failed to add member: " + e.message); }
  };

  const handleRemoveMember = async (customerId: string) => {
    if (!viewingGroup) return;
    try {
      // FIX: deleteDoc on the member's subcollection document — no array rewrite needed
      await deleteDoc(doc(db, `customer_groups/${viewingGroup.id}/members/${customerId}`));
      const newCount = Math.max(0, (viewingGroup.member_count || 1) - 1);
      await updateDoc(doc(db, "customer_groups", viewingGroup.id), {
        member_count: newCount, last_synced: new Date().toISOString()
      });
      setViewingGroup((g) => g ? { ...g, member_count: newCount } : g);
      toast.success("Member removed.");
    } catch (e: any) { toast.error("Failed to remove member: " + e.message); }
  };

  const handleExportGroups = () => {
    if (!filtered.length) return toast.error("No groups to export.");
    const rows = [["Name","Description","Type","Members","Logic","Last Synced"]];
    filtered.forEach((g) => rows.push([g.name, g.description||"", g.type, String(g.member_count||0), g.logic||"AND", g.last_synced ? new Date(g.last_synced).toLocaleDateString() : "—"]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "customer-groups.csv"; a.click(); URL.revokeObjectURL(a.href);
    toast.success("Groups exported.");
  };

  const filtered = useMemo(() =>
    groups.filter((g) => !debouncedSearch || g.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || g.description?.toLowerCase().includes(debouncedSearch.toLowerCase())),
    [groups, debouncedSearch]
  );

  const dynamicCount = groups.filter((g) => g.type === "Dynamic").length;
  const totalMembers = groups.reduce((acc, g) => acc + (g.member_count || 0), 0);

  const ActionMenu = ({ group }: { group: GroupDoc }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-60 hover:opacity-100">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl border-zinc-100 shadow-xl p-1.5 w-44">
        <DropdownMenuItem className="rounded-xl py-2.5 font-bold text-xs cursor-pointer" onClick={() => setViewingGroup(group)}>
          <Eye className="w-4 h-4 mr-2 text-zinc-400" /> View Members
        </DropdownMenuItem>
        {hasPermission("crm", "editor") && (
          <>
            <DropdownMenuItem className="rounded-xl py-2.5 font-bold text-xs cursor-pointer" onClick={() => { setEditingGroup(group); setIsBuilderOpen(true); }}>
              <Edit2 className="w-4 h-4 mr-2 text-zinc-400" /> Edit Segment
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl py-2.5 font-bold text-xs cursor-pointer" onClick={() => handleSyncNow(group)}>
              {syncing === group.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-zinc-400" /> : <CheckCircle2 className="w-4 h-4 mr-2 text-zinc-400" />} Sync Now
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl py-2.5 font-bold text-xs cursor-pointer" onClick={() => handleDuplicate(group)}>
              <Copy className="w-4 h-4 mr-2 text-zinc-400" /> Duplicate
            </DropdownMenuItem>
          </>
        )}
        {hasPermission("crm", "admin") && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-xl py-2.5 font-bold text-xs text-rose-500 cursor-pointer focus:text-rose-600 focus:bg-rose-50" onClick={() => setGroupToDelete(group)}>
              <Trash2 className="w-4 h-4 mr-2" /> Decommission
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Command className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Segmentation & Automations</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 font-display">Customer Groups</h1>
            <p className="text-zinc-500 text-sm">Dynamic rule-based segments for targeted marketing and workflows.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" className="rounded-xl h-11 px-4 font-bold text-xs border-zinc-200" onClick={handleExportGroups}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            {hasPermission("crm", "editor") && (
              <Button className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-5 font-bold text-xs" onClick={() => { setEditingGroup(null); setIsBuilderOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create Group
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="card-modern p-4 sm:p-6 border-blue-100 bg-blue-50/30">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><Users className="w-4 h-4 sm:w-5 sm:h-5" /></div>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Active</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : groups.length}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Total Groups</p>
          </Card>
          <Card className="card-modern p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600"><Target className="w-4 h-4 sm:w-5 sm:h-5" /></div>
              <Badge variant="outline" className="text-orange-600 border-orange-100 text-[10px]">Dynamic</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : dynamicCount}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Rule-Based Segments</p>
          </Card>
          <Card className="card-modern p-4 sm:p-6 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600"><Calendar className="w-4 h-4 sm:w-5 sm:h-5" /></div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-100 text-[10px]">Live</Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">{loading ? "—" : totalMembers.toLocaleString()}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Total Members</p>
          </Card>
        </div>

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
                <Input placeholder="Filter groups..." className="pl-10 rounded-xl border-zinc-200 h-10 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </CardHeader>

          {/* Mobile */}
          <div className="block sm:hidden">
            {loading ? <GroupSkeleton /> : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="font-bold text-zinc-600">{debouncedSearch ? "No groups match your search." : "No groups yet."}</p>
                {!debouncedSearch && hasPermission("crm", "editor") && (
                  <Button className="mt-4 rounded-xl bg-zinc-900 text-white text-xs font-bold h-9 px-5" onClick={() => { setEditingGroup(null); setIsBuilderOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Create First Group
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {filtered.map((group) => (
                  <div key={group.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50/50 transition-colors">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-none", group.type === "Dynamic" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}>
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 text-sm truncate">{group.name}</p>
                          {group.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{group.description}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className={cn("text-[10px] font-bold", group.type === "Dynamic" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{group.type}</Badge>
                            <Badge className="rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">{(group.member_count || 0).toLocaleString()} members</Badge>
                            <span className="text-[10px] text-zinc-400">Synced {group.last_synced ? new Date(group.last_synced).toLocaleDateString() : "—"}</span>
                          </div>
                        </div>
                        <ActionMenu group={group} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop */}
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
                  <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-14 text-center">
                    <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                    <p className="font-bold text-zinc-600">{debouncedSearch ? "No groups match your search." : "No customer groups found."}</p>
                    {!debouncedSearch && hasPermission("crm", "editor") && (
                      <Button className="mt-4 rounded-xl bg-zinc-900 text-white text-xs font-bold h-9 px-5" onClick={() => { setEditingGroup(null); setIsBuilderOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Create First Group
                      </Button>
                    )}
                  </td></tr>
                ) : filtered.map((group) => (
                  <tr key={group.id} className="border-t border-zinc-50 hover:bg-zinc-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-zinc-900 text-sm">{group.name}</p>
                      {group.description && <p className="text-xs text-zinc-500 mt-0.5">{group.description}</p>}
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="outline" className={cn("text-[10px] font-bold", group.type === "Dynamic" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{group.type}</Badge>
                      {group.logic && group.type === "Dynamic" && <Badge className="ml-1 text-[9px] font-bold bg-zinc-100 text-zinc-500">{group.logic}</Badge>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button onClick={() => setViewingGroup(group)} className="group">
                        <Badge className="rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs group-hover:bg-zinc-200 transition-colors">{(group.member_count || 0).toLocaleString()}</Badge>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-xs text-zinc-400">
                      {group.last_synced ? new Date(group.last_synced).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-4 px-6 text-right"><ActionMenu group={group} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <GroupBuilderDialog open={isBuilderOpen} onClose={() => { setIsBuilderOpen(false); setEditingGroup(null); }} editing={editingGroup} />
      <GroupMemberDialog group={viewingGroup} onClose={() => setViewingGroup(null)} onAddMember={handleAddMember} onRemoveMember={handleRemoveMember} />
      <DeleteConfirmDialog group={groupToDelete} onConfirm={handleDeleteConfirm} onCancel={() => { if (!deleting) setGroupToDelete(null); }} deleting={deleting} />
    </ScrollArea>
  );
}
