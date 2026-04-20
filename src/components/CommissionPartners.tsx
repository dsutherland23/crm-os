import React, { useState, useEffect, useMemo } from "react";
import { Lock, ArrowLeft, User, Plus, X, Percent, DollarSign, Briefcase, TrendingUp, Coins, History, PiggyBank, ArrowUpRight, Download, BarChart2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function CommissionPartners() {
  const { formatCurrency, enterpriseId } = useModules();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [adminPin, setAdminPin] = useState("1234"); // Default
  
  const [partners, setPartners] = useState<any[]>([]);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPartnerForHistory, setSelectedPartnerForHistory] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isBulkSettleOpen, setIsBulkSettleOpen] = useState(false);
  
  const [newPartner, setNewPartner] = useState({
    name: "",
    phone: "",
    type: "percentage",
    value: 0,
    notes: "",
    referralCode: "",
    category: "General"
  });

  const [authorizedStaff, setAuthorizedStaff] = useState<any[]>([]);

  useEffect(() => {
    if (!enterpriseId) return;

    // Fetch active staff with POS PINs for terminal authorization
    const qStaff = query(
      collection(db, "staff"), 
      where("enterprise_id", "==", enterpriseId),
      where("status", "==", "ACTIVE")
    );
    
    const unsubStaff = onSnapshot(qStaff, (snapshot) => {
      setAuthorizedStaff(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name || "Staff Member", 
        pin: doc.data().pin 
      })));
    });

    const unsubSettings = onSnapshot(doc(db, "enterprise_settings", enterpriseId), (docSnapshot) => {
      if (docSnapshot.exists() && docSnapshot.data().commissionPin) {
        setAdminPin(docSnapshot.data().commissionPin);
      }
    });

    const unsubPartners = onSnapshot(query(collection(db, "commission_partners"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStaff();
      unsubSettings();
      unsubPartners();
    };
  }, [enterpriseId]);

  const stats = useMemo(() => {
    const totalYield = partners.reduce((acc, p) => acc + (p.totalRevenue || 0), 0);
    const totalEarned = partners.reduce((acc, p) => acc + (p.totalEarned || 0), 0);
    const totalPending = partners.reduce((acc, p) => acc + (p.pendingBalance || 0), 0);
    const activeCount = partners.filter(p => p.status === 'ACTIVE').length;
    
    return {
      totalYield,
      totalEarned,
      totalPending,
      activeCount
    };
  }, [partners]);

  const fetchHistory = async (partnerId: string) => {
    if (!enterpriseId) return;
    try {
      const q = query(
        collection(db, "commission_settlements"), 
        where("partnerId", "==", partnerId),
        where("enterprise_id", "==", enterpriseId),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleBulkSettle = async () => {
    const payablePartners = partners.filter(p => (p.pendingBalance || 0) > 0);
    if (payablePartners.length === 0) {
      toast.info("No pending balances to settle.");
      return;
    }

    try {
       for (const p of payablePartners) {
          await handleSettleBalance(p);
       }
       toast.success(`Successfully settled funds for ${payablePartners.length} partners.`);
       setIsBulkSettleOpen(false);
    } catch (err) {
       toast.error("Bulk settlement encountered issues.");
    }
  };

  const handlePinInput = (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      if (newPin.length === 4) {
        // Check against staff pins first (Active POS Users)
        const matchedStaff = authorizedStaff.find(s => s.pin === newPin);
        
        if (matchedStaff || newPin === adminPin) {
          toast.success(`Access Granted: ${matchedStaff?.name || 'Administrator'}`);
          setIsAuthorized(true);
        } else {
          toast.error("Invalid Terminal PIN");
          setPinEntry("");
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinEntry("");
  };

  const handleAddPartner = async () => {
    if (!newPartner.name) {
      toast.error("Partner Name is required");
      return;
    }
    try {
      await addDoc(collection(db, "commission_partners"), {
        ...newPartner,
        status: "ACTIVE",
        totalEarned: 0,
        pendingBalance: 0,
        totalRevenue: 0,
        performanceData: [
          { name: 'W1', value: 0 },
          { name: 'W2', value: 0 },
          { name: 'W3', value: 0 },
          { name: 'W4', value: 0 }
        ],
        createdAt: serverTimestamp(),
        enterprise_id: enterpriseId
      });
      setIsAddPartnerOpen(false);
      setNewPartner({ name: "", phone: "", type: "percentage", value: 0, notes: "", referralCode: "", category: "General" });
      toast.success("Commission partner registered");
    } catch (error) {
      toast.error("Failed to add partner");
    }
  };

  const handleDeletePartner = async (id: string) => {
    try {
      await deleteDoc(doc(db, "commission_partners", id));
      toast.success("Partner removed");
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const handleSettleBalance = async (partner: any) => {
     if (partner.pendingBalance <= 0) {
        toast.info("No pending balance to settle.");
        return;
     }
     try {
        await setDoc(doc(db, "commission_settlements", `${partner.id}_${Date.now()}`), {
           partnerId: partner.id,
           partnerName: partner.name,
           amount: partner.pendingBalance,
           timestamp: serverTimestamp(),
           enterprise_id: enterpriseId,
           status: 'COMPLETED'
        });

        await setDoc(doc(db, "commission_partners", partner.id), {
           ...partner,
           totalEarned: (partner.totalEarned || 0) + partner.pendingBalance,
           pendingBalance: 0
        }, { merge: true });

        toast.success(`Settled ${formatCurrency(partner.pendingBalance)} for ${partner.name}`);
     } catch (error: any) {
        toast.error("Settlement failed: " + error.message);
     }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-[600px] flex items-center justify-center p-6 bg-zinc-50/50 rounded-[40px] border-2 border-dashed border-zinc-200">
        <Card className="max-w-md w-full card-modern border-0 shadow-2xl p-8 space-y-8 text-center bg-white">
           <div className="w-20 h-20 bg-zinc-900 rounded-[32px] flex items-center justify-center mx-auto text-white shadow-xl shadow-zinc-200 animate-in zoom-in duration-500">
              <Lock className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Security Protocol</h2>
              <p className="text-sm text-zinc-500 font-medium mt-2">Commission data is restricted. Enter your 2026 terminal PIN to proceed.</p>
           </div>

           <div className="flex justify-center gap-3">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-xl font-black transition-all",
                    pinEntry.length > i ? "border-zinc-900 bg-zinc-900 text-white translate-y-[-4px] shadow-lg shadow-zinc-200" : "border-zinc-100 bg-zinc-50 text-zinc-300"
                  )}
                >
                  {pinEntry.length > i ? "●" : ""}
                </div>
              ))}
           </div>

           <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
              {['1','2','3','4','5','6','7','8','9','CLR','0','DEL'].map((val) => (
                <Button 
                  key={val}
                  variant="ghost"
                  className={cn(
                    "h-14 rounded-2xl text-lg font-bold transition-all",
                    val === 'CLR' || val === 'DEL' ? "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100" : "text-zinc-900 hover:bg-zinc-900 hover:text-white"
                  )}
                  onClick={() => {
                    if (val === 'CLR') handleClear();
                    else if (val === 'DEL') handleBackspace();
                    else handlePinInput(val);
                  }}
                >
                  {val === 'DEL' ? <ArrowLeft className="w-5 h-5" /> : val}
                </Button>
              ))}
           </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center">
                <Percent className="w-3.5 h-3.5" />
             </div>
             <h2 className="text-2xl font-black tracking-tight text-zinc-900">Commission Partners</h2>
          </div>
          <p className="text-sm text-zinc-500 font-medium italic">Monitor referral performance and manage incentive settlements.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
           <Button variant="outline" className="rounded-xl h-12 px-6 border-zinc-200 font-bold flex-1 sm:flex-none" onClick={() => setIsAuthorized(false)}>
              Lock Terminal
           </Button>
           <Button onClick={() => setIsBulkSettleOpen(true)} className="rounded-xl h-12 px-6 bg-zinc-100 text-zinc-900 border border-zinc-200 hover:bg-zinc-200 font-bold flex-1 sm:flex-none">
              <Coins className="w-4 h-4 mr-2" /> Bulk Settle
           </Button>
           <Button className="rounded-xl h-12 px-6 bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-xl shadow-zinc-200 flex-1 sm:flex-none" onClick={() => setIsAddPartnerOpen(true)}>
             <Plus className="w-4 h-4 mr-2" /> Add Partner
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <Card className="rounded-[32px] border-zinc-100 bg-white p-6 shadow-sm group hover:shadow-xl transition-all duration-500 overflow-hidden relative">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                     <TrendingUp className="w-5 h-5" />
                  </div>
                  <Badge className="bg-blue-50 text-blue-600 border-0 font-bold">+12%</Badge>
               </div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Network Yield</p>
               <h3 className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(stats.totalYield)}</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
         </Card>
         
         <Card className="rounded-[32px] border-zinc-100 bg-white p-6 shadow-sm group hover:shadow-xl transition-all duration-500 overflow-hidden relative">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                     <PiggyBank className="w-5 h-5" />
                  </div>
               </div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Disbursed</p>
               <h3 className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(stats.totalEarned)}</h3>
            </div>
         </Card>

         <Card className="rounded-[32px] border-zinc-100 bg-white p-6 shadow-sm group hover:shadow-xl transition-all duration-500 overflow-hidden relative">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                     <Coins className="w-5 h-5" />
                  </div>
                  <Badge className="bg-amber-50 text-amber-600 border-0 font-bold">Priority</Badge>
               </div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Global Pending</p>
               <h3 className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(stats.totalPending)}</h3>
            </div>
         </Card>

         <Card className="rounded-[32px] border-zinc-100 bg-white p-6 shadow-sm group hover:shadow-xl transition-all duration-500 overflow-hidden relative">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                     <Briefcase className="w-5 h-5" />
                  </div>
               </div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Network</p>
               <h3 className="text-2xl font-black text-zinc-900 mt-1">{stats.activeCount} Partners</h3>
            </div>
         </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
         {partners.map(p => (
            <Card key={p.id} className="card-modern group hover:shadow-2xl transition-all duration-500 border-zinc-100 overflow-hidden bg-white">
               <div className="h-1 bg-gradient-to-r from-zinc-900 via-zinc-400 to-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity" />
               <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                     <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500">
                        <Briefcase className="w-6 h-6" />
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <Badge className={cn("rounded-full border-0 px-3 py-1 text-[9px] font-black tracking-widest uppercase", p.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                           {p.status}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter text-zinc-400 border-zinc-100">
                           {p.category || 'General'}
                        </Badge>
                     </div>
                  </div>

                  <div className="space-y-1">
                     <h3 className="font-black text-zinc-900 text-lg group-hover:text-zinc-600 transition-colors uppercase tracking-tight truncate">{p.name}</h3>
                     <div className="flex items-center gap-2">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{p.referralCode || 'NO CODE'}</p>
                        <div className="w-1 h-1 rounded-full bg-zinc-200" />
                        <span className="text-[10px] text-zinc-400 font-medium">{p.phone}</span>
                     </div>
                  </div>

                  {/* Sparkline Logic */}
                  <div className="h-12 w-full mt-6 opacity-40 group-hover:opacity-100 transition-opacity duration-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={p.performanceData || [
                        { name: 'W1', value: 10 },
                        { name: 'W2', value: 25 },
                        { name: 'W3', value: 15 },
                        { name: 'W4', value: 30 }
                      ]}>
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#18181b" 
                          strokeWidth={2} 
                          dot={false}
                          animationDuration={2000}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-dashed border-zinc-100">
                     <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Yield Generated</p>
                        <p className="text-sm font-black text-zinc-900">{formatCurrency(p.totalRevenue || 0)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Disbursed</p>
                        <p className="text-sm font-black text-zinc-900">{formatCurrency(p.totalEarned || 0)}</p>
                     </div>
                  </div>

                  <div className="mt-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-900 group-hover:border-zinc-900 group-hover:shadow-2xl group-hover:shadow-zinc-200 transition-all duration-500">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-zinc-400 group-hover:text-zinc-500 font-bold uppercase tracking-widest">Pending</p>
                      <Badge className="bg-white/10 text-zinc-400 group-hover:text-zinc-500 text-[8px] border-0">{p.type === 'percentage' ? `${p.value}%` : `${formatCurrency(p.value)}`}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                       <p className="text-lg font-black text-zinc-900 group-hover:text-white">{formatCurrency(p.pendingBalance || 0)}</p>
                       <Button 
                          size="sm" 
                          className="h-8 rounded-lg text-[10px] font-black underline decoration-zinc-200 group-hover:decoration-zinc-700 underline-offset-4 text-zinc-900 group-hover:text-white bg-transparent hover:bg-transparent"
                          onClick={() => handleSettleBalance(p)}
                       >
                          Settle Funds
                       </Button>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
                     <div className="flex gap-2">
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                           onClick={() => {
                             setSelectedPartnerForHistory(p);
                             setIsHistoryOpen(true);
                             fetchHistory(p.id);
                           }}
                        >
                           <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100">
                           <Eye className="w-4 h-4" />
                        </Button>
                     </div>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDeletePartner(p.id)}
                     >
                        <X className="w-3.5 h-3.5" />
                     </Button>
                  </div>
               </CardContent>
            </Card>
         ))}

         {partners.length === 0 && (
            <div className="col-span-full py-20 bg-zinc-50 rounded-[40px] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center px-6">
               <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-zinc-200 shadow-sm mb-4">
                  <User className="w-8 h-8" />
               </div>
               <h4 className="font-bold text-zinc-900">No Partners Recorded</h4>
               <p className="text-sm text-zinc-500 mt-2 max-w-xs">Start building your referral network to see performance data and settlements.</p>
               <Button className="mt-6 rounded-xl bg-zinc-900 text-white font-bold h-11 px-8" onClick={() => setIsAddPartnerOpen(true)}>Initialize First Partner</Button>
            </div>
         )}
      </div>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="rounded-3xl p-0 overflow-hidden border-zinc-100 sm:max-w-2xl">
           <div className="bg-zinc-900 p-8 text-white flex justify-between items-center">
              <div>
                 <DialogTitle className="text-2xl font-black uppercase tracking-tight">Disbursement Ledger</DialogTitle>
                 <DialogDescription className="text-zinc-400 font-medium">{selectedPartnerForHistory?.name} &bull; Forensic Audit Trail</DialogDescription>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500">
                 <History className="w-6 h-6" />
              </div>
           </div>
           <div className="p-8">
              <div className="rounded-2xl border border-zinc-100 overflow-hidden">
                 <Table>
                    <TableHeader className="bg-zinc-50">
                       <TableRow className="border-zinc-100 italic">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Transaction ID</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Settled Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right">Amount</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {history.map((h) => (
                          <TableRow key={h.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                             <TableCell className="font-mono text-[10px] text-zinc-400">{h.id.slice(0, 12)}...</TableCell>
                             <TableCell className="text-zinc-600 font-bold text-xs">{h.timestamp?.toDate ? h.timestamp.toDate().toLocaleDateString() : 'Recent'}</TableCell>
                             <TableCell className="text-right text-zinc-900 font-black">{formatCurrency(h.amount)}</TableCell>
                          </TableRow>
                       ))}
                       {history.length === 0 && (
                          <TableRow>
                             <TableCell colSpan={3} className="text-center py-12 text-zinc-400 font-bold italic">No past transactions found for this node.</TableCell>
                          </TableRow>
                       )}
                    </TableBody>
                 </Table>
              </div>
              <Button variant="outline" className="w-full mt-6 h-12 rounded-xl border-zinc-200 font-bold" onClick={() => setIsHistoryOpen(false)}>Close Ledger</Button>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkSettleOpen} onOpenChange={setIsBulkSettleOpen}>
        <DialogContent className="rounded-3xl p-8 border-zinc-100 text-center">
           <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-zinc-200">
              <Coins className="w-8 h-8" />
           </div>
           <DialogTitle className="text-2xl font-black">Authorize Network Settlement</DialogTitle>
           <DialogDescription className="text-zinc-500 font-medium mt-2">
              This will zero out all pending commission balances for the entire partner network. This action is irreversible once committed to the ledger.
           </DialogDescription>
           
           <div className="my-8 p-6 rounded-3xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Total Network Disbursement</p>
              <p className="text-3xl font-black text-amber-700">{formatCurrency(stats.totalPending)}</p>
           </div>

           <DialogFooter className="flex-col sm:flex-row gap-3">
              <Button variant="outline" className="h-14 flex-1 rounded-2xl border-zinc-200 font-bold" onClick={() => setIsBulkSettleOpen(false)}>Cancel Operation</Button>
              <Button className="h-14 flex-1 rounded-2xl bg-zinc-900 text-white font-black text-lg active:scale-95 transition-all shadow-xl shadow-zinc-100" onClick={handleBulkSettle}>
                 Commit & Settle All
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
        <DialogContent className="rounded-[40px] p-0 overflow-hidden border-zinc-100 sm:max-w-xl">
           <div className="bg-zinc-900 p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/20 rounded-full -mr-24 -mt-24 blur-[80px]" />
              <DialogTitle className="text-3xl font-black tracking-tight">ADD PERFORMANCE PARTNER</DialogTitle>
              <DialogDescription className="text-zinc-400 font-medium mt-1">Initialize a new referral node with calibrated commission rules.</DialogDescription>
           </div>
           
           <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Entity / Partner Identity</label>
                    <Input 
                       className="h-14 rounded-2xl border-2 border-zinc-100 focus:border-zinc-900 focus:ring-opacity-0 transition-all font-bold text-lg px-6" 
                       placeholder="e.g. Zenith Referrals Ltd"
                       value={newPartner.name}
                       onChange={(e) => setNewPartner({...newPartner, name: e.target.value})}
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Communication Node</label>
                       <Input 
                          className="h-14 rounded-2xl border-2 border-zinc-100 focus:border-zinc-900 transition-all font-bold px-6" 
                          placeholder="+1 800-PARTNER"
                          value={newPartner.phone}
                          onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Partner Category</label>
                       <Select value={newPartner.category} onValueChange={(v) => setNewPartner({...newPartner, category: v})}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 border-zinc-100 bg-white px-6 font-bold">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-zinc-100 shadow-2xl">
                             <SelectItem value="General">General Partner</SelectItem>
                             <SelectItem value="VIP">VIP Affiliate</SelectItem>
                             <SelectItem value="Agency">Enterprise Agency</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Model</label>
                      <Select value={newPartner.type} onValueChange={(v) => setNewPartner({...newPartner, type: v})}>
                         <SelectTrigger className="h-14 rounded-2xl border-2 border-zinc-100 bg-white px-6 font-bold">
                            <SelectValue />
                         </SelectTrigger>
                         <SelectContent className="rounded-2xl border-zinc-100 shadow-2xl">
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Rate ($)</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Incentive Value</label>
                      <div className="relative">
                         <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400">
                            {newPartner.type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                         </div>
                         <Input 
                            type="number"
                            className="h-14 pl-14 rounded-2xl border-2 border-zinc-100 focus:border-zinc-900 transition-all font-black text-xl"
                            value={newPartner.value}
                            onChange={(e) => setNewPartner({...newPartner, value: parseFloat(e.target.value)})}
                         />
                      </div>
                   </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Unique Referral Code</label>
                    <div className="relative">
                       <Input 
                          className="h-14 rounded-2xl border-2 border-zinc-100 focus:border-zinc-900 transition-all font-mono font-bold tracking-[0.3em] uppercase px-6" 
                          placeholder="e.g. ZENITH10"
                          value={newPartner.referralCode}
                          onChange={(e) => setNewPartner({...newPartner, referralCode: e.target.value.toUpperCase()})}
                       />
                       <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[8px] font-black bg-zinc-50 border border-zinc-100 uppercase" onClick={() => setNewPartner({...newPartner, referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()})}>Auto Gen</Button>
                       </div>
                    </div>
                 </div>
              </div>

              <Button className="w-full h-16 rounded-[24px] bg-zinc-900 text-white hover:bg-zinc-800 font-black text-xl shadow-2xl shadow-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-3" onClick={handleAddPartner}>
                 Activate Partner Account <ArrowUpRight className="w-5 h-5" />
              </Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
