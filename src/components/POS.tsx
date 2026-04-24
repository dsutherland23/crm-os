import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode,
  Sparkles,
  Zap,
  Tag,
  Info,
  ChevronRight,
  UserPlus,
  Split,
  Scan,
  Printer,
  X,
  CheckCircle2,
  History,
  Package,
  ScanLine,
  Percent,
  Lock,
  ArrowLeft,
  ClipboardCheck,
  Play,
  Coffee,
  Utensils,
  AlertCircle,
  Users,
  Clock
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";
import { usePendingAction } from "@/context/PendingActionContext";
import { motion, AnimatePresence } from "motion/react";

import { db, collection, onSnapshot, query, where, doc, addDoc, updateDoc, getDocs, orderBy, limit, serverTimestamp, increment } from "@/lib/firebase";
import { PrintableInvoice } from "./PrintableInvoice";
import { POSReceipt } from "./POSReceipt";
import { POSAIUpsell } from "./POSAIUpsell";
import { recordFinancialEvent } from "@/lib/ledger";
import { recordAuditLog } from "@/lib/audit";

interface CartDiscount {
  id: string;
  name: string;
  type: "Percentage" | "Fixed Amount";
  value: number;
  target_products?: string[];
}

export default function POS() {
  const { 
    activeBranch, setActiveBranch, hasActiveTransaction, setHasActiveTransaction, 
    formatCurrency, currency, enterpriseId, branding, setPosSession, 
    posSession, clearSession, updateShiftStatus, logout,
    shiftTimePolicies: timePolicies, setShiftTimePolicies: setTimePolicies,
    taxRate: globalTaxRate,
    autoCloseTime,
    autoCloseEnabled
  } = useModules();
  const { consumeAction } = usePendingAction();
  
  const [cart, setCart] = useState<{ product: any; quantity: number; discount?: { type: "Percentage" | "Fixed Amount"; value: number } | null }[]>([]);
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [isItemDiscountDialogOpen, setIsItemDiscountDialogOpen] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState<string | null>(null);
  const [itemDiscount, setItemDiscount] = useState({ type: "Percentage", value: "" });
  
  useEffect(() => {
    setHasActiveTransaction(cart.length > 0);
  }, [cart, setHasActiveTransaction]);

  // Clean up on unmount just in case
  useEffect(() => {
    return () => setHasActiveTransaction(false);
  }, [setHasActiveTransaction]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "SPLIT">("CARD");
  const [receiptType, setReceiptType] = useState<"INVOICE" | "POS">("POS");
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpenOnMobile, setIsCartOpenOnMobile] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All Items");
  const [customerSearch, setCustomerSearch] = useState("");

  // Discount State
  const [cartDiscount, setCartDiscount] = useState<CartDiscount | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountContext, setDiscountContext] = useState<"Manual" | "Campaign">("Campaign");
  const [manualDiscount, setManualDiscount] = useState({ name: "Manual Discount", type: "Percentage", value: "" });
  const [customerUsage, setCustomerUsage] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCustomer?.id || !enterpriseId) {
      setCustomerUsage([]);
      return;
    }
    const q = query(
      collection(db, "customer_campaign_usage"),
      where("customer_id", "==", selectedCustomer.id),
      where("enterprise_id", "==", enterpriseId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCustomerUsage(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("customer_usage sync error:", err));
    return () => unsub();
  }, [selectedCustomer, enterpriseId]);

  // Flush cart if the branch scope changes mid-transaction 
  // (we keep this in case activeBranch is forced via other means)
  useEffect(() => {
    if (cart.length > 0) {
      setCart([]);
      setCartDiscount(null);
      setSelectedCustomer(null);
    }
  }, [activeBranch]);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [adminPin, setAdminPin] = useState("1234");

  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const [isStockSynced, setIsStockSynced] = useState(false);
  const [isOpeningFloatOpen, setIsOpeningFloatOpen] = useState(false);

  // Reset sync state when opening close dialog
  useEffect(() => {
    if (isClosePromptOpen) {
      setIsStockSynced(false);
    }
  }, [isClosePromptOpen]);
  const [openingFloat, setOpeningFloat] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeRegisterNotes, setCloseRegisterNotes] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionData, setCurrentSessionData] = useState<any>(null);
  const [isCustomItemDialogOpen, setIsCustomItemDialogOpen] = useState(false);
  const [customItem, setCustomItem] = useState({ name: "", price: "" });
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCountingBills, setIsCountingBills] = useState(false);
  const [billCounts, setBillCounts] = useState<Record<number, string>>({});
  const [loyaltySettings, setLoyaltySettings] = useState({ pointsRequiredForReward: 100, rewardValue: 5 });

  useEffect(() => {
    if (!enterpriseId) return;
    const unsub = onSnapshot(doc(db, "loyalty_settings", enterpriseId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLoyaltySettings({
          pointsRequiredForReward: data.pointsRequiredForReward || 100,
          rewardValue: data.rewardValue || 5
        });
      }
    }, () => { /* silently use defaults if loyalty_settings not accessible */ });
    return () => unsub();
  }, [enterpriseId]);

  const handleBillCountChange = (denom: number, value: string) => {
    const newCounts = { ...billCounts, [denom]: value };
    setBillCounts(newCounts);
    
    // Calculate total from counts
    const total = Object.entries(newCounts).reduce((acc, [d, count]) => {
      return acc + (Number(d) * (Number(count) || 0));
    }, 0);
    
    setOpeningFloat(total > 0 ? total.toFixed(2) : "");
  };

  const [isShiftHistoryOpen, setIsShiftHistoryOpen] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);

  // Fetch shift history
  useEffect(() => {
    if (!enterpriseId || !isShiftHistoryOpen) return;
    
    const q = query(
      collection(db, "pos_sessions"),
      where("enterprise_id", "==", enterpriseId),
      limit(50)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => {
        const tA = new Date(a.startTime).getTime() || 0;
        const tB = new Date(b.startTime).getTime() || 0;
        return tB - tA;
      });
      setShiftHistory(docs.slice(0, 20));
    });
    
    return () => unsub();
  }, [enterpriseId, isShiftHistoryOpen]);

  // ── Sync with Global Session ────────────────────────────────────
  useEffect(() => {
    if (posSession && !isAuthorized) {
      setIsAuthorized(true);
      setSelectedAdmin(posSession.staffData);
      setCurrentSessionId(posSession.sessionId);
    }
  }, [posSession]);

 // Sync with Global Session ────────────────────────────────────

  // Core Data Listeners (Required for login screen)
  useEffect(() => {
    if (!enterpriseId) return;

    const unsubStaff = onSnapshot(
      query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snapshot) => {
        const dbStaff = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setStaffList(dbStaff.map(s => ({ ...s, initials: (s.name || '').substring(0, 2).toUpperCase() })));
      },
      (err) => console.error("staff sync error:", err)
    );

    const unsubSessions = onSnapshot(
      query(collection(db, "pos_sessions"), where("enterprise_id", "==", enterpriseId), where("status", "in", ["ACTIVE", "ON_BREAK", "ON_LUNCH", "IN_MEETING"])),
      (snapshot) => setActiveSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("sessions sync error:", err)
    );

    return () => {
      unsubStaff();
      unsubSessions();
    };
  }, [enterpriseId]);

  // Operational Data Listeners (Post-Auth)
  useEffect(() => {
    if (!enterpriseId || !isAuthorized) {
      if (!isAuthorized) {
        setLoading(false);
      }
      return;
    }

    let isMounted = true;

    // Load static data once on authorization to reduce listener pressure
    const loadStaticData = async () => {
      try {
        const [bSnap, pSnap, cSnap, campSnap] = await Promise.all([
          getDocs(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId))),
          getDocs(query(collection(db, "products"), where("enterprise_id", "==", enterpriseId))),
          getDocs(query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId), where("status", "!=", "Archived"))),
          getDocs(query(collection(db, "campaigns"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")))
        ]);

        if (!isMounted) return;

        setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCampaigns(campSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } catch (err) {
        console.error("Static data load error:", err);
        if (isMounted) setLoading(false);
      }
    };

    loadStaticData();

    // Critical real-time inventory monitor
    const unsubInventory = onSnapshot(
      query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => {
        if (isMounted) setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("inventory sync error:", err)
    );

    return () => {
      isMounted = false;
      unsubInventory?.();
    };
  }, [enterpriseId, isAuthorized]);



  // Specific Session Monitor
  useEffect(() => {
    if (!currentSessionId || typeof currentSessionId !== 'string') {
      setCurrentSessionData(null);
      return;
    }

    const unsubSession = onSnapshot(
      doc(db, "pos_sessions", currentSessionId), 
      (docSnap) => {
        if (docSnap.exists()) {
          setCurrentSessionData(docSnap.data());
        }
      }, 
      (err) => console.error("session-monitor-error:", err)
    );

    return () => unsubSession();
  }, [currentSessionId]);

  // Global Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [sessionExpectedCash, setSessionExpectedCash] = useState(0);

  useEffect(() => {
    if (isClosePromptOpen && currentSessionId) {
      const q = query(
        collection(db, "transactions"), 
        where("sessionId", "==", currentSessionId),
        where("paymentMethod", "==", "CASH")
      );
      
      const unsub = onSnapshot(q, (snapshot) => {
        const cashTotal = snapshot.docs.reduce((acc, docSnap) => acc + (docSnap.data().total || 0), 0);
        const opening = currentSessionData?.openingFloat || 0;
        setSessionExpectedCash(opening + cashTotal);
      });
      
      return () => unsub();
    }
  }, [isClosePromptOpen, currentSessionId, currentSessionData]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      // General auto close schedule prompt
      if (autoCloseTime && autoCloseEnabled) {
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeString = `${currentHours}:${currentMinutes}`;
        if (currentTimeString === autoCloseTime && isAuthorized && !isClosePromptOpen) {
          setIsClosePromptOpen(true);
        }
      }

      // Check auto logouts for active break sessions that exceeded time
      const evaluateAutoLogout = async () => {
        for (const session of (activeSessions || [])) {
          if (!session || !session.id) continue;
          
          const startTime = new Date(session.startTime);
          const elapsedMinutes = (now.getTime() - startTime.getTime()) / 60000;
          
          let policies = timePolicies || { breakDuration: 15, lunchDuration: 30, meetingDuration: 60, gracePeriod: 10 };
          let allowedDuration = policies.gracePeriod;
          
          if (session.status === "ON_BREAK") allowedDuration = policies.breakDuration;
          if (session.status === "ON_LUNCH") allowedDuration = policies.lunchDuration;
          if (session.status === "IN_MEETING") allowedDuration = policies.meetingDuration;

          if (elapsedMinutes > allowedDuration + (policies.gracePeriod || 5)) {
            try {
              await updateDoc(doc(db, "pos_sessions", session.id), {
                status: "CLOSED",
                endTime: now.toISOString(),
                autoClosed: true,
                closeReason: `Time limit (${allowedDuration}m) exceeded`
              });
              
              await addDoc(collection(db, "audit_logs"), {
                action: "Shift Auto-Closed",
                details: `Staff member ${session.staffName || 'Unknown'} exceeded allowed time. Register closed automatically.`,
                timestamp: now.toISOString(),
                user: "System",
                enterprise_id: enterpriseId
              });
            } catch (err) {
              console.error("Failed to auto logout session", err);
            }
          }
        }
      };

      evaluateAutoLogout();
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [autoCloseTime, autoCloseEnabled, isAuthorized, isClosePromptOpen, activeSessions, timePolicies]);

  // Consume PendingAction dispatched from Dashboard quick-actions.
  // Using context is race-condition-safe; the old window event approach was unreliable
  // because POS may not have been mounted when the event fired.
  useEffect(() => {
    const action = consumeAction("pos");
    if (!action) return;
    if (action.action === "NEW_SALE") {
      setCart([]);
      setCartDiscount(null);
      setSelectedCustomer(null);
      document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus();
    } else if (action.action === "CLOSE_REGISTER") {
      setIsClosePromptOpen(true);
    }
  }, [consumeAction]);

  const getProductStock = useCallback((productId: string) => {
    if (activeBranch === "all") {
      return inventory
        .filter(i => i.product_id === productId)
        .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    }
    const item = inventory.find(i => i.product_id === productId && i.branch_id === activeBranch);
    return item ? (item.quantity || 0) : 0;
  }, [inventory, activeBranch]);

  const addToCart = useCallback((product: any) => {
    const stock = getProductStock(product.id);
    if (stock <= 0) {
      toast.error("Item out of stock at this branch");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.warning("Maximum available stock reached");
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      toast.success(`${product.name} added to cart`, {
        duration: 1000,
        position: "bottom-right"
      });
      return [...prev, { product, quantity: 1 }];
    });
  }, [getProductStock]);

  const handleScanResult = useCallback((data: string, type: 'barcode' | 'qr') => {
    const product = products.find(p => p.barcode === data || p.sku === data || p.id === data);
    if (product) {
      addToCart(product);
      toast.success(`Added ${product.name} to cart`);
      setIsScannerOpen(false); // Auto-close scanner on success
    } else {
      toast.error(`No product found for ${type}: ${data}`);
      // Not closing scanner here to allow user to try again or try different item
    }
  }, [products, addToCart, setIsScannerOpen]);

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const product = products.find(p => p.barcode === searchTerm || p.sku === searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (product) {
        addToCart(product);
        setSearchTerm("");
      } else {
        toast.error("Product not found");
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const stock = getProductStock(productId);
        const newQty = Math.min(stock, Math.max(1, item.quantity + delta));
        if (delta > 0 && newQty === item.quantity) {
          toast.error("Maximum available stock reached");
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  }, [inventory, activeBranch]);

  const handleApplyCampaign = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    // Check one-time restriction
    if (campaign.one_time_per_customer) {
      if (!selectedCustomer) {
        toast.error("Please select a customer first to apply this one-time reward.", {
          description: "One-time rewards require verified customer profiles."
        });
        return;
      }
      
      const usage = customerUsage.find(u => u.campaign_id === campaignId);
      if (usage) {
        const timestamp = usage.used_at;
        const date = (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)) || new Date();
        toast.error(`${campaign.name} is a one-time reward. This customer already benefited on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}.`, {
          duration: 8000,
          description: "Anti-fraud: duplicate reward attempt blocked."
        });
        return;
      }
    }
    
    // Support targeted products or default to all if empty array/undefined
    const targetProducts = campaign.target_products && campaign.target_products.length > 0 ? campaign.target_products : undefined;
    
    const val = Number(campaign.rules?.discount_value || 0);
    const type = campaign.rules?.discount_type === "Percentage" ? "Percentage" : "Fixed Amount";

    setCartDiscount({
      id: campaign.id,
      name: campaign.name,
      type: type as any,
      value: val,
      target_products: targetProducts || null,
      isLoyaltyReward: (campaign as any).isLoyaltyReward || false
    });
    setIsDiscountDialogOpen(false);
    toast.success(`Applied ${campaign.name} discount!`);
  };

  const handleApplyManualDiscount = () => {
    const val = Number(manualDiscount.value);
    if (!manualDiscount.value || isNaN(val) || val <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    // ── Grade-based discount cap ────────────────────────────────────
    const grade = posSession?.payGrade || "EXECUTIVE";
    const capPercent = grade === "STANDARD" ? 10 : grade === "SUPERVISOR" ? 25 : 100;
    if (manualDiscount.type === "Percentage" && val > capPercent) {
      toast.error(
        `Your ${grade} grade is limited to ${capPercent}% discounts. Ask a SUPERVISOR to override.`,
        { duration: 5000 }
      );
      return;
    }

    if (manualDiscount.type === "Percentage" && val > 100) {
      toast.error("Percentage discount cannot exceed 100%");
      return;
    }
    if (manualDiscount.type === "Fixed Amount" && val > subtotal) {
      toast.error(`Fixed discount (${formatCurrency(val)}) cannot exceed subtotal (${formatCurrency(subtotal)})`);
      return;
    }
    setCartDiscount({
      id: "manual",
      name: manualDiscount.name || "Manual Discount",
      type: manualDiscount.type as "Percentage" | "Fixed Amount",
      value: val
    });
    setIsDiscountDialogOpen(false);
    toast.success("Discount applied");
  };

  const subtotal = cart.reduce((sum, item) => {
    const basePrice = (item.product.retail_price || item.product.price || 0);
    let itemTotal = basePrice * item.quantity;
    
    if (item.discount) {
      if (item.discount.type === "Percentage") {
        itemTotal -= (itemTotal * (item.discount.value / 100));
      } else {
        itemTotal -= Math.min(itemTotal, item.discount.value * item.quantity);
      }
    }
    return sum + itemTotal;
  }, 0);
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Helper for item-level gross (before discounts) if needed for reporting
  const grossSubtotal = cart.reduce((sum, item) => sum + ((item.product.retail_price || item.product.price || 0) * item.quantity), 0);

  const eligibleCampaigns = useMemo(() => {
    if (totalItems === 0) return [];
    
    const list = campaigns.filter(c => {
      // 1. Status Check
      if (c.status !== "ACTIVE") return false;

      // 2. Branch Check (Multi-select support)
      if (activeBranch !== "all" && c.branches && c.branches.length > 0) {
        if (!c.branches.includes(activeBranch)) return false;
      }

      // 3. Customer Group Check
      if (c.target_customers && c.target_customers !== "All Customers") {
        if (!selectedCustomer || selectedCustomer.group !== c.target_customers) return false;
      }

      // 4. Threshold Check (Spend/Quantity)
      const reqType = c.rules?.requirement_type || "quantity";
      
      if (reqType === "spend") {
        const minSpend = Number(c.rules?.min_spend || 0);
        if (subtotal < minSpend) return false;
      } else {
        const reqQty = Number(c.rules?.req_quantity || 1);
        if (totalItems < reqQty) return false;
      }
      
      return true;
    });

    // Integrated point-based loyalty rewards
    if (selectedCustomer && (selectedCustomer.points || 0) >= (loyaltySettings.pointsRequiredForReward || 100)) {
      list.unshift({
        id: "LOYALTY_POINTS_REWARD",
        name: "Loyalty Points Reward",
        description: `Redeem your points for a ${formatCurrency(loyaltySettings.rewardValue || 0)} discount`,
        rules: {
          discount_type: "Fixed Amount",
          discount_value: String(loyaltySettings.rewardValue || 0)
        },
        type: "Loyalty Points",
        isLoyaltyReward: true
      });
    }

    return list;
  }, [campaigns, totalItems, selectedCustomer, loyaltySettings, formatCurrency]);

  let discountAmount = 0;
  if (cartDiscount) {
    let eligibleSubtotal = subtotal;
    
    // If the discount applies to specific targeted products
    if (cartDiscount.target_products && cartDiscount.target_products.length > 0) {
      eligibleSubtotal = cart.reduce((sum, item) => {
        if (cartDiscount.target_products?.includes(item.product.id)) {
           return sum + ((item.product.retail_price || item.product.price || 0) * item.quantity);
        }
        return sum;
      }, 0);
    }
    
    if (cartDiscount.type === "Percentage") {
      discountAmount = eligibleSubtotal * (cartDiscount.value / 100);
    } else {
      discountAmount = Math.min(eligibleSubtotal, cartDiscount.value);
    }
  }

  // Tax is calculated on the GROSS subtotal before rewards/discounts are applied 
  // to ensure correct tax reporting for loyalty-based transactions.
  const calculatedTaxRate = (globalTaxRate || 15) / 100;
  const tax = isTaxEnabled ? (subtotal * calculatedTaxRate) : 0;
  const total = Math.max(0, subtotal + tax - discountAmount);

  const handleCompleteTransaction = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (isProcessing) return; // idempotency guard

    setIsProcessing(true);
    try {
      const resolvedBranch = activeBranch === "all" ? "main" : activeBranch;

      // 1. Write the transaction document
      const txRef = await addDoc(collection(db, "transactions"), {
        items: cart.map(item => {
          const basePrice = item.product.retail_price || item.product.price || 0;
          const baseTotal = basePrice * item.quantity;
          let discountVal = 0;
          if (item.discount) {
            if (item.discount.type === "Percentage") {
              discountVal = baseTotal * (item.discount.value / 100);
            } else {
              discountVal = item.discount.value * item.quantity;
            }
          }
          return {
            product_id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: basePrice,
            discount: item.discount || null,
            subtotal: baseTotal - discountVal
          };
        }),
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        branch_id: resolvedBranch,
        payment_method: paymentMethod,
        subtotal,
        discount: cartDiscount ? { ...cartDiscount, amount: discountAmount } : null,
        discount_amount: discountAmount,
        tax_rate: globalTaxRate || 0,
        tax_enabled: isTaxEnabled,
        tax,
        total,
        status: "COMPLETED",
        cashier_id: selectedAdmin?.id || null,
        cashier_name: selectedAdmin?.name || null,
        // sessionId is REQUIRED for cash reconciliation in handleCloseRegister.
        // The close dialog queries transactions where sessionId == currentSessionId
        // to compute expected cash. Omitting this field causes $0 discrepancy report.
        sessionId: currentSessionId || null,
        timestamp: serverTimestamp(),
        enterprise_id: enterpriseId
      });

      // 1.5 Record to Double-Entry Ledger
      await recordFinancialEvent({
        enterpriseId,
        amount: total,
        sourceId: txRef.id,
        sourceType: "POS_TRANSACTION",
        description: `POS Sale - ${cart.length} items`,
        metadata: { cashier: selectedAdmin?.name, customer: selectedCustomer?.name }
      });

      // 2. Deduct inventory quantity for each item
      await Promise.all(cart.map(async (item) => {
        const invItem = inventory.find(i =>
          i.product_id === item.product.id &&
          (activeBranch === "all" ? true : i.branch_id === resolvedBranch)
        );
        if (invItem) {
          await updateDoc(doc(db, "inventory", invItem.id), {
            quantity: increment(-item.quantity)
          });
        }
      }));

      // 3. Update customer LTV and Loyalty Points if linked
      if (selectedCustomer?.id) {
        // Calculate point earnings based on settings
        // Assuming 1 point per dollar spent if not configured elsewhere
        const pointsEarned = Math.floor(total);
        const pointAdjustment = (cartDiscount as any)?.isLoyaltyReward 
          ? -(loyaltySettings.pointsRequiredForReward || 100) 
          : pointsEarned;

        await updateDoc(doc(db, "customers", selectedCustomer.id), {
          spend: increment(total),
          points: increment(pointAdjustment),
          last_purchase_date: serverTimestamp(),
          lastContact: new Date().toISOString()
        });
      }

      // 4. Audit log
      await addDoc(collection(db, "audit_logs"), {
        action: "Sale Completed",
        details: `${cart.length} item(s) sold for ${formatCurrency(total)} via ${paymentMethod}`,
        timestamp: serverTimestamp(),
        user: selectedAdmin?.name || "Cashier",
        enterprise_id: enterpriseId
      });

      // Record Campaign Usage for one-time rewards
      if (cartDiscount) {
        const campaign = campaigns.find(c => c.id === cartDiscount.id);
        if (campaign && campaign.one_time_per_customer && selectedCustomer?.id) {
          await addDoc(collection(db, "customer_campaign_usage"), {
            customer_id: selectedCustomer.id,
            customer_name: selectedCustomer.name,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            used_at: serverTimestamp(),
            transaction_id: txRef.id,
            enterprise_id: enterpriseId,
            staff_name: selectedAdmin?.name || "System",
            staff_id: selectedAdmin?.id || "system"
          });
        }
      }

      setLastTransaction({
        id: txRef.id,
        items: [...cart],
        total,
        tax,
        discountAmount,
        subtotal,
        timestamp: new Date().toLocaleString(),
        paymentMethod,
        customer: selectedCustomer
      });
      setShowReceipt(true);
      setCart([]);
      setCartDiscount(null);
      setSelectedCustomer(null);
      toast.success("Transaction completed!");
    } catch (error: any) {
      console.error("Transaction error:", error);
      toast.error("Transaction failed: " + (error.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePinInput = async (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      if (newPin.length === 4) {
        if (selectedAdmin && newPin === selectedAdmin.pin) {
          try {
            if (!enterpriseId) {
              toast.error("System state initializing... please wait.");
              return;
            }

            // Check for an existing open session for this user at this branch
            // Simplified query to avoid index-related SDK assertion crashes during PIN entry
            const activeSessionQuery = query(
              collection(db, "pos_sessions"),
              where("enterprise_id", "==", enterpriseId),
              where("staffId", "==", selectedAdmin.id || ""),
              where("status", "in", ["ACTIVE", "ON_BREAK", "ON_LUNCH"]),
              limit(1)
            );
            const activeSessionSnap = await getDocs(activeSessionQuery);
            
            if (!activeSessionSnap.empty) {
              // Resume session
              const existingSession = activeSessionSnap.docs[0];
              const sessionData = existingSession.data();
              
              if (sessionData.status !== "ACTIVE") {
                 await updateDoc(doc(db, "pos_sessions", existingSession.id), {
                   status: "ACTIVE",
                   lastActivity: new Date().toISOString()
                 });
                 await addDoc(collection(db, "audit_logs"), {
                   action: "Shift Resumed",
                   details: `Staff member ${selectedAdmin.name} returned from ${sessionData.status.replace('_', ' ')}`,
                   timestamp: new Date().toISOString(),
                   user: selectedAdmin.name,
                   enterprise_id: enterpriseId
                 });
              } else {
                 await addDoc(collection(db, "audit_logs"), {
                   action: "Terminal Unlocked",
                   details: `Staff member ${selectedAdmin.name} unlocked the terminal`,
                   timestamp: new Date().toISOString(),
                   user: selectedAdmin.name,
                   enterprise_id: enterpriseId
                 });
              }
              const sysId = activeSessionSnap.docs[0].id;
              const existingStatus = (activeSessionSnap.docs[0].data().status || "ACTIVE") as "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING";
              setCurrentSessionId(sysId);
              toast.success(`Welcome back, ${selectedAdmin.name}`);
               const primaryBranch = selectedAdmin.branches?.[0];
               if (primaryBranch && primaryBranch !== "all") {
                 setActiveBranch(primaryBranch);
               }
               
               setIsAuthorized(true);
              setPosSession({
                staffId: selectedAdmin.id,
                staffName: selectedAdmin.name,
                payGrade: selectedAdmin.payGrade || 'STANDARD',
                sessionId: sysId,
                staffData: selectedAdmin,
                shiftStatus: existingStatus,
                statusSince: activeSessionSnap.docs[0].data().lastActivity || new Date().toISOString()
              });
            } else {
               // Update global branch if user has a primary one
               const primaryBranch = selectedAdmin.branches?.[0];
               if (primaryBranch && primaryBranch !== "all") {
                 setActiveBranch(primaryBranch);
               }

               // Instead of immediate creation, trigger the Opening Float Prompt
               setIsAuthorized(true);
               setIsOpeningFloatOpen(true);
               toast.info(`Welcome, ${selectedAdmin.name}. Please set opening float.`);
             }
          } catch (error: any) {
            toast.error("Failed to start session: " + error.message);
            setPinEntry("");
          }
        } else {
          toast.error("Invalid PIN");
          setPinEntry("");
        }
      }
    }
  };

  const handleConfirmOpeningFloat = async () => {
    if (!selectedAdmin || !openingFloat) {
      toast.error("Please enter a valid opening float");
      return;
    }

    try {
      const primaryBranch = selectedAdmin.branches?.[0];
      const targetBranch = (primaryBranch && primaryBranch !== "all") ? primaryBranch : activeBranch;
      
      const docRef = await addDoc(collection(db, "pos_sessions"), {
        staffId: selectedAdmin.id,
        staffName: selectedAdmin.name,
        branchId: targetBranch,
        startTime: new Date().toISOString(),
        status: "ACTIVE",
        enterprise_id: enterpriseId,
        openingFloat: parseFloat(openingFloat) || 0
      });

      await addDoc(collection(db, "audit_logs"), {
        action: "Shift Started",
        details: `Staff member ${selectedAdmin.name} started shift with float: ${openingFloat}`,
        timestamp: new Date().toISOString(),
        user: selectedAdmin.name,
        enterprise_id: enterpriseId
      });

      setCurrentSessionId(docRef.id);
      setIsOpeningFloatOpen(false);
      setIsAuthorized(true);
      setPosSession({
        staffId: selectedAdmin.id,
        staffName: selectedAdmin.name,
        payGrade: selectedAdmin.payGrade || 'STANDARD',
        sessionId: docRef.id,
        staffData: selectedAdmin,
        shiftStatus: "ACTIVE",
        statusSince: new Date().toISOString()
      });
      
      toast.success("Shift started with float amount confirmed.");
      setOpeningFloat(""); // Clear for next use
    } catch (err: any) {
      toast.error("Failed to start session: " + err.message);
    }
  };

  const handleTimeClock = async (statusType: "ACTIVE" | "ON_BREAK" | "ON_LUNCH" | "IN_MEETING" | "LOCKED") => {
    if (currentSessionId && statusType !== "LOCKED") {
      try {
        await updateDoc(doc(db, "pos_sessions", currentSessionId), {
          status: statusType,
          lastActivity: new Date().toISOString()
        });
        
        await addDoc(collection(db, "audit_logs"), {
          action: "Shift Status Change",
          details: `Staff member ${selectedAdmin?.name || 'Unknown'} changed status to ${statusType.replace('_', ' ')}`,
          timestamp: new Date().toISOString(),
          user: selectedAdmin?.name || "System",
          enterprise_id: enterpriseId
        });

        toast.info(`Status updated to ${statusType.replace('_', ' ')}`);
      } catch (err) {
        toast.error("Failed to update status");
      }
    } else if (statusType === "LOCKED") {
      try {
        await addDoc(collection(db, "audit_logs"), {
          action: "Terminal Locked",
          details: `Staff member ${selectedAdmin?.name || 'Unknown'} locked the terminal`,
          timestamp: new Date().toISOString(),
          user: selectedAdmin?.name || "System",
          enterprise_id: enterpriseId
        });
      } catch (err) { }
      toast.info("Terminal Locked");
    }
    
    // Auto-lock terminal layout back to PIN screen safely
    setTimeout(() => {
      setIsAuthorized(false);
      setSelectedAdmin(null);
      setPinEntry("");
      // Only clear the GLOBAL session if they explicitly locked it or closed shift
      if (statusType === "LOCKED") {
        clearSession();
      }
    }, 150);
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinEntry("");
  };

  const getSessionStatusInfo = (staffId: string) => {
    const session = activeSessions.find(s => s.staffId === staffId && s.status !== "CLOSED");
    if (!session) return null;
    
    const targetTime = new Date(session.lastActivity || session.startTime);
    const diffInSeconds = Math.max(0, Math.floor((currentTime.getTime() - targetTime.getTime()) / 1000));
    const minutes = Math.floor(diffInSeconds / 60);
    const seconds = diffInSeconds % 60;
    const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    let styles = "bg-zinc-100 text-zinc-600";
    let label = "Working";
    
    if (session.status === "ACTIVE") {
      styles = "bg-emerald-50 text-emerald-600 border-emerald-100";
    } else if (session.status === "ON_BREAK") {
      styles = "bg-amber-50 text-amber-600 border-amber-100";
      label = "On Break";
    } else if (session.status === "ON_LUNCH") {
      styles = "bg-blue-50 text-blue-600 border-blue-100";
      label = "On Lunch";
    } else if (session.status === "IN_MEETING") {
      styles = "bg-purple-50 text-purple-600 border-purple-100";
      label = "In Meeting";
    }
    
    return { label, formattedTimer, styles };
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50/50 p-6">
        <Card className="card-modern shadow-xl overflow-hidden rounded-3xl border-zinc-200 max-w-md w-full">
          <CardContent className="p-8 space-y-6 relative">
            
            <div className="flex flex-col items-center justify-center gap-3 pb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">Terminal Locked</h2>
              <p className="text-zinc-500 text-sm text-center">Select your profile and enter your PIN to access the register.</p>
            </div>

            {!selectedAdmin ? (
              <div className="space-y-4 pt-4 border-t border-zinc-100 max-h-[400px] overflow-y-auto pr-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center sticky top-0 bg-white z-10 py-2">Select User</p>
                {staffList.map(admin => {
                  const statusInfo = getSessionStatusInfo(admin.id);
                  return (
                    <div 
                      key={admin.id}
                      className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer transition-all shadow-sm"
                      onClick={() => setSelectedAdmin(admin)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-sm tracking-wider">{admin.initials}</span>
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{admin.name}</p>
                          <p className="text-xs font-medium text-zinc-500">{admin.role}</p>
                        </div>
                      </div>
                      {statusInfo && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={cn("text-[9px] uppercase font-bold py-0.5", statusInfo.styles)}>{statusInfo.label}</Badge>
                          <span className="text-xs font-mono font-bold text-zinc-500">{statusInfo.formattedTimer}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-6 pt-4 border-t border-zinc-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-center flex-col gap-3 relative">
                  <Button variant="ghost" size="icon" className="absolute left-0 top-0 h-8 w-8 rounded-full" onClick={() => { setSelectedAdmin(null); setPinEntry(""); }}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-900/20">
                    <span className="text-white font-bold text-lg tracking-wider">{selectedAdmin.initials}</span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-zinc-900 text-lg leading-tight">{selectedAdmin.name}</p>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3].map((index) => (
                      <div 
                        key={index} 
                        className={cn(
                          "w-4 h-4 rounded-full border-2 transition-all duration-200",
                          pinEntry.length > index ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button 
                      key={num} 
                      variant="outline" 
                      className="h-16 rounded-2xl text-2xl font-bold bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm transition-all active:scale-95"
                      onClick={() => handlePinInput(num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button variant="outline" className="h-16 rounded-2xl text-sm font-bold uppercase tracking-widest bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm text-zinc-500 transition-all active:scale-95" onClick={handleClear}>Clear</Button>
                  <Button variant="outline" className="h-16 rounded-2xl text-2xl font-bold bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm transition-all active:scale-95" onClick={() => handlePinInput("0")}>0</Button>
                  <Button variant="outline" className="h-16 rounded-2xl text-lg font-bold bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm text-zinc-500 flex items-center justify-center transition-all active:scale-95" onClick={handleBackspace}>
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            )}
            
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCloseRegister = async () => {
    if (currentSessionId) {
      try {
        const actualCount = parseFloat(countedCash) || 0;
        const variance = actualCount - sessionExpectedCash;

        await updateDoc(doc(db, "pos_sessions", currentSessionId), {
          endTime: new Date().toISOString(),
          status: "CLOSED",
          countedCash: actualCount,
          expectedCash: sessionExpectedCash,
          variance: variance,
          notes: closeRegisterNotes
        });
        
        await recordAuditLog({
          enterpriseId,
          action: "POS_REGISTER_CLOSE",
          details: `Staff member ${selectedAdmin?.name || 'Unknown'} closed register. Variance: ${formatCurrency(variance)}`,
          severity: Math.abs(variance) > 5 ? "CRITICAL" : "INFO",
          type: "FINANCE",
          metadata: { 
            sessionId: currentSessionId, 
            expected: sessionExpectedCash, 
            actual: actualCount,
            variance: variance
          }
        });
      } catch (error) {
        console.error("Failed to update session record", error);
      }
    }

    const isStandard = selectedAdmin?.payGrade === "STANDARD";
    const staffName = selectedAdmin?.name || 'User';

    toast.success(`Register closed successfully for ${staffName}`);
    setIsClosePromptOpen(false);
    setIsAuthorized(false);
    setSelectedAdmin(null);
    setPinEntry("");
    setCountedCash("");
    setCloseRegisterNotes("");
    setCurrentSessionId(null);
    setPosSession(null);

    if (isStandard) {
      toast.info("Standard session ended. Signing out of website...", { duration: 3000 });
      setTimeout(() => logout(), 1500);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50/50 relative">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Branch: {(activeBranch || 'all').toUpperCase()}</span>
                {selectedAdmin?.name && (
                  <>
                    <span className="text-zinc-300 mx-1">•</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Operator: {selectedAdmin.name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-zinc-900 font-display whitespace-nowrap">Terminal</h1>
                  
                  {isCartCollapsed && (
                    <Button 
                      onClick={() => setIsCartCollapsed(false)}
                      variant="outline"
                      className="hidden md:flex items-center gap-2 rounded-xl h-10 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all animate-in fade-in slide-in-from-left-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Show Order ({cart.length})</span>
                    </Button>
                  )}
                </div>
                {posSession?.sessionId && (
                  <div className="flex items-center gap-3">
                    {/* Duty Status Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        render={
                          <button 
                            className={cn(
                              "outline-none rounded-xl h-11 px-4 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm transition-all flex items-center gap-3 cursor-pointer select-none",
                              (currentSessionData?.status === 'ON_BREAK') && "border-amber-200 bg-amber-50/30 text-amber-600",
                              (currentSessionData?.status === 'ON_LUNCH') && "border-orange-200 bg-orange-50/30 text-orange-600",
                              (currentSessionData?.status === 'IN_MEETING') && "border-indigo-200 bg-indigo-50/30 text-indigo-600"
                            )}
                          >
                            <div className="flex items-center gap-2">
                               {(() => {
                                 const s = currentSessionData?.status || 'ACTIVE';
                                 if (s === 'ON_BREAK') return <Coffee className="w-4 h-4" />;
                                 if (s === 'ON_LUNCH') return <Utensils className="w-4 h-4" />;
                                 if (s === 'IN_MEETING') return <Users className="w-4 h-4" />;
                                 return <Play className="w-4 h-4 text-emerald-500" />;
                               })()}
                               <span className="text-xs font-black uppercase tracking-widest">
                                 {currentSessionData?.status?.replace('ON_', '').replace('IN_', '') || 'On Duty'}
                               </span>
                            </div>
                            <ChevronRight className="w-4 h-4 rotate-90 text-zinc-400" />
                          </button>
                        }
                      />
                      <DropdownMenuContent className="w-64 rounded-2xl p-1 shadow-2xl border-none bg-white/95 backdrop-blur-xl" align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="px-3 py-3 border-b border-zinc-100 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Shift Summary</p>
                            <div className="space-y-2">
                               <div className="flex items-center justify-between text-[10px] font-bold">
                                 <span className="text-zinc-500 uppercase tracking-tighter">Shift Started</span>
                                 <span className="text-zinc-900 font-black">{new Date(currentSessionData?.startTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                               <div className="flex items-center justify-between text-[10px] font-bold border-t border-zinc-50 pt-2">
                                 <span className="text-zinc-500 uppercase tracking-tighter">Opening Float</span>
                                 <span className="text-blue-600 font-black">{formatCurrency(currentSessionData?.openingFloat || 0)}</span>
                               </div>
                            </div>
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-3 py-2">Duty Controls</DropdownMenuLabel>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-emerald-50 cursor-pointer group" onClick={() => handleTimeClock('ACTIVE')}>
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">Resume Duty</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-amber-50 cursor-pointer group" onClick={() => handleTimeClock('ON_BREAK')}>
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <Coffee className="w-4 h-4 text-amber-600" />
                            </div>
                          <span className="font-bold text-zinc-700 text-sm">On Break</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-orange-50 cursor-pointer group" onClick={() => handleTimeClock('ON_LUNCH')}>
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <Utensils className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">On Lunch</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-indigo-50 cursor-pointer group" onClick={() => handleTimeClock('IN_MEETING')}>
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <Users className="w-4 h-4 text-indigo-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">In Meeting</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-zinc-100 cursor-pointer group" onClick={() => setIsShiftHistoryOpen(true)}>
                            <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <History className="w-4 h-4 text-zinc-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">Shift Records</span>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                          <DropdownMenuSeparator className="bg-zinc-100" />
                          <DropdownMenuItem 
                            className="rounded-xl h-12 px-3 focus:bg-rose-50 cursor-pointer group" 
                            onClick={() => setIsClosePromptOpen(true)}
                          >
                            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <History className="w-4 h-4 text-rose-600" />
                            </div>
                            <span className="font-bold text-rose-700 text-sm">End Shift</span>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              <p className="text-xs lg:text-sm text-zinc-500">Quick-access product catalog and barcode scanner.</p>
            </div>
            <div className="relative w-full md:w-96 group flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                <Input 
                  placeholder="Scan or search..." 
                  className="pl-10 rounded-xl border-zinc-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all h-11 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                />
              </div>
              <Button 
                variant="outline" 
                className="h-11 px-4 rounded-xl border-zinc-200 bg-white shadow-sm hover:bg-zinc-50"
                onClick={() => setIsScannerOpen(true)}
              >
                <ScanLine className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {["All Items", ...Array.from(new Set(products.map(p => p.category || "Other").filter(Boolean)))].map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className={cn(
                  "px-4 py-1.5 rounded-full cursor-pointer transition-all border shrink-0 text-[10px] font-bold uppercase tracking-wider",
                  selectedCategory === cat
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 lg:px-8 pb-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-zinc-100 bg-white overflow-hidden animate-pulse">
                  <div className="aspect-square bg-zinc-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-zinc-100 rounded w-3/4" />
                    <div className="h-3 bg-zinc-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            <AnimatePresence>
              {products.filter(p => {
                const name = (p.name || "").toLowerCase();
                const category = (p.category || "").toLowerCase();
                const term = searchTerm.toLowerCase();
                const matchesSearch = !term || name.includes(term) || category.includes(term);
                const matchesCategory = selectedCategory === "All Items" || (p.category || "Other") === selectedCategory;
                return matchesSearch && matchesCategory;
              }).map((product) => {
                const stock = getProductStock(product.id);
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Card 
                      className="card-modern group cursor-pointer overflow-hidden border-zinc-200 hover:border-blue-500/50 transition-all"
                      onClick={() => addToCart(product)}
                    >
                      <div className="aspect-square overflow-hidden bg-zinc-100 relative">
                        <img 
                          src={product.image_url || product.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400"} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1581646730702-60193386ec9c?auto=format&fit=crop&q=80&w=400";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
                            <Plus className="w-5 h-5 text-zinc-900" />
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-zinc-900 truncate">{product.name}</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(product.retail_price || product.price || 0)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{product.category}</p>
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-bold uppercase",
                            stock < 10 ? "text-rose-500 border-rose-100 bg-rose-50" : "text-emerald-500 border-emerald-100 bg-emerald-50"
                          )}>
                            {stock} in stock
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          )}
        </ScrollArea>
      </div>

      {/* Mobile cart backdrop */}
      {isCartOpenOnMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsCartOpenOnMobile(false)}
        />
      )}

      {/* Cart Sidebar */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[420px] border-l border-zinc-200 bg-white flex flex-col shadow-2xl z-40 transition-all duration-500 ease-in-out",
        "md:relative md:shadow-xl md:z-auto",
        isCartOpenOnMobile ? "translate-x-0" : "translate-x-full md:translate-x-0",
        isCartCollapsed ? "md:w-0 md:opacity-0 md:pointer-events-none -mr-4" : "md:w-[400px] md:opacity-100"
      )}>
        <div className="flex-none p-6 lg:p-8 border-b border-zinc-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-zinc-900" />
              <h2 className="text-xl font-bold tracking-tight font-display">Current Order</h2>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl border-zinc-200 h-9 font-bold text-[10px] uppercase tracking-wider"
              onClick={() => setIsCustomItemDialogOpen(true)}
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Custom
            </Button>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white border-none px-2 py-0.5 rounded-lg">{cart.length} items</Badge>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsCartOpenOnMobile(false)}>
                <X className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hidden md:flex text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl" onClick={() => setIsCartCollapsed(true)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full justify-start rounded-2xl border-zinc-200 h-14 text-zinc-500 hover:text-zinc-900 bg-zinc-50/50 group transition-all hover:bg-white hover:border-blue-500/30"
            onClick={() => setIsCustomerSearchOpen(true)}
          >
            {selectedCustomer ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shadow-inner">
                    {(selectedCustomer.name || 'CU').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-zinc-900">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Account</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-right">
                     <p className="text-[10px] font-black text-emerald-600">{selectedCustomer.points || 0} PTS</p>
                   </div>
                   <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-zinc-900">Walk-in Customer</p>
                  <p className="text-[10px] text-zinc-400 font-medium">Click to link existing account</p>
                </div>
              </div>
            )}
          </Button>
          
          {/* AI Upsell Suggestion */}
          <POSAIUpsell 
            cart={cart} 
            allProducts={products} 
            onAdd={(product) => addToCart(product)} 
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="flex-1 min-h-0 relative">
          <ScrollArea className="absolute inset-0 p-8">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-10 h-10 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Cart is empty</p>
                <p className="text-xs text-zinc-500">Scan items to begin checkout</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div 
                    key={item.product.id} 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-4 group"
                  >
                    <div className="w-16 h-16 rounded-xl bg-zinc-100 overflow-hidden shrink-0 border border-zinc-100">
                      <img src={item.product.image_url || item.product.image} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col mb-1">
                          <p className="text-sm font-bold text-zinc-900 truncate">{item.product.name}</p>
                          {item.discount && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              -{item.discount.type === "Percentage" ? `${item.discount.value}%` : formatCurrency(item.discount.value)} off
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-zinc-900">
                          {formatCurrency(
                            ((item.product.retail_price || item.product.price || 0) * item.quantity) - 
                            (item.discount ? (item.discount.type === "Percentage" ? ((item.product.retail_price || item.product.price || 0) * item.quantity * (item.discount.value / 100)) : (item.discount.value * item.quantity)) : 0)
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-zinc-100 rounded-lg p-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-6 h-6 rounded-md hover:bg-white"
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-6 h-6 rounded-md hover:bg-white"
                              onClick={() => updateQuantity(item.product.id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                              "h-8 rounded-lg text-[10px] font-black uppercase tracking-widest",
                              item.discount ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50" : "text-zinc-400 hover:text-zinc-900"
                            )}
                            onClick={() => {
                              setSelectedItemForDiscount(item.product.id);
                              setItemDiscount({ 
                                type: item.discount?.type || "Percentage", 
                                value: item.discount?.value?.toString() || "" 
                              });
                              setIsItemDiscountDialogOpen(true);
                            }}
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {item.discount ? "Adjust Discount" : "Add Discount"}
                          </Button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          </ScrollArea>
        </div>

        <div className="flex-none p-8 bg-zinc-50 border-t border-zinc-200 space-y-6">
          
          <AnimatePresence>
            {eligibleCampaigns.length > 0 && (activeBranch === "all" || !cartDiscount) && (
              <motion.div 
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm mb-4">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">Rewards Unlocked</span>
                  </div>
                  <div className="space-y-2">
                    {eligibleCampaigns.map(campaign => {
                      const isUsed = campaign.one_time_per_customer && customerUsage.some(u => u.campaign_id === campaign.id);
                      const isApplied = cartDiscount && cartDiscount.id === campaign.id;
                      return (
                        <div key={campaign.id} className={cn(
                          "flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm transition-all relative overflow-hidden",
                          isUsed ? "opacity-60 grayscale border-zinc-200" : "border-indigo-100/50 hover:shadow-md hover:border-indigo-200"
                        )}>
                          <div className="flex flex-col flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-900 truncate">{campaign.name}</span>
                              {isUsed && <Badge variant="outline" className="h-4 text-[8px] font-black uppercase text-rose-600 border-rose-200 bg-rose-50">Already Used</Badge>}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-medium truncate">
                              {isUsed ? `Claimed on ${customerUsage.find(u => u.campaign_id === campaign.id)?.used_at?.toDate ? customerUsage.find(u => u.campaign_id === campaign.id).used_at.toDate().toLocaleDateString() : 'N/A'}` : (campaign.description || 'Exclusive discount available')}
                            </span>
                            {activeBranch === "all" && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {!campaign.branches || campaign.branches.length === 0 ? (
                                  <Badge variant="outline" className="text-[8px] font-black uppercase text-blue-600 border-blue-100 bg-blue-50/50">All Branches</Badge>
                                ) : (
                                  campaign.branches.map((bId: string) => {
                                    const bName = branches.find(b => b.id === bId)?.name || bId;
                                    return (
                                      <Badge key={bId} variant="outline" className="text-[8px] font-black uppercase text-zinc-500 border-zinc-200">
                                        {bName}
                                      </Badge>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            className={cn(
                              "h-8 text-xs font-bold rounded-lg shadow-sm",
                              isUsed ? "bg-zinc-100 text-zinc-400 hover:bg-zinc-100" : 
                              isApplied ? "bg-emerald-600 hover:bg-emerald-700 text-white" : 
                              "bg-indigo-600 hover:bg-indigo-700 text-white"
                            )}
                            onClick={() => handleApplyCampaign(campaign.id)}
                            disabled={isUsed || isApplied}
                          >
                            {isUsed ? "Locked" : isApplied ? "Applied" : "Apply"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl h-10 border-zinc-200 text-xs font-bold text-zinc-600 bg-white"
              onClick={() => { setDiscountContext("Campaign"); setIsDiscountDialogOpen(true); }}
            >
              <Tag className="w-3.5 h-3.5 mr-2" />
              Apply Campaign
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl h-10 border-zinc-200 text-xs font-bold text-zinc-600 bg-white"
              onClick={() => { setDiscountContext("Manual"); setIsDiscountDialogOpen(true); }}
            >
              <Percent className="w-3.5 h-3.5 mr-2" />
              Custom Discount
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium text-zinc-900">{formatCurrency(subtotal)}</span>
            </div>
            
            {cartDiscount && (
              <div className="flex justify-between text-sm items-center text-emerald-600">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{cartDiscount.name}</span>
                  <button onClick={() => setCartDiscount(null)} className="text-rose-500 hover:text-rose-700 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-medium">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm items-center">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Tax ({globalTaxRate}%)</span>
                <button 
                  onClick={() => setIsTaxEnabled(!isTaxEnabled)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    isTaxEnabled ? "bg-blue-600" : "bg-zinc-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                    isTaxEnabled ? "left-4.5" : "left-0.5"
                  )} />
                </button>
              </div>
              <span className="font-medium text-zinc-900">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold pt-4 border-t border-zinc-200">
              <span className="text-zinc-900">Total</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={paymentMethod === "CARD" ? "default" : "outline"}
              className={cn("rounded-xl h-12 font-bold text-xs", paymentMethod === "CARD" && "bg-zinc-900")}
              onClick={() => setPaymentMethod("CARD")}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Card
            </Button>
            <Button 
              variant={paymentMethod === "CASH" ? "default" : "outline"}
              className={cn("rounded-xl h-12 font-bold text-xs", paymentMethod === "CASH" && "bg-zinc-900")}
              onClick={() => setPaymentMethod("CASH")}
            >
              <Banknote className="w-4 h-4 mr-2" />
              Cash
            </Button>
            <Button 
              variant={paymentMethod === "SPLIT" ? "default" : "outline"}
              className={cn("rounded-xl h-12 font-bold text-xs", paymentMethod === "SPLIT" && "bg-zinc-900")}
              onClick={() => setPaymentMethod("SPLIT")}
            >
              <Split className="w-4 h-4 mr-2" />
              Split
            </Button>
          </div>

          <Button 
            className="w-full rounded-xl h-14 bg-blue-600 text-white hover:bg-blue-700 font-bold text-lg shadow-xl shadow-blue-600/20 disabled:opacity-50"
            onClick={handleCompleteTransaction}
            disabled={isProcessing || cart.length === 0}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              <>
                Complete Transaction
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>


      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-[850px] w-full rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-zinc-100">
          <div className="max-h-[85vh] overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-6">
            <div className="w-full flex justify-between items-center mb-2 px-4">
               <div>
                  <h2 className="text-xl font-bold text-zinc-900">Transaction Finalized</h2>
                  <p className="text-xs text-zinc-500">Order #{(lastTransaction?.id || 'PENDING').substring(0,8).toUpperCase()}</p>
               </div>
               <div className="flex gap-2">
                   <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-4 font-bold border-zinc-200"
                    onClick={() => {
                       const elementId = receiptType === "POS" ? "pos-receipt" : "printable-invoice";
                       const printContents = document.getElementById(elementId)?.innerHTML;
                       if (printContents) {
                         const originalContents = document.body.innerHTML;
                         document.body.innerHTML = printContents;
                         window.print();
                         document.body.innerHTML = originalContents;
                         window.location.reload(); 
                       } else {
                         window.print();
                       }
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <div className="flex bg-zinc-200 p-1 rounded-xl gap-1">
                    <Button 
                      variant="ghost" 
                      className={cn("rounded-lg h-8 px-3 text-[10px] font-black uppercase tracking-widest", receiptType === "POS" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-600")}
                      onClick={() => setReceiptType("POS")}
                    >
                      POS
                    </Button>
                    <Button 
                      variant="ghost" 
                      className={cn("rounded-lg h-8 px-3 text-[10px] font-black uppercase tracking-widest", receiptType === "INVOICE" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-600")}
                      onClick={() => setReceiptType("INVOICE")}
                    >
                      A4
                    </Button>
                  </div>
                   <Button 
                    className="rounded-xl h-10 px-6 font-bold bg-zinc-900 text-white"
                    onClick={() => setShowReceipt(false)}
                  >
                    New Sale
                  </Button>
               </div>
            </div>

            {lastTransaction && (
              <div className="w-full h-fit flex justify-center">
                {receiptType === "INVOICE" ? (
                  <PrintableInvoice 
                    branding={branding} 
                    enterpriseId={enterpriseId}
                    order={{
                      id: lastTransaction.id,
                      customerName: lastTransaction.customer?.name || "Walk-in",
                      customerAddress: lastTransaction.customer?.address,
                      customerPhone: lastTransaction.customer?.phone,
                      customerEmail: lastTransaction.customer?.email,
                      date: lastTransaction.timestamp,
                      items: lastTransaction.items.map((item: any) => ({
                        id: item.product.id,
                        name: item.product.name,
                        price: item.product.retail_price || item.product.price || 0,
                        qty: item.quantity
                      })),
                      subtotal: lastTransaction.subtotal,
                      tax: lastTransaction.tax,
                      total: lastTransaction.total
                    }}
                  />
                ) : (
                  <POSReceipt 
                    branding={branding}
                    formatCurrency={formatCurrency}
                    order={{
                      id: lastTransaction.id,
                      customerName: lastTransaction.customer?.name || "Walk-in",
                      date: lastTransaction.timestamp,
                      items: lastTransaction.items.map((item: any) => ({
                        id: item.product.id,
                        name: item.product.name,
                        price: item.product.retail_price || item.product.price || 0,
                        qty: item.quantity
                      })),
                      subtotal: lastTransaction.subtotal,
                      tax: lastTransaction.tax,
                      discountAmount: lastTransaction.discountAmount,
                      total: lastTransaction.total,
                      paymentMethod: lastTransaction.paymentMethod
                    }}
                  />
                )}
              </div>
            )}
            
            <p className="text-[10px] text-zinc-400 font-medium italic">
              Digital receipt generated via CRM-OS Identity Engine v2026.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>
              {discountContext === "Campaign" ? "Apply Active Campaign" : "Custom Discount"}
            </DialogTitle>
            <DialogDescription>
              {discountContext === "Campaign" 
                ? "Select an active promotional campaign to apply to this order." 
                : "Apply a one-off percentage or fixed amount discount."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4 shadow-none">
            {discountContext === "Campaign" ? (
              <div className="space-y-4">
                {campaigns.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">No active campaigns available.</p>
                ) : (
                  <ScrollArea className="h-64 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2">
                    <div className="space-y-2">
                      {campaigns.map((camp) => (
                        <div 
                          key={camp.id} 
                          className="flex justify-between items-center bg-white p-3 rounded-lg border border-zinc-200 hover:border-blue-300 transition-colors cursor-pointer"
                          onClick={() => handleApplyCampaign(camp.id)}
                        >
                          <div>
                            <p className="font-bold text-sm text-zinc-900">{camp.name}</p>
                            <p className="text-xs text-zinc-500">{camp.description || "Active Promotion"}</p>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">
                            {camp.rules?.discount_type === "Percentage" ? `${camp.rules?.discount_value}%` : `${formatCurrency(camp.rules?.discount_value)}`} OFF
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Discount Reason (Optional)</Label>
                  <Input 
                    placeholder="e.g., Manager override..."
                    className="rounded-xl bg-zinc-50"
                    value={manualDiscount.name}
                    onChange={(e) => setManualDiscount(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={manualDiscount.type} 
                      onValueChange={(val) => setManualDiscount(prev => ({ ...prev, type: val }))}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Percentage">Percentage (%)</SelectItem>
                        <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input 
                      placeholder={manualDiscount.type === "Percentage" ? "10" : "5.00"}
                      type="number"
                      className="rounded-xl bg-zinc-50"
                      value={manualDiscount.value}
                      onChange={(e) => setManualDiscount(prev => ({ ...prev, value: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsDiscountDialogOpen(false)}>Cancel</Button>
            {discountContext === "Manual" && (
               <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleApplyManualDiscount}>Apply Discount</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Cart Toggle - Moved up to avoid AI Copilot overlap */}
      <Button 
        className={cn(
          "fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-2xl z-30 md:hidden bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all duration-300",
          isCartOpenOnMobile && "hidden"
        )}
        onClick={() => setIsCartOpenOnMobile(true)}
      >
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in">
              {cart.reduce((acc, curr) => acc + curr.quantity, 0)}
            </span>
          )}
        </div>
      </Button>

      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScanResult} 
      />

      <Dialog open={isClosePromptOpen} onOpenChange={setIsClosePromptOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Close Register</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-zinc-900">User</Label>
              <Input 
                value={selectedAdmin?.name || "-"} 
                readOnly 
                className="bg-zinc-50 border-zinc-200" 
              />
            </div>
            
            <div className={cn(
              "p-4 rounded-xl border transition-all duration-300",
              isStockSynced 
                ? "border-emerald-200 bg-emerald-50/50" 
                : "border-zinc-200 bg-zinc-50/50 space-y-3"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  isStockSynced ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                )}>
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className={cn("text-sm font-bold", isStockSynced ? "text-emerald-900" : "text-zinc-900")}>
                    {isStockSynced ? "Stock Deductions Synchronized" : "Pending stock deductions"}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    {isStockSynced ? "Inventory levels reconciled with global ledger." : "Confirm inventory levels before closing registry."}
                  </p>
                </div>
              </div>
              {!isStockSynced && (
                <Button
                  variant="secondary"
                  className="w-full mt-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-200 shadow-sm transition-all active:scale-95"
                  onClick={async () => {
                    try {
                      await addDoc(collection(db, "audit_logs"), {
                        action: "Stock Sync Requested",
                        details: `Manual stock deduction sync triggered by ${selectedAdmin?.name || 'Unknown'} at register close`,
                        timestamp: serverTimestamp(),
                        user: selectedAdmin?.name || "System",
                        enterprise_id: enterpriseId
                      });
                      setIsStockSynced(true);
                      toast.success("Stock deductions confirmed and logged");
                    } catch (err) {
                      toast.error("Failed to sync stock deductions");
                    }
                  }}
                >
                  Confirm & Sync Ledger
                </Button>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900 text-white space-y-4 shadow-xl">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Expected Registry Total</p>
                  <p className="text-2xl font-black">{formatCurrency(sessionExpectedCash)}</p>
                </div>
                <div className="text-right space-y-1 opacity-60">
                   <p className="text-[10px] font-bold uppercase">Opening Float</p>
                   <p className="text-xs font-black">{formatCurrency(currentSessionData?.openingFloat || 0)}</p>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Manual Cash Count</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-xl group-focus-within:text-white transition-colors">{currency === 'USD' ? '$' : ''}</span>
                  <Input 
                    placeholder="0.00" 
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="h-14 pl-10 rounded-xl border-none bg-white/10 text-white font-black text-xl focus:ring-4 focus:ring-blue-500/20 placeholder:text-zinc-600 transition-all" 
                  />
                </div>
              </div>
            </div>

            {countedCash && (
              <div className="space-y-4">
                <div className={cn(
                  "p-5 rounded-2xl border-2 flex items-center justify-between font-black text-sm shadow-sm",
                  Math.abs(parseFloat(countedCash) - sessionExpectedCash) < 1
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                    : "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", Math.abs(parseFloat(countedCash) - sessionExpectedCash) < 1 ? "bg-emerald-500" : "bg-rose-500")} />
                    <span>Variance Amount:</span>
                  </div>
                  <span className="text-xl">{formatCurrency(parseFloat(countedCash) - sessionExpectedCash)}</span>
                </div>
                
                {Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 && (
                  <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 flex gap-3 items-start">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest">Significant Variance Detected</p>
                      <p className="text-[10px] text-rose-500 font-bold leading-tight">A detailed explanation is required in the notes field before submitting this audit.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className={cn(
                "text-sm font-bold transition-colors",
                (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1) ? "text-rose-600" : "text-zinc-900"
              )}>
                Shift Audit Notes {(countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1) && "(Required)"}
              </Label>
              <textarea 
                className={cn(
                  "w-full border rounded-2xl p-4 text-sm min-h-[100px] focus:outline-none focus:ring-4 transition-all resize-none shadow-inner",
                  (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1)
                    ? "border-rose-200 bg-rose-50/20 focus:ring-rose-500/10 placeholder:text-rose-300"
                    : "border-zinc-200 bg-zinc-50/50 focus:ring-blue-500/10"
                )}
                placeholder={Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 ? "Please explain the discrepancy..." : "Add any notes about this cash count..."}
                value={closeRegisterNotes}
                onChange={(e) => setCloseRegisterNotes(e.target.value)}
              />
            </div>
            
            <div className="p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 flex items-start gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm text-amber-600 mt-0.5">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-900 leading-none">Pre-Closure Synchronization</p>
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">Ensure all pending stock deductions are synchronized to the global ledger before finalizing the registry closure.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button variant="outline" onClick={() => setIsClosePromptOpen(false)} className="rounded-xl border-zinc-200 hover:bg-zinc-50 font-bold flex-1">Cancel</Button>
            <Button 
              id="pos-close-shift-btn" 
              className={cn(
                "rounded-xl font-bold flex-1 h-12 transition-all",
                (!isStockSynced || (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 && !closeRegisterNotes.trim()))
                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border-zinc-200"
                  : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/20"
              )} 
              disabled={!isStockSynced || (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 && !closeRegisterNotes.trim())}
              onClick={handleCloseRegister}
            >
              Close Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpeningFloatOpen} onOpenChange={setIsOpeningFloatOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] p-10 border-none shadow-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 pointer-events-none" />
          <DialogHeader className="relative space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center shadow-inner">
                <History className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex bg-zinc-100 p-1 rounded-2xl gap-1">
                <button 
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", !isCountingBills ? "bg-white shadow-sm text-blue-600" : "text-zinc-500 hover:text-zinc-700")}
                  onClick={() => setIsCountingBills(false)}
                >
                  Simple
                </button>
                <button 
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isCountingBills ? "bg-white shadow-sm text-blue-600" : "text-zinc-500 hover:text-zinc-700")}
                  onClick={() => setIsCountingBills(true)}
                >
                  Count bills
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-3xl font-black tracking-tight text-zinc-900">Start Registry</DialogTitle>
              <DialogDescription className="text-zinc-500 font-bold text-base">
                Initialize the floating amount for terminal #{selectedAdmin?.id?.substring(0,4).toUpperCase()}.
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="space-y-8 pt-8 relative">
            {!isCountingBills ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Opening Floating Amount ({currency})</Label>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 font-black text-3xl group-focus-within:text-blue-500 transition-colors">
                      {currency === 'USD' ? '$' : ''}
                    </span>
                    <Input 
                      placeholder="0.00" 
                      type="number"
                      step="0.01"
                      className="h-24 pl-14 pr-6 rounded-3xl border-none bg-zinc-50 font-black text-5xl text-zinc-900 focus:ring-4 focus:ring-blue-500/10 placeholder:text-zinc-200 transition-all shadow-inner"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[100, 250, 500].map((amt) => (
                      <button 
                        key={amt}
                        className="h-14 rounded-2xl border border-zinc-100 font-black text-zinc-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95 shadow-sm bg-white"
                        onClick={() => setOpeningFloat(amt.toString())}
                      >
                        {formatCurrency(amt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  {[1000, 500, 100, 50, 20, 10, 5, 1].map(denom => (
                    <div key={denom} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100 focus-within:border-blue-500/50 transition-colors">
                      <div className="w-12 h-10 bg-white rounded-xl border border-zinc-200 flex items-center justify-center font-black text-zinc-400 text-xs shadow-sm">
                        {denom}
                      </div>
                      <Input 
                        type="number"
                        placeholder="0"
                        className="h-10 border-none bg-transparent font-bold text-lg text-zinc-900 p-0 focus-visible:ring-0"
                        value={billCounts[denom] || ""}
                        onChange={(e) => handleBillCountChange(denom, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="p-6 rounded-3xl bg-blue-600 text-white flex justify-between items-center shadow-xl shadow-blue-600/20">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Count</p>
                    <p className="text-3xl font-black">{formatCurrency(parseFloat(openingFloat) || 0)}</p>
                  </div>
                  <History className="w-8 h-8 opacity-20" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-zinc-50/50 border border-zinc-100/50 space-y-1.5 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Operator</p>
                <div className="flex items-center gap-2">
                   <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center text-[8px] text-white font-bold">{selectedAdmin?.initials}</div>
                   <p className="font-bold text-zinc-900 truncate text-xs">{selectedAdmin?.name}</p>
                </div>
              </div>
              <div className="p-5 rounded-3xl bg-zinc-50/50 border border-zinc-100/50 space-y-1.5 text-right shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Registry ID</p>
                <p className="font-bold text-zinc-900 truncate text-xs">{(activeBranch || 'all').toUpperCase()}-01</p>
              </div>
            </div>

            <Button 
              className="w-full h-16 rounded-[1.5rem] bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xl shadow-2xl shadow-zinc-900/20 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
              onClick={handleConfirmOpeningFloat}
              disabled={!openingFloat || parseFloat(openingFloat) <= 0}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 -translate-x-full group-hover:animate-shimmer" />
              Initialize Terminal Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isShiftHistoryOpen} onOpenChange={setIsShiftHistoryOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          <div className="p-8 pb-4 border-b border-zinc-100 bg-zinc-50/50">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-zinc-900">Shift Records</DialogTitle>
                  <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Registry Audit Log & Floating History</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-6 space-y-4">
              {shiftHistory.length === 0 ? (
                <div className="text-center py-20 opacity-20">
                   <History className="w-16 h-16 mx-auto mb-4" />
                   <p className="font-bold uppercase tracking-widest">No shift records found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Operator</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Started</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Closed</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Opening Float</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Closing Count</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftHistory.map((session) => {
                      const startTime = session.startTime ? new Date(session.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
                      const endTime = session.endTime ? new Date(session.endTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (session.status === 'ACTIVE' ? <Badge className="bg-emerald-100 text-emerald-600 border-none font-black text-[8px]">ACTIVE</Badge> : "-");
                      const variance = (session.countedCash || 0) - (session.expectedCash || 0);
                      
                      return (
                        <TableRow key={session.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[8px] font-black border border-zinc-200">
                                {(session.staffName || '??').substring(0,2).toUpperCase()}
                              </div>
                              <span className="font-bold text-xs text-zinc-900">{session.staffName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-zinc-500 font-medium whitespace-nowrap">{startTime}</TableCell>
                          <TableCell className="text-xs text-zinc-500 font-medium whitespace-nowrap">{endTime}</TableCell>
                          <TableCell className="text-right font-bold text-xs text-zinc-900">{formatCurrency(session.openingFloat || 0)}</TableCell>
                          <TableCell className="text-right font-bold text-xs text-zinc-900">{session.endTime ? formatCurrency(session.countedCash || 0) : "-"}</TableCell>
                          <TableCell className="text-right">
                             {session.endTime ? (
                               <Badge className={cn(
                                 "text-[9px] font-black border-none",
                                 Math.abs(variance) < 1 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                               )}>
                                 {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                               </Badge>
                             ) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </ScrollArea>
          <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
             <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsShiftHistoryOpen(false)}>Close Registry Audit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Selector Dialog */}
      <Dialog open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          <div className="p-8 pb-4 border-b border-zinc-100">
            <DialogHeader className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-black text-zinc-900">Select Customer</DialogTitle>
                  <DialogDescription className="text-zinc-500 font-bold">Link an existing account to this transaction.</DialogDescription>
                </div>
                <Button 
                  variant="outline" 
                  className="rounded-2xl h-10 border-zinc-200 text-xs font-bold text-zinc-600 bg-white hover:bg-zinc-50"
                  onClick={() => { setSelectedCustomer(null); setIsCustomerSearchOpen(false); }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Walk-in Customer
                </Button>
              </div>
            </DialogHeader>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <Input 
                placeholder="Search by name, phone, or email..." 
                className="h-14 pl-12 rounded-2xl border-none bg-zinc-50 font-bold text-zinc-900 focus:ring-4 focus:ring-blue-500/10 placeholder:text-zinc-300 transition-all shadow-inner"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          
          <ScrollArea className="h-[450px]">
            <div className="p-4 space-y-2">
              {customers.filter(c => {
                const search = customerSearch.toLowerCase();
                return (c.name || '').toLowerCase().includes(search) || 
                       (c.phone || '').includes(search) || 
                       (c.email || '').toLowerCase().includes(search);
              }).map((customer) => (
                <div 
                  key={customer.id}
                  className="p-5 rounded-3xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer group flex items-center justify-between"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setIsCustomerSearchOpen(false);
                    setCustomerSearch("");
                    toast.success(`Active Customer: ${customer.name}`);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center font-black text-zinc-400 group-hover:bg-white group-hover:text-blue-500 transition-colors">
                      {(customer.name || 'CU').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{customer.name}</p>
                      <p className="text-xs text-zinc-500 font-medium">{customer.phone || customer.email || 'No contact info'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px]">
                      {customer.points || 0} PTS
                    </Badge>
                  </div>
                </div>
              ))}
              {customers.length === 0 && (
                <div className="text-center py-20">
                  <Users className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
                  <p className="text-zinc-400 font-bold">No customers found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      <Dialog open={isCustomItemDialogOpen} onOpenChange={setIsCustomItemDialogOpen}>
        <DialogContent className="rounded-[2rem] p-8 max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-zinc-900">Add Custom Item</DialogTitle>
            <DialogDescription className="text-sm font-medium text-zinc-500">
              Enter details for a manual line item entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Item Name</Label>
              <Input 
                placeholder="e.g. Service Fee" 
                className="rounded-2xl h-14 bg-zinc-50 border-none font-bold"
                value={customItem.name}
                onChange={(e) => setCustomItem({...customItem, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Price ({currency})</Label>
              <Input 
                type="number"
                placeholder="0.00" 
                className="rounded-2xl h-14 bg-zinc-50 border-none font-bold text-2xl"
                value={customItem.price}
                onChange={(e) => setCustomItem({...customItem, price: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button 
              variant="ghost" 
              className="flex-1 rounded-2xl h-14 font-bold" 
              onClick={() => setIsCustomItemDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 rounded-2xl h-14 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20"
              onClick={() => {
                if (!customItem.name || !customItem.price) return;
                const priceNum = parseFloat(customItem.price);
                addToCart({
                  id: `custom-${Date.now()}`,
                  name: customItem.name,
                  retail_price: priceNum,
                  price: priceNum,
                  category: "MANUAL",
                  isCustom: true
                });
                setIsCustomItemDialogOpen(false);
                setCustomItem({ name: "", price: "" });
              }}
            >
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Discount Dialog */}
      <Dialog open={isItemDiscountDialogOpen} onOpenChange={setIsItemDiscountDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-md border-none shadow-2xl bg-white">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-zinc-900">Line Item Discount</DialogTitle>
            <DialogDescription className="text-zinc-500 font-bold">
              Apply a specific discount to this item only.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex bg-zinc-100 p-1 rounded-2xl">
              <Button 
                variant="ghost" 
                className={cn(
                  "flex-1 rounded-xl h-11 font-bold text-xs transition-all",
                  itemDiscount.type === "Percentage" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                )}
                onClick={() => setItemDiscount({ ...itemDiscount, type: "Percentage" })}
              >
                Percentage
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "flex-1 rounded-xl h-11 font-bold text-xs transition-all",
                  itemDiscount.type === "Fixed Amount" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                )}
                onClick={() => setItemDiscount({ ...itemDiscount, type: "Fixed Amount" })}
              >
                Fixed Amount
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {itemDiscount.type === "Percentage" ? "Discount Percent" : `Discount Amount (${currency})`}
              </Label>
              <Input 
                type="number"
                placeholder={itemDiscount.type === "Percentage" ? "0" : "0.00"}
                className="h-16 rounded-2xl border-none bg-zinc-50 text-2xl font-black focus:ring-4 focus:ring-blue-500/10 transition-all text-center"
                value={itemDiscount.value}
                onChange={(e) => setItemDiscount({ ...itemDiscount, value: e.target.value })}
                autoFocus
              />
            </div>

            {itemDiscount.type === "Percentage" && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {[5, 10, 15, 20, 25, 50].map(val => (
                  <Button 
                    key={val}
                    variant="outline"
                    className="rounded-xl h-10 px-4 font-bold text-xs flex-none"
                    onClick={() => setItemDiscount({ ...itemDiscount, value: val.toString() })}
                  >
                    {val}%
                  </Button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 mt-4">
            <Button 
              variant="ghost" 
              className="flex-1 rounded-2xl h-14 font-bold text-zinc-500"
              onClick={() => {
                setCart(prev => prev.map(item => 
                  item.product.id === selectedItemForDiscount ? { ...item, discount: null } : item
                ));
                setIsItemDiscountDialogOpen(false);
              }}
            >
              Remove
            </Button>
            <Button 
              className="flex-1 rounded-2xl h-14 font-black bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/10"
              onClick={() => {
                const val = Number(itemDiscount.value);
                if (!itemDiscount.value || isNaN(val) || val < 0) {
                  toast.error("Please enter a valid amount");
                  return;
                }

                // Grade-based cap check
                const grade = posSession?.payGrade || "EXECUTIVE";
                const capPercent = grade === "STANDARD" ? 10 : grade === "SUPERVISOR" ? 25 : 100;
                if (itemDiscount.type === "Percentage" && val > capPercent) {
                  toast.error(`Your ${grade} grade is capped at ${capPercent}% item discounts.`);
                  return;
                }

                if (itemDiscount.type === "Percentage" && val > 100) {
                  toast.error("Cannot exceed 100%");
                  return;
                }

                setCart(prev => prev.map(item => {
                  if (item.product.id === selectedItemForDiscount) {
                    const itemSubtotal = (item.product.retail_price || item.product.price || 0) * item.quantity;
                    if (itemDiscount.type === "Fixed Amount" && val > itemSubtotal) {
                      toast.error("Discount exceeds item subtotal");
                      return item;
                    }
                    return { 
                      ...item, 
                      discount: { type: itemDiscount.type as any, value: val } 
                    };
                  }
                  return item;
                }));
                setIsItemDiscountDialogOpen(false);
                toast.success("Item discount applied");
              }}
            >
              Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
