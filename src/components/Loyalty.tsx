import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Gift, Crown, TrendingUp, Search, Plus, MoreHorizontal, Percent, Tags, Box, Calendar, Key, Loader2, AlertCircle, Edit3, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, setDoc, doc, serverTimestamp } from "@/lib/firebase";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { cn } from "@/lib/utils";

import { useModules } from "@/context/ModuleContext";
import { where } from "firebase/firestore";

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

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    action_type: "Buy X Get Y (Different Products)",
    start_date: "",
    end_date: "",
    selected_branches: [] as string[],
    rules: {
      req_quantity: "2",
      get_quantity: "1",
      item_position: "1st Item",
      step_pattern: "Every Set",
      discount_type: "Percentage",
      discount_value: "20"
    },
    applies_to: "All Products (same product rule applies)",
    selected_products: [] as string[],
    target_customers: "All Customers"
  });

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snap) => setBranches(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "branches"));
    const unsubGroups = onSnapshot(query(collection(db, "customer_groups"), where("enterprise_id", "==", enterpriseId)), (snap) => setGroups(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "customer_groups"));
    const unsubProducts = onSnapshot(query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)), (snap) => setProducts(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "products"));
    const unsubCampaigns = onSnapshot(query(collection(db, "campaigns"), where("enterprise_id", "==", enterpriseId)), (snap) => setCampaigns(snap.docs.map(d => ({id:d.id, ...d.data()}))), (e) => handleFirestoreError(e, OperationType.GET, "campaigns"));
    
    const unsubSettings = onSnapshot(doc(db, "loyalty_settings", enterpriseId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRewardLogic({
          pointsPerDollar: data.pointsPerDollar || 1,
          pointsRequiredForReward: data.pointsRequiredForReward || 100,
          rewardValue: data.rewardValue || 5
        });
      }
    });

    return () => { unsubBranches(); unsubGroups(); unsubProducts(); unsubCampaigns(); unsubSettings(); };
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
        get_quantity: "1",
        item_position: "1st Item",
        step_pattern: "Every Set",
        discount_type: "Percentage",
        discount_value: type === "Standard" ? "20" : "100"
      },
      applies_to: "All Products (same product rule applies)",
      selected_products: [],
      target_customers: "All Customers"
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
      const payload = {
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
        status: "ACTIVE",
        created_at: serverTimestamp(),
        enterprise_id: enterpriseId
      };
      await addDoc(collection(db, "campaigns"), payload);
      toast.success("Campaign created successfully!");
      setIsDialogOpen(false);
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
                  <Button className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-6 font-bold text-xs transition-transform hover:scale-[1.02]">
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
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
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">1.2M</h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">+12% this month</p>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Redemption Rate</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">24.5%</h3>
              <Progress value={24.5} className="h-1.5 mt-2 bg-purple-100" />
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">VIP Members</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">452</h3>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">Tier: Gold & Platinum</p>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Retention Boost</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">+18%</h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">Above baseline</p>
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
                <TableCell className="py-4 text-xs font-bold text-zinc-600">852 Customers</TableCell>
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
                <TableCell className="py-4 text-xs font-bold text-zinc-600">312 Customers</TableCell>
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
                <TableCell className="py-4 text-xs font-bold text-zinc-600">140 Customers</TableCell>
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
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50">
                <TableHead className="py-4 font-bold text-zinc-900">Campaign Name</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Type</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Status</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">Start Date</TableHead>
                <TableHead className="py-4 font-bold text-zinc-900">End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                    No campaigns found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id} className="hover:bg-zinc-50/30">
                    <TableCell className="py-4 font-bold text-zinc-900">{c.name}</TableCell>
                    <TableCell className="py-4 text-xs font-medium text-zinc-500">{c.type}</TableCell>
                    <TableCell className="py-4">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-mono text-zinc-500">{c.start_date || "N/A"}</TableCell>
                    <TableCell className="py-4 text-xs font-mono text-zinc-500">{c.end_date || "N/A"}</TableCell>
                  </TableRow>
                ))
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
              {campaignCreationType === "Standard" ? "Create New Discount Campaign" : "Create New Campaign"}
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
                  <h3 className="text-lg font-bold text-zinc-900">{campaignCreationType === "Standard" ? "Branch Selection" : "Campaign Type"}</h3>
                  
                  {campaignCreationType === "Standard" ? (
                    <div className="space-y-3 max-w-md">
                      <Label className="text-xs font-bold text-zinc-700">Select Branch</Label>
                      <Select 
                        value={formData.selected_branches[0] || ""} 
                        onValueChange={(val) => setFormData({...formData, selected_branches: [val]})}
                      >
                        <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                          <SelectValue placeholder="Select Branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-500">{products.length} products available in selected branch</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Campaign Name</Label>
                        <Input placeholder="e.g., Buy 2 Get 1 Free" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Campaign Type</Label>
                        <Select value={formData.action_type} onValueChange={(val) => setFormData({...formData, action_type: val})}>
                          <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Buy X Get Y (Different Products)">Buy X Get Y (Different Products)</SelectItem>
                            <SelectItem value="Buy X Get X (Same Product)">Buy X Get X (Same Product)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Applies To</Label>
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
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Available in Branches</Label>
                        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                          {branches.map(b => (
                            <label key={b.id} className="flex items-center gap-3 cursor-pointer">
                              <Checkbox 
                                checked={formData.selected_branches.includes(b.name)}
                                onCheckedChange={(checked) => {
                                  if(checked) setFormData({...formData, selected_branches: [...formData.selected_branches, b.name]});
                                  else setFormData({...formData, selected_branches: formData.selected_branches.filter(sb => sb !== b.name)});
                                }}
                              />
                              <span className="text-sm font-medium text-zinc-700">{b.name}</span>
                            </label>
                          ))}
                          {branches.length === 0 && <span className="text-xs text-zinc-500">No branches found.</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {campaignCreationType === "Standard" && (
                <Card className="shadow-sm border-zinc-200 overflow-hidden rounded-2xl bg-white">
                  <div className="p-6 space-y-6">
                    <h3 className="text-lg font-bold text-zinc-900">Campaign Information</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Campaign Name *</Label>
                        <Input placeholder="e.g., Buy 2 Get 20% Off" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">Description</Label>
                        <Textarea placeholder="Optional description of the campaign" className="rounded-lg bg-zinc-50 border-zinc-200 w-full min-h-[100px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </Card>
              )}

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
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-700">When customer buys *</Label>
                        <div className="flex gap-2">
                           <Input placeholder="Quantity" className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-full" value={formData.rules.req_quantity} onChange={(e) => setFormData({...formData, rules: {...formData.rules, req_quantity: e.target.value}})} />
                           <Select defaultValue="items">
                             <SelectTrigger className="h-11 rounded-lg bg-zinc-50 border-zinc-200 w-32 shrink-0">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="items">items</SelectItem>
                               <SelectItem value="amount">amount</SelectItem>
                             </SelectContent>
                           </Select>
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
            
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-white border-t border-zinc-100 flex items-center justify-end gap-3 flex-none">
            <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-6 font-bold shadow-lg shadow-zinc-900/20" onClick={handleCreateCampaign} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
