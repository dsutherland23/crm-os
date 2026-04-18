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
  ArrowLeft
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";
import { motion, AnimatePresence } from "motion/react";

import { db, collection, onSnapshot, query, where, doc, addDoc, updateDoc, getDocs, orderBy, limit, serverTimestamp } from "@/lib/firebase";
import { PrintableInvoice } from "./PrintableInvoice";

interface CartDiscount {
  id: string;
  name: string;
  type: "Percentage" | "Fixed Amount";
  value: number;
  target_products?: string[];
}

export default function POS() {
  const { activeBranch, hasActiveTransaction, setHasActiveTransaction, formatCurrency, enterpriseId, branding } = useModules();
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  
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
  const [autoCloseTime, setAutoCloseTime] = useState("");
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closeRegisterNotes, setCloseRegisterNotes] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [timePolicies, setTimePolicies] = useState({
    breakDuration: 15,
    lunchDuration: 30,
    meetingDuration: 60,
    gracePeriod: 10
  });
  const [globalTaxRate, setGlobalTaxRate] = useState(15.0); // Fallback to 15%

  useEffect(() => {
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => {
        setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error("products:", err); setLoading(false); }
    );

    const unsubInventory = onSnapshot(
      query(collection(db, "inventory"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("inventory:", err)
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId)),
      (snapshot) => setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("customers:", err)
    );

    const unsubCampaigns = onSnapshot(
      query(collection(db, "campaigns"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snapshot) => setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("campaigns:", err)
    );

    const unsubStaff = onSnapshot(
      query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId), where("status", "==", "ACTIVE")),
      (snapshot) => {
        const dbStaff = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setStaffList(dbStaff.map(s => ({ ...s, initials: (s.name || '').substring(0, 2).toUpperCase() })));
      },
      (err) => console.error("staff:", err)
    );

    const unsubSettings = onSnapshot(
      doc(db, "settings", "global"),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.autoCloseTime) setAutoCloseTime(data.autoCloseTime);
          if (data.autoCloseEnabled !== undefined) setAutoCloseEnabled(data.autoCloseEnabled);
          if (data.taxRate !== undefined) setGlobalTaxRate(Number(data.taxRate));
          setTimePolicies({
            breakDuration: data.breakDuration ? parseInt(data.breakDuration) : 15,
            lunchDuration: data.lunchDuration ? parseInt(data.lunchDuration) : 30,
            meetingDuration: 60,
            gracePeriod: data.gracePeriod ? parseInt(data.gracePeriod) : 10
          });
        }
      },
      (err) => console.error("settings:", err)
    );

    const unsubSessions = onSnapshot(
      query(collection(db, "pos_sessions"), where("enterprise_id", "==", enterpriseId), where("status", "in", ["ACTIVE", "ON_BREAK", "ON_LUNCH", "IN_MEETING"])),
      (snapshot) => setActiveSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("sessions:", err)
    );

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      unsubProducts();
      unsubInventory();
      unsubCustomers();
      unsubCampaigns();
      unsubStaff();
      unsubSettings();
      unsubSessions();
      clearInterval(timer);
    };
  }, []);

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
        for (const session of activeSessions) {
           if (session.status === 'ON_BREAK' || session.status === 'ON_LUNCH' || session.status === 'IN_MEETING') {
              const lastActivity = new Date(session.lastActivity || session.startTime);
              const minutesElapsed = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
              
              let allowedDuration = timePolicies.gracePeriod; // Default to just grace period if we don't know the status somehow
              if (session.status === 'ON_BREAK') allowedDuration += timePolicies.breakDuration;
              if (session.status === 'ON_LUNCH') allowedDuration += timePolicies.lunchDuration;
              if (session.status === 'IN_MEETING') allowedDuration += timePolicies.meetingDuration;

              if (minutesElapsed >= allowedDuration) {
                 try {
                   await updateDoc(doc(db, "pos_sessions", session.id), {
                     endTime: now.toISOString(),
                     status: "CLOSED",
                     notes: `System auto-logout due to exceeded ${session.status.replace('_', ' ').toLowerCase()} limits.`
                   });
                   await addDoc(collection(db, "audit_logs"), {
                     action: "Shift Auto-Closed",
                     details: `Staff member ${session.staffName} exceeded allowed time. Register closed automatically.`,
                     timestamp: now.toISOString(),
                     user: "System",
                   });
                 } catch (err) {
                   console.error("Failed to auto logout session", err);
                 }
              }
           }
        }
      };

      evaluateAutoLogout();
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [autoCloseTime, autoCloseEnabled, isAuthorized, isClosePromptOpen, activeSessions, timePolicies]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail === "NEW_SALE") {
        setCart([]);
        setCartDiscount(null);
        setSelectedCustomer(null);
        document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus();
      }
    };
    window.addEventListener("app:action", handleAction);
    return () => window.removeEventListener("app:action", handleAction);
  }, []);

  const getProductStock = (productId: string) => {
    if (activeBranch === "all") {
      return inventory
        .filter(i => i.product_id === productId)
        .reduce((acc, curr) => acc + curr.stock, 0);
    }
    const item = inventory.find(i => i.product_id === productId && i.branch_id === activeBranch);
    return item ? item.stock : 0;
  };

  const addToCart = (product: any) => {
    const stock = getProductStock(product.id);
    if (stock <= 0) {
      toast.error("Item out of stock at this branch");
      return;
    }

    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= stock) {
        toast.error("Cannot add more than available stock");
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    toast.success(`${product.name} added to cart`, {
      duration: 1000,
      position: "bottom-right"
    });
  };

  const handleScanResult = (data: string, type: 'barcode' | 'qr') => {
    const product = products.find(p => p.barcode === data || p.sku === data || p.id === data);
    if (product) {
      addToCart(product);
      toast.success(`Added ${product.name} to cart`);
    } else {
      toast.error(`No product found for ${type}: ${data}`);
    }
  };

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
    
    // Support targeted products or default to all if empty array/undefined
    const targetProducts = campaign.target_products && campaign.target_products.length > 0 ? campaign.target_products : undefined;
    
    const val = Number(campaign.rules?.discount_value || 0);
    const type = campaign.rules?.discount_type === "Percentage" ? "Percentage" : "Fixed Amount";

    setCartDiscount({
      id: campaign.id,
      name: campaign.name,
      type: type as any,
      value: val,
      target_products: targetProducts
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

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + ((item.product.retail_price || item.product.price || 0) * item.quantity), 0);
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  
  const eligibleCampaigns = campaigns.filter(c => {
    const reqQty = Number(c.rules?.req_quantity || 1);
    return totalItems >= reqQty;
  });

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

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  // Ensure we safely handle dividing by 100 for the percentage
  const calculatedTaxRate = (globalTaxRate || 15) / 100;
  const tax = taxableAmount * calculatedTaxRate;
  const total = taxableAmount + tax;

  const handleCompleteTransaction = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (isProcessing) return; // idempotency guard

    setIsProcessing(true);
    try {
      const resolvedBranch = activeBranch === "all" ? "main" : activeBranch;

      // 1. Write the transaction document
      const txRef = await addDoc(collection(db, "transactions"), {
        items: cart.map(item => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.retail_price || item.product.price || 0,
          subtotal: (item.product.retail_price || item.product.price || 0) * item.quantity
        })),
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        branch_id: resolvedBranch,
        payment_method: paymentMethod,
        subtotal,
        discount: cartDiscount ? { ...cartDiscount, amount: discountAmount } : null,
        discount_amount: discountAmount,
        tax_rate: globalTaxRate,
        tax,
        total,
        status: "COMPLETED",
        cashier_id: selectedAdmin?.id || null,
        cashier_name: selectedAdmin?.name || null,
        timestamp: serverTimestamp(),
        enterprise_id: enterpriseId
      });

      // 2. Deduct inventory stock for each item
      await Promise.all(cart.map(async (item) => {
        const invItem = inventory.find(i =>
          i.product_id === item.product.id &&
          (activeBranch === "all" ? true : i.branch_id === resolvedBranch)
        );
        if (invItem) {
          await updateDoc(doc(db, "inventory", invItem.id), {
            stock: Math.max(0, (invItem.stock || 0) - item.quantity)
          });
        }
      }));

      // 3. Update customer LTV if linked
      if (selectedCustomer?.id) {
        await updateDoc(doc(db, "customers", selectedCustomer.id), {
          spend: (selectedCustomer.spend || 0) + total,
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
            // Check for an existing open session for this user at this branch
            const activeSessionQuery = query(
              collection(db, "pos_sessions"),
              where("staffId", "==", selectedAdmin.id),
              where("status", "in", ["ACTIVE", "ON_BREAK", "ON_LUNCH"]),
              orderBy("startTime", "desc"),
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
                 });
              } else {
                 await addDoc(collection(db, "audit_logs"), {
                   action: "Terminal Unlocked",
                   details: `Staff member ${selectedAdmin.name} unlocked the terminal`,
                   timestamp: new Date().toISOString(),
                   user: selectedAdmin.name,
                 });
              }
              setCurrentSessionId(existingSession.id);
              toast.success(`Welcome back, ${selectedAdmin.name}`);
            } else {
              // Create new session
              const docRef = await addDoc(collection(db, "pos_sessions"), {
                staffId: selectedAdmin.id,
                staffName: selectedAdmin.name,
                branchId: activeBranch,
                startTime: new Date().toISOString(),
                status: "ACTIVE",
                enterprise_id: enterpriseId
              });
              await addDoc(collection(db, "audit_logs"), {
                action: "Shift Started",
                details: `Staff member ${selectedAdmin.name} started a new shift`,
                timestamp: new Date().toISOString(),
                user: selectedAdmin.name,
              });
              setCurrentSessionId(docRef.id);
              toast.success("Authorization successful - Shift Started");
            }
            setIsAuthorized(true);
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

  const handleTimeClock = async (statusType: "ON_BREAK" | "ON_LUNCH" | "IN_MEETING" | "LOCKED") => {
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
        });
      } catch (err) { }
      toast.info("Terminal Locked");
    }
    
    // Always lock terminal layout back to PIN screen safely, using timeout to prevent DropdownMenu crash
    setTimeout(() => {
      setIsAuthorized(false);
      setSelectedAdmin(null);
      setPinEntry("");
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
        await updateDoc(doc(db, "pos_sessions", currentSessionId), {
          endTime: new Date().toISOString(),
          status: "CLOSED",
          countedCash: countedCash || "0",
          notes: closeRegisterNotes
        });
        
        await addDoc(collection(db, "audit_logs"), {
          action: "Shift Closed",
          details: `Staff member ${selectedAdmin?.name || 'Unknown'} closed the register with ${countedCash ? '$'+countedCash : 'no'} declared cash`,
          timestamp: new Date().toISOString(),
          user: selectedAdmin?.name || "System",
        });
      } catch (error) {
        console.error("Failed to update session record", error);
      }
    }
    toast.success(`Register closed successfully for ${selectedAdmin?.name || 'User'}`);
    setIsClosePromptOpen(false);
    setIsAuthorized(false);
    setSelectedAdmin(null);
    setPinEntry("");
    setCountedCash("");
    setCloseRegisterNotes("");
    setCurrentSessionId(null);
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
                <span className="text-[10px] font-bold uppercase tracking-widest">Branch: {activeBranch.toUpperCase()}</span>
                {selectedAdmin && (
                  <>
                    <span className="text-zinc-300 mx-1">•</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">User: {selectedAdmin.initials}</span>
                    <span className="text-zinc-300 mx-1">•</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
                            Shift Options
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48 rounded-xl font-medium">
                         <DropdownMenuGroup>
                           <DropdownMenuLabel className="text-[10px] tracking-widest text-zinc-400">Terminal Control</DropdownMenuLabel>
                           <DropdownMenuItem onClick={() => handleTimeClock("LOCKED")}>
                             Lock Terminal
                           </DropdownMenuItem>
                         </DropdownMenuGroup>
                         <DropdownMenuSeparator />
                         <DropdownMenuGroup>
                           <DropdownMenuLabel className="text-[10px] tracking-widest text-zinc-400">Time Clock</DropdownMenuLabel>
                           <DropdownMenuItem onClick={() => handleTimeClock("ON_BREAK")}>
                             Start Short Break
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleTimeClock("ON_LUNCH")}>
                             Start Lunch
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleTimeClock("IN_MEETING")}>
                             In Meeting
                           </DropdownMenuItem>
                         </DropdownMenuGroup>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem onClick={() => setIsClosePromptOpen(true)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 font-bold">
                           Close Register
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-zinc-900 font-display">Terminal</h1>
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
                          src={product.image_url || product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
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
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(product.retail_price || product.price)}</p>
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
        "fixed inset-y-0 right-0 w-full sm:w-[420px] border-l border-zinc-200 bg-white flex flex-col shadow-2xl z-40 transition-transform duration-500 lg:relative lg:w-[420px] lg:translate-x-0 lg:shadow-xl",
        isCartOpenOnMobile ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 lg:p-8 border-b border-zinc-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-zinc-900" />
              <h2 className="text-xl font-bold tracking-tight font-display">Current Order</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white border-none px-2 py-0.5 rounded-lg">{cart.length} items</Badge>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsCartOpenOnMobile(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button 
                  variant="outline" 
                  className="w-full justify-start rounded-xl border-zinc-200 h-11 text-zinc-500 hover:text-zinc-900 bg-zinc-50/50"
                >
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                          {selectedCustomer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-zinc-900">{selectedCustomer.name}</span>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">{selectedCustomer.points || 0} pts</Badge>
                    </div>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Link Customer
                    </>
                  )}
                </Button>
              }
            />
             <DropdownMenuContent className="w-80 rounded-xl border-zinc-200 p-2">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 pt-2">Link Customer</DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Search customers..."
                    className="h-9 rounded-lg text-xs"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <ScrollArea className="max-h-52">
                  {customers
                    .filter(c => {
                      const term = customerSearch.toLowerCase();
                      return !term ||
                        (c.name || "").toLowerCase().includes(term) ||
                        (c.email || "").toLowerCase().includes(term) ||
                        (c.phone || "").includes(term);
                    })
                    .slice(0, 20)
                    .map(c => (
                      <DropdownMenuItem key={c.id} className="rounded-lg cursor-pointer" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="font-bold text-zinc-900 text-sm">{c.name}</p>
                            <p className="text-xs text-zinc-400">{c.email}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] ml-2">{c.segment || "Customer"}</Badge>
                        </div>
                      </DropdownMenuItem>
                    ))}
                </ScrollArea>
                {selectedCustomer && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="rounded-lg cursor-pointer text-rose-600 focus:text-rose-600" onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}>
                      Remove Customer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* AI Upsell Suggestion */}
          {cart.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 flex gap-3 items-start"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">AI Recommendation</p>
                <p className="text-xs text-zinc-700 leading-relaxed">
                  Add <span className="font-bold">AppleCare+</span> for this device to increase protection. 
                  <button className="text-blue-600 font-bold hover:underline ml-1">Add {formatCurrency(199)}</button>
                </p>
              </div>
            </motion.div>
          )}
        </div>

        <ScrollArea className="flex-1 p-8">
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
                        <p className="text-sm font-bold text-zinc-900 truncate">{item.product.name}</p>
                        <p className="text-sm font-bold text-zinc-900">{formatCurrency((item.product.retail_price || item.product.price || 0) * item.quantity)}</p>
                      </div>
                      <div className="flex items-center justify-between">
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

        <div className="p-8 bg-zinc-50 border-t border-zinc-200 space-y-6">
          
          <AnimatePresence>
            {eligibleCampaigns.length > 0 && !cartDiscount && (
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
                    {eligibleCampaigns.map(campaign => (
                      <div key={campaign.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
                        <div className="flex flex-col flex-1 min-w-0 pr-4">
                          <span className="text-sm font-bold text-zinc-900 truncate">{campaign.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium truncate">{campaign.description || 'Exclusive discount available'}</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                          onClick={() => handleApplyCampaign(campaign.id)}
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
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

            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Tax ({globalTaxRate}%)</span>
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
                  <p className="text-xs text-zinc-500">Order #{lastTransaction?.id?.substring(0,8).toUpperCase()}</p>
               </div>
               <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-4 font-bold border-zinc-200"
                    onClick={() => {
                       const printContents = document.getElementById('printable-invoice')?.innerHTML;
                       if (printContents) {
                         const originalContents = document.body.innerHTML;
                         document.body.innerHTML = printContents;
                         window.print();
                         document.body.innerHTML = originalContents;
                         window.location.reload(); // Reload to restore state if needed, or better use print styles
                       } else {
                         window.print();
                       }
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
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
                <PrintableInvoice 
                  branding={branding} 
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

      {/* Mobile Cart Toggle */}
      <Button 
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl z-30 lg:hidden bg-blue-600 text-white hover:bg-blue-700",
          isCartOpenOnMobile && "hidden"
        )}
        onClick={() => setIsCartOpenOnMobile(true)}
      >
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-blue-600">
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
            
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-zinc-900">No stock deductions pending</p>
                  <p className="text-xs text-zinc-500">Press Sync Stock Deductions to confirm before closing.</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold border border-zinc-200"
                onClick={async () => {
                  try {
                    await addDoc(collection(db, "audit_logs"), {
                      action: "Stock Sync Requested",
                      details: `Manual stock deduction sync triggered by ${selectedAdmin?.name || 'Unknown'} at register close`,
                      timestamp: serverTimestamp(),
                      user: selectedAdmin?.name || "System"
                    });
                    toast.success("Stock deductions confirmed and logged");
                  } catch (err) {
                    toast.error("Failed to sync stock deductions");
                  }
                }}
              >
                <Package className="w-4 h-4 mr-2" /> Sync Stock Deductions
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-zinc-900">Amount Counted</Label>
              <Input 
                placeholder="Enter cash counted" 
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="border-green-100 bg-green-50/30 focus-visible:ring-green-500" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-zinc-900">Notes (Optional)</Label>
              <textarea 
                className="w-full border border-zinc-200 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all resize-none"
                placeholder="Add any notes about this cash count..."
                value={closeRegisterNotes}
                onChange={(e) => setCloseRegisterNotes(e.target.value)}
              />
            </div>
            
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
              <p className="text-xs font-bold text-amber-900">⚠️ Please press "Sync Stock Deductions" above before closing the register.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button variant="outline" onClick={() => setIsClosePromptOpen(false)} className="rounded-xl border-zinc-200 hover:bg-zinc-50 font-bold flex-1">Cancel</Button>
            <Button className="rounded-xl bg-zinc-500 hover:bg-zinc-600 text-white font-bold flex-1" onClick={handleCloseRegister}>Close Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
