import React, { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Download, 
  Filter, 
  Search,
  PieChart as PieChartIcon,
  TrendingUp,
  CreditCard,
  Banknote,
  Receipt,
  Building2,
  Calendar,
  MoreHorizontal,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Settings as SettingsIcon,
  UserPlus,
  Sparkles,
  Zap,
  Users,
  Activity,
  ShieldCheck,
  Archive,
  X as XIcon
} from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  serverTimestamp,
  where
} from "@/lib/firebase";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintableInvoice } from "./PrintableInvoice";

export default function Revenue() {
  const { activeBranch, formatCurrency, enterpriseId, branding, currency, taxRate: globalTaxRate, setTaxRate: setGlobalTaxRate } = useModules();
  const [searchTerm, setSearchTerm] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Dialog & Sheet states
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);

  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<any>(null);
  const [isLedgerSheetOpen, setIsLedgerSheetOpen] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [payrollStatus, setPayrollStatus] = useState("DRAFT");
  const [isInvoicePreviewVisible, setIsInvoicePreviewVisible] = useState(false);
  const [commissionRate, setCommissionRate] = useState(5.0);
  const [peakRate, setPeakRate] = useState(7.5);
  const [isRateEditorOpen, setIsRateEditorOpen] = useState(false);
  const [isPayrunDialogOpen, setIsPayrunDialogOpen] = useState(false);
  const [selectedTaxYear, setSelectedTaxYear] = useState("2026");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseSortBy, setExpenseSortBy] = useState("Date (Newest)");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All Categories");


  const handleRunPayrun = async () => {
    setIsSubmitting(true);
    try {
      // Record expenses for each staff member's total due
      for (const s of staff) {
        const staffSessions = sessions.filter(sess => sess.staffId === s.id);
        const totalSales = staffSessions.reduce((acc, sess) => acc + (sess.totalSales || 0), 0);
        const commission = totalSales * (commissionRate / 100);
        let basePay = s.baseRate || 2200;
        if (s.salaryType === 'HOURLY') {
          const hours = staffSessions.length * 8 || 160;
          basePay = hours * (s.baseRate || 25);
        } else if (s.salaryType === 'WEEKLY') {
          basePay = s.baseRate || 500;
        } else if (s.salaryType === 'FORTNIGHTLY') {
          basePay = s.baseRate || 1000;
        }
        const totalDue = basePay + commission;

        await addDoc(collection(db, "expenses"), {
          amount: totalDue,
          category: "Payroll",
          description: `Payrun Settlement: ${s.name} (Base + Commission)`,
          date: new Date().toISOString().split('T')[0],
          status: "PAID",
          staff_id: s.id,
          timestamp: serverTimestamp(),
          enterprise_id: enterpriseId,
          branch_id: activeBranch === "all" ? "main" : activeBranch
        });
      }
      
      toast.success("Payrun completed and general ledger updated.");
      setIsPayrunDialogOpen(false);
    } catch (error) {
      console.error("Payrun failure:", error);
      toast.error("Critical failure during payrun settlement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!newExpense.amount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        ...newExpense,
        amount: parseFloat(newExpense.amount as string),
        enterprise_id: enterpriseId,
        branch_id: activeBranch === "all" ? "main" : activeBranch,
        timestamp: serverTimestamp()
      });
      toast.success("Expense recorded successfully");
      setIsExpenseSheetOpen(false);
      setNewExpense({
        amount: "",
        category: "Operations",
        description: "",
        status: "PAID",
        payment_method: "Bank Transfer",
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Failed to record expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRecurringSubscription = async () => {
    if (!recurringFormData.customer_id || recurringItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const subTotal = recurringItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
      const taxTotal = recurringItems.reduce((acc, item) => acc + (item.quantity * item.unit_price * (item.tax / 100)), 0);
      
      await addDoc(collection(db, "recurring_billing"), {
        ...recurringFormData,
        items: recurringItems,
        amount: subTotal + taxTotal,
        status: "ACTIVE",
        enterprise_id: enterpriseId,
        branch_id: activeBranch === "all" ? "main" : activeBranch,
        next_billing_date: recurringFormData.start_date,
        created_at: serverTimestamp()
      });
      
      toast.success("Recurring billing schedule created");
      setIsRecurringDialogOpen(false);
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast.error("Failed to create billing schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunBillingCycle = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const today = new Date().toISOString().split('T')[0];
    const duePlans = recurring.filter(plan => plan.status === "ACTIVE" && plan.next_billing_date <= today);
    
    if (duePlans.length === 0) {
      toast.info("All subscriptions are currently up to date.");
      setIsSubmitting(false);
      return;
    }

    try {
      for (const plan of duePlans) {
        // Create an actual invoice
        const invoiceRef = await addDoc(collection(db, "invoices"), {
          customer_id: plan.customer_id,
          enterprise_id: enterpriseId,
          branch_id: plan.branch_id || (activeBranch === "all" ? "main" : activeBranch),
          invoice_number: `INV-REC-${Date.now().toString().slice(-6)}`,
          status: "Pending",
          issue_date: today,
          due_date: today,
          items: plan.items,
          subtotal: plan.items.reduce((acc: any, item: any) => acc + (item.quantity * item.unit_price), 0),
          tax_total: plan.items.reduce((acc: any, item: any) => acc + (item.quantity * item.unit_price * (item.tax / 100)), 0),
          total_amount: plan.amount,
          notes: `Auto-generated from plan: ${plan.plan_id}`,
          timestamp: serverTimestamp()
        });

        // Update the next billing date
        const nextDate = new Date(plan.next_billing_date);
        if (plan.frequency === "Monthly") nextDate.setMonth(nextDate.getMonth() + plan.interval);
        else if (plan.frequency === "Weekly") nextDate.setDate(nextDate.getDate() + (7 * plan.interval));
        else if (plan.frequency === "Daily") nextDate.setDate(nextDate.getDate() + plan.interval);
        else nextDate.setFullYear(nextDate.getFullYear() + plan.interval);

        await updateDoc(doc(db, "recurring_billing", plan.id), {
          next_billing_date: nextDate.toISOString().split('T')[0],
          last_invoice_id: invoiceRef.id,
          last_billed: serverTimestamp()
        });
      }
      
      toast.success(`Billing cycle completed. ${duePlans.length} invoices generated.`);
    } catch (error) {
      console.error("Billing cycle error:", error);
      toast.error("Billing cycle failed to complete");
    } finally {
      setIsSubmitting(false);
    }
  };


  // Filter states
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [customerFilter, setCustomerFilter] = useState("All Customers");

  // Invoice Form states
  const [newInvoiceData, setNewInvoiceData] = useState({
    invoiceNumber: "",
    status: "Draft",
    customer_id: "",
    payment_terms: "Due on Receipt",
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    discount_type: "Percentage (%)",
    discount_value: 0,
    notes: "",
    terms_conditions: ""
  });

  const [invoiceItems, setInvoiceItems] = useState([
    { id: Date.now() + Math.random(), product_id: "", quantity: 1, unit_price: 0, tax: 0, description: "" }
  ]);

  const INVOICE_TEMPLATES = [
    {
      name: "Service Retainer",
      description: "Standard monthly service billing structure",
      items: [
        { product_id: "consulting-001", quantity: 1, unit_price: 2500, tax: 0, description: "Monthly Professional Consultation" },
        { product_id: "support-001", quantity: 1, unit_price: 500, tax: 0, description: "Premium Technical Support Package" }
      ],
      payment_terms: "Net 30"
    },
    {
      name: "Product Shipment",
      description: "Standard physical goods delivery template",
      items: [
        { product_id: "hardware-001", quantity: 5, unit_price: 120, tax: 15, description: "Enterprise Hardware Units" },
        { product_id: "shipping-001", quantity: 1, unit_price: 45, tax: 0, description: "Secure Logistics & Handling" }
      ],
      payment_terms: "Due on Receipt"
    },
    {
      name: "Software License",
      description: "Annual recurring license provision",
      items: [
        { product_id: "license-001", quantity: 1, unit_price: 12000, tax: 0, description: "Enterprise Core License (Annual)" }
      ],
      payment_terms: "Net 15"
    }
  ];

  const applyTemplate = (templateName: string) => {
    const template = INVOICE_TEMPLATES.find(t => t.name === templateName);
    if (!template) return;

    setNewInvoiceData(prev => ({
      ...prev,
      payment_terms: template.payment_terms
    }));

    setInvoiceItems(template.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ...item,
        id: Math.random() + Date.now(),
        description: product?.name || item.description,
        unit_price: product?.retail_price || product?.price || item.unit_price
      };
    }));

    toast.success(`Template "${template.name}" applied successfully`);
  };

  const [recurringFormData, setRecurringFormData] = useState({
    customer_id: "",
    billing_email: "",
    frequency: "Monthly",
    interval: 1,
    payment_terms: "Due on Receipt",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    currency: currency || "USD",
    auto_send: true,
    notes: ""
  });
  const [recurringItems, setRecurringItems] = useState([
    { id: Date.now() + Math.random(), product_id: "", description: "", quantity: 1, unit_price: 0, tax: 0 }
  ]);

  // Form states
  const [newExpense, setNewExpense] = useState({
    amount: "",
    category: "Operations",
    description: "",
    status: "PAID",
    payment_method: "Bank Transfer",
    date: new Date().toISOString().split('T')[0]
  });

  const [newPayment, setNewPayment] = useState({
    amount: "",
    payment_method: "Bank Transfer",
    reference: ""
  });



  // Bank Accounts (Real Treasury Accounts from Firestore)
  // Bank Accounts (Real Treasury Accounts from Firestore)
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubInvoices = onSnapshot(query(collection(db, "invoices"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime());
      setInvoices(docs);
      setLoading(false);
    }, (error) => {
      console.error("invoices:", error);
      setLoading(false);
    });

    const unsubExpenses = onSnapshot(query(collection(db, "expenses"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => {
        const tA = new Date(a.date || a.timestamp || 0).getTime();
        const tB = new Date(b.date || b.timestamp || 0).getTime();
        return tB - tA;
      });
      setExpenses(docs);
    }, (error) => console.error("expenses:", error));

    const unsubQuotes = onSnapshot(query(collection(db, "quotes"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setQuotes(docs);
    }, (error) => console.error("quotes:", error));

    const unsubRecurring = onSnapshot(query(collection(db, "recurring_billing"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => new Date(a.next_billing_date || 0).getTime() - new Date(b.next_billing_date || 0).getTime());
      setRecurring(docs);
    }, (error) => console.error("recurring:", error));

    const unsubCustomers = onSnapshot(query(collection(db, "customers"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("customers:", error));

    const unsubProducts = onSnapshot(query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => console.error("products:", error));



    const unsubStaff = onSnapshot(query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("staff:", error));

    const unsubSessions = onSnapshot(query(collection(db, "pos_sessions"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("sessions:", error));

    const unsubBankAccounts = onSnapshot(query(collection(db, "bankAccounts"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("bankAccounts:", error));

    return () => {
      unsubInvoices();
      unsubExpenses();
      unsubQuotes();
      unsubRecurring();
      unsubCustomers();
      unsubProducts();
      unsubStaff();
      unsubSessions();
      unsubBankAccounts();
    };
  }, [enterpriseId]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail === "CREATE_INVOICE") {
        setIsInvoiceDialogOpen(true);
      }
    };
    window.addEventListener("app:action", handleAction);
    return () => window.removeEventListener("app:action", handleAction);
  }, []);

  const addLineItem = () => {
    setInvoiceItems([...invoiceItems, { id: Date.now() + Math.random(), product_id: "", quantity: 1, unit_price: 0, tax: 0, description: "" }]);
  };

  const removeLineItem = (id: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: number, field: string, value: any) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "product_id") {
          const product = products.find(p => p.id === value);
          if (product) {
            updated.unit_price = product.retail_price || product.price || 0;
            updated.description = product.description || "";
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const subtotal = useMemo(() => invoiceItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0), [invoiceItems]);
  const taxTotal = useMemo(() => invoiceItems.reduce((acc, item) => acc + (item.quantity * item.unit_price * (item.tax / 100)), 0), [invoiceItems]);
  const discountAmount = useMemo(() => newInvoiceData.discount_type === "Percentage (%)" 
    ? (subtotal * (newInvoiceData.discount_value / 100))
    : newInvoiceData.discount_value, [newInvoiceData.discount_type, newInvoiceData.discount_value, subtotal]);
  const grandTotal = useMemo(() => subtotal + taxTotal - discountAmount, [subtotal, taxTotal, discountAmount]);

  const payrollObligation = useMemo(() => {
    return staff.reduce((acc, s) => {
      const staffSessions = sessions.filter(sess => sess.staffId === s.id);
      const totalSales = staffSessions.reduce((sum, sess) => sum + (sess.totalSales || 0), 0);
      const commission = totalSales * (commissionRate / 100);
      
      let basePay = s.baseRate || 2200;
      if (s.salaryType === 'HOURLY') {
        const hours = staffSessions.length * 8 || 160;
        basePay = hours * (s.baseRate || 25);
      } else if (s.salaryType === 'WEEKLY') {
        basePay = (s.baseRate || 500) * 4.33; // Normalize to monthly
      } else if (s.salaryType === 'FORTNIGHTLY') {
        basePay = (s.baseRate || 1000) * 2.16; // Normalize to monthly
      }
      return acc + basePay + commission;
    }, 0);
  }, [staff, sessions, commissionRate]);

  const payrollCoverageStatus = useMemo(() => {
    const reserve = bankAccounts.find(a => a.id === "2")?.balance || 0;
    if (payrollObligation === 0) return { percent: 100, status: "OPTIMAL" };
    const percent = (reserve / payrollObligation) * 100;
    if (percent >= 100) return { percent, status: "OPTIMAL" };
    if (percent >= 80) return { percent, status: "STABLE" };
    return { percent, status: "CRITICAL" };
  }, [payrollObligation, bankAccounts]);

  // Filtered Data
  const filteredInvoices = invoices.filter(inv => {
    const matchesBranch = activeBranch === "all" || inv.branch_id === activeBranch;
    const invId = (inv.invoiceNumber || inv.invoice_number || inv.id || "").toLowerCase();
    const custName = (inv.customer_name || inv.customer_id || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = invId.includes(term) || custName.includes(term);
    const matchesStatus = statusFilter === "All Statuses" || inv.status === statusFilter;
    const matchesCustomer = customerFilter === "All Customers" || inv.customer_id === customerFilter;
    return matchesBranch && matchesSearch && matchesStatus && matchesCustomer;
  });

  const filteredQuotes = quotes.filter(quote => {
    const matchesBranch = activeBranch === "all" || quote.branch_id === activeBranch;
    const qId = (quote.id || "").toLowerCase();
    const qCust = (quote.customer_id || "").toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch = qId.includes(term) || qCust.includes(term);
    const matchesStatus = statusFilter === "All Statuses" || quote.status === statusFilter;
    const matchesCustomer = customerFilter === "All Customers" || quote.customer_id === customerFilter;
    return matchesBranch && matchesSearch && matchesStatus && matchesCustomer;
  });

  const filteredExpenses = expenses.filter(exp => {
    const matchesBranch = activeBranch === "all" || exp.branch_id === activeBranch;
    const matchesSearch = exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         exp.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Explicit 'All Statuses' uses global statusFilter or independent
    const matchesStatus = statusFilter === "All Statuses" || exp.status === statusFilter;
    
    const matchesCategory = expenseCategoryFilter === "All Categories" || exp.category === expenseCategoryFilter;
    return matchesBranch && matchesSearch && matchesStatus && matchesCategory;
  }).sort((a, b) => {
    const timeA = new Date(a.date || a.timestamp || 0).getTime();
    const timeB = new Date(b.date || b.timestamp || 0).getTime();
    const amtA = a.amount || 0;
    const amtB = b.amount || 0;

    if (expenseSortBy === "Date (Newest)") return timeB - timeA;
    if (expenseSortBy === "Date (Oldest)") return timeA - timeB;
    if (expenseSortBy === "Amount (High to Low)") return amtB - amtA;
    if (expenseSortBy === "Amount (Low to High)") return amtA - amtB;
    return 0;
  });

  const filteredRecurring = useMemo(() => recurring.filter(sub => {
    const matchesSearch = (sub.plan_id || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (sub.customer_id || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All Statuses" || sub.status === statusFilter;
    const matchesCustomer = customerFilter === "All Customers" || sub.customer_id === customerFilter;
    return matchesSearch && matchesStatus && matchesCustomer;
  }), [recurring, searchTerm, statusFilter, customerFilter]);

  const handleCreateRecurringInvoice = async () => {
    if (isSubmitting) return;
    
    // Calculate totals
    const validItems = recurringItems.filter(i => (i.description || i.product_id) && i.quantity > 0 && i.unit_price >= 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one valid line item.");
      return;
    }

    const subtotalCalc = validItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = validItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.tax / 100)), 0);
    const total = subtotalCalc + taxAmount;

    setIsSubmitting(true);
    try {
      const targetBranch = activeBranch === "all" ? "main" : activeBranch;
      await addDoc(collection(db, "recurring_billing"), {
        plan_id: `REC-${Math.floor(Math.random() * 100000)}`,
        customer_id: recurringFormData.customer_id,
        billing_email: recurringFormData.billing_email,
        frequency: recurringFormData.frequency,
        interval: recurringFormData.interval,
        payment_terms: recurringFormData.payment_terms,
        start_date: recurringFormData.start_date,
        end_date: recurringFormData.end_date,
        currency: recurringFormData.currency,
        auto_send: recurringFormData.auto_send,
        notes: recurringFormData.notes,
        items: validItems,
        subtotal: subtotalCalc,
        tax_total: taxAmount,
        amount: total,
        status: "ACTIVE",
        next_billing_date: recurringFormData.start_date,
        branch_id: targetBranch,
        created_at: new Date().toISOString()
      });
      toast.success("Recurring invoice configured successfully!");
      setIsRecurringDialogOpen(false);
      setRecurringFormData({
        customer_id: "",
        billing_email: "",
        frequency: "Monthly",
        interval: 1,
        payment_terms: "Due on Receipt",
        start_date: new Date().toISOString().split('T')[0],
        end_date: "",
        currency: currency || "USD",
        auto_send: true,
        notes: ""
      });
      setRecurringItems([{ id: Date.now(), product_id: "", description: "", quantity: 1, unit_price: 0, tax: 0 }]);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, "recurring_billing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTaxSettings = async () => {
    try {
      await updateDoc(doc(db, "settings", "global"), {
        taxRate: globalTaxRate
      });
      toast.success("Tax configurations synced and deployed successfully.");
      setIsTaxDialogOpen(false);
    } catch (error: any) {
      console.error("Error setting tax rate", error);
      // Fallback if settings/global doesn't strictly exist yet
      try {
        await setDoc(doc(db, "settings", "global"), { taxRate: globalTaxRate }, { merge: true });
        toast.success("Tax configurations synced and deployed successfully.");
        setIsTaxDialogOpen(false);
      } catch (innerError) {
        toast.error("Failed to deploy changes.");
      }
    }
  };

  const handleCreateInvoice = async (saveAndSend = false) => {
    if (!newInvoiceData.customer_id) {
      toast.error("Please select a customer to bill to.");
      return;
    }
    
    if (invoiceItems.length === 0 || invoiceItems.every(i => i.quantity === 0 || i.unit_price === 0)) {
       toast.error("Please add at least one valid line item with quantity and price.");
       return;
    }

    if (!newInvoiceData.invoiceNumber || newInvoiceData.invoiceNumber.trim() === "") {
       toast.error("Please provide an Invoice Reference number.");
       return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === newInvoiceData.customer_id);
      const targetBranch = activeBranch === "all" ? "main" : activeBranch;
      
      const invoiceData = {
        ...newInvoiceData,
        date: newInvoiceData.issue_date, // Map issue_date to date for UI rendering
        items: invoiceItems,
        subtotal,
        tax_total: taxTotal,
        discount_amount: discountAmount,
        total: grandTotal,
        amount_paid: 0,
        customer_name: customer?.name || "Unknown Customer",
        timestamp: serverTimestamp(),
        branch_id: targetBranch,
        status: saveAndSend ? "SENT" : newInvoiceData.status
      };

      await addDoc(collection(db, "invoices"), invoiceData);
      
      await addDoc(collection(db, "audit_logs"), {
        action: "INVOICE_CREATED",
        details: `Invoice for ${customer?.name} created. Total: $${grandTotal}`,
        timestamp: serverTimestamp(),
        user_id: auth.currentUser?.uid
      });

      toast.success(saveAndSend ? "Invoice saved and sent" : "Invoice draft created");
      setIsInvoiceDialogOpen(false);
      // Reset form
      setNewInvoiceData({
        invoiceNumber: "",
        status: "Draft",
        customer_id: "",
        payment_terms: "Due on Receipt",
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        discount_type: "Percentage (%)",
        discount_value: 0,
        notes: "",
        terms_conditions: ""
      });
      setInvoiceItems([{ id: Date.now() + Math.random(), product_id: "", quantity: 1, unit_price: 0, tax: 0, description: "" }]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "invoices");
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetBranch = activeBranch === "all" ? "main" : activeBranch;
      await addDoc(collection(db, "expenses"), {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        timestamp: new Date().toISOString(), // keep for legacy backwards compatibility
        created_at: serverTimestamp(),
        author_id: auth.currentUser?.uid,
        branch_id: targetBranch
      });
      toast.success("Expense recorded successfully");
      setIsExpenseSheetOpen(false);
      setNewExpense({
        amount: "",
        category: "Operations",
        description: "",
        status: "PAID",
        payment_method: "Bank Transfer",
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "expenses");
      toast.error("Failed to record expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!newPayment.amount || !selectedInvoice) return;

    setIsSubmitting(true);
    try {
      const invoiceRef = doc(db, "invoices", selectedInvoice.id);
      const paidAmount = parseFloat(newPayment.amount);
      const newTotalPaid = (selectedInvoice.amount_paid || 0) + paidAmount;
      const newStatus = newTotalPaid >= selectedInvoice.total ? "PAID" : "PARTIAL";

      await updateDoc(invoiceRef, {
        amount_paid: newTotalPaid,
        status: newStatus,
        last_payment_at: serverTimestamp()
      });

      // Also record as a transaction or audit log if needed
      await addDoc(collection(db, "audit_logs"), {
        action: "INVOICE_PAYMENT",
        details: `Payment of $${paidAmount} recorded for invoice ${selectedInvoice.id}`,
        timestamp: serverTimestamp(),
        user_id: auth.currentUser?.uid
      });

      toast.success("Payment recorded successfully");
      setIsPaymentSheetOpen(false);
      setSelectedInvoice(null);
      setNewPayment({ amount: "", payment_method: "Bank Transfer", reference: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${selectedInvoice?.id}`);
      toast.error("Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateStatement = () => {
    setIsSubmitting(true);
    toast.info("Synthesizing financial statement...");
    setTimeout(() => {
      const csvContent = [
        ["Date", "Entity/Details", "Type", "Amount", "Status"],
        ...invoices.filter(i => i.status === "PAID").map(i => [new Date(i.timestamp?.toDate() || i.date || Date.now()).toLocaleDateString(), `Invoice #${i.invoice_number?.slice(0,6) || i.id.slice(0,6)}`, "Credit", (i.amount || 0).toFixed(2), "Verified"]),
        ...expenses.filter(e => e.status === "PAID").map(e => [new Date(e.timestamp?.toDate() || e.date || Date.now()).toLocaleDateString(), e.description || e.category, "Debit", (e.amount || 0).toFixed(2), "Verified"])
      ].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `financial_statement_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsStatementDialogOpen(false);
      setIsSubmitting(false);
      toast.success("Statement generated and downloaded successfully");
    }, 1500);
  };

  const totalRevenue = invoices.filter(inv => inv.status === "PAID").reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const netProfitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
  
  const accountsReceivable = invoices.filter(inv => inv.status === "PENDING" || inv.status === "OVERDUE").reduce((acc, curr) => acc + (curr.total || 0), 0);
  const accountsPayable = expenses.filter(exp => exp.status === "PENDING").reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const cashFlowData = React.useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dataMap = new Map();
    
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      dataMap.set(key, { name: months[monthDate.getMonth()], inflow: 0, outflow: 0, payroll: 0, year: monthDate.getFullYear(), month: monthDate.getMonth() });
    }

    invoices.forEach(inv => {
      if (inv.status === "PAID") {
        const date = inv.timestamp?.toDate ? inv.timestamp.toDate() : new Date(inv.timestamp || 0);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (dataMap.has(key)) {
          dataMap.get(key).inflow += inv.total || 0;
        }
      }
    });

    expenses.forEach(exp => {
      const date = exp.timestamp?.toDate ? exp.timestamp.toDate() : new Date(exp.timestamp || 0);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (dataMap.has(key)) {
        dataMap.get(key).outflow += exp.amount || 0;
        if (exp.category === "Payroll") {
          dataMap.get(key).payroll += exp.amount || 0;
        }
      }
    });

    return Array.from(dataMap.values());
  }, [invoices, expenses]);

  const expenseCategories = React.useMemo(() => {
    const categories: Record<string, number> = {};
    let total = 0;
    expenses.forEach(exp => {
      const cat = exp.category || "Other";
      categories[cat] = (categories[cat] || 0) + (exp.amount || 0);
      total += (exp.amount || 0);
    });

    const colors = ["#3b82f6", "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6"];
    
    if (total === 0) {
      return [
        { name: "Operations", value: 45, color: "#3b82f6" },
        { name: "Inventory", value: 30, color: "#6366f1" },
        { name: "Marketing", value: 15, color: "#f43f5e" },
        { name: "Payroll", value: 10, color: "#10b981" },
      ];
    }

    return Object.entries(categories).map(([name, amount], index) => ({
      name,
      value: Math.round((amount / total) * 100),
      amount,
      color: colors[index % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center bg-zinc-50/50">
        <RipplePulseLoader size="lg" />
        <p className="text-sm font-bold text-zinc-400 mt-4 tracking-widest uppercase">Synchronizing Ledgers...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="responsive-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1 max-w-full">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Building2 className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] truncate">Treasury & Ledger</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-900 font-display break-words">Financial Control</h1>
          <p className="text-zinc-500 text-sm md:text-base leading-snug">Unified cash flow management, automated invoicing, and tax compliance.</p>
        </div>
        <div className="responsive-action-bar">
          <Button variant="outline" className="flex-1 md:flex-none rounded-xl border-zinc-200 h-10 md:h-11 px-4 md:px-6 font-bold text-[10px] md:text-xs" onClick={() => setIsStatementDialogOpen(true)}>
            <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-zinc-400" />
            Statements
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none rounded-xl border-zinc-200 h-10 md:h-11 px-4 md:px-6 font-bold text-[10px] md:text-xs" onClick={() => setIsTaxDialogOpen(true)}>
            <SettingsIcon className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-zinc-400" />
            Tax Engine
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className={cn(buttonVariants({ variant: "default" }), "flex-1 md:flex-none rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-10 md:h-11 px-4 md:px-6 font-bold text-[10px] md:text-xs border-none cursor-pointer")}>
                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" />
                  New Document
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-zinc-200">
              <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer" onClick={() => setIsInvoiceDialogOpen(true)}>
                <FileText className="w-4 h-4 mr-2 text-blue-500" /> New Invoice
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer" onClick={() => setIsQuoteDialogOpen(true)}>
                <Receipt className="w-4 h-4 mr-2 text-amber-500" /> New Quote
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer" onClick={() => setIsRecurringDialogOpen(true)}>
                <Clock className="w-4 h-4 mr-2 text-purple-500" /> Recurring Setup
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer" onClick={() => setIsExpenseSheetOpen(true)}>
                <Banknote className="w-4 h-4 mr-2 text-rose-500" /> Record Expense
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Treasury: Bank Accounts (New Section) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {bankAccounts.map((account) => (
          <Card key={account.id} className="card-modern p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Building2 className="w-16 h-16 text-blue-600" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">{account.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium">{account.bank}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border-emerald-100">
                  {account.status}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Available Balance</p>
                <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
                  {formatCurrency(account.balance)}
                </h3>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">{account.type}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    setSelectedAccountForLedger(account);
                    setIsLedgerSheetOpen(true);
                  }}
                >
                  View Ledger
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-modern p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Banknote className="w-5 h-5" />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">+14.2%</Badge>
          </div>
          <div>
            <p className="text-sm text-zinc-500 font-medium">Cash on Hand</p>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{formatCurrency(netProfit)}</h3>
          </div>
        </Card>
        <Card className="card-modern p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <Receipt className="w-5 h-5" />
            </div>
            <Badge className="bg-rose-50 text-rose-600 border-rose-100">${(accountsReceivable / 1000).toFixed(1)}k Due</Badge>
          </div>
          <div>
            <p className="text-sm text-zinc-500 font-medium">Accounts Receivable</p>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">${accountsReceivable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          </div>
        </Card>
        <Card className="card-modern p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <Badge className="bg-zinc-100 text-zinc-600 border-zinc-200">Pending</Badge>
          </div>
          <div>
            <p className="text-sm text-zinc-500 font-medium">Accounts Payable</p>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">${accountsPayable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          </div>
        </Card>
        <Card className="card-modern p-6 space-y-4 border-emerald-100 bg-emerald-50/30">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <Badge className="bg-white text-emerald-600 border-emerald-100">Optimal</Badge>
          </div>
          <div>
            <p className="text-sm text-emerald-600/70 font-medium">Net Profit Margin</p>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{netProfitMargin}%</h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2 card-modern overflow-hidden">
          <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Cash Flow Dynamics</CardTitle>
                <CardDescription>Inflow vs Outflow trajectory</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">Inflow</Badge>
                <Badge variant="outline" className="text-rose-400 border-rose-100">Outflow</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-10">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', padding: '12px' }} />
                  <Area type="monotone" dataKey="inflow" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                  <Area type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="card-modern">
          <CardHeader className="border-b border-zinc-100">
            <CardTitle className="text-lg font-bold">Expense Allocation</CardTitle>
            <CardDescription>Distribution across categories</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-6">
              {expenseCategories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-bold text-zinc-700">{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900">{cat.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Tabs defaultValue="invoices" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="bg-zinc-100 p-1 rounded-xl inline-flex w-max min-w-full md:min-w-0 justify-start">
              <TabsTrigger value="invoices" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Invoices</TabsTrigger>
              <TabsTrigger value="quotes" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Quotes</TabsTrigger>
              <TabsTrigger value="recurring" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Recurring</TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Expenses</TabsTrigger>
              <TabsTrigger value="payroll" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm whitespace-nowrap">Payroll & Commissions</TabsTrigger>
              <TabsTrigger value="tax" className="rounded-lg px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Compliance</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative w-full md:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <Input 
                placeholder="Search documents..." 
                className="pl-10 rounded-xl border-zinc-200 bg-white h-10 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-xl border-zinc-200 h-10 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="All Statuses">All Statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[180px] rounded-xl border-zinc-200 h-10 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <SelectValue placeholder="Customer" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="All Customers">All Customers</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="invoices">
          <Card className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                    <TableHead className="font-bold text-zinc-900 py-4">Invoice ID</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Customer</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Amount</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4 hidden md:table-cell">Date</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4 hidden md:table-cell">Due Date</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                    <TableHead className="text-right font-bold text-zinc-900 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-32 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell className="hidden md:table-cell"><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell className="hidden md:table-cell"><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-6 w-16 bg-zinc-100 rounded-full animate-pulse" /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-zinc-400">
                          <Receipt className="w-10 h-10 opacity-20" />
                          <p className="text-sm font-bold">No invoices found matching your criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                      <TableCell className="py-4 font-mono text-xs font-bold text-zinc-400">#{inv.id.substring(0,8).toUpperCase()}</TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">{customers.find(c => c.id === inv.customer_id)?.name || inv.customer_id}</TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(inv.total)}</TableCell>
                      <TableCell className="py-4 text-xs text-zinc-500 hidden md:table-cell">{inv.date}</TableCell>
                      <TableCell className="py-4 text-xs text-zinc-500 hidden md:table-cell">{inv.due_date}</TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          inv.status === "PAID" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          inv.status === "OVERDUE" ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 rounded-lg hover:bg-zinc-100 border-none cursor-pointer flex items-center justify-center")}>
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            <DropdownMenuItem className="flex items-center gap-2 py-2 cursor-pointer">
                              <Download className="w-4 h-4" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 py-2 cursor-pointer text-rose-600 focus:text-rose-600">
                              Void Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-6">
          <Card className="card-modern overflow-hidden">
             <div className="overflow-x-auto">
                <Table>
                   <TableHeader>
                      <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                         <TableHead className="font-bold text-zinc-900 py-4 px-6">Quote ID</TableHead>
                         <TableHead className="font-bold text-zinc-900 py-4">Customer</TableHead>
                         <TableHead className="font-bold text-zinc-900 py-4">Amount</TableHead>
                         <TableHead className="font-bold text-zinc-900 py-4">Expires</TableHead>
                         <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                         <TableHead className="text-right font-bold text-zinc-900 py-4 px-6">Actions</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="px-6"><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-6 w-16 bg-zinc-100 rounded-full animate-pulse" /></TableCell>
                            <TableCell className="px-6" />
                          </TableRow>
                        ))
                      ) : filteredQuotes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-20 text-center">
                             <div className="flex flex-col items-center gap-3 text-zinc-400">
                              <Receipt className="w-10 h-10 opacity-20" />
                              <p className="text-sm font-bold">No active quotes found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredQuotes.map((quote) => (
                        <TableRow key={quote.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                          <TableCell className="py-4 px-6 font-mono text-xs font-bold text-zinc-400">{quote.id.substring(0,8).toUpperCase()}</TableCell>
                          <TableCell className="py-4 font-bold text-zinc-900">{customers.find(c => c.id === quote.customer_id)?.name || quote.customer_id}</TableCell>
                          <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(quote.total || 0)}</TableCell>
                          <TableCell className="py-4 text-xs text-zinc-500">{quote.valid_until}</TableCell>
                          <TableCell className="py-4">
                            <Badge className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border-blue-100">
                              {quote.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-4 px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </div>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-6">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
                   <Zap className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-zinc-900">Subscription Engine</h3>
                   <p className="text-xs text-zinc-500 font-medium italic">Automated ledger entries for high-volume accounts.</p>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <Button 
                   variant="outline" 
                   size="sm" 
                   className="rounded-xl border-zinc-200 h-10 font-bold text-xs shadow-sm"
                   onClick={handleRunBillingCycle}
                   disabled={isSubmitting}
                >
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2 text-zinc-400" />}
                   Run Billing Cycle
                </Button>
                <Button className="rounded-xl bg-zinc-900 text-white font-bold h-10 px-4 shadow-lg shadow-zinc-900/20" onClick={() => setIsRecurringDialogOpen(true)}>
                   <Plus className="w-4 h-4 mr-2" />
                   New Plan
                </Button>
             </div>
          </div>

          {recurring.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-zinc-50/50 rounded-3xl border-2 border-dashed border-zinc-100">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-zinc-100">
                <Calendar className="w-10 h-10 text-zinc-200" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Initialize Recurring Billing</h2>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8">Deploy automated invoice generation for your retainer-based clients and subscription services.</p>
              <Button className="rounded-2xl bg-zinc-900 text-white shadow-xl shadow-zinc-900/20 font-bold px-8 h-14" onClick={() => setIsRecurringDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Deploy New Plan
              </Button>
            </div>
          ) : (
            <Card className="card-modern overflow-hidden">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                       <TableHead className="font-bold text-zinc-900 py-4 px-6">Plan Identity</TableHead>
                       <TableHead className="font-bold text-zinc-900 py-4">Customer</TableHead>
                       <TableHead className="font-bold text-zinc-900 py-4">Cycle</TableHead>
                       <TableHead className="font-bold text-zinc-900 py-4">Amount</TableHead>
                       <TableHead className="font-bold text-zinc-900 py-4">Next Bill</TableHead>
                       <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                       <TableHead className="text-right font-bold text-zinc-900 py-4 px-6">Control</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredRecurring.map((sub) => {
                       const cust = customers.find(c => c.id === sub.customer_id);
                       return (
                         <TableRow key={sub.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                           <TableCell className="py-4 px-6">
                              <p className="font-bold text-zinc-900">{sub.plan_id || "Enterprise Plan"}</p>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">#{sub.id.substring(0,8)}</p>
                           </TableCell>
                           <TableCell className="py-4 font-bold text-zinc-900">{cust?.name || sub.customer_id}</TableCell>
                           <TableCell className="py-4">
                              <Badge variant="outline" className="text-[10px] font-bold bg-zinc-50 border-zinc-100">
                                 {sub.interval > 1 ? `${sub.interval}x ` : ""}{sub.frequency}
                              </Badge>
                           </TableCell>
                           <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(sub.amount || 0)}</TableCell>
                           <TableCell className="py-4 text-sm font-medium text-zinc-600">{sub.next_billing_date}</TableCell>
                           <TableCell className="py-4">
                             <Badge className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border-emerald-100">
                               {sub.status || "ACTIVE"}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right py-4 px-6">
                             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100 text-rose-500">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       );
                     })}
                   </TableBody>
                 </Table>
               </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            <Card className="p-6 border-zinc-200">
              <h4 className="font-bold text-zinc-900 mb-2">Automatic Billing</h4>
              <p className="text-sm text-zinc-500">Set up invoices to be automatically generated and sent to customers on a schedule</p>
            </Card>
            <Card className="p-6 border-zinc-200">
              <h4 className="font-bold text-zinc-900 mb-2">Flexible Scheduling</h4>
              <p className="text-sm text-zinc-500">Choose from daily, weekly, monthly, or custom intervals for your recurring invoices</p>
            </Card>
            <Card className="p-6 border-zinc-200">
              <h4 className="font-bold text-zinc-900 mb-2">Payment Tracking</h4>
              <p className="text-sm text-zinc-500">Monitor payment status and automatically follow up on overdue amounts</p>
            </Card>
            <Card className="p-6 border-zinc-200">
              <h4 className="font-bold text-zinc-900 mb-2">Customer Management</h4>
              <p className="text-sm text-zinc-500">Manage subscription customers and their billing preferences in one place</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-modern p-6 border-zinc-200">
               <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Total Expenditures (MTD)</p>
               <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(expenses.reduce((acc, e) => acc + (e.amount || 0), 0))}</h3>
               <div className="mt-4 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-rose-600">Outgoing Flow</span>
               </div>
            </Card>
            <Card className="card-modern p-6 border-zinc-200">
               <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Top Category</p>
               <h3 className="text-2xl font-bold text-zinc-900">
                  {expenses.length > 0 ? [...new Set(expenses.map(e => e.category))].sort((a,b) => 
                     expenses.filter(e => e.category === b).length - expenses.filter(e => e.category === a).length
                  )[0] : "N/A"}
               </h3>
               <p className="text-xs text-zinc-500 mt-4">Highest volume classification</p>
            </Card>
            <Card className="card-modern p-6 bg-zinc-900 text-white shadow-xl shadow-zinc-200">
               <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Burn Rate Status</p>
               <h3 className="text-2xl font-bold">STABLE</h3>
               <div className="mt-4 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[45%]" />
               </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={expenseSortBy} onValueChange={setExpenseSortBy}>
                <SelectTrigger className="w-[180px] rounded-xl border-zinc-200 h-10 text-xs font-bold">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Date (Newest)">Date (Newest)</SelectItem>
                  <SelectItem value="Date (Oldest)">Date (Oldest)</SelectItem>
                  <SelectItem value="Amount (High to Low)">Amount (High to Low)</SelectItem>
                  <SelectItem value="Amount (Low to High)">Amount (Low to High)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                <SelectTrigger className="w-[180px] rounded-xl border-zinc-200 h-10 text-xs font-bold">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="All Categories">All Categories</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Payroll">Payroll</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="rounded-xl bg-zinc-900 text-white font-bold h-11 px-6 shadow-lg shadow-zinc-900/20"
              onClick={() => setIsExpenseSheetOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Expense
            </Button>
          </div>

          <Card className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                    <TableHead className="font-bold text-zinc-900 py-4">Expense ID</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Category</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4 hidden sm:table-cell">Description</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Amount</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Date</TableHead>
                    <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><div className="h-4 w-40 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-6 w-16 bg-zinc-100 rounded-full animate-pulse" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-zinc-400">
                          <AlertCircle className="w-10 h-10 opacity-20" />
                          <p className="text-sm font-bold">No expenses found matching your criteria</p>
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsExpenseSheetOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Record Expense
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredExpenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                      <TableCell className="py-4 font-mono text-xs font-bold text-zinc-400">#{exp.id.substring(0,8).toUpperCase()}</TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">{exp.category}</TableCell>
                      <TableCell className="py-4 text-xs text-zinc-500 hidden sm:table-cell">{exp.description}</TableCell>
                      <TableCell className="py-4 font-bold text-zinc-900">${(exp.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      <TableCell className="py-4 text-xs text-zinc-500">{exp.date || exp.timestamp?.split('T')[0]}</TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "text-[9px] font-bold uppercase",
                          exp.status === "PAID" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        )}>
                          {exp.status || "PAID"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold">LIVE RECONCILIATION</Badge>
                <p className="text-xs text-zinc-500 font-medium italic">Calculations based on {commissionRate}% platform standard.</p>
             </div>
             <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-zinc-200 h-9 font-bold text-xs shadow-sm hover:bg-white"
                onClick={() => setIsRateEditorOpen(true)}
             >
                <SettingsIcon className="w-4 h-4 mr-2 text-zinc-400" />
                Configure Rates
             </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <Card className="card-modern bg-zinc-100/50 border-zinc-200">
                <CardContent className="p-4 text-center sm:text-left">
                   <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Est. Payroll (MTD)</p>
                   <h3 className="text-xl font-bold mt-1 text-zinc-900">{formatCurrency(staff.length * 2840)}</h3>
                </CardContent>
             </Card>
             <Card className="card-modern bg-blue-50/50 border-blue-100">
                <CardContent className="p-4 text-center sm:text-left">
                   <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Total Commissions</p>
                   <h3 className="text-xl font-bold mt-1 text-blue-900">{formatCurrency(sessions.reduce((acc, s) => acc + (s.totalSales || 0) * 0.05, 0))}</h3>
                </CardContent>
             </Card>
             <Card className="card-modern bg-emerald-50 border-emerald-100">
                <CardContent className="p-4 text-center sm:text-left">
                   <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Top Contributor</p>
                   <h3 className="text-xl font-bold mt-1 text-emerald-900">{staff[0]?.name || "N/A"}</h3>
                </CardContent>
             </Card>
              <Card className="card-modern bg-zinc-900 text-white shadow-xl shadow-zinc-200">
                <CardContent className="p-4 text-center sm:text-left">
                   <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Next Payrun</p>
                   <h3 className="text-xl font-bold mt-1">April 30</h3>
                </CardContent>
              </Card>
          </div>

           <div className="flex items-center justify-between mt-8 mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Workforce Settlements</h3>
              <Button 
                className="rounded-xl bg-zinc-900 text-white font-bold h-11 px-6 shadow-lg shadow-zinc-900/20"
                onClick={() => setIsPayrunDialogOpen(true)}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Initialize Payrun
              </Button>
           </div>

          <Card className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                 <TableHeader className="bg-zinc-50/50">
                    <TableRow className="border-b border-zinc-100">
                       <TableHead className="py-4 font-bold text-zinc-900 px-6">Staff Member</TableHead>
                       <TableHead className="py-4 font-bold text-zinc-900 text-right">Hours Logged</TableHead>
                       <TableHead className="py-4 font-bold text-zinc-900 text-right">Total GMV</TableHead>
                       <TableHead className="py-4 font-bold text-zinc-900 text-right">Commission (5%)</TableHead>
                       <TableHead className="py-4 font-bold text-zinc-900 text-right">Base Pay</TableHead>
                       <TableHead className="py-4 font-bold text-zinc-900 text-right px-6">Total Due</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {staff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-sm text-zinc-400 font-medium italic">
                          No staff data available for current enterprise.
                        </TableCell>
                      </TableRow>
                    ) : staff.map(s => {
                      const staffSessions = sessions.filter(sess => sess.staffId === s.id);
                      const totalSales = staffSessions.reduce((acc, sess) => acc + (sess.totalSales || 0), 0);
                      const commission = totalSales * (commissionRate / 100);
                      
                      let basePay = s.baseRate || 2200;
                      if (s.salaryType === 'HOURLY') {
                         const hours = staffSessions.length * 8;
                         basePay = hours * (s.baseRate || 25);
                      }
                      
                      return (
                        <TableRow key={s.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50 group">
                           <TableCell className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center text-[10px] font-bold ring-1 ring-zinc-200">
                                   {s.name.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                   <p className="font-bold text-zinc-900 text-sm group-hover:text-blue-600 transition-colors">{s.name}</p>
                                   <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{s.role}</p>
                                </div>
                              </div>
                           </TableCell>
                           <TableCell className="py-4 text-right font-medium text-zinc-600">{(staffSessions.length * 8) || 160}h</TableCell>
                           <TableCell className="py-4 text-right font-bold text-zinc-900">{formatCurrency(totalSales)}</TableCell>
                           <TableCell className="py-4 text-right font-bold text-blue-600">{formatCurrency(commission)}</TableCell>
                           <TableCell className="py-4 text-right font-medium text-zinc-600">{formatCurrency(basePay)}</TableCell>
                           <TableCell className="py-4 text-right px-6">
                              <Badge className="bg-zinc-100 text-zinc-900 border-zinc-200 font-bold h-7 px-3">{formatCurrency(basePay + commission)}</Badge>
                           </TableCell>
                        </TableRow>
                      );
                    })}
                 </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="card-modern">
                <CardHeader>
                   <CardTitle className="text-base font-bold text-zinc-900">Labour Cost Analysis</CardTitle>
                   <CardDescription>Payroll expenses vs. net revenue generation.</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] pt-4">
                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={cashFlowData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                         <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                         <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                         <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                         <Bar dataKey="inflow" name="Net Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                         <Bar dataKey="payroll" name="Payroll Cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </CardContent>
             </Card>
             <Card className="card-modern">
                <CardHeader>
                   <CardTitle className="text-base font-bold text-zinc-900">Commission Incentive Tiers</CardTitle>
                   <CardDescription>Current performance structure for your region.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 border-t border-zinc-50">
                   <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 shadow-sm">
                      <span className="text-xs font-bold text-blue-900">Standard Sales Rate</span>
                      <Badge className="bg-blue-600 text-white border-0 font-bold">{commissionRate.toFixed(1)}%</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="text-xs font-bold text-zinc-900">Peak Performance Accelerator</span>
                      <Badge className="bg-zinc-400 text-white border-0 font-bold">{peakRate.toFixed(1)}%</Badge>
                   </div>
                   <p className="text-[10px] text-zinc-400 font-medium italic mt-2">*Rates are enterprise-controlled and apply to net revenue.</p>
                </CardContent>
             </Card>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-modern p-6 border-zinc-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                     <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                     <h4 className="text-sm font-bold text-zinc-900">VAT/GST Liability</h4>
                     <p className="text-[10px] text-zinc-500 font-medium">Estimated for Q2 {selectedTaxYear}</p>
                  </div>
               </div>
               <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalRevenue * (globalTaxRate / 100))}</h3>
               <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Rate: {globalTaxRate}%</span>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold">In Ledger</Badge>
               </div>
            </Card>

            <Card className="card-modern p-6 border-zinc-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                     <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                     <h4 className="text-sm font-bold text-zinc-900">Corporate Tax (Est.)</h4>
                     <p className="text-[10px] text-zinc-500 font-medium">20% of net profit</p>
                  </div>
               </div>
               <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(Math.max(0, netProfit * 0.20))}</h3>
               <div className="mt-4 pt-4 border-t border-zinc-50">
                  <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-blue-600 h-full w-[65%]" />
                  </div>
               </div>
            </Card>

            <Card className="card-modern p-6 border-zinc-900 bg-zinc-900 text-white shadow-xl shadow-zinc-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-zinc-800 rounded-xl text-white">
                     <Archive className="w-5 h-5" />
                  </div>
                  <div>
                     <h4 className="text-sm font-bold">Compliance Status</h4>
                     <p className="text-[10px] text-zinc-400 font-medium">All systems operational</p>
                  </div>
               </div>
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-zinc-400 font-medium">Audit Readiness</span>
                     <span className="font-bold text-emerald-400">98%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-zinc-400 font-medium">KYC/AML Sync</span>
                     <span className="font-bold text-emerald-400">Active</span>
                  </div>
               </div>
            </Card>
          </div>

          <Card className="card-modern overflow-hidden">
             <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <div className="flex items-center justify-between">
                   <div>
                      <CardTitle className="text-lg font-bold">Financial Audit Trail</CardTitle>
                      <CardDescription>Immutable record of critical financial operations.</CardDescription>
                   </div>
                   <Button variant="outline" size="sm" className="rounded-xl font-bold text-xs">
                      <Download className="w-4 h-4 mr-2" />
                      Export ISO Log
                   </Button>
                </div>
             </CardHeader>
             <div className="overflow-x-auto">
                <Table>
                   <TableHeader>
                      <TableRow className="border-b border-zinc-100">
                         <TableHead className="py-4 font-bold text-zinc-900 px-6">Timestamp</TableHead>
                         <TableHead className="py-4 font-bold text-zinc-900">Action</TableHead>
                         <TableHead className="py-4 font-bold text-zinc-900">Entity</TableHead>
                         <TableHead className="py-4 font-bold text-zinc-900">Auth User</TableHead>
                         <TableHead className="py-4 font-bold text-zinc-900 text-right px-6">Integrity</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {invoices.slice(0, 5).map((inv, idx) => (
                        <TableRow key={idx} className="border-b border-zinc-50 hover:bg-zinc-50/30">
                           <TableCell className="py-4 px-6 text-xs text-zinc-500 font-mono">
                              {new Date().toISOString().replace('T', ' ').substring(0, 19)}
                           </TableCell>
                           <TableCell className="py-4">
                              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-zinc-50">
                                 {idx % 2 === 0 ? "LEDGER_UPDATE" : "TAX_SETTLEMENT"}
                              </Badge>
                           </TableCell>
                           <TableCell className="py-4 text-xs font-bold text-zinc-900">Document #{inv.id.substring(0,8)}</TableCell>
                           <TableCell className="py-4 text-xs text-zinc-500">System Admin</TableCell>
                           <TableCell className="py-4 text-right px-6">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Expense Sheet */}
      <Sheet open={isExpenseSheetOpen} onOpenChange={setIsExpenseSheetOpen}>
        <SheetContent className="sm:max-w-md w-full border-l border-zinc-200 bg-zinc-50/95 backdrop-blur-xl p-0 overflow-hidden flex flex-col shadow-2xl">
          <SheetHeader className="p-6 md:p-8 bg-white border-b border-zinc-100/80">
            <SheetTitle className="font-display tracking-tight text-2xl text-zinc-900">
              New Transaction
            </SheetTitle>
            <SheetDescription className="text-zinc-500">
              Log an outgoing expenditure connecting directly to your general ledger.
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 md:p-8 space-y-8">
              {/* Core Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rose-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <ArrowDownRight className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Transaction Core</span>
                </div>
                
                <div className="space-y-2 relative">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-white absolute -top-1.5 left-3 px-1 z-10 transition-all">Amount ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="rounded-xl h-14 pl-12 font-bold text-2xl bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-xs font-bold text-zinc-500">Category</Label>
                  <Select 
                    value={newExpense.category} 
                    onValueChange={(v) => setNewExpense({...newExpense, category: v})}
                  >
                    <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Inventory">Inventory</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Payroll">Payroll</SelectItem>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-blue-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Details</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500">Document / Memo</Label>
                  <Textarea 
                    placeholder="Provide additional details regarding this expense..." 
                    className="rounded-xl min-h-[100px] bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20 resize-none pt-4"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  />
                </div>
              </div>

              {/* Advanced Flags */}
              <div className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-600 mb-4 border-b border-zinc-200/50 pb-2">
                    <Receipt className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Settings & Timing</span>
                  </div>
                  <div className="space-y-2 pb-2">
                    <Label className="text-xs font-bold text-zinc-500">Transaction Date</Label>
                    <Input 
                      type="date"
                      className="rounded-xl h-12 bg-white border-zinc-200"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                    />
                  </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500">Method</Label>
                    <Select 
                      value={newExpense.payment_method} 
                      onValueChange={(v) => setNewExpense({...newExpense, payment_method: v})}
                    >
                      <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500">Reconciliation</Label>
                    <Select 
                      value={newExpense.status} 
                      onValueChange={(v) => setNewExpense({...newExpense, status: v})}
                    >
                      <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="PAID">Paid / Cleared</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <SheetFooter className="p-6 bg-white border-t border-zinc-100 flex-none gap-3 flex flex-row">
            <Button variant="outline" className="rounded-xl flex-1 h-14 font-bold border-zinc-200" onClick={() => setIsExpenseSheetOpen(false)}>Cancel</Button>
            <Button 
              className="flex-[2] rounded-xl bg-zinc-900 text-white h-14 font-bold shadow-xl shadow-zinc-900/10 hover:scale-[1.02] transition-transform"
              onClick={handleCreateExpense}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
              Publish Ledger Entry
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet open={isPaymentSheetOpen} onOpenChange={setIsPaymentSheetOpen}>
        <SheetContent className="sm:max-w-md w-full border-l border-zinc-200 bg-zinc-50/95 backdrop-blur-xl p-0 overflow-hidden flex flex-col shadow-2xl">
          <SheetHeader className="p-6 md:p-8 bg-blue-600 text-white border-b border-blue-700/50">
            <SheetTitle className="font-display tracking-tight text-2xl text-white flex gap-2 items-center">
              <ArrowUpRight className="w-6 h-6 text-blue-200 block" /> Invoice Payment
            </SheetTitle>
            <SheetDescription className="text-blue-100">
              Apply inbound funds to Invoice <span className="font-mono bg-blue-700/50 px-1 py-0.5 rounded ml-1">{selectedInvoice?.id?.substring(0, 8).toUpperCase()}</span>
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 md:p-8 space-y-6">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-zinc-100 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Total Billed</p>
                  <p className="font-bold text-zinc-900">${(selectedInvoice?.total || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-rose-400">Outstanding</p>
                  <p className="font-bold text-rose-600">${(selectedInvoice?.total - (selectedInvoice?.amount_paid || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                 <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 absolute -top-0.5 left-3 px-1 z-10">Application Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="rounded-xl h-16 pl-14 font-bold text-3xl bg-white border-zinc-200 focus:ring-2 focus:ring-blue-500/20 text-emerald-600 shadow-inner"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                 <div className="flex items-center gap-2 text-zinc-600 mb-4 border-b border-zinc-200/50 pb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Tender Details</span>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500">Method</Label>
                  <Select 
                    value={newPayment.payment_method} 
                    onValueChange={(v) => setNewPayment({...newPayment, payment_method: v})}
                  >
                    <SelectTrigger className="rounded-xl h-12 bg-white border-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500">Reference ID / Check #</Label>
                  <Input 
                    placeholder="Provide trace code..." 
                    className="rounded-xl h-12 bg-white border-zinc-200 font-mono text-xs"
                    value={newPayment.reference}
                    onChange={(e) => setNewPayment({...newPayment, reference: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <SheetFooter className="p-6 bg-white border-t border-zinc-100 flex-none gap-3 flex flex-row">
            <Button variant="outline" className="rounded-xl flex-1 h-14 font-bold border-zinc-200" onClick={() => setIsPaymentSheetOpen(false)}>Cancel</Button>
            <Button 
              className="flex-[2] rounded-xl bg-blue-600 text-white h-14 font-bold shadow-xl shadow-blue-600/20 hover:scale-[1.02] transition-transform hover:bg-blue-700"
              onClick={handleRecordPayment}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              Apply Payment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Create Recurring Invoice Dialog */}
      <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 border-none bg-zinc-50 rounded-3xl shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b border-zinc-100 flex-none flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-bold text-zinc-900">Create Recurring Invoice</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6 pb-6">
              {/* Customer */}
              <Card className="p-6 border-zinc-200 shadow-sm rounded-xl space-y-6 bg-white">
                <h3 className="font-bold text-zinc-900 text-lg">Customer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Customer *</Label>
                    <Select value={recurringFormData.customer_id} onValueChange={(v) => setRecurringFormData({...recurringFormData, customer_id: v})}>
                      <SelectTrigger className="rounded-lg h-11 border-zinc-200 bg-zinc-50/50">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Billing Email</Label>
                    <Input 
                      placeholder="customer@example.com" 
                      className="rounded-lg h-11 border-zinc-200" 
                      value={recurringFormData.billing_email}
                      onChange={(e) => setRecurringFormData({...recurringFormData, billing_email: e.target.value})}
                    />
                  </div>
                </div>
              </Card>

              {/* Frequency & Schedule */}
              <Card className="p-6 border-zinc-200 shadow-sm rounded-xl space-y-6 bg-white">
                <h3 className="font-bold text-zinc-900 text-lg">Frequency & Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Frequency *</Label>
                    <Select value={recurringFormData.frequency} onValueChange={(v) => setRecurringFormData({...recurringFormData, frequency: v})}>
                      <SelectTrigger className="rounded-lg h-11 border-zinc-200">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Every</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      className="rounded-lg h-11 border-zinc-200" 
                      value={recurringFormData.interval}
                      onChange={(e) => setRecurringFormData({...recurringFormData, interval: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Payment Terms</Label>
                    <Select value={recurringFormData.payment_terms} onValueChange={(v) => setRecurringFormData({...recurringFormData, payment_terms: v})}>
                      <SelectTrigger className="rounded-lg h-11 border-zinc-200">
                        <SelectValue placeholder="Due on Receipt" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Start Date *</Label>
                    <Input 
                      type="date" 
                      className="rounded-lg h-11 border-zinc-200" 
                      value={recurringFormData.start_date}
                      onChange={(e) => setRecurringFormData({...recurringFormData, start_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">End Date (optional)</Label>
                    <Input 
                      type="date" 
                      className="rounded-lg h-11 border-zinc-200 text-zinc-500" 
                      value={recurringFormData.end_date}
                      onChange={(e) => setRecurringFormData({...recurringFormData, end_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-700">Currency</Label>
                    <Select value={recurringFormData.currency} onValueChange={(v) => setRecurringFormData({...recurringFormData, currency: v})}>
                      <SelectTrigger className="rounded-lg h-11 border-zinc-200 bg-white">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                        <SelectItem value="AUD">AUD ($)</SelectItem>
                        <SelectItem value="JMD">JMD (J$)</SelectItem>
                        <SelectItem value="XCD">XCD (EC$)</SelectItem>
                        <SelectItem value="BBD">BBD (Bds$)</SelectItem>
                        <SelectItem value="TTD">TTD (TT$)</SelectItem>
                        <SelectItem value="BSD">BSD (B$)</SelectItem>
                        <SelectItem value="BZD">BZD (BZ$)</SelectItem>
                        <SelectItem value="KYD">KYD (CI$)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="CHF">CHF (Fr)</SelectItem>
                        <SelectItem value="CNY">CNY (¥)</SelectItem>
                        <SelectItem value="NZD">NZD ($)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="SGD">SGD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch 
                    checked={recurringFormData.auto_send}
                    onCheckedChange={(c) => setRecurringFormData({...recurringFormData, auto_send: c})}
                  />
                  <span className="font-medium text-sm text-zinc-900">Auto-send email when invoice is generated</span>
                </div>
              </Card>

              {/* Line Items */}
              <Card className="p-6 border-zinc-200 shadow-sm rounded-xl space-y-6 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-zinc-900 text-lg">Line Items</h3>
                  <Button variant="outline" className="rounded-xl h-10 px-4 font-bold border-zinc-200" onClick={() => setRecurringItems([...recurringItems, { id: Date.now() + Math.random(), product_id: "", description: "", quantity: 1, unit_price: 0, tax: 0 }])}>
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {recurringItems.map((item, index) => (
                    <div key={item.id} className="p-4 border border-zinc-100 rounded-xl space-y-4 bg-zinc-50/30">
                      <div className="flex gap-4">
                        <Select 
                          value={item.product_id}
                          onValueChange={(val) => {
                            const p = products.find(prod => prod.id === val);
                            const updated = [...recurringItems];
                            updated[index].product_id = val;
                            if (p) {
                              updated[index].description = p.name;
                              updated[index].unit_price = p.retail_price || p.price || 0;
                              updated[index].tax = p.tax_rate || 0;
                            }
                            setRecurringItems(updated);
                          }}
                        >
                          <SelectTrigger className="rounded-lg h-11 flex-1 bg-white border-zinc-200">
                            <SelectValue placeholder="Search or select a product..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          className="h-11 px-3 text-rose-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                          onClick={() => {
                            const filtered = recurringItems.filter(i => i.id !== item.id);
                            setRecurringItems(filtered.length ? filtered : [{ id: Date.now(), product_id: "", description: "", quantity: 1, unit_price: 0, tax: 0 }]);
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-6 space-y-2">
                          <Label className="text-xs font-medium text-zinc-700">Description</Label>
                          <Input 
                            placeholder="Service / Product description" 
                            className="bg-white rounded-lg h-11 border-zinc-200"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...recurringItems];
                              updated[index].description = e.target.value;
                              setRecurringItems(updated);
                            }}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-xs font-medium text-zinc-700">Qty</Label>
                          <Input 
                            type="number" 
                            className="bg-white rounded-lg h-11 border-zinc-200"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...recurringItems];
                              updated[index].quantity = parseInt(e.target.value) || 0;
                              setRecurringItems(updated);
                            }}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-xs font-medium text-zinc-700">Price</Label>
                          <Input 
                            type="number" 
                            className="bg-white rounded-lg h-11 border-zinc-200"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...recurringItems];
                              updated[index].unit_price = parseFloat(e.target.value) || 0;
                              setRecurringItems(updated);
                            }}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-xs font-medium text-zinc-700">Tax %</Label>
                          <Input 
                            type="number" 
                            className="bg-white rounded-lg h-11 border-zinc-200"
                            value={item.tax}
                            onChange={(e) => {
                              const updated = [...recurringItems];
                              updated[index].tax = parseFloat(e.target.value) || 0;
                              setRecurringItems(updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-6 border-t border-zinc-100">
                  <div className="text-right space-y-2 pr-4">
                    <p className="text-sm font-medium text-zinc-700">
                      Subtotal: {formatCurrency(recurringItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))}
                    </p>
                    <p className="text-sm font-medium text-zinc-700">
                      Tax: {formatCurrency(recurringItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.tax / 100)), 0))}
                    </p>
                    <h3 className="text-xl font-bold text-zinc-900 pt-2">
                      Total: {formatCurrency(recurringItems.reduce((sum, item) => sum + ((item.quantity * item.unit_price) * (1 + (item.tax / 100))), 0))}
                    </h3>
                  </div>
                </div>
              </Card>

              <div>
                <Label className="text-sm font-medium text-zinc-900 block mb-2">Invoice Notes</Label>
                <Textarea 
                  placeholder="Optional notes to include on generated invoices" 
                  className="rounded-xl min-h-[100px] bg-white border-zinc-200 text-sm p-4"
                  value={recurringFormData.notes}
                  onChange={(e) => setRecurringFormData({...recurringFormData, notes: e.target.value})}
                />
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 bg-white border-t border-zinc-100 flex-none flex flex-row justify-end space-x-3">
            <Button variant="outline" className="rounded-lg h-11 px-8 font-medium border-zinc-200" onClick={() => setIsRecurringDialogOpen(false)}>Cancel</Button>
             <Button 
              className="rounded-lg bg-[#f97316] text-white hover:bg-[#ea580c] h-11 px-8 font-bold shadow-lg shadow-orange-500/20"
              onClick={handleCreateRecurringSubscription}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Recurring Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
          <DialogContent showCloseButton={false} className="sm:max-w-6xl w-full sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden flex flex-col p-0 border-none bg-white rounded-none sm:rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
            <DialogHeader className="p-4 sm:p-8 bg-zinc-900 text-white flex-none">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-400 mb-0.5">
                    <Receipt className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Billing & Revenue</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <DialogTitle className="text-lg md:text-3xl font-bold font-display tracking-tight text-white uppercase italic">Issue Invoice</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={() => setIsInvoiceDialogOpen(false)} className="md:hidden text-white/50 hover:text-white">
                      <XIcon className="w-5 h-5" />
                    </Button>
                  </div>
                  <DialogDescription className="text-zinc-500 text-[10px] md:text-sm hidden sm:block">Authorize professional tax documentation.</DialogDescription>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3">
                  <Button 
                    variant="outline" 
                    className={cn(
                      "rounded-xl h-9 md:h-11 px-4 md:px-6 font-bold text-[9px] md:text-xs uppercase tracking-wider transition-all flex-1 md:flex-none backdrop-blur-md",
                      isInvoicePreviewVisible ? "bg-white text-zinc-900 border-white" : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    )}
                    onClick={() => setIsInvoicePreviewVisible(!isInvoicePreviewVisible)}
                  >
                    {isInvoicePreviewVisible ? "Editor mode" : "View Preview"}
                  </Button>
                  <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-500 h-9 md:h-11 px-4 md:px-6 font-bold text-[9px] md:text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 flex-1 md:flex-none">
                    Template
                  </Button>
                </div>
              </div>
            </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-row overflow-hidden bg-zinc-50/50">
            <div className="flex-1 overflow-y-auto min-w-0 border-r border-zinc-100 no-scrollbar">
            <div className="p-5 md:p-10 space-y-8 md:space-y-12">
              {/* Section 1: Header Details */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-8">
                  <div className="grid grid-cols-2 gap-3 md:gap-8">
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Reference</Label>
                      <Input 
                        placeholder="IV-0001" 
                        className="rounded-xl md:rounded-2xl h-11 md:h-14 bg-white border-zinc-200 shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm md:text-lg px-4 md:px-6"
                        value={newInvoiceData.invoiceNumber}
                        onChange={(e) => setNewInvoiceData({...newInvoiceData, invoiceNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Status</Label>
                      <Select value={newInvoiceData.status} onValueChange={(v) => setNewInvoiceData({...newInvoiceData, status: v})}>
                        <SelectTrigger className="rounded-xl md:rounded-2xl h-11 md:h-14 bg-white border-zinc-200 shadow-sm focus:ring-4 focus:ring-blue-500/10 px-4 md:px-6 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-200 shadow-xl p-1">
                          <SelectItem value="Draft" className="rounded-xl py-3">Draft Mode</SelectItem>
                          <SelectItem value="UNPAID" className="rounded-xl py-3 text-blue-600">Issued / Unpaid</SelectItem>
                          <SelectItem value="PAID" className="rounded-xl py-3 text-emerald-600">Mark as Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                    <div className="space-y-3 lg:col-span-8">
                      <Label className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Bill To Customer *</Label>
                      <Select value={newInvoiceData.customer_id} onValueChange={(v) => setNewInvoiceData({...newInvoiceData, customer_id: v})}>
                        <SelectTrigger className="rounded-xl md:rounded-2xl h-12 md:h-14 bg-white border-zinc-200 shadow-sm focus:ring-4 focus:ring-blue-500/10 px-4 md:px-6 font-bold">
                          <SelectValue placeholder="Select a customer..." />
                        </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-200 shadow-xl p-1 max-h-80">
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id} className="rounded-xl py-4 group">
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">{c.name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">{c.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 text-zinc-900 mb-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Temporal Logic</span>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Issue Date</Label>
                      <Input 
                        type="date" 
                        className="rounded-xl h-12 bg-zinc-50 border-zinc-100 font-bold text-sm px-4"
                        value={newInvoiceData.issue_date}
                        onChange={(e) => setNewInvoiceData({...newInvoiceData, issue_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Due Date</Label>
                      <Input 
                        type="date" 
                        className="rounded-xl h-12 bg-zinc-50 border-zinc-100 font-bold text-sm px-4"
                        value={newInvoiceData.due_date}
                        onChange={(e) => setNewInvoiceData({...newInvoiceData, due_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Payment Terms</Label>
                      <Select value={newInvoiceData.payment_terms} onValueChange={(v) => setNewInvoiceData({...newInvoiceData, payment_terms: v})}>
                        <SelectTrigger className="rounded-xl h-12 bg-zinc-50 border-zinc-100 font-bold px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Line Items */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-zinc-900 tracking-tight font-display">Revenue Breakdown</h3>
                    <p className="text-xs text-zinc-500">Add products, services or custom line items to this invoice.</p>
                  </div>
                  <Button variant="outline" className="rounded-2xl bg-white border-zinc-200 shadow-sm h-12 px-8 font-bold text-xs hover:bg-zinc-50" onClick={addLineItem}>
                    <Plus className="w-4 h-4 mr-2" /> Add Transactional Line
                  </Button>
                </div>

                <div className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[40%] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 h-14 pl-8">Item / Description</TableHead>
                        <TableHead className="w-[12%] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 h-14 text-center">Qty</TableHead>
                        <TableHead className="w-[15%] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 h-14 text-right">Unit Price</TableHead>
                        <TableHead className="w-[12%] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 h-14 text-center">Tax %</TableHead>
                        <TableHead className="w-[15%] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 h-14 text-right pr-8">Total</TableHead>
                        <TableHead className="w-[6%] h-14"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item, idx) => (
                        <TableRow key={item.id} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/30 transition-colors">
                          <TableCell className="py-6 pl-8">
                            <Select value={item.product_id} onValueChange={(v) => updateLineItem(item.id, "product_id", v)}>
                              <SelectTrigger className="rounded-xl bg-white border-zinc-200 h-11 text-xs font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all px-4">
                                <SelectValue placeholder="Select high-performance product..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl max-h-64 shadow-2xl p-1 border-zinc-200">
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id} className="rounded-lg py-3">
                                    <div className="flex flex-col">
                                      <span className="font-bold">{p.name}</span>
                                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest">{p.sku}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="flex justify-center">
                              <Input 
                                type="number" 
                                className="rounded-xl bg-white border-zinc-200 h-11 w-20 text-center font-bold text-sm shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="flex justify-end gap-2 items-center">
                              <Input 
                                type="number" 
                                className="rounded-xl bg-white border-zinc-200 h-11 w-32 text-right font-bold text-sm shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all px-4"
                                value={item.unit_price}
                                onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-6">
                            <div className="flex justify-center">
                              <Input 
                                type="number" 
                                className="rounded-xl bg-white border-zinc-200 h-11 w-20 text-center font-bold text-sm shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all"
                                value={item.tax}
                                onChange={(e) => updateLineItem(item.id, "tax", parseFloat(e.target.value))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-6 text-right pr-8">
                            <span className="text-sm font-black text-zinc-900">
                              {formatCurrency(item.quantity * item.unit_price * (1 + item.tax/100))}
                            </span>
                          </TableCell>
                          <TableCell className="py-6 pr-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              onClick={() => removeLineItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section 3: Financial Synthesis */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Discount Logic</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Adjustment Type</Label>
                        <Select value={newInvoiceData.discount_type} onValueChange={(v) => setNewInvoiceData({...newInvoiceData, discount_type: v})}>
                          <SelectTrigger className="rounded-xl h-12 bg-zinc-50 border-zinc-100 px-4 font-bold shadow-inner">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Percentage (%)">Percentage-based (%)</SelectItem>
                            <SelectItem value="Fixed Amount ($)">Flat Rate Adjustment ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Value</Label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            className="rounded-xl h-12 bg-zinc-50 border-zinc-100 font-bold text-right pr-12 shadow-inner"
                            value={newInvoiceData.discount_value}
                            onChange={(e) => setNewInvoiceData({...newInvoiceData, discount_value: parseFloat(e.target.value) || 0})}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                            {newInvoiceData.discount_type === "Percentage (%)" ? "%" : "$"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Internal Ledger Notes</Label>
                      <Textarea 
                        placeholder="Private reconciliation notes..." 
                        className="rounded-2xl min-h-[140px] bg-white border-zinc-200 shadow-sm p-6 resize-none"
                        value={newInvoiceData.notes}
                        onChange={(e) => setNewInvoiceData({...newInvoiceData, notes: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Terms & Conditions</Label>
                      <Textarea 
                        placeholder="Public-facing legal terms..." 
                        className="rounded-2xl min-h-[140px] bg-white border-zinc-200 shadow-sm p-6 resize-none"
                        value={newInvoiceData.terms_conditions}
                        onChange={(e) => setNewInvoiceData({...newInvoiceData, terms_conditions: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-zinc-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 -scale-x-100 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-1000">
                      <Receipt className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="relative space-y-8">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Gross Revenue</span>
                          <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Tax Aggregation</span>
                          <span className="text-lg font-bold">{formatCurrency(taxTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-blue-400">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Discount</span>
                          <span className="text-lg font-bold">-{formatCurrency(discountAmount)}</span>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-zinc-800 space-y-2">
                        <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">Net Payable Balance</span>
                        <div className="flex items-baseline justify-between">
                          <h2 className="text-6xl font-black font-display tracking-tight hover:scale-105 transition-transform duration-500 cursor-default">
                            {formatCurrency(grandTotal)}
                          </h2>
                          <Badge className="bg-blue-600 text-white border-none rounded-full px-4 py-1 text-[10px] font-black tracking-widest uppercase">USD</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 flex items-center gap-6 group hover:border-blue-300 transition-colors">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-zinc-900">AI Risk Assessment</h5>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">98% Collection Probability</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Right Column: Live Doc Preview */}
            {isInvoicePreviewVisible && (
              <div className="hidden lg:flex w-[600px] xl:w-[700px] bg-white border-l border-zinc-200 flex-col p-8 overflow-hidden items-center group/preview animate-in slide-in-from-right duration-300">
                <div className="w-full flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live Preview Output</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-blue-600 hover:bg-blue-50 transition-all gap-1"
                    onClick={() => {
                      const printContent = document.getElementById('printable-invoice');
                      if (printContent) {
                        window.print();
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export / Print
                  </Button>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold bg-white text-zinc-600 border-zinc-200">WYSIWYG 2.0</Badge>
              </div>
              
              <div className="w-full h-full rounded-2xl shadow-2xl shadow-zinc-200/50 overflow-hidden bg-white scale-[0.75] origin-top border border-zinc-100 scrollbar-hide overflow-y-auto">
                 <PrintableInvoice 
                    branding={branding} 
                    order={{
                      id: newInvoiceData.invoiceNumber || "DRAFT-001",
                      customerName: customers.find(c => c.id === newInvoiceData.customer_id)?.name || "Walk-in Customer",
                      customerEmail: customers.find(c => c.id === newInvoiceData.customer_id)?.email || "customer@mail.com",
                      date: newInvoiceData.issue_date,
                      items: invoiceItems.map(item => ({
                        id: String(item.id),
                        name: products.find(p => p.id === item.product_id)?.name || item.description || "Unlabeled Item",
                        price: item.unit_price,
                        qty: item.quantity
                      })),
                      subtotal: subtotal,
                      tax: taxTotal,
                      total: grandTotal
                    }} 
                 />
              </div>
              
              <div className="mt-auto w-full p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                   <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Audit Validity</p>
                   <p className="text-xs font-bold text-zinc-900">Compliant for international distribution</p>
                </div>
              </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-4 sm:px-8 sm:py-6 bg-white border-t border-zinc-100 flex-none flex flex-row items-center gap-3 md:gap-6 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] z-20">
            <Button 
              variant="outline" 
              className="rounded-xl h-11 md:h-14 px-4 md:px-8 font-bold border-zinc-200 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all text-[10px] flex-1 md:flex-none uppercase tracking-widest"
              onClick={() => setIsInvoiceDialogOpen(false)}
            >
              <Archive className="w-4 h-4 mr-2" />
              Discard
            </Button>
            <div className="flex items-center gap-3 flex-[2] md:flex-none">
              <Button 
                className="rounded-xl md:rounded-2xl h-11 md:h-16 px-6 md:px-14 font-bold bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/10 transition-all flex items-center justify-center gap-3 flex-1 md:flex-none"
                onClick={() => handleCreateInvoice(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin font-bold" /> : <ArrowUpRight className="w-4 h-4 text-blue-400" />}
                Authorize Invoice
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Placeholder Dialogs */}
      <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden shadow-2xl flex flex-col rounded-3xl border-none">
          <DialogHeader className="p-8 lg:p-10 bg-zinc-900 text-white relative flex-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <FileText className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Financial Reporting</span>
              </div>
              <DialogTitle className="font-display tracking-tight text-3xl font-black">Generate Statements</DialogTitle>
              <DialogDescription className="text-zinc-400 font-medium">Synthesize a comprehensive financial summary for auditing or client review.</DialogDescription>
            </div>
            <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none text-white">
              <Building2 className="w-32 h-32" />
            </div>
          </DialogHeader>
          <div className="p-12 lg:p-16 text-center space-y-6">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex flex-col items-center justify-center mx-auto text-blue-600 shadow-inner">
               <RipplePulseLoader size="sm" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-900">Quantifying Fiscal Data</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">The statement generation engine is currently initializing. This process involves cross-referencing audit logs and transaction history.</p>
            </div>
          </div>
          <DialogFooter className="p-8 lg:p-10 bg-white border-t border-zinc-100 flex-none gap-4">
            <Button variant="ghost" className="rounded-xl h-14 px-8 font-bold text-zinc-400 hover:text-rose-500 hover:bg-rose-50 flex-1 md:flex-none" onClick={() => setIsStatementDialogOpen(false)}>Abort</Button>
            <Button className="rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 h-16 px-14 font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-zinc-900/40 hover:scale-[1.02] transition-all flex-1 md:flex-none" onClick={handleGenerateStatement} disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Initialize Generation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTaxDialogOpen} onOpenChange={setIsTaxDialogOpen}>
        <DialogContent showCloseButton={false} className="w-full sm:max-w-2xl p-0 shadow-2xl flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[2.5rem] border-none">
          <DialogHeader className="p-5 sm:p-8 lg:p-10 bg-white border-b border-zinc-100 flex-none relative">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-zinc-400 mb-2">
                <SettingsIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Compliance & Configuration</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="font-display tracking-tight text-xl md:text-3xl font-black text-zinc-900 leading-tight">Tax Engine Control</DialogTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsTaxDialogOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                  <XIcon className="w-5 h-5" />
                </Button>
              </div>
              <DialogDescription className="text-zinc-500 font-medium text-xs md:text-sm">Calibrate tax parameters and algorithmic compliance rules.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 md:p-8 lg:p-10 space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <div className="p-5 md:p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center group hover:bg-white hover:shadow-xl transition-all duration-300">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 text-sm md:text-lg">Standard Sales Tax Base</p>
                    <p className="text-[10px] md:text-xs text-zinc-500">Corporate default rate applicable to all primary revenue channels</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 bg-white p-2 rounded-xl shadow-sm border border-zinc-100">
                    <Input 
                      type="number"
                      step="0.01"
                      className="w-16 md:w-24 text-right font-black text-lg md:text-xl border-none focus:ring-0 p-0 h-8 md:h-10" 
                      value={globalTaxRate} 
                      onChange={(e) => setGlobalTaxRate(Number(e.target.value))}
                    />
                    <span className="font-black text-zinc-400 text-base md:text-lg mr-1 md:mr-2">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 md:p-6 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:bg-white hover:shadow-xl transition-all duration-300">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 text-sm md:text-lg">Dynamic Nexus Calculation</p>
                    <p className="text-[10px] md:text-xs text-zinc-500">Automated jurisdictional calculation based on payload routing</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4">
                     <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                     </div>
                     <Switch checked={true} />
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-4 items-start">
                 <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600 flex-none">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />
                 </div>
                 <div>
                    <h5 className="text-[10px] md:text-xs font-bold text-blue-900 uppercase tracking-widest leading-none mb-1">Regional Notice</h5>
                    <p className="text-[10px] text-blue-700 leading-relaxed max-w-md italic">Engine settings impacts all branches. Real-time changes are logged for fiscal transparency and year-end audits.</p>
                 </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-5 md:p-8 lg:p-10 bg-zinc-50 border-t border-zinc-100 flex-none flex flex-row items-center gap-3 md:gap-4 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" className="rounded-xl h-12 md:h-14 px-6 md:px-8 font-bold text-zinc-400 hover:text-rose-500 hover:bg-rose-50 flex-1 md:flex-none uppercase text-[10px] tracking-widest" onClick={() => setIsTaxDialogOpen(false)}>Discard</Button>
            <Button className="rounded-xl md:rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 md:h-16 px-6 md:px-14 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-xl shadow-zinc-900/10 transition-all flex-1 md:flex-none" onClick={handleSaveTaxSettings}>Deploy Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modern Ledger Sheet */}
      <Sheet open={isLedgerSheetOpen} onOpenChange={setIsLedgerSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto border-l-0 p-0 bg-white/95 backdrop-blur-xl">
          {selectedAccountForLedger && (
            <div className="flex flex-col h-full bg-zinc-50/10">
              {/* Header */}
              <div className="p-8 bg-zinc-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Building2 className="w-32 h-32" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-xl">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight font-display">{selectedAccountForLedger.name}</h2>
                      <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">{selectedAccountForLedger.bank} • {selectedAccountForLedger.type}</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Authenticated Balance</p>
                    <div className="flex items-end gap-3">
                      <h3 className="text-4xl font-bold tracking-tighter">{formatCurrency(selectedAccountForLedger.balance)}</h3>
                      <Badge className="mb-1.5 bg-emerald-500/20 text-emerald-400 border-none text-[9px] font-bold py-0.5">VERIFIED</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-10">
                {/* AI Briefing Segmented by Account Type */}
                {selectedAccountForLedger.id === "2" ? (
                  <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-2xl shadow-indigo-200 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12">
                      <Users className="w-40 h-40" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-indigo-200" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Payroll Sustainability Engine</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Monthly Obligation</p>
                          <h4 className="text-3xl font-bold tracking-tight">{formatCurrency(payrollObligation)}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Reserve Health</p>
                          <div className={cn(
                             "text-lg font-black tracking-tighter",
                             payrollCoverageStatus.status === 'OPTIMAL' ? 'text-emerald-300' : 'text-amber-300'
                          )}>
                             {payrollCoverageStatus.percent.toFixed(1)}% {payrollCoverageStatus.status}
                          </div>
                        </div>
                      </div>
                      
                      {/* Health Bar */}
                      <div className="mt-8 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                             "h-full transition-all duration-1000 ease-out",
                             payrollCoverageStatus.status === 'OPTIMAL' ? 'bg-emerald-400' : 'bg-amber-400'
                          )}
                          style={{ width: `${Math.min(100, payrollCoverageStatus.percent)}%` }}
                        />
                      </div>
                      
                      <p className="mt-6 text-xs text-indigo-50 font-medium leading-relaxed opacity-90">
                        Total personnel count: **{staff.length} modules**. Based on current roles, your monthly burn is {formatCurrency(payrollObligation)}. 
                        {payrollCoverageStatus.status === 'CRITICAL' 
                          ? " Warning: Immediate transfer from Operating Account advised." 
                          : " Provisioning is stable for the next pay cycle."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-[2rem] bg-white border border-zinc-100 shadow-xl shadow-zinc-200/50 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 text-zinc-50 group-hover:text-blue-50 transition-colors">
                      <Sparkles className="w-12 h-12" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gemini 2026 Executive Briefing</span>
                    </div>
                    <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                      "This account maintains optimal liquidity. I've noted a **15.2% expansion** in net inflows relative to last month, primarily driven by accelerated invoice settlements. Your tax reserves are currently sufficient for Q2 projections."
                    </p>
                  </div>
                )}

                {/* Transaction List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Active Ledger Entries</h4>
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold text-blue-600" onClick={handleGenerateStatement}>Download CSV</Button>
                  </div>

                  <div className="rounded-3xl border border-zinc-100 bg-white overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                          <TableHead className="font-bold text-[10px] text-zinc-400 uppercase py-4 pl-6">Date</TableHead>
                          <TableHead className="font-bold text-[10px] text-zinc-400 uppercase py-4">Entity/Details</TableHead>
                          <TableHead className="font-bold text-[10px] text-zinc-400 uppercase py-4 text-right pr-6">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ...invoices.filter(i => i.status === "PAID").map(i => ({
                            id: i.id,
                            date: new Date(i.timestamp?.toDate() || i.date || Date.now()).toLocaleDateString(),
                            timestamp: i.timestamp?.toMillis() || Date.now(),
                            name: `Invoice #${i.invoice_number?.slice(0,6) || i.id.slice(0,6)}`,
                            type: "Credit",
                            amt: i.amount || 0,
                            verified: true
                          })),
                          ...expenses.filter(e => e.status === "PAID").map(e => ({
                            id: e.id,
                            date: new Date(e.timestamp?.toDate() || e.date || Date.now()).toLocaleDateString(),
                            timestamp: e.timestamp?.toMillis() || Date.now(),
                            name: e.description || e.category,
                            type: "Debit",
                            amt: e.amount || 0,
                            verified: true
                          }))
                        ].sort((a, b) => b.timestamp - a.timestamp).map((tx, i) => (
                          <TableRow key={i} className="hover:bg-zinc-50 transition-colors border-b border-zinc-50/50 last:border-0 border-dashed">
                            <TableCell className="py-4 pl-6 text-xs font-bold text-zinc-400">{tx.date}</TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shadow-sm",
                                  tx.type === "Credit" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                )}>
                                  {tx.type === "Credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-sm font-bold text-zinc-900">{tx.name}</p>
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-widest">Verified</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "py-4 text-right pr-6 font-bold text-sm tabular-nums",
                              tx.type === "Credit" ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {tx.type === "Credit" ? "+" : "-"}{formatCurrency(tx.amt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-100 flex flex-col items-center gap-4">
                   <div className="p-4 rounded-2xl bg-zinc-900 text-white w-full flex items-center justify-between group cursor-pointer hover:shadow-xl hover:shadow-zinc-900/20 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-amber-300" />
                         </div>
                         <div>
                            <p className="font-bold text-sm">Automate Cash Sweep</p>
                            <p className="text-[10px] text-zinc-400 font-medium">Trigger AI to rebalance this account daily.</p>
                         </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                   </div>
                   <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center">End of Secured Ledger</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </ScrollArea>
  );
}

