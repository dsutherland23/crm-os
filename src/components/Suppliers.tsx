import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Download, MoreHorizontal, Truck, 
  AlertCircle, CheckCircle2, Clock, BarChart3, Users, 
  Package, DollarSign, FileText, Phone, Mail, Globe, 
  ShieldCheck, TrendingUp, ArrowUpRight, History, 
  Trash2, MoreVertical, ExternalLink, Share2, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  db, collection, query, where, onSnapshot, doc, 
  addDoc, updateDoc, deleteDoc, serverTimestamp 
} from '@/lib/firebase';
import { useModules } from "@/context/ModuleContext";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { recordAuditLog } from "@/lib/audit";

export default function Suppliers() {
  const { enterpriseId, formatCurrency, activeBranch } = useModules();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    category: 'General',
    trn: '',
    paymentTerms: 'Net 30',
    status: 'ACTIVE'
  });

  // FIX: Purchase Order creation state — was a dead-end (read-only list)
  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    description: '',
    quantity: 1,
    unit_cost: '',
    expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: ''
  });
  const [isCreatingPO, setIsCreatingPO] = useState(false);

  const handleCreatePO = async () => {
    if (!selectedSupplier || !poForm.description || !poForm.unit_cost) {
      toast.error('Description and unit cost are required');
      return;
    }
    setIsCreatingPO(true);
    try {
      const qty = Number(poForm.quantity) || 1;
      const cost = parseFloat(poForm.unit_cost) || 0;
      await addDoc(collection(db, 'purchase_orders'), {
        supplier_id: selectedSupplier.id,
        supplier_name: selectedSupplier.name,
        enterprise_id: enterpriseId,
        branch_id: activeBranch === 'all' ? 'main' : activeBranch,
        items: [{ description: poForm.description, quantity: qty, unit_cost: cost }],
        total_cost: qty * cost,
        status: 'PENDING',
        expected_date: poForm.expected_date,
        notes: poForm.notes,
        created_at: serverTimestamp()
      });
      await recordAuditLog({
        enterpriseId,
        action: 'PURCHASE_ORDER_CREATED',
        details: `PO created for ${selectedSupplier.name} — ${poForm.description} x${qty} @ ${formatCurrency(cost)}`,
        severity: 'INFO',
        type: 'FINANCE',
        metadata: { supplierId: selectedSupplier.id, total: qty * cost }
      });
      toast.success('Purchase Order raised successfully');
      setIsPODialogOpen(false);
      setPoForm({ description: '', quantity: 1, unit_cost: '', expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], notes: '' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to create Purchase Order');
    } finally {
      setIsCreatingPO(false);
    }
  };

  const handleUpdatePOStatus = async (poId: string, newStatus: string) => {
    try {
      const po = purchaseOrders.find(p => p.id === poId);
      if (!po) return;

      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: newStatus,
        updated_at: serverTimestamp()
      });

      // If received, create a corresponding expense/liability automatically
      if (newStatus === 'RECEIVED') {
        await addDoc(collection(db, 'expenses'), {
          enterprise_id: enterpriseId,
          branch_id: po.branch_id || 'main',
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name,
          amount: po.total_cost,
          category: 'Inventory Procurement',
          description: `Inventory received from PO-${poId.slice(0, 8).toUpperCase()}`,
          status: 'PENDING',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: po.expected_date || new Date().toISOString().split('T')[0],
          po_id: poId,
          created_at: serverTimestamp()
        });

        await recordAuditLog({
          enterpriseId,
          action: 'PO_RECEIVED_LEDGER_UPDATED',
          details: `Purchase Order ${poId.slice(0, 8).toUpperCase()} marked as RECEIVED. Financial liability of ${formatCurrency(po.total_cost)} created.`,
          severity: 'INFO',
          type: 'FINANCE'
        });
      }

      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const [activeDetailTab, setActiveDetailTab] = useState('procurement');

  useEffect(() => {
    if (!enterpriseId) return;

    const qSuppliers = query(collection(db, 'suppliers'), where('enterprise_id', '==', enterpriseId));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qPOs = query(collection(db, 'purchase_orders'), where('enterprise_id', '==', enterpriseId));
    const unsubPOs = onSnapshot(qPOs, (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExp = query(collection(db, 'expenses'), where('enterprise_id', '==', enterpriseId));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qProd = query(collection(db, 'products'), where('enterprise_id', '==', enterpriseId));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSuppliers();
      unsubPOs();
      unsubExp();
      unsubProd();
    };
  }, [enterpriseId]);

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) {
      toast.error('Partner identity required');
      return;
    }
    setIsSaving(true);
    try {
      if (selectedSupplier) {
        await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
          ...supplierForm,
          updated_at: serverTimestamp()
        });
        toast.success('Strategic partner updated');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...supplierForm,
          enterprise_id: enterpriseId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success('New strategic partner onboarded');
      }
      setIsSupplierDialogOpen(false);
    } catch (error) {
      toast.error('Onboarding failure');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!window.confirm('Decommission this partner? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success('Partner decommissioned');
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
    } catch (error) {
      toast.error('Decommission failure');
    }
  };

  const getSupplierStats = (supplierId: string) => {
    const sPOs = purchaseOrders.filter(po => po.supplier_id === supplierId);
    const totalSpend = sPOs.reduce((sum, po) => sum + (po.total_cost || 0), 0);
    const pendingOrders = sPOs.filter(po => po.status !== 'RECEIVED' && po.status !== 'CANCELLED').length;
    const lastOrder = sPOs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    
    // Accounts Payable (Total from Expenses with PENDING status or logic)
    const apBalance = expenses
      .filter(e => e.supplier_id === supplierId && e.status === 'PENDING')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return { totalSpend, pendingOrders, lastOrder, apBalance };
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalActiveSpend: purchaseOrders.filter(po => po.status === 'SENT').reduce((sum, po) => sum + (po.total_cost || 0), 0),
    pendingDeliveries: purchaseOrders.filter(po => po.status === 'SENT' || po.status === 'PENDING').length,
    totalPayables: expenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + (e.amount || 0), 0)
  };

  return (
    <div className="flex flex-col lg:h-full bg-[#FAFAFA] lg:overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-8 py-8 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Supply Chain Hub</h1>
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Global Sourcing & Partner Ecosystem</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              className="rounded-2xl h-12 px-6 bg-zinc-900 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-95 transition-all"
              onClick={() => {
                setSelectedSupplier(null);
                setSupplierForm({
                  name: '', contactPerson: '', email: '', phone: '', address: '',
                  website: '', category: 'General', trn: '', paymentTerms: 'Net 30', status: 'ACTIVE'
                });
                setIsSupplierDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Onboard Partner
            </Button>
          </div>
        </div>

        {/* Global Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {[
            { label: 'Active Commitment', value: formatCurrency(stats.totalActiveSpend), icon: TrendingUp, color: 'bg-blue-50 text-blue-600', sub: 'Open Purchase Orders' },
            { label: 'Assets In-Transit', value: stats.pendingDeliveries, icon: Truck, color: 'bg-amber-50 text-amber-600', sub: 'Pending Logistical Cycles' },
            { label: 'Accounts Payable', value: formatCurrency(stats.totalPayables), icon: DollarSign, color: 'bg-rose-50 text-rose-600', sub: 'Outstanding Financial Obligations' }
          ].map((m, i) => (
            <Card key={i} className="card-modern bg-white border-zinc-100 shadow-sm overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", m.color)}>
                    <m.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className="text-2xl font-black text-zinc-900 tracking-tight">{m.value}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1 opacity-70">{m.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 px-4 md:px-8 pb-8 lg:overflow-hidden">
        {/* Main List */}
        <Card className={cn("card-modern flex-1 bg-white border-zinc-100 shadow-xl flex flex-col transition-all duration-500 min-h-[400px] lg:min-h-0", selectedSupplier && "lg:flex-[0.4]")}>
          <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Search partner directory..." 
                className="pl-12 h-12 rounded-2xl bg-zinc-50 border-none font-bold text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-12 w-12 rounded-2xl bg-zinc-50 hover:bg-zinc-100">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="h-12 w-12 rounded-2xl bg-zinc-50 hover:bg-zinc-100">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 border-none">
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-8">Partner Identity</TableHead>
                  {!selectedSupplier && (
                    <>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Category</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 text-right">Commitment</TableHead>
                    </>
                  )}
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-50 animate-pulse">
                      <TableCell colSpan={selectedSupplier ? 2 : 4} className="py-8 pl-8">
                        <div className="h-12 bg-zinc-50 rounded-2xl w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredSuppliers.map((s) => {
                  const sStats = getSupplierStats(s.id);
                  const isSelected = selectedSupplier?.id === s.id;
                  
                  return (
                    <TableRow 
                      key={s.id} 
                      className={cn(
                        "group/row border-b border-zinc-50 cursor-pointer transition-all hover:bg-zinc-50/50",
                        isSelected && "bg-zinc-950/5 hover:bg-zinc-950/5 shadow-inner"
                      )}
                      onClick={() => setSelectedSupplier(isSelected ? null : s)}
                    >
                      <TableCell className="py-6 pl-8">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all",
                            isSelected ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-400 group-hover/row:bg-white group-hover/row:border group-hover/row:border-zinc-200 shadow-sm"
                          )}>
                            {s.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-zinc-900 text-sm tracking-tight uppercase leading-none mb-1">{s.name}</p>
                            <p className="text-[10px] font-bold text-zinc-400 tracking-widest leading-none">{s.contactPerson}</p>
                          </div>
                        </div>
                      </TableCell>
                      {!selectedSupplier && (
                        <>
                          <TableCell className="py-6">
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] bg-zinc-50 border-none px-3 py-1">
                              {s.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-6 text-right font-black text-zinc-900 text-sm">
                            {formatCurrency(sStats.totalSpend)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="py-6 text-right pr-8">
                        <div className="flex items-center justify-end gap-3">
                          <Badge className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full",
                            s.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {s.status}
                          </Badge>
                          {!selectedSupplier && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-zinc-200">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedSupplier(s);
                                    setSupplierForm({...s});
                                    setIsSupplierDialogOpen(true);
                                  }} className="font-bold text-xs py-2.5">Edit Profile</DropdownMenuItem>
                                  <DropdownMenuItem className="text-rose-600 font-bold text-xs py-2.5" onClick={() => handleDeleteSupplier(s.id)}>Decommission</DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedSupplier && (
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="flex-1 min-w-0"
            >
              <Card className="card-modern lg:h-full bg-white border-zinc-100 shadow-2xl flex flex-col lg:overflow-hidden">
                <CardHeader className="border-b border-zinc-50 p-8 shrink-0">
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-zinc-950 text-white flex items-center justify-center text-2xl font-black shadow-2xl shadow-zinc-950/20">
                        {selectedSupplier.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">{selectedSupplier.name}</h2>
                           <Badge className="bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Certified Partner</Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{selectedSupplier.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{selectedSupplier.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" className="h-10 w-10 rounded-xl bg-zinc-50" onClick={() => setSelectedSupplier(null)}>
                        <ArrowUpRight className="w-4 h-4 rotate-[-45deg]" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-6">
                    <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100/50">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Accounts Payable</p>
                      <p className="text-lg font-black text-rose-600">{formatCurrency(getSupplierStats(selectedSupplier.id).apBalance)}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100/50">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Strategic Spend</p>
                      <p className="text-lg font-black text-zinc-900">{formatCurrency(getSupplierStats(selectedSupplier.id).totalSpend)}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100/50">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Active Cycles</p>
                      <p className="text-lg font-black text-blue-600">{getSupplierStats(selectedSupplier.id).pendingOrders}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100/50">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Reliability Score</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Star className={cn("w-4 h-4", purchaseOrders.filter(po => po.supplier_id === selectedSupplier.id && po.status === 'RECEIVED').length > 0 ? "text-amber-500 fill-amber-500" : "text-zinc-300")} />
                        <span className="text-lg font-black text-zinc-900">
                          {(() => {
                            const received = purchaseOrders.filter(po => po.supplier_id === selectedSupplier.id && po.status === 'RECEIVED');
                            if (received.length === 0) return "NEW";
                            const avgDays = received.reduce((sum, po) => {
                              const start = po.created_at?.toDate?.()?.getTime() || 0;
                              const end = po.updated_at?.toDate?.()?.getTime() || start;
                              return sum + (end - start) / (1000 * 3600 * 24);
                            }, 0) / received.length;
                            return avgDays < 3 ? "5.0" : avgDays < 7 ? "4.5" : avgDays < 10 ? "4.0" : "3.5";
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <div className="flex-1 lg:overflow-hidden">
                  <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="lg:h-full flex flex-col">
                    <div className="px-8 pt-6 border-b border-zinc-50 shrink-0 overflow-x-auto scrollbar-none">
                      <TabsList className="bg-transparent gap-8 h-auto p-0 border-none flex w-max">
                        <TabsTrigger value="procurement" className="tab-modern">Acquisitions</TabsTrigger>
                        <TabsTrigger value="financials" className="tab-modern">Ledger</TabsTrigger>
                        <TabsTrigger value="compliance" className="tab-modern">Compliance</TabsTrigger>
                        <TabsTrigger value="catalog" className="tab-modern">Sourcing</TabsTrigger>
                      </TabsList>
                    </div>
 
                    <ScrollArea className="flex-1">
                      <div className="p-8">
                        <TabsContent value="procurement" className="m-0 space-y-6">
                           <div className="flex items-center justify-between">
                              <h4 className="font-black text-zinc-900 text-sm uppercase tracking-tight">Purchase Orders</h4>
                              <Button
                                onClick={() => setIsPODialogOpen(true)}
                                className="h-9 px-5 rounded-xl bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 mr-2" /> Raise PO
                              </Button>
                           </div>
                           <div className="space-y-3">
                              {purchaseOrders.filter(po => po.supplier_id === selectedSupplier.id).length === 0 ? (
                                <div className="text-center py-12 text-zinc-400">
                                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                  <p className="text-xs font-bold uppercase tracking-widest">No purchase orders yet</p>
                                  <p className="text-[10px] mt-1">Raise your first PO to track procurement</p>
                                </div>
                              ) : purchaseOrders.filter(po => po.supplier_id === selectedSupplier.id).map((po, i) => (
                                <div key={i} className="p-5 rounded-[1.5rem] border border-zinc-100 flex items-center justify-between group hover:border-zinc-200 transition-all bg-zinc-50/20">
                                  <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center">
                                      <Package className="w-5 h-5 text-zinc-400" />
                                    </div>
                                    <div>
                                      <p className="font-black text-sm text-zinc-900 uppercase">PO-{po.id.slice(0, 8).toUpperCase()}</p>
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(po.created_at?.toDate?.() || Date.now()).toLocaleDateString()} • {po.items?.length || 1} Item(s)</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <p className="font-black text-sm text-zinc-900">{formatCurrency(po.total_cost)}</p>
                                      <Badge className={cn(
                                        "text-[8px] font-black tracking-widest px-2",
                                        po.status === 'RECEIVED' ? "bg-emerald-50 text-emerald-600" :
                                        po.status === 'CANCELLED' ? "bg-rose-50 text-rose-600" :
                                        "bg-amber-50 text-amber-600"
                                      )}>{po.status}</Badge>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white"><MoreHorizontal className="w-4 h-4 text-zinc-400" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-xl">
                                        <DropdownMenuItem onClick={() => handleUpdatePOStatus(po.id, 'SENT')} className="font-bold text-xs">Mark as Sent</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdatePOStatus(po.id, 'RECEIVED')} className="font-bold text-xs text-emerald-600">Mark as Received</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdatePOStatus(po.id, 'CANCELLED')} className="font-bold text-xs text-rose-600">Cancel Order</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </TabsContent>
 
                        <TabsContent value="financials" className="m-0 space-y-6">
                           <div className="p-8 rounded-[2rem] bg-zinc-900 text-white relative overflow-hidden mb-6">
                              <div className="relative z-10">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Current Credit Limit Usage</p>
                                <h3 className="text-4xl font-black tracking-tighter mb-8">{formatCurrency(getSupplierStats(selectedSupplier.id).apBalance)}</h3>
                                <div className="space-y-2">
                                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                      <span>Outstanding Balance</span>
                                      <span>Limit: {formatCurrency(50000)}</span>
                                   </div>
                                   <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500" style={{ width: `${Math.min((getSupplierStats(selectedSupplier.id).apBalance / 50000) * 100, 100)}%` }} />
                                   </div>
                                </div>
                              </div>
                              <DollarSign className="absolute -right-8 -bottom-8 w-48 h-48 text-white/[0.05] rotate-12" />
                           </div>

                           <div className="space-y-3">
                              <h4 className="font-black text-zinc-900 text-sm uppercase tracking-tight mb-4">Financial Ledger</h4>
                              {expenses.filter(e => e.supplier_id === selectedSupplier.id).length === 0 ? (
                                <div className="text-center py-8 text-zinc-400">
                                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest">No financial entries</p>
                                </div>
                              ) : expenses.filter(e => e.supplier_id === selectedSupplier.id).map((e, i) => (
                                <div key={i} className="p-4 rounded-2xl border border-zinc-100 flex items-center justify-between bg-white hover:border-zinc-200 transition-all">
                                   <div className="flex items-center gap-4">
                                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", e.status === 'PAID' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                         <DollarSign className="w-5 h-5" />
                                      </div>
                                      <div>
                                         <p className="font-black text-xs text-zinc-900 uppercase">{e.description}</p>
                                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{e.issue_date} • {e.status}</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-black text-sm text-zinc-900">{formatCurrency(e.amount)}</p>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </TabsContent>
                         
                        <TabsContent value="compliance" className="m-0 space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                              {[
                                { title: 'TRN Registration', status: 'Verified', date: selectedSupplier.trn ? `TRN: ${selectedSupplier.trn}` : 'Requires Update', icon: ShieldCheck, color: 'text-emerald-500' },
                                { title: 'Strategic Contract', status: 'Active', date: 'Exp: 2026', icon: FileText, color: 'text-blue-500' },
                                { title: 'Tax Compliance (TCC)', status: 'Pending', date: 'Requires Update', icon: AlertCircle, color: 'text-rose-500' },
                                { title: 'Quality Cert (ISO)', status: 'Verified', date: 'Lifetime', icon: CheckCircle2, color: 'text-emerald-500' }
                              ].map((doc, i) => (
                                <div key={i} className="p-5 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:shadow-lg transition-all bg-zinc-50/10">
                                   <div className="flex items-center gap-4">
                                      <div className={cn("w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center", doc.color)}>
                                         <doc.icon className="w-5 h-5" />
                                      </div>
                                      <div>
                                         <p className="font-black text-xs text-zinc-900 uppercase">{doc.title}</p>
                                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{doc.date}</p>
                                      </div>
                                   </div>
                                   <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100"><Download className="w-4 h-4 text-zinc-400" /></Button>
                                </div>
                              ))}
                           </div>
                        </TabsContent>
 
                        <TabsContent value="catalog" className="m-0 space-y-6">
                           <div className="flex items-center justify-between">
                              <h4 className="font-black text-zinc-900 text-sm uppercase tracking-tight">Sourced Assets</h4>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{products.filter(p => p.supplier_id === selectedSupplier.id).length} Active SKUs</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              {products.filter(p => p.supplier_id === selectedSupplier.id).length === 0 ? (
                                <div className="col-span-2 text-center py-12 text-zinc-400 bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200">
                                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                  <p className="text-xs font-bold uppercase tracking-widest">No products mapped</p>
                                  <p className="text-[10px] mt-1">Link inventory items to this supplier to track sourcing</p>
                                </div>
                              ) : products.filter(p => p.supplier_id === selectedSupplier.id).map((p, i) => (
                                <div key={i} className="p-4 rounded-2xl border border-zinc-100 flex items-center gap-4 bg-zinc-50/20 group hover:border-zinc-200 transition-all">
                                   <div className="w-12 h-12 rounded-xl bg-white border border-zinc-100 flex items-center justify-center overflow-hidden shadow-sm">
                                      {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-zinc-300" />}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="font-black text-xs text-zinc-900 uppercase truncate">{p.name}</p>
                                      <div className="flex items-center justify-between mt-1">
                                         <p className="text-[10px] font-black text-blue-600">{formatCurrency(p.cost || 0)} <span className="text-zinc-400 font-bold ml-1">Cost</span></p>
                                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">SKU: {p.sku}</p>
                                      </div>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </TabsContent>
                      </div>
                    </ScrollArea>
                  </Tabs>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Supplier Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 border-none bg-white shadow-2xl overflow-hidden">
          <div className="p-10">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Partner Onboarding</DialogTitle>
              <DialogDescription className="font-medium text-zinc-500 uppercase tracking-widest text-[10px]">Initialize strategic supply chain relationship.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Entity Name</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Category</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({...supplierForm, category: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Key Correspondent</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">TRN / Tax ID</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.trn}
                  onChange={(e) => setSupplierForm({...supplierForm, trn: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Phone</label>
                <Input 
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" 
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
             <Button variant="ghost" className="rounded-2xl h-12 px-8 font-black text-xs uppercase tracking-widest" onClick={() => setIsSupplierDialogOpen(false)}>Cancel</Button>
             <Button 
               className="rounded-2xl h-12 px-8 bg-zinc-900 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/10"
               onClick={handleSaveSupplier}
               disabled={isSaving}
             >
               {isSaving ? 'Synchronizing...' : (selectedSupplier ? 'Commit Changes' : 'Initialize Partner')}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Purchase Order Dialog */}
      <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-[1.5rem] sm:rounded-[2.5rem] p-0 border-none bg-white shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-10">
            <DialogHeader className="mb-6 sm:mb-8 text-left">
              <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight uppercase">Raise Purchase Order</DialogTitle>
              <DialogDescription className="font-medium text-zinc-500 uppercase tracking-widest text-[9px] sm:text-[10px]">
                Initiate procurement from {selectedSupplier?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Item / Description *</label>
                <Input
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm"
                  placeholder="e.g. 50kg Premium Coffee Beans"
                  value={poForm.description}
                  onChange={(e) => setPoForm({...poForm, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Quantity *</label>
                  <Input
                    type="number"
                    min="1"
                    className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm"
                    value={poForm.quantity}
                    onChange={(e) => setPoForm({...poForm, quantity: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Unit Cost *</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm"
                    placeholder="0.00"
                    value={poForm.unit_cost}
                    onChange={(e) => setPoForm({...poForm, unit_cost: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Expected Delivery Date</label>
                <Input
                  type="date"
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm"
                  value={poForm.expected_date}
                  onChange={(e) => setPoForm({...poForm, expected_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Notes</label>
                <Input
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm"
                  placeholder="Optional procurement notes..."
                  value={poForm.notes}
                  onChange={(e) => setPoForm({...poForm, notes: e.target.value})}
                />
              </div>
              {poForm.unit_cost && (
                <div className="p-4 rounded-2xl bg-zinc-50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Order Value</span>
                  <span className="text-lg sm:text-xl font-black text-zinc-900">{formatCurrency((parseFloat(poForm.unit_cost) || 0) * poForm.quantity)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row justify-end gap-3">
            <Button variant="ghost" className="w-full sm:w-auto rounded-2xl h-12 px-8 font-black text-xs uppercase tracking-widest" onClick={() => setIsPODialogOpen(false)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto rounded-2xl h-12 px-8 bg-zinc-900 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/10"
              onClick={handleCreatePO}
              disabled={isCreatingPO}
            >
              {isCreatingPO ? 'Creating...' : 'Raise Purchase Order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
