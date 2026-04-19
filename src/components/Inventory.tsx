import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  AlertTriangle, 
  Package, 
  TrendingUp, 
  TrendingDown,
  Sparkles,
  History,
  MoreHorizontal,
  Box,
  Layers,
  BarChart3,
  Warehouse,
  MapPin,
  ArrowRightLeft,
  Truck,
  FileText,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  ScanLine,
  Info,
  Percent,
  Camera,
  Image as ImageIcon,
  Trash2,
  Check,
  X as XIcon,
  RefreshCw
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";

import { db, auth, handleFirestoreError, OperationType, collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "@/lib/firebase";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function Inventory() {
  const { activeBranch, formatCurrency, enterpriseId } = useModules();
  const [activeTab, setActiveTab] = useState("stock");
  const [searchTerm, setSearchTerm] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferData, setTransferData] = useState({ product: "", from: "main", to: "north", qty: 1 });
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchDeletingMovements, setIsBatchDeletingMovements] = useState(false);
  const [isBatchDeletingSuppliers, setIsBatchDeletingSuppliers] = useState(false);
  
  const initialProductState = { name: "", barcode: "", sku: "", category: "", price: 0, cost: 0, markup: 0, minStock: 10, image_url: "" };
  const [productForm, setProductForm] = useState(initialProductState);
  
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", email: "", phone: "", status: "ACTIVE" });
  const [newPO, setNewPO] = useState({ 
    supplierId: "", 
    expectedDate: "", 
    notes: "",
    reference: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
    items: [{ productId: "", qty: 1, unitCost: 0 }] 
  });
  const [loading, setLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<any>(null);

  // Actions State
  const [isUpdateStockOpen, setIsUpdateStockOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [updateStockData, setUpdateStockData] = useState({ qty: 0, reason: "RESTOCK", branch_id: activeBranch !== "all" ? activeBranch : "" });
  const [productAnalytics, setProductAnalytics] = useState<any[]>([]);
  const [supplierMetrics, setSupplierMetrics] = useState<any[]>([]);
  const [productInsights, setProductInsights] = useState<any>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Sync camera stream to video element whenever it's ready
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStream, hasCameraAccess]);

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => {
        setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    );

    const unsubInventory = onSnapshot(
      query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("inventory:", err)
    );

    const unsubBranches = onSnapshot(
      query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => setBranches(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("branches:", err)
    );

    const unsubMovements = onSnapshot(
      query(collection(db, "inventory_movements"), where("enterprise_id", "==", enterpriseId), orderBy("timestamp", "desc")),
      (snapshot) => setMovements(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("movements:", err)
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, "suppliers"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => setSuppliers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("suppliers:", err)
    );

    return () => {
      unsubProducts();
      unsubInventory();
      unsubBranches();
      unsubMovements();
      unsubSuppliers();
    };
  }, [enterpriseId]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail === "ADD_PRODUCT") {
        setIsProductSheetOpen(true);
      } else if (e.detail === "TRANSFER_STOCK") {
        setActiveTab("movements");
        setIsTransferDialogOpen(true);
      }
    };
    window.addEventListener("app:action", handleAction);
    return () => window.removeEventListener("app:action", handleAction);
  }, []);

    const handlePurchaseOrder = async () => {
    if (!newPO.supplierId || newPO.items.some(i => !i.productId || i.qty <= 0)) {
      toast.error("Please select a supplier and add valid products.");
      return;
    }
    if (!newPO.expectedDate) {
      toast.error("Please select an expected delivery date.");
      return;
    }

    try {
      const supplierObj = suppliers.find(s => s.id === newPO.supplierId);
      
      // Create a movement for each item
      const promises = newPO.items.map(item => {
        const productObj = products.find(p => p.id === item.productId);
        return addDoc(collection(db, "inventory_movements"), {
          type: "PURCHASE",
          product: productObj?.name || "Unknown SKU",
          productId: item.productId,
          from: supplierObj?.name || "Unknown Supplier",
          to: activeBranch !== "all" ? activeBranch : (branches[0]?.id || "main"),
          qty: item.qty,
          unitCost: item.unitCost,
          date: new Date().toISOString().split('T')[0],
          status: "PENDING",
          reference: newPO.reference,
          notes: newPO.notes,
          timestamp: serverTimestamp(),
          expectedDate: newPO.expectedDate,
          enterprise_id: enterpriseId
        });
      });

      await Promise.all(promises);
      
      setIsPurchaseOrderOpen(false);
      setNewPO({ 
        supplierId: "", 
        expectedDate: "", 
        notes: "",
        reference: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        items: [{ productId: "", qty: 1, unitCost: 0 }] 
      });
      toast.success("Professional Purchase Order created successfully.");
    } catch (error) {
      console.error("Error creating PO:", error);
      toast.error("Failed to create purchase order.");
    }
  };

  const addPOItem = () => {
    setNewPO(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", qty: 1, unitCost: 0 }]
    }));
  };

  const removePOItem = (index: number) => {
    if (newPO.items.length <= 1) return;
    setNewPO(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updatePOItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newPO.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-fill unit cost if product is selected
    if (field === "productId") {
      const prod = products.find(p => p.id === value);
      if (prod) updatedItems[index].unitCost = prod.cost || prod.wholesale_price || 0;
    }
    
    setNewPO(prev => ({ ...prev, items: updatedItems }));
  };

  const poSubtotal = newPO.items.reduce((sum, i) => sum + (i.qty * i.unitCost), 0);

  const getProductStock = (productId: string, branchId: string) => {
    if (branchId === "all") {
      return inventory
        .filter(i => i.product_id === productId)
        .reduce((acc, curr) => acc + curr.stock, 0);
    }
    const item = inventory.find(i => i.product_id === productId && i.branch_id === branchId);
    return item ? item.stock : 0;
  };

  const totalSKUs = products.length;
  const lowStockItems = products.filter(p => getProductStock(p.id, activeBranch) < (p.min_stock || 10)).length;
  const inventoryValue = products.reduce((acc, p) => acc + (getProductStock(p.id, activeBranch) * (p.cost || p.retail_price || p.price || 0)), 0);
  const inTransit = movements.filter(m => {
    if (activeBranch !== "all" && m.to !== activeBranch && m.from !== activeBranch && m.to !== branches.find(b=>b.id===activeBranch)?.name) return false;
    return m.status === "IN_TRANSIT" || m.status === "PENDING";
  }).length;

  const handleTransfer = async () => {
    if (!transferData.product || !transferData.from || !transferData.to || transferData.qty <= 0) {
      toast.error("Please fill in all fields with valid quantity.");
      return;
    }
    if (transferData.from === transferData.to) {
      toast.error("Source and destination branches must be different.");
      return;
    }
    if (isTransferring) return; // idempotency guard
    setIsTransferring(true);
    try {
      const productObj = products.find(p => p.id === transferData.product);
      const fromBranchObj = branches.find(b => b.id === transferData.from);
      const toBranchObj = branches.find(b => b.id === transferData.to);

      // Verify source stock before creating the movement
      const sourceStock = getProductStock(transferData.product, transferData.from);
      if (sourceStock < transferData.qty) {
        toast.error(`Insufficient stock. Only ${sourceStock} units available at ${fromBranchObj?.name || transferData.from}.`);
        setIsTransferring(false);
        return;
      }

      await addDoc(collection(db, "inventory_movements"), {
        type: "TRANSFER",
        product: productObj?.name || transferData.product,
        productId: transferData.product,
        from: fromBranchObj?.name || transferData.from,
        to: toBranchObj?.name || transferData.to,
        qty: transferData.qty,
        date: new Date().toISOString().split('T')[0],
        status: "PENDING",
        timestamp: serverTimestamp(),
        enterprise_id: enterpriseId
      });
      toast.success("Stock transfer initiated successfully");
      setIsTransferDialogOpen(false);
      setTransferData({ product: "", from: "main", to: "north", qty: 1 });
    } catch (error: any) {
      toast.error("Transfer failed: " + error.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.contact || !newSupplier.email) {
      toast.error("Please fill in supplier name, contact, and email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSupplier.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (isSavingSupplier) return;
    setIsSavingSupplier(true);
    try {
      await addDoc(collection(db, "suppliers"), { ...newSupplier, enterprise_id: enterpriseId, createdAt: serverTimestamp() });
      setIsSupplierDialogOpen(false);
      setNewSupplier({ name: "", contact: "", email: "", phone: "", status: "ACTIVE" });
      toast.success("Supplier added successfully!");
    } catch (error: any) {
      toast.error("Failed to add supplier: " + error.message);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleUpdateMovementStatus = async (movement: any, newStatus: string) => {
    try {
      if (newStatus === "COMPLETED") {
        const product = products.find(p => p.name === movement.product || p.id === movement.product);
        if (!product) {
          toast.error("Linked product not found. Cannot finalize inventory deduction.");
          return;
        }

        const toBranch = branches.find(b => b.name === movement.to || b.id === movement.to);
        const fromBranch = branches.find(b => b.name === movement.from || b.id === movement.from);

        if (movement.type === "TRANSFER") {
          if (!toBranch || !fromBranch) {
             toast.error("Source or destination branch not found.");
             return;
          }
          // Remove from source branch
          const fromInventoryItem = inventory.find(i => i.product_id === product.id && i.branch_id === fromBranch.id);
          if (fromInventoryItem) {
             if (fromInventoryItem.stock < movement.qty) {
                toast.error(`Insufficient stock in ${fromBranch.name} to complete transfer.`);
                return;
             }
             await updateDoc(doc(db, "inventory", fromInventoryItem.id), { stock: fromInventoryItem.stock - movement.qty });
          } else {
             toast.error(`Product not found in ${fromBranch.name}'s inventory.`);
             return;
          }

          // Add to dest branch
          const toInventoryItem = inventory.find(i => i.product_id === product.id && i.branch_id === toBranch.id);
          if (toInventoryItem) {
            await updateDoc(doc(db, "inventory", toInventoryItem.id), { stock: toInventoryItem.stock + movement.qty });
          } else {
             await addDoc(collection(db, "inventory"), { product_id: product.id, branch_id: toBranch.id, stock: movement.qty, enterprise_id: enterpriseId });
          }
        } else if (movement.type === "PURCHASE") {
           // Purchase order only goes to the destination branch
           if (!toBranch) {
              toast.error("Destination branch not found.");
              return;
           }
           const toInventoryItem = inventory.find(i => i.product_id === product.id && i.branch_id === toBranch.id);
           if (toInventoryItem) {
             await updateDoc(doc(db, "inventory", toInventoryItem.id), { stock: toInventoryItem.stock + movement.qty });
           } else {
              await addDoc(collection(db, "inventory"), { product_id: product.id, branch_id: toBranch.id, stock: movement.qty });
           }
        }
      }

      await updateDoc(doc(db, "inventory_movements", movement.id), { status: newStatus });
      toast.success(`Movement status updated to ${newStatus}`);
    } catch (error: any) {
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const handleScanResult = (data: string, type: 'barcode' | 'qr') => {
    // Lookup Engine
    const product = products.find(p => p.barcode === data || p.sku === data || p.id === data);
    
    if (product) {
      // Response Engine: product_found
      toast.success(`Found product: ${product.name}`);
      setSearchTerm(data);
    } else {
      // Response Engine: product_not_found
      toast.info(`New ${type} detected: ${data}. Opening create product modal.`);
      openProductSheet(null, { barcode: data });
    }
  };

  const openProductSheet = (product: any = null, overrides: any = {}) => {
    if (product) {
      setEditingProductId(product.id);
      const price = product.retail_price || product.price || 0;
      const cost = product.cost || product.wholesale_price || 0;
      const markup = product.markup || ((cost > 0) ? Math.round(((price - cost) / cost) * 100) : 0);
      
      setProductForm({
        name: product.name || "",
        barcode: product.barcode || "",
        sku: product.sku || "",
        category: product.category || "",
        price: price,
        cost: cost,
        markup: markup,
        minStock: product.min_stock || product.min_stock_level || 10,
        image_url: product.image_url || ""
      });
    } else {
      setEditingProductId(null);
      setProductForm({ ...initialProductState, ...overrides });
    }
    setIsProductSheetOpen(true);
  };

  const handleDeleteProduct = (product: any) => {
    setDeleteConfirmProduct(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    try {
      await deleteDoc(doc(db, "products", deleteConfirmProduct.id));
      toast.success(`${deleteConfirmProduct.name} deleted successfully.`);
      setSelectedProducts(prev => prev.filter(id => id !== deleteConfirmProduct.id));
      setDeleteConfirmProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${deleteConfirmProduct.id}`);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (isBatchDeleting) return;
    
    const confirm = window.confirm(`Are you sure you want to delete ${selectedProducts.length} items?`);
    if (!confirm) return;

    setIsBatchDeleting(true);
    try {
      const batchPromises = selectedProducts.map(id => deleteDoc(doc(db, "products", id)));
      await Promise.all(batchPromises);
      toast.success(`Deleted ${selectedProducts.length} items successfully.`);
      setSelectedProducts([]);
    } catch (error: any) {
      toast.error("Failed to delete some items: " + error.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchDeleteMovements = async () => {
    if (selectedMovements.length === 0) return;
    if (isBatchDeletingMovements) return;
    
    const confirm = window.confirm(`Are you sure you want to delete ${selectedMovements.length} logistics records?`);
    if (!confirm) return;

    setIsBatchDeletingMovements(true);
    try {
      const batchPromises = selectedMovements.map(id => deleteDoc(doc(db, "inventory_movements", id)));
      await Promise.all(batchPromises);
      toast.success(`Deleted ${selectedMovements.length} records successfully.`);
      setSelectedMovements([]);
    } catch (error: any) {
      toast.error("Failed to delete some records: " + error.message);
    } finally {
      setIsBatchDeletingMovements(false);
    }
  };

  const handleBatchDeleteSuppliers = async () => {
    if (selectedSuppliers.length === 0) return;
    if (isBatchDeletingSuppliers) return;
    
    const confirm = window.confirm(`Are you sure you want to delete ${selectedSuppliers.length} suppliers?`);
    if (!confirm) return;

    setIsBatchDeletingSuppliers(true);
    try {
      const batchPromises = selectedSuppliers.map(id => deleteDoc(doc(db, "suppliers", id)));
      await Promise.all(batchPromises);
      toast.success(`Deleted ${selectedSuppliers.length} suppliers successfully.`);
      setSelectedSuppliers([]);
    } catch (error: any) {
      toast.error("Failed to delete some suppliers: " + error.message);
    } finally {
      setIsBatchDeletingSuppliers(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

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

  const handleOpenUpdateStock = (product: any) => {
    setSelectedProduct(product);
    setUpdateStockData({ qty: 1, reason: "RESTOCK", branch_id: activeBranch !== "all" ? activeBranch : (branches[0]?.id || "main") });
    setIsUpdateStockOpen(true);
  };

  const submitUpdateStock = async () => {
    if (!selectedProduct || updateStockData.qty <= 0 || !updateStockData.branch_id) {
      toast.error("Please provide valid quantity and branch.");
      return;
    }
    try {
      // Find the inventory doc
      const invItem = inventory.find(i => i.product_id === selectedProduct.id && i.branch_id === updateStockData.branch_id);

      if (invItem) {
        let newStock = invItem.stock;
        if (updateStockData.reason === "RESTOCK" || updateStockData.reason === "RETURN") newStock += updateStockData.qty;
        else newStock = Math.max(0, newStock - updateStockData.qty);
        
        await updateDoc(doc(db, "inventory", invItem.id), { stock: newStock });
      } else {
        // If not exist, add new inventory doc
        let newStock = 0;
        if (updateStockData.reason === "RESTOCK" || updateStockData.reason === "RETURN") newStock = updateStockData.qty;
        await addDoc(collection(db, "inventory"), {
          product_id: selectedProduct.id,
          branch_id: updateStockData.branch_id,
          stock: newStock,
          enterprise_id: enterpriseId
        });
      }

      await addDoc(collection(db, "inventory_movements"), {
        type: updateStockData.reason,
        product: selectedProduct.name,
        productId: selectedProduct.id,
        to: updateStockData.branch_id,
        qty: updateStockData.qty,
        date: new Date().toISOString().split('T')[0],
        status: "COMPLETED",
        timestamp: serverTimestamp(),
        enterprise_id: enterpriseId
      });

      toast.success("Stock updated successfully.");
      setIsUpdateStockOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "inventory");
    }
  };

  const handleOpenAnalytics = (product: any) => {
    setSelectedProduct(product);
    
    // Generate some mock history for analytics based on product price for demo purposes
    const history = [];
    let currentStock = getProductStock(product.id, "all");
    if (currentStock === 0) currentStock = 50; // default for mock
    let totalSales = 0;
    for (let i = 14; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        currentStock += Math.floor(Math.random() * 10) - 4; // random fluctuation
        if (currentStock < 0) currentStock = 10;
        const dailySales = Math.floor(Math.random() * 15);
        totalSales += dailySales;
        history.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            stock: currentStock,
            sales: dailySales
        });
    }
    
    // Generate mock supplier performance
    const suppliersData = [
      { name: "Supplier A", leadTime: Math.floor(Math.random() * 5) + 2, qualityScore: Math.floor(Math.random() * 20) + 80, deliveryRate: Math.floor(Math.random() * 10) + 90 },
      { name: "Supplier B", leadTime: Math.floor(Math.random() * 8) + 4, qualityScore: Math.floor(Math.random() * 15) + 75, deliveryRate: Math.floor(Math.random() * 15) + 85 }
    ];

    // Generate smart insights
    const velocity = (totalSales / 14).toFixed(1);
    const reorderDays = Math.floor(currentStock / (Number(velocity) || 1));
    const insightText = reorderDays < 7 
      ? "Critical: Restock immediately. High sales velocity is outpacing current stock levels."
      : reorderDays > 30
      ? "Warning: Overstocked. Consider reducing next PO frequency or running a promotion to clear excess capital tie-up."
      : "Optimal: Stock levels are securely balanced with current 14-day sales velocity.";

    setProductInsights({
      velocity,
      reorderDays,
      insightText,
      trend: totalSales > 70 ? 'up' : 'down'
    });
    setSupplierMetrics(suppliersData);
    setProductAnalytics(history);
    setIsAnalyticsOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Please fill in the product name.");
      return;
    }
    if (productForm.price < 0) {
      toast.error("Retail price cannot be negative.");
      return;
    }
    if (isSavingProduct) return; // idempotency guard
    setIsSavingProduct(true);
    try {
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), {
          name: productForm.name,
          barcode: productForm.barcode,
          sku: productForm.sku,
          category: productForm.category,
          price: productForm.price,
          retail_price: productForm.price,
          cost: productForm.cost,
          wholesale_price: productForm.cost,
          markup: productForm.markup,
          min_stock: productForm.minStock,
          min_stock_level: productForm.minStock,
          image_url: productForm.image_url
        });
        toast.success("Product updated successfully!");
      } else {
        const docRef = await addDoc(collection(db, "products"), {
          name: productForm.name,
          barcode: productForm.barcode,
          sku: productForm.sku,
          category: productForm.category,
          price: productForm.price,
          retail_price: productForm.price,
          cost: productForm.cost,
          wholesale_price: productForm.cost,
          markup: productForm.markup,
          min_stock: productForm.minStock,
          min_stock_level: productForm.minStock,
          image_url: productForm.image_url,
          status: "ACTIVE",
          createdAt: serverTimestamp(),
          enterprise_id: enterpriseId
        });
        // Add initial inventory
        await addDoc(collection(db, "inventory"), {
          product_id: docRef.id,
          branch_id: activeBranch === "all" ? (branches[0]?.id || "main") : activeBranch,
          stock: 0,
          enterprise_id: enterpriseId
        });
        toast.success("Product created successfully!");
      }
      setIsProductSheetOpen(false);
      setProductForm(initialProductState);
    } catch (error: any) {
      toast.error(`Failed to ${editingProductId ? 'update' : 'create'} product: ${error.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  return (
    <>
    <ScrollArea className="h-full">
      <div className="responsive-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1 max-w-full">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Warehouse className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] truncate">Inventory Intelligence</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-900 font-display break-words">Stock Management</h1>
          <p className="text-zinc-500 text-sm md:text-base leading-snug">Global inventory control, automated replenishment, and logistics tracking.</p>
        </div>
        <div className="responsive-action-bar">
          <Button 
            className="w-full sm:w-auto rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 h-10 md:h-11 px-6 font-bold text-xs"
            onClick={() => openProductSheet()}
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" />
            Add Product
          </Button>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto rounded-xl border-zinc-200 h-10 md:h-11 px-4 font-bold text-xs"
            onClick={() => setIsScannerOpen(true)}
          >
            <ScanLine className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-blue-500" />
            Scan Barcode
          </Button>
          <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" className="w-full sm:w-auto rounded-xl border-zinc-200 h-10 md:h-11 px-6 font-bold text-xs">
                  <ArrowRightLeft className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-zinc-400" />
                  Transfer Stock
                </Button>
              }
            />
            <DialogContent className="rounded-3xl border-zinc-200 max-w-2xl w-[95vw]">
              <DialogHeader className="p-6 md:p-8 bg-zinc-50 border-b border-zinc-100">
                <DialogTitle className="text-2xl font-bold font-display tracking-tight text-zinc-900">Internal Stock Transfer</DialogTitle>
                <DialogDescription className="text-zinc-500">Move inventory between branches or warehouses with audit-ready documentation.</DialogDescription>
              </DialogHeader>
              <div className="p-6 md:p-8 space-y-6">
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-4 items-start mb-2">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-blue-900 uppercase tracking-widest leading-none mb-1">Logistics Note</h5>
                    <p className="text-[10px] text-blue-700 leading-relaxed">Ensure destination branch has sufficient shelving capacity before executing transfer.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.1em]">Product to Relocate</label>
                    <Select onValueChange={(v) => setTransferData({...transferData, product: v})}>
                      <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200 shadow-sm focus:ring-2 focus:ring-blue-500/20">
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.1em]">Source Branch</label>
                      <Select defaultValue="main" onValueChange={(v) => setTransferData({...transferData, from: v})}>
                        <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 text-center flex flex-col justify-center">
                       <ArrowRightLeft className="w-5 h-5 mx-auto text-zinc-300" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.1em]">Target Destination</label>
                      <Select defaultValue="north" onValueChange={(v) => setTransferData({...transferData, to: v})}>
                        <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.1em]">Transfer Quantity</label>
                    <div className="relative">
                       <Input 
                        type="number" 
                        min="1"
                        className="rounded-xl h-12 bg-white border-zinc-200 shadow-sm pl-4 pr-12 focus:ring-2 focus:ring-blue-500/20 font-bold" 
                        value={transferData.qty} 
                        onChange={(e) => setTransferData({...transferData, qty: parseInt(e.target.value) || 0})}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">UNITS</span>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="p-6 md:p-8 bg-white border-t border-zinc-100">
                <Button 
                  className="w-full rounded-2xl bg-zinc-900 text-white h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-95 transition-all" 
                  onClick={handleTransfer}
                  disabled={isTransferring}
                >
                  {isTransferring ? "Processing Transfer..." : "Execute Global Transfer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isPurchaseOrderOpen} onOpenChange={setIsPurchaseOrderOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" className="w-full sm:w-auto rounded-xl border-zinc-200 h-10 md:h-11 px-6 font-bold text-xs">
                  <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-zinc-400" />
                  Purchase Order
                </Button>
              }
            />
            <DialogContent className="rounded-[2.5rem] border-none p-0 lg:w-[1100px] w-[95vw] h-[90vh] overflow-hidden flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] bg-zinc-50">
              <DialogHeader className="p-8 lg:p-12 bg-zinc-900 text-white relative flex-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.3em]">Supply Chain Operations</span>
                    </div>
                    <DialogTitle className="font-display tracking-tight text-2xl md:text-4xl lg:text-5xl font-black leading-tight break-words">Issue Purchase Order</DialogTitle>
                    <DialogDescription className="text-zinc-400 font-medium text-sm md:text-base lg:text-lg">Provision inventory acquisition with professional SKU configuration.</DialogDescription>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 min-w-[220px] shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Reference ID</p>
                    <p className="text-2xl font-mono font-black text-white">{newPO.reference}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-8 lg:px-12 py-10">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                  {/* Left Column: Vendor & Date */}
                  <div className="xl:col-span-4 space-y-10">
                    <div className="space-y-8 p-8 bg-white rounded-3xl border border-zinc-200 shadow-sm">
                      <div className="flex items-center gap-2 text-zinc-900 border-b border-zinc-100 pb-4">
                        <Truck className="w-4 h-4 text-emerald-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest">General Allocation</span>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Supplier Entity</label>
                          <Select value={newPO.supplierId} onValueChange={(v) => setNewPO({...newPO, supplierId: v})}>
                            <SelectTrigger className="rounded-2xl h-14 bg-zinc-50 border-2 border-zinc-100 shadow-none text-zinc-900 font-bold px-6 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                              <SelectValue placeholder="Select Supplier" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                              {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="rounded-xl py-3 px-4 focus:bg-emerald-50 text-zinc-900 font-medium">{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Expected Delivery</label>
                          <div className="relative group">
                            <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input 
                              type="date" 
                              className="rounded-2xl h-14 bg-zinc-50 border-2 border-zinc-100 shadow-none pl-14 pr-6 focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold" 
                              value={newPO.expectedDate} 
                              onChange={(e) => setNewPO({...newPO, expectedDate: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Internal Notes</label>
                          <textarea 
                            className="w-full rounded-2xl min-h-[140px] bg-zinc-50 border-2 border-zinc-100 shadow-none p-6 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-sm text-zinc-600 resize-none"
                            placeholder="Add special instructions or delivery notes..."
                            value={newPO.notes}
                            onChange={(e) => setNewPO({...newPO, notes: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Line Items */}
                  <div className="xl:col-span-8 space-y-8">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <Package className="w-4 h-4 text-emerald-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest leading-none">Line Item Configuration</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={addPOItem}
                        className="h-9 rounded-xl text-emerald-600 hover:bg-emerald-50 font-black text-[10px] uppercase tracking-widest px-4"
                      >
                        <Plus className="w-3.5 h-3.5 mr-2" /> Add Selection
                      </Button>
                    </div>

                    <div className="space-y-4">
                        {newPO.items.map((item, idx) => (
                          <div key={idx} className="bg-white rounded-3xl p-8 border border-zinc-200 flex flex-col md:flex-row gap-8 relative group/item shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex-1 space-y-3">
                              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Product Selection</label>
                              <Select value={item.productId} onValueChange={(v) => updatePOItem(idx, "productId", v)}>
                                <SelectTrigger className="rounded-xl h-14 bg-zinc-50 border-zinc-100 font-bold px-6">
                                  <SelectValue placeholder="SKU Search..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:w-auto">
                              <div className="space-y-3">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Quantity</label>
                                <Input 
                                  type="number" 
                                  className="rounded-xl h-14 bg-zinc-50 border-zinc-100 text-center font-black w-full md:w-28" 
                                  value={item.qty} 
                                  onChange={(e) => updatePOItem(idx, "qty", parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-3">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Unit Cost</label>
                                <div className="relative">
                                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                                  <Input 
                                    type="number" 
                                    className="rounded-xl h-14 bg-zinc-50 border-zinc-100 pl-10 font-black text-zinc-900 w-full md:w-36" 
                                    value={item.unitCost} 
                                    onChange={(e) => updatePOItem(idx, "unitCost", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-3 hidden md:block">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right block">Subtotal</label>
                                <div className="h-14 flex items-center justify-end font-black text-zinc-900 text-lg">
                                  {formatCurrency(item.qty * item.unitCost)}
                                </div>
                              </div>
                            </div>
                            {newPO.items.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white border border-zinc-200 text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                                onClick={() => removePOItem(idx)}
                              >
                                <Plus className="w-5 h-5 rotate-45" />
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Totals Summary */}
                    <div className="bg-zinc-900 text-white rounded-[2.5rem] p-10 lg:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5">
                      <div className="flex gap-10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subtotal</p>
                          <p className="text-xl font-bold">{formatCurrency(poSubtotal)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tax</p>
                          <p className="text-xl font-bold">$0.00</p>
                        </div>
                      </div>
                      <div className="text-center md:text-right space-y-1">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Grand Total Amount</p>
                        <p className="text-5xl lg:text-6xl font-black font-display tracking-tight text-white">{formatCurrency(poSubtotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-8 lg:p-12 bg-white border-t border-zinc-200 flex-none gap-6">
                <Button variant="ghost" className="rounded-2xl h-18 px-10 font-bold text-zinc-400 hover:text-rose-500 hover:bg-rose-50 flex-1 md:flex-none transition-all" onClick={() => setIsPurchaseOrderOpen(false)}>
                  Discard Order Draft
                </Button>
                <Button 
                  className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 h-18 px-16 font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-emerald-500/30 border-b-4 border-emerald-800 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all flex-1 md:flex-none flex items-center justify-center gap-4" 
                  onClick={handlePurchaseOrder}
                >
                  <FileText className="w-5 h-5" />
                  Finalize & Issue Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-modern border-blue-100 bg-blue-50/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Total SKUs</p>
              <p className="text-xl text-zinc-900 font-bold">{totalSKUs.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern border-rose-100 bg-rose-50/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5">Low Stock</p>
              <p className="text-xl text-zinc-900 font-bold">{lowStockItems} Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">In Transit / Pending</p>
              <p className="text-xl text-zinc-900 font-bold">{inTransit} Shipments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern border-zinc-100 bg-zinc-50/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-zinc-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Inventory Value</p>
              <p className="text-xl text-zinc-900 font-bold">{formatCurrency(inventoryValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="bg-zinc-100 p-1 rounded-xl w-max flex gap-1">
            <TabsTrigger value="stock" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Stock Levels</TabsTrigger>
            <TabsTrigger value="movements" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Movements</TabsTrigger>
            <TabsTrigger value="suppliers" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Suppliers</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stock" className="space-y-6">
          <Card className="card-modern overflow-hidden">
            <div className="p-6 border-b border-zinc-100 bg-zinc-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                <Input 
                  placeholder="Search by SKU, name or category..." 
                  className="pl-10 rounded-xl border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500/20 transition-all h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] rounded-xl h-11 bg-white border-zinc-200">
                    <Filter className="w-4 h-4 mr-2 text-zinc-400" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-zinc-200 text-zinc-600 h-11 font-bold text-xs"
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
                    toast.success("CSV exported!");
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                  <TableHead className="w-[50px] py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      checked={products.length > 0 && selectedProducts.length === products.filter(p => {
                        const matchesSearch = !searchTerm || (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesCat = categoryFilter === "all" || p.category === categoryFilter;
                        return matchesSearch && matchesCat;
                      }).length}
                      onChange={() => {
                        const filtered = products.filter(p => {
                          const matchesSearch = !searchTerm || (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
                          const matchesCat = categoryFilter === "all" || p.category === categoryFilter;
                          return matchesSearch && matchesCat;
                        });
                        toggleSelectAll(filtered);
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[300px] font-bold text-zinc-900 py-4">Product</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Branch Stock</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Total Stock</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Price</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                  <TableHead className="text-right font-bold text-zinc-900 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-10 w-48 bg-zinc-100 rounded-lg animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-zinc-100 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-zinc-100 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-6 w-20 bg-zinc-100 rounded-full animate-pulse" /></TableCell>
                      <TableCell />
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
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-zinc-400">
                          <Package className="w-10 h-10 opacity-30" />
                          <p className="text-sm font-bold">
                            {searchTerm ? `No products match "${searchTerm}"` : "No products in inventory yet"}
                          </p>
                          {!searchTerm && (
                            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openProductSheet()}>
                              <Plus className="w-4 h-4 mr-2" /> Add First Product
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
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
                  .map((item) => {
                  const branchStock = getProductStock(item.id, activeBranch);
                  const totalStock = getProductStock(item.id, "all");
                  const status = totalStock === 0 ? "Out of Stock" : totalStock <= (item.min_stock_level || 10) ? "Low Stock" : "In Stock";

                  return (
                    <TableRow key={item.id} className={cn("hover:bg-zinc-50/30 transition-colors border-b border-zinc-50", selectedProducts.includes(item.id) && "bg-blue-50/50")}>
                      <TableCell className="py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedProducts.includes(item.id)}
                          onChange={() => toggleSelectProduct(item.id)}
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                            <Box className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900">{item.name}</p>
                            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{item.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900">{branchStock}</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{activeBranch === "all" ? "Global" : "at current branch"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between w-32">
                            <span className="text-sm font-bold text-zinc-900">{totalStock}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">Global</span>
                          </div>
                          <div className="w-32 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                totalStock === 0 ? "bg-zinc-300" : 
                                totalStock <= (item.min_stock_level || 10) ? "bg-rose-500" : "bg-blue-500"
                              )}
                              style={{ width: `${Math.min(100, (totalStock / ((item.min_stock_level || 10) * 5)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(item.retail_price || item.price)}</TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          status === "In Stock" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                          status === "Low Stock" ? "bg-amber-50 text-amber-600 border-amber-100" : 
                          "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          }
                        />
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-zinc-200">
                            <DropdownMenuItem 
                              className="flex items-center gap-2 py-2 cursor-pointer"
                              onClick={() => openProductSheet(item)}
                            >
                              <Box className="w-4 h-4" /> Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 py-2 cursor-pointer"
                              onClick={() => handleOpenUpdateStock(item)}
                            >
                              <Layers className="w-4 h-4" /> Update Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 py-2 cursor-pointer"
                              onClick={() => handleOpenAnalytics(item)}
                            >
                              <BarChart3 className="w-4 h-4" /> View Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 py-2 cursor-pointer text-rose-600 focus:text-rose-600"
                              onClick={() => handleDeleteProduct(item)}
                            >
                              Delete Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {selectedProducts.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-zinc-900 text-white rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {selectedProducts.length}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Items Selected</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    className="h-10 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs rounded-xl"
                    disabled={isBatchDeleting}
                    onClick={handleBatchDelete}
                  >
                    {isBatchDeleting ? "Deleting..." : "Delete Permanently"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-10 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs rounded-xl"
                    onClick={() => setSelectedProducts([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card className="card-modern overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                  <TableHead className="w-[50px] py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
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
                  <TableHead className="font-bold text-zinc-900 py-4">ID</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Type</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Product</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Route</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Quantity</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Date</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.filter(m => {
                  if (activeBranch !== "all" && m.to !== activeBranch && m.from !== activeBranch && m.to !== branches.find(b=>b.id===activeBranch)?.name) return false;
                  return true;
                }).map((m) => (
                  <TableRow key={m.id} className={cn("hover:bg-zinc-50/30 transition-colors border-b border-zinc-50", selectedMovements.includes(m.id) && "bg-blue-50/50")}>
                    <TableCell className="py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedMovements.includes(m.id)}
                        onChange={() => {
                          setSelectedMovements(prev => 
                            prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-4 font-mono text-[10px] font-bold text-zinc-400">{m.id.substring(0,8)}...</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-bold uppercase",
                        m.type === "TRANSFER" ? "text-blue-600 border-blue-100 bg-blue-50" :
                        m.type === "PURCHASE" ? "text-emerald-600 border-emerald-100 bg-emerald-50" :
                        "text-amber-600 border-amber-100 bg-amber-50"
                      )}>
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 font-bold text-zinc-900">{m.product}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-bold text-zinc-700">{m.from}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-bold text-zinc-700">{m.to}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-bold text-zinc-900">{m.qty > 0 ? `+${m.qty}` : m.qty}</TableCell>
                    <TableCell className="py-4 text-xs text-zinc-500">{m.date}</TableCell>
                    <TableCell className="py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none">
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity",
                            m.status === "COMPLETED" ? "bg-emerald-50 border-emerald-100" :
                            m.status === "CANCELLED" ? "bg-rose-50 border-rose-100" :
                            m.status === "IN_TRANSIT" ? "bg-blue-50 border-blue-100" :
                            "bg-amber-50 border-amber-100"
                          )}>
                            {m.status === "COMPLETED" ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : m.status === "CANCELLED" ? (
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                            ) : m.status === "IN_TRANSIT" ? (
                              <Truck className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500" />
                            )}
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              m.status === "COMPLETED" ? "text-emerald-600" : 
                              m.status === "CANCELLED" ? "text-rose-600" :
                              m.status === "IN_TRANSIT" ? "text-blue-600" :
                              "text-amber-600"
                            )}>
                              {m.status}
                            </span>
                            <ChevronRight className="w-3 h-3 text-zinc-400 rotate-90 ml-1" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-zinc-200">
                          <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "COMPLETED")}>Set Completed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "IN_TRANSIT")}>Set In Transit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateMovementStatus(m, "PENDING")}>Set Pending</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600" onClick={() => handleUpdateMovementStatus(m, "CANCELLED")}>Cancel Movement</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {selectedMovements.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-zinc-900 text-white rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {selectedMovements.length}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Records Selected</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    className="h-10 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs rounded-xl"
                    disabled={isBatchDeletingMovements}
                    onClick={handleBatchDeleteMovements}
                  >
                    {isBatchDeletingMovements ? "Deleting..." : "Delete Logs"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-10 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs rounded-xl"
                    onClick={() => setSelectedMovements([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex items-center justify-end">
            <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
              <DialogTrigger
                render={
                  <Button className="rounded-xl bg-zinc-900 text-white h-11 px-6 font-bold text-xs">
                    <Plus className="w-4 h-4 mr-2" /> Add Supplier
                  </Button>
                }
              />
              <DialogContent className="rounded-3xl border-zinc-200">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold font-display tracking-tight">Add New Supplier</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Supplier Name</label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Contact Person</label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newSupplier.contact}
                      onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Email Address</label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                        placeholder="e.g. john@acme.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Phone Number</label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                        placeholder="e.g. +1 555 123 4567"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" 
                    onClick={handleAddSupplier}
                    disabled={isSavingSupplier}
                  >
                    {isSavingSupplier ? "Saving..." : "Save Supplier"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="card-modern overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                  <TableHead className="w-[50px] py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      checked={suppliers.length > 0 && selectedSuppliers.length === suppliers.length}
                      onChange={() => {
                        if (selectedSuppliers.length === suppliers.length) {
                          setSelectedSuppliers([]);
                        } else {
                          setSelectedSuppliers(suppliers.map(s => s.id));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Supplier Name</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Contact</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Email</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Phone</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-500">No suppliers found.</TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((s) => (
                    <TableRow key={s.id} className={cn("hover:bg-zinc-50/30 transition-colors border-b border-zinc-50", selectedSuppliers.includes(s.id) && "bg-blue-50/50")}>
                      <TableCell className="py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedSuppliers.includes(s.id)}
                          onChange={() => {
                            setSelectedSuppliers(prev => 
                              prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">{s.name}</TableCell>
                      <TableCell className="py-4 text-zinc-600">{s.contact}</TableCell>
                      <TableCell className="py-4 text-zinc-600">{s.email}</TableCell>
                      <TableCell className="py-4 text-zinc-600">{s.phone}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold uppercase",
                          s.status === "ACTIVE" ? "text-emerald-600 border-emerald-100 bg-emerald-50" : "text-zinc-600 border-zinc-200 bg-zinc-50"
                        )}>
                          {s.status || "ACTIVE"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {selectedSuppliers.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-zinc-900 text-white rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {selectedSuppliers.length}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Suppliers Selected</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    className="h-10 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs rounded-xl"
                    disabled={isBatchDeletingSuppliers}
                    onClick={handleBatchDeleteSuppliers}
                  >
                    {isBatchDeletingSuppliers ? "Deleting..." : "Delete Suppliers"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-10 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs rounded-xl"
                    onClick={() => setSelectedSuppliers([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={isProductSheetOpen} onOpenChange={setIsProductSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl border-l border-zinc-200 bg-zinc-50/95 backdrop-blur-xl p-0 overflow-hidden flex flex-col shadow-2xl h-[100dvh] sm:h-full">
          <SheetHeader className="p-4 sm:p-8 bg-white border-b border-zinc-100/80 flex-none px-6">
            <SheetTitle className="font-display tracking-tight text-xl sm:text-2xl text-zinc-900">
              {editingProductId ? "Edit Product" : "New Product"}
            </SheetTitle>
            <SheetDescription className="text-xs sm:text-sm text-zinc-500">
              {editingProductId ? "Modify product details." : "Add to catalog."}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-8 space-y-8">
              {/* Product Image Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-900 mb-4 border-b border-zinc-200/50 pb-2">
                  <Camera className="w-4 h-4 text-zinc-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Product Photography</span>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="relative w-full aspect-square max-w-[160px] sm:max-w-[200px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-white border-2 border-zinc-100 shadow-inner flex items-center justify-center group">
                    {productForm.image_url ? (
                      <>
                        <img src={productForm.image_url} alt="Product" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="rounded-full w-10 h-10"
                            onClick={() => setProductForm({...productForm, image_url: ""})}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-center p-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mb-3">
                          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-300" />
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">
                          No Asset<br/>Selected
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full max-w-[280px] sm:max-w-[300px]">
                    <Button 
                      onClick={() => setIsCameraOpen(true)}
                      className="flex-1 rounded-2xl h-11 sm:h-12 bg-zinc-900 text-white hover:bg-zinc-800 font-bold gap-2 text-xs"
                    >
                      <Camera className="w-4 h-4" />
                      Camera
                    </Button>
                    <div className="relative flex-1">
                      <input 
                        type="file" 
                        id="product-image-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const tid = toast.loading("Uploading...");
                          try {
                            const { getStorage, ref, uploadBytes, getDownloadURL } = await import("@/lib/firebase");
                            const storage = getStorage();
                            const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
                            await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(storageRef);
                            setProductForm(prev => ({ ...prev, image_url: url }));
                            toast.success("Uploaded", { id: tid });
                          } catch (err) {
                            toast.error("Failed", { id: tid });
                          }
                        }}
                      />
                      <Button 
                        variant="outline"
                        className="w-full rounded-2xl h-11 sm:h-12 border-zinc-200 text-zinc-900 font-bold gap-2 text-xs"
                        asChild
                      >
                        <label htmlFor="product-image-upload" className="cursor-pointer">
                          <Plus className="w-4 h-4" />
                          Upload
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Info */}

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <Box className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Basic Information</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500">Product Name <span className="text-rose-500">*</span></label>
                  <Input 
                    className="rounded-xl h-11 sm:h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20 text-sm" 
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    placeholder="e.g. Ergonomic Office Chair"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500">Category</label>
                  <Input 
                    className="rounded-xl h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20" 
                    value={productForm.category}
                    onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                    placeholder="e.g. Furniture"
                  />
                </div>
              </div>

              {/* Identifiers */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <ScanLine className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Identifiers</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-zinc-500">Barcode</label>
                    <Input 
                      className="rounded-xl h-12 bg-white border-zinc-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                      placeholder="Scan or type..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500">SKU Code</label>
                    <Input 
                      className="rounded-xl h-11 sm:h-12 bg-white border-zinc-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      value={productForm.sku}
                      onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                      placeholder="e.g. FUR-01"
                    />
                  </div>
                </div>
              </div>
              
              {/* Pricing & Stock */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Pricing & Rules</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500">Cost Price</label>
                    <Input 
                      type="number"
                      min="0"
                      step="0.01"
                      className="rounded-xl h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-emerald-500/20" 
                      value={productForm.cost || ""}
                      onChange={(e) => {
                        const newCost = parseFloat(e.target.value) || 0;
                        setProductForm(prev => ({
                          ...prev,
                          cost: newCost,
                          price: parseFloat((newCost + (newCost * (prev.markup / 100))).toFixed(2))
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500">Markup (%)</label>
                    <div className="relative">
                      <Input 
                        type="number"
                        min="0"
                        step="0.1"
                        className="rounded-xl h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-emerald-500/20" 
                        value={productForm.markup || ""}
                        onChange={(e) => {
                          const newMarkup = parseFloat(e.target.value) || 0;
                          setProductForm(prev => ({
                            ...prev,
                            markup: newMarkup,
                            price: parseFloat((prev.cost + (prev.cost * (newMarkup / 100))).toFixed(2))
                          }));
                        }}
                      />
                      <Percent className="w-4 h-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-600">Retail Price</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">$</div>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl h-12 bg-emerald-50/50 border-emerald-200 text-emerald-700 font-bold focus:ring-2 focus:ring-emerald-500/20 pl-8" 
                        value={productForm.price || ""}
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0;
                          setProductForm(prev => ({
                            ...prev,
                            price: newPrice,
                            markup: prev.cost > 0 ? parseFloat((((newPrice - prev.cost) / prev.cost) * 100).toFixed(1)) : 0
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-zinc-500">Low Stock Alert Threshold</label>
                  <Input 
                    type="number"
                    min="1"
                    className="rounded-xl h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-amber-500/20" 
                    value={productForm.minStock || ""}
                    onChange={(e) => setProductForm({...productForm, minStock: parseInt(e.target.value) || 0})}
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Triggers low stock alerts in Copilot and Dashboard.</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <SheetFooter className="p-6 bg-white border-t border-zinc-100 flex-none">
            <Button 
              className="w-full rounded-xl bg-zinc-900 text-white h-14 font-bold text-sm shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 transition-all" 
              onClick={handleSaveProduct}
              disabled={isSavingProduct}
            >
              {isSavingProduct ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </div>
              ) : editingProductId ? "Save Changes" : "Create Product"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScanResult} 
      />

      {/* Update Stock Dialog */}
      <Dialog open={isUpdateStockOpen} onOpenChange={setIsUpdateStockOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Update Stock: {selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Adjust current inventory levels manually. This will generate a movement log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProduct && (
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500">Current Stock</span>
                <span className="text-sm font-bold text-zinc-900">
                  {getProductStock(selectedProduct.id, updateStockData.branch_id || activeBranch)} units
                </span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Adjustment Type</label>
              <Select 
                value={updateStockData.reason} 
                onValueChange={(val) => setUpdateStockData({...updateStockData, reason: val})}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTOCK">Restock (Add)</SelectItem>
                  <SelectItem value="RETURN">Return (Add)</SelectItem>
                  <SelectItem value="DAMAGED">Damaged (Remove)</SelectItem>
                  <SelectItem value="SHRINKAGE">Shrinkage / Lost (Remove)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Branch</label>
              <Select 
                value={updateStockData.branch_id} 
                onValueChange={(val) => setUpdateStockData({...updateStockData, branch_id: val})}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Quantity</label>
              <Input 
                type="number" 
                min="1"
                className="h-12 rounded-xl"
                value={updateStockData.qty}
                onChange={(e) => setUpdateStockData({...updateStockData, qty: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsUpdateStockOpen(false)}>Cancel</Button>
            <Button className="bg-zinc-900 text-white rounded-xl" onClick={submitUpdateStock}>Update Inventory</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="sm:max-w-4xl rounded-2xl p-0 overflow-hidden bg-zinc-50 border-none">
          <div className="bg-white px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-display">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                {selectedProduct?.name} Analytics
              </DialogTitle>
              <DialogDescription className="mt-1">
                Historical stock levels, sales trends, and AI-driven supplier insights.
              </DialogDescription>
            </div>
            <div className="text-right">
              <Badge className={cn("text-[10px] font-bold uppercase", productInsights.reorderDays < 7 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                {productInsights.reorderDays} Days of Stock Left
              </Badge>
              <p className="text-[10px] text-zinc-400 font-medium mt-1">Velocity: {productInsights.velocity} units/day</p>
            </div>
          </div>

          <Tabs defaultValue="trends" className="w-full">
            <div className="px-6 pt-4 bg-white">
              <TabsList className="bg-zinc-100/80 p-1 rounded-xl">
                <TabsTrigger value="trends" className="rounded-lg px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs">Sales & Stock Trends</TabsTrigger>
                <TabsTrigger value="suppliers" className="rounded-lg px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs">Supplier Performance</TabsTrigger>
                <TabsTrigger value="insights" className="rounded-lg px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs">Optimization Strategies</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[450px] px-6 py-4">
              <TabsContent value="trends" className="mt-0 space-y-4">
                <Card className="card-modern shadow-sm border-zinc-200/60 p-6">
                  <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> 14-Day Performance History
                  </h3>
                  <div className="h-72 w-full">
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
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ fontWeight: 'bold', color: '#18181b', marginBottom: '4px' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}/>
                        <Area yAxisId="left" type="monotone" dataKey="sales" name="Sales Unit" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                        <Area yAxisId="right" type="monotone" dataKey="stock" name="Stock Level" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="suppliers" className="mt-0 space-y-4">
                <Card className="card-modern shadow-sm border-zinc-200/60 p-6">
                   <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-500" /> Supplier Reliability Metrics
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={supplierMetrics} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#3f3f46', fontWeight: 'bold' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <RechartsTooltip 
                          cursor={{fill: '#f4f4f5'}}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}/>
                        <Bar yAxisId="left" dataKey="qualityScore" name="Quality Score (%)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                        <Bar yAxisId="left" dataKey="deliveryRate" name="On-Time Delivery (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                        <Bar yAxisId="right" dataKey="leadTime" name="Lead Time (Days)" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="card-modern shadow-sm border-zinc-200/60 p-6 bg-gradient-to-br from-indigo-50/50 to-white">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-zinc-900 mb-2">AI Restock Recommendation</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {productInsights.insightText}
                    </p>
                  </Card>
                  
                  <Card className="card-modern shadow-sm border-zinc-200/60 p-6 bg-gradient-to-br from-blue-50/50 to-white">
                     <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-zinc-900 mb-2">Velocity Analysis</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      This product averages <strong className="text-zinc-900">{productInsights.velocity} sales per day</strong>. 
                      Based on your primary supplier's lead time ({supplierMetrics[0]?.leadTime || 0} days), you must reorder when stock hits exactly <strong>{Math.ceil(productInsights.velocity * (supplierMetrics[0]?.leadTime || 0))} units</strong> to prevent stockouts.
                    </p>
                  </Card>

                   <Card className="card-modern shadow-sm border-zinc-200/60 p-6 md:col-span-2">
                     <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-4">
                        <Layers className="w-5 h-5 text-zinc-400" />
                        <h4 className="font-bold text-zinc-900">Optimization Strategies</h4>
                     </div>
                     <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-zinc-600">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <span><strong>Supplier Routing:</strong> {supplierMetrics[0]?.name} offers better quality metrics, but {supplierMetrics[1]?.name || "alternatives"} may provide emergency stock faster due to geographical routing.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-zinc-600">
                           <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                           <span><strong>Capital Efficiency:</strong> Consider adopting a Just-in-Time (JIT) model for this product class to free up cash flow, given its stable and predictable demand curve.</span>
                        </li>
                     </ul>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
    </ScrollArea>

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => { if (!open) setDeleteConfirmProduct(null); }}>
      <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-rose-600">Delete Product?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{deleteConfirmProduct?.name}</strong> and all associated inventory records. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3 sm:gap-0 mt-4">
          <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setDeleteConfirmProduct(null)}>Cancel</Button>
          <Button
            className="flex-1 rounded-xl bg-rose-600 text-white h-12 font-bold hover:bg-rose-700"
            onClick={confirmDeleteProduct}
          >
            Yes, Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Integrated Camera Interface */}
    <Dialog open={isCameraOpen} onOpenChange={(open) => {
      if (!open) {
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setHasCameraAccess(false);
        setIsCameraOpen(false);
      } else {
        setIsCameraOpen(true);
        // Delay slightly to ensure Dialog animation is finished and DOM is ready
        setTimeout(() => {
          const constraints = { 
            video: { 
              facingMode: 'environment', 
              width: { ideal: 2048 }, 
              height: { ideal: 2048 },
              aspectRatio: 1
            } 
          };
          
          navigator.mediaDevices.getUserMedia(constraints)
          .then(stream => {
            setCameraStream(stream);
            setHasCameraAccess(true);
          })
          .catch(err => {
            console.warn("Environment camera failed, trying fallback:", err);
            // Fallback for devices without environment camera or permission issues
            navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
              setCameraStream(stream);
              setHasCameraAccess(true);
            })
            .catch(fallbackErr => {
              console.error("Critical camera failure:", fallbackErr);
              toast.error("Lens initialization failed. Please check camera permissions.");
              setIsCameraOpen(false);
            });
          });
        }, 300);
      }
    }}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden rounded-[3rem] border-none bg-black">
        <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {hasCameraAccess ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-zinc-500">
              <RefreshCw className="w-10 h-10 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Initializing Lens...</p>
            </div>
          )}
          
          {/* Overlay Guide */}
          <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none">
            <div className="w-full h-full border border-white/30 rounded-[1.5rem]" />
          </div>

          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8 px-8">
            <Button 
              variant="outline" 
              className="rounded-full w-14 h-14 border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20"
              onClick={() => setIsCameraOpen(false)}
            >
              <XIcon className="w-6 h-6" />
            </Button>
            
            <Button 
              className="rounded-full w-20 h-20 bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-2xl p-0 flex items-center justify-center"
              onClick={async () => {
                if (!videoRef.current || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const video = videoRef.current;
                
                // Set canvas size to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                
                // Draw current frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Convert to blob
                canvas.toBlob(async (blob) => {
                  if (!blob) return;
                  const tid = toast.loading("Processing high-res capture...");
                  
                  try {
                    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("@/lib/firebase");
                    const storage = getStorage();
                    const storageRef = ref(storage, `products/photo_${Date.now()}.jpg`);
                    await uploadBytes(storageRef, blob);
                    const url = await getDownloadURL(storageRef);
                    
                    setProductForm(prev => ({ ...prev, image_url: url }));
                    toast.success("Product photo secured", { id: tid });
                    
                    // Cleanup
                    if (cameraStream) {
                      cameraStream.getTracks().forEach(track => track.stop());
                      setCameraStream(null);
                    }
                    setIsCameraOpen(false);
                  } catch (err) {
                    toast.error("Processing failed", { id: tid });
                  }
                }, 'image/jpeg', 0.9);
              }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-black/10 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-zinc-900/5 border border-zinc-900/10" />
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="rounded-full w-14 h-14 border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20"
            >
              <ImageIcon className="w-6 h-6" />
            </Button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
    </>
  );
}
