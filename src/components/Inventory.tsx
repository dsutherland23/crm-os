import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, Download, MoreHorizontal, Package, 
  AlertTriangle, ArrowRightLeft, TrendingUp, Layers, Box, BarChart3,
  ChevronRight, ArrowRight, CheckCircle2, AlertCircle, Truck, Clock, RefreshCw, Sparkles,
  Camera, Image as ImageIcon, Scan, ScanLine, Check, Info, MoreVertical, X as XIcon, Zap, ZapOff, Maximize2, Zap as Flashlight, Loader2, Trash2, Users
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc, 
  writeBatch,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from '@/lib/firebase';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'framer-motion';
import { useModules } from "@/context/ModuleContext";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export default function Inventory() {
  const { activeBranch, setActiveBranch, enterpriseId, formatCurrency } = useModules();
  const [activeTab, setActiveTab] = useState('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isUpdateStockOpen, setIsUpdateStockOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchDeletingMovements, setIsBatchDeletingMovements] = useState(false);
  const [isBatchDeletingSuppliers, setIsBatchDeletingSuppliers] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<any>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    price: 0,
    cost: 0,
    markup: 20,
    category: '',
    barcode: '',
    image_url: '',
    minStock: 10,
    maxStock: 100,
    leadTime: 5,
    autoReorder: false,
    supplier_id: '',
    description: '',
    initialStock: 0,
    adjustmentReason: 'RESTOCK'
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [updateStockData, setUpdateStockData] = useState({
    qty: 0,
    reason: 'RESTOCK',
    branch_id: ''
  });

  const [transferData, setTransferData] = useState({
    product_id: '',
    from_branch_id: '',
    to_branch_id: '',
    qty: 0,
    reason: 'INTERNAL_TRANSFER'
  });

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    status: 'ACTIVE'
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [cameraMode, setCameraMode] = useState<'user' | 'environment'>('environment');
  const [flashlight, setFlashlight] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isCameraOpen, cameraMode]);

  const startCamera = async () => {
    setIsInitializing(true);
    setHasCameraAccess(false);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasCameraAccess(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Lens hardware unavailable");
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    fetchData();
  }, [activeBranch]);

  const fetchData = async () => {
    if (!enterpriseId) return;
    try {
      setLoading(true);
      const [pSnap, iSnap, mSnap, bSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('enterprise_id', '==', enterpriseId))),
        getDocs(query(collection(db, 'inventory'), where('enterprise_id', '==', enterpriseId))),
        getDocs(query(collection(db, 'inventory_movements'), where('enterprise_id', '==', enterpriseId))),
        getDocs(query(collection(db, 'branches'), where('enterprise_id', '==', enterpriseId))),
        getDocs(query(collection(db, 'suppliers'), where('enterprise_id', '==', enterpriseId)))
      ]);

      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setInventory(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMovements(mSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      }));
      setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliers(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Logistics error: Could not sync assets');
    } finally {
      setLoading(false);
    }
  };

  const getProductStock = (productId: string, branchId: string) => {
    if (branchId === 'all') {
      return inventory
        .filter(i => i.product_id === productId)
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    const item = inventory.find(i => i.product_id === productId && i.branch_id === branchId);
    return item ? item.quantity : 0;
  };

  const totalSKUs = products.length;
  const lowStockItems = products.filter(p => {
    const total = getProductStock(p.id, 'all');
    return total <= (p.min_stock_level || 10);
  }).length;
  const inTransit = movements.filter(m => m.status === 'IN_TRANSIT').length;
  const inventoryValue = products.reduce((sum, p) => {
    const total = getProductStock(p.id, 'all');
    return sum + (total * (p.cost || 0));
  }, 0);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const openProductSheet = (product: any = null) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({
        name: product.name || '',
        sku: product.sku || '',
        price: product.retail_price || product.price || 0,
        cost: product.cost || 0,
        markup: product.markup || 20,
        category: product.category || '',
        barcode: product.barcode || '',
        image_url: product.image_url || '',
        minStock: product.min_stock_level || 10,
        maxStock: product.max_stock_level || 100,
        leadTime: product.lead_time_days || 5,
        autoReorder: product.auto_reorder || false,
        supplier_id: product.supplier_id || '',
        description: product.description || '',
        initialStock: getProductStock(product.id, 'all'),
        adjustmentReason: 'RESTOCK'
      });
    } else {
      setEditingProductId(null);
      setProductForm({
        name: '',
        sku: '',
        price: 0,
        cost: 0,
        markup: 20,
        category: '',
        barcode: '',
        image_url: '',
        minStock: 10,
        maxStock: 100,
        leadTime: 5,
        autoReorder: false,
        supplier_id: '',
        description: '',
        initialStock: 0,
        adjustmentReason: 'RESTOCK'
      });
    }
    setIsProductSheetOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.sku) {
      toast.error('Identity required (Name & SKU)');
      return;
    }

    setIsSavingProduct(true);
    console.log("DEPLOYMENT PRE-FLIGHT:", {
      uid: auth.currentUser?.uid,
      enterpriseId: enterpriseId,
      isDeveloperMode: enterpriseId === 'master-all'
    });

    if (!enterpriseId) {
      toast.error('Identity Error: No authorized enterprise context found. Re-authenticate.');
      setIsSavingProduct(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      const productData = {
        name: productForm.name || '',
        sku: productForm.sku || '',
        price: Number(productForm.price) || 0,
        retail_price: Number(productForm.price) || 0,
        cost: Number(productForm.cost) || 0,
        markup: Number(productForm.markup) || 0,
        category: productForm.category || '',
        barcode: productForm.barcode || '',
        image_url: productForm.image_url || '',
        min_stock_level: Number(productForm.minStock) || 0,
        max_stock_level: Number(productForm.maxStock) || 0,
        lead_time_days: Number(productForm.leadTime) || 0,
        auto_reorder: Boolean(productForm.autoReorder),
        description: productForm.description || '',
        supplier_id: productForm.supplier_id || '',
        enterprise_id: enterpriseId,
        updated_at: new Date().toISOString()
      };

      if (editingProductId) {
        const productRef = doc(db, 'products', editingProductId);
        batch.update(productRef, productData);
        await batch.commit();
        toast.success('Product asset lifecycle updated');
      } else {
        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          ...productData,
          created_at: new Date().toISOString()
        });
        
        const initialStockQty = Number(productForm.initialStock) || 0;
        if (initialStockQty > 0 && activeBranch !== 'all') {
          const invRef = doc(collection(db, 'inventory'));
          batch.set(invRef, {
            product_id: productRef.id,
            branch_id: activeBranch,
            quantity: initialStockQty,
            enterprise_id: enterpriseId,
            updated_at: new Date().toISOString()
          });
          
          const movRef = doc(collection(db, 'inventory_movements'));
          batch.set(movRef, {
            product_id: productRef.id,
            product: productForm.name,
            qty: initialStockQty,
            type: 'INITIAL',
            from: 'MANUFACTURER',
            to: branches.find(b => b.id === activeBranch)?.name || 'MAIN',
            date: new Date().toISOString(),
            status: 'COMPLETED',
            enterprise_id: enterpriseId
          });
        }
        
        await batch.commit();
        toast.success('New product asset deployed');
      }
      
      setIsProductSheetOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('CRITICAL: Strategic deployment failed:', error);
      const isPermissionError = error?.code === 'permission-denied';
      toast.error(isPermissionError 
        ? `Access Denied: Enterprise "${enterpriseId}" authorization rejected.`
        : 'Strategic deployment failed. Verify network connectivity.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = (product: any) => {
    setDeleteConfirmProduct(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    try {
      await deleteDoc(doc(db, 'products', deleteConfirmProduct.id));
      const q = query(collection(db, 'inventory'), where('product_id', '==', deleteConfirmProduct.id));
      const snapshots = await getDocs(q);
      const batch = writeBatch(db);
      snapshots.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      toast.success('Asset decommissioned successfully');
      setDeleteConfirmProduct(null);
      fetchData();
    } catch (error) {
      toast.error('Purge failed');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const batch = writeBatch(db);
      for (const id of selectedProducts) {
        batch.delete(doc(db, 'products', id));
        const q = query(collection(db, 'inventory'), where('product_id', '==', id));
        const snapshots = await getDocs(q);
        snapshots.forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
      toast.success(`${selectedProducts.length} assets purged`);
      setSelectedProducts([]);
      fetchData();
    } catch (error) {
      toast.error('Batch decommission failed');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchDeleteMovements = async () => {
    if (selectedMovements.length === 0) return;
    setIsBatchDeletingMovements(true);
    try {
      const batch = writeBatch(db);
      selectedMovements.forEach(id => batch.delete(doc(db, 'inventory_movements', id)));
      await batch.commit();
      toast.success(`${selectedMovements.length} logs purged`);
      setSelectedMovements([]);
      fetchData();
    } catch (error) {
       toast.error('Log purge failed');
    } finally {
      setIsBatchDeletingMovements(false);
    }
  };

  const handleBatchDeleteSuppliers = async () => {
     if (selectedSuppliers.length === 0) return;
     setIsBatchDeletingSuppliers(true);
     try {
       const batch = writeBatch(db);
       selectedSuppliers.forEach(id => batch.delete(doc(db, 'suppliers', id)));
       await batch.commit();
       toast.success(`${selectedSuppliers.length} partners removed`);
       setSelectedSuppliers([]);
       fetchData();
     } catch (error) {
        toast.error('Partner removal failed');
     } finally {
       setIsBatchDeletingSuppliers(false);
     }
  };

  const handleOpenUpdateStock = (product: any) => {
    setSelectedProduct(product);
    setUpdateStockData({
      qty: 0,
      reason: 'RESTOCK',
      branch_id: activeBranch === 'all' ? branches[0]?.id || '' : activeBranch
    });
    setIsUpdateStockOpen(true);
  };

  const submitUpdateStock = async () => {
    if (!selectedProduct || !updateStockData.branch_id || updateStockData.qty <= 0) {
      toast.error('Protocol violation: Missing quantity or branch');
      return;
    }

    try {
      const q = query(
        collection(db, 'inventory'), 
        where('product_id', '==', selectedProduct.id),
        where('branch_id', '==', updateStockData.branch_id)
      );
      const snapshot = await getDocs(q);
      
      const multiplier = (updateStockData.reason === 'DAMAGED' || updateStockData.reason === 'SHRINKAGE') ? -1 : 1;
      const adjustQty = updateStockData.qty * multiplier;

      if (snapshot.empty) {
        await addDoc(collection(db, 'inventory'), {
          product_id: selectedProduct.id,
          branch_id: updateStockData.branch_id,
          quantity: Math.max(0, adjustQty),
          updated_at: new Date().toISOString()
        });
      } else {
        const invDoc = snapshot.docs[0];
        await updateDoc(invDoc.ref, {
          quantity: Math.max(0, (invDoc.data().quantity || 0) + adjustQty),
          updated_at: new Date().toISOString()
        });
      }

      await addDoc(collection(db, 'inventory_movements'), {
        product_id: selectedProduct.id,
        product: selectedProduct.name,
        qty: adjustQty,
        type: updateStockData.reason,
        from: multiplier > 0 ? 'SUPPLIER' : branches.find(b=>b.id===updateStockData.branch_id)?.name || 'LOCAL',
        to: multiplier > 0 ? branches.find(b=>b.id===updateStockData.branch_id)?.name || 'LOCAL' : 'WASTE',
        date: new Date().toISOString(),
        status: 'COMPLETED'
      });

      toast.success('Stock calibration synchronized');
      setIsUpdateStockOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Synchronization failure');
    }
  };

  const handleUpdateMovementStatus = async (movement: any, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'inventory_movements', movement.id), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(`Logistal state: ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error('State transition failed');
    }
  };

  const handleOpenAnalytics = (product: any) => {
    setSelectedProduct(product);
    setIsAnalyticsOpen(true);
  };

  const handleScanResult = (result: string) => {
    const foundProduct = products.find(p => p.sku === result || p.barcode === result);
    if (foundProduct) {
      openProductSheet(foundProduct);
      toast.success('Asset identified');
    } else {
      setProductForm(prev => ({ ...prev, barcode: result }));
      toast.info('New SKU detected. Ready for initialization.');
    }
    setIsScannerOpen(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Immediate local preview
    const reader = new FileReader();
    reader.onloadend = () => {
       setProductForm(prev => ({ ...prev, image_url: reader.result as string }));
    };
    reader.readAsDataURL(file);

    // 2. Async Cloud Sync
    setIsUploadingImage(true);
    try {
      const storageRef = ref(getStorage(), `products/${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);
      setProductForm(prev => ({ ...prev, image_url: url }));
      toast.success('Asset visual synchronized');
    } catch (error) {
      console.error("Visual Sync Error:", error);
      toast.error('Cloud synchronization failed');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name) {
      toast.error('Partner name required');
      return;
    }
    setIsSavingSupplier(true);
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...newSupplier,
        created_at: new Date().toISOString()
      });
      toast.success('Strategic partner onboarded');
      setNewSupplier({ name: '', contact: '', email: '', phone: '', status: 'ACTIVE' });
      setIsSupplierDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Onboarding failure');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredProducts: any[]) => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const productAnalytics = [
    { date: '04/06', sales: 12, stock: 85 },
    { date: '04/07', sales: 18, stock: 67 },
    { date: '04/08', sales: 15, stock: 52 },
    { date: '04/09', sales: 22, stock: 30 },
    { date: '04/10', sales: 8,  stock: 122 },
    { date: '04/11', sales: 25, stock: 97 },
    { date: '04/12', sales: 30, stock: 67 },
    { date: '04/13', sales: 12, stock: 55 },
    { date: '04/14', sales: 40, stock: 15 },
    { date: '04/15', sales: 35, stock: 105 },
    { date: '04/16', sales: 20, stock: 85 },
    { date: '04/17', sales: 15, stock: 70 },
    { date: '04/18', sales: 22, stock: 48 },
    { date: 'Today', sales: 18, stock: 30 },
  ];

  const supplierMetrics = [
    { name: 'Global Direct', leadTime: 4, deliveryRate: 98, qualityScore: 99 },
    { name: 'Local Logistics', leadTime: 2, deliveryRate: 92, qualityScore: 85 },
    { name: 'FastTrack Inc', leadTime: 1, deliveryRate: 85, qualityScore: 90 },
  ];

  const productInsights = {
    velocity: 4.2,
    reorderDays: 7,
    expectedStockOut: '04/27',
    optimumOrderQty: 150,
    insightText: "Demand velocity is trending 12% higher than seasonal baseline. Predicted stock-out in 7 days. Autonomous order trigger recommended today."
  };

  return (
    <>
    <ScrollArea className="h-full bg-white">
      <div className="responsive-container pb-20">
      {isProductSheetOpen ? (
        <div className="bg-white min-h-screen animate-in fade-in slide-in-from-right-4 duration-500 -mx-4 md:-mx-8">
          {/* A. PERFORMANCE HEADER */}
          <div className="bg-white border-b border-zinc-100 flex-none sticky top-0 z-20 shadow-sm">
            <div className="max-w-5xl mx-auto p-6 md:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <button 
                onClick={() => setIsProductSheetOpen(false)}
                className="group flex items-center gap-2 text-zinc-400 hover:text-zinc-900 transition-colors mr-4"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <ArrowRightLeft className="w-4 h-4 rotate-180" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Back to Stock</span>
              </button>

              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group relative cursor-pointer"
                onClick={() => document.getElementById('product-image-upload')?.click()}
              >
                {productForm.image_url ? (
                  <img src={productForm.image_url} alt="Product" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-zinc-300" />
                )}
                
                <div className={cn(
                  "absolute inset-0 bg-black/40 flex items-center justify-center transition-all",
                  isUploadingImage ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {isUploadingImage ? (
                    <div className="flex flex-col items-center gap-1">
                      <RefreshCw className="w-5 h-5 text-white animate-spin" />
                      <span className="text-[8px] font-black text-white uppercase tracking-tighter">Syncing</span>
                    </div>
                  ) : (
                    <Camera className="w-5 h-5 text-white scale-90 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <input 
                  id="product-image-upload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight truncate">
                    {productForm.name || "Unnamed Product"}
                  </h2>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                    (getProductStock(editingProductId || "", "all") / 4.2) < 7 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                  )}>
                    {editingProductId ? "Update Live Assets" : "Initialization"}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-widest">{productForm.sku || "NO-SKU"}</p>
                <div className="mt-4 flex flex-col gap-2 shadow-inner bg-zinc-50/50 p-3 rounded-2xl border border-zinc-100/50">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock Saturation</span>
                    <span className="text-[10px] font-black text-zinc-900">{Math.round((getProductStock(editingProductId || "", "all") / (productForm.maxStock || 100)) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out",
                        (getProductStock(editingProductId || "", "all") / (productForm.maxStock || 100)) < 0.2 ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      )}
                      style={{ width: `${Math.min(100, (getProductStock(editingProductId || "", "all") / (productForm.maxStock || 100)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="hidden xl:flex items-center gap-4 border-l border-zinc-100 pl-8">
                <div className="bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100 flex flex-col gap-1 shadow-sm transition-all hover:bg-white hover:shadow-md cursor-default group">
                   <div className="flex items-center gap-2 text-blue-500 group-hover:text-blue-600 transition-colors">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Runway</span>
                   </div>
                   <p className="text-xl font-black text-zinc-900">{Math.floor(getProductStock(editingProductId || "", "all") / 4.2) || 0} <span className="text-[10px] font-bold text-zinc-400 uppercase">days</span></p>
                </div>
                <div className="bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100 flex flex-col gap-1 shadow-sm transition-all hover:bg-white hover:shadow-md cursor-default group">
                   <div className="flex items-center gap-2 text-emerald-500 group-hover:text-emerald-600 transition-colors">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Status</span>
                   </div>
                   <p className={cn(
                     "text-xl font-black",
                     (getProductStock(editingProductId || "", "all") / 4.2) < 7 ? "text-rose-500" : "text-emerald-500"
                   )}>
                     {(getProductStock(editingProductId || "", "all") / 4.2) < 7 ? "Urgent" : "Healthy"}
                   </p>
                </div>
              </div>
            </div>
          </div>

          {/* B. CONTROL PANEL CONTENT */}
          <div className="max-w-5xl mx-auto p-8 pt-16 space-y-12 pb-32">
            {/* SECTION 1: PRODUCT IDENTITY */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-zinc-900 border-b border-zinc-200/50 pb-3 group w-full text-left">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white">
                  <Box className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">1. Product Identity</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Official Product Name</label>
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Validated</span>
                  </div>
                  <Input 
                    placeholder="e.g. Ergonomic Office Chair" 
                    className="rounded-2xl h-14 bg-white border-zinc-200 font-bold focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-sm" 
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Catalog Category</label>
                    <Input 
                      placeholder="e.g. Furniture" 
                      className="rounded-2xl h-14 bg-white border-zinc-200 font-bold focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-sm uppercase" 
                      value={productForm.category}
                      onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Global SKU</label>
                    <div className="relative">
                       <Input 
                        placeholder="SKU-..." 
                        className="rounded-2xl h-14 bg-white border-zinc-200 font-mono focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-sm uppercase pr-10" 
                        value={productForm.sku}
                        onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                       />
                       <Zap className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">UPC/Barcode</label>
                  <div className="relative group">
                    <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input 
                      placeholder="Scan subject..." 
                      className="rounded-2xl h-14 bg-white border-zinc-200 font-mono focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all pl-11 text-sm uppercase" 
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       <button 
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                       >
                          <Maximize2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: INVENTORY LOGIC */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-zinc-900 border-b border-zinc-200/50 pb-3 group">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 text-orange-600 transition-all group-hover:bg-orange-600 group-hover:text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">2. Inventory Logic</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-50/50 p-8 rounded-[2.5rem] border border-zinc-100">
                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Current System Stock</label>
                    <div className="relative">
                       <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                       <Input 
                        type="number"
                        className="rounded-2xl h-14 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-orange-500/10 shadow-sm transition-all pl-11 h-14" 
                        value={productForm.initialStock}
                        onChange={(e) => setProductForm({...productForm, initialStock: parseInt(e.target.value) || 0})}
                        disabled={!!editingProductId}
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Adjustment Rationale</label>
                    <Select value={productForm.adjustmentReason} onValueChange={(v: any) => setProductForm({...productForm, adjustmentReason: v})}>
                       <SelectTrigger className="rounded-2xl h-14 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-orange-500/10 shadow-sm transition-all px-4">
                          <SelectValue placeholder="Reason" />
                       </SelectTrigger>
                       <SelectContent className="rounded-2xl border-zinc-200 bg-white">
                          <SelectItem value="RECOUNT" className="font-bold">PHYSICAL RECOUNT</SelectItem>
                          <SelectItem value="DAMAGE" className="font-bold text-rose-500">DAMAGED / WASTE</SelectItem>
                          <SelectItem value="RETURN" className="font-bold text-blue-500">CUSTOMER RETURN</SelectItem>
                          <SelectItem value="RESTOCK" className="font-bold text-emerald-500">CORE RESTOCK</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reorder Level <span className="text-rose-500 font-black">(MIN)</span></label>
                    <Input 
                      type="number"
                      className="rounded-2xl h-14 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-rose-500/10 shadow-sm transition-all text-rose-600 h-14" 
                      value={productForm.minStock}
                      onChange={(e) => setProductForm({...productForm, minStock: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Maximum Buffer <span className="text-emerald-500 font-black">(MAX)</span></label>
                    <Input 
                      type="number"
                      className="rounded-2xl h-14 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-amber-500/10 shadow-sm transition-all text-emerald-600 h-14" 
                      value={productForm.maxStock}
                      onChange={(e) => setProductForm({...productForm, maxStock: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Supplier Lead Time <span className="text-zinc-300">(Days to Arrive)</span></label>
                    <div className="relative">
                       <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                       <Input 
                        type="number"
                        className="rounded-2xl h-14 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-amber-500/10 shadow-sm transition-all pl-11 h-14" 
                        value={productForm.leadTime}
                        onChange={(e) => setProductForm({...productForm, leadTime: parseInt(e.target.value) || 0})}
                       />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-xl relative overflow-hidden flex flex-col justify-center gap-4">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16" />
                   <div className="space-y-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Velocity Insight</p>
                      <p className="text-3xl font-black text-zinc-900 leading-none">4.2 <span className="text-xs font-bold text-zinc-400 tracking-normal">units / day</span></p>
                   </div>
                   <div className="h-px bg-zinc-100" />
                   <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Stock Out Risk</p>
                      <div className="flex items-center gap-3">
                         <div className="flex-1 h-3 bg-zinc-50 rounded-full border border-zinc-100 overflow-hidden">
                            <div className="h-full bg-emerald-400 w-[15%] rounded-full shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                         </div>
                         <span className="text-xs font-black text-emerald-500">LOW</span>
                      </div>
                   </div>
                   <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                      <p className="text-[10px] font-medium text-blue-600/70 leading-relaxed italic">
                        "Optimized for {activeBranch === "all" ? "Enterprise" : branches.find(b=>b.id===activeBranch)?.name} deployment. Recommended reorder trigger: <b>{Math.ceil(4.2 * productForm.leadTime) + productForm.minStock} units</b>."
                      </p>
                   </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: PRICING ENGINE */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-zinc-900 border-b border-zinc-200/50 pb-3 group">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 transition-all group-hover:bg-emerald-600 group-hover:text-white">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">3. Pricing Engine</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Unit Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-black">$</span>
                    <Input 
                      type="number"
                      step="0.01"
                      className="rounded-2xl h-16 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all pl-8 py-4 text-base" 
                      value={productForm.cost || ""}
                      onChange={(e) => {
                        const cost = parseFloat(e.target.value) || 0;
                        const markup = productForm.markup || 0;
                        const price = markup < 100 ? cost / (1 - markup / 100) : cost;
                        setProductForm({...productForm, cost, price: parseFloat(price.toFixed(2))});
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Target Margin (%)</label>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.1"
                      className="rounded-2xl h-16 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all pr-8 py-4 text-base" 
                      value={productForm.markup || ""}
                      onChange={(e) => {
                        const markup = parseFloat(e.target.value) || 0;
                        const safeMarkup = Math.min(markup, 99.9);
                        const price = productForm.cost / (1 - safeMarkup / 100);
                        setProductForm({...productForm, markup, price: parseFloat(price.toFixed(2))});
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Market Retail Price</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black">$</span>
                    <Input 
                      type="number"
                      step="0.01"
                      className="rounded-2xl h-16 bg-emerald-50 border-emerald-100 font-black focus:ring-4 focus:ring-emerald-500/10 shadow-inner transition-all pl-8 text-emerald-700 py-4 text-base" 
                      value={productForm.price || ""}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        const markup = price > 0 ? ((price - productForm.cost) / price) * 100 : 0;
                        setProductForm({...productForm, price, markup: parseFloat(markup.toFixed(1))});
                      }}
                    />
                  </div>
                </div>

                <div className="md:col-span-3 bg-zinc-900 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group border border-zinc-800">
                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                   <div className="space-y-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 truncate">Estimated Unit Profit</p>
                      <p className="text-xl sm:text-2xl md:text-4xl font-black text-emerald-400 tracking-tight truncate leading-none">
                        ${Math.max(0, productForm.price - productForm.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                   </div>
                   <div className="space-y-1 text-right min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 truncate">Gross Margin</p>
                      <p className="text-xl sm:text-2xl md:text-4xl font-black text-white tracking-tight truncate leading-none">
                        {productForm.price > 0 ? (((productForm.price - productForm.cost) / productForm.price) * 100).toFixed(1) : "0.0"}%
                      </p>
                   </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: AUTOMATION & AI INSIGHTS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-zinc-900 border-b border-zinc-200/50 pb-3 group">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100 text-purple-600 transition-all group-hover:bg-purple-600 group-hover:text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">4. Automation & AI</span>
              </div>
              
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
                 <div className="flex items-center justify-between p-7 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 shadow-sm">
                          <RefreshCw className={cn("w-7 h-7", productForm.autoReorder && "animate-spin-slow")} />
                       </div>
                       <div>
                          <p className="font-black text-zinc-900 text-base">Autonomous Replenishment</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Self-Optimizing PO Generation</p>
                       </div>
                    </div>
                    <Switch 
                      checked={productForm.autoReorder}
                      onCheckedChange={(checked) => setProductForm({...productForm, autoReorder: checked})}
                      className="data-[state=checked]:bg-blue-600"
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-7 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-3 hover:border-blue-200 transition-colors group">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Predicted Burn Rate</span>
                          <Zap className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                       </div>
                       <div className="flex items-end gap-2">
                          <p className="text-2xl font-black text-zinc-900 leading-none">12.5 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">units / week</span></p>
                       </div>
                    </div>
                    <div className="p-7 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-3 hover:border-blue-200 transition-colors group">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI Suggested PO</span>
                          <Sparkles className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform" />
                       </div>
                       <div className="flex items-end gap-2">
                          <p className="text-2xl font-black text-zinc-900 leading-none">45 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">units</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="p-6 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 flex items-start gap-5 shadow-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 border border-blue-500/20">
                       <Info className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                       <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-0">System Intelligence</p>
                       <p className="text-[12px] font-medium text-zinc-400 leading-relaxed max-w-2xl">
                         Lead time is calibrated to <b>{productForm.leadTime} days</b>. Logistics simulation indicates replenishment must trigger when stock hits <b>{Math.ceil(4.2 * productForm.leadTime) + productForm.minStock}</b> to ensure continuity.
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          
          {/* C. ACTION FOOTER */}
          <div className="bg-white border-t border-zinc-100 flex-none sticky bottom-0 z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.04)] backdrop-blur-2xl bg-white/95 pb-safe">
            <div className="max-w-5xl mx-auto p-6 md:p-8 flex flex-col gap-6">
              {editingProductId && (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  <Button variant="outline" className="rounded-2xl font-black text-[10px] uppercase tracking-widest border-zinc-200 h-12 px-6 bg-zinc-50/50 hover:bg-zinc-900 hover:text-white transition-all gap-2 group flex-none">
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Add Stock
                  </Button>
                  <Button variant="outline" className="rounded-2xl font-black text-[10px] uppercase tracking-widest border-zinc-200 h-12 px-6 bg-zinc-50/50 hover:bg-zinc-900 hover:text-white transition-all gap-2 group flex-none" onClick={() => setIsTransferDialogOpen(true)}>
                      <ArrowRightLeft className="w-4 h-4 group-hover:scale-110 transition-transform" /> Transfer
                  </Button>
                  <Button variant="outline" className="rounded-2xl font-black text-[10px] uppercase tracking-widest border-zinc-200 h-12 px-6 bg-zinc-50/50 hover:bg-zinc-900 hover:text-white transition-all gap-2 group flex-none" onClick={() => setIsPurchaseOrderOpen(true)}>
                      <Truck className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Purchase Order
                  </Button>
                </div>
              )}
              
              <div className="flex items-center justify-between gap-4">
                <Button 
                   variant="ghost" 
                   className="rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-rose-500 px-8 h-14 transition-colors"
                   onClick={() => setIsProductSheetOpen(false)}
                >
                  Cancel Changes
                </Button>
                <div className="flex items-center gap-3">
                   <Button 
                    className="rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-black text-[10px] uppercase tracking-widest px-10 h-14 shadow-xl shadow-zinc-900/20 disabled:opacity-50 min-w-[200px]"
                    onClick={handleSaveProduct}
                    disabled={isSavingProduct}
                   >
                    {isSavingProduct ? (
                       <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Syncing...</span>
                       </div>
                    ) : editingProductId ? "Commit Asset Lifecycle" : "Deploy Product Asset"}
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-4 md:px-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Inventory intelligence active</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tighter font-display">Stock Management</h1>
              <p className="text-sm font-medium text-zinc-500 mt-2 max-w-lg leading-relaxed">
                Global inventory control, automated replenishment, and logistics tracking for all branch assets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                onClick={() => openProductSheet()}
                className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-zinc-900/10 flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsScannerOpen(true)}
                className="rounded-2xl h-14 px-6 border-zinc-200 font-black text-[10px] uppercase tracking-widest transition-all bg-white flex-1 sm:flex-none hover:border-blue-500 hover:text-blue-600 shadow-sm"
              >
                <ScanLine className="w-4 h-4 mr-2 text-blue-600" /> Scan Barcode
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsTransferDialogOpen(true)}
                className="rounded-2xl h-14 px-6 border-zinc-200 font-black text-[10px] uppercase tracking-widest transition-all bg-white flex-1 sm:flex-none hover:bg-zinc-50"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer Stock
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            <Card className="card-modern border-blue-100 bg-blue-50/20 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600 border border-blue-50">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Total SKUs</p>
                  <p className="text-2xl text-zinc-900 font-black">{totalSKUs.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern border-rose-100 bg-rose-50/20 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-600 border border-rose-50">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5">Critical Units</p>
                  <p className="text-2xl text-zinc-900 font-black">{lowStockItems} Items</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern border-emerald-100 bg-emerald-50/20 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600 border border-emerald-50">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Active Logistics</p>
                  <p className="text-2xl text-zinc-900 font-black">{inTransit} Ships</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-modern border-zinc-100 bg-zinc-50/50 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-zinc-600 border border-zinc-50">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Inventory Value</p>
                  <p className="text-2xl text-zinc-900 font-black">{formatCurrency(inventoryValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 mt-10">
            <div className="w-full overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="bg-zinc-100 p-1 rounded-2xl w-max flex gap-1 border border-zinc-200/50 shadow-inner">
                <TabsTrigger value="stock" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Stock Levels</TabsTrigger>
                <TabsTrigger value="movements" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Movements Log</TabsTrigger>
                <TabsTrigger value="suppliers" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Partnerships</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="stock" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white">
                <div className="p-6 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-zinc-50/10">
                  <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      placeholder="Search SKU, name or category..." 
                      className="pl-11 rounded-[1.25rem] border-zinc-200 bg-white focus:ring-4 focus:ring-blue-500/10 transition-all h-12 font-medium text-sm shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[180px] rounded-[1.25rem] h-12 bg-white border-zinc-200 shadow-sm font-bold text-[10px] uppercase tracking-widest text-zinc-600">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl bg-white border-zinc-200">
                        <SelectItem value="all">ALL GROUPS</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat} className="uppercase">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      className="rounded-[1.25rem] border-zinc-200 text-zinc-600 h-12 font-black text-[10px] uppercase tracking-widest transition-all bg-white hover:bg-zinc-50 shadow-sm"
                      onClick={() => {
                        const rows = [
                          ["Name", "SKU", "Category", "Branch Stock", "Total Stock", "Price", "Status"],
                          ...products
                            .filter(p => activeBranch === "all" || inventory.some(i => i.product_id === p.id && i.branch_id === activeBranch))
                            .map(p => [
                              p.name,
                              p.sku || "",
                              p.category || "",
                              getProductStock(p.id, activeBranch),
                              getProductStock(p.id, "all"),
                              p.retail_price || p.price || 0,
                              getProductStock(p.id, "all") === 0 ? "Out of Stock" : getProductStock(p.id, "all") <= (p.min_stock || 10) ? "Low Stock" : "In Stock"
                            ])
                        ];
                        const csv = rows.map(r => r.map(String).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Inventory asset report exported");
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                        <TableHead className="w-[60px] py-6 pl-6">
                            <input 
                              type="checkbox" 
                              className="rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white"
                              checked={products.length > 0 && selectedProducts.length === products.filter(p => {
                                const name = (p.name || "").toLowerCase();
                                const sku = (p.sku || "").toLowerCase();
                                const term = searchTerm.toLowerCase();
                                return !term || name.includes(term) || sku.includes(term);
                              }).length}
                              onChange={() => {
                                const filtered = products.filter(p => {
                                  const name = (p.name || "").toLowerCase();
                                  const sku = (p.sku || "").toLowerCase();
                                  const term = searchTerm.toLowerCase();
                                  return !term || name.includes(term) || sku.includes(term);
                                });
                                toggleSelectAll(filtered);
                              }}
                            />
                        </TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Asset Identification</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Local Stock</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Enterprise Stock</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Unit Value</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Lifecycle</TableHead>
                        <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6">Management</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={i} className="border-b border-zinc-50">
                            <TableCell className="pl-6"><div className="h-4 w-4 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="flex gap-3 items-center"><div className="h-12 w-12 bg-zinc-100 rounded-xl animate-pulse" /><div className="space-y-2"><div className="h-4 w-32 bg-zinc-100 rounded animate-pulse" /><div className="h-3 w-16 bg-zinc-100 rounded animate-pulse" /></div></div></TableCell>
                            <TableCell><div className="h-4 w-12 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-zinc-100 rounded-full animate-pulse" /></TableCell>
                            <TableCell className="pr-6" />
                          </TableRow>
                        ))
                      ) : products
                          .filter(p => activeBranch === "all" || inventory.some(i => i.product_id === p.id && i.branch_id === activeBranch))
                          .filter(p => {
                            const name = (p.name || "").toLowerCase();
                            const sku = (p.sku || "").toLowerCase();
                            const category = (p.category || "").toLowerCase();
                            const term = searchTerm.toLowerCase();
                            const matchesSearch = !term || name.includes(term) || sku.includes(term) || category.includes(term);
                            const matchesCat = categoryFilter === "all" || p.category === categoryFilter;
                            return matchesSearch && matchesCat;
                          })
                          .length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-24 text-center">
                              <div className="flex flex-col items-center gap-4 text-zinc-400">
                                <Box className="w-16 h-16 opacity-10" />
                                <div className="space-y-1">
                                  <p className="text-xl font-bold text-zinc-900">
                                    {searchTerm ? "Zero matching assets found" : "Logistics empty"}
                                  </p>
                                  <p className="text-sm font-medium text-zinc-500">
                                    {searchTerm ? "Refine your parameters or clear the cache." : "Begin adding inventory to track lifecycle performance."}
                                  </p>
                                </div>
                                {!searchTerm && (
                                  <Button className="rounded-2xl bg-zinc-900 text-white h-12 px-6 font-bold text-xs mt-2" onClick={() => openProductSheet()}>
                                    <Plus className="w-4 h-4 mr-2" /> Initialize First Asset
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                        products
                          .filter(p => activeBranch === "all" || inventory.some(i => i.product_id === p.id && i.branch_id === activeBranch))
                          .filter(p => {
                            const name = (p.name || "").toLowerCase();
                            const sku = (p.sku || "").toLowerCase();
                            const category = (p.category || "").toLowerCase();
                            const term = searchTerm.toLowerCase();
                            const matchesSearch = !term || name.includes(term) || sku.includes(term) || category.includes(term);
                            const matchesCat = categoryFilter === "all" || p.category === categoryFilter;
                            return matchesSearch && matchesCat;
                          })
                          .map((item) => {
                            const branchStock = getProductStock(item.id, activeBranch);
                            const totalStock = getProductStock(item.id, "all");
                            const status = totalStock === 0 ? "OUT OF STOCK" : totalStock <= (item.min_stock_level || 10) ? "LOW STOCK" : "IN STOCK";

                            return (
                              <TableRow key={item.id} className={cn("hover:bg-zinc-50/80 transition-colors border-b border-zinc-50 group/row", selectedProducts.includes(item.id) && "bg-blue-50/50")}>
                                <TableCell className="py-5 pl-6">
                                  <input 
                                    type="checkbox" 
                                    className="rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white transition-all cursor-pointer group-hover/row:scale-110"
                                    checked={selectedProducts.includes(item.id)}
                                    onChange={() => toggleSelectProduct(item.id)}
                                  />
                                </TableCell>
                                <TableCell className="py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl border border-zinc-100 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover/row:scale-105">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Box className="w-6 h-6 text-zinc-300" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-black text-zinc-900 leading-none mb-1.5 uppercase text-xs tracking-tight">{item.name}</p>
                                      <p className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-[0.2em]">{item.sku}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 text-sm font-black text-zinc-900">{branchStock}</TableCell>
                                <TableCell className="py-5">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between w-32">
                                      <span className="text-sm font-black text-zinc-900 leading-none">{totalStock}</span>
                                      <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest leading-none">Global</span>
                                    </div>
                                    <div className="w-32 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-100/50">
                                      <div 
                                        className={cn(
                                          "h-full rounded-full transition-all duration-700",
                                          totalStock === 0 ? "bg-zinc-300" : 
                                          totalStock <= (item.min_stock_level || 10) ? "bg-rose-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${Math.min(100, (totalStock / (item.max_stock_level || 100)) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 font-black text-zinc-900 text-sm tracking-tight">{formatCurrency(item.retail_price || item.price)}</TableCell>
                                <TableCell className="py-5">
                                  <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border shadow-sm",
                                    status === "IN STOCK" ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : 
                                    status === "LOW STOCK" ? "bg-amber-50 text-amber-600 border-amber-100/50" : 
                                    "bg-rose-50 text-rose-600 border-rose-100/50"
                                  )}>
                                    {status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right py-5 pr-6">
                                  <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all">
                                      <MoreHorizontal className="w-5 h-5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-zinc-200 shadow-2xl p-2 bg-white ring-1 ring-zinc-50">
                                      <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-xs" onClick={() => openProductSheet(item)}>
                                        <Box className="w-4 h-4 text-zinc-400" /> Edit Product Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-xs" onClick={() => handleOpenUpdateStock(item)}>
                                        <Layers className="w-4 h-4 text-zinc-400" /> Adjust Stock Count
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-xs" onClick={() => handleOpenAnalytics(item)}>
                                        <BarChart3 className="w-4 h-4 text-zinc-400" /> Performance Analytics
                                      </DropdownMenuItem>
                                      <div className="h-px bg-zinc-100 my-1" />
                                      <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-xs" onClick={() => handleDeleteProduct(item)}>
                                        <Trash2 className="w-4 h-4" /> Decommission Asset
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {selectedProducts.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="bg-zinc-950 text-white rounded-[2.5rem] px-8 py-5 shadow-2xl flex items-center gap-8 border border-white/10 ring-8 ring-black/5">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white w-8 h-8 rounded-full text-xs flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
                        {selectedProducts.length}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Assets Highlighted</span>
                    </div>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="ghost" 
                        className="h-10 text-rose-500 hover:text-white hover:bg-rose-600 font-black text-[10px] uppercase tracking-widest rounded-xl px-6 transition-all"
                        disabled={isBatchDeleting}
                        onClick={handleBatchDelete}
                      >
                        {isBatchDeleting ? "Purging Records..." : "Decommission Permanent"}
                      </Button>
                      <Button 
                        className="h-10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 font-black text-[10px] uppercase tracking-widest rounded-xl px-4 transition-all"
                        onClick={() => setSelectedProducts([])}
                      >
                        Cancel Highlight
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="movements" className="space-y-6">
               <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                      <TableHead className="w-[60px] py-6 pl-6">
                        <input 
                          type="checkbox" 
                          className="rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white"
                          checked={movements.length > 0 && selectedMovements.length === movements.filter(m => {
                            if (activeBranch !== "all" && m.to !== activeBranch && m.from !== activeBranch && m.to !== branches.find(b=>b.id===activeBranch)?.name) return false;
                            return true;
                          }).length}
                          onChange={() => {
                            const filtered = movements.filter(m => {
                              if (activeBranch !== "all" && m.to !== activeBranch && m.from !== activeBranch && m.to !== branches.find(b=>b.id===activeBranch)?.name) return false;
                              return true;
                            });
                            if (selectedMovements.length === filtered.length) {
                              setSelectedMovements([]);
                            } else {
                              setSelectedMovements(filtered.map(m => m.id));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Trace ID</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Operation Type</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Asset Desc</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Logistics Route</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Qty</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Timestamp</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6">Deployment State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={8} className="py-24 text-center">
                              <div className="flex flex-col items-center gap-4 text-zinc-400">
                                <ArrowRightLeft className="w-16 h-16 opacity-10" />
                                <div className="space-y-1">
                                  <p className="text-xl font-bold text-zinc-900">No logistical movements logged</p>
                                  <p className="text-sm font-medium text-zinc-500">Asset transitions will appear here once initiated.</p>
                                </div>
                              </div>
                          </TableCell>
                       </TableRow>
                    ) : movements.filter(m => {
                      if (activeBranch !== "all" && m.to !== activeBranch && m.from !== activeBranch && m.to !== branches.find(b=>b.id===activeBranch)?.name) return false;
                      return true;
                    }).map((m) => (
                      <TableRow key={m.id} className={cn("hover:bg-zinc-50/50 transition-colors border-b border-zinc-50 group/row", selectedMovements.includes(m.id) && "bg-blue-50/50")}>
                        <TableCell className="py-5 pl-6">
                          <input 
                            type="checkbox" 
                            className="rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white transition-all cursor-pointer group-hover/row:scale-110"
                            checked={selectedMovements.includes(m.id)}
                            onChange={() => {
                              setSelectedMovements(prev => 
                                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-5 font-mono text-[10px] font-black text-zinc-400 uppercase tracking-widest">{m.id.substring(0,8)}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 border-none bg-zinc-50",
                            m.type === "TRANSFER" ? "text-blue-600" :
                            m.type === "PURCHASE" ? "text-emerald-600" :
                            "text-amber-600 font-bold"
                          )}>
                            {m.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5 font-black text-zinc-900 text-xs uppercase tracking-tight">{m.product}</TableCell>
                        <TableCell className="py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-tight">{m.from}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-300" />
                            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-tight">{m.to}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 font-black text-zinc-900">{m.qty > 0 ? `+${m.qty}` : m.qty}</TableCell>
                        <TableCell className="py-5 text-[10px] font-bold text-zinc-400 uppercase">{m.date}</TableCell>
                        <TableCell className="py-5 pr-6">
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <div className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer hover:opacity-80 transition-all shadow-sm",
                                  m.status === "COMPLETED" ? "bg-emerald-50 border-emerald-100/50" :
                                  m.status === "CANCELLED" ? "bg-rose-50 border-rose-100/50" :
                                  m.status === "IN_TRANSIT" ? "bg-blue-50 border-blue-100/50" :
                                  "bg-amber-50 border-amber-100/50"
                                )}>
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    m.status === "COMPLETED" ? "bg-emerald-500" : 
                                    m.status === "CANCELLED" ? "bg-rose-500" :
                                    m.status === "IN_TRANSIT" ? "bg-blue-500 animate-pulse" :
                                    "bg-amber-500"
                                  )} />
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.2em]",
                                    m.status === "COMPLETED" ? "text-emerald-600" : 
                                    m.status === "CANCELLED" ? "text-rose-600" :
                                    m.status === "IN_TRANSIT" ? "text-blue-600" :
                                    "text-amber-600"
                                  )}>
                                    {m.status}
                                  </span>
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl border-zinc-200 shadow-2xl p-2 bg-white">
                                <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "COMPLETED")} className="rounded-xl font-bold text-xs py-2.5">Set Completed</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "IN_TRANSIT")} className="rounded-xl font-bold text-xs py-2.5">Set In Transit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "PENDING")} className="rounded-xl font-bold text-xs py-2.5">Set Pending</DropdownMenuItem>
                                <div className="h-px bg-zinc-100 my-1" />
                                <DropdownMenuItem className="text-rose-600 rounded-xl font-bold text-xs py-2.5" onClick={() => handleUpdateMovementStatus(m, "CANCELLED")}>Decommission Log</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <div className="space-y-1">
                    <h3 className="font-black text-zinc-900 tracking-tight text-lg">Partner Ecosystem</h3>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Global Sourcing Network</p>
                 </div>
                 <Button className="rounded-2xl bg-zinc-900 text-white h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-all" onClick={() => setIsSupplierDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Strategic Partner
                 </Button>
              </div>

               <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-6">Vendor Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Key Correspondent</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Secure Email</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Operational Contact</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6">Lifecycle Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24 text-zinc-400">
                           <div className="flex flex-col items-center gap-4">
                              <Users className="w-16 h-16 opacity-10" />
                              <p className="text-xl font-bold text-zinc-900">Vendor directory idle</p>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((s) => (
                        <TableRow key={s.id} className="hover:bg-zinc-50/50 transition-colors border-b border-zinc-50 group/row font-display">
                          <TableCell className="py-6 pl-6 font-black text-zinc-900 text-sm tracking-tight uppercase">{s.name}</TableCell>
                          <TableCell className="py-6 text-sm font-bold text-zinc-600">{s.contact}</TableCell>
                          <TableCell className="py-6 text-sm font-medium text-zinc-500 transition-colors hover:text-blue-500 cursor-pointer">{s.email}</TableCell>
                          <TableCell className="py-6 text-sm font-bold text-zinc-600 tracking-wider font-mono">{s.phone}</TableCell>
                          <TableCell className="py-6 pr-6">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border",
                              s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                            )}>
                              {s.status || "OPERATIONAL"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
    </ScrollArea>

      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScanResult} 
      />

      {/* Update Stock Dialog */}
      <Dialog open={isUpdateStockOpen} onOpenChange={setIsUpdateStockOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-zinc-200 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-zinc-900 tracking-tight">Stock Calibration</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium">
              Manually adjusting <b>{selectedProduct?.name}</b> across branch protocols.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between shadow-inner">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Inventory</span>
                <span className="text-sm font-black text-zinc-900">
                  {getProductStock(selectedProduct?.id || "", updateStockData.branch_id || activeBranch)} Units
                </span>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Logic Protocol</label>
              <Select 
                value={updateStockData.reason} 
                onValueChange={(val) => setUpdateStockData({...updateStockData, reason: val})}
              >
                <SelectTrigger className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white">
                  <SelectItem value="RESTOCK" className="font-bold">CORE RESTOCK (+)</SelectItem>
                  <SelectItem value="RETURN" className="font-bold">CUSTOMER RETURN (+)</SelectItem>
                  <SelectItem value="DAMAGED" className="font-bold text-rose-500">ASSET DAMAGE (-)</SelectItem>
                  <SelectItem value="SHRINKAGE" className="font-bold text-rose-500">SHRINKAGE (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Target Node (Branch)</label>
              <Select 
                value={updateStockData.branch_id} 
                onValueChange={(val) => setUpdateStockData({...updateStockData, branch_id: val})}
              >
                <SelectTrigger className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white">
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id} className="font-bold">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Calibration Quantity</label>
              <Input 
                type="number" 
                min="1"
                className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-black"
                value={updateStockData.qty}
                onChange={(e) => setUpdateStockData({...updateStockData, qty: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-3">
            <Button variant="ghost" className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-12 px-6" onClick={() => setIsUpdateStockOpen(false)}>Abort</Button>
            <Button className="bg-zinc-900 text-white rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-zinc-900/20" onClick={submitUpdateStock}>Sync Calibration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="sm:max-w-4xl rounded-[2.5rem] p-0 overflow-hidden bg-zinc-50/50 border-none shadow-[0_0_100px_rgba(0,0,0,0.1)]">
          <div className="bg-white px-8 py-7 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black text-zinc-900 tracking-tight font-display">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                {selectedProduct?.name} Intelligence
              </DialogTitle>
              <DialogDescription className="mt-1 font-medium text-zinc-500">
                AI-driven analysis of stock levels, sales trends, and partnership metrics.
              </DialogDescription>
            </div>
            <div className="text-right">
              <Badge className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 shadow-sm", productInsights.reorderDays < 7 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                {productInsights.reorderDays} DAYS RUNWAY
              </Badge>
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1.5">Velocity: {productInsights.velocity} U/DAY</p>
            </div>
          </div>

          <Tabs defaultValue="trends" className="w-full">
            <div className="px-8 pt-4 bg-white border-b border-zinc-50">
              <TabsList className="bg-zinc-100/80 p-1 rounded-2xl w-max flex gap-1 mb-4 shadow-inner">
                <TabsTrigger value="trends" className="rounded-xl px-6 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md">Trends</TabsTrigger>
                <TabsTrigger value="suppliers" className="rounded-xl px-6 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md">Suppliers</TabsTrigger>
                <TabsTrigger value="insights" className="rounded-xl px-6 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md">AI Optima</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[480px] px-8 py-6">
              <TabsContent value="trends" className="mt-0 space-y-6">
                <Card className="card-modern shadow-xl border-zinc-100/60 p-8 bg-white rounded-[2rem]">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> Performance History (14 Days)
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={productAnalytics}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a', fontWeight: 'bold' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a' }} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          labelStyle={{ fontWeight: 'black', color: '#18181b', marginBottom: '8px', fontSize: '12px' }}
                        />
                        <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', letterSpacing: '0.1em', textTransform: 'uppercase' }}/>
                        <Area yAxisId="left" type="monotone" dataKey="sales" name="Observed Sales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        <Area yAxisId="right" type="monotone" dataKey="stock" name="Asset Levels" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="suppliers" className="mt-0 space-y-6">
                <Card className="card-modern shadow-xl border-zinc-100/60 p-8 bg-white rounded-[2rem]">
                   <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-500" /> Sourcing Reliability Index
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={supplierMetrics}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#3f3f46', fontWeight: 'black' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a' }} />
                        <RechartsTooltip cursor={{fill: '#f4f4f5'}} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                        <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', letterSpacing: '0.1em', textTransform: 'uppercase' }}/>
                        <Bar yAxisId="left" dataKey="qualityScore" name="Quality Rating" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                        <Bar yAxisId="left" dataKey="deliveryRate" name="Service SLA" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
                        <Bar yAxisId="right" dataKey="leadTime" name="Cycle Time" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="card-modern shadow-sm border-zinc-200/60 p-6 bg-gradient-to-br from-indigo-50/50 to-white rounded-3xl">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-200">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-zinc-900 mb-2 uppercase text-[10px] tracking-widest">Replenishment Logic</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                      {productInsights.insightText}
                    </p>
                  </Card>
                  
                  <Card className="card-modern shadow-sm border-zinc-200/60 p-6 bg-gradient-to-br from-blue-50/50 to-white rounded-3xl">
                     <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 border border-blue-200">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-zinc-900 mb-2 uppercase text-[10px] tracking-widest">Velocity Simulation</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                      Observed velocity of <strong className="text-zinc-900">{productInsights.velocity} U/DAY</strong> suggests a replenishment buffer of <strong>{Math.ceil(productInsights.velocity * (supplierMetrics[0]?.leadTime || 0))} units</strong> to ensure zero stock-out probability.
                    </p>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => { if (!open) setDeleteConfirmProduct(null); }}>
      <DialogContent className="rounded-[2rem] border-zinc-200 sm:max-w-md shadow-2xl bg-white">
        <DialogHeader>
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <Trash2 className="w-7 h-7" />
          </div>
          <DialogTitle className="text-2xl font-black text-zinc-900 tracking-tight">Decommission Asset?</DialogTitle>
          <DialogDescription className="text-zinc-500 font-medium leading-relaxed">
            Propagating this command will permanently remove <b>{deleteConfirmProduct?.name}</b> and all associated branch records. This bypasses the recovery protocol.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3 sm:gap-0 mt-6 sm:justify-between">
          <Button variant="ghost" className="rounded-2xl h-14 font-black text-[10px] uppercase tracking-widest px-8" onClick={() => setDeleteConfirmProduct(null)}>Abort CMD</Button>
          <Button
            className="rounded-2xl bg-rose-600 text-white h-14 font-black text-[10px] uppercase tracking-widest px-10 hover:bg-rose-700 shadow-xl shadow-rose-600/20"
            onClick={confirmDeleteProduct}
          >
            Execute Purge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Camera Interface */}
    <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
      <DialogContent showCloseButton={false} className="max-w-4xl w-[95vw] h-[85vh] md:h-auto p-0 overflow-hidden rounded-[2.5rem] border-none bg-black shadow-[0_0_100px_rgba(0,0,0,1)] outline-none border-white/5 top-1/2 -translate-y-1/2">
        <div className="relative h-full w-full flex flex-col overflow-hidden bg-zinc-950">
          
          <div className="relative flex-1 w-full bg-black overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            />
            
             <AnimatePresence>
              {isFlashActive && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white z-[60] pointer-events-none"
                  transition={{ duration: 0.1 }}
                />
              )}
            </AnimatePresence>

            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-4 z-50">
               <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-5 bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-white/10 flex items-center justify-between shadow-2xl"
               >
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-zinc-400" />
                     </div>
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Optical Lock</p>
                        <h3 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs uppercase tracking-tight">{productForm.name || "UNIDENTIFIED"}</h3>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Index Price</p>
                     <p className="text-sm font-black text-emerald-400 tracking-tighter">${productForm.price || "0.00"}</p>
                  </div>
               </motion.div>
            </div>

            {(!hasCameraAccess || isInitializing) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-zinc-500 bg-black z-50">
                <RefreshCw className="w-12 h-12 animate-spin text-blue-500/40" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">
                  {isInitializing ? "Lens Calibration" : "Waiting for Protocol"}
                </p>
              </div>
            )}

            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-50">
               <Button 
                  variant="outline" 
                  className="rounded-full w-12 h-12 border-white/5 bg-black/40 backdrop-blur-3xl text-white hover:bg-white/10 p-0 shadow-2xl flex items-center justify-center transition-all"
                  onClick={() => setIsCameraOpen(false)}
                >
                <XIcon className="w-5 h-5" />
              </Button>
              
              <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    className={cn(
                      "rounded-full w-12 h-12 border-white/5 bg-black/40 backdrop-blur-3xl transition-all p-0 shadow-2xl flex items-center justify-center",
                      flashlight ? "text-yellow-400 border-yellow-500/30" : "text-white"
                    )}
                    onClick={() => setFlashlight(!flashlight)}
                  >
                  {flashlight ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5 opacity-40" />}
                </Button>
                <Button 
                    variant="outline" 
                    className="rounded-full w-12 h-12 border-white/5 bg-black/40 backdrop-blur-3xl text-white p-0 shadow-2xl flex items-center justify-center"
                    onClick={() => setCameraMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="h-[220px] w-full bg-zinc-950 border-t border-white/5 relative flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-950 to-black px-8">
            <div className="flex items-center gap-5 px-6 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/5 shadow-inner">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Hardware Stable</span>
               </div>
            </div>

            <div className="w-full flex items-center justify-between max-w-md">
               <div className="flex items-center gap-4 min-w-[80px]">
                <div className="flex -space-x-4 overflow-hidden py-1">
                  {capturedImages.slice(0, 3).map((img, i) => (
                    <motion.div
                      key={img}
                      initial={{ scale: 0, x: -10 }}
                      animate={{ scale: 1, x: 0 }}
                      className="w-12 h-12 rounded-xl border border-white/20 bg-zinc-900 overflow-hidden ring-2 ring-black shadow-2xl"
                    >
                      <img src={img} className="w-full h-full object-cover opacity-80" />
                    </motion.div>
                  ))}
                  {capturedImages.length === 0 && (
                    <div className="w-12 h-12 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-zinc-700" />
                    </div>
                  )}
                </div>
               </div>

               <Button 
                className="group relative rounded-full w-28 h-28 bg-white/5 hover:bg-white/10 p-0 shadow-[0_0_50px_rgba(255,255,255,0.05)] active:scale-95 transition-all border-none ring-2 ring-white/10 backdrop-blur-md"
                onClick={async () => {
                  if (!videoRef.current || !canvasRef.current || isCapturing) return;
                  setIsCapturing(true);
                  if (navigator.vibrate) navigator.vibrate(50);
                  const canvas = canvasRef.current;
                  const video = videoRef.current;
                  const MAX_RES = 1080;
                  let width = video.videoWidth;
                  let height = video.videoHeight;
                  if (width > height) { if (width > MAX_RES) { height *= MAX_RES / width; width = MAX_RES; } }
                  else { if (height > MAX_RES) { width *= MAX_RES / height; height = MAX_RES; } }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d', { alpha: false });
                  if (ctx) ctx.drawImage(video, 0, 0, width, height);
                  canvas.toBlob(async (blob) => {
                    if (!blob) return;
                    setIsFlashActive(true);
                    setTimeout(() => setIsFlashActive(false), 100);
                    const localUrl = URL.createObjectURL(blob);
                    setCapturedImages(prev => [localUrl, ...prev]);
                    setIsCapturing(false);
                    try {
                      const storageRef = ref(getStorage(), `products/sc_${Date.now()}.jpg`);
                      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
                      const url = await getDownloadURL(storageRef);
                      setProductForm(prev => ({ ...prev, image_url: url }));
                      toast.success("Optical capture indexed");
                    } catch (err: any) {
                      toast.error(`Capture sync failed: ${err.message}`);
                    }
                  }, 'image/jpeg', 0.85);
                }}
               >
                 <div className="absolute inset-3 rounded-full border-2 border-white opacity-10 group-hover:opacity-100 transition-opacity" />
                 <div className="w-20 h-20 rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.4)] ring-8 ring-black/20" />
               </Button>

               <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <Button 
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl flex items-center justify-center p-0 transition-all active:scale-90 hover:scale-110 border-none"
                    onClick={async () => {
                      if (capturedImages.length > 0) setIsCameraOpen(false);
                      else setIsCameraOpen(false);
                    }}
                  >
                     <Check className="w-7 h-7" />
                  </Button>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">Log Frame</span>
               </div>
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
    </>
  );
}
