import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import NetworkIndicator from "@/components/NetworkIndicator";
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
  Clock,
  Share2,
  PauseCircle,
  Star,
  LifeBuoy,
  RefreshCw,
  Loader2,
  Wallet
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

import { db, collection, onSnapshot, query, where, doc, addDoc, updateDoc, getDocs, getDoc, writeBatch, orderBy, limit, serverTimestamp, increment } from "@/lib/firebase";
import { PrintableInvoice } from "./PrintableInvoice";
import { POSReceipt } from "./POSReceipt";
import { POSAIUpsell } from "./POSAIUpsell";
import { recordFinancialEventBatch } from "@/lib/ledger";
import { recordAuditLogBatch, recordAuditLog } from "@/lib/audit";
import { POSZReport } from "./POSZReport";

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
    autoCloseEnabled,
    userRole,
    hasPermission
  } = useModules();

  const isAdmin = userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "owner";
  const isManager = isAdmin || userRole?.toLowerCase() === "manager";
  const { consumeAction } = usePendingAction();
  
  const [cart, setCart] = useState<{ product: any; quantity: number; discount?: { type: "Percentage" | "Fixed Amount"; value: number } | null }[]>([]);

  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [isItemDiscountDialogOpen, setIsItemDiscountDialogOpen] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState<string | null>(null);
  const [itemDiscount, setItemDiscount] = useState({ type: "Percentage", value: "" });

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [pinEntry, setPinEntry] = useState("");
  // NOTE: PINs are validated against Firestore staffList records.
  // There is no client-side default PIN — all auth is server-driven.

  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const [isStockSynced, setIsStockSynced] = useState(false);
  const [isOpeningFloatOpen, setIsOpeningFloatOpen] = useState(false);
  const [showResolution, setShowResolution] = useState<{ type: "NO_SESSION" | "BRANCH_MISMATCH" | "NETWORK_OFFLINE" } | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "SPLIT" | "ACCOUNT" | "STORE_CREDIT">("CARD");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [splitCreditAmount, setSplitCreditAmount] = useState("");

  // ── Cart Persistence ──────────────────────────────────────────
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const cartKey = useMemo(() => 
    enterpriseId && selectedAdmin?.id ? `crm_pos_cart_${enterpriseId}_${selectedAdmin.id}` : null
  , [enterpriseId, selectedAdmin?.id]);

  useEffect(() => {
    setIsCartHydrated(false);
    if (!cartKey) {
      setCart([]);
      setSelectedCustomer(null);
      return;
    }
    const saved = localStorage.getItem(cartKey);
    const savedCustomer = localStorage.getItem(`${cartKey}_customer`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      } catch (e) { console.error("Cart restoration failed:", e); }
    } else { setCart([]); }

    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        setSelectedCustomer(parsed);
      } catch (e) { console.error("Customer restoration failed:", e); }
    }

    setIsCartHydrated(true);
  }, [cartKey]);

  useEffect(() => {
    if (!cartKey || !isCartHydrated) return;
    if (cart.length > 0) {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } else {
      localStorage.removeItem(cartKey);
    }

    if (selectedCustomer) {
      localStorage.setItem(`${cartKey}_customer`, JSON.stringify(selectedCustomer));
    } else {
      localStorage.removeItem(`${cartKey}_customer`);
    }
  }, [cart, selectedCustomer, cartKey, isCartHydrated]);
  // ─────────────────────────────────────────────────────────────
  
  useEffect(() => {
    setHasActiveTransaction(cart.length > 0);
  }, [cart, setHasActiveTransaction]);

  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All Items");
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const productStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      if (activeBranch === "all") {
        map[p.id] = inventory
          .filter(i => i.product_id === p.id)
          .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      } else {
        const item = inventory.find(i => i.product_id === p.id && i.branch_id === activeBranch);
        map[p.id] = item ? (item.quantity || 0) : 0;
      }
    });
    return map;
  }, [products, inventory, activeBranch]);

  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return products.filter(p => {
      const name = (p.name || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      const matchesSearch = !term || name.includes(term) || category.includes(term);
      const matchesCategory = selectedCategory === "All Items" || (p.category || "General") === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, debouncedSearch, selectedCategory]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isSplitPaymentDialogOpen, setIsSplitPaymentDialogOpen] = useState(false);
  const [isSuspendedOrdersOpen, setIsSuspendedOrdersOpen] = useState(false);
  const [suspendedOrders, setSuspendedOrders] = useState<any[]>([]);
  const [receiptType, setReceiptType] = useState<"INVOICE" | "POS">("POS");
  const [smartCashTendered, setSmartCashTendered] = useState<number | null>(null);
  const [numpadTarget, setNumpadTarget] = useState<string | null>(null); // product id for qty numpad
  const [numpadValue, setNumpadValue] = useState("");
  const [isCartOpenOnMobile, setIsCartOpenOnMobile] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Discount State
  const [cartDiscount, setCartDiscount] = useState<CartDiscount | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountContext, setDiscountContext] = useState<"Manual" | "Campaign">("Campaign");
  const [manualDiscount, setManualDiscount] = useState({ name: "Manual Discount", type: "Percentage", value: "", reason: "" });
  const [customerUsage, setCustomerUsage] = useState<any[]>([]);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [returnReceiptId, setReturnReceiptId] = useState("");
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [restockOnReturn, setRestockOnReturn] = useState(true);
  const [deductBalanceOnRefund, setDeductBalanceOnRefund] = useState(false);
  const [receiptPaperSize, setReceiptPaperSize] = useState<"80mm" | "58mm">("80mm");

  useEffect(() => {
    if (!selectedCustomer?.id || !enterpriseId) {
      setCustomerUsage([]);
      return;
    }
    const q = query(
      collection(db, "customer_campaign_usage"),
      where("customer_id", "==", selectedCustomer.id),
      where("enterprise_id", "==", enterpriseId),
      limit(100)
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
  const [isCheckoutDetailsOpen, setIsCheckoutDetailsOpen] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  // Clock in a ref so the 1-second tick does NOT force a full component re-render
  const clockRef = useRef<HTMLSpanElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCountingBills, setIsCountingBills] = useState(false);
  const [billCounts, setBillCounts] = useState<Record<number, string>>({});
  const [isCountingBillsClose, setIsCountingBillsClose] = useState(false);
  const [billCountsClose, setBillCountsClose] = useState<Record<number, string>>({});
  const [sessionStats, setSessionStats] = useState({ sales: 0, tax: 0, discounts: 0, cash: 0, card: 0, split: 0 });
  const [loyaltySettings, setLoyaltySettings] = useState({ pointsPerDollar: 1, pointsRequiredForReward: 100, rewardValue: 5 });

  const handleBillCountChange = (denom: number, value: string) => {
    const newCounts = { ...billCounts, [denom]: value };
    setBillCounts(newCounts);
    const total = Object.entries(newCounts).reduce((acc, [d, count]) => {
      return acc + (Number(d) * (Number(count) || 0));
    }, 0);
    setOpeningFloat(total > 0 ? total.toFixed(2) : "");
  };

  const handleBillCountChangeClose = (denom: number, value: string) => {
    const newCounts = { ...billCountsClose, [denom]: value };
    setBillCountsClose(newCounts);
    const total = Object.entries(newCounts).reduce((acc, [d, count]) => {
      return acc + (Number(d) * (Number(count) || 0));
    }, 0);
    setCountedCash(total > 0 ? total.toFixed(2) : "");
  };

  const [isShiftHistoryOpen, setIsShiftHistoryOpen] = useState(false);
  const [isTransactionHistoryOpen, setIsTransactionHistoryOpen] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [transactionFilter, setTransactionFilter] = useState<"ALL" | "SALE" | "RETURN">("ALL");

  useEffect(() => {
    if (!enterpriseId || !isShiftHistoryOpen) return;
    const q = query(
      collection(db, "pos_sessions"),
      where("enterprise_id", "==", enterpriseId),
      limit(50)
    );
    // One-time read — history doesn't change while viewing
    getDocs(q).then((snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => {
        const tA = new Date(a.startTime).getTime() || 0;
        const tB = new Date(b.startTime).getTime() || 0;
        return tB - tA;
      });
      setShiftHistory(docs.slice(0, 20));
    }).catch((err) => console.error("shift history fetch:", err));
  }, [enterpriseId, isShiftHistoryOpen]);

  useEffect(() => {
    if (!enterpriseId || !isTransactionHistoryOpen) return;
    const q = query(
      collection(db, "transactions"),
      where("enterprise_id", "==", enterpriseId),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactionHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [enterpriseId, isTransactionHistoryOpen]);

  useEffect(() => {
    if (posSession) {
      setIsAuthorized(true);
      setSelectedAdmin(posSession.staffData);
      setCurrentSessionId(posSession.sessionId);
    } else {
      setIsAuthorized(false);
    }
  }, [posSession]);

  // Real-time listener for current staff member's profile (Pay Grade, Name, etc.)
  useEffect(() => {
    if (!enterpriseId || !posSession?.staffId) return;
    
    const unsub = onSnapshot(doc(db, "staff", posSession.staffId), (snap) => {
      if (snap.exists()) {
        const staffData = snap.data();
        if (staffData.payGrade !== posSession.payGrade) {
          // Sync grade change to session
          setPosSession({
            ...posSession,
            payGrade: staffData.payGrade || 'STANDARD',
            staffData: { ...posSession.staffData, ...staffData }
          });
          toast.info(`Permissions Updated: Your Discount Grade is now ${staffData.payGrade}`);
        }
      }
    });
    
    return () => unsub();
  }, [enterpriseId, posSession?.staffId]);


  useEffect(() => {
    if (!enterpriseId) return;
    // Staff roster — real-time sync (handles status and permission changes)
    const unsubStaff = onSnapshot(
      query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snapshot) => {
        const docsMap = new Map();
        snapshot.docs.forEach(d => {
          docsMap.set(d.id, { id: d.id, ...d.data() });
        });
        const dbStaff = Array.from(docsMap.values()) as any[];
        setStaffList(dbStaff.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          payGrade: s.payGrade || 'STANDARD',
          branches: s.branches,
          status: s.status,
          _pinHash: s.pin,
          initials: (s.name || '').substring(0, 2).toUpperCase()
        })));
      },
      (err) => console.error("staff fetch error:", err)
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

  useEffect(() => {
    if (!enterpriseId || !isAuthorized) {
      return;
    }
    let isMounted = true;

    // Branches — one-time read is fine (rarely change mid-session)
    getDocs(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)))
      .then(bSnap => { if (isMounted) setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() }))); })
      .catch(err => console.error("Branch fetch error:", err));

    // Customers — REAL-TIME listener so balance / points changes from any terminal
    // are immediately visible in the search dialog and on the active customer badge.
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId), where("status", "!=", "Archived"), limit(500)),
      (cSnap) => {
        if (!isMounted) return;
        const fresh = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCustomers(fresh);
        // Keep selectedCustomer in sync — avoids stale balance during active transaction
        setSelectedCustomer(prev => {
          if (!prev) return prev;
          const updated = fresh.find(c => c.id === prev.id);
          return updated ?? prev;
        });
      },
      err => console.error("Customer sync error:", err)
    );

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("enterprise_id", "==", enterpriseId), limit(1000)),
      (snapshot) => {
        setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        if (isMounted) setLoading(false);
      },
      (err) => {
        console.error("products sync error:", err);
        setLoading(false);
      }
    );
    // Campaigns — real-time listener so new campaigns appear without refresh
    const unsubCampaigns = onSnapshot(
      query(collection(db, "campaigns"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snapshot) => {
        if (isMounted) setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("campaigns sync error:", err)
    );

    const unsubInventory = onSnapshot(
      query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId), limit(1500)),
      (snapshot) => {
        setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("inventory sync error:", err)
    );
    return () => {
      isMounted = false;
      unsubCustomers?.();
      unsubProducts?.();
      unsubInventory?.();
      unsubCampaigns?.();
    };
  }, [enterpriseId, isAuthorized]);

  useEffect(() => {
    if (!enterpriseId) return;
    const unsubLoyalty = onSnapshot(doc(db, "loyalty_settings", enterpriseId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLoyaltySettings({
          pointsPerDollar: data.pointsPerDollar || 1,
          pointsRequiredForReward: data.pointsRequiredForReward || 100,
          rewardValue: data.rewardValue || 5
        });
      }
    });
    return () => unsubLoyalty();
  }, [enterpriseId]);

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

  useEffect(() => {
    if (!enterpriseId) return;
    const q = query(
      collection(db, "suspended_orders"),
      where("enterprise_id", "==", enterpriseId),
      where("status", "==", "SUSPENDED")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setSuspendedOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [enterpriseId]);

  useEffect(() => {
    // PERF: Write directly to DOM every second so the entire component tree is NOT re-rendered
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now); // kept for getSessionStatusInfo calculations only
      if (clockRef.current) {
        clockRef.current.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [sessionExpectedCash, setSessionExpectedCash] = useState(0);

  useEffect(() => {
    if (isClosePromptOpen && currentSessionId) {
      const q = query(
        collection(db, "transactions"), 
        where("sessionId", "==", currentSessionId),
        limit(1000)
      );
      
      const unsub = onSnapshot(q, (snapshot) => {
        const stats = snapshot.docs.reduce((acc, docSnap) => {
          const d = docSnap.data();
          const amt = d.total || 0;
          const isReturn = d.type === "RETURN";
          const multiplier = isReturn ? -1 : 1;
          
          acc.sales += (amt * multiplier);
          acc.tax += ((d.tax || 0) * multiplier);
          acc.discounts += ((d.discount_amount || 0) * multiplier);
          
          const pm = d.payment_method;
          if (pm === "CASH") acc.cash += (amt * multiplier);
          else if (pm === "CARD") acc.card += (amt * multiplier);
          else if (pm === "SPLIT") {
            acc.split += (amt * multiplier);
            // Include actual cash portion of split if available
            acc.cash += ((d.split_cash_amount || 0) * multiplier);
            acc.card += ((d.split_card_amount || 0) * multiplier);
          }
          
          return acc;
        }, { sales: 0, tax: 0, discounts: 0, cash: 0, card: 0, split: 0 });
        
        const opening = currentSessionData?.openingFloat || 0;
        setSessionStats(stats);
        setSessionExpectedCash(opening + stats.cash);
      });
      
      return () => unsub();
    }
  }, [isClosePromptOpen, currentSessionId, currentSessionData]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (autoCloseTime && autoCloseEnabled) {
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeString = `${currentHours}:${currentMinutes}`;
        if (currentTimeString === autoCloseTime && isAuthorized && !isClosePromptOpen) {
          setIsClosePromptOpen(true);
        }
      }
      const evaluateAutoLogout = async () => {
        for (const session of (activeSessions || [])) {
          if (!session || !session.id) continue;
          const startTime = new Date(session.startTime);
          const elapsedMinutes = (now.getTime() - startTime.getTime()) / 60000;
          let policies = timePolicies || { breakDuration: 15, lunchDuration: 30, meetingDuration: 60, gracePeriod: 10 };
          let allowedDuration = -1;
          if (session.status === "ON_BREAK") allowedDuration = policies.breakDuration;
          else if (session.status === "ON_LUNCH") allowedDuration = policies.lunchDuration;
          else if (session.status === "IN_MEETING") allowedDuration = policies.meetingDuration;
          if (allowedDuration > 0 && elapsedMinutes > allowedDuration + (policies.gracePeriod || 5)) {
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
              // AUTO-LOGOUT UI: If the auto-closed session belongs to the current operator, lock the terminal immediately
              if (session.id === currentSessionId) {
                toast.warning("Your shift time limit was exceeded. Terminal has been locked.", { duration: 6000 });
                setIsAuthorized(false);
                setSelectedAdmin(null);
                setPinEntry("");
                setPosSession(null);
                setCurrentSessionId(null);
              }
            } catch (err) {
              console.error("Failed to auto logout session", err);
            }
          }
        }
      };
      evaluateAutoLogout();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoCloseTime, autoCloseEnabled, isAuthorized, isClosePromptOpen, activeSessions, timePolicies, currentSessionId]);

  useEffect(() => {
    const action = consumeAction("pos");
    if (!action) return;
    if (action.action === "NEW_SALE") {
      setCart([]);
      setCartDiscount(null);
      setSelectedCustomer(null);
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
    // BUGFIX: Custom items have no inventory record — skip stock check for them
    if (product.isCustom) {
      setCart(prev => {
        const existing = prev.find(item => item.product.id === product.id);
        if (existing) {
          return prev.map(item =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        toast.success(`${product.name} added to cart`, { duration: 1000, position: "bottom-right" });
        return [...prev, { product, quantity: 1 }];
      });
      return;
    }
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
      toast.success(`${product.name} added to cart`, { duration: 1000, position: "bottom-right" });
      return [...prev, { product, quantity: 1 }];
    });
  }, [getProductStock]);

  const handleScanResult = useCallback((data: string, type: 'barcode' | 'qr') => {
    // Physical scanners often append \n or \r — strip them
    const clean = data.trim().replace(/[\r\n]+$/, '');
    if (!clean) return;
    const lower = clean.toLowerCase();

    // Modern Search: Match SKU, Barcode, or ID
    const product = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === lower) ||
      (p.sku && p.sku.toLowerCase() === lower) ||
      (p.id && p.id.toLowerCase() === lower)
    );

    if (product) {
      addToCart(product);
      toast.success(`✓ Added "${product.name}" to cart`, {
        description: `Price: ${formatCurrency(product.retail_price || product.price || 0)}`,
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      });
      // We keep scanner open if user wants to scan multiple items quickly
    } else {
      setSearchTerm(clean);
      toast.error(`Unrecognized item`, {
        description: `No product matched ${type === 'qr' ? 'QR' : 'barcode'}: ${clean}`,
        icon: <AlertCircle className="w-4 h-4 text-rose-500" />
      });
    }
  }, [products, addToCart, formatCurrency]);

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
    if (campaign.one_time_per_customer) {
      if (!selectedCustomer) {
        toast.error("Please select a customer first to apply this one-time reward.");
        return;
      }
      const usage = customerUsage.find(u => u.campaign_id === campaignId);
      if (usage) {
        const timestamp = usage.used_at;
        const date = (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)) || new Date();
        toast.error(`${campaign.name} is a one-time reward. This customer already benefited on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}.`, { duration: 8000 });
        return;
      }
    }
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
    toast.success(`Applied ${campaign.name} discount!`, {
      icon: campaign.isLoyaltyReward ? '🎁' : '🏷️'
    });
  };

  const handleApplyManualDiscount = () => {
    const val = Number(manualDiscount.value);
    if (!manualDiscount.value || isNaN(val) || val <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }
    const grade = posSession?.payGrade || "STANDARD";
    const capPercent = grade === "STANDARD" ? 10 : grade === "SUPERVISOR" ? 25 : 100;
    if (manualDiscount.type === "Percentage" && val > capPercent) {
      toast.error(`Your ${grade} grade is limited to ${capPercent}% discounts. Ask a SUPERVISOR to override.`, { duration: 5000 });
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
      value: val,
      reason: manualDiscount.reason || "No reason provided"
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

  // Track which campaigns have already fired an auto-notify toast this session
  const autoNotifiedCampaigns = React.useRef<Set<string>>(new Set());

  const campaignProgress = useMemo(() => {
    // Show campaigns even when cart is empty (so cashier sees what incentives exist)
    return campaigns.filter(c => {
      if (c.status !== "ACTIVE") return false;
      // Branch filter: activeBranch==='all' means show ALL campaigns.
      // Only filter by branch when a specific branch is selected AND the campaign has branch restrictions.
      if (activeBranch !== "all" && c.branches && c.branches.length > 0) {
        if (!c.branches.includes(activeBranch)) return false;
      }
      // Customer group filter
      if (c.target_customers && c.target_customers !== "All Customers") {
        if (!selectedCustomer || selectedCustomer.group !== c.target_customers) return false;
      }
      return true;
    }).map(c => {
      const reqType = c.rules?.requirement_type || "quantity";
      let progress = 0;
      let requirement = 1;
      let current = 0;

      if (reqType === "spend") {
        requirement = Number(c.rules?.min_spend || 0);
        current = subtotal;
        progress = requirement > 0 ? (subtotal / requirement) : 1;
      } else {
        requirement = Number(c.rules?.req_quantity || 1);
        current = totalItems;
        progress = requirement > 0 ? (totalItems / requirement) : 1;
      }

      return {
        ...c,
        progress: Math.min(1, progress),
        isUnlocked: progress >= 1,
        remaining: Math.max(0, requirement - current),
        reqType,
        requirementLabel: reqType === "spend" ? formatCurrency(requirement) : `${requirement} item${requirement !== 1 ? 's' : ''}`
      };
    });
  }, [campaigns, totalItems, subtotal, activeBranch, selectedCustomer]);

  const handleLookupReceipt = async () => {
    const searchId = returnReceiptId.trim();
    if (!searchId) return;
    setIsVerifyingReceipt(true);
    try {
      let txData: any = null;
      let txDocId: string = "";

      // Strategy 1: Direct Firestore document ID lookup (exact full ID)
      const directRef = doc(db, "transactions", searchId);
      const directSnap = await getDoc(directRef);

      if (directSnap.exists()) {
        txData = directSnap.data();
        txDocId = directSnap.id;
        // Security: verify it belongs to this enterprise
        if (txData.enterprise_id && txData.enterprise_id !== enterpriseId) {
          toast.error("Receipt not found in this store.");
          return;
        }
      } else {
        // Strategy 2: Fallback — search by the short 8-char prefix shown on receipts
        // Users may type the short code shown on the printed receipt
        const q = query(
          collection(db, "transactions"),
          where("enterprise_id", "==", enterpriseId),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        const matched = snap.docs.find(d =>
          d.id.toUpperCase().startsWith(searchId.toUpperCase())
        );
        if (matched) {
          txData = matched.data();
          txDocId = matched.id;
        }
      }

      if (!txData) {
        toast.error("Receipt not found. Check the ID and try again.");
        return;
      }

      if (txData.type === "RETURN") {
        toast.error("This is already a return transaction — it cannot be returned again.");
        return;
      }

      // Check if this transaction was already returned
      const returnCheckQ = query(
        collection(db, "transactions"),
        where("enterprise_id", "==", enterpriseId),
        where("original_transaction_id", "==", txDocId),
        where("type", "==", "RETURN")
      );
      const returnCheckSnap = await getDocs(returnCheckQ);
      if (!returnCheckSnap.empty) {
        toast.error("A return has already been processed for this receipt.");
        return;
      }

      // Auto-link the original customer
      if (txData.customer_id) {
        const cust = customers.find(c => c.id === txData.customer_id);
        if (cust) setSelectedCustomer(cust);
      }

      // Populate the cart with the original items (quantities from original sale)
      const returnItems = (txData.items || []).map((item: any) => {
        const prod = products.find(p => p.id === item.product_id);
        // If product no longer exists in catalog, create a stub so return can proceed
        const fallbackProd = prod || {
          id: item.product_id,
          name: item.name,
          retail_price: item.price,
          price: item.price,
          sku: item.sku || "N/A",
          isCustom: true
        };
        return {
          product: fallbackProd,
          quantity: item.quantity,
          discount: item.discount || null
        };
      });

      setCart(returnItems);
      // Store the original tx ID so we can link the return in the transaction record
      setReturnReceiptId(txDocId);
      toast.success(`Receipt verified (${txDocId.substring(0,8).toUpperCase()}) — ${returnItems.length} item(s) loaded.`);
    } catch (error) {
      console.error("Receipt lookup error:", error);
      toast.error("Error looking up receipt. Please try again.");
    } finally {
      setIsVerifyingReceipt(false);
    }
  };

  const eligibleCampaigns = useMemo(() => {
    // Build a fresh array — do NOT mutate the memoized .filter() result
    const unlocked: any[] = [];

    // Loyalty points reward (customer-level, not cart-based)
    if (selectedCustomer && (selectedCustomer.points || 0) >= (loyaltySettings.pointsRequiredForReward || 100)) {
      unlocked.push({
        id: "LOYALTY_POINTS_REWARD",
        name: "Loyalty Points Reward",
        description: `Redeem ${loyaltySettings.pointsRequiredForReward} pts for a ${formatCurrency(loyaltySettings.rewardValue || 0)} discount`,
        rules: {
          discount_type: "Fixed Amount",
          discount_value: String(loyaltySettings.rewardValue || 0)
        },
        type: "Loyalty Points",
        isLoyaltyReward: true,
        isUnlocked: true,
        progress: 1
      });
    }

    // Cart-based campaigns that have been unlocked
    campaignProgress.forEach(c => {
      if (c.isUnlocked) unlocked.push(c);
    });

    return unlocked;
  }, [campaignProgress, selectedCustomer, loyaltySettings]);

  // All campaigns that have not yet been unlocked (sorted: highest progress first)
  const upcomingRewards = useMemo(() => {
    return campaignProgress
      .filter(c => !c.isUnlocked)
      .sort((a, b) => b.progress - a.progress);
  }, [campaignProgress]);

  // Auto-notify cashier when a campaign is newly unlocked mid-transaction
  useEffect(() => {
    eligibleCampaigns.forEach(c => {
      if (c.id === "LOYALTY_POINTS_REWARD") return; // already obvious from customer panel
      if (autoNotifiedCampaigns.current.has(c.id)) return;
      autoNotifiedCampaigns.current.add(c.id);
      toast.success(
        `🏷️ "${c.name}" unlocked! Cart qualifies for a discount.`,
        {
          duration: 6000,
          action: {
            label: "Apply",
            onClick: () => handleApplyCampaign(c.id)
          }
        }
      );
    });
  }, [eligibleCampaigns]);

  let discountAmount = 0;
  if (cartDiscount) {
    let eligibleSubtotal = subtotal;
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

  const calculatedTaxRate = (globalTaxRate || 15) / 100;
  // TAX LEGALITY: Tax is applied to the post-discount taxable amount, not the gross subtotal.
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = isTaxEnabled ? (taxableAmount * calculatedTaxRate) : 0;
  const total = Math.max(0, subtotal + tax - discountAmount);

  // DISCOUNT STALENESS: Re-validate campaign discount whenever cart totals change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cartDiscount || cartDiscount.id === "manual" || cartDiscount.id === "LOYALTY_POINTS_REWARD") return;
    const campaign = campaigns.find((c: any) => c.id === cartDiscount.id);
    if (!campaign) {
      setCartDiscount(null);
      toast.warning("Applied discount removed: campaign no longer active.");
      return;
    }
    const reqType = campaign.rules?.requirement_type || "quantity";
    if (reqType === "spend") {
      const minSpend = Number(campaign.rules?.min_spend || 0);
      if (subtotal < minSpend) {
        setCartDiscount(null);
        toast.warning(`Discount removed: cart total dropped below the ${formatCurrency(minSpend)} minimum.`);
      }
    } else {
      const reqQty = Number(campaign.rules?.req_quantity || 1);
      if (totalItems < reqQty) {
        setCartDiscount(null);
        toast.warning(`Discount removed: cart quantity dropped below the required ${reqQty} items.`);
      }
    }
  // Only re-run when subtotal/totalItems change, not on every render
  }, [subtotal, totalItems]); // eslint-disable-line

  const handleCompleteTransaction = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (isProcessing) return;

    if (!currentSessionId) {
      setShowResolution({ type: "NO_SESSION" });
      return;
    }
    setIsProcessing(true);
    const batch = writeBatch(db);
    try {
      const resolvedBranch = activeBranch === "all" ? "main" : activeBranch;
      
      const tendered = paymentMethod === "SPLIT" 
        ? (parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) + (parseFloat(splitCreditAmount) || 0)
        : (parseFloat(paidAmount) || (paymentMethod === "ACCOUNT" ? 0 : total));
      
      const actualPaid = Math.min(total, tendered);
      const changeDue = paymentMethod === "CASH" ? Math.max(0, tendered - total) : 0;
      const balanceDue = Math.max(0, total - actualPaid);

      // SECURITY: Prevent debt accrual on Guest checkout
      // Prevent Store Credit if no credit available or total exceeds credit
      if (paymentMethod === "STORE_CREDIT") {
        const availableCredit = Math.abs(Math.min(0, selectedCustomer?.balance || 0));
        if (availableCredit < 0.01) {
          toast.error("Error: Customer has no store credit available.");
          setIsProcessing(false);
          return;
        }
        if (total > availableCredit + 0.01) {
          toast.error(`Insufficient Credit: This order is ${formatCurrency(total)} but the customer only has ${formatCurrency(availableCredit)} in credit. Please use 'Split Payment' to cover the remainder.`);
          setIsProcessing(false);
          return;
        }
      }

      if (balanceDue > 0.01 && !selectedCustomer) {
        toast.error("A customer must be selected to record a partial payment or account charge.");
        setIsProcessing(false);
        return;
      }

      const isPartial = balanceDue > 0.01;

      const txRef = doc(collection(db, "transactions"));
      const txId = txRef.id;

      batch.set(txRef, {
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
        tendered_amount: tendered,
        paid_amount: actualPaid,
        change_due: changeDue,
        balance_due: balanceDue,
        status: isPartial ? "PARTIAL" : "COMPLETED",
        cashier_id: selectedAdmin?.id || null,
        cashier_name: selectedAdmin?.name || null,
        sessionId: currentSessionId || null,
        timestamp: serverTimestamp(),
        enterprise_id: enterpriseId,
        type: isReturnMode ? "RETURN" : "SALE",
        split_cash_amount: paymentMethod === "SPLIT" ? parseFloat(splitCashAmount) || 0 : 0,
        split_card_amount: paymentMethod === "SPLIT" ? parseFloat(splitCardAmount) || 0 : 0,
        split_credit_amount: paymentMethod === "SPLIT" ? parseFloat(splitCreditAmount) || 0 : 0,
        refund_to_account: isReturnMode && paymentMethod === "ACCOUNT",
        original_transaction_id: isReturnMode && returnReceiptId ? returnReceiptId : null
      });

      recordFinancialEventBatch(batch, {
        enterpriseId,
        amount: actualPaid,
        sourceId: txId,
        sourceType: isReturnMode ? "RETURN" : "POS_TRANSACTION",
        description: `${isReturnMode ? 'RETURN' : 'POS Sale'} - ${cart.length} items (${paymentMethod})`,
        metadata: { 
          cashier: selectedAdmin?.name || null, 
          customer: selectedCustomer?.name || null, 
          tax: tax, 
          isRefund: isReturnMode,
          tendered: tendered,
          change: changeDue,
          debt: balanceDue
        }
      });

      const evaluateReplenishment = async (productId: string, currentQty: number) => {
        // Run in background to avoid blocking the main transaction flow
        try {
          const product = products.find(p => p.id === productId);
          if (!product || !product.auto_reorder || !product.supplier_id) return;
          const minStock = product.min_stock_level || 10;
          if (currentQty > minStock) return;
          
          const existingPOs = await getDocs(query(
            collection(db, 'purchase_orders'),
            where('enterprise_id', '==', enterpriseId),
            where('supplier_id', '==', product.supplier_id),
            where('status', 'in', ['DRAFT', 'AUTODRAFT', 'PENDING'])
          ));
          const hasPendingPO = existingPOs.docs.some(doc => {
            const data = doc.data();
            return data.items?.some((item: any) => item.product_id === productId);
          });
          if (hasPendingPO) return;
          
          const suggestedQty = Math.max(minStock * 2, 20);
          const totalCost = (product.cost || 0) * suggestedQty;
          
          // Use a separate write for replenishment so it doesn't block the POS sale if it fails
          const replenishBatch = writeBatch(db);
          const poRef = doc(collection(db, 'purchase_orders'));
          replenishBatch.set(poRef, {
            enterprise_id: enterpriseId,
            supplier_id: product.supplier_id,
            status: 'AUTODRAFT',
            items: [{
              product_id: productId,
              name: product.name,
              sku: product.sku,
              qty: suggestedQty,
              cost: product.cost || 0,
              total: totalCost
            }],
            total_cost: totalCost,
            notes: `Autonomous Replenishment: Stock level reached ${currentQty} units. Triggered via POS terminal.`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: 'AUTO'
          });

          const notifRef = doc(collection(db, 'notifications'));
          replenishBatch.set(notifRef, {
            enterprise_id: enterpriseId,
            title: 'Autonomous Replenishment Triggered',
            message: `Stock level for ${product.name} is low (${currentQty}). A draft PO has been generated for review.`,
            type: 'INVENTORY',
            severity: 'INFO',
            created_at: serverTimestamp(),
            read: false,
            action_link: '/inventory?tab=suppliers'
          });

          await replenishBatch.commit();
        } catch (error) {
          console.error('Non-blocking replenishment evaluation failure:', error);
          // We do NOT rethrow here, as we want the POS sale to proceed even if PO creation fails
        }
      };

      for (const item of cart) {
        const invItem = inventory.find(i => 
          i.product_id === item.product.id && 
          (activeBranch === "all" ? (i.branch_id === "main" || i.branch_id === "primary") : i.branch_id === resolvedBranch)
        ) || inventory.find(i => i.product_id === item.product.id);

        if (invItem) {
          const qtyAdjustment = isReturnMode ? (restockOnReturn ? item.quantity : 0) : -item.quantity;
          if (qtyAdjustment !== 0) {
            const newQty = (invItem.quantity || 0) + qtyAdjustment;
            batch.update(doc(db, "inventory", invItem.id), {
              quantity: increment(qtyAdjustment)
            });
            if (!isReturnMode && newQty <= (item.product.min_stock_level || 10)) {
              evaluateReplenishment(item.product.id, newQty);
            }
          }
        }
      }

      if (selectedCustomer?.id) {
        const basePoints = total * (loyaltySettings.pointsPerDollar || 1);
        
        // Modern Tier-based Multipliers
        let multiplier = 1;
        const tier = selectedCustomer.tier?.toLowerCase() || 'silver';
        if (tier === 'gold') multiplier = 1.25;
        if (tier === 'platinum') multiplier = 1.5;
        
        const pointsEarned = Math.floor(basePoints * multiplier);
        const pointAdjustment = isReturnMode ? -pointsEarned : ((cartDiscount as any)?.isLoyaltyReward ? -(loyaltySettings.pointsRequiredForReward || 100) : pointsEarned);
        
        // Return logic: If refunded to ACCOUNT, decrease customer balance (more credit/less debt)
        const balanceAdjustment = isReturnMode 
          ? (paymentMethod === "ACCOUNT" ? -total : 0)
          : balanceDue;

        // Balance deduction on refund: if toggled, offset the customer's outstanding balance against the refund
        // Net refund = refundTotal - customerBalance (cannot go negative — customer gets 0 if debt >= refund)
        const customerOutstandingBalance = isReturnMode && deductBalanceOnRefund ? (selectedCustomer.balance || 0) : 0;
        const netRefundAdjustment = isReturnMode && deductBalanceOnRefund
          ? Math.min(customerOutstandingBalance, total) // amount deducted from refund
          : 0;
        
        // Final balance change:
        // - Normal return to Account: decrease balance by refund total
        // - Deduct balance from refund: reduce balance by the outstanding amount (clears up to refund total)
        const finalBalanceAdjustment = isReturnMode
          ? (paymentMethod === "ACCOUNT"
              ? -total
              : (deductBalanceOnRefund
                  ? -Math.min(customerOutstandingBalance, total)
                  : 0))
          : (paymentMethod === "STORE_CREDIT" 
              ? total 
              : paymentMethod === "SPLIT" 
                ? (balanceDue + (parseFloat(splitCreditAmount) || 0)) 
                : balanceDue);

        batch.update(doc(db, "customers", selectedCustomer.id), {
          spend: increment(isReturnMode ? -total : total),
          points: increment(pointAdjustment),
          balance: increment(finalBalanceAdjustment),
          last_purchase_date: serverTimestamp(),
          lastContact: new Date().toISOString()
        });
        
        // Store deduction metadata on the transaction for audit
        if (isReturnMode && deductBalanceOnRefund && netRefundAdjustment > 0) {
          batch.update(doc(db, "transactions", txId), {
            balance_deducted_from_refund: netRefundAdjustment,
            net_refund_paid: Math.max(0, total - netRefundAdjustment)
          });
        }
      } // end if (selectedCustomer?.id)

      if (currentSessionId) {
        batch.update(doc(db, "pos_sessions", currentSessionId), {
          totalSales: increment(isReturnMode ? -total : total),
          transactionCount: increment(isReturnMode ? 0 : 1),
          lastActivity: new Date().toISOString()
        });
      }

      recordAuditLogBatch(batch, {
        enterpriseId,
        action: isReturnMode ? "Return Completed" : "Sale Completed",
        details: `${cart.length} item(s) ${isReturnMode ? 'returned' : 'sold'} for ${formatCurrency(total)} via ${paymentMethod}`,
        severity: isReturnMode ? "WARNING" : "INFO",
        type: "POS",
        branchId: resolvedBranch
      });

      if (cartDiscount && !isReturnMode) {
        const campaign = campaigns.find(c => c.id === cartDiscount.id);
        if (campaign && campaign.one_time_per_customer && selectedCustomer?.id) {
          // Record usage asynchronously to avoid blocking the main sale if permissions are restrictive
          addDoc(collection(db, "customer_campaign_usage"), {
            customer_id: selectedCustomer.id,
            customer_name: selectedCustomer.name,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            used_at: serverTimestamp(),
            transaction_id: txId,
            enterprise_id: enterpriseId,
            staff_name: selectedAdmin?.name || "System",
            staff_id: selectedAdmin?.id || "system"
          }).catch(err => {
            console.warn("Customer campaign usage recording failed (permission issue):", err);
          });
        }
      }

      await batch.commit();

      setLastTransaction({
        id: txId,
        isReturn: isReturnMode,
        originalTransactionId: isReturnMode && returnReceiptId ? returnReceiptId : null,
        cashierName: selectedAdmin?.name || null,
        refundMethod: isReturnMode ? paymentMethod : null,
        balanceDeducted: isReturnMode && deductBalanceOnRefund ? Math.min(selectedCustomer?.balance || 0, total) : 0,
        netRefundPaid: isReturnMode && deductBalanceOnRefund ? Math.max(0, total - (selectedCustomer?.balance || 0)) : (isReturnMode ? total : 0),
        items: cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: item.product.retail_price || item.product.price || 0,
          qty: item.quantity,
          discount: item.discount
        })),
        total,
        tax,
        discountAmount,
        subtotal,
        paymentMethod,
        tendered: tendered,
        change: changeDue,
        balanceDue: balanceDue,
        split_cash_amount: paymentMethod === "SPLIT" ? (parseFloat(splitCashAmount) || 0) : 0,
        split_card_amount: paymentMethod === "SPLIT" ? (parseFloat(splitCardAmount) || 0) : 0,
        split_credit_amount: paymentMethod === "SPLIT" ? (parseFloat(splitCreditAmount) || 0) : 0,
        customerName: selectedCustomer?.name || "Guest Customer",
        date: new Date().toLocaleString()
      });
      setShowReceipt(true);
      if (balanceDue > 0.01 && selectedCustomer) {
        toast.success(`Success: ${formatCurrency(balanceDue)} added to ${selectedCustomer.name}'s account balance.`);
      }
      // Auto-switch back to Sale mode after a return is completed
      if (isReturnMode) {
        setIsReturnMode(false);
      }
      // Automatically trigger print after a short delay
      setTimeout(() => {
        window.print();
      }, 500);
      
      // Cleanup of current transaction state
      setCartDiscount(null);
      setSelectedCustomer(null);
      // We do NOT clear the cart or lastTransaction here anymore to ensure the receipt stays valid
    } catch (error: any) {
      console.error("Transaction error:", error);
      toast.error("Transaction failed: " + (error.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQueueCommunication = async (type: "whatsapp" | "email", documentType: "RECEIPT" | "INVOICE" | "ZREPORT", recipient: string, data: any) => {
    if (!enterpriseId) return;
    
    const toastId = toast.loading(`Queueing ${documentType} for ${type}...`);
    try {
      await addDoc(collection(db, "communications"), {
        enterprise_id: enterpriseId,
        customer_id: selectedCustomer?.id || "walk-in",
        type,
        documentType,
        recipient,
        data,
        status: "PENDING",
        createdAt: serverTimestamp(),
        author: selectedAdmin?.name || "POS System"
      });
      toast.success("Message queued for delivery", { id: toastId });
    } catch (err) {
      console.error("Queue error:", err);
      toast.error("Failed to queue message", { id: toastId });
    }
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    setCart([]);
    setCartDiscount(null);
    setSelectedCustomer(null);
    setSmartCashTendered(null);
    setPaidAmount("");
    setPaymentMethod("CARD");
    setSearchTerm("");
    setSelectedCategory("All Items");
    setDeductBalanceOnRefund(false);
    setReturnReceiptId("");
    setIsReturnMode(false);
    autoNotifiedCampaigns.current.clear(); // reset so unlock toasts fire again for new session
    if (cartKey) localStorage.removeItem(cartKey);
    toast.success("Ready for new transaction");
  };

  const handlePinInput = async (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      if (newPin.length === 4) {
        // SECURITY: compare against _pinHash (stripped field), not raw .pin
        if (selectedAdmin && newPin === selectedAdmin._pinHash) {
          try {
            if (!enterpriseId) {
              toast.error("System state initializing... please wait.");
              return;
            }
            const activeSessionQuery = query(
              collection(db, "pos_sessions"),
              where("enterprise_id", "==", enterpriseId),
              where("staffId", "==", selectedAdmin.id || ""),
              where("status", "in", ["ACTIVE", "ON_BREAK", "ON_LUNCH"]),
              limit(1)
            );
            const activeSessionSnap = await getDocs(activeSessionQuery);
            if (!activeSessionSnap.empty) {
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
               const primaryBranch = selectedAdmin.branches?.[0];
               if (primaryBranch && primaryBranch !== "all") {
                 setActiveBranch(primaryBranch);
               }
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
        openingFloat: parseFloat(openingFloat) || 0,
        billCounts: isCountingBills ? billCounts : null
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
      setOpeningFloat("");
      setBillCounts({});
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
    setTimeout(() => {
      setIsAuthorized(false);
      setSelectedAdmin(null);
      setPinEntry("");
      if (statusType === "LOCKED") {
        clearSession();
      }
    }, 150);
  };

  const handleBackspace = () => setPinEntry(prev => prev.slice(0, -1));
  const handleClear = () => setPinEntry("");

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
    if (session.status === "ACTIVE") styles = "bg-emerald-50 text-emerald-600 border-emerald-100";
    else if (session.status === "ON_BREAK") { styles = "bg-amber-50 text-amber-600 border-amber-100"; label = "On Break"; }
    else if (session.status === "ON_LUNCH") { styles = "bg-blue-50 text-blue-600 border-blue-100"; label = "On Lunch"; }
    else if (session.status === "IN_MEETING") { styles = "bg-purple-50 text-purple-600 border-purple-100"; label = "In Meeting"; }
    return { label, formattedTimer, styles };
  };

  const handleParkOrder = async () => {
    if (cart.length === 0) return;
    try {
      await addDoc(collection(db, "suspended_orders"), {
        enterprise_id: enterpriseId,
        cart,
        customer: selectedCustomer,
        discount: cartDiscount,
        timestamp: new Date().toISOString(),
        staff_name: selectedAdmin?.name || "Unknown",
        status: "SUSPENDED",
        total
      });
      setCart([]);
      setSelectedCustomer(null);
      setCartDiscount(null);
      toast.success("Order parked successfully");
    } catch (err: any) {
      toast.error("Failed to park order: " + err.message);
    }
  };

  const handleRetrieveOrder = async (order: any) => {
    setCart(order.cart);
    setSelectedCustomer(order.customer);
    setCartDiscount(order.discount);
    await updateDoc(doc(db, "suspended_orders", order.id), { status: "RETRIEVED" });
    setIsSuspendedOrdersOpen(false);
    toast.success("Order retrieved");
  };

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
          notes: closeRegisterNotes,
          billCounts: isCountingBillsClose ? billCountsClose : null
        });
        await recordAuditLog({
          enterpriseId,
          action: "POS_REGISTER_CLOSE",
          details: `Staff member ${selectedAdmin?.name || 'Unknown'} closed register. Variance: ${formatCurrency(variance)}`,
          severity: Math.abs(variance) > 5 ? "CRITICAL" : "INFO",
          type: "FINANCE",
          metadata: { sessionId: currentSessionId, expected: sessionExpectedCash, actual: actualCount, variance: variance }
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
    setCart([]);
    if (cartKey) localStorage.removeItem(cartKey);
    if (isStandard) {
      toast.info("Standard session ended. Signing out of website...", { duration: 3000 });
      setTimeout(() => logout(), 1500);
    }
  };

  const handleShareZReport = async () => {
    const reportText = `
SETTLEMENT REPORT - ${branding.name}
Operator: ${selectedAdmin?.name}
Date: ${new Date().toLocaleString()}
--------------------------------
Gross Sales: ${formatCurrency(sessionStats.sales)}
Total Tax: ${formatCurrency(sessionStats.tax)}
Discounts: ${formatCurrency(sessionStats.discounts)}
--------------------------------
Opening Float: ${formatCurrency(currentSessionData?.openingFloat || 0)}
Expected Cash: ${formatCurrency(sessionExpectedCash)}
Actual Counted: ${formatCurrency(parseFloat(countedCash) || 0)}
Variance: ${formatCurrency((parseFloat(countedCash) || 0) - sessionExpectedCash)}
--------------------------------
Notes: ${closeRegisterNotes || 'None'}
    `.trim();

    // Audit trail first
    await handleQueueCommunication("email", "ZREPORT", branding.email, { reportText, sessionId: currentSessionId });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Z-Report - ${branding.name}`,
          text: reportText,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error("Local share failed, but audit record saved.");
        }
      }
    } else {
      navigator.clipboard.writeText(reportText);
      toast.success("Audit record saved & Text copied");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-zinc-50/50 relative touch-pan-y overscroll-y-contain">
      <AnimatePresence>
        {showResolution && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200">
              <div className="p-8 space-y-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center shadow-inner">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Shift Setup Required</h2>
                    <p className="text-zinc-500 text-sm font-medium leading-relaxed">To process sales and maintain audit accuracy, this terminal must be linked to an active cash drawer session.</p>
                  </div>
                </div>
                <div className="bg-zinc-50 rounded-2xl p-5 space-y-3 border border-zinc-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Resolution Steps</p>
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</div>
                    <p className="text-xs text-zinc-700 font-bold">Initialize your opening float balance.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</div>
                    <p className="text-xs text-zinc-700 font-bold">The system will then link all sales to your current shift.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button className="w-full h-14 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 font-black text-sm shadow-xl shadow-zinc-950/10 transition-all active:scale-95" onClick={() => { setShowResolution(null); setIsOpeningFloatOpen(true); }}>Initialize Shift Now</Button>
                  <Button variant="ghost" className="w-full h-10 rounded-xl text-zinc-400 hover:text-zinc-600 font-bold text-xs" onClick={() => { setShowResolution(null); setIsAuthorized(false); setSelectedAdmin(null); }}>Return to Login</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Barcode / QR Scanner ───────────────────────────────────────── */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanResult}
      />

      <Dialog open={isOpeningFloatOpen} onOpenChange={(open) => {
        if (!open) { setIsOpeningFloatOpen(false); setIsAuthorized(false); setSelectedAdmin(null); setPinEntry(""); }
      }}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] p-10 border-none shadow-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto z-[120]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 pointer-events-none" />
          <DialogHeader className="relative space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center shadow-inner">
                <History className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex bg-zinc-100 p-1 rounded-2xl gap-1">
                <button className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", !isCountingBills ? "bg-white shadow-sm text-blue-600" : "text-zinc-500 hover:text-zinc-700")} onClick={() => setIsCountingBills(false)}>Simple</button>
                <button className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isCountingBills ? "bg-white shadow-sm text-blue-600" : "text-zinc-500 hover:text-zinc-700")} onClick={() => setIsCountingBills(true)}>Count bills</button>
              </div>
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-3xl font-black tracking-tight text-zinc-900">Start Registry</DialogTitle>
              <DialogDescription className="text-zinc-500 font-bold text-base">Initialize the floating amount for terminal #{selectedAdmin?.id?.substring(0,4).toUpperCase()}.</DialogDescription>
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
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 font-black text-3xl group-focus-within:text-blue-500 transition-colors">{currency === 'USD' ? '$' : `${currency} `}</span>
                    <Input placeholder="0.00" type="number" step="0.01" className={cn("h-24 pr-6 rounded-3xl border-none bg-zinc-50 font-black text-5xl text-zinc-900 focus:ring-4 focus:ring-blue-500/10 placeholder:text-zinc-200 transition-all shadow-inner", currency.length > 1 ? "pl-32" : "pl-14")} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[100, 250, 500].map((amt) => (
                      <button key={amt} className="h-14 rounded-2xl border border-zinc-100 font-black text-zinc-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95 shadow-sm bg-white" onClick={() => setOpeningFloat(amt.toString())}>{formatCurrency(amt)}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  {[1000, 500, 100, 50, 20, 10, 5, 1].map(denom => (
                    <div key={denom} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100 focus-within:border-blue-500/50 transition-colors">
                      <div className="w-12 h-10 bg-white rounded-xl border border-zinc-200 flex items-center justify-center font-black text-zinc-400 text-xs shadow-sm">{denom}</div>
                      <Input type="number" placeholder="0" className="h-10 border-none bg-transparent font-bold text-lg text-zinc-900 p-0 focus-visible:ring-0" value={billCounts[denom] || ""} onChange={(e) => handleBillCountChange(denom, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-zinc-100 flex flex-col gap-3">
              <Button className="w-full h-16 rounded-3xl bg-zinc-900 text-white hover:bg-zinc-800 font-black text-lg shadow-xl shadow-zinc-950/20 transition-all active:scale-95" disabled={!openingFloat || parseFloat(openingFloat) < 0} onClick={handleConfirmOpeningFloat}>Start Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isAuthorized ? (
        <div className="flex h-full items-center justify-center bg-zinc-50/50 p-6 w-full">
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
                      <div key={admin.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer transition-all shadow-sm" onClick={() => setSelectedAdmin(admin)}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                            <span className="text-white font-bold text-sm tracking-wider">{admin.initials}</span>
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900">{admin.name}</p>
                            <p className="text-xs font-medium text-zinc-500">{admin.role}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={cn(
                            "text-[8px] uppercase font-black px-1.5 py-0",
                            admin.payGrade === 'EXECUTIVE' ? "text-indigo-600 border-indigo-100 bg-indigo-50" :
                            admin.payGrade === 'SUPERVISOR' ? "text-amber-600 border-amber-100 bg-amber-50" :
                            "text-zinc-500 border-zinc-100 bg-zinc-50"
                          )}>
                            {admin.payGrade || 'STANDARD'}
                          </Badge>
                          {statusInfo && (
                            <>
                              <Badge className={cn("text-[9px] uppercase font-bold py-0.5", statusInfo.styles)}>{statusInfo.label}</Badge>
                              <span className="text-xs font-mono font-bold text-zinc-500">{statusInfo.formattedTimer}</span>
                            </>
                          )}
                        </div>
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
                        <div key={index} className={cn("w-4 h-4 rounded-full border-2 transition-all duration-200", pinEntry.length > index ? "bg-zinc-900 border-zinc-900" : "border-zinc-300")} />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button key={num} variant="outline" className="h-16 rounded-2xl text-2xl font-bold bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm transition-all active:scale-95" onClick={() => handlePinInput(num.toString())}>{num}</Button>
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
      ) : (
        <>
          {/* FIX: POS-specific offline banner — warns cashier not to close tab while offline */}
          <NetworkIndicator isPOS />
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <div className="p-4 sm:p-6 lg:p-8 space-y-3 overflow-hidden">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest truncate">
                  Branch: {(activeBranch || 'all').toUpperCase()}
                  {selectedAdmin?.name && (
                    <> · <span className="text-zinc-400">{selectedAdmin.name}</span> <Badge variant="outline" className="ml-2 text-[8px] font-black border-zinc-200 text-zinc-500 uppercase">{posSession?.payGrade || 'STANDARD'}</Badge></>
                  )}
                </span>
              </div>

              {/* Title row + mobile-only cart/status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-zinc-900 font-display whitespace-nowrap">Terminal</h1>
                  {isCartCollapsed && (
                    <Button onClick={() => setIsCartCollapsed(false)} variant="outline" className="hidden md:flex items-center gap-2 rounded-xl h-9 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all animate-in fade-in">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Order ({cart.length})</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 md:hidden shrink-0">
                  <Button onClick={() => setIsCartOpenOnMobile(true)} className="flex items-center gap-1.5 rounded-xl h-9 px-3 bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-95">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-[10px] font-black">{cart.length}</span>
                  </Button>
                  {posSession?.sessionId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<button className="outline-none rounded-xl h-9 w-9 border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center">
                        {(() => { const s = currentSessionData?.status || 'ACTIVE'; if (s === 'ON_BREAK') return <Coffee className="w-4 h-4 text-amber-500" />; if (s === 'ON_LUNCH') return <Utensils className="w-4 h-4 text-orange-500" />; if (s === 'IN_MEETING') return <Users className="w-4 h-4 text-indigo-500" />; return <Play className="w-4 h-4 text-emerald-500" />; })()}
                      </button>}/>
                      <DropdownMenuContent className="w-52 rounded-2xl p-1 shadow-2xl" align="end">
                        <DropdownMenuItem className="rounded-xl h-11 px-3 cursor-pointer" onClick={() => handleTimeClock('ACTIVE')}><Play className="w-4 h-4 mr-2 text-emerald-500" /><span className="font-bold text-sm">Resume Duty</span></DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl h-11 px-3 cursor-pointer" onClick={() => handleTimeClock('ON_BREAK')}><Coffee className="w-4 h-4 mr-2 text-amber-500" /><span className="font-bold text-sm">On Break</span></DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl h-11 px-3 cursor-pointer" onClick={() => handleTimeClock('ON_LUNCH')}><Utensils className="w-4 h-4 mr-2 text-orange-500" /><span className="font-bold text-sm">On Lunch</span></DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl h-11 px-3 cursor-pointer" onClick={() => handleTimeClock('IN_MEETING')}><Users className="w-4 h-4 mr-2 text-indigo-500" /><span className="font-bold text-sm">In Meeting</span></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-xl h-11 px-3 cursor-pointer" onClick={() => setIsClosePromptOpen(true)}><History className="w-4 h-4 mr-2 text-rose-500" /><span className="font-bold text-sm text-rose-600">End Shift</span></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Controls — Sale/Return toggle + desktop status dropdown — wraps on mobile */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={cn("flex items-center rounded-xl border p-1 transition-all shrink-0", isReturnMode ? "bg-rose-50 border-rose-200" : "bg-zinc-100 border-zinc-200")}>
                  <Button variant="ghost" size="sm" onClick={() => setIsReturnMode(false)} className={cn("rounded-lg h-8 px-3 text-[10px] font-black uppercase tracking-widest transition-all", !isReturnMode ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>Sale</Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsReturnMode(true)} className={cn("rounded-lg h-8 px-3 text-[10px] font-black uppercase tracking-widest transition-all", isReturnMode ? "bg-rose-500 text-white shadow-lg shadow-rose-200" : "text-zinc-500 hover:text-zinc-700")}>Return</Button>
                </div>
                {isReturnMode && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-rose-50/50 border border-rose-100 px-3 py-1.5 rounded-xl shrink-0">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">Restock?</span>
                      <Switch checked={restockOnReturn} onCheckedChange={setRestockOnReturn} className="data-[state=checked]:bg-rose-500 scale-75" />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-rose-100 p-1 rounded-xl shadow-sm">
                      <Input 
                        placeholder="Receipt ID..." 
                        className="h-8 w-32 border-none bg-transparent text-[10px] font-bold placeholder:text-rose-200 focus-visible:ring-0"
                        value={returnReceiptId}
                        onChange={(e) => setReturnReceiptId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookupReceipt()}
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50"
                        onClick={handleLookupReceipt}
                        disabled={isVerifyingReceipt}
                      >
                        {isVerifyingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
                {posSession?.sessionId && (
                  <div className="hidden md:flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<button className={cn("outline-none rounded-xl h-10 px-4 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm transition-all flex items-center gap-3 cursor-pointer select-none", (currentSessionData?.status === 'ON_BREAK') && "border-amber-200 bg-amber-50/30 text-amber-600", (currentSessionData?.status === 'ON_LUNCH') && "border-orange-200 bg-orange-50/30 text-orange-600", (currentSessionData?.status === 'IN_MEETING') && "border-indigo-200 bg-indigo-50/30 text-indigo-600")}>
                          {(() => { const s = currentSessionData?.status || 'ACTIVE'; if (s === 'ON_BREAK') return <Coffee className="w-4 h-4" />; if (s === 'ON_LUNCH') return <Utensils className="w-4 h-4" />; if (s === 'IN_MEETING') return <Users className="w-4 h-4" />; return <Play className="w-4 h-4 text-emerald-500" />; })()}
                          <span className="text-xs font-black uppercase tracking-widest">{currentSessionData?.status?.replace('ON_', '').replace('IN_', '') || 'On Duty'}</span>
                          <ChevronRight className="w-4 h-4 rotate-90 text-zinc-400" />
                      </button>}/>
                      <DropdownMenuContent className="w-64 rounded-2xl p-1 shadow-2xl border-none bg-white/95 backdrop-blur-xl" align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="px-3 py-3 border-b border-zinc-100 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Shift Summary</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-bold"><span className="text-zinc-500 uppercase tracking-tighter">Shift Started</span><span className="text-zinc-900 font-black">{new Date(currentSessionData?.startTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                              <div className="flex items-center justify-between text-[10px] font-bold border-t border-zinc-50 pt-2"><span className="text-zinc-500 uppercase tracking-tighter">Opening Float</span><span className="text-blue-600 font-black">{formatCurrency(currentSessionData?.openingFloat || 0)}</span></div>
                            </div>
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-3 py-2">Duty Controls</DropdownMenuLabel>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-emerald-50 cursor-pointer group" onClick={() => handleTimeClock('ACTIVE')}><div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><Play className="w-4 h-4 text-emerald-600" /></div><span className="font-bold text-zinc-700 text-sm">Resume Duty</span></DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-amber-50 cursor-pointer group" onClick={() => handleTimeClock('ON_BREAK')}><div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><Coffee className="w-4 h-4 text-amber-600" /></div><span className="font-bold text-zinc-700 text-sm">On Break</span></DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-orange-50 cursor-pointer group" onClick={() => handleTimeClock('ON_LUNCH')}><div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><Utensils className="w-4 h-4 text-orange-600" /></div><span className="font-bold text-zinc-700 text-sm">On Lunch</span></DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-zinc-100 cursor-pointer group" onClick={() => setIsTransactionHistoryOpen(true)}>
                            <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <History className="w-4 h-4 text-zinc-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">Transaction Ledger</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-zinc-100 cursor-pointer group" onClick={() => setIsShiftHistoryOpen(true)}>
                            <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <History className="w-4 h-4 text-zinc-600" />
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">Shift Records</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-12 px-3 focus:bg-rose-50 cursor-pointer group" onClick={() => setIsClosePromptOpen(true)}>
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

              {/* Search bar — always full width */}
              <div className="relative w-full flex gap-2">
                <div className="relative flex-1">
                  <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input placeholder="Scan or search..." className="pl-10 rounded-xl border-zinc-200 bg-white shadow-sm h-10 text-xs w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleBarcodeScan} />
                </div>
                <Button variant="outline" className="h-10 px-3 rounded-xl border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 shrink-0" onClick={() => setIsScannerOpen(true)}><ScanLine className="w-4 h-4" /></Button>
                <Button 
                  variant="outline" 
                  className="h-10 px-3 rounded-xl border-zinc-200 bg-white shadow-sm hover:text-blue-600 hover:border-blue-200 shrink-0" 
                  onClick={() => window.dispatchEvent(new CustomEvent('switchSupportTab', { detail: 'documentation' }))}
                  title="POS Documentation"
                >
                  <LifeBuoy className="w-4 h-4" />
                </Button>
              </div>


              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {["All Items", "General", ...Array.from(new Set(products.map(p => p.category).filter(c => c && c !== "General")))].map((cat) => (
                  <Badge key={cat} variant="secondary" className={cn("px-4 py-1.5 rounded-full cursor-pointer transition-all border shrink-0 text-[10px] font-bold uppercase tracking-wider", selectedCategory === cat ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50")} onClick={() => setSelectedCategory(cat)}>{cat}</Badge>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-y-auto scroll-smooth px-6 lg:px-8 pb-8 hide-scrollbar">
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
                    {filteredProducts.map((product) => {
                      const stock = productStockMap[product.id] || 0;
                      return (
                        <motion.div key={product.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                          <Card className="card-modern group cursor-pointer overflow-hidden border-zinc-200 hover:border-blue-500/50 transition-all" onClick={() => addToCart(product)}>
                            <div className="aspect-square overflow-hidden bg-zinc-100 relative">
                              <img src={product.image_url || product.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400"} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1581646730702-60193386ec9c?auto=format&fit=crop&q=80&w=400"; }} />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl"><Plus className="w-5 h-5 text-zinc-900" /></div>
                              </div>
                            </div>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-bold text-zinc-900 truncate">{product.name}</p>
                                <div className="text-right"><p className="text-sm font-bold text-blue-600">{formatCurrency(product.retail_price || product.price || 0)}</p></div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{product.category || "General"}</p>
                                <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", stock < 10 ? "text-rose-500 border-rose-100 bg-rose-50" : "text-emerald-500 border-emerald-100 bg-emerald-50")}>{stock} in stock</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                </div>
              )}
              </div>
            </div>
          </div>

          <div className={cn("fixed inset-y-0 right-0 w-full sm:w-[420px] border-l border-zinc-200 bg-white flex flex-col shadow-2xl z-40 transition-all duration-500 ease-in-out md:relative md:shadow-xl md:z-auto", isCartOpenOnMobile ? "translate-x-0" : "translate-x-full md:translate-x-0", isCartCollapsed ? "md:w-0 md:opacity-0 md:pointer-events-none -mr-4" : "md:w-[400px] md:opacity-100")}>
            <div className="flex-none p-4 sm:p-6 lg:p-8 border-b border-zinc-100 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-zinc-900" />
                      <h2 className="text-xl font-bold tracking-tight font-display">Current Order</h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black text-blue-600 tracking-tighter">{formatCurrency(total)}</span>
                      {suspendedOrders.length > 0 && (
                        <button 
                          className="text-[9px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
                          onClick={() => setIsSuspendedOrdersOpen(true)}
                        >
                          <PauseCircle className="w-2.5 h-2.5" /> {suspendedOrders.length} Parked
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="md:hidden h-9 w-9 rounded-xl text-zinc-400"
                      onClick={() => setIsCartOpenOnMobile(false)}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                     <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() => setIsCustomItemDialogOpen(true)}
                    title="Add Custom Item"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-zinc-400 hover:text-amber-600 hover:bg-amber-50"
                    onClick={handleParkOrder}
                    disabled={cart.length === 0}
                    title="Park Order"
                  >
                    <PauseCircle className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      if (cart.length > 0) {
                        const confirm = window.confirm("Are you sure you want to clear the current order?");
                        if (confirm) {
                          if (!isManager) {
                            toast.error("Manager override required to clear active cart.");
                            return;
                          }
                          setCart([]);
                        }
                      }
                    }}
                    disabled={cart.length === 0}
                    title="Clear Cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start rounded-2xl border-zinc-200 h-12 sm:h-14 text-zinc-500 hover:text-zinc-900 bg-zinc-50/50 group transition-all hover:bg-white hover:border-blue-500/30" onClick={() => setIsCustomerSearchOpen(true)}>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shadow-inner">{(selectedCustomer.name || 'CU').substring(0, 2).toUpperCase()}</div>
                      <div className="text-left">
                        <p className="text-sm font-black text-zinc-900">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Account</p>
                      </div>
                    </div>
                     <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-600">{selectedCustomer.points || 0} PTS</p>
                          {Number(selectedCustomer.balance) > 0.01 && (
                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Owes {formatCurrency(selectedCustomer.balance)}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-500 transition-colors" />
                     </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center"><UserPlus className="w-4 h-4" /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-900">Walk-in Customer</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Click to link existing account</p>
                    </div>
                  </div>
                )}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-50/30 scroll-smooth hide-scrollbar relative">
              {/* Reward Horizon — Premium Horizontal Carousel */}
              <AnimatePresence>
                {!isReturnMode && (eligibleCampaigns.length > 0 || upcomingRewards.length > 0) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-zinc-100 overflow-hidden shadow-sm"
                  >
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Live Reward Tracker</span>
                      </div>
                      <button 
                        onClick={() => { setDiscountContext("Campaign"); setIsDiscountDialogOpen(true); }}
                        className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 group"
                      >
                        See All <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    
                    <div className="flex gap-3 px-4 pb-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
                      {/* UNLOCKED CARDS */}
                      {eligibleCampaigns.map(c => {
                        const isApplied = cartDiscount?.id === c.id;
                        return (
                          <motion.div 
                            key={c.id} 
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "snap-start shrink-0 w-48 rounded-2xl p-3 border transition-all relative overflow-hidden",
                              isApplied 
                                ? "bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-200/50" 
                                : "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 shadow-md shadow-emerald-100"
                            )}
                            onClick={() => handleApplyCampaign(c.id)}
                          >
                            <div className="relative z-10 flex flex-col justify-between h-full min-h-[70px]">
                              <div className="flex justify-between items-start">
                                <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                                </div>
                                <div className="text-[8px] font-black text-white/80 uppercase tracking-widest bg-black/10 px-1.5 py-0.5 rounded-md">
                                  {isApplied ? "ACTIVE" : "QUALIFIED"}
                                </div>
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-white leading-tight truncate">{c.name}</p>
                                <div className="flex items-center justify-between mt-1.5">
                                  <p className="text-[9px] font-bold text-emerald-50">One-Tap Redeem</p>
                                  {!isApplied && <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 text-emerald-600" /></div>}
                                </div>
                              </div>
                            </div>
                            {/* Decorative background circle */}
                            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
                          </motion.div>
                        );
                      })}

                      {/* UPCOMING CARDS */}
                      {upcomingRewards.map(c => (
                        <motion.div 
                          key={c.id}
                          className="snap-start shrink-0 w-48 bg-white rounded-2xl p-3 border border-zinc-100 shadow-sm flex flex-col justify-between min-h-[70px]"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-zinc-50 flex items-center justify-center">
                                <Zap className={cn("w-3.5 h-3.5", c.progress > 0.5 ? "text-amber-500" : "text-zinc-300")} />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black text-zinc-900 leading-tight truncate max-w-[90px]">{c.name}</p>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">{Math.round(c.progress * 100)}% Progress</p>
                              </div>
                            </div>
                            <div className="w-5 h-5 rounded-full border-2 border-zinc-100 flex items-center justify-center relative">
                                <svg className="w-full h-full -rotate-90">
                                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 transition-all duration-700" strokeDasharray={2 * Math.PI * 8} strokeDashoffset={2 * Math.PI * 8 * (1 - c.progress)} />
                                </svg>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${c.progress * 100}%` }}
                                className={cn("h-full", c.progress > 0.8 ? "bg-amber-400" : "bg-indigo-400")} 
                              />
                            </div>
                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">
                              Need {c.remaining > 100 ? formatCurrency(c.remaining) : `${c.remaining} more`}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-4 sm:p-6 lg:p-8">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center"><ShoppingCart className="w-10 h-10 text-zinc-400" /></div>
                  <div><p className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Cart is empty</p><p className="text-xs text-zinc-500">Scan items to begin checkout</p></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <AnimatePresence>
                    {cart.map((item) => (
                      <motion.div key={item.product.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex gap-4 group">
                        <div className="w-16 h-16 rounded-xl bg-zinc-100 overflow-hidden shrink-0 border border-zinc-100"><img src={item.product.image_url || item.product.image} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex flex-col mb-1">
                              <p className="text-sm font-bold text-zinc-900 truncate">{item.product.name}</p>
                              {item.discount && (
                                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Tag className="w-2.5 h-2.5" />-{item.discount.type === "Percentage" ? `${item.discount.value}%` : formatCurrency(item.discount.value)} off</span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-zinc-900">{formatCurrency(((item.product.retail_price || item.product.price || 0) * item.quantity) - (item.discount ? (item.discount.type === "Percentage" ? ((item.product.retail_price || item.product.price || 0) * item.quantity * (item.discount.value / 100)) : (item.discount.value * item.quantity)) : 0))}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 bg-zinc-100 rounded-lg p-1 relative">
                                <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-white" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="w-3 h-3" /></Button>
                                <button className="text-xs font-black w-7 h-6 text-center rounded-md hover:bg-white transition-colors cursor-pointer" onClick={() => { setNumpadTarget(item.product.id); setNumpadValue(String(item.quantity)); }}>{item.quantity}</button>
                                <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-white" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="w-3 h-3" /></Button>
                              </div>
                              <Button variant="ghost" size="sm" className={cn("h-8 rounded-lg text-[10px] font-black uppercase tracking-widest", item.discount ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50" : "text-zinc-400 hover:text-zinc-900")} onClick={() => { setSelectedItemForDiscount(item.product.id); setItemDiscount({ type: item.discount?.type || "Percentage", value: item.discount?.value?.toString() || "" }); setIsItemDiscountDialogOpen(true); }}><Tag className="w-3 h-3 mr-1" />{item.discount ? "Adjust" : "Add"}</Button>
                            </div>
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" onClick={() => removeFromCart(item.product.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
            <div id="checkout-footer" className="flex-none bg-white border-t border-zinc-200 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
              <div className="p-4 sm:p-6 space-y-4">
                <AnimatePresence>
                  {isCheckoutDetailsOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4 overflow-hidden pb-4"
                    >
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 rounded-xl h-10 border-zinc-200 text-[10px] font-black text-zinc-600 bg-white" onClick={() => { setDiscountContext("Campaign"); setIsDiscountDialogOpen(true); }}><Tag className="w-3.5 h-3.5 mr-2" />Campaign</Button>
                        <Button variant="outline" className="flex-1 rounded-xl h-10 border-zinc-200 text-[10px] font-black text-zinc-600 bg-white" onClick={() => { setDiscountContext("Manual"); setIsDiscountDialogOpen(true); }}><Percent className="w-3.5 h-3.5 mr-2" />Manual</Button>
                      </div>

                      <div className="space-y-2 text-[11px] font-bold">
                        <div className="flex justify-between"><span className="text-zinc-500 uppercase">Subtotal</span><span className="text-zinc-900">{formatCurrency(subtotal)}</span></div>
                        {cartDiscount && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /><span>{cartDiscount.name}</span></div>
                            <span>-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2"><span className="text-zinc-500 uppercase">Tax ({globalTaxRate}%)</span><Switch checked={isTaxEnabled} onCheckedChange={setIsTaxEnabled} className="scale-75" /></div>
                          <span className="text-zinc-900">{formatCurrency(tax)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {["CARD", "CASH", "SPLIT", "ACCOUNT", "STORE_CREDIT"].map(method => {
                          const hasCredit = selectedCustomer && (selectedCustomer.balance || 0) < -0.01;
                          if (method === "STORE_CREDIT" && !hasCredit) return null;
                          
                          const isActive = paymentMethod === method;
                          return (
                            <Button 
                              key={method}
                              variant={isActive ? "default" : "outline"} 
                              className={cn(
                                "rounded-2xl h-16 flex flex-col items-center justify-center gap-1.5 transition-all border-zinc-100", 
                                isActive 
                                  ? "bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/10 scale-[1.02]" 
                                  : "bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                                method === "STORE_CREDIT" && !isActive && "border-emerald-100 bg-emerald-50/20 text-emerald-600 hover:bg-emerald-50"
                              )} 
                              onClick={() => setPaymentMethod(method as any)}
                              disabled={method === "ACCOUNT" && !selectedCustomer}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                                isActive ? "bg-white/10 text-white" : (method === "STORE_CREDIT" ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400")
                              )}>
                                {method === "CARD" && <CreditCard className="w-3.5 h-3.5" />}
                                {method === "CASH" && <Banknote className="w-3.5 h-3.5" />}
                                {method === "SPLIT" && <Split className="w-3.5 h-3.5" />}
                                {method === "ACCOUNT" && (isReturnMode ? <Wallet className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />)}
                                {method === "STORE_CREDIT" && <History className="w-3.5 h-3.5" />}
                              </div>
                              
                              <span className="text-[9px] font-black uppercase tracking-tighter">
                                {method === "ACCOUNT" 
                                  ? (isReturnMode ? "Credit Note" : "Charge Account") 
                                  : method === "STORE_CREDIT" 
                                    ? `Credit (${formatCurrency(Math.abs(selectedCustomer?.balance || 0))})` 
                                    : method.charAt(0) + method.slice(1).toLowerCase()}
                              </span>
                            </Button>
                          );
                        })}
                      </div>

                      {paymentMethod !== "SPLIT" && (
                        <div className="space-y-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                          <div className="flex justify-between items-center">
                            <Label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tendered</Label>
                            <Input 
                              type="number"
                              placeholder={total.toFixed(2)}
                              value={paidAmount}
                              onChange={(e) => setPaidAmount(e.target.value)}
                              className="h-8 w-24 rounded-lg border-zinc-200 bg-white font-black text-right text-sm"
                            />
                          </div>
                          {parseFloat(paidAmount) > total && (
                            <div className="flex justify-between items-center text-emerald-600 font-black text-[10px]">
                              <span>CHANGE DUE</span>
                              <span>{formatCurrency(parseFloat(paidAmount) - total)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Balance Deduction Banner — only for returns with a customer that has a balance */}
                      {isReturnMode && selectedCustomer && (selectedCustomer.balance || 0) > 0 && (
                        <div className={cn(
                          "flex items-center justify-between gap-3 p-3 rounded-xl border transition-all",
                          deductBalanceOnRefund
                            ? "bg-rose-50 border-rose-200"
                            : "bg-zinc-50 border-zinc-200"
                        )}>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Account Balance Deduction</p>
                            <p className="text-[10px] text-zinc-500 font-medium">
                              Customer owes <span className="font-black text-zinc-800">{formatCurrency(selectedCustomer.balance)}</span>.
                              {deductBalanceOnRefund && (
                                <span className="text-rose-600 font-bold"> Net refund: {formatCurrency(Math.max(0, total - (selectedCustomer.balance || 0)))}</span>
                              )}
                            </p>
                          </div>
                          <Switch
                            checked={deductBalanceOnRefund}
                            onCheckedChange={setDeductBalanceOnRefund}
                            className="data-[state=checked]:bg-rose-500 shrink-0"
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Sticky Bar */}
                <div className="flex items-center gap-3">
                  <div 
                    className="flex-1 flex flex-col cursor-pointer group" 
                    onClick={() => setIsCheckoutDetailsOpen(!isCheckoutDetailsOpen)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{cart.length} {cart.length === 1 ? 'Item' : 'Items'}</span>
                      <ChevronRight className={cn("w-3 h-3 text-zinc-300 transition-transform", isCheckoutDetailsOpen ? "-rotate-90" : "rotate-90")} />
                    </div>
                    <span className="text-xl font-black text-zinc-900 tracking-tighter group-hover:text-blue-600 transition-colors">{formatCurrency(total)}</span>
                  </div>
                  <Button 
                    className={cn(
                      "h-14 px-8 rounded-xl font-black text-lg shadow-xl transition-all active:scale-95 shrink-0",
                      isProcessing ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white shadow-zinc-900/20"
                    )} 
                    onClick={() => {
                      if (!isCheckoutDetailsOpen) { setIsCheckoutDetailsOpen(true); return; }
                      if (paymentMethod === "SPLIT") { 
                        setSplitCashAmount("");
                        setSplitCardAmount("");
                        setSplitCreditAmount("");
                        setIsSplitPaymentDialogOpen(true); 
                      } 
                      else { handleCompleteTransaction(); }
                    }} 
                    disabled={isProcessing || cart.length === 0}
                  >
                    {isProcessing ? "Wait..." : (paymentMethod === "SPLIT" ? "Split Pay" : "Complete")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        
          {/* Mobile Cart Overlay */}
          <AnimatePresence>
            {isCartOpenOnMobile && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCartOpenOnMobile(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
              />
            )}
          </AnimatePresence>

      {/* Campaign / Discount Selection Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight">Apply Discount</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              {discountContext === "Campaign" ? "Active Campaigns & Rewards" : "Manual Discount Override"}
            </DialogDescription>
            <div className="flex bg-zinc-100 p-1 rounded-xl mt-4 gap-1">
              {(["Campaign", "Manual"] as const).map(ctx => (
                <button
                  key={ctx}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    discountContext === ctx ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                  )}
                  onClick={() => setDiscountContext(ctx)}
                >
                  {ctx === "Campaign" ? "🏷️ Campaigns" : "✏️ Manual"}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-6">
              {discountContext === "Campaign" ? (
                <div className="space-y-6">
                  {/* Empty state: no campaigns configured at all */}
                  {campaignProgress.length === 0 && !selectedCustomer && (
                    <div className="text-center py-16 px-4">
                      <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-zinc-100 rotate-3 transition-transform hover:rotate-0">
                        <Star className="w-10 h-10 text-zinc-200" />
                      </div>
                      <h3 className="font-black text-zinc-900 text-lg">No Incentives Available</h3>
                      <p className="text-zinc-400 text-xs font-medium max-w-[200px] mx-auto mt-2 leading-relaxed">
                        Create loyalty campaigns or seasonal rewards in the management console.
                      </p>
                    </div>
                  )}

                  {/* ✓ QUALIFIED REWARDS — Premium Highlight Cards */}
                  {eligibleCampaigns.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Ready to Redeem</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {eligibleCampaigns.map(c => {
                          const discType = c.rules?.discount_type || "Percentage";
                          const discVal = Number(c.rules?.discount_value || 0);
                          const isApplied = cartDiscount?.id === c.id;
                          return (
                            <button
                              key={c.id}
                              onClick={() => handleApplyCampaign(c.id)}
                              className={cn(
                                "relative w-full text-left p-5 rounded-[2rem] border-2 transition-all group overflow-hidden",
                                isApplied
                                  ? "border-emerald-500 bg-emerald-50 shadow-xl shadow-emerald-100 ring-2 ring-emerald-100"
                                  : "border-zinc-100 bg-white hover:border-indigo-100 hover:bg-zinc-50/50"
                              )}
                            >
                              <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-110",
                                    c.isLoyaltyReward ? "bg-amber-100" : "bg-emerald-100"
                                  )}>
                                    {c.isLoyaltyReward ? "🎁" : "🏷️"}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-zinc-900 mb-1">{c.name}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-emerald-600 px-2 py-0.5 bg-emerald-100/50 rounded-full">
                                        {discType === "Percentage" ? `${discVal}% OFF` : `-${formatCurrency(discVal)}`}
                                      </span>
                                      {c.isLoyaltyReward && <span className="text-[10px] font-bold text-amber-600">Loyalty Perk</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {isApplied ? (
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                      <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                                      <Plus className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Background Decorative Sparkle */}
                              {!isApplied && <Sparkles className="absolute -right-2 -bottom-2 w-16 h-16 text-zinc-50/50 group-hover:text-indigo-50 transition-colors" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* IN-PROGRESS REWARDS — Modern Bento Cards */}
                  {upcomingRewards.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-zinc-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-4 bg-zinc-200 rounded-full" />
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">In-Progress Milestones</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {upcomingRewards.map(c => (
                          <div key={c.id} className="bg-zinc-50/50 rounded-3xl p-4 border border-zinc-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div className="w-8 h-8 rounded-xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                                <Zap className={cn("w-4 h-4", c.progress > 0.6 ? "text-amber-500" : "text-zinc-300")} />
                              </div>
                              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                {Math.round(c.progress * 100)}%
                              </span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-zinc-900 leading-tight mb-1">{c.name}</p>
                              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight truncate">
                                Req: {c.requirementLabel}
                              </p>
                            </div>
                            <div className="w-full bg-zinc-200/50 rounded-full h-1.5 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${c.progress * 100}%` }}
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  c.progress > 0.8 ? "bg-amber-400" : c.progress > 0.5 ? "bg-indigo-500" : "bg-zinc-400"
                                )} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Discount Label</Label>
                    <Input
                      placeholder="e.g. Staff Discount, Loyalty Adjustment"
                      value={manualDiscount.name}
                      onChange={e => setManualDiscount(d => ({ ...d, name: e.target.value }))}
                      className="rounded-xl border-zinc-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Type</Label>
                      <div className="flex bg-zinc-100 p-1 rounded-xl gap-1">
                        {(["Percentage", "Fixed Amount"] as const).map(t => (
                          <button
                            key={t}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                              manualDiscount.type === t ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"
                            )}
                            onClick={() => setManualDiscount(d => ({ ...d, type: t }))}
                          >
                            {t === "Percentage" ? "% Off" : "$ Fixed"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Value {manualDiscount.type === "Percentage" ? "(%)" : "($)"}
                      </Label>
                      <Input
                        type="number"
                        placeholder={manualDiscount.type === "Percentage" ? "10" : "5.00"}
                        value={manualDiscount.value}
                        onChange={e => setManualDiscount(d => ({ ...d, value: e.target.value }))}
                        className="rounded-xl border-zinc-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reason (Required for Audit)</Label>
                    <Input
                      placeholder="e.g. Price match, damaged packaging…"
                      value={manualDiscount.reason}
                      onChange={e => setManualDiscount(d => ({ ...d, reason: e.target.value }))}
                      className="rounded-xl border-zinc-200"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700">
                      ⚠️ Your role ({posSession?.payGrade || "STANDARD"}) allows up to {
                        posSession?.payGrade === "STANDARD" ? "10%" :
                        posSession?.payGrade === "SUPERVISOR" ? "25%" : "100%"
                      } discounts.
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-black"
                    onClick={handleApplyManualDiscount}
                  >
                    Apply Discount
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {cartDiscount && (
            <div className="p-4 border-t border-zinc-100 flex items-center justify-between gap-3 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  Active: {cartDiscount.name} (-{formatCurrency(discountAmount)})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-[10px] font-black"
                onClick={() => { setCartDiscount(null); setIsDiscountDialogOpen(false); }}
              >
                Remove
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Payment Dialog — Modern CRM v2 */}
      <Dialog open={isSplitPaymentDialogOpen} onOpenChange={setIsSplitPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          
          {/* Dark Header — Payment Calculator */}
          <div className="bg-zinc-900 p-7 pb-6 space-y-4">
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Split Tendering</p>
              <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(total)}</p>
              <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Order Total to Collect</p>
            </div>
            
            {/* Live Calculation Breakdown */}
            {(() => {
              const creditUsed = Math.min(
                parseFloat(splitCreditAmount) || 0,
                Math.abs(Math.min(0, selectedCustomer?.balance || 0))
              );
              const afterCredit = Math.max(0, total - creditUsed);
              const cashCard = (parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0);
              const remaining = Math.max(0, afterCredit - cashCard);
              const isBalanced = Math.abs(creditUsed + cashCard - total) < 0.01;

              return (
                <div className="space-y-2">
                  <div className="h-[1px] bg-zinc-800" />
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-zinc-400 flex items-center gap-1.5"><Wallet className="w-3 h-3" /> Credit Applied</span>
                    <span className={creditUsed > 0 ? "text-emerald-400" : "text-zinc-600"}>
                      {creditUsed > 0 ? `– ${formatCurrency(creditUsed)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-zinc-400">Balance to Collect (Cash / Card)</span>
                    <span className={afterCredit < 0.01 ? "text-emerald-400" : "text-amber-400"}>{formatCurrency(afterCredit)}</span>
                  </div>
                  {!isBalanced && remaining > 0.01 && (
                    <div className="flex justify-between items-center text-[11px] font-black animate-pulse">
                      <span className="text-rose-400">Still Needed</span>
                      <span className="text-rose-400">{formatCurrency(remaining)}</span>
                    </div>
                  )}
                  {isBalanced && (
                    <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Payment Balanced — Ready to Process</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="p-7 space-y-5">

            {/* Store Credit — First, most impactful */}
            {selectedCustomer && (selectedCustomer.balance || 0) < -0.01 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Wallet className="w-3 h-3 text-emerald-500" /> Store Credit
                  </Label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Available: {formatCurrency(Math.abs(Math.min(0, selectedCustomer.balance)))}
                  </span>
                </div>
                <div className="relative group">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="h-16 pl-12 pr-20 rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 font-black text-2xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-300"
                    value={splitCreditAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val) || 0;
                      const available = Math.abs(Math.min(0, selectedCustomer?.balance || 0));
                      const capped = Math.min(num, available);
                      setSplitCreditAmount(val);
                      // Auto-fill remaining into Cash
                      const rem = Math.max(0, total - capped);
                      setSplitCashAmount(rem > 0.01 ? rem.toFixed(2) : "");
                      setSplitCardAmount("");
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3 rounded-xl text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-100"
                    onClick={() => {
                      const available = Math.abs(Math.min(0, selectedCustomer?.balance || 0));
                      const maxCredit = Math.min(available, total);
                      setSplitCreditAmount(maxCredit.toFixed(2));
                      const rem = Math.max(0, total - maxCredit);
                      setSplitCashAmount(rem > 0.01 ? rem.toFixed(2) : "");
                      setSplitCardAmount("");
                    }}
                  >
                    Max
                  </Button>
                </div>
                {/* Credit Remaining After Purchase */}
                {parseFloat(splitCreditAmount) > 0 && (() => {
                  const available = Math.abs(Math.min(0, selectedCustomer?.balance || 0));
                  const used = Math.min(parseFloat(splitCreditAmount) || 0, available);
                  const leftover = available - used;
                  return (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] text-zinc-400 font-medium">Credit Remaining After Purchase</span>
                      <span className={cn("text-[10px] font-black", leftover > 0.01 ? "text-emerald-600" : "text-zinc-400")}>
                        {leftover > 0.01 ? `+ ${formatCurrency(leftover)}` : "Fully Used"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Cash */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Banknote className="w-3 h-3" /> Cash Amount
                </Label>
                {(parseFloat(splitCreditAmount) || 0) + (parseFloat(splitCashAmount) || 0) > 0 && (
                  <span className="text-[10px] font-bold text-zinc-500">
                    Still needed: {formatCurrency(Math.max(0, total - (parseFloat(splitCreditAmount) || 0) - (parseFloat(splitCashAmount) || 0) - (parseFloat(splitCardAmount) || 0)))}
                  </span>
                )}
              </div>
              <div className="relative">
                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="h-16 pl-12 rounded-2xl border-none bg-zinc-50 font-black text-2xl"
                  value={splitCashAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSplitCashAmount(val);
                    const credit = parseFloat(splitCreditAmount) || 0;
                    const cash = parseFloat(val) || 0;
                    const rem = Math.max(0, total - credit - cash);
                    setSplitCardAmount(rem > 0.01 ? rem.toFixed(2) : "");
                  }}
                />
              </div>
            </div>

            {/* Card */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" /> Card Amount
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="h-16 pl-12 rounded-2xl border-none bg-zinc-50 font-black text-2xl"
                  value={splitCardAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSplitCardAmount(val);
                    const credit = parseFloat(splitCreditAmount) || 0;
                    const card = parseFloat(val) || 0;
                    const rem = Math.max(0, total - credit - card);
                    setSplitCashAmount(rem > 0.01 ? rem.toFixed(2) : "");
                  }}
                />
              </div>
            </div>

            {/* Breakdown Chips */}
            {((parseFloat(splitCashAmount) || 0) > 0 || (parseFloat(splitCardAmount) || 0) > 0 || (parseFloat(splitCreditAmount) || 0) > 0) && (
              <div className="flex flex-wrap gap-2">
                {(parseFloat(splitCreditAmount) || 0) > 0 && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3 py-1 text-[10px] font-black">
                    💳 Credit: {formatCurrency(parseFloat(splitCreditAmount) || 0)}
                  </span>
                )}
                {(parseFloat(splitCashAmount) || 0) > 0 && (
                  <span className="bg-zinc-100 text-zinc-700 rounded-full px-3 py-1 text-[10px] font-black">
                    💵 Cash: {formatCurrency(parseFloat(splitCashAmount) || 0)}
                  </span>
                )}
                {(parseFloat(splitCardAmount) || 0) > 0 && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-[10px] font-black">
                    💳 Card: {formatCurrency(parseFloat(splitCardAmount) || 0)}
                  </span>
                )}
              </div>
            )}

          </div>

          <div className="px-7 pb-7 flex gap-3">
            <Button variant="ghost" className="flex-1 rounded-2xl h-14 font-bold" onClick={() => setIsSplitPaymentDialogOpen(false)}>Cancel</Button>
            <Button 
              className="flex-1 rounded-2xl h-14 font-black bg-zinc-900 text-white shadow-xl shadow-zinc-900/20"
              disabled={Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) + (parseFloat(splitCreditAmount) || 0) - total) > 0.01}
              onClick={() => {
                setIsSplitPaymentDialogOpen(false);
                handleCompleteTransaction();
              }}
            >
              Finalize Split
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      <Dialog open={!!numpadTarget} onOpenChange={(open) => { if (!open) { setNumpadTarget(null); setNumpadValue(""); } }}>
        <DialogContent className="sm:max-w-[320px] rounded-3xl border-zinc-100 p-0 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 p-6 pb-4">
            <DialogTitle className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Set Quantity</DialogTitle>
            <div className="text-5xl font-black text-white text-center tracking-tight min-h-[56px] flex items-center justify-center">{numpadValue || "0"}</div>
          </div>
          <div className="p-4 bg-zinc-900">
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} onClick={() => setNumpadValue(prev => (prev === "0" ? String(n) : prev + String(n)).slice(0, 4))} className="h-14 rounded-2xl bg-zinc-800 border border-zinc-700 text-white font-bold text-xl">{n}</button>)}
              <button onClick={() => setNumpadValue(prev => prev.slice(0, -1))} className="h-14 rounded-2xl bg-zinc-800 border border-zinc-700 text-zinc-400">⌫</button>
              <button onClick={() => setNumpadValue(prev => (prev === "0" ? "0" : prev + "0").slice(0, 4))} className="h-14 rounded-2xl bg-zinc-800 border border-zinc-700 text-white font-bold text-xl">0</button>
              <button onClick={() => {
                const qty = parseInt(numpadValue) || 0;
                if (numpadTarget && qty === 0) {
                  setCart(prev => prev.filter(i => i.product.id !== numpadTarget));
                } else if (numpadTarget && qty > 0) {
                  // BUGFIX: Enforce stock cap \u2014 numpad previously allowed overselling
                  const cartItem = cart.find(i => i.product.id === numpadTarget);
                  if (cartItem && !cartItem.product.isCustom) {
                    const maxStock = getProductStock(numpadTarget);
                    if (qty > maxStock) {
                      toast.error(`Only ${maxStock} units available in stock.`);
                      return;
                    }
                  }
                  setCart(prev => prev.map(i => i.product.id === numpadTarget ? { ...i, quantity: qty } : i));
                }
                setNumpadTarget(null);
                setNumpadValue("");
              }} className="h-14 rounded-2xl bg-emerald-600 text-white font-black text-sm">Set</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Transaction Success / Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => {
        if (!open && showReceipt) handleNewTransaction();
      }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          <div className="p-10 flex flex-col items-center text-center space-y-6">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center shadow-inner",
                lastTransaction?.isReturn ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
              )}
            >
              {lastTransaction?.isReturn ? <ArrowLeft className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
            </motion.div>
            
            <div className="space-y-2">
              <h2 className={cn(
                "text-3xl font-black tracking-tight",
                lastTransaction?.isReturn ? "text-rose-600" :
                lastTransaction?.balanceDue > 0.01 ? "text-blue-600" : "text-zinc-900"
              )}>
                {lastTransaction?.isReturn ? "Return Processed" :
                 lastTransaction?.balanceDue > 0.01 ? "Partial Payment" : "Payment Complete"}
              </h2>
              <div className="flex flex-col items-center gap-1">
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
                  {lastTransaction?.isReturn
                    ? `Refund via ${lastTransaction?.refundMethod === "ACCOUNT" ? "Store Credit" : lastTransaction?.refundMethod}`
                    : lastTransaction?.balanceDue > 0.01 ? "Debt added to customer account" : "Transaction fully resolved"}
                </p>
                {lastTransaction?.isReturn && lastTransaction?.originalTransactionId && (
                  <Badge className="bg-rose-50 text-rose-600 border-rose-200 border text-[9px] font-black uppercase">
                    Ref: #{lastTransaction.originalTransactionId.substring(0, 8).toUpperCase()}
                  </Badge>
                )}
                {!lastTransaction?.isReturn && lastTransaction?.total > 0 && lastTransaction?.customerName !== "Guest Customer" && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] font-black uppercase">
                    <Star className="w-2.5 h-2.5 mr-1 fill-amber-600" />
                    +{Math.floor(lastTransaction?.total || 0)} Points Earned
                  </Badge>
                )}
              </div>
            </div>

            <div className="w-full bg-zinc-50 rounded-3xl p-6 space-y-4 border border-zinc-100">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-zinc-400">{lastTransaction?.isReturn ? "Refund Amount" : "Total Bill"}</span>
                <span className={cn("text-lg font-black", lastTransaction?.isReturn ? "text-rose-600" : "text-zinc-900")}>
                  {lastTransaction?.isReturn ? "-" : ""}{formatCurrency(lastTransaction?.total || 0)}
                </span>
              </div>
              {!lastTransaction?.isReturn && (
                <div className="flex justify-between items-center text-sm font-bold pt-4 border-t border-zinc-100">
                  <span className="text-zinc-400">Amount Received</span>
                  <span className="text-xl font-black text-emerald-600">{formatCurrency(lastTransaction?.tendered || 0)}</span>
                </div>
              )}
              
              {lastTransaction?.change > 0 && (
                <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                  <span>Change Given</span>
                  <span>{formatCurrency(lastTransaction?.change)}</span>
                </div>
              )}

              {lastTransaction?.balanceDue > 0.01 && (
                <div className="flex justify-between items-center text-sm font-bold text-blue-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 mt-2">
                  <span>Remaining Debt</span>
                  <span className="text-lg font-black">{formatCurrency(lastTransaction?.balanceDue)}</span>
                </div>
              )}

              {/* Split Payment Breakdown on Receipt */}
              {lastTransaction?.paymentMethod === "SPLIT" && (
                <div className="mt-2 p-4 rounded-2xl border border-zinc-100 bg-white space-y-3 shadow-sm">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Payment Breakdown</p>
                  {(lastTransaction?.split_credit_amount || 0) > 0 && (
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Wallet className="w-3 h-3 text-emerald-500" /> Store Credit</span>
                      <span className="text-emerald-600">{formatCurrency(lastTransaction.split_credit_amount)}</span>
                    </div>
                  )}
                  {(lastTransaction?.split_cash_amount || 0) > 0 && (
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Banknote className="w-3 h-3 text-amber-500" /> Cash</span>
                      <span className="text-zinc-900">{formatCurrency(lastTransaction.split_cash_amount)}</span>
                    </div>
                  )}
                  {(lastTransaction?.split_card_amount || 0) > 0 && (
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-zinc-500 flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-blue-500" /> Card</span>
                      <span className="text-zinc-900">{formatCurrency(lastTransaction.split_card_amount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Balance Deduction Breakdown — only when deduction was applied on return */}
              {lastTransaction?.isReturn && (lastTransaction?.balanceDeducted || 0) > 0 && (
                <div className="mt-2 p-3 rounded-xl border border-rose-200 bg-rose-50 space-y-2">
                  <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Account Settlement Applied</p>
                  <div className="flex justify-between items-center text-[10px] font-bold text-rose-700">
                    <span>Gross Refund Total</span>
                    <span>{formatCurrency(lastTransaction?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-rose-700">
                    <span>Account Balance Deducted</span>
                    <span>- {formatCurrency(lastTransaction?.balanceDeducted || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-rose-800 pt-1 border-t border-rose-200">
                    <span>Net Payout to Customer</span>
                    <span>{formatCurrency(lastTransaction?.netRefundPaid || 0)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-widest pt-2">
                <span>{lastTransaction?.isReturn ? "Refund Via" : "Method"}</span>
                <span>{lastTransaction?.isReturn && lastTransaction?.refundMethod === "ACCOUNT" ? "Store Credit" : lastTransaction?.paymentMethod}</span>
              </div>
              {lastTransaction?.cashierName && (
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  <span>Processed By</span>
                  <span>{lastTransaction.cashierName}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span>Date & Time</span>
                <span>{lastTransaction?.date}</span>
              </div>
              <div
                className="flex justify-between items-center text-[10px] font-bold text-zinc-400 pt-2 border-t border-zinc-100 cursor-pointer hover:text-zinc-700 transition-colors group"
                title="Click to copy full Receipt ID for returns"
                onClick={() => {
                  navigator.clipboard.writeText(lastTransaction?.id || "");
                  toast.success("Receipt ID copied to clipboard!");
                }}
              >
                <span className="uppercase tracking-widest">{lastTransaction?.isReturn ? "Return Ref ID" : "Receipt ID"}</span>
                <span className="font-mono text-[10px] text-zinc-500 group-hover:text-blue-600 transition-colors">
                  #{lastTransaction?.id?.substring(0, 8).toUpperCase()}
                  <span className="text-[8px] text-zinc-300 ml-1">(tap to copy)</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between w-full px-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Printer Paper Size</span>
              <div className="flex bg-zinc-100 p-1 rounded-xl">
                <button 
                  onClick={() => setReceiptPaperSize("80mm")}
                  className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black transition-all", receiptPaperSize === "80mm" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                >80MM</button>
                <button 
                  onClick={() => setReceiptPaperSize("58mm")}
                  className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black transition-all", receiptPaperSize === "58mm" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                >58MM</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <Button 
                variant="outline" 
                className="rounded-2xl h-14 border-zinc-200 font-bold hover:bg-zinc-50"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="w-4 h-4 mr-2" />
                Receipt
              </Button>
              <Button 
                variant="outline" 
                className="rounded-2xl h-14 border-zinc-200 font-bold hover:bg-zinc-50"
                onClick={async () => {
                  const text = `
RECEIPT - ${branding.name}
ID: #${lastTransaction?.id.substring(0,8).toUpperCase()}
---------------------------
Total Bill: ${formatCurrency(lastTransaction?.total || 0)}
Paid Today: ${formatCurrency(lastTransaction?.tendered || 0)}
${lastTransaction?.change > 0 ? `Change: ${formatCurrency(lastTransaction?.change)}\n` : ''}${lastTransaction?.balanceDue > 0 ? `REMAINING DEBT: ${formatCurrency(lastTransaction?.balanceDue)}\n` : ''}---------------------------
Date: ${lastTransaction?.date}
                  `.trim();
                  
                  // Audit trail
                  await handleQueueCommunication(
                    selectedCustomer?.phone ? "whatsapp" : "email", 
                    "RECEIPT", 
                    selectedCustomer?.phone || selectedCustomer?.email || branding.email,
                    { text, transactionId: lastTransaction?.id }
                  );

                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'Receipt', text });
                    } catch (e: any) {
                      if (e?.name !== 'AbortError') {
                        toast.error("Local share failed, but audit record saved.");
                      }
                    }
                  } else {
                    navigator.clipboard.writeText(text);
                    toast.success("Audit record saved & Text copied");
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            <Button 
              className="w-full rounded-2xl h-16 bg-zinc-900 text-white hover:bg-zinc-800 font-black text-lg shadow-xl shadow-zinc-900/20 transition-all active:scale-95"
              onClick={handleNewTransaction}
            >
              Start New Sale
            </Button>
          </div>

        </DialogContent>
      </Dialog>

       <Dialog open={isClosePromptOpen} onOpenChange={setIsClosePromptOpen}>
         <DialogContent className="w-full max-w-full sm:max-w-2xl rounded-none sm:rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col">
           <div className="p-5 sm:p-8 pb-4 border-b border-zinc-100 bg-zinc-50/50 flex-none">
             <DialogHeader>
               <div className="flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0">
                       <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                     </div>
                     <div>
                       <DialogTitle className="text-lg sm:text-2xl font-black text-zinc-900 tracking-tight">Shift Settlement</DialogTitle>
                       <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] sm:text-[10px]">End of Day Audit & Registry Closure</DialogDescription>
                     </div>
                   </div>
                   {/* X close is auto-injected by DialogContent */}
                 </div>
                 {/* Action buttons always visible, wrap on mobile */}
                 <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl border-zinc-200 h-9 font-bold text-[10px] uppercase tracking-wider" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1.5" /><span className="hidden xs:inline">Print </span>Z-Report</Button>
                   <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl border-zinc-200 h-9 font-bold text-[10px] uppercase tracking-wider" onClick={handleShareZReport}><Share2 className="w-3.5 h-3.5 mr-1.5" />Share</Button>
                 </div>
               </div>
             </DialogHeader>
           </div>

           <ScrollArea className="flex-1 min-h-0">
             <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
                {/* Print Only Z-Report (Hidden in UI) */}
                {isAdmin ? (
                  <POSZReport 
                    branding={branding}
                 session={{
                   id: currentSessionId || "",
                   staffName: selectedAdmin?.name || "",
                   startTime: currentSessionData?.startTime || new Date().toISOString(),
                   endTime: new Date().toISOString(),
                   openingFloat: currentSessionData?.openingFloat || 0,
                   expectedCash: sessionExpectedCash,
                   countedCash: parseFloat(countedCash) || 0,
                   variance: (parseFloat(countedCash) || 0) - sessionExpectedCash,
                   notes: closeRegisterNotes
                 }}
                 stats={sessionStats}
                 formatCurrency={formatCurrency}
                />
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-black text-zinc-900">Settlement Locked</h3>
                    <p className="text-xs text-zinc-500 font-medium max-w-[280px]">
                      Shift settlement details and Z-Reports are restricted to administrative staff only. 
                      Please contact your supervisor to finalize this session.
                    </p>
                  </div>
                )}
                {isAdmin && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
                 <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gross Sales</p>
                   <p className="text-base sm:text-xl font-black text-zinc-900">{formatCurrency(sessionStats.sales)}</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Tax</p>
                   <p className="text-base sm:text-xl font-black text-zinc-900">{formatCurrency(sessionStats.tax)}</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Discounts</p>
                   <p className="text-base sm:text-xl font-black text-rose-600">{formatCurrency(sessionStats.discounts)}</p>
                 </div>
               </div>
                )}
               {/* Cash Audit Section */}
               <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-6 shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50" />
                 
                 <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                   <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Expected Registry Total</p>
                     <p className="text-2xl sm:text-3xl font-black text-white">{formatCurrency(sessionExpectedCash)}</p>
                   </div>
                   <div className="flex bg-white/10 p-1 rounded-xl gap-1 self-start sm:self-auto">
                     <button 
                       className={cn("px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", !isCountingBillsClose ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white")}
                       onClick={() => setIsCountingBillsClose(false)}
                     >
                       Simple
                     </button>
                     <button 
                       className={cn("px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", isCountingBillsClose ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white")}
                       onClick={() => setIsCountingBillsClose(true)}
                     >
                       Denom.
                     </button>
                   </div>
                 </div>

                 <div className="relative z-10 h-px bg-white/10" />

                 <div className="relative z-10 space-y-4">
                   {!isCountingBillsClose ? (
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Manual Cash Count</Label>
                       <div className="relative">
                         <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-2xl group-focus-within:text-white transition-colors">{currency === 'USD' ? '$' : `${currency} `}</span>
                         <Input 
                           placeholder="0.00" 
                           type="number"
                           className={cn(
                             "h-20 rounded-2xl border-none bg-white/5 text-white font-black text-4xl focus:ring-4 focus:ring-blue-500/30 placeholder:text-zinc-700 transition-all shadow-inner",
                             currency.length > 1 ? "pl-24" : "pl-12"
                           )}
                           value={countedCash}
                           onChange={(e) => setCountedCash(e.target.value)}
                         />
                       </div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {[1000, 500, 100, 50, 20, 10, 5, 1].map(denom => (
                          <div key={denom} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-zinc-400 text-xs shadow-inner">
                              {denom}
                            </div>
                            <Input 
                              type="number"
                              placeholder="0"
                              className="h-10 border-none bg-transparent font-bold text-xl text-white p-0 focus-visible:ring-0"
                              value={billCountsClose[denom] || ""}
                              onChange={(e) => handleBillCountChangeClose(denom, e.target.value)}
                            />
                          </div>
                        ))}
                     </div>
                   )}
                 </div>

                 {countedCash && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "relative z-10 p-5 rounded-2xl border-2 flex items-center justify-between font-black shadow-lg",
                      Math.abs(parseFloat(countedCash) - sessionExpectedCash) < 1
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                        : "bg-rose-500/20 border-rose-500/50 text-rose-400"
                    )}
                   >
                     <div className="flex items-center gap-2">
                       <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse shrink-0", Math.abs(parseFloat(countedCash) - sessionExpectedCash) < 1 ? "bg-emerald-400" : "bg-rose-400")} />
                       <span className="text-[9px] sm:text-[10px] uppercase tracking-widest">Audit Variance:</span>
                     </div>
                     <span className="text-lg sm:text-2xl font-black">{formatCurrency(parseFloat(countedCash) - sessionExpectedCash)}</span>
                   </motion.div>
                 )}
               </div>

               {/* Notes & Sync */}
               <div className="space-y-6">
                 <div className="space-y-3">
                   <Label className={cn(
                     "text-[10px] font-black uppercase tracking-widest transition-colors",
                     (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1) ? "text-rose-600" : "text-zinc-400"
                   )}>
                     Audit Reconciliation Notes {(countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1) && "(Required)"}
                   </Label>
                   <textarea 
                     className={cn(
                       "w-full border-2 rounded-3xl p-5 text-sm min-h-[120px] focus:outline-none focus:ring-8 transition-all resize-none shadow-sm font-medium",
                       (countedCash && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1)
                         ? "border-rose-100 bg-rose-50/20 focus:ring-rose-500/5 placeholder:text-rose-300"
                         : "border-zinc-100 bg-zinc-50/50 focus:ring-blue-500/5"
                     )}
                     placeholder={Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 ? "A significant variance was detected. Professional protocols require a detailed explanation for the audit ledger..." : "Optional shift notes..."}
                     value={closeRegisterNotes}
                     onChange={(e) => setCloseRegisterNotes(e.target.value)}
                   />
                 </div>

                 <div className="p-4 sm:p-6 rounded-3xl border-2 border-dashed border-zinc-200 flex flex-col xs:flex-row xs:items-center gap-4 justify-between group hover:border-blue-500/50 transition-all">
                   <div className="flex items-center gap-3">
                     <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shrink-0", isStockSynced ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                       {isStockSynced ? <CheckCircle2 className="w-5 h-5" /> : <RefreshCw className={cn("w-5 h-5", !isStockSynced && "animate-spin-slow")} />}
                     </div>
                     <div>
                       <p className="text-sm font-black text-zinc-900">Inventory Reconciliation</p>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{isStockSynced ? "Ledger synchronized" : "Tap to sync terminal movements"}</p>
                     </div>
                   </div>
                   {!isStockSynced && (
                     <Button 
                       variant="outline" 
                       className="w-full xs:w-auto rounded-xl border-blue-200 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50"
                       onClick={() => {
                         const t = toast.loading("Synchronizing ledger...");
                         setTimeout(() => {
                           setIsStockSynced(true);
                           toast.success("Ledger synchronized", { id: t });
                         }, 1500);
                       }}
                     >
                       Sync Ledger
                     </Button>
                   )}
                 </div>
               </div>
             </div>
           </ScrollArea>

           <div className="p-4 sm:p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col xs:flex-row gap-3 flex-none">
             <Button 
               variant="ghost" 
               className="xs:flex-1 h-12 sm:h-14 rounded-2xl font-bold text-zinc-500 hover:bg-white order-2 xs:order-1"
               onClick={() => setIsClosePromptOpen(false)}
             >
               Cancel
             </Button>
             <Button 
               className={cn(
                 "xs:flex-[2] h-12 sm:h-14 rounded-2xl font-black text-sm sm:text-base shadow-2xl transition-all active:scale-95 order-1 xs:order-2",
                 (!isStockSynced || (countedCash.trim() !== "" && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 && !closeRegisterNotes.trim()))
                   ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                   : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/20"
               )} 
               disabled={!isStockSynced || (countedCash.trim() !== "" && Math.abs(parseFloat(countedCash) - sessionExpectedCash) >= 1 && !closeRegisterNotes.trim())}
               onClick={handleCloseRegister}
             >
               Confirm & Close Register
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

      <Dialog open={isTransactionHistoryOpen} onOpenChange={setIsTransactionHistoryOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-4xl rounded-none sm:rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden h-[100dvh] max-h-[100dvh] sm:h-[80vh] flex flex-col">
          <div className="p-6 sm:p-8 pb-4 border-b border-zinc-100 bg-zinc-50/50 flex-none">
            <DialogHeader className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Transaction Ledger</DialogTitle>
                    <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Full Audit Trail & Return History</DialogDescription>
                  </div>
                </div>
                <div className="flex bg-zinc-100 p-1 rounded-xl gap-1">
                  {(["ALL", "SALE", "RETURN"] as const).map(type => (
                    <button 
                      key={type}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                        transactionFilter === type ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                      )}
                      onClick={() => setTransactionFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 sm:p-8">
              {transactionHistory.length === 0 ? (
                <div className="text-center py-20 opacity-20">
                   <History className="w-16 h-16 mx-auto mb-4" />
                   <p className="font-bold uppercase tracking-widest">No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Receipt ID</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Customer</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Method</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionHistory
                      .filter(tx => transactionFilter === "ALL" || tx.type === transactionFilter)
                      .map((tx) => {
                        const date = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();
                        const isReturn = tx.type === "RETURN";
                        
                        return (
                          <TableRow key={tx.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer" onClick={() => {
                            setLastTransaction(tx);
                            setShowReceipt(true);
                          }}>
                            <TableCell className="font-mono text-[10px] font-bold text-blue-600">{tx.id.substring(0,8).toUpperCase()}</TableCell>
                            <TableCell className="text-[10px] text-zinc-500 font-medium whitespace-nowrap">
                              {date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <span className="font-bold text-[10px] text-zinc-900">{tx.customer_name || "Walk-in"}</span>
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-black text-[10px]",
                              isReturn ? "text-rose-600" : "text-zinc-900"
                            )}>
                              {isReturn ? "-" : ""}{formatCurrency(tx.total)}
                            </TableCell>
                            <TableCell className="text-right text-[9px] font-bold text-zinc-500 uppercase">{tx.payment_method}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn(
                                "text-[8px] font-black border-none px-2",
                                isReturn ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                              )}>
                                {isReturn ? "RETURNED" : "COMPLETED"}
                              </Badge>
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
             <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsTransactionHistoryOpen(false)}>Close Ledger</Button>
          </div>
        </DialogContent>
      </Dialog>
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
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px]">
                      {customer.points || 0} PTS
                    </Badge>
                    {(customer.balance || 0) > 0.01 && (
                      <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-black text-[9px] uppercase">
                        Owes {formatCurrency(customer.balance)}
                      </Badge>
                    )}
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
                const grade = posSession?.payGrade || "STANDARD";
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
      {/* Suspended Orders Dialog */}
      <Dialog open={isSuspendedOrdersOpen} onOpenChange={setIsSuspendedOrdersOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
          <div className="p-8 pb-4 border-b border-zinc-100 bg-zinc-50/50">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <PauseCircle className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-zinc-900">Parked Orders</DialogTitle>
                  <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Suspended carts awaiting retrieval</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <ScrollArea className="h-[450px]">
            <div className="p-6 space-y-4">
              {suspendedOrders.length === 0 ? (
                <div className="text-center py-20 opacity-20">
                  <PauseCircle className="w-16 h-16 mx-auto mb-4" />
                  <p className="font-bold uppercase tracking-widest">No parked orders</p>
                </div>
              ) : (
                suspendedOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="p-5 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-between group hover:border-amber-500/50 hover:bg-white transition-all cursor-pointer shadow-sm hover:shadow-md"
                    onClick={() => handleRetrieveOrder(order)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-zinc-400 group-hover:text-amber-500 shadow-inner">
                        {order.cart.length}
                      </div>
                      <div>
                        <p className="font-black text-zinc-900">{order.customer?.name || "Walk-in Customer"}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          Parked {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {order.staff_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-zinc-900">{formatCurrency(order.total)}</p>
                      <Button variant="ghost" className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-600 group-hover:bg-amber-50 pr-0">Retrieve Order →</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )}
  <div className="md:fixed md:top-0 md:left-0 md:opacity-0 md:pointer-events-none z-[-1]">
    <POSReceipt branding={branding} order={lastTransaction} formatCurrency={formatCurrency} paperSize={receiptPaperSize} />
  </div>
</div>
);
}
