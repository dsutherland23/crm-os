import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Gift, Crown, TrendingUp, Search, Plus, MoreHorizontal, Percent, Tags, Box, Calendar, Key, Loader2, AlertCircle, Edit3, Trash2, ClipboardCheck, History, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, setDoc, doc, serverTimestamp } from "@/lib/firebase";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { cn } from "@/lib/utils";

import { useModules } from "@/context/ModuleContext";
import { where, limit } from "firebase/firestore";

export default function Loyalty() {
  const { enterpriseId } = useModules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [campaignCreationType, setCampaignCreationType] = useState<"Standard" | "Action">("Standard");
  const [branches, setBranches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingLogic, setIsSavingLogic] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [isRewardLogicOpen, setIsRewardLogicOpen] = useState(false);
  const [rewardLogic, setRewardLogic] = useState({
    pointsPerDollar: 1,
    pointsRequiredForReward: 100,
    rewardValue: 5, // e.g. $5 off
  });

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [utilizationLogs, setUtilizationLogs] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    action_type: "Buy X Get Y (Different Products)",
    start_date: "",
    end_date: "",
    selected_branches: [] as string[],
    rules: {
      req_quantity: "2",
      min_spend: "0",
      requirement_type: "quantity" as "quantity" | "spend",
      get_quantity: "1",
      item_position: "1st Item",
      step_pattern: "Every Set",
      discount_type: "Percentage",
      discount_value: "20"
    },
    applies_to: "All Products (same product rule applies)",
    selected_products: [] as string[],
    target_customers: "All Customers",
    oneTimePerCustomer: false
  });

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snap) => setBranches(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "branches"));
    const unsubGroups = onSnapshot(query(collection(db, "customer_groups"), where("enterprise_id", "==", enterpriseId)), (snap) => setGroups(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "customer_groups"));
    const unsubProducts = onSnapshot(query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)), (snap) => setProducts(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "products"));
    const unsubCampaigns = onSnapshot(query(collection(db, "campaigns"), where("enterprise_id", "==", enterpriseId)), (snap) => setCampaigns(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "campaigns"));
    const unsubUsage = onSnapshot(query(collection(db, "customer_campaign_usage"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const docs = snapshot.docs.map(d => ({id:d.id, ...d.data()} as any));
      docs.sort((a, b) => {
        const tA = a.used_at?.toDate?.()?.getTime() || new Date(a.used_at || 0).getTime();
        const tB = b.used_at?.toDate?.()?.getTime() || new Date(b.used_at || 0).getTime();
        return tB - tA;
      });
      setUtilizationLogs(docs.slice(0, 50));
    }, (e) => console.error("usage logs error:", e));
    
    const unsubSettings = onSnapshot(doc(db, "loyalty_settings", enterpriseId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRewardLogic({
          pointsPerDollar: data.pointsPerDollar || 1,
          pointsRequiredForReward: data.pointsRequiredForReward || 100,
          rewardValue: data.rewardValue || 5
        });
      }
      // If doc doesn't exist, silently keep defaults — it will be created on first save
    }, () => {
      // Silently ignore permission errors — loyalty settings will use defaults
      // until the user sets up their workspace
    });

    return () => { unsubBranches(); unsubGroups(); unsubProducts(); unsubCampaigns(); unsubUsage(); unsubSettings(); };
  }, [enterpriseId]);

  const handleOpenDialog = (type: "Standard" | "Action") => {
    setCampaignCreationType(type);
    setFormData({
      name: "",
      description: "",
      action_type: "Buy X Get Y (Different Products)",
      start_date: "",
      end_date: "",
      selected_branches: [],
      rules: {
        req_quantity: "2",
        min_spend: "0",
        requirement_type: "quantity",
        get_quantity: "1",
        item_position: "1st Item",
        step_pattern: "Every Set",
        discount_type: "Percentage",
        discount_value: type === "Standard" ? "20" : "100"
      },
      applies_to: "All Products (same product rule applies)",
      selected_products: [],
      target_customers: "All Customers",
      oneTimePerCustomer: false
    });
    setIsDialogOpen(true);
  };

  const handleCreateCampaign = async () => {
    if (!formData.name.trim()) return toast.error("Campaign name is required.");
    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      return toast.error("End date cannot be before start date.");
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: campaignCreationType,
        action_type: formData.action_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        rules: formData.rules,
        branches: formData.selected_branches,
        target_products: formData.selected_products,
        target_customers: formData.target_customers,
        one_time_per_customer: formData.oneTimePerCustomer,
        status: "ACTIVE",
        enterprise_id: enterpriseId
      };

      if (editingCampaignId) {
        await updateDoc(doc(db, "campaigns", editingCampaignId), payload);
        toast.success("Campaign updated successfully!");
      } else {
        payload.created_at = serverTimestamp();
        await addDoc(collection(db, "campaigns"), payload);
        toast.success("Campaign created successfully!");
      }
      setIsDialogOpen(false);
      setEditingCampaignId(null);
    } catch (e: any) {
      toast.error("Failed to create campaign: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRewardLogic = async () => {
    if (rewardLogic.pointsPerDollar <= 0) return toast.error("Points per dollar must be greater than 0.");
    if (rewardLogic.pointsRequiredForReward <= 0) return toast.error("Points required must be greater than 0.");
    if (rewardLogic.rewardValue <= 0) return toast.error("Reward value must be greater than 0.");
    if (isSavingLogic) return;
    setIsSavingLogic(true);
    try {
      if (!enterpriseId) return;
      await setDoc(doc(db, "loyalty_settings", enterpriseId), rewardLogic, { merge: true });
      toast.success("Reward logic updated successfully");
      setIsRewardLogicOpen(false);
    } catch (error: any) {
      toast.error("Failed to update reward logic: " + error.message);
    } finally {
      setIsSavingLogic(false);
    }
  };

  const handleEditCampaign = (campaign: any) => {
    setEditingCampaignId(campaign.id);
    setCampaignCreationType(campaign.type);
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      action_type: campaign.action_type,
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      selected_branches: campaign.branches || [],
      rules: campaign.rules,
      applies_to: campaign.target_products?.length > 0 ? "Specific Products" : "All Products (same product rule applies)",
      selected_products: campaign.target_products || [],
      target_customers: campaign.target_customers || "All Customers",
      oneTimePerCustomer: campaign.one_time_per_customer || false
    });
    setIsDialogOpen(true);
  };

  const deleteCampaign = async (id: string) => {
    try {
      await updateDoc(doc(db, "campaigns", id), { status: "DELETED" });
      toast.success("Campaign deleted");
    } catch (e) {
      toast.error("Failed to delete campaign");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaigns.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCampaigns.length} campaigns?`)) return;
    
    setIsSubmitting(true);
    try {
      const promises = selectedCampaigns.map(id => updateDoc(doc(db, "campaigns", id), { status: "DELETED" }));
      await Promise.all(promises);
      toast.success(`${selectedCampaigns.length} campaigns deleted`);
      setSelectedCampaigns([]);
    } catch (e) {
      toast.error("Bulk delete failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Star className="w-5 h-5 fill-amber-600" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Rewards & retention</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 font-display">Loyalty Engine</h1>
            <p className="text-zinc-500">Manage reward programs, tier status, and customer pointing systems.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-zinc-200 h-11 px-6 font-bold text-xs uppercase tracking-wider" onClick={() => setIsRewardLogicOpen(true)}>
              Reward Logic
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger 
                render={
                  <button className={cn(buttonVariants({ variant: "default" }), "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-6 font-bold text-xs transition-transform hover:scale-[1.02] border-none cursor-pointer flex items-center")}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuItem onClick={() => handleOpenDialog("Standard")} className="py-3 px-4 font-medium text-xs cursor-pointer">
                  <Percent className="w-4 h-4 mr-3 text-emerald-600" />
                  Add Standard Discount
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenDialog("Action")} className="py-3 px-4 font-medium text-xs cursor-pointer">
                  <Tags className="w-4 h-4 mr-3 text-blue-600" />
                  Add Campaign (Buy X Get Y)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Points Issued</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">0</h3>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">Awaiting data...</p>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Redemption Rate</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">0%</h3>
              <Progress value={0} className="h-1.5 mt-2 bg-purple-100" />
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">VIP Members</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">0</h3>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">Tier: Gold & Platinum</p>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Retention Boost</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">+0%</h3>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">Baseline established</p>
            </div>
          </Card>
        </div>

        <Card className="card-modern overflow-hidden">
          <CardHeader className="border-b border-zinc-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold">Member Tiers</CardTitle>
                <CardDescription>Customer distribution across loyalty levels.</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input placeholder="Search tiers..." className="pl-10 rounded-xl border-zinc-200 h-10 text-xs" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50">
                <TableHead className="py-4 font-bold text-zinc-900">Tier Name</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Minimum Points</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900 text-center">Benefit Level</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Members</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-zinc-50/30">
                <TableCell className="py-4 font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-300" />
                    Silver
                  </div>
                </TableCell>
                <TableCell className="py-4 text-xs font-mono">0 pts</TableCell>
                <TableCell className="py-4 text-center">
                  <Badge variant="outline" className="text-[10px] font-bold">BASIC</Badge>
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-zinc-600">0 Customers</TableCell>
                <TableCell className="py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-zinc-50/30">
                <TableCell className="py-4 font-bold text-amber-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    Gold
                  </div>
                </TableCell>
                <TableCell className="py-4 text-xs font-mono">5,000 pts</TableCell>
                <TableCell className="py-4 text-center">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold">5% CASHBACK</Badge>
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-zinc-600">0 Customers</TableCell>
                <TableCell className="py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-zinc-50/30">
                <TableCell className="py-4 font-bold text-blue-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    Platinum
                  </div>
                </TableCell>
                <TableCell className="py-4 text-xs font-mono">20,000 pts</TableCell>
                <TableCell className="py-4 text-center">
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-bold">10% CASHBACK + VIP EVENTS</Badge>
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-zinc-600">0 Customers</TableCell>
                <TableCell className="py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        {/* Active Campaigns Table */}
        <Card className="card-modern overflow-hidden">
          <CardHeader className="border-b border-zinc-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold">Active Campaigns</CardTitle>
                <CardDescription>Currently running discounts and promotional logic.</CardDescription>
              </div>
              {selectedCampaigns.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-xl h-9 px-4 font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20"
                  onClick={handleBulkDelete}
                  disabled={isSubmitting}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete Selected ({selectedCampaigns.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50">
                <TableHead className="w-12 py-4">
                  <Checkbox 
                    checked={selectedCampaigns.length === campaigns.filter(c => c.status !== "DELETED").length && campaigns.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCampaigns(campaigns.filter(c => c.status !== "DELETED").map(c => c.id));
                      } else {
                        setSelectedCampaigns([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Campaign Name</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Type</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Status</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Start Date</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">End Date</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.filter(c => c.status !== "DELETED").length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                    No campaigns found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.filter(c => c.status !== "DELETED").map((c) => (
                  <TableRow key={c.id} className={cn("hover:bg-zinc-50/30", selectedCampaigns.includes(c.id) && "bg-zinc-50")}>
                    <TableCell className="py-4">
                      <Checkbox 
                        checked={selectedCampaigns.includes(c.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedCampaigns(prev => [...prev, c.id]);
                          else setSelectedCampaigns(prev => prev.filter(id => id !== c.id));
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-4 font-bold text-zinc-900">{c.name}</TableCell>
                    <TableCell className="py-4 text-xs font-medium text-zinc-500">{c.type}</TableCell>
                    <TableCell className="py-4">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-mono text-zinc-500">{c.start_date || "N/A"}</TableCell>
                    <TableCell className="py-4 text-xs font-mono text-zinc-500">{c.end_date || "N/A"}</TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          render={
                            <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 rounded-lg border-none cursor-pointer flex items-center justify-center")}>
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                          <DropdownMenuItem onClick={() => handleEditCampaign(c)} className="py-2 px-3 font-bold text-[10px] uppercase tracking-widest cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5 mr-2 text-blue-600" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-100" />
                          <DropdownMenuItem onClick={() => deleteCampaign(c.id)} className="py-2 px-3 font-bold text-[10px] uppercase tracking-widest cursor-pointer text-rose-600">
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Campaign Utilization Log */}
        <Card className="card-modern overflow-hidden border-amber-100 shadow-amber-50/50">
          <CardHeader className="border-b border-amber-50 bg-amber-50/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-amber-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Redemption History
                </CardTitle>
                <CardDescription className="text-amber-700/70 font-medium">Real-time audit trail of all applied rewards and discounts.</CardDescription>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Audit Ready</Badge>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-50/20">
                <TableHead className="py-4 font-bold text-amber-900">Customer</TableHead>
                <TableHead className="py-4 font-bold text-amber-900">Campaign</TableHead>
                <TableHead className="py-4 font-bold text-amber-900">Applied By</TableHead>
                <TableHead className="py-4 font-bold text-amber-900">Date</TableHead>
                <TableHead className="py-4 font-bold text-amber-900">Time</TableHead>
                <TableHead className="py-4 font-bold text-amber-900 text-right">Transaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilizationLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-amber-400">
                      <History className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-bold opacity-50">No redemptions recorded yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                utilizationLogs.map((log) => {
                  const usedAt = log.used_at?.toDate ? log.used_at.toDate() : new Date(log.used_at);
                  return (
                    <TableRow key={log.id} className="hover:bg-amber-50/10 transition-colors border-amber-50/50">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900">{log.customer_name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono tracking-tighter uppercase">{log.customer_id.substring(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-black uppercase">
                          {log.campaign_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-zinc-600 font-bold text-xs">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          {log.staff_name || "System"}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-bold text-zinc-500">
                        {usedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="py-4 text-xs font-mono font-black text-amber-600">
                        {usedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 px-2 py-1 rounded border border-zinc-100">
                          #{log.transaction_id?.substring(0,8).toUpperCase() || 'EXTERNAL'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isRewardLogicOpen} onOpenChange={setIsRewardLogicOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Reward Logic</DialogTitle>
            <DialogDescription>Configure global point accrual and redemption values.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                 <Label className="text-xs font-bold text-zinc-700">Points Earned per $1 Spent</Label>
                 <Input 
                   type="number" 
                   value={rewardLogic.pointsPerDollar} 
                   onChange={(e) => setRewardLogic({...rewardLogic, pointsPerDollar: Number(e.target.value)})} 
                   className="h-11 rounded-lg"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-bold text-zinc-700">Points Required For Reward</Label>
                 <Input 
                   type="number" 
                   value={rewardLogic.pointsRequiredForReward} 
                   onChange={(e) => setRewardLogic({...rewardLogic, pointsRequiredForReward: Number(e.target.value)})} 
                   className="h-11 rounded-lg"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-bold text-zinc-700">Reward Value ($ OFF)</Label>
                 <Input 
                   type="number" 
                   value={rewardLogic.rewardValue} 
                   onChange={(e) => setRewardLogic({...rewardLogic, rewardValue: Number(e.target.value)})} 
                   className="h-11 rounded-lg"
                 />
              </div>
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                 <p className="text-sm font-medium text-zinc-600">
                    Summary: Customers earn <strong className="text-zinc-900">{rewardLogic.pointsPerDollar} points</strong> for every $1 spent. They can redeem <strong className="text-zinc-900">{rewardLogic.pointsRequiredForReward} points</strong> for <strong className="text-zinc-900">${rewardLogic.rewardValue} off</strong> their purchase.
                 </p>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100">
             <Button variant="outline" onClick={() => setIsRewardLogicOpen(false)} disabled={isSavingLogic}>Cancel</Button>
             <Button className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={handleSaveRewardLogic} disabled={isSavingLogic}>
               {isSavingLogic ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Logic"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-zinc-50/50">
          <DialogHeader className="p-6 bg-white border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold font-display tracking-tight text-zinc-900">
              {editingCampaignId ? `Edit Campaign: ${formData.name}` : (campaignCreationType === "Standard" ? "Create New Discount Campaign" : "Create New Campaign")}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[75vh] px-6 py-6">
            <div className="space-y-6 max-w-4xl mx-auto pb-10">

              {campaignCreationType === "Action" && (
                <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                  <div className="p-6">
                    <h3 className="text-sm font-bold text-zinc-900 mb-4">Campaign Preview</h3>
                    <div className="flex items-center justify-center p-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      <span className="text-zinc-500 font-medium">Campaign preview will appear here</span>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-zinc-900" />
                    <h3 className="text-lg font-bold text-zinc-900">Campaign Information</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-700">Campaign Name *</Label>
                      <Input placeholder="e.g., Summer Special 10% Off" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-700">Description</Label>
                      <Textarea placeholder="Optional description of the campaign" className="rounded-lg bg-zinc-50 border-zinc-200 w-full min-h-[100px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Start & End Dates wrapper if Action vs Standard */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-700">Start Date</Label>
                    <div className="relative">
                      <Input type="date" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full px-4" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-700">End Date</Label>
                    <div className="relative">
                      <Input type="date" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full px-4" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                    </div>
                 </div>
              </div>

              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-6">
                  <h3 className="text-lg font-bold text-zinc-900">Campaign Rules</h3>
                  
                  {campaignCreationType === "Standard" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <Label className="text-xs font-bold text-zinc-700 uppercase tracking-widest opacity-70">Promotion logic</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-zinc-400 uppercase">Requirement Type</Label>
                            <Select 
                              value={formData.rules.requirement_type || "quantity"} 
                              onValueChange={(val: any) => setFormData({...formData, rules: {...formData.rules, requirement_type: val}})}
                            >
                              <SelectTrigger className="h-11 rounded-xl bg-white border-zinc-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-zinc-100">
                                <SelectItem value="quantity">Item Quantity</SelectItem>
                                <SelectItem value="spend">Minimum Spend</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-zinc-400 uppercase">
                              {formData.rules.requirement_type === "spend" ? "Min Spend Amount" : "Required Quantity"}
                            </Label>
                            <div className="relative">
                              {formData.rules.requirement_type === "spend" && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">$</span>
                              )}
                              <Input 
                                type="number"
                                className={cn(
                                  "h-11 rounded-xl bg-white border-zinc-200 w-full font-bold",
                                  formData.rules.requirement_type === "spend" ? "pl-7" : "px-4"
                                )}
                                placeholder={formData.rules.requirement_type === "spend" ? "5000" : "2"}
                                value={formData.rules.requirement_type === "spend" ? formData.rules.min_spend : formData.rules.req_quantity} 
                                onChange={(e) => {
                                  if (formData.rules.requirement_type === "spend") {
                                    setFormData({...formData, rules: {...formData.rules, min_spend: e.target.value}});
                                  } else {
                                    setFormData({...formData, rules: {...formData.rules, req_quantity: e.target.value}});
                                  }
                                }} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">They get discount *</Label>
                        <div className="flex gap-2">
                           <Input placeholder="Value" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.rules.discount_value} onChange={(e) => setFormData({...formData, rules: {...formData.rules, discount_value: e.target.value}})} />
                           <Select value={formData.rules.discount_type} onValueChange={(val) => setFormData({...formData, rules: {...formData.rules, discount_type: val}})}>
                             <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-32 shrink-0">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Percentage">Percentage (%)</SelectItem>
                               <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Purchase Requirement</Label>
                        <Select defaultValue="Quantity">
                           <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="Quantity">Quantity</SelectItem>
                             <SelectItem value="Amount">Minimum Amount</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Minimum Quantity</Label>
                        <Input className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.rules.req_quantity} onChange={(e) => setFormData({...formData, rules: {...formData.rules, req_quantity: e.target.value}})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Get Quantity</Label>
                        <Input className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.rules.get_quantity} onChange={(e) => setFormData({...formData, rules: {...formData.rules, get_quantity: e.target.value}})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Discount Item Position</Label>
                        <Select value={formData.rules.item_position} onValueChange={(val) => setFormData({...formData, rules: {...formData.rules, item_position: val}})}>
                           <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="1st Item">1st Item</SelectItem>
                             <SelectItem value="Lowest Prio">Lowest Price Item</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Discount Step Pattern</Label>
                        <Select value={formData.rules.step_pattern} onValueChange={(val) => setFormData({...formData, rules: {...formData.rules, step_pattern: val}})}>
                           <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="Every Set">Every Set</SelectItem>
                             <SelectItem value="Once">Once</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         {/* Empty for layout */}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Discount Type</Label>
                        <Select value={formData.rules.discount_type} onValueChange={(val) => setFormData({...formData, rules: {...formData.rules, discount_type: val}})}>
                           <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="Percentage">Percentage</SelectItem>
                             <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Discount Value</Label>
                        <Input className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.rules.discount_value} onChange={(e) => setFormData({...formData, rules: {...formData.rules, discount_value: e.target.value}})} />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Product Selection */}
              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                     <Box className="w-5 h-5 text-zinc-900" />
                     <h3 className="text-lg font-bold text-zinc-900">Product Selection</h3>
                  </div>
                  {campaignCreationType === "Standard" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-700">Apply discount to</Label>
                      <Select value={formData.applies_to} onValueChange={(val) => setFormData({...formData, applies_to: val})}>
                        <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All Products (same product rule applies)">All Products (same product rule applies)</SelectItem>
                          <SelectItem value="Specific Products">Specific Products</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <Label className="text-sm font-bold text-zinc-900">Select Products <span className="text-zinc-500 font-normal">({formData.selected_products.length} selected)</span></Label>
                       <div className="flex items-center gap-2">
                         <Button variant="outline" className="h-8 rounded-lg text-xs font-medium" onClick={() => setFormData({...formData, selected_products: []})}>Deselect All</Button>
                       </div>
                     </div>
                     <div className="max-h-60 overflow-y-auto border border-zinc-200 rounded-xl bg-zinc-50">
                        {products.length === 0 ? (
                          <div className="p-6 text-center text-zinc-500 font-medium">No products available in the database</div>
                        ) : (
                          <div className="divide-y divide-zinc-200">
                             {products.map(p => {
                               const isSelected = formData.selected_products.includes(p.id);
                               return (
                                 <div 
                                   key={p.id} 
                                   className={cn(
                                     "flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-100 transition-colors",
                                     isSelected && "bg-indigo-50 hover:bg-indigo-100"
                                   )}
                                   onClick={() => {
                                     if (isSelected) {
                                       setFormData({...formData, selected_products: formData.selected_products.filter(id => id !== p.id)});
                                     } else {
                                       setFormData({...formData, selected_products: [...formData.selected_products, p.id]});
                                     }
                                   }}
                                 >
                                   <Checkbox checked={isSelected} onCheckedChange={() => {}} className="pointer-events-none" />
                                   <div>
                                     <p className="text-sm font-bold text-zinc-900">{p.name}</p>
                                     <p className="text-xs text-zinc-500">{p.sku || p.barcode || "No SKU"}</p>
                                   </div>
                                 </div>
                               );
                             })}
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </Card>

              {/* Branch Selection */}
              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-zinc-900" />
                     <h3 className="text-lg font-bold text-zinc-900">Branch Scoping</h3>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs font-bold text-zinc-700">Eligible Branches</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {branches.map(branch => (
                        <div key={branch.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                          <Checkbox 
                            id={`branch-${branch.id}`}
                            checked={formData.selected_branches.includes(branch.id)}
                            onCheckedChange={(checked) => {
                              const newBranches = checked 
                                ? [...formData.selected_branches, branch.id]
                                : formData.selected_branches.filter(id => id !== branch.id);
                              setFormData({...formData, selected_branches: newBranches});
                            }}
                          />
                          <label htmlFor={`branch-${branch.id}`} className="text-sm font-bold text-zinc-800 cursor-pointer">{branch.name}</label>
                        </div>
                      ))}
                      {branches.length === 0 && <p className="text-zinc-400 text-xs italic">No branches configured.</p>}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Customer Group Filter */}
              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-zinc-900">Customer Group Filter</h3>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-700">Apply to Customers</Label>
                    <Select value={formData.target_customers} onValueChange={(val) => setFormData({...formData, target_customers: val})}>
                      <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Customers">All Customers</SelectItem>
                        {groups.map(g => (
                          <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Reward Constraints */}
              <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-600" />
                    <h3 className="text-lg font-bold text-zinc-900">Reward Constraints</h3>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-zinc-900">One-Time Reward per Customer</Label>
                      <p className="text-xs text-zinc-500">If enabled, customers can only benefit from this campaign once in their lifetime.</p>
                    </div>
                    <Checkbox 
                      checked={formData.oneTimePerCustomer}
                      onCheckedChange={(checked) => setFormData({...formData, oneTimePerCustomer: !!checked})}
                      className="w-5 h-5"
                    />
                  </div>
                </div>
              </Card>
            
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-white border-t border-zinc-100 flex items-center justify-end gap-3 flex-none">
            <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-6 font-bold shadow-lg shadow-zinc-900/20" onClick={handleCreateCampaign} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {editingCampaignId ? "Updating..." : "Creating..."}</> : (editingCampaignId ? "Update Campaign" : "Create Campaign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
