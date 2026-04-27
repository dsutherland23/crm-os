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
  db, collection, query, where, onSnapshot, doc, limit,
  addDoc, updateDoc, deleteDoc, serverTimestamp 
} from '@/lib/firebase';
import { useModules } from "@/context/ModuleContext";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { recordAuditLog } from "@/lib/audit";

export default function Suppliers() {
  const { enterpriseId, formatCurrency, activeBranch, hasPermission } = useModules();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Filter / export state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  // PO line items — supports multiple lines per order
  const emptyPoForm = () => ({
    description: '',
    quantity: 1,
    unit_cost: '',
    expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: '',
    product_id: ''
  });
  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  const [poForm, setPoForm] = useState(emptyPoForm());
  const [isCreatingPO, setIsCreatingPO] = useState(false);

  const handleCreatePO = async () => {
    if (!hasPermission('suppliers', 'editor')) {
      toast.error('You do not have permission to raise purchase orders.');
      return;
    }
    if (!selectedSupplier || !poForm.description.trim()) {
      toast.error('Item description is required.');
      return;
    }
    const cost = parseFloat(poForm.unit_cost);
    if (isNaN(cost) || cost <= 0) {
      toast.error('Unit cost must be a positive number.');
      return;
    }
    if (!poForm.expected_date) {
      toast.error('Expected delivery date is required.');
      return;
    }
    setIsCreatingPO(true);
    try {
      const qty = Math.max(1, Number(poForm.quantity) || 1);
      const linkedProduct = products.find(p => p.id === poForm.product_id);
      await addDoc(collection(db, 'purchase_orders'), {
        supplier_id: selectedSupplier.id,
        supplier_name: selectedSupplier.name,
        enterprise_id: enterpriseId,
        branch_id: activeBranch === 'all' ? 'main' : activeBranch,
        items: [{ description: poForm.description, quantity: qty, unit_cost: cost, product_id: poForm.product_id || null }],
        total_cost: qty * cost,
        status: 'PENDING',
        expected_date: poForm.expected_date,
        notes: poForm.notes,
        expense_created: false, // guard flag — prevents duplicate ledger entry
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
      setPoForm(emptyPoForm());
    } catch (error) {
      console.error(error);
      toast.error('Failed to create Purchase Order');
    } finally {
      setIsCreatingPO(false);
    }
  };

  const handleUpdatePOStatus = async (poId: string, newStatus: string) => {
    if (!hasPermission('suppliers', 'editor')) {
      toast.error('You do not have permission to update order status.');
      return;
    }
    const destructive = newStatus === 'CANCELLED' || newStatus === 'RECEIVED';
    if (destructive) {
      const label = newStatus === 'RECEIVED' ? 'Mark this order as RECEIVED? This will create a financial liability.' : 'Cancel this purchase order?';
      if (!window.confirm(label)) return;
    }
    try {
      const po = purchaseOrders.find(p => p.id === poId);
      if (!po) return;

      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: newStatus,
        updated_at: serverTimestamp()
      });

      // Guard: only create an expense if one has NOT already been created for this PO
      if (newStatus === 'RECEIVED' && !po.expense_created) {
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
        // Mark PO so future status changes never re-generate the expense
        await updateDoc(doc(db, 'purchase_orders', poId), { expense_created: true });

        // Update inventory stock for linked product if present
        const item = po.items?.[0];
        if (item?.product_id) {
          const productRef = doc(db, 'products', item.product_id);
          const linkedProd = products.find(p => p.id === item.product_id);
          if (linkedProd) {
            await updateDoc(productRef, {
              stock: (linkedProd.stock || 0) + (item.quantity || 1),
              updated_at: serverTimestamp()
            });
          }
        }

        await recordAuditLog({
          enterpriseId,
          action: 'PO_RECEIVED_LEDGER_UPDATED',
          details: `PO ${poId.slice(0, 8).toUpperCase()} marked RECEIVED. Liability of ${formatCurrency(po.total_cost)} created.`,
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

    // FIX: Added limit() to all listeners — previously unbounded
    const qSuppliers = query(collection(db, 'suppliers'), where('enterprise_id', '==', enterpriseId), limit(200));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qPOs = query(collection(db, 'purchase_orders'), where('enterprise_id', '==', enterpriseId), limit(300));
    const unsubPOs = onSnapshot(qPOs, (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExp = query(collection(db, 'expenses'), where('enterprise_id', '==', enterpriseId), limit(200));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qProd = query(collection(db, 'products'), where('enterprise_id', '==', enterpriseId), limit(500));
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
    if (!hasPermission('suppliers', 'editor')) {
      toast.error('You do not have permission to manage suppliers.');
      return;
    }
    if (!supplierForm.name.trim()) {
      toast.error('Entity name is required.');
      return;
    }
    if (supplierForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierForm.email)) {
      toast.error('Please enter a valid email address.');
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
    if (!hasPermission('suppliers', 'admin')) {
      toast.error('Only admins can decommission suppliers.');
      return;
    }
    // Referential integrity: block delete if supplier has outstanding POs or unpaid expenses
    const hasPending = purchaseOrders.some(po => po.supplier_id === id && po.status !== 'RECEIVED' && po.status !== 'CANCELLED');
    const hasUnpaid = expenses.some(e => e.supplier_id === id && e.status === 'PENDING');
    if (hasPending) {
      toast.error('Cannot decommission: this partner has active Purchase Orders. Cancel them first.');
      return;
    }
    if (hasUnpaid) {
      toast.error('Cannot decommission: this partner has unpaid financial obligations.');
      return;
    }
    if (!window.confirm('Decommission this partner? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      await recordAuditLog({ enterpriseId, action: 'SUPPLIER_DELETED', details: `Supplier ${id} decommissioned`, severity: 'WARNING', type: 'SYSTEM' });
      toast.success('Partner decommissioned');
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
    } catch (error) {
      toast.error('Decommission failure');
    }
  };

  // Memoize per-supplier stats to avoid O(N*M) re-computation on every render
  const supplierStatsMap = React.useMemo(() => {
    const map: Record<string, { totalSpend: number; pendingOrders: number; apBalance: number; receivedCount: number; avgDeliveryDays: number }> = {};
    for (const s of suppliers) {
      const sPOs = purchaseOrders.filter(po => po.supplier_id === s.id);
      const totalSpend = sPOs.reduce((sum, po) => sum + (po.total_cost || 0), 0);
      const pendingOrders = sPOs.filter(po => po.status !== 'RECEIVED' && po.status !== 'CANCELLED').length;
      const received = sPOs.filter(po => po.status === 'RECEIVED');
      const avgDeliveryDays = received.length === 0 ? -1 : received.reduce((sum, po) => {
        const start = po.created_at?.toDate?.()?.getTime() || 0;
        const end = po.updated_at?.toDate?.()?.getTime() || start;
        return sum + (end - start) / (1000 * 3600 * 24);
      }, 0) / received.length;
      const apBalance = expenses
        .filter(e => e.supplier_id === s.id && e.status === 'PENDING')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      map[s.id] = { totalSpend, pendingOrders, apBalance, receivedCount: received.length, avgDeliveryDays };
    }
    return map;
  }, [suppliers, purchaseOrders, expenses]);

  const getSupplierStats = (supplierId: string) => supplierStatsMap[supplierId] || { totalSpend: 0, pendingOrders: 0, apBalance: 0, receivedCount: 0, avgDeliveryDays: -1 };

  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const supplierCategories = React.useMemo(() => ['all', ...Array.from(new Set(suppliers.map(s => s.category).filter(Boolean)))], [suppliers]);

  const handleExportCSV = () => {
    const rows = [['Name', 'Contact', 'Email', 'Phone', 'Category', 'Status', 'Total Spend', 'Accounts Payable']];
    filteredSuppliers.forEach(s => {
      const st = getSupplierStats(s.id);
      rows.push([s.name, s.contactPerson || '', s.email || '', s.phone || '', s.category || '', s.status, String(st.totalSpend), String(st.apBalance)]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'suppliers.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Supplier list exported');
  };

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
          <div className="p-6 border-b border-zinc-50 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
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
                <Button
                  variant="ghost"
                  className={cn("h-12 w-12 rounded-2xl bg-zinc-50 hover:bg-zinc-100", isFilterOpen && "bg-zinc-200")}
                  onClick={() => setIsFilterOpen(v => !v)}
                  title="Filter suppliers"
                >
                  <Filter className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 w-12 rounded-2xl bg-zinc-50 hover:bg-zinc-100"
                  onClick={handleExportCSV}
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isFilterOpen && (
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <select
                  className="h-9 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold px-3 text-zinc-700"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  {supplierCategories.map(c => (
                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold px-3 text-zinc-700"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                {(categoryFilter !== 'all' || statusFilter !== 'all') && (
                  <button className="text-[10px] font-black text-rose-500 uppercase tracking-widest" onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }}>Clear</button>
                )}
              </div>
            )}
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
                      {(() => {
                        const st = getSupplierStats(selectedSupplier.id);
                        const hasData = st.receivedCount > 0;
                        const score = !hasData ? null : st.avgDeliveryDays < 3 ? '5.0' : st.avgDeliveryDays < 7 ? '4.5' : st.avgDeliveryDays < 10 ? '4.0' : '3.5';
                        return (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Star className={cn('w-4 h-4', hasData ? 'text-amber-500 fill-amber-500' : 'text-zinc-300')} />
                            <span className="text-lg font-black text-zinc-900">{score ?? 'NEW'}</span>
                          </div>
                        );
                      })()}
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
                                   <Button onClick={() => setIsPODialogOpen(true)} className="h-9 px-5 rounded-xl bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest"><Plus className="w-3.5 h-3.5 mr-2" /> Raise First PO</Button>
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
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Outstanding Payables</p>
                                <h3 className="text-4xl font-black tracking-tighter mb-4">{formatCurrency(getSupplierStats(selectedSupplier.id).apBalance)}</h3>
                                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{getSupplierStats(selectedSupplier.id).apBalance === 0 ? 'No outstanding obligations' : 'Pending settlement with supplier'}</p>
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
                         
                         <TabsContent value="compliance" className="m-0 space-y-4">
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">Compliance statuses reflect this supplier's profile. Keep it updated for accuracy.</div>
                            <div className="grid grid-cols-2 gap-4">
                               {[
                                 { title: "TRN", status: selectedSupplier.trn ? "Verified" : "Missing", detail: selectedSupplier.trn ? "TRN: " + selectedSupplier.trn : "No TRN on file", Icon: ShieldCheck, bc: selectedSupplier.trn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600" },
                                 { title: "Payment Terms", status: selectedSupplier.paymentTerms || "Not Set", detail: selectedSupplier.paymentTerms || "Update profile", Icon: FileText, bc: selectedSupplier.paymentTerms ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600" },
                                 { title: "Contact Info", status: (selectedSupplier.email && selectedSupplier.phone) ? "Complete" : "Incomplete", detail: (!selectedSupplier.email || !selectedSupplier.phone) ? "Email or phone missing" : "Email & phone on file", Icon: (selectedSupplier.email && selectedSupplier.phone) ? CheckCircle2 : AlertCircle, bc: (selectedSupplier.email && selectedSupplier.phone) ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600" },
                                 { title: "Status", status: selectedSupplier.status || "UNKNOWN", detail: selectedSupplier.status === "ACTIVE" ? "Actively trading" : "Inactive", Icon: selectedSupplier.status === "ACTIVE" ? CheckCircle2 : Clock, bc: selectedSupplier.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500" }
                               ].map(({ title, status, detail, Icon: ItemIcon, bc }, i) => (
                                 <div key={i} className="p-5 rounded-2xl border border-zinc-100 flex items-center justify-between bg-zinc-50/10 hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                       <div className={cn("w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center", bc.includes("emerald") ? "text-emerald-500" : bc.includes("rose") ? "text-rose-500" : bc.includes("blue") ? "text-blue-500" : "text-zinc-400")}><ItemIcon className="w-5 h-5" /></div>
                                       <div><p className="font-black text-xs text-zinc-900 uppercase">{title}</p><p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{detail}</p></div>
                                    </div>
                                    <Badge className={cn("text-[8px] font-black px-2 border-0", bc)}>{status}</Badge>
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
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Address</label>
                <Input className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" placeholder="Street, City, Country" value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Website</label>
                <Input className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-sm" placeholder="https://example.com" value={supplierForm.website} onChange={(e) => setSupplierForm({...supplierForm, website: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Payment Terms</label>
                <select className="h-12 w-full rounded-2xl bg-zinc-50 border-none font-bold text-sm px-4 text-zinc-900" value={supplierForm.paymentTerms} onChange={(e) => setSupplierForm({...supplierForm, paymentTerms: e.target.value})}>
                  <option value="Net 7">Net 7</option>
                  <option value="Net 14">Net 14</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="COD">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Status</label>
                <select className="h-12 w-full rounded-2xl bg-zinc-50 border-none font-bold text-sm px-4 text-zinc-900" value={supplierForm.status} onChange={(e) => setSupplierForm({...supplierForm, status: e.target.value})}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
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
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Link to Product (Optional)</label>
                <select className="h-12 w-full rounded-2xl bg-zinc-50 border-none font-bold text-sm px-4 text-zinc-900" value={poForm.product_id} onChange={(e) => { const p = products.find(pr => pr.id === e.target.value); setPoForm({...poForm, product_id: e.target.value, description: p ? p.name : poForm.description, unit_cost: p ? String(p.cost || poForm.unit_cost) : poForm.unit_cost}); }}>
                  <option value="">-- Select a product --</option>
                  {products.filter(p => p.supplier_id === selectedSupplier?.id || !p.supplier_id).map(p => (<option key={p.id} value={p.id}>{p.name} — {p.sku || 'No SKU'}</option>))}
                </select>
              </div>
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
                  type="date" min={new Date().toISOString().split('T')[0]}
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
