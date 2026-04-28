import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Plus, Search, Filter, Download, MoreHorizontal, Package, 
  AlertTriangle, ArrowRightLeft, TrendingUp, Layers, Box, BarChart3,
  ChevronRight, ArrowRight, CheckCircle2, AlertCircle, Truck, Clock, RefreshCw, Sparkles,
  Camera, Image as ImageIcon, Scan, ScanLine, Check, Info, MoreVertical, X as XIcon, Zap, ZapOff, Maximize2, Zap as Flashlight, Loader2, Trash2, Users,
  ShieldCheck, CalendarCheck, CreditCard, Activity, FileText, Link2
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
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
  runTransaction,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  auth,
  increment,
  serverTimestamp,
  limit,
  orderBy
} from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { recordFinancialEvent } from '@/lib/ledger';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';
import { useModules } from "@/context/ModuleContext";
import { recordAuditLog } from "@/lib/audit";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export default function Inventory() {
  const { 
    activeBranch, setActiveBranch, hasActiveTransaction, setHasActiveTransaction, 
    formatCurrency, currency, enterpriseId, branding, setPosSession, 
    posSession, clearSession, updateShiftStatus, logout,
    shiftTimePolicies: timePolicies, setShiftTimePolicies: setTimePolicies 
  } = useModules();
  const [activeTab, setActiveTab] = useState('stock');
  const [activeSubTab, setActiveSubTab] = useState('inventory');
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isStocktakeDialogOpen, setIsStocktakeDialogOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [inventoryBatches, setInventoryBatches] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedStocktake, setSelectedStocktake] = useState<any>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchDeletingMovements, setIsBatchDeletingMovements] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [poToReceive, setPoToReceive] = useState<any>(null);
  const [receivingBatchInfo, setReceivingBatchInfo] = useState<any>({}); // { [itemIndex]: { batch: '', expiry: '' } }
  const [isBatchDeletingSuppliers, setIsBatchDeletingSuppliers] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  const UNITS = ["boxes", "g", "kg", "L", "lbs", "mL", "oz", "pcs", "units", "clutch", "m", "cm", "in", "ft", "yd", "pack", "case", "set", "roll", "bag", "bundle", "doz", "gross"];
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
    adjustmentReason: 'RESTOCK',
    unit: 'pcs'
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
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isLinkSupplierDialogOpen, setIsLinkSupplierDialogOpen] = useState(false);
  const [isBatchLinking, setIsBatchLinking] = useState(false);
  const [selectedSupplierForBatch, setSelectedSupplierForBatch] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    status: 'ACTIVE'
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSavingPO, setIsSavingPO] = useState(false);
  const [isSavingStocktake, setIsSavingStocktake] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [cameraMode, setCameraMode] = useState<'user' | 'environment'>('environment');
  const [flashlight, setFlashlight] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [poForm, setPoForm] = useState<any>({
    supplier_id: '',
    items: [],
    status: 'DRAFT',
    total_cost: 0,
    notes: ''
  });
  const [stocktakeForm, setStocktakeForm] = useState<any>({
    branch_id: '',
    items: [],
    status: 'IN_PROGRESS',
    notes: ''
  });
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
    setCameraError(false);
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
      setCameraError(true);
      toast.error("Camera unavailable — use manual entry below");
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
      // FIX: Added limit() caps to all getDocs fetches.
      // Products and inventory capped at 1000 (warehouse scale),
      // movements at 500 (most recent is what matters for display).
      const [pSnap, iSnap, mSnap, bSnap, sSnap, poSnap, stSnap, btSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('enterprise_id', '==', enterpriseId), limit(1000))),
        getDocs(query(collection(db, 'inventory'), where('enterprise_id', '==', enterpriseId), limit(1000))),
        getDocs(query(collection(db, 'inventory_movements'), where('enterprise_id', '==', enterpriseId), orderBy('date', 'desc'), limit(500))),
        getDocs(query(collection(db, 'branches'), where('enterprise_id', '==', enterpriseId), limit(100))),
        getDocs(query(collection(db, 'suppliers'), where('enterprise_id', '==', enterpriseId), limit(200))),
        getDocs(query(collection(db, 'purchase_orders'), where('enterprise_id', '==', enterpriseId), limit(300))),
        getDocs(query(collection(db, 'stocktakes'), where('enterprise_id', '==', enterpriseId), limit(100))),
        getDocs(query(collection(db, 'inventory_batches'), where('enterprise_id', '==', enterpriseId), limit(500)))
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
      setPurchaseOrders(poSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStocktakes(stSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setInventoryBatches(btSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast.error(`Logistics error: ${error?.message || 'Could not sync assets'}`);
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
    return sum + (total * (p.cost || p.retail_price || p.price || 0));
  }, 0);

  const generateSKU = (category: string) => {
    if (!category) {
      toast.error('Select a category first to generate SKU');
      return;
    }
    const prefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const count = products.filter(p => p.category === category).length;
    
    // Ensure uniqueness
    let nextNum = count + 1;
    let newSku = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
    while (products.some(p => p.sku === newSku)) {
      nextNum++;
      newSku = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
    }

    setProductForm(prev => ({ ...prev, sku: newSku }));
    toast.success(`SKU generated: ${newSku}`, {
      icon: <Sparkles className="w-4 h-4 text-amber-500" />
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-imported
    event.target.value = '';

    const loadingToast = toast.loading("Analyzing strategic database...");
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    // Resolve the branch to write stock to — fall back to first branch when on "all"
    const targetBranch = activeBranch !== 'all' ? activeBranch : (branches[0]?.id || null);

    const parseNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = String(val).replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    };

    // Shared header-detection for any spreadsheet with decorative top rows
    const buildRowsFromSheet = (worksheet: any) => {
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      const headerKeywords = ['STOCK', 'ITEM', 'NAME', 'SKU', 'PRODUCT', 'PRICE', 'RETAIL', 'QTY', 'QUANTITY'];
      let headerRowIndex = rows.findIndex(row =>
        row && row.some(cell =>
          typeof cell === 'string' &&
          headerKeywords.some(kw => cell.toUpperCase().includes(kw))
        )
      );
      if (headerRowIndex === -1) headerRowIndex = 0;
      const headers = rows[headerRowIndex];
      return rows.slice(headerRowIndex + 1)
        .filter(row => row && row.some(cell => cell !== undefined && cell !== ''))
        .map(row => {
          const obj: any = {};
          headers.forEach((header: any, index: number) => {
            if (header) obj[String(header)] = row[index];
          });
          return obj;
        });
    };

    const processData = async (data: any[]) => {
      try {
        const validRows = data.filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);
        if (validRows.length === 0) throw new Error("No readable records found. Check that your file has a header row with column names.");

        // ── IMPORTANT: each product + its inventory record = 2 ops
        // ── so keep batch at 200 rows max (400 ops max per batch, safely under 500)
        const BATCH_SIZE = 200;
        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const chunk = validRows.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);

          for (const row of chunk) {
            // Normalise keys: trim, uppercase, collapse spaces to underscores
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              const nk = key.trim().toUpperCase().replace(/\s+/g, '_');
              normalizedRow[nk] = row[key];
            });

            const getVal = (keys: string[]) => {
              for (const k of keys) {
                const nk = k.toUpperCase().replace(/\s+/g, '_');
                if (normalizedRow[nk] !== undefined && normalizedRow[nk] !== null && normalizedRow[nk] !== '') {
                  return normalizedRow[nk];
                }
              }
              return null;
            };

            const name = getVal(['NAME', 'PRODUCT', 'STOCK_ITEMS', 'ITEM_NAME', 'DESCRIPTION', 'ITEM', 'PRODUCT_NAME']);
            if (!name) { skippedCount++; continue; }

            let sku = getVal(['SKU', 'CODE', 'PART_NUMBER', 'PART_NO', 'ID', 'SERIAL', 'ITEM_CODE']);
            if (!sku) {
              const prefix = String(name).replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
              sku = `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            }

            const price  = parseNumber(getVal(['RETAIL', 'PRICE', 'RETAIL_PRICE', 'SELLING_PRICE', 'SALE_PRICE', 'LIST_PRICE']));
            const cost   = parseNumber(getVal(['COST', 'UNIT_COST', 'COST_PRICE', 'PURCHASE_PRICE', 'BUY_PRICE']));

            const productRef = doc(collection(db, 'products'));

            batch.set(productRef, {
              name: String(name),
              sku: String(sku),
              price,
              retail_price: price,
              cost,
              category: getVal(['CATEGORY', 'DEPARTMENT', 'GROUP', 'TYPE', 'CLASS']) || 'General',
              barcode:  getVal(['BARCODE', 'UPC', 'EAN', 'GTIN']) || '',
              unit:     getVal(['UNIT', 'UOM', 'MEASURE', 'UNIT_OF_MEASURE']) || 'pcs',
              min_stock_level: parseNumber(getVal(['MIN_STOCK', 'REORDER_POINT', 'SAFETY_STOCK', 'MINIMUM']) || 10),
              enterprise_id: enterpriseId,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });

            // Quantity — write to resolved branch (never silently skip)
            const qtyKey = Object.keys(normalizedRow).find(k =>
              k.includes('QTY') || k.includes('QUANTITY') || k === 'STOCK' ||
              k.includes('STOCK_LEVEL') || k.includes('ON_HAND') || k.includes('AVAILABLE')
            );
            const qty = qtyKey ? parseNumber(normalizedRow[qtyKey]) : 0;

            if (qty > 0 && targetBranch) {
              const invRef = doc(collection(db, 'inventory'));
              batch.set(invRef, {
                product_id: productRef.id,
                branch_id:  targetBranch,
                enterprise_id: enterpriseId,
                quantity:   qty,
                last_updated: serverTimestamp()
              });
            }

            importedCount++;
          }

          await batch.commit();
        }

        const withQty = validRows.filter(r => {
          const nRow: any = {};
          Object.keys(r).forEach(k => { nRow[k.trim().toUpperCase().replace(/\s+/g, '_')] = r[k]; });
          return Object.keys(nRow).some(k => (k.includes('QTY') || k.includes('QUANTITY') || k === 'STOCK') && parseNumber(nRow[k]) > 0);
        }).length;

        toast.success(
          `Import complete: ${importedCount} products onboarded${withQty > 0 ? `, ${withQty} stock levels synced` : ''}${targetBranch ? ` → ${branches.find(b => b.id === targetBranch)?.name || targetBranch}` : ''}${skippedCount > 0 ? `. ⚠️ ${skippedCount} rows skipped (missing Name field)` : ''}.`,
          { id: loadingToast, duration: 6000 }
        );

        await recordAuditLog({
          enterpriseId,
          action: "INVENTORY_IMPORT",
          details: `Bulk ${fileExt?.toUpperCase()} import: ${importedCount} products, ${withQty} stock records.`,
          severity: "WARNING",
          type: "SYSTEM",
          metadata: { importedCount, withQty, fileName: file.name, targetBranch }
        });

        setIsImportDialogOpen(false);
        fetchData();
      } catch (error: any) {
        console.error('Import error:', error);
        toast.error(`Import failure: ${error.message}`, { id: loadingToast });
      }
    };

    // ── Format Routing ──────────────────────────────────────────────────────────
    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => toast.error(`CSV parse error: ${error.message}`, { id: loadingToast })
      });
    } else if (fileExt === 'tsv') {
      Papa.parse(file, {
        header: true,
        delimiter: '\t',
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => toast.error(`TSV parse error: ${error.message}`, { id: loadingToast })
      });
    } else if (fileExt === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const rows = Array.isArray(parsed) ? parsed : parsed.data || parsed.products || parsed.inventory || Object.values(parsed);
          processData(rows);
        } catch {
          toast.error("Invalid JSON format", { id: loadingToast });
        }
      };
      reader.onerror = () => toast.error("File read failure", { id: loadingToast });
      reader.readAsText(file);
    } else if (['xlsx', 'xls', 'ods'].includes(fileExt || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          processData(buildRowsFromSheet(worksheet));
        } catch (err: any) {
          toast.error(`Spreadsheet parse error: ${err.message}`, { id: loadingToast });
        }
      };
      reader.onerror = () => toast.error("File read failure", { id: loadingToast });
      reader.readAsBinaryString(file);
    } else {
      toast.error(`Unsupported format ".${fileExt}". Supported: CSV, TSV, XLSX, XLS, ODS, JSON`, { id: loadingToast });
    }
  };



  const handleSavePO = async (statusOverride?: string) => {
    if (!poForm.supplier_id || poForm.items.length === 0) {
      toast.error('Mission violation: Incomplete PO data');
      return;
    }
    setIsSavingPO(true);
    try {
      const total = poForm.items.reduce((sum: number, item: any) => sum + ((item.cost || 0) * (item.qty || 0)), 0);
      const poData = {
        ...poForm,
        total_cost: total,
        status: statusOverride || poForm.status || 'DRAFT',
        updated_at: new Date().toISOString()
      };

      if (selectedPO) {
        await updateDoc(doc(db, 'purchase_orders', selectedPO.id), poData);
      } else {
        await addDoc(collection(db, 'purchase_orders'), {
          ...poData,
          enterprise_id: enterpriseId,
          created_at: new Date().toISOString()
        });
      }
      toast.success('Purchase Order synchronized');
      setIsPurchaseOrderOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Strategic PO failure');
    } finally {
      setIsSavingPO(false);
    }
  };

  const handleReceivePO = (po: any) => {
    if (po.status === 'RECEIVED') return;
    setPoToReceive(po);
    const initialBatchInfo: any = {};
    po.items.forEach((_: any, index: number) => {
      initialBatchInfo[index] = { batch: `B${Math.random().toString(36).substring(7).toUpperCase()}`, expiry: '' };
    });
    setReceivingBatchInfo(initialBatchInfo);
    setIsReceiveDialogOpen(true);
  };

  const finalizeReception = async () => {
    if (!poToReceive) return;
    try {
      const batch = writeBatch(db);
      const branchId = activeBranch === 'all' ? (branches[0]?.id || '') : activeBranch;
      
      for (let i = 0; i < poToReceive.items.length; i++) {
        const item = poToReceive.items[i];
        const batchInfo = receivingBatchInfo[i];
        
        // Update Inventory Total
        const q = query(
          collection(db, 'inventory'),
          where('product_id', '==', item.product_id),
          where('branch_id', '==', branchId),
          where('enterprise_id', '==', enterpriseId)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          const invRef = doc(collection(db, 'inventory'));
          batch.set(invRef, {
            product_id: item.product_id,
            branch_id: branchId,
            quantity: item.qty,
            enterprise_id: enterpriseId,
            updated_at: new Date().toISOString()
          });
        } else {
          batch.update(snapshot.docs[0].ref, {
            quantity: increment(item.qty),
            updated_at: new Date().toISOString()
          });
        }

        // Create Inventory Batch
        const btRef = doc(collection(db, 'inventory_batches'));
        batch.set(btRef, {
          product_id: item.product_id,
          branch_id: branchId,
          batch_number: batchInfo.batch || `B${Date.now()}`,
          expiry_date: batchInfo.expiry || '',
          quantity: item.qty,
          enterprise_id: enterpriseId,
          created_at: new Date().toISOString()
        });

        // Log movement
        const movRef = doc(collection(db, 'inventory_movements'));
        batch.set(movRef, {
          product_id: item.product_id,
          product: products.find(p => p.id === item.product_id)?.name || 'Unknown',
          qty: item.qty,
          type: 'PO_RECEIPT',
          from: suppliers.find(s => s.id === poToReceive.supplier_id)?.name || 'SUPPLIER',
          to: branches.find(b => b.id === branchId)?.name || 'LOCAL',
          date: new Date().toISOString(),
          status: 'COMPLETED',
          enterprise_id: enterpriseId,
          reference_id: poToReceive.id,
          batch_number: batchInfo.batch
        });
      }

      batch.update(doc(db, 'purchase_orders', poToReceive.id), {
        status: 'RECEIVED',
        received_at: new Date().toISOString()
      });

      await batch.commit();

      await recordAuditLog({
        enterpriseId,
        action: "INVENTORY_PO_RECEIVE",
        details: `Logistical reception complete for PO ${poToReceive.id}. Assets deployed to branch.`,
        severity: "WARNING",
        type: "SYSTEM",
        metadata: { poId: poToReceive.id, supplierId: poToReceive.supplier_id, itemCount: poToReceive.items?.length }
      });

      // Log the financial event for Double-Entry Ledger (Expense / Accounts Payable)
      if (poToReceive.total_cost && poToReceive.total_cost > 0) {
        await recordFinancialEvent({
          enterpriseId,
          amount: poToReceive.total_cost,
          sourceId: poToReceive.id,
          sourceType: "EXPENSE",
          description: `Inventory PO Receipt - ${poToReceive.supplier_id}`,
          metadata: { supplier: poToReceive.supplier_id, itemsCount: poToReceive.items?.length }
        });
      }

      toast.success('Logistical reception complete. Assets deployed.');
      setIsReceiveDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Reception synchronization failure');
    }
  };

  const handleApplyStocktake = async (st: any) => {
    const confirm = window.confirm("Apply reconciliation adjustments? This will override current system counts with your manual findings.");
    if (!confirm) return;

    try {
      const batch = writeBatch(db);
      let totalShrinkageValue = 0;
      let totalDiscoveryValue = 0;
      
      for (const item of st.items) {
        if (item.variance === 0) continue;

        const q = query(
          collection(db, 'inventory'),
          where('product_id', '==', item.product_id),
          where('branch_id', '==', st.branch_id),
          where('enterprise_id', '==', enterpriseId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          batch.update(snapshot.docs[0].ref, {
            quantity: item.counted,
            updated_at: new Date().toISOString()
          });

          // Log discrepancy
          const movRef = doc(collection(db, 'inventory_movements'));
          batch.set(movRef, {
            product_id: item.product_id,
            product: products.find(p => p.id === item.product_id)?.name || 'Unknown',
            qty: item.variance,
            type: item.variance < 0 ? 'SHRINKAGE' : 'DISCOVERY',
            from: 'AUDIT',
            to: branches.find(b => b.id === st.branch_id)?.name || 'LOCAL',
            date: new Date().toISOString(),
            status: 'COMPLETED',
            enterprise_id: enterpriseId,
            reason: 'AUDIT_RECONCILIATION'
          });

          // Accumulate financial impact
          const p = products.find(prod => prod.id === item.product_id);
          const cost = p?.cost || p?.retail_price || p?.price || 0;
          if (item.variance < 0) {
            totalShrinkageValue += (Math.abs(item.variance) * cost);
          } else {
            totalDiscoveryValue += (item.variance * cost);
          }
        }
      }

      batch.update(doc(db, 'stocktakes', st.id), {
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      });

      await batch.commit();

      await recordAuditLog({
        enterpriseId,
        action: "INVENTORY_AUDIT_COMPLETE",
        details: `Stocktake reconciliation completed for branch audit ${st.id.substring(0, 8)}.`,
        severity: "CRITICAL",
        type: "SYSTEM",
        metadata: { auditId: st.id, shrinkageValue: totalShrinkageValue, discoveryValue: totalDiscoveryValue }
      });

      if (totalShrinkageValue > 0) {
        await recordFinancialEvent({
          enterpriseId,
          amount: totalShrinkageValue,
          sourceId: st.id,
          sourceType: "EXPENSE",
          description: `Stocktake Shrinkage - Audit ${st.id.substring(0, 8)}`,
          metadata: { audit_id: st.id, type: "SHRINKAGE" }
        });
      }
      
      if (totalDiscoveryValue > 0) {
        // Logging discovery as a contra-expense (or revenue equivalent) in POS logic.
        // For standard operations we can log it as an INVOICE/Sale equivalent to boost profit, 
        // but POS_TRANSACTION is the generic revenue entry.
        await recordFinancialEvent({
          enterpriseId,
          amount: totalDiscoveryValue,
          sourceId: st.id,
          sourceType: "POS_TRANSACTION",
          description: `Stocktake Discovery - Audit ${st.id.substring(0, 8)}`,
          metadata: { audit_id: st.id, type: "DISCOVERY" }
        });
      }

      toast.success('Inventory state recalibrated successfully');
      fetchData();
    } catch (error) {
      console.error('Audit recalibration error:', error);
      toast.error('Logistical synchronization failed');
    }
  };

  const handleLiquidateBatch = async (batchItem: any) => {
    if (!window.confirm(`Initiate liquidation protocol for Batch ${batchItem.batch_number}? This will permanently remove ${batchItem.quantity} units from active inventory.`)) return;

    try {
      const batchOp = writeBatch(db);

      // 1. Deduct from main inventory
      const q = query(
        collection(db, 'inventory'),
        where('product_id', '==', batchItem.product_id),
        where('branch_id', '==', batchItem.branch_id),
        where('enterprise_id', '==', enterpriseId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const invDoc = snapshot.docs[0];
        batchOp.update(invDoc.ref, {
          quantity: increment(-batchItem.quantity),
          updated_at: new Date().toISOString()
        });
      }

      // 2. Log Movement
      const movRef = doc(collection(db, 'inventory_movements'));
      batchOp.set(movRef, {
        product_id: batchItem.product_id,
        product: products.find(p => p.id === batchItem.product_id)?.name || 'Unknown Asset',
        qty: batchItem.quantity,
        type: 'SHRINKAGE',
        from: branches.find(b => b.id === batchItem.branch_id)?.name || 'LOCAL',
        to: 'LIQUIDATION',
        date: new Date().toISOString(),
        status: 'COMPLETED',
        enterprise_id: enterpriseId,
        reason: 'EXPIRATION_LIQUIDATION'
      });

      // 3. Remove Batch Record
      batchOp.delete(doc(db, 'inventory_batches', batchItem.id));

      await batchOp.commit();

      await recordAuditLog({
        enterpriseId,
        action: "INVENTORY_LIQUIDATION",
        details: `Liquidation protocol executed for Batch ${batchItem.batch_number}. assets removed from circulation.`,
        severity: "WARNING",
        type: "SYSTEM",
        metadata: { batchId: batchItem.id, batchNumber: batchItem.batch_number, qty: batchItem.quantity }
      });

      const product = products.find(p => p.id === batchItem.product_id);
      const cost = product?.cost || product?.retail_price || product?.price || 0;
      const totalShrinkageValue = cost * batchItem.quantity;
      if (totalShrinkageValue > 0) {
        await recordFinancialEvent({
          enterpriseId,
          amount: totalShrinkageValue,
          sourceId: batchItem.id,
          sourceType: "EXPENSE",
          description: `Inventory Liquidation - Batch ${batchItem.batch_number}`,
          metadata: { batch_number: batchItem.batch_number, quantity: batchItem.quantity }
        });
      }

      toast.success('Batch liquidated and inventory recalibrated');
      fetchData();
    } catch (error) {
      console.error('Liquidation error:', error);
      toast.error('Liquidation protocol failed');
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const openProductSheet = (product: any = null) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({
        name: product.name || '',
        sku: product.sku || '',
        price: product.retail_price || product.price || 0,
        cost: product.cost || product.retail_price || product.price || 0,
        markup: product.markup || 20,
        category: product.category || '',
        barcode: product.barcode || '',
        image_url: product.image_url || '',
        minStock: product.min_stock_level || 10,
        maxStock: product.max_stock_level || 100,
        leadTime: product.lead_time_days || 5,
        autoReorder: product?.auto_reorder || false,
        supplier_id: product?.supplier_id || '',
        description: product?.description || '',
        initialStock: product?.stock || 0,
        adjustmentReason: 'RESTOCK',
        unit: product?.unit || 'pcs'
      });
      setIsCustomUnit(product?.unit && !UNITS.includes(product.unit));
      setEditingProductId(product?.id || null);
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
        unit: productForm.unit || 'pcs',
        enterprise_id: enterpriseId,
        updated_at: new Date().toISOString()
      };

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction Timeout')), 15000)
      );

      if (editingProductId) {
        const productRef = doc(db, 'products', editingProductId);
        batch.update(productRef, productData);
        
        const initialStockQty = Number(productForm.initialStock) || 0;
        if (activeBranch !== 'all') {
          // Find or create inventory doc for this branch
          const q = query(
            collection(db, 'inventory'), 
            where('product_id', '==', editingProductId),
            where('branch_id', '==', activeBranch),
            where('enterprise_id', '==', enterpriseId)
          );
          const snapshots = await getDocs(q);
          if (!snapshots.empty) {
            batch.update(snapshots.docs[0].ref, { 
              quantity: initialStockQty,
              updated_at: new Date().toISOString()
            });
          } else {
            const invRef = doc(collection(db, 'inventory'));
            batch.set(invRef, {
              product_id: editingProductId,
              branch_id: activeBranch,
              quantity: initialStockQty,
              enterprise_id: enterpriseId,
              updated_at: new Date().toISOString()
            });
          }

          const movRef = doc(collection(db, 'inventory_movements'));
          batch.set(movRef, {
            product_id: editingProductId,
            product: productForm.name,
            qty: initialStockQty,
            type: 'ADJUSTMENT',
            from: 'SYSTEM',
            to: branches.find(b => b.id === activeBranch)?.name || 'MAIN',
            date: new Date().toISOString(),
            status: 'COMPLETED',
            enterprise_id: enterpriseId,
            reason: productForm.adjustmentReason || 'RECOUNT'
          });
        }
        
        await Promise.race([batch.commit(), timeoutPromise]);
        toast.success('Product asset lifecycle updated');
      } else {
        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          ...productData,
          created_at: new Date().toISOString()
        });
        
        const initialStockQty = Number(productForm.initialStock) || 0;
        const targetBranchId = activeBranch === 'all' ? (branches[0]?.id) : activeBranch;

        if (initialStockQty > 0 && targetBranchId) {
          const invRef = doc(collection(db, 'inventory'));
          batch.set(invRef, {
            product_id: productRef.id,
            branch_id: targetBranchId,
            quantity: initialStockQty,
            enterprise_id: enterpriseId,
            updated_at: new Date().toISOString()
          });

          const movRef = doc(collection(db, 'inventory_movements'));
          batch.set(movRef, {
            product_id: productRef.id,
            product: productForm.name,
            qty: initialStockQty,
            type: 'INITIAL_STOCK',
            from: 'SYSTEM',
            to: branches.find(b => b.id === targetBranchId)?.name || 'MAIN',
            date: new Date().toISOString(),
            status: 'COMPLETED',
            enterprise_id: enterpriseId,
            reason: 'INITIAL_LOAD'
          });
        }

        
        await Promise.race([batch.commit(), timeoutPromise]);
        toast.success('New product asset deployed');
      }
      
      setIsProductSheetOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('CRITICAL: Strategic deployment failed:', error);
      if (error.message === 'Transaction Timeout') {
        toast.error('Network congestion: Deployment taking too long. Check your connection.');
      } else {
        const isPermissionError = error?.code === 'permission-denied';
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(isPermissionError 
          ? `Access Denied: Enterprise "${enterpriseId}" authorization rejected.`
          : `Strategic deployment failed: ${errorMessage.slice(0, 60)}...`);
      }
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
      const q = query(
        collection(db, 'inventory'), 
        where('product_id', '==', deleteConfirmProduct.id),
        where('enterprise_id', '==', enterpriseId)
      );
      const snapshots = await getDocs(q);
      const batch = writeBatch(db);
      snapshots.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      toast.success('Asset decommissioned successfully');
      setDeleteConfirmProduct(null);
      fetchData();
    } catch (error: any) {
      console.error('Purge error:', error);
      toast.error(error.code === 'permission-denied' ? 'Authorization error during purge' : 'Purge failed');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    setIsBatchDeleting(true);
    try {
      // Parallelise all Firestore lookups to avoid serial await-in-loop
      const [inventorySnaps, batchSnaps, movementSnaps] = await Promise.all([
        Promise.all(selectedProducts.map(id =>
          getDocs(query(collection(db, 'inventory'), where('product_id', '==', id), where('enterprise_id', '==', enterpriseId)))
        )),
        Promise.all(selectedProducts.map(id =>
          getDocs(query(collection(db, 'inventory_batches'), where('product_id', '==', id), where('enterprise_id', '==', enterpriseId)))
        )),
        Promise.all(selectedProducts.map(id =>
          getDocs(query(collection(db, 'inventory_movements'), where('product_id', '==', id), where('enterprise_id', '==', enterpriseId)))
        ))
      ]);

      const allRefs: any[] = [
        ...selectedProducts.map(id => doc(db, 'products', id)),
        ...inventorySnaps.flatMap(snap => snap.docs.map(d => d.ref)),
        ...batchSnaps.flatMap(snap => snap.docs.map(d => d.ref)),
        ...movementSnaps.flatMap(snap => snap.docs.map(d => d.ref)),
      ];

      // Commit in chunks of 500 to respect Firestore limits
      const CHUNK = 500;
      for (let i = 0; i < allRefs.length; i += CHUNK) {
        const batch = writeBatch(db);
        allRefs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      await recordAuditLog({
        enterpriseId,
        action: 'INVENTORY_BATCH_DELETE',
        details: `Batch decommission of ${selectedProducts.length} products with all associated inventory, batch, and movement records.`,
        severity: 'CRITICAL',
        type: 'SYSTEM',
        metadata: { productIds: selectedProducts, count: selectedProducts.length }
      });

      toast.success(`${selectedProducts.length} assets purged`);
      setSelectedProducts([]);
      fetchData();
    } catch (error: any) {
      console.error('Batch purge error:', error);
      toast.error('Batch decommission failed. Verify administrative authority.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchLinkSupplier = async () => {
    if (selectedProducts.length === 0 || !selectedSupplierForBatch) {
      toast.error('Linkage violation: Select products and a strategic partner');
      return;
    }
    setIsBatchLinking(true);
    try {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < selectedProducts.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = selectedProducts.slice(i, i + CHUNK_SIZE);
        
        chunk.forEach(id => {
          batch.update(doc(db, 'products', id), {
            supplier_id: selectedSupplierForBatch,
            updated_at: serverTimestamp()
          });
        });
        
        await batch.commit();
      }

      toast.success(`${selectedProducts.length} assets linked to strategic partner`);
      setSelectedProducts([]);
      setIsLinkSupplierDialogOpen(false);
      setSelectedSupplierForBatch('');
      fetchData();
    } catch (error) {
      console.error('Batch linkage error:', error);
      toast.error('Strategic linkage failed');
    } finally {
      setIsBatchLinking(false);
    }
  };

  const handleBatchDeleteMovements = async () => {
    if (selectedMovements.length === 0) return;
    setIsBatchDeletingMovements(true);
    try {
      const CHUNK = 500;
      for (let i = 0; i < selectedMovements.length; i += CHUNK) {
        const batch = writeBatch(db);
        selectedMovements.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'inventory_movements', id)));
        await batch.commit();
      }
      await recordAuditLog({
        enterpriseId,
        action: 'INVENTORY_MOVEMENTS_PURGE',
        details: `Purged ${selectedMovements.length} inventory movement log entries.`,
        severity: 'WARNING',
        type: 'SYSTEM',
        metadata: { movementIds: selectedMovements, count: selectedMovements.length }
      });
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
      if (!enterpriseId) throw new Error('Identity Missing');

      const q = query(
        collection(db, 'inventory'), 
        where('product_id', '==', selectedProduct.id),
        where('branch_id', '==', updateStockData.branch_id),
        where('enterprise_id', '==', enterpriseId)
      );
      const snapshot = await getDocs(q);
      
      const multiplier = (updateStockData.reason === 'DAMAGED' || updateStockData.reason === 'SHRINKAGE') ? -1 : 1;
      const adjustQty = updateStockData.qty * multiplier;

      const batch = writeBatch(db);

      if (snapshot.empty) {
        const invRef = doc(collection(db, 'inventory'));
        batch.set(invRef, {
          product_id: selectedProduct.id,
          branch_id: updateStockData.branch_id,
          quantity: Math.max(0, adjustQty),
          enterprise_id: enterpriseId,
          updated_at: new Date().toISOString()
        });
      } else {
        const invDoc = snapshot.docs[0];
        batch.update(invDoc.ref, {
          quantity: Math.max(0, (invDoc.data().quantity || 0) + adjustQty),
          updated_at: new Date().toISOString()
        });
      }

      const movRef = doc(collection(db, 'inventory_movements'));
      batch.set(movRef, {
        product_id: selectedProduct.id,
        product: selectedProduct.name,
        qty: adjustQty,
        type: updateStockData.reason,
        from: multiplier > 0 ? 'SUPPLIER' : branches.find(b=>b.id===updateStockData.branch_id)?.name || 'LOCAL',
        to: multiplier > 0 ? branches.find(b=>b.id===updateStockData.branch_id)?.name || 'LOCAL' : 'WASTE',
        date: new Date().toISOString(),
        status: 'COMPLETED',
        enterprise_id: enterpriseId
      });

      await batch.commit();
      toast.success('Stock calibration synchronized');
      setIsUpdateStockOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Calibration error:', error);
      toast.error(error.code === 'permission-denied' ? 'Authorization failure: Verify enterprise context' : 'Synchronization failure');
    }
  };

  const handleTransferStock = async () => {
    if (!transferData.product_id || !transferData.from_branch_id || !transferData.to_branch_id || transferData.qty <= 0) {
      toast.error('Mission violation: Incomplete routing or quantity');
      return;
    }
    if (transferData.from_branch_id === transferData.to_branch_id) {
      toast.error('Logistics error: Source and destination nodes identical');
      return;
    }

    const sourceProduct = products.find(p => p.id === transferData.product_id);
    const transferQty = transferData.qty;
    const fromBranch = branches.find(b => b.id === transferData.from_branch_id)?.name || 'SOURCE';
    const toBranch = branches.find(b => b.id === transferData.to_branch_id)?.name || 'DESTINATION';

    try {
      // Use runTransaction for server-side atomic enforcement — prevents race conditions
      // where two concurrent transfers could both pass a client-side stock check.
      await runTransaction(db, async (transaction: any) => {
        const sourceQ = query(
          collection(db, 'inventory'),
          where('product_id', '==', transferData.product_id),
          where('branch_id', '==', transferData.from_branch_id),
          where('enterprise_id', '==', enterpriseId)
        );
        const sourceSnap = await getDocs(sourceQ);
        if (sourceSnap.empty) throw new Error('Source inventory record not found.');

        const sourceDoc = sourceSnap.docs[0];
        const currentQty = sourceDoc.data().quantity || 0;
        if (currentQty < transferQty) {
          throw new Error(`Insufficient stock: only ${currentQty} units available at source.`);
        }

        // Deduct source
        transaction.update(sourceDoc.ref, {
          quantity: currentQty - transferQty,
          updated_at: new Date().toISOString()
        });

        // Increase destination
        const destQ = query(
          collection(db, 'inventory'),
          where('product_id', '==', transferData.product_id),
          where('branch_id', '==', transferData.to_branch_id),
          where('enterprise_id', '==', enterpriseId)
        );
        const destSnap = await getDocs(destQ);
        if (destSnap.empty) {
          const invRef = doc(collection(db, 'inventory'));
          transaction.set(invRef, {
            product_id: transferData.product_id,
            branch_id: transferData.to_branch_id,
            quantity: transferQty,
            enterprise_id: enterpriseId,
            updated_at: new Date().toISOString()
          });
        } else {
          const destDoc = destSnap.docs[0];
          transaction.update(destDoc.ref, {
            quantity: (destDoc.data().quantity || 0) + transferQty,
            updated_at: new Date().toISOString()
          });
        }

        // Log movement inside the transaction
        const movRef = doc(collection(db, 'inventory_movements'));
        transaction.set(movRef, {
          product_id: transferData.product_id,
          product: sourceProduct?.name || 'Unknown',
          qty: transferQty,
          type: 'TRANSFER',
          from: fromBranch,
          to: toBranch,
          date: new Date().toISOString(),
          status: 'COMPLETED',
          enterprise_id: enterpriseId
        });
      });

      await recordAuditLog({
        enterpriseId,
        action: 'INVENTORY_TRANSFER',
        details: `Transferred ${transferQty}x ${sourceProduct?.name || transferData.product_id} from ${fromBranch} → ${toBranch}.`,
        severity: 'WARNING',
        type: 'SYSTEM',
        metadata: { productId: transferData.product_id, qty: transferQty, from: transferData.from_branch_id, to: transferData.to_branch_id }
      });

      toast.success('Logistical transfer synchronized');
      setIsTransferDialogOpen(false);
      setTransferData({ product_id: '', from_branch_id: '', to_branch_id: '', qty: 0, reason: 'INTERNAL_TRANSFER' });
      fetchData();
    } catch (error: any) {
      console.error('Transfer execution failure:', error);
      toast.error(error.message?.includes('Insufficient') ? error.message : 'Strategic transfer failure. Verify operational clearance.');
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

    // 2. Async Cloud Sync with Timeout
    setIsUploadingImage(true);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync Timeout')), 30000)
    );

    try {
      const storageRef = ref(getStorage(), `products/${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
      
      const uploadTask = (async () => {
        const uploadResult = await uploadBytes(storageRef, file);
        return await getDownloadURL(uploadResult.ref);
      })();

      const url = await Promise.race([uploadTask, timeoutPromise]) as string;
      setProductForm(prev => ({ ...prev, image_url: url }));
      toast.success('Asset visual synchronized');
    } catch (error: any) {
      console.error("Visual Sync Error:", error);
      toast.error(error.message === 'Sync Timeout' ? 'Cloud sync delayed - using local preview' : 'Cloud synchronization failed');
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
      if (selectedSupplier) {
        await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
          ...newSupplier,
          updated_at: new Date().toISOString()
        });
        toast.success('Partner profile calibrated');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...newSupplier,
          enterprise_id: enterpriseId,
          created_at: new Date().toISOString()
        });
        toast.success('Strategic partner onboarded');
      }
      setNewSupplier({ name: '', contact: '', email: '', phone: '', status: 'ACTIVE' });
      setSelectedSupplier(null);
      setIsSupplierDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Strategic sync failure');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    const hasOrders = purchaseOrders.some(po => po.supplier_id === supplierId);
    if (hasOrders) {
      toast.error('Cannot decommission partner with active procurement history');
      return;
    }

    if (!window.confirm('Initiate partner decommissioning protocol? This action is permanent.')) return;

    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      toast.success('Partner decommissioned successfully');
      fetchData();
    } catch (error) {
      toast.error('Decommissioning failure');
    }
  };

  const handleSavePurchaseOrder = async () => {
    if (!poForm.supplier_id || poForm.items.length === 0) {
      toast.error('Strategic partner and assets required');
      return;
    }
    setIsSavingPO(true);
    try {
      const totalCost = poForm.items.reduce((sum: number, item: any) => sum + (item.qty * (item.cost || 0)), 0);
      const poData = {
        ...poForm,
        total_cost: totalCost,
        enterprise_id: enterpriseId,
        updated_at: new Date().toISOString()
      };

      if (selectedPO) {
        await updateDoc(doc(db, 'purchase_orders', selectedPO.id), poData);
        toast.success('Procurement cycle recalibrated');
      } else {
        await addDoc(collection(db, 'purchase_orders'), {
          ...poData,
          created_at: new Date().toISOString()
        });
        toast.success('Strategic acquisition initialized');
      }
      setIsPurchaseOrderOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Logistical archival failed');
    } finally {
      setIsSavingPO(false);
    }
  };

  const handleUpdatePOStatus = async (poId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(`Acquisition state: ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error('State transition failed');
    }
  };

  const handleDeletePO = async (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (po?.status !== 'DRAFT') {
      toast.error('Cannot purge active acquisition cycles');
      return;
    }
    if (!window.confirm('Purge procurement draft? This action is permanent.')) return;
    try {
      await deleteDoc(doc(db, 'purchase_orders', poId));
      toast.success('Acquisition draft purged');
      fetchData();
    } catch (error) {
      toast.error('Purge failure');
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

  const productInsights = useMemo(() => {
    if (!editingProductId) return {
      velocity: 0,
      reorderDays: 0,
      expectedStockOut: 'N/A',
      optimumOrderQty: 0,
      insightText: "Select an asset to view strategic supply chain insights."
    };

    const product = products.find(p => p.id === editingProductId);
    if (!product) return { velocity: 0, reorderDays: 0, expectedStockOut: 'N/A', optimumOrderQty: 0, insightText: "" };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const relevantMovements = movements.filter(m => 
      m.product_id === editingProductId && 
      (m.type === 'SALE' || m.type === 'OUT') &&
      (m.date ? new Date(m.date) >= thirtyDaysAgo : false)
    );

    const totalSold = relevantMovements.reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);
    const velocity = Number((totalSold / 30).toFixed(1));

    const currentStock = getProductStock(editingProductId, activeBranch);
    const reorderDays = velocity > 0 ? Math.floor(currentStock / velocity) : 999;

    const stockOutDate = new Date();
    stockOutDate.setDate(stockOutDate.getDate() + (reorderDays === 999 ? 365 : reorderDays));
    const expectedStockOut = stockOutDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });

    const optimumOrderQty = (product.min_stock_level || 10) * 2;

    const insightText = velocity > 0 
      ? `Observed velocity of ${velocity} units/day. Predicted stock-out in ${reorderDays} days. ${reorderDays < (product.leadTime || 5) ? "CRITICAL: Reorder immediately." : "Inventory levels within safety parameters."}`
      : "Insufficient sales data to compute velocity baseline. Manual replenishment monitoring advised.";

    return {
      velocity,
      reorderDays: reorderDays === 999 ? "∞" : reorderDays,
      expectedStockOut,
      optimumOrderQty,
      insightText
    };
  }, [editingProductId, products, movements, inventory, activeBranch]);

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
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-900 tracking-tight break-words line-clamp-2">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                        <button 
                          type="button"
                          onClick={() => generateSKU(productForm.category)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-90 shadow-sm"
                          title="Auto-generate SKU"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Measurement Unit</label>
                    {isCustomUnit ? (
                      <div className="relative">
                        <Input 
                          placeholder="Enter unit..." 
                          className="rounded-2xl h-14 bg-white border-zinc-200 font-bold focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-sm pr-10" 
                          value={productForm.unit}
                          onChange={(e) => setProductForm({...productForm, unit: e.target.value})}
                        />
                        <button 
                          onClick={() => {
                            setIsCustomUnit(false);
                            setProductForm({...productForm, unit: 'pcs'});
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 hover:bg-zinc-200 transition-all"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <Select 
                        value={productForm.unit} 
                        onValueChange={(val) => {
                          if (val === "custom") {
                            setIsCustomUnit(true);
                            setProductForm({...productForm, unit: ""});
                          } else {
                            setProductForm({...productForm, unit: val});
                          }
                        }}
                      >
                        <SelectTrigger className="rounded-2xl h-14 bg-white border-zinc-200 font-bold focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-sm">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100">
                          {UNITS.map(u => (
                            <SelectItem key={u} value={u} className="font-bold text-xs capitalize">{u}</SelectItem>
                          ))}
                          <div className="h-px bg-zinc-100 my-1" />
                          <SelectItem value="custom" className="font-bold text-xs text-blue-600">Add Custom Unit...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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
                        disabled={activeBranch === "all" && !!editingProductId}
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
                       <p className="text-3xl font-black text-zinc-900 leading-none">4.2 <span className="text-xs font-bold text-zinc-400 tracking-normal capitalize">{productForm.unit || 'units'} / day</span></p>
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
                         "Optimized for {activeBranch === "all" ? "Enterprise" : branches.find(b=>b.id===activeBranch)?.name} deployment. Recommended reorder trigger: <b>{Math.ceil(4.2 * productForm.leadTime) + productForm.minStock} {productForm.unit || 'units'}</b>."
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-black">{currency === 'USD' ? '$' : `${currency} `}</span>
                    <Input 
                      type="number"
                      step="0.01"
                      className={cn(
                        "rounded-2xl h-16 bg-white border-zinc-200 font-black focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all py-4 text-base",
                        currency.length > 1 ? "pl-20" : "pl-8"
                      )} 
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black">{currency === 'USD' ? '$' : `${currency} `}</span>
                    <Input 
                      type="number"
                      step="0.01"
                      className={cn(
                        "rounded-2xl h-16 bg-emerald-50 border-emerald-100 font-black focus:ring-4 focus:ring-emerald-500/10 shadow-inner transition-all text-emerald-700 py-4 text-base",
                        currency.length > 1 ? "pl-20" : "pl-12"
                      )} 
                      value={productForm.price || ""}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        const markup = price > 0 ? ((price - productForm.cost) / price) * 100 : 0;
                        setProductForm({...productForm, price, markup: parseFloat(markup.toFixed(1))});
                      }}
                    />
                  </div>
                </div>

                <div className="md:col-span-3 bg-zinc-900 rounded-[2.5rem] p-8 md:p-10 flex flex-col gap-6 shadow-2xl relative overflow-hidden group border border-zinc-800">
                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                   <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
                     <div className="space-y-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 truncate">Estimated Unit Profit</p>
                        <p className="text-xl sm:text-2xl md:text-4xl font-black text-emerald-400 tracking-tight truncate leading-none">
                          {currency === 'USD' ? '$' : `${currency} `}{Math.max(0, productForm.price - productForm.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                     </div>
                     <div className="space-y-1 text-right min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 truncate">Gross Margin</p>
                        <p className={cn(
                          "text-xl sm:text-2xl md:text-4xl font-black tracking-tight truncate leading-none transition-colors duration-500",
                          (() => {
                            const m = productForm.price > 0 ? ((productForm.price - productForm.cost) / productForm.price) * 100 : 0;
                            if (m >= 40) return "text-emerald-400";
                            if (m >= 20) return "text-amber-400";
                            return "text-rose-400";
                          })()
                        )}>
                          {productForm.price > 0 ? (((productForm.price - productForm.cost) / productForm.price) * 100).toFixed(1) : "0.0"}%
                        </p>
                     </div>
                   </div>
                   {/* Animated Margin Health Bar */}
                   <div className="relative space-y-2">
                     <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Margin Health</span>
                       <span className={cn(
                         "text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full",
                         (() => {
                           const m = productForm.price > 0 ? ((productForm.price - productForm.cost) / productForm.price) * 100 : 0;
                           if (m >= 40) return "bg-emerald-500/20 text-emerald-400";
                           if (m >= 20) return "bg-amber-500/20 text-amber-400";
                           return "bg-rose-500/20 text-rose-400";
                         })()
                       )}>
                         {(() => {
                           const m = productForm.price > 0 ? ((productForm.price - productForm.cost) / productForm.price) * 100 : 0;
                           if (m >= 40) return "★ Excellent";
                           if (m >= 20) return "⚡ Adequate";
                           return "⚠ Low Margin";
                         })()}
                       </span>
                     </div>
                     <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                       <div
                         className={cn(
                           "h-full rounded-full transition-all duration-700 ease-out",
                           (() => {
                             const m = productForm.price > 0 ? ((productForm.price - productForm.cost) / productForm.price) * 100 : 0;
                             if (m >= 40) return "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]";
                             if (m >= 20) return "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]";
                             return "bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]";
                           })()
                         )}
                         style={{ width: `${Math.min(100, Math.max(2, productForm.price > 0 ? ((productForm.price - productForm.cost) / productForm.price) * 100 : 0))}%` }}
                       />
                     </div>
                     <div className="flex items-center justify-between text-[8px] font-black text-zinc-700 uppercase tracking-wider">
                       <span>0%</span>
                       <span className="text-amber-600">20% Min</span>
                       <span className="text-emerald-600">40% Target</span>
                       <span>100%</span>
                     </div>
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
                           <p className="text-2xl font-black text-zinc-900 leading-none">{(Number(productInsights.velocity) * 7).toFixed(1)} <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{productForm.unit || 'units'} / week</span></p>
                       </div>
                    </div>
                    <div className="p-7 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-3 hover:border-blue-200 transition-colors group">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI Suggested PO</span>
                          <Sparkles className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform" />
                       </div>
                       <div className="flex items-end gap-3 relative">
                         <p className="text-2xl font-black text-zinc-900 leading-none">{productInsights.optimumOrderQty} <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{productForm.unit || 'units'}</span></p>
                         {/* Explainable AI tooltip */}
                         <div className="relative group/tooltip">
                           <button className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                             <Sparkles className="w-2.5 h-2.5" />
                           </button>
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[calc(100vw-4rem)] sm:w-80 p-4 bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-700 text-left opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 scale-95 group-hover/tooltip:scale-100 z-50">
                             <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                               <Sparkles className="w-2.5 h-2.5" /> AI Reasoning
                             </p>
                             <p className="text-[10px] text-zinc-300 leading-relaxed">
                               Observed velocity: <b className="text-white">{productInsights.velocity} {productForm.unit || 'units'}/day</b> over 30 days. With a {productForm.leadTime}-day lead time and safety stock of {productForm.minStock}, system suggests <b className="text-emerald-400">{productInsights.optimumOrderQty} {productForm.unit || 'units'}</b>.
                             </p>
                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45" />
                           </div>
                         </div>
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
                         Lead time is calibrated to <b>{productForm.leadTime} days</b>. Logistics simulation indicates replenishment must trigger when stock hits <b>{Math.ceil(Number(productInsights.velocity) * productForm.leadTime) + productForm.minStock}</b> to ensure continuity.
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
                      <Truck className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> <span className="hidden sm:inline">Purchase Order</span><span className="sm:hidden">P.O.</span>
                  </Button>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <Button 
                   variant="ghost" 
                   className="rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-rose-500 px-8 h-14 transition-colors w-full sm:w-auto"
                   onClick={() => setIsProductSheetOpen(false)}
                >
                  Cancel Changes
                </Button>
                <div className="flex items-center gap-3">
                   <Button 
                    className="rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-black text-[10px] uppercase tracking-widest px-6 sm:px-10 h-14 shadow-xl shadow-zinc-900/20 disabled:opacity-50 flex-1 sm:min-w-[200px]"
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
                <TabsTrigger value="action-center" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">
                  <Zap className="w-3 h-3 mr-2 inline-block text-amber-500" /> Action Center
                </TabsTrigger>
                <TabsTrigger value="movements" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Movements Log</TabsTrigger>
                <TabsTrigger value="purchase-orders" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Procurement</TabsTrigger>
                <TabsTrigger value="stocktakes" className="rounded-xl px-8 py-2 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-zinc-900 text-zinc-500 transition-all">Audit</TabsTrigger>
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
                      className="rounded-[1.25rem] border-zinc-200 text-zinc-600 h-12 px-6 font-black text-[10px] uppercase tracking-widest transition-all bg-white hover:bg-zinc-50 shadow-sm flex items-center gap-2"
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
                      <Download className="w-4 h-4" />
                      Export
                    </Button>

                    <Button 
                      variant="outline" 
                      className="rounded-[1.25rem] border-zinc-200 h-12 px-6 bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                      onClick={() => setIsImportDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Import
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
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Partner</TableHead>
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
                            <TableCell colSpan={8} className="py-24 text-center">
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
                            const expiringBatch = inventoryBatches.find(b => {
                              if (b.product_id !== item.id) return false;
                              const expiryDate = new Date(b.expiry_date);
                              const diffTime = expiryDate.getTime() - new Date().getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return diffDays > 0 && diffDays <= 30;
                            });
                            
                            const status = expiringBatch ? "TACTICAL ALERT" : totalStock === 0 ? "OUT OF STOCK" : totalStock <= (item.min_stock_level || 10) ? "LOW STOCK" : "IN STOCK";

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
                                    status === "LOW STOCK" ? "bg-rose-50 text-rose-600 border-rose-100/50" : 
                                    status === "TACTICAL ALERT" ? "bg-amber-50 text-amber-600 border-amber-100/50 animate-pulse" :
                                    "bg-zinc-50 text-zinc-600 border-zinc-100/50"
                                  )}>
                                    {status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-5">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "w-2 h-2 rounded-full",
                                      item.supplier_id ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" : "bg-zinc-200"
                                    )} />
                                    <span className={cn(
                                      "text-[10px] font-black uppercase tracking-widest",
                                      item.supplier_id ? "text-zinc-900" : "text-zinc-400"
                                    )}>
                                      {suppliers.find(s => s.id === item.supplier_id)?.name || "Unassigned"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right py-5 pr-6">
                                  <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <button className="h-10 w-10 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all flex items-center justify-center outline-none appearance-none">
                                        <MoreHorizontal className="w-5 h-5" />
                                      </button>
                                    }
                                  />
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
            </TabsContent>

            <TabsContent value="action-center" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                      <h3 className="font-black text-zinc-900 tracking-tight text-xl">Operational Deficit Dashboard</h3>
                      <p className="text-xs font-black text-rose-500 uppercase tracking-[0.2em]">Critical Replenishment Required</p>
                    </div>
                  </div>

                  <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white ring-1 ring-zinc-50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50/50 border-b border-zinc-100">
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-6">Asset</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Current</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Threshold</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Partner</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6 text-right">Strategic Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.filter(p => getProductStock(p.id, "all") <= (p.min_stock_level || 10)).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-24 text-center">
                              <div className="flex flex-col items-center gap-4 text-emerald-500/30">
                                <ShieldCheck className="w-16 h-16" />
                                <p className="text-xl font-bold text-zinc-900 opacity-100">All assets secured</p>
                                <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">No critical stockouts detected</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          products
                            .filter(p => getProductStock(p.id, "all") <= (p.min_stock_level || 10))
                            .map((p) => {
                              const stock = getProductStock(p.id, "all");
                              const supplier = suppliers.find(s => s.id === p.supplier_id);
                              return (
                                <TableRow key={p.id} className="hover:bg-rose-50/20 transition-colors border-b border-zinc-50 group/row">
                                  <TableCell className="py-6 pl-6">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0">
                                        <Box className="w-5 h-5 text-zinc-400" />
                                      </div>
                                      <span className="font-black text-zinc-900 text-xs uppercase tracking-tight">{p.name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-6">
                                    <span className="font-black text-rose-600 text-sm">{stock}</span>
                                  </TableCell>
                                  <TableCell className="py-6 font-bold text-zinc-400 text-xs">{p.min_stock_level || 10}</TableCell>
                                  <TableCell className="py-6 font-bold text-zinc-900 text-[10px] uppercase tracking-wider">{supplier?.name || "Unassigned"}</TableCell>
                                  <TableCell className="py-6 pr-6 text-right">
                                    <Button 
                                      className="h-9 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest px-5 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                                      onClick={() => {
                                        const reorderQty = (p.max_stock_level || 100) - stock;
                                        setPoForm({
                                          supplier_id: p.supplier_id || '',
                                          items: [{ product_id: p.id, qty: reorderQty, cost: p.cost || p.retail_price || p.price || 0 }],
                                          status: 'DRAFT',
                                          total_cost: reorderQty * (p.cost || p.retail_price || p.price || 0),
                                          notes: `Auto-generated replenishment for ${p.name}`
                                        });
                                        setSelectedPO(null);
                                        setIsPurchaseOrderOpen(true);
                                      }}
                                    >
                                      1-Click Reorder
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                      <h3 className="font-black text-zinc-900 tracking-tight text-xl">Expiration Monitor</h3>
                      <p className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">Batch Lifecycle Alerts</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {inventoryBatches
                      .filter(b => {
                        const expiryDate = new Date(b.expiry_date);
                        const diffTime = expiryDate.getTime() - new Date().getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 30;
                      })
                      .length === 0 ? (
                      <Card className="p-12 border-zinc-100 shadow-lg bg-white border-dashed border-2 text-center">
                        <CalendarCheck className="w-12 h-12 mx-auto text-zinc-200 mb-4" />
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest leading-relaxed">No batches expiring within <br/>the 30-day tactical window.</p>
                      </Card>
                    ) : (
                      inventoryBatches
                        .filter(b => {
                          const expiryDate = new Date(b.expiry_date);
                          const diffTime = expiryDate.getTime() - new Date().getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays <= 30;
                        })
                        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                        .map((b) => {
                          const product = products.find(p => p.id === b.product_id);
                          const expiryDate = new Date(b.expiry_date);
                          const diffTime = expiryDate.getTime() - new Date().getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          
                          return (
                            <Card key={b.id} className="p-5 border-zinc-100 shadow-xl bg-white group hover:border-amber-200 transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                  </div>
                                  <div>
                                    <p className="font-black text-zinc-900 text-xs uppercase tracking-tight">{product?.name || "Unknown Asset"}</p>
                                    <p className="text-[10px] font-mono font-bold text-zinc-400">BATCH: {b.batch_number}</p>
                                  </div>
                                </div>
                                <Badge className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                                  diffDays <= 7 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                )}>
                                  {diffDays <= 0 ? "EXPIRED" : `${diffDays} DAYS LEFT`}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Units: {b.quantity}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 rounded-lg text-zinc-900 font-black text-[9px] uppercase tracking-widest hover:bg-zinc-100"
                                  onClick={() => handleLiquidateBatch(b)}
                                >
                                  Liquidate Batch
                                </Button>
                              </div>
                            </Card>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
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
                                <DropdownMenuTrigger 
                                  render={
                                    <button className={cn(
                                      "outline-none flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer hover:opacity-80 transition-all shadow-sm appearance-none",
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
                                    </button>
                                  }
                                />
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

            <TabsContent value="suppliers" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-2">
                 <div className="space-y-1">
                    <h3 className="font-black text-zinc-900 tracking-tight text-xl">Partner Ecosystem</h3>
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Global Sourcing Network</p>
                 </div>
                 <Button className="rounded-2xl bg-zinc-900 text-white h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-all" onClick={() => {
                   setSelectedSupplier(null);
                   setNewSupplier({ name: '', contact: '', email: '', phone: '', status: 'ACTIVE' });
                   setIsSupplierDialogOpen(true);
                 }}>
                    <Plus className="w-4 h-4 mr-2" /> Strategic Partner
                 </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-900 border border-zinc-100">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Strategic Partners</p>
                      <p className="text-2xl text-zinc-900 font-black">{suppliers.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Active Cycles</p>
                      <p className="text-2xl text-zinc-900 font-black">
                        {purchaseOrders.filter(po => po.status === 'SENT' || po.status === 'PENDING').length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Capital Commitment</p>
                      <p className="text-2xl text-zinc-900 font-black">
                        {formatCurrency(purchaseOrders.reduce((sum, po) => sum + (po.total_cost || 0), 0))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

               <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white ring-1 ring-zinc-50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-6">Vendor identity</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Key Correspondent</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Throughput</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Operational Status</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-32 text-zinc-400">
                           <div className="flex flex-col items-center gap-6">
                              <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                                <Users className="w-10 h-10 opacity-20" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xl font-bold text-zinc-900 uppercase tracking-tighter">Vendor directory idle</p>
                                <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Onboard your first partner to begin procurement</p>
                              </div>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((s) => {
                        const partnerPOs = purchaseOrders.filter(po => po.supplier_id === s.id);
                        const totalSpend = partnerPOs.reduce((sum, po) => sum + (po.total_cost || 0), 0);
                        const linkedProductsCount = products.filter(p => p.supplier_id === s.id).length;
                        
                        return (
                          <TableRow key={s.id} className="hover:bg-zinc-50/30 transition-all border-b border-zinc-50 group/row">
                            <TableCell className="py-6 pl-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-zinc-400 group-hover/row:bg-white group-hover/row:border-zinc-200 transition-all">
                                  {s.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-black text-zinc-900 text-sm tracking-tight uppercase">{s.name}</p>
                                  <p className="text-[10px] font-bold text-zinc-400 tracking-widest">{s.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-6">
                              <div>
                                <p className="text-sm font-bold text-zinc-700">{s.contact}</p>
                                <p className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider">{s.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-6">
                              <div>
                                <p className="text-sm font-black text-zinc-900">{formatCurrency(totalSpend)}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{partnerPOs.length} Total Orders • {linkedProductsCount} Assets</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-6">
                              <Badge className={cn(
                                "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border shadow-sm",
                                s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : 
                                s.status === "PROBATION" ? "bg-amber-50 text-amber-600 border-amber-100/50" :
                                "bg-zinc-50 text-zinc-600 border-zinc-200"
                              )}>
                                {s.status || "OPERATIONAL"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-6 pr-6 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger 
                                  render={
                                    <button className="h-10 w-10 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all flex items-center justify-center outline-none appearance-none">
                                      <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                  }
                                />
                                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-zinc-200 shadow-2xl p-2 bg-white ring-1 ring-zinc-50">
                                  <DropdownMenuItem 
                                    className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-xs uppercase"
                                    onClick={() => {
                                      setSelectedSupplier(s);
                                      setNewSupplier({
                                        name: s.name,
                                        contact: s.contact,
                                        email: s.email,
                                        phone: s.phone,
                                        status: s.status || 'ACTIVE'
                                      });
                                      setIsSupplierDialogOpen(true);
                                    }}
                                  >
                                    <Box className="w-4 h-4 text-zinc-400" /> Edit Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-xs uppercase">
                                    <BarChart3 className="w-4 h-4 text-zinc-400" /> Deep Analytics
                                  </DropdownMenuItem>
                                  <div className="h-px bg-zinc-100 my-1" />
                                  <DropdownMenuItem 
                                    className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-xs uppercase"
                                    onClick={() => handleDeleteSupplier(s.id)}
                                  >
                                    <Trash2 className="w-4 h-4" /> Decommission
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
              </Card>
            </TabsContent>

            <TabsContent value="purchase-orders" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-2">
                 <div className="space-y-1">
                    <h3 className="font-black text-zinc-900 tracking-tight text-xl">Procurement Pipeline</h3>
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Global Asset Acquisition</p>
                 </div>
                 <Button className="rounded-2xl bg-zinc-900 text-white h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-all" onClick={() => {
                   setPoForm({ supplier_id: '', items: [], status: 'DRAFT', total_cost: 0, notes: '' });
                   setSelectedPO(null);
                   setIsPurchaseOrderOpen(true);
                 }}>
                    <Plus className="w-4 h-4 mr-2" /> New Acquisition
                 </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-900 border border-zinc-100">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Active Commitment</p>
                      <p className="text-2xl text-zinc-900 font-black">
                        {formatCurrency(purchaseOrders.filter(po => po.status !== 'RECEIVED' && po.status !== 'CANCELLED').reduce((sum, po) => sum + (po.total_cost || 0), 0))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Assets In-Flight</p>
                      <p className="text-2xl text-zinc-900 font-black">
                        {purchaseOrders.filter(po => po.status === 'SENT' || po.status === 'PENDING').reduce((sum, po) => sum + (po.items?.length || 0), 0)} Units
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Capital Throughput</p>
                      <p className="text-2xl text-zinc-900 font-black">
                        {formatCurrency(purchaseOrders.filter(po => po.status === 'RECEIVED').reduce((sum, po) => sum + (po.total_cost || 0), 0))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

               <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white ring-1 ring-zinc-50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-6">Order signature</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Strategic Partner</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Commitment</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Lifecycle State</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-32 text-zinc-400">
                           <div className="flex flex-col items-center gap-6">
                              <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                                <Box className="w-10 h-10 opacity-20" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xl font-bold text-zinc-900 uppercase tracking-tighter">Procurement queue idle</p>
                                <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Initialize your first acquisition cycle</p>
                              </div>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((po) => (
                        <TableRow key={po.id} className="hover:bg-zinc-50/30 transition-all border-b border-zinc-50 group/row">
                          <TableCell className="py-6 pl-6">
                            <div>
                              <p className="font-mono text-[10px] font-black text-zinc-400">#{po.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase">{new Date(po.created_at).toLocaleDateString()}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center font-black text-[10px] text-zinc-400">
                                {suppliers.find(s => s.id === po.supplier_id)?.name.substring(0, 2).toUpperCase() || "??"}
                              </div>
                              <span className="font-black text-zinc-900 text-sm tracking-tight uppercase">
                                {suppliers.find(s => s.id === po.supplier_id)?.name || "Unknown Partner"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="space-y-1">
                              <p className="text-sm font-black text-zinc-900">{formatCurrency(po.total_cost || 0)}</p>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{po.items?.length || 0} Assets</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border shadow-sm",
                              po.status === "RECEIVED" ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : 
                              po.status === "SENT" ? "bg-blue-50 text-blue-600 border-blue-100/50" :
                              po.status === "DRAFT" ? "bg-zinc-50 text-zinc-400 border-zinc-200" :
                              "bg-amber-50 text-amber-600 border-amber-100/50"
                            )}>
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-6 pr-6 text-right">
                             <div className="flex items-center justify-end gap-2">
                               {po.status === "DRAFT" && (
                                 <Button 
                                   size="sm" 
                                   className="h-9 rounded-xl bg-zinc-900 text-white font-black text-[9px] uppercase tracking-widest px-4 hover:scale-[1.05] transition-all"
                                   onClick={() => handleUpdatePOStatus(po.id, 'SENT')}
                                 >
                                   Mark Sent
                                 </Button>
                               )}
                               {po.status === "SENT" && (
                                 <Button 
                                   size="sm" 
                                   className="h-9 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest px-4 hover:scale-[1.05] transition-all"
                                   onClick={() => handleReceivePO(po)}
                                 >
                                   Receive Assets
                                 </Button>
                               )}
                               <DropdownMenu>
                                 <DropdownMenuTrigger 
                                   render={
                                     <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100")}>
                                       <MoreHorizontal className="w-4 h-4" />
                                     </button>
                                   }
                                 />
                                 <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 bg-white shadow-2xl border-zinc-100">
                                   <DropdownMenuItem className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-zinc-50 font-bold text-[10px] uppercase">
                                     <FileText className="w-4 h-4 text-zinc-400" /> View Order
                                   </DropdownMenuItem>
                                   {po.status === 'DRAFT' && (
                                     <DropdownMenuItem 
                                       className="flex items-center gap-3 py-3 px-4 cursor-pointer rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-[10px] uppercase"
                                       onClick={() => handleDeletePO(po.id)}
                                     >
                                       <Trash2 className="w-4 h-4" /> Purge Draft
                                     </DropdownMenuItem>
                                   )}
                                 </DropdownMenuContent>
                               </DropdownMenu>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="stocktakes" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-2">
                 <div className="space-y-1">
                    <h3 className="font-black text-zinc-900 tracking-tight text-xl md:text-2xl">Inventory Audits</h3>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Reconciliation & Shrinkage Control</p>
                 </div>
                 <Button className="w-full sm:w-auto rounded-2xl bg-zinc-900 text-white h-12 sm:h-14 px-8 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-all" onClick={() => {
                    setStocktakeForm({ branch_id: activeBranch === 'all' ? (branches[0]?.id || '') : activeBranch, items: [], status: 'IN_PROGRESS', notes: '' });
                    setIsStocktakeDialogOpen(true);
                 }}>
                    <Plus className="w-4 h-4 mr-2" /> Start Audit
                 </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-5 sm:p-6 flex items-center gap-4">
                    <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-900 border border-zinc-100 shrink-0">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Accuracy Rate</p>
                      <p className="text-xl sm:text-2xl text-zinc-900 font-black">
                        {stocktakes.length > 0 
                          ? `${Math.round((stocktakes.filter(st => st.status === 'COMPLETED' && st.items.every((i: any) => i.variance === 0)).length / stocktakes.length) * 100)}%`
                          : '100%'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm">
                  <CardContent className="p-5 sm:p-6 flex items-center gap-4">
                    <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5">Capital Leakage</p>
                      <p className="text-xl sm:text-2xl text-zinc-900 font-black">
                        {formatCurrency(stocktakes.reduce((sum, st) => {
                          const leakage = st.items?.filter((i: any) => i.variance < 0).reduce((s: number, i: any) => {
                            const prod = products.find(p => p.id === i.product_id);
                            return s + (Math.abs(i.variance) * (prod?.cost || 0));
                          }, 0) || 0;
                          return sum + leakage;
                        }, 0))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-modern border-zinc-100 bg-white shadow-sm sm:col-span-2 lg:col-span-1">
                  <CardContent className="p-5 sm:p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Operational Pulse</p>
                      <p className="text-xl sm:text-2xl text-zinc-900 font-black">
                        {stocktakes.length > 0 
                          ? `${Math.floor((new Date().getTime() - new Date(stocktakes[0].created_at).getTime()) / (1000 * 60 * 60 * 24))} Days`
                          : 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

               <Card className="card-modern overflow-hidden border-zinc-200/60 shadow-xl bg-white ring-1 ring-zinc-50">
                <div className="overflow-x-auto no-scrollbar">
                  <Table className="min-w-[800px] lg:min-w-0">
                    <TableHeader>
                      <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pl-6">Audit signature</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Branch Node</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Temporal Stamp</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Asset Scope</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6">Lifecycle Status</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-zinc-500 py-6 pr-6 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {stocktakes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-32 text-zinc-400">
                           <div className="flex flex-col items-center gap-6">
                              <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                                <CalendarCheck className="w-10 h-10 opacity-20" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xl font-bold text-zinc-900 uppercase tracking-tighter">Audit history clear</p>
                                <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Initialize your first stocktake to ensure data integrity</p>
                              </div>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stocktakes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((st) => (
                        <TableRow key={st.id} className="hover:bg-zinc-50/30 transition-all border-b border-zinc-50 group/row">
                          <TableCell className="py-6 pl-6 font-mono text-[10px] font-black text-zinc-400">
                            #{st.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="font-black text-zinc-900 text-xs tracking-tight uppercase">
                                {branches.find(b => b.id === st.branch_id)?.name || "Primary Branch"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-6 text-xs font-bold text-zinc-600">
                            {new Date(st.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="space-y-1">
                              <p className="text-xs font-black text-zinc-900">{st.items?.length || 0} Assets</p>
                              <div className="flex gap-2">
                                <span className="text-[9px] font-black text-rose-500 uppercase">-{st.items?.filter((i: any) => i.variance < 0).length || 0} Shrink</span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase">+{st.items?.filter((i: any) => i.variance > 0).length || 0} Discovery</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border shadow-sm",
                              st.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : 
                              "bg-amber-50 text-amber-600 border-amber-100/50 animate-pulse"
                            )}>
                              {st.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-6 pr-6 text-right">
                             {st.status !== "COMPLETED" ? (
                               <Button 
                                 size="sm" 
                                 className="h-10 rounded-xl bg-zinc-900 text-white font-black text-[9px] uppercase tracking-widest px-6 shadow-lg shadow-zinc-900/10 hover:scale-[1.05] transition-all"
                                 onClick={() => handleApplyStocktake(st)}
                               >
                                 Recalibrate System
                               </Button>
                             ) : (
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="h-10 rounded-xl font-black text-[9px] uppercase tracking-widest px-6 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
                               >
                                 Download Audit
                               </Button>
                             )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table></div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
    </ScrollArea>

      {/* Transfer Stock Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-zinc-200 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-zinc-900 tracking-tight">Strategic Transfer</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium">
              Redistributing assets across the logistical network.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Asset Selection</label>
              <Select 
                value={transferData.product_id} 
                onValueChange={(val) => setTransferData({...transferData, product_id: val})}
              >
                <SelectTrigger className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold">
                  <SelectValue placeholder="Select Asset">
                    {products.find(p => p.id === transferData.product_id)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white">
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Source Node</label>
                <Select 
                  value={transferData.from_branch_id} 
                  onValueChange={(val) => setTransferData({...transferData, from_branch_id: val})}
                >
                  <SelectTrigger className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold">
                    <SelectValue placeholder="From">
                      {branches.find(b => b.id === transferData.from_branch_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="font-bold">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Destination Node</label>
                <Select 
                  value={transferData.to_branch_id} 
                  onValueChange={(val) => setTransferData({...transferData, to_branch_id: val})}
                >
                  <SelectTrigger className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold">
                    <SelectValue placeholder="To">
                      {branches.find(b => b.id === transferData.to_branch_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="font-bold">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Transfer Depth (Qty)</label>
              <div className="relative">
                <Input 
                  type="number" 
                  min="1"
                  className="h-14 rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 transition-all font-black pl-4"
                  value={transferData.qty}
                  onChange={(e) => setTransferData({...transferData, qty: parseInt(e.target.value) || 0})}
                />
                {transferData.product_id && transferData.from_branch_id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Badge variant="outline" className="bg-zinc-50 font-black text-[9px] uppercase tracking-widest border-zinc-200">
                      Max: {getProductStock(transferData.product_id, transferData.from_branch_id)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-3">
            <Button variant="ghost" className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-12 px-6" onClick={() => setIsTransferDialogOpen(false)}>Abort Mission</Button>
            <Button 
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20" 
              onClick={handleTransferStock}
            >
              Initiate Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="suppliers" className="mt-0 space-y-6">
                <Card className="card-modern shadow-xl border-zinc-100/60 p-8 bg-white rounded-[2rem]">
                   <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-500" /> Sourcing Reliability Index
                  </h3>
                  <div className="h-80 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                    )}
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
                     <p className="text-sm font-black text-emerald-400 tracking-tighter">{currency === 'USD' ? '$' : `${currency} `}{productForm.price || "0.00"}</p>
                  </div>
               </motion.div>
            </div>

            {(cameraError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black z-50 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <XIcon className="w-8 h-8 text-rose-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black uppercase tracking-widest text-white">Camera Unavailable</p>
                  <p className="text-xs text-zinc-500 font-medium">Permission denied or hardware not detected.</p>
                </div>
                <Button
                  className="rounded-2xl bg-white text-zinc-900 font-black text-[10px] uppercase tracking-widest px-8 h-12 hover:scale-[1.02] transition-all"
                  onClick={() => setIsCameraOpen(false)}
                >
                  Use Manual Entry
                </Button>
              </div>
            )}
            {(!hasCameraAccess && !cameraError) && (
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

    {selectedProducts.length > 0 && (
      <div className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[90%] sm:w-auto animate-in fade-in slide-in-from-bottom-6 duration-500">
        <div className="bg-zinc-950 text-white rounded-3xl sm:rounded-[2.5rem] px-4 py-3 sm:px-8 sm:py-5 shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-8 border border-white/10 ring-4 sm:ring-8 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[10px] sm:text-xs flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
              {selectedProducts.length}
            </div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-zinc-500">Asset Selection</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-zinc-800" />
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none h-10 text-blue-500 hover:text-white hover:bg-blue-600 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-xl px-4 sm:px-6 transition-all gap-2"
              onClick={() => setIsLinkSupplierDialogOpen(true)}
            >
              <Link2 className="w-4 h-4" />
              Link Partner
            </Button>
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none h-10 text-rose-500 hover:text-white hover:bg-rose-600 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-xl px-4 sm:px-6 transition-all"
              disabled={isBatchDeleting}
              onClick={handleBatchDelete}
            >
              {isBatchDeleting ? "Purging..." : "Decommission"}
            </Button>
            <Button 
              className="flex-1 sm:flex-none h-10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-xl px-3 sm:px-4 transition-all"
              onClick={() => setSelectedProducts([])}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )}

    {selectedMovements.length > 0 && (
      <div className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[90%] sm:w-auto animate-in fade-in slide-in-from-bottom-6 duration-500">
        <div className="bg-zinc-950 text-white rounded-3xl sm:rounded-[2.5rem] px-4 py-3 sm:px-8 sm:py-5 shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-8 border border-white/10 ring-4 sm:ring-8 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[10px] sm:text-xs flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
              {selectedMovements.length}
            </div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-zinc-500">Logs Selection</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-zinc-800" />
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none h-10 text-rose-500 hover:text-white hover:bg-rose-600 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-xl px-4 sm:px-6 transition-all"
              disabled={isBatchDeletingMovements}
              onClick={handleBatchDeleteMovements}
            >
              {isBatchDeletingMovements ? "Purging..." : "Purge Selection"}
            </Button>
            <Button 
              className="flex-1 sm:flex-none h-10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-xl px-3 sm:px-4 transition-all"
              onClick={() => setSelectedMovements([])}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )}

    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-zinc-100 p-8">
        <DialogHeader>
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl shadow-black/10">
            <Layers className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-black font-display tracking-tight">Strategic Database Import</DialogTitle>
          <DialogDescription className="text-zinc-500 font-medium leading-relaxed">
            Upload your inventory CSV file to batch onboard assets. Ensure columns for <span className="text-zinc-900 font-bold">Name</span> and <span className="text-zinc-900 font-bold">SKU</span> are present.
          </DialogDescription>
        </DialogHeader>

        <div className="py-8">
          <div className="border-2 border-dashed border-zinc-100 rounded-[2rem] p-10 text-center hover:border-blue-500/30 hover:bg-blue-50/50 transition-all group relative cursor-pointer">
            <input 
              type="file" 
              accept=".csv,.tsv,.xlsx,.xls,.ods,.json" 
              onChange={handleImportCSV}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                <Plus className="w-8 h-8 text-zinc-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">Select Database Source</p>
              <p className="text-xs text-zinc-400 mt-2">CSV · TSV · XLSX · XLS · ODS · JSON — 50MB max</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3">
          <Button 
            type="button"
            variant="ghost" 
            className="w-full rounded-xl font-bold text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-900"
            onClick={() => setIsImportDialogOpen(false)}
          >
            Cancel Mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isLinkSupplierDialogOpen} onOpenChange={setIsLinkSupplierDialogOpen}>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tight font-display">Partner Linkage</DialogTitle>
            <DialogDescription className="text-blue-100 font-medium">
              Mapping {selectedProducts.length} assets to a strategic supplier.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Select Strategic Partner</label>
            <Select 
              value={selectedSupplierForBatch} 
              onValueChange={setSelectedSupplierForBatch}
            >
              <SelectTrigger className="rounded-2xl h-14 bg-zinc-50 border-zinc-100 font-bold">
                <SelectValue placeholder="Select Supplier...">
                  {suppliers.find(s => s.id === selectedSupplierForBatch)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white border-zinc-200">
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            className="rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest text-zinc-500"
            onClick={() => setIsLinkSupplierDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            className="rounded-2xl h-14 px-10 bg-blue-600 text-white hover:bg-blue-700 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20"
            disabled={isBatchLinking || !selectedSupplierForBatch}
            onClick={handleBatchLinkSupplier}
          >
            {isBatchLinking ? "Linking..." : "Establish Linkage"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isPurchaseOrderOpen} onOpenChange={setIsPurchaseOrderOpen}>
      <DialogContent className="w-[95vw] sm:max-w-3xl rounded-[1.5rem] sm:rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-zinc-950 p-6 sm:p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight font-display">Strategic Acquisition</DialogTitle>
            <DialogDescription className="text-zinc-400 font-medium text-xs sm:text-sm">
              Initialize a new procurement cycle with a strategic partner.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <ScrollArea className="max-h-[80vh] sm:max-h-[70vh]">
          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Strategic Partner</label>
                  <Info className="w-2.5 h-2.5 text-zinc-300" title="Select the supplier or vendor providing these assets. Links to the Suppliers registry." />
                </div>
                <Select 
                  value={poForm.supplier_id} 
                  onValueChange={(val) => setPoForm({...poForm, supplier_id: val})}
                >
                  <SelectTrigger className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-bold">
                    <SelectValue placeholder="Select Partner">
                      {suppliers.find(s => s.id === poForm.supplier_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white border-zinc-200">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id} className="uppercase font-bold">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Commitment Notes</label>
                  <Info className="w-2.5 h-2.5 text-zinc-300" title="Optional details regarding shipping terms, logistics, or specific contractual agreements for this acquisition." />
                </div>
                <Input 
                  placeholder="Terms, logistics..." 
                  className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-medium"
                  value={poForm.notes}
                  onChange={(e) => setPoForm({...poForm, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Asset Selection</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-xl h-8 text-blue-600 font-black text-[9px] uppercase tracking-widest"
                  onClick={() => {
                    const firstProd = products[0];
                    if (firstProd) {
                      setPoForm({
                        ...poForm,
                        items: [...poForm.items, { 
                          product_id: firstProd.id, 
                          qty: 1, 
                          cost: firstProd.cost || firstProd.retail_price || firstProd.price || 0 
                        }]
                      });
                    }
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Asset Line
                </Button>
              </div>

              <div className="space-y-3">
                {/* Header Row for Asset Selection */}
                {poForm.items.length > 0 && (
                  <div className="hidden md:flex items-center gap-4 px-4 py-1">
                    <div className="flex-1 flex items-center gap-1.5">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Asset</label>
                      <Info className="w-2.5 h-2.5 text-zinc-300" title="The physical inventory item being acquired from the strategic partner." />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 flex items-center gap-1.5">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Quantity</label>
                        <Info className="w-2.5 h-2.5 text-zinc-300" title="The total number of units for this specific asset line." />
                      </div>
                      <div className="w-32 flex items-center gap-1.5">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Unit Cost</label>
                        <Info className="w-2.5 h-2.5 text-zinc-300" title="The acquisition price per unit. Used for ledger and margin calculations." />
                      </div>
                      <div className="w-40 flex items-center gap-1.5 justify-end pr-4">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Line Total</label>
                        <Info className="w-2.5 h-2.5 text-zinc-300" title="Quantity multiplied by Unit Cost. Represents the total liability for this line." />
                      </div>
                      <div className="w-10" /> {/* Spacer for delete button */}
                    </div>
                  </div>
                )}
                
                {poForm.items.map((item: any, index: number) => (
                  <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1 w-full">
                      <div className="md:hidden flex items-center gap-1.5 mb-1">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Asset</label>
                        <Info className="w-2 h-2 text-zinc-300" title="The physical inventory item being acquired." />
                      </div>
                      <Select 
                        value={item.product_id}
                        onValueChange={(val) => {
                          const p = products.find(prod => prod.id === val);
                          const newItems = [...poForm.items];
                          newItems[index] = { 
                            ...item, 
                            product_id: val, 
                            cost: p?.cost || p?.retail_price || p?.price || 0 
                          };
                          setPoForm({ ...poForm, items: newItems });
                        }}
                      >
                        <SelectTrigger className="rounded-xl h-10 bg-white border-zinc-100 font-bold text-xs">
                          <SelectValue placeholder="Select Asset">
                            {products.find(p => p.id === item.product_id)?.name || "Select Asset"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-white border-zinc-200">
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id} className="uppercase font-bold text-[10px]">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="flex-1 md:w-24">
                        <div className="md:hidden flex items-center gap-1.5 mb-1">
                          <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Quantity</label>
                          <Info className="w-2 h-2 text-zinc-300" title="The total number of units to be added to inventory upon arrival." />
                        </div>
                        <Input 
                          type="number"
                          placeholder="Qty"
                          className="rounded-xl h-10 bg-white border-zinc-100 font-bold text-xs"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[index] = { ...item, qty: parseInt(e.target.value) || 0 };
                            setPoForm({ ...poForm, items: newItems });
                          }}
                        />
                      </div>
                      <div className="flex-1 md:w-32">
                        <div className="md:hidden flex items-center gap-1.5 mb-1">
                          <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Unit Cost</label>
                          <Info className="w-2 h-2 text-zinc-300" title="The price paid per individual unit. This will update the asset's average cost." />
                        </div>
                        <div className="relative group/cost">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-400 group-focus-within/cost:text-blue-500 transition-colors uppercase">{currency === 'USD' ? '$' : currency}</span>
                          <Input 
                            type="number"
                            placeholder="Unit Cost"
                            className="rounded-xl h-10 bg-white border-zinc-100 font-bold text-xs pl-10"
                            value={item.cost}
                            onChange={(e) => {
                              const newItems = [...poForm.items];
                              newItems[index] = { ...item, cost: parseFloat(e.target.value) || 0 };
                              setPoForm({ ...poForm, items: newItems });
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex-1 md:w-40">
                        <div className="md:hidden flex items-center gap-1.5 mb-1">
                          <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Line Total</label>
                          <Info className="w-2 h-2 text-zinc-300" title="Total investment for this specific item (Quantity x Unit Cost)." />
                        </div>
                        <div className="h-10 px-4 rounded-xl bg-blue-50/30 border border-blue-100/50 flex items-center justify-end font-black text-xs text-blue-600">
                          {formatCurrency((item.cost || 0) * (item.qty || 0))}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50"
                        onClick={() => {
                          const newItems = poForm.items.filter((_: any, i: number) => i !== index);
                          setPoForm({ ...poForm, items: newItems });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {poForm.items.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-zinc-100 rounded-[2rem]">
                    <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">Deployment queue empty</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Commitment</p>
            <p className="text-2xl font-black text-zinc-900">
              {formatCurrency(poForm.items.reduce((sum: number, item: any) => sum + (item.cost * item.qty), 0))}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none rounded-2xl h-12 sm:h-14 px-6 sm:px-8 font-black text-[10px] uppercase tracking-widest"
              onClick={() => setIsPurchaseOrderOpen(false)}
            >
              Cancel Mission
            </Button>
            <Button 
              className="flex-1 md:flex-none rounded-2xl h-14 px-10 bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/20 hover:scale-[1.02] transition-all"
              disabled={isSavingPO}
              onClick={() => handleSavePO('SENT')}
            >
              {isSavingPO ? "Deploying..." : "Initialize Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isReceiveDialogOpen} onOpenChange={setIsReceiveDialogOpen}>
      <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-emerald-600 p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tight font-display text-white text-3xl">Logistical Reception</DialogTitle>
            <DialogDescription className="text-emerald-100 font-medium">
              Verifying and logging physical asset entry into the command system.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-8 space-y-6">
            {poToReceive?.items.map((item: any, index: number) => {
              const product = products.find(p => p.id === item.product_id);
              return (
                <div key={index} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center font-black text-xs text-zinc-400">
                        {index + 1}
                      </div>
                      <span className="font-black text-zinc-900 text-sm uppercase">{product?.name}</span>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100/50 font-black text-[10px] px-3">
                      {item.qty} UNITS
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Batch Number</label>
                      <Input 
                        placeholder="Manual override..."
                        className="rounded-xl h-11 bg-white border-zinc-200 font-bold"
                        value={receivingBatchInfo[index]?.batch}
                        onChange={(e) => setReceivingBatchInfo({
                          ...receivingBatchInfo,
                          [index]: { ...receivingBatchInfo[index], batch: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Expiry Date</label>
                      <Input 
                        type="date"
                        className="rounded-xl h-11 bg-white border-zinc-200 font-bold"
                        value={receivingBatchInfo[index]?.expiry}
                        onChange={(e) => setReceivingBatchInfo({
                          ...receivingBatchInfo,
                          [index]: { ...receivingBatchInfo[index], expiry: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            className="rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest text-zinc-500"
            onClick={() => setIsReceiveDialogOpen(false)}
          >
            Suspend Entry
          </Button>
          <Button 
            className="rounded-2xl h-14 px-10 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all"
            onClick={finalizeReception}
          >
            Deploy Assets & Finalize
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
      <DialogContent className="w-[95vw] sm:max-w-xl rounded-[1.5rem] sm:rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-zinc-900 p-6 sm:p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight font-display">Partner Onboarding</DialogTitle>
            <DialogDescription className="text-zinc-400 font-medium text-xs sm:text-sm">
              Initialize a new strategic supply chain node.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Vendor Identity</label>
            <Input 
              placeholder="Strategic Partner Name..." 
              className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-black uppercase"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Key Correspondent</label>
              <Input 
                placeholder="Name..." 
                className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-bold"
                value={newSupplier.contact}
                onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Secure Email</label>
              <Input 
                type="email"
                placeholder="partner@source.com" 
                className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-bold"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Operational Phone</label>
              <Input 
                placeholder="+1..." 
                className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-mono font-bold"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lifecycle State</label>
              <Select 
                value={newSupplier.status} 
                onValueChange={(val) => setNewSupplier({...newSupplier, status: val})}
              >
                <SelectTrigger className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white border-zinc-200">
                  <SelectItem value="ACTIVE" className="font-bold">ACTIVE PROTOCOL</SelectItem>
                  <SelectItem value="INACTIVE" className="font-bold">SUSPENDED</SelectItem>
                  <SelectItem value="PROBATION" className="font-bold">PROBATIONARY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            className="w-full sm:w-auto rounded-2xl h-12 sm:h-14 px-8 font-black text-[10px] uppercase tracking-widest text-zinc-500"
            onClick={() => setIsSupplierDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            className="w-full sm:w-auto rounded-2xl h-12 sm:h-14 px-10 bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-all"
            disabled={isSavingSupplier}
            onClick={handleAddSupplier}
          >
            {isSavingSupplier ? "Synchronizing..." : "Onboard Partner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isStocktakeDialogOpen} onOpenChange={setIsStocktakeDialogOpen}>
      <DialogContent className="w-[95vw] sm:max-w-4xl rounded-[1.5rem] sm:rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-blue-600 p-6 sm:p-10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight font-display text-white">Operational Audit</DialogTitle>
            <DialogDescription className="text-blue-100 font-medium text-xs sm:text-sm md:text-base mt-2">
              Verifying physical asset presence against digital state.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[80vh] sm:max-h-[70vh]">
          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="space-y-2 flex-1 w-full">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Branch Node</label>
                <Select 
                  value={stocktakeForm.branch_id} 
                  onValueChange={(val) => {
                    const branchProducts = products.map(p => ({
                      product_id: p.id,
                      name: p.name,
                      expected: getProductStock(p.id, val),
                      counted: getProductStock(p.id, val),
                      variance: 0
                    }));
                    setStocktakeForm({ ...stocktakeForm, branch_id: val, items: branchProducts });
                  }}
                >
                  <SelectTrigger className="rounded-2xl h-12 sm:h-14 bg-zinc-50 border-zinc-100 font-bold">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white border-zinc-200">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="uppercase font-bold">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full sm:w-auto sm:mt-6 h-12 sm:h-14 rounded-2xl bg-white border border-zinc-100 text-zinc-900 font-black text-[10px] uppercase tracking-widest shadow-sm"
                variant="outline"
                onClick={() => {
                  const branchProducts = products.map(p => ({
                    product_id: p.id,
                    name: p.name,
                    expected: getProductStock(p.id, stocktakeForm.branch_id),
                    counted: getProductStock(p.id, stocktakeForm.branch_id),
                    variance: 0
                  }));
                  setStocktakeForm({ ...stocktakeForm, items: branchProducts });
                }}
              >
                Reset Counts
              </Button>
            </div>

            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-12 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                <div className="col-span-6">Asset Specification</div>
                <div className="col-span-2 text-center">System</div>
                <div className="col-span-2 text-center">Counted</div>
                <div className="col-span-2 text-right">Variance</div>
              </div>

              <div className="space-y-3">
                {stocktakeForm.items.map((item: any, index: number) => (
                  <div key={item.product_id} className="flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center gap-4 p-4 sm:p-6 bg-zinc-50 rounded-[1.5rem] sm:rounded-2xl border border-zinc-100 group/audit">
                    <div className="w-full lg:col-span-6 flex items-center gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center font-black text-xs text-zinc-400">
                        {index + 1}
                      </div>
                      <span className="font-black text-zinc-900 text-sm uppercase break-words line-clamp-2">{item.name}</span>
                    </div>
                    
                    <div className="w-full lg:col-span-6 grid grid-cols-3 sm:grid-cols-6 items-center gap-4">
                      <div className="sm:col-span-2 text-center sm:text-left">
                        <span className="block sm:hidden text-[8px] font-black text-zinc-400 uppercase mb-1">System</span>
                        <span className="font-mono font-bold text-zinc-400">{item.expected}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block sm:hidden text-[8px] font-black text-zinc-400 uppercase mb-1">Counted</span>
                        <Input 
                          type="number"
                          className="h-10 rounded-xl bg-white border-zinc-100 font-black text-center text-sm"
                          value={item.counted}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const newItems = [...stocktakeForm.items];
                            newItems[index] = { ...item, counted: val, variance: val - item.expected };
                            setStocktakeForm({ ...stocktakeForm, items: newItems });
                          }}
                        />
                      </div>
                      <div className={cn(
                        "sm:col-span-2 text-right font-black text-sm",
                        item.variance === 0 ? "text-zinc-400" : item.variance > 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        <span className="block sm:hidden text-[8px] font-black text-zinc-400 uppercase mb-1">Variance</span>
                        {item.variance > 0 ? `+${item.variance}` : item.variance}
                      </div>
                    </div>
                  </div>
                ))}

                {stocktakeForm.items.length === 0 && (
                  <div className="text-center py-24 bg-zinc-50 border-2 border-dashed border-zinc-100 rounded-[3rem]">
                    <Package className="w-16 h-16 mx-auto text-zinc-200 mb-4" />
                    <p className="text-sm font-black text-zinc-300 uppercase tracking-widest">Select branch to initialize audit</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Audit Progress</p>
            <p className="text-sm font-black text-zinc-900 uppercase">
              {stocktakeForm.items.filter((i: any) => i.counted !== i.expected).length} Discrepancies Detected
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none rounded-2xl h-12 sm:h-14 px-6 sm:px-8 font-black text-[10px] uppercase tracking-widest"
              onClick={() => setIsStocktakeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 sm:flex-none rounded-2xl h-12 sm:h-14 px-6 sm:px-10 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/10 hover:scale-[1.02] transition-all"
              disabled={isSavingStocktake || stocktakeForm.items.length === 0}
              onClick={async () => {
                setIsSavingStocktake(true);
                try {
                  await addDoc(collection(db, 'stocktakes'), {
                    ...stocktakeForm,
                    enterprise_id: enterpriseId,
                    created_at: new Date().toISOString()
                  });
                  toast.success('Audit session recorded');
                  setIsStocktakeDialogOpen(false);
                  fetchData();
                } catch (error) {
                  toast.error('Audit archival failed');
                } finally {
                  setIsSavingStocktake(false);
                }
              }}
            >
              {isSavingStocktake ? "Archiving..." : "Archive & Reconcile"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
