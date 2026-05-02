import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Sparkles,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  History,
  Star,
  Send,
  Clock,
  AlertCircle,
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  CreditCard,
  DollarSign,
  Tag,
  FileText,
  MoreHorizontal,
  Loader2,
  Users,
  Trash2,
  Settings as SettingsIcon,
  Activity,
  ShieldCheck,
  Archive,
  X as XIcon,
  Info,
  ArrowUpRight,
  Download,
  Camera,
  Crown,
  Share2,
  Banknote,
  ChevronDown,
  Printer,
  Smartphone,
  ExternalLink,
  ShoppingCart,
  Wallet
} from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";

import { db, auth, handleFirestoreError, OperationType, collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, where, addDoc, serverTimestamp, deleteDoc, writeBatch, getStorage, ref, uploadBytes, getDownloadURL, limit, increment as fStoreIncrement } from "@/lib/firebase";
// firebase/storage deleteObject is imported dynamically where used to avoid pulling storage SDK into CRM chunk
import { recordFinancialEvent } from "@/lib/ledger";
import { recordAuditLog } from "@/lib/audit";
import { usePendingAction } from "@/context/PendingActionContext";
import { generateProfessionalReceipt } from "@/lib/pdf-generator";

export default function CRM() {
  const { activeBranch, formatCurrency, topSpenderThreshold, enterpriseId, branding, hasPermission, userRole, posSession } = useModules();
  const isAdmin   = userRole === "admin"  || userRole === "owner";
  const isManager = isAdmin || userRole === "manager";
  const canEdit   = isManager || hasPermission("crm", "editor");
  const canView   = canEdit  || hasPermission("crm", "viewer");
  const { consumeAction } = usePendingAction();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("All");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [activePrintReport, setActivePrintReport] = useState<string | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [customerCreditNotes, setCustomerCreditNotes] = useState<any[]>([]);
  const [customerDocuments, setCustomerDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [newComm, setNewComm] = useState("");
  const [commType, setCommType] = useState("Email");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSubmittingComm, setIsSubmittingComm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [offerDetails, setOfferDetails] = useState("");
  
  const [isOutreachDialogOpen, setIsOutreachDialogOpen] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState("");
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);

  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "",
    amount: "",
    description: "",
    dueDate: new Date().toISOString().split('T')[0],
    status: "UNPAID"
  });
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  const [isScheduleCallOpen, setIsScheduleCallOpen] = useState(false);
  const [callData, setCallData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: "10:00",
    objective: "Follow-up"
  });
  const [isSubmittingCall, setIsSubmittingCall] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);

  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false);
  const [collectionData, setCollectionData] = useState({
    amount: "",
    method: "CASH",
    reference: ""
  });
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);
  const [documentHubTx, setDocumentHubTx] = useState<any>(null);
  const [isDocumentHubOpen, setIsDocumentHubOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [thermalSize, setThermalSize] = useState<'80mm' | '58mm'>('80mm');

  // Generate PDF Preview when hub opens
  useEffect(() => {
    if (isDocumentHubOpen && documentHubTx) {
      const generatePreview = async () => {
        try {
          const previewUri = await generateProfessionalReceipt(branding, enterpriseId, documentHubTx, 'blob');
          setPdfPreview(previewUri as string);
        } catch (err) {
          console.error("Preview generation failed", err);
        }
      };
      generatePreview();
    } else {
      setPdfPreview(null);
    }
  }, [isDocumentHubOpen, documentHubTx, branding, enterpriseId]);

  const handleOpenDocumentHub = (tx: any) => {
    const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp || 0);
    setDocumentHubTx({
      id: tx.id,
      type: tx.type || "SALE",
      status: tx.status || "COMPLETED",
      customerName: selectedCustomer?.name || tx.customerName || tx.customer_name || "Guest",
      customerAddress: selectedCustomer?.address || "",
      customerPhone: selectedCustomer?.phone || "",
      customerEmail: selectedCustomer?.email || "",
      date: txDate.toLocaleString("en-US", {
        weekday: "long", year: "numeric", month: "long",
        day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
      }),
      dateShort: txDate.toLocaleString(),
      cashierName: tx.cashier_name || tx.cashierName || null,
      paymentMethod: tx.payment_method || tx.paymentMethod || "CASH",
      refundMethod: tx.refund_method || tx.refundMethod || tx.payment_method || null,
      receipt_id: tx.receipt_id,
      reference_number: tx.reference_number,
      originalTransactionId: tx.original_transaction_id || null,
      // Balance deduction fields
      balanceDeducted: Number(tx.balance_deducted_from_refund) || 0,
      netRefundPaid: Number(tx.net_refund_paid) || 0,
      // Financial breakdown
      exchangePolicy: "EXCHANGE POLICY: All sales are final. We offer exchanges only within 7 days of purchase for items in original, unopened packaging. No cash refunds after 7 days.",
      items: (tx.items || []).map((item: any) => ({
        ...item,
        qty: Number(item.qty || item.quantity) || 1,
        price: Number(item.price) || 0
      })),
      subtotal: Number(tx.subtotal) || Number(tx.total) || 0,
      discountAmount: Number(tx.discount_amount) || 0,
      discountName: tx.discount?.name || null,
      taxRate: Number(tx.tax_rate) || 0,
      tax: Number(tx.tax) || 0,
      total: Number(tx.total) || 0,
      tendered: Number(tx.tendered_amount) || 0,
      change: Number(tx.change_due) || 0,
      balanceDue: Number(tx.balance_due) || 0,
      previous_balance: tx.previous_balance !== undefined ? Number(tx.previous_balance) : undefined,
      new_balance: tx.new_balance !== undefined ? Number(tx.new_balance) : undefined
    });
    setIsDocumentHubOpen(true);
  };

  const handlePrintPDF = async () => {
    if (!documentHubTx) return;
    const tid = toast.loading("Building Professional PDF...");
    try {
      await generateProfessionalReceipt(branding, enterpriseId, documentHubTx);
      toast.success("PDF Ready", { id: tid });
    } catch (err) {
      toast.error("PDF Failed", { id: tid });
    }
  };

  const handlePrintThermal = () => {
    if (!documentHubTx) return;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const tx = documentHubTx;
    const isReturn = tx.type === 'RETURN';
    const isPayment = tx.type === 'PAYMENT';
    const hasDeduction = (tx.balanceDeducted || 0) > 0;
    const canvasWidth = thermalSize === '80mm' ? '72mm' : '50mm';
    const paperSize = thermalSize === '80mm' ? '80mm auto' : '58mm auto';
    const fs = thermalSize === '80mm' ? '12px' : '10px';
    const fsSmall = thermalSize === '80mm' ? '10px' : '9px';
    const headerSize = thermalSize === '80mm' ? '20px' : '16px';
    const boxPadding = thermalSize === '80mm' ? '10px' : '7px';

    const receiptLabel = isReturn ? 'RETURN RECEIPT' : isPayment ? 'PAYMENT RECEIPT' : 'SALES RECEIPT';

    const itemsHtml = (tx.items || []).map((item: any) => {
      const qty = Number(item.qty || item.quantity) || 1;
      const price = Number(item.price) || 0;
      const hasDisc = item.discount && item.discount.value > 0;
      const discLabel = hasDisc
        ? ` (-${item.discount.type === 'Percentage' ? item.discount.value + '%' : formatCurrency(item.discount.value)})`
        : '';
      return `
        <div style="margin-bottom:8px;font-size:${fs};">
          <div style="display:flex;justify-content:space-between;font-weight:bold;">
            <span style="text-transform:uppercase;max-width:60%;overflow:hidden;">${item.name}</span>
            <span>${formatCurrency(qty * price).replace('$', '')}</span>
          </div>
          <div style="font-size:${fsSmall};color:#666;">${qty} × ${formatCurrency(price).replace('$', '')}${discLabel}</div>
        </div>`;
    }).join('');

    // Financial rows
    const subtotal = tx.subtotal || tx.total || 0;
    const discRow = tx.discountAmount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>DISCOUNT${tx.discountName ? ` (${tx.discountName})` : ''}:</span><span>-${formatCurrency(tx.discountAmount).replace('$','')}</span></div>`
      : '';
    const taxRow = `<div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>TAX${tx.taxRate > 0 ? ` (${tx.taxRate}%)` : ''}:</span><span>${formatCurrency(tx.tax || 0).replace('$','')}</span></div>`;

    // Balance deduction block for returns
    const deductionBlock = isReturn && hasDeduction ? `
      <div class="divider"></div>
      <div style="font-size:${fsSmall};font-weight:bold;text-transform:uppercase;margin-bottom:3px;">Account Settlement</div>
      <div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>GROSS REFUND:</span><span>${formatCurrency(tx.total).replace('$','')}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>BAL DEDUCTED:</span><span>-${formatCurrency(tx.balanceDeducted).replace('$','')}</span></div>
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${thermalSize === '80mm' ? '15px' : '13px'};"><span>NET PAYOUT:</span><span>${formatCurrency(tx.netRefundPaid).replace('$','')}</span></div>
    ` : '';

    // Tendered/change for sales
    const tenderedBlock = !isReturn && tx.tendered > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>TENDERED:</span><span>${formatCurrency(tx.tendered).replace('$','')}</span></div>
      ${tx.change > 0 ? `<div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>CHANGE:</span><span>${formatCurrency(tx.change).replace('$','')}</span></div>` : ''}
    ` : '';

    // Original sale ref for returns
    const origRefBlock = isReturn && tx.originalTransactionId
      ? `<div style="font-size:${fsSmall};margin-top:4px;">ORIG SALE REF: #${tx.originalTransactionId.substring(0,12).toUpperCase()}</div>`
      : '';

    const cashierBlock = tx.cashierName
      ? `<div style="font-size:${fsSmall};margin-top:2px;">CASHIER: ${tx.cashierName.toUpperCase()}</div>`
      : '';

    const html = `<html><head><style>
      @page{margin:0;size:${paperSize};}
      body{width:${canvasWidth};margin:0 auto;padding:5mm 0;font-family:'Courier New',monospace;color:black;background:white;line-height:1.3;}
      .center{text-align:center;}.bold{font-weight:bold;}
      .divider{border-top:1px dashed black;margin:7px 0;}
      .black-box{background:black;color:white;padding:${boxPadding};text-align:center;font-weight:bold;margin:12px 0;font-size:9px;letter-spacing:1px;word-break:break-all;}
      .return-box{background:#222;color:white;padding:4px 8px;text-align:center;font-size:9px;font-weight:bold;letter-spacing:2px;margin-bottom:6px;}
      .legal{font-size:7px;text-align:center;margin-top:8px;font-style:italic;color:#444;line-height:1.3;}
    </style></head><body>
      <div class="center">
        <h1 style="margin:0;font-size:${headerSize};font-weight:bold;text-transform:uppercase;">${branding.name}</h1>
        <p style="margin:4px 0;font-size:9px;">${branding.address || ''}<br/>${branding.phone || ''}</p>
        <div class="divider"></div>
        ${isReturn ? '<div class="return-box">★ RETURN RECEIPT ★</div>' : ''}
        <p class="bold" style="margin:4px 0;font-size:13px;">${receiptLabel}</p>
        <p style="margin:0;font-size:10px;">#${(tx.receipt_id || tx.id).substring(0,12).toUpperCase()}</p>
        <p style="margin:2px 0;font-size:9px;">${tx.date}</p>
        ${cashierBlock}
        ${origRefBlock}
        <div class="divider"></div>
      </div>

      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${fs};margin-bottom:4px;"><span>ITEM</span><span>TOTAL</span></div>
      <div class="divider"></div>
      <div style="margin-bottom:8px;">${itemsHtml}</div>
      <div class="divider"></div>

      <div style="font-size:${fs};line-height:1.6;">
        <div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>SUBTOTAL:</span><span>${formatCurrency(subtotal).replace('$','')}</span></div>
        ${discRow}${taxRow}
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${thermalSize==='80mm'?'15px':'13px'};"><span>${isReturn?'GROSS REFUND':'TOTAL'}:</span><span>${formatCurrency(tx.total).replace('$','')}</span></div>
        ${tenderedBlock}
        <div style="display:flex;justify-content:space-between;font-size:${fsSmall};"><span>METHOD:</span><span>${(isReturn ? tx.refundMethod || tx.paymentMethod : tx.paymentMethod)||'—'}</span></div>
      </div>

      ${deductionBlock}
      <div class="divider"></div>

      <div class="center">
        <p class="bold" style="margin:8px 0 4px;font-size:10px;">${isReturn ? 'RETURN PROCESSED — THANK YOU' : 'THANK YOU FOR YOUR BUSINESS!'}</p>
        <div class="legal">${tx.exchangePolicy}</div>
        <div class="black-box">${tx.id.toUpperCase()}</div>
        <p style="font-size:7px;color:#999;">OrivoCRM.pro · ${new Date().getFullYear()}</p>
      </div>
    </body></html>`;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!documentHubTx) return;
    if (!documentHubTx.customerPhone) {
      toast.error("Customer phone number missing");
      return;
    }
    const tx = documentHubTx;
    const isReturn = tx.type === 'RETURN';
    const isPayment = tx.type === 'PAYMENT';
    const hasDeduction = (tx.balanceDeducted || 0) > 0;
    const refVal = tx.receipt_id || tx.id.substring(0, 8);
    const phone = tx.customerPhone.replace(/\D/g, '');
    const bName = branding.name || "CRM";

    let message = `*${isReturn ? '↩ RETURN RECEIPT' : isPayment ? 'PAYMENT RECEIPT' : 'OFFICIAL RECEIPT'} — ${bName.toUpperCase()}*\n\n`;
    message += `Hello ${tx.customerName},\n\n`;

    if (isReturn) {
      message += `A *return transaction* has been processed on your account.\n`;
      message += `*Gross Refund:* ${formatCurrency(tx.total)}\n`;
      if (hasDeduction) {
        message += `*Balance Deducted:* ${formatCurrency(tx.balanceDeducted)} _(applied to outstanding balance)_\n`;
        message += `*Net Payout to You:* ${formatCurrency(tx.netRefundPaid)}\n`;
      }
      if (tx.originalTransactionId) {
        message += `*Original Sale Ref:* #${tx.originalTransactionId.substring(0,12).toUpperCase()}\n`;
      }
    } else if (isPayment) {
      message += `Your payment of *${formatCurrency(tx.total)}* has been received and applied to your account.\n`;
    } else {
      message += `Thank you for your purchase! Your total is *${formatCurrency(tx.total)}*.\n`;
    }

    message += `\n*Date:* ${tx.date}\n*Ref:* ${refVal}\n`;
    if (tx.cashierName) message += `*Processed By:* ${tx.cashierName}\n`;
    if (tx.new_balance !== undefined) message += `*Account Balance:* ${formatCurrency(tx.new_balance)}\n`;
    message += `\n_Digital record:_ ${window.location.origin}/verify/${tx.id}\n\nThank you for choosing ${branding.name}!`;

    const toastId = toast.loading("Queueing WhatsApp delivery...");
    try {
      const commRef = await addDoc(collection(db, "communications"), {
        enterprise_id: enterpriseId,
        customer_id: selectedCustomer?.id || null,
        customer_name: tx.customerName,
        type: "WHATSAPP", status: "PENDING",
        content: message,
        transaction_id: tx.id,
        recipient: phone,
        timestamp: serverTimestamp(),
        sender_id: auth.currentUser?.uid,
        sender_name: auth.currentUser?.email || posSession?.staffName || "System"
      });
      await recordAuditLog({ enterpriseId, action: "WhatsApp Share Queued", details: `Receipt ${refVal} queued for WhatsApp`, severity: "INFO", type: "CRM", metadata: { communication_id: commRef.id, txId: tx.id } });
      toast.success("Document queued for WhatsApp delivery", { id: toastId });
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      console.error("WhatsApp queue error:", error);
      toast.error("Failed to queue communication", { id: toastId });
    }
  };

  const handleShareEmail = async () => {
    if (!documentHubTx) return;
    const tx = documentHubTx;
    const isReturn = tx.type === 'RETURN';
    const isPayment = tx.type === 'PAYMENT';
    const hasDeduction = (tx.balanceDeducted || 0) > 0;
    const refVal = tx.receipt_id || tx.id.substring(0, 8);
    const email = tx.customerEmail || '';
    const docType = isReturn ? 'Return Receipt' : isPayment ? 'Payment Receipt' : 'Receipt';
    const subject = `${docType} #${refVal} from ${branding.name}`;

    let body = `Hello ${tx.customerName},\n\n`;
    if (isReturn) {
      body += `A return transaction has been processed on your account.\n\n`;
      body += `Gross Refund: ${formatCurrency(tx.total)}\n`;
      if (hasDeduction) {
        body += `Balance Deducted: ${formatCurrency(tx.balanceDeducted)} (applied to outstanding account balance)\n`;
        body += `Net Payout: ${formatCurrency(tx.netRefundPaid)}\n`;
      }
      if (tx.originalTransactionId) body += `Original Sale Ref: #${tx.originalTransactionId.substring(0,12).toUpperCase()}\n`;
    } else {
      body += `Please find the details of your ${docType.toLowerCase()} below.\n\n`;
      body += `Amount: ${formatCurrency(tx.total)}\n`;
    }
    body += `Date: ${tx.date}\nTransaction ID: ${refVal}\n`;
    if (tx.cashierName) body += `Processed By: ${tx.cashierName}\n`;
    if (tx.new_balance !== undefined) body += `Account Balance: ${formatCurrency(tx.new_balance)}\n`;
    body += `\nThank you for your business!\n\n--\n${branding.name}\n${branding.tagline || ''}`;

    const toastId = toast.loading("Queueing Email delivery...");
    try {
      const commRef = await addDoc(collection(db, "communications"), {
        enterprise_id: enterpriseId,
        customer_id: selectedCustomer?.id || null,
        customer_name: tx.customerName,
        type: "EMAIL", status: "PENDING",
        content: body, subject,
        transaction_id: tx.id,
        recipient: email,
        timestamp: serverTimestamp(),
        sender_id: auth.currentUser?.uid,
        sender_name: auth.currentUser?.email || posSession?.staffName || "System"
      });
      await recordAuditLog({ enterpriseId, action: "Email Share Queued", details: `Receipt ${refVal} queued for Email`, severity: "INFO", type: "CRM", metadata: { communication_id: commRef.id, txId: tx.id } });
      toast.success("Document queued for Email delivery", { id: toastId });
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    } catch (error) {
      console.error("Email queue error:", error);
      toast.error("Failed to queue communication", { id: toastId });
    }
  };

  // New Management State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPermanentDeleteOpen, setIsPermanentDeleteOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    first_name: "",
    last_name: "",
    customer_number: "",
    customer_type: "Individual",
    email: "",
    phone: "",
    other_emails: [] as string[],
    credit_limit: 0,
    birthday: "",
    segment: "No Group",
    address: "",
    photo_url: ""
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo exceeds 10MB limit");
      return;
    }

    const tid = toast.loading("Optimizing profile photo...");
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync Timeout')), 30000)
    );

    try {
      // Resize image before upload to avoid large files
      const img = new Image();
      const reader = new FileReader();

      const blob: Blob = await new Promise((resolve, reject) => {
        reader.onload = (event) => {
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const MAX_SIZE = 640;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob((b) => b ? resolve(b) : reject("Blob conversion failed"), "image/jpeg", 0.8);
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const storageRef = await ref(await getStorage(), `enterprise/${enterpriseId}/customers/${selectedCustomer?.id || 'unknown'}/profiles/photo_${Date.now()}.jpg`);
      
      const uploadTask = (async () => {
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        return await getDownloadURL(storageRef);
      })();

      const url = await Promise.race([uploadTask, timeoutPromise]) as string;
      
      setCustomerFormData({ ...customerFormData, photo_url: url });
      toast.success("Photo synchronized", { id: tid });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message === 'Sync Timeout' ? 'Cloud sync delayed - try again' : "Process failed: " + error.message, { id: tid });
    }
  };

  const handleCollectPayment = async () => {
    if (!selectedCustomer || !collectionData.amount || parseFloat(collectionData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmittingCollection(true);
    const tid = toast.loading("Recording payment...");

    try {
      const amountPaid = parseFloat(collectionData.amount);
      const newBalance = Math.max(0, (selectedCustomer.balance || 0) - amountPaid);

      // 1. Update Customer Balance & Metrics
      await updateDoc(doc(db, "customers", selectedCustomer.id), {
        balance: newBalance,
        total_paid: fStoreIncrement(amountPaid),
        last_payment_date: serverTimestamp(),
        last_payment_amount: amountPaid,
        status: newBalance <= 0 ? "ACTIVE" : "OWING"
      });

      // 2. Create a Permanent Payment Transaction
      const receiptId = `RCPT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const paymentTx = {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        enterprise_id: enterpriseId,
        type: "PAYMENT",
        payment_method: collectionData.method,
        total: amountPaid,
        amount_tendered: amountPaid,
        amount_applied: amountPaid,
        change_due: 0,
        receipt_id: receiptId,
        reference_number: collectionData.reference || receiptId,
        description: `Account Debt Settlement (${receiptId})`,
        timestamp: serverTimestamp(),
        status: "COMPLETED",
        branch_id: activeBranch,
        staff_id: posSession?.staffId || "System",
        staff_name: posSession?.staffName || "System",
        previous_balance: selectedCustomer.balance || 0,
        new_balance: newBalance
      };
      const txRef = await addDoc(collection(db, "transactions"), paymentTx);

      // 3. Record Financial Event (for global ledger)
      await recordFinancialEvent({
        enterpriseId,
        amount: amountPaid,
        sourceId: selectedCustomer.id,
        sourceType: "PAYMENT_RECEIVED",
        description: `Payment from ${selectedCustomer.name} (Ref: ${collectionData.reference || "N/A"})`,
        metadata: { branchId: activeBranch?.id || "main" }
      });

      // 4. Log Audit
      await recordAuditLog({
        action: "Payment Collected",
        details: `Collected ${formatCurrency(amountPaid)} from ${selectedCustomer.name} via ${collectionData.method}. Remaining: ${formatCurrency(newBalance)}`,
        enterpriseId,
        severity: "INFO",
        type: "FINANCE"
      });

      toast.success(`Payment recorded: ${receiptId}`, { 
        id: tid,
        action: {
          label: "Open Hub",
          onClick: () => handleOpenDocumentHub({ ...paymentTx, id: txRef.id })
        }
      });
      setIsCollectPaymentOpen(false);
      setCollectionData({ amount: "", method: "CASH", reference: "" });
      
      // Update local state for immediate UI feedback
      setSelectedCustomer(prev => prev ? { ...prev, balance: newBalance } : null);
    } catch (error) {
      console.error("Collection error:", error);
      toast.error("Failed to record payment", { id: tid });
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  const handleCreateCustomer = async () => {
    const fullName = customerFormData.customer_type === "Individual"
      ? `${customerFormData.first_name} ${customerFormData.last_name}`.trim()
      : (customerFormData.first_name || customerFormData.name);

    if (!fullName) {
      toast.error("Name is required");
      return;
    }
    if (customerFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerFormData.email)) {
      toast.error("If provided, the email address must be valid");
      return;
    }
    if (isSubmittingCustomer) return; // idempotency guard
    setIsSubmittingCustomer(true);
    try {
      await addDoc(collection(db, "customers"), {
        ...customerFormData,
        name: fullName,
        balance: 0,
        spend: 0,
        score: 50,
        tags: [],
        status: "Active",
        createdAt: serverTimestamp(),
        lastContact: new Date().toISOString(),
        loyalty: 0,
        enterprise_id: enterpriseId
      });
      toast.success("Customer added successfully");
      setIsAddCustomerOpen(false);
      setCustomerFormData({ 
        name: "", first_name: "", last_name: "", 
        customer_number: "", customer_type: "Individual",
        email: "", phone: "", other_emails: [], credit_limit: 0, birthday: "", 
        segment: "No Group", address: "", photo_url: ""
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "customers");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    setIsSubmittingCustomer(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(customerRef, customerFormData);
      toast.success("Profile updated");
      setIsEditCustomerOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${selectedCustomer.id}`);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer || isSubmittingCustomer) return;
    if (selectedCustomer.id === 'walk-in') {
      toast.error("The Walk-in account cannot be deleted.");
      return;
    }
    if (!isManager) {
      toast.error("You do not have permission to delete customers.");
      return;
    }
    setIsSubmittingCustomer(true);
    const toastId = toast.loading("Purging customer record and files...");
    try {
      const batch = writeBatch(db);
      
      // 1. Storage Cleanup - Delete actual files
      const docsSnap = await import("@/lib/firebase").then(({ getDocs }) =>
        getDocs(query(collection(db, "documents"),
          where("enterprise_id", "==", enterpriseId),
          where("customer_id", "==", selectedCustomer.id)
        ))
      );

      for (const d of docsSnap.docs) {
        const data = d.data();
        if (data.storagePath) {
          try {
            const storage = await getStorage();
            const fileRef = await ref(storage, data.storagePath);
            const { deleteObject } = await import("firebase/storage");
            await deleteObject(fileRef);
          } catch (storageErr) {
            console.warn("Storage deletion failed (likely already gone):", storageErr);
          }
        }
        batch.delete(d.ref);
      }

      // 2. Database Cleanup - Sub-collections
      const subCollections = ["transactions", "invoices", "credit_notes", "notes", "communications", "customer_campaign_usage"];
      for (const col of subCollections) {
        const snap = await import("@/lib/firebase").then(({ getDocs }) =>
          getDocs(query(collection(db, col),
            where("enterprise_id", "==", enterpriseId),
            where("customer_id", "==", selectedCustomer.id)
          ))
        );
        snap.forEach((d: any) => batch.delete(d.ref));
      }

      // 3. Delete Main Record
      batch.delete(doc(db, "customers", selectedCustomer.id));

      // 4. Audit Log
      await recordAuditLog({
        enterpriseId,
        action: "Customer Permanently Deleted",
        details: `Customer ${selectedCustomer.name} (ID: ${selectedCustomer.id}) and all associated records/files were purged by ${auth.currentUser?.email}`,
        severity: "CRITICAL",
        type: "CRM"
      });

      await batch.commit();
      toast.success("Customer and all associated records purged successfully.", { id: toastId });
      setIsDeleteConfirmOpen(false);
      setIsPermanentDeleteOpen(false);
      setSelectedCustomer(null);
      setShowDetailOnMobile(false);
    } catch (error) {
      console.error(error);
      toast.error("Delete failed — please try again", { id: toastId });
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerFormData({
      name: customer.name || "",
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      customer_number: customer.customer_number || "",
      customer_type: customer.customer_type || "Individual",
      email: customer.email || "",
      phone: customer.phone || "",
      other_emails: customer.other_emails || [],
      credit_limit: customer.credit_limit || 0,
      birthday: customer.birthday || "",
      segment: customer.segment || "Customers",
      address: customer.address || "",
      photo_url: customer.photo_url || ""
    });
    setShowDetailOnMobile(true);
    setAiSummary(null);
    // Reset tab when selecting walk-in (tabs don't apply) or when first opening
    if (customer.id === 'walk-in') {
      setActiveTab("overview");
    }
  };

  useEffect(() => {
    if (!enterpriseId) return;
    const q = query(
      collection(db, "customers"),
      where("enterprise_id", "==", enterpriseId),
      limit(500)
    );
    const path = "customers";
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter and sort locally to avoid composite index requirement
      docs = docs.filter(d => d.status !== "Archived");
      docs.sort((a, b) => {
        const sA = a.status || "ACTIVE";
        const sB = b.status || "ACTIVE";
        if (sA !== sB) return sA.localeCompare(sB);
        return (a.name || "").localeCompare(b.name || "");
      });
      
      setCustomers(docs);
      
      // Functional updater avoids stale-closure bug — `prev` always reflects current state
      // so balance/points changes from POS propagate instantly to the open profile.
      setSelectedCustomer(prev => {
        if (!prev) return docs.length > 0 ? docs[0] : null;
        const updated = docs.find(d => d.id === prev.id);
        return updated ?? prev;
      });

      // Warn admin if the display window cap was hit
      if (snapshot.size >= 500) {
        toast.warning("Showing first 500 customers. Use search or filters to find others.", {
          id: "customer-limit-warn",
          duration: 8000,
        });
      }

      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [enterpriseId]);

  // Reset mobile detail view on unmount so the user lands on the list next time
  useEffect(() => {
    return () => { setShowDetailOnMobile(false); };
  }, []);

  // Consume pending cross-module actions from Dashboard quick-actions
  useEffect(() => {
    const action = consumeAction("crm");
    if (action?.action === "ADD_CUSTOMER") {
      setIsAddCustomerOpen(true);
    }
  }, [consumeAction]);

  useEffect(() => {
    if (!selectedCustomer) return;
    // Walk-in customers query transactions where customer_id is explicitly null.
    // POS must always write customer_id: null (not omit the field) for this to work.
    const q = query(
      collection(db, "transactions"), 
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id === 'walk-in' ? null : selectedCustomer.id),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      txs.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setCustomerTransactions(txs);
    }, (error) => {
      console.error("Error fetching customer transactions:", error);
    });

    const qInv = query(
      collection(db, "invoices"),
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id),
      limit(100)
    );
    const unsubscribeInv = onSnapshot(qInv, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCustomerInvoices(invs);
    }, (error) => {
      console.error("Error fetching customer invoices:", error);
    });

    const qCN = query(
      collection(db, "credit_notes"),
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id),
      limit(100)
    );
    const unsubscribeCN = onSnapshot(qCN, (snapshot) => {
      const cns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      cns.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setCustomerCreditNotes(cns);
    });

    return () => {
      unsubscribe();
      unsubscribeInv();
      unsubscribeCN();
    };
  }, [selectedCustomer, enterpriseId]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const q = query(
      collection(db, "documents"),
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setCustomerDocuments(docs);
    });
    return () => unsubscribe();
  }, [selectedCustomer]);

  const predictiveInsights = React.useMemo(() => {
    if (!selectedCustomer) return null;
    
    const totalSpent = selectedCustomer.spend || selectedCustomer.total_spent || 0;
    const lastPurchaseDate = selectedCustomer.last_purchase_date?.toDate ? selectedCustomer.last_purchase_date.toDate() : new Date(selectedCustomer.last_purchase_date || selectedCustomer.lastContact || 0);
    const daysSinceLastPurchase = Math.floor((new Date().getTime() - lastPurchaseDate.getTime()) / (1000 * 3600 * 24));
    
    const transactionCount = (selectedCustomer.transaction_count || 1);
    const avgSpend = totalSpent / transactionCount;
    const isHighValue = totalSpent > avgSpend * transactionCount * 0.8;

    let propensity = "Moderate";
    let propensityColor = "text-amber-600 border-amber-100";
    let propensityText = "Consistent but infrequent buyer";
    
    if (isHighValue && daysSinceLastPurchase < 30) {
      propensity = "High";
      propensityColor = "text-emerald-600 border-emerald-100";
      propensityText = "Active — likely to purchase soon";
    } else if (daysSinceLastPurchase > 90) {
      propensity = "Low";
      propensityColor = "text-rose-600 border-rose-100";
      propensityText = "Inactive — needs re-engagement";
    }

    let churnRisk = "Low";
    let churnColor = "text-emerald-600 border-emerald-100";
    let churnText = "Stable engagement";
    
    if (daysSinceLastPurchase > 120) {
      churnRisk = "High";
      churnColor = "text-rose-600 border-rose-100";
      churnText = "At risk of churning";
    } else if (daysSinceLastPurchase > 60) {
      churnRisk = "Medium";
      churnColor = "text-amber-600 border-amber-100";
      churnText = "Engagement dropping";
    }

    let recommendation = `Customer shows consistent engagement. System recommends maintaining regular communication.`;
    if (selectedCustomer.segment === "VIP") {
      recommendation = `VIP customer — System recommends priority outreach and exclusive offers.`;
    } else if (daysSinceLastPurchase > 90) {
      recommendation = `Customer hasn't purchased recently. System recommends a personalised win-back campaign.`;
    }

    return { propensity, propensityColor, propensityText, churnRisk, churnColor, churnText, recommendation };
  }, [selectedCustomer]);

  const recentActivity = React.useMemo(() => {
    if (!selectedCustomer) return [];
    const activities: any[] = [];
    
    customerTransactions.forEach(tx => {
      activities.push({
        type: "SALE",
        title: `Purchased ${tx.items?.length || 1} items`,
        date: tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString() : new Date(tx.timestamp || 0).toLocaleDateString(),
        timestamp: tx.timestamp?.toDate ? tx.timestamp.toDate().getTime() : new Date(tx.timestamp || 0).getTime(),
        amount: `$${(tx.total || 0).toFixed(2)}`,
        icon: CreditCard,
        color: "text-blue-600"
      });
    });

    (selectedCustomer.communications || []).forEach((comm: any) => {
      const cType = comm.type || "Communication";
      activities.push({
        type: cType.toUpperCase(),
        title: (comm.content || "").substring(0, 30) + "...",
        date: new Date(comm.timestamp).toLocaleDateString(),
        timestamp: new Date(comm.timestamp).getTime(),
        amount: "Engagement",
        icon: Mail,
        color: "text-purple-600"
      });
    });

    (selectedCustomer.notes || []).forEach((note: any) => {
      activities.push({
        type: "NOTE",
        title: note.content.substring(0, 30) + "...",
        date: new Date(note.timestamp).toLocaleDateString(),
        timestamp: new Date(note.timestamp).getTime(),
        amount: "Internal",
        icon: FileText,
        color: "text-amber-600"
      });
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [selectedCustomer, customerTransactions]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(c => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "");

      const matchesSearch = !term ||
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term);

      let matchesSegment = true;
      const segment = selectedSegment.toUpperCase();

      if (segment === "ALL") matchesSegment = true;
      else if (segment === "WITH BALANCE") matchesSegment = (c.balance || 0) > 0;
      else if (segment === "VIP") matchesSegment = c.segment === "VIP";
      else if (segment === "INACTIVE") {
        const lastContact = new Date(c.lastContact || 0);
        const diffDays = Math.floor((Date.now() - lastContact.getTime()) / 86400000);
        matchesSegment = diffDays > 90;
      } else if (segment === "AT RISK") {
        const lastContact = new Date(c.lastContact || 0);
        const diffDays = Math.floor((Date.now() - lastContact.getTime()) / 86400000);
        matchesSegment = diffDays > 30 && diffDays <= 90;
      } else if (segment === "OWING") {
        matchesSegment = Number(c.balance || 0) > 0;
      } else {
        matchesSegment = c.segment?.toUpperCase() === segment;
      }

      return matchesSearch && matchesSegment;
    });

    // Prepend virtual Walk-in account if viewing all or searching for it
    if (selectedSegment === "ALL" && (!term || "walk-in".includes(term))) {
      filtered.unshift({
        id: 'walk-in',
        name: 'Walk-in Customers',
        email: 'Anonymous checkout',
        phone: 'N/A',
        customer_type: 'Walk-in',
        segment: 'Retail',
        photo_url: '',
        spend: 0,
        total_spent: 0,
        status: 'ACTIVE'
      });
    }

    return filtered;
  }, [customers, searchTerm, selectedSegment]);

  const handleFileUpload = async (files: FileList | File[] | null | React.ChangeEvent<HTMLInputElement>) => {
    let fileToUpload: File | null = null;
    
    if (files && 'target' in files) {
      fileToUpload = (files as React.ChangeEvent<HTMLInputElement>).target.files?.[0] || null;
    } else if (files instanceof FileList) {
      fileToUpload = files[0];
    } else if (Array.isArray(files)) {
      fileToUpload = files[0];
    }

    if (!fileToUpload || !selectedCustomer) return;

    if (fileToUpload.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading "${fileToUpload.name}"...`);
    let storageRef: any = null;

    if (!enterpriseId) {
      toast.error("Enterprise context missing. Please reload.");
      setIsUploading(false);
      toast.dismiss(toastId);
      return;
    }

    try {
      const storage = await getStorage();
      storageRef = await ref(storage, `enterprise/${enterpriseId}/customers/${selectedCustomer.id}/docs/${Date.now()}_${fileToUpload.name}`);
      await uploadBytes(storageRef, fileToUpload);
      const url = await getDownloadURL(storageRef);

      // Atomic: if Firestore write fails, delete the orphaned Storage file
      try {
        await addDoc(collection(db, "documents"), {
          customer_id: selectedCustomer.id,
          enterprise_id: enterpriseId,
          name: fileToUpload.name,
          type: fileToUpload.type,
          size: fileToUpload.size,
          url: url,
          path: storageRef.fullPath,
          uploadedAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
          author: auth.currentUser?.displayName || "System"
        });
      } catch (firestoreError) {
        // Rollback: remove the already-uploaded Storage file to prevent orphaning
        try {
          const { deleteObject } = await import("firebase/storage");
          await deleteObject(storageRef);
        } catch (_) { /* best-effort cleanup */ }
        throw firestoreError;
      }

      toast.success(`Successfully uploaded ${fileToUpload.name}`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Upload failed", { id: toastId });
    } finally {
      setIsUploading(false);
      // Reset input if it was a change event
      if (files && 'target' in files) {
        (files as React.ChangeEvent<HTMLInputElement>).target.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <div className="p-3 rounded-lg bg-rose-50 text-rose-600"><FileText className="w-6 h-6" /></div>;
    if (type.includes('image')) return <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><Camera className="w-6 h-6" /></div>;
    return <div className="p-3 rounded-lg bg-zinc-50 text-zinc-600"><FileText className="w-6 h-6" /></div>;
  };

  const handleSummarizeProfile = async () => {
    if (!selectedCustomer) return;
    setIsSummarizing(true);
    setAiSummary(null);
    try {
      const prompt = `You are a Senior CRM Strategist. Analyze this customer profile and provide:
      1. A professional 3-sentence summary highlighting their value and relationship health.
      2. Exactly 2 highly specific, data-driven "Next Best Actions" (NBA) to drive revenue or retention.
      
      Customer Context:
      Name: ${selectedCustomer.name}
      Email: ${selectedCustomer.email}
      Segment: ${selectedCustomer.segment}
      Total Lifetime Value (LTV): $${selectedCustomer.spend || selectedCustomer.total_spent || 0}
      Outstanding Balance: $${selectedCustomer.balance}
      Loyalty Points: ${selectedCustomer.loyalty || selectedCustomer.loyalty_points}
      Last Activity: ${selectedCustomer.lastContact}
      Key Tags: ${selectedCustomer.tags?.join(", ") || "None"}
      
      Output Format:
      Summary: [Summary Text]
      Next Best Actions:
      - [Action 1]
      - [Action 2]`;

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error || "AI request failed"), { status: res.status });
      }

      const data = await res.json();
      setAiSummary(data.text);
      toast.success("Profile summary generated");
    } catch (error: any) {
      console.error("AI Error:", error);
      if (error?.status === 404) {
        toast.error("AI Copilot is not available in this environment.", {
          description: "Contact your administrator to enable the AI integration.",
          duration: 6000
        });
      } else if (error?.status === 429) {
        toast.error("AI quota exceeded — please try again later.");
      } else if (error?.status === 503) {
        toast.error("AI service not configured — contact your administrator.");
      } else if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
        toast.error("Network error — check your connection and retry.");
      } else {
        toast.error("Failed to generate AI summary. Please try again.");
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleArchiveCustomer = async () => {
    if (!selectedCustomer) return;
    if (selectedCustomer.id === 'walk-in') {
      toast.error("The Walk-in account cannot be archived.");
      return;
    }
    if (!canEdit) {
      toast.error("You do not have permission to archive customers.");
      return;
    }
    setIsSubmittingCustomer(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(customerRef, {
        status: "Archived",
        archivedAt: new Date().toISOString()
      });
      toast.success("Customer archived successfully");
      setIsDeleteConfirmOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      console.error(error);
      toast.error("Archive failed");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleGenerateAIOutreach = async () => {
    if (!selectedCustomer) return;
    setIsGeneratingOutreach(true);
    try {
      const prompt = `Write a professional and friendly personalized outreach email for a customer.
      Customer Name: ${selectedCustomer.name}
      Segment: ${selectedCustomer.segment}
      Recent Activity: Spent $${selectedCustomer.spend || 0} total.
      Insights: ${predictiveInsights?.recommendation}
      
      The email should be concise, helpful, and encourage them to connect or check out our latest offers.`;

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error || "AI request failed"), { status: res.status });
      }

      const data = await res.json();
      setOutreachMessage(data.text || "");
    } catch (error: any) {
      console.error(error);
      if (error?.status === 429) {
        toast.error("AI quota exceeded — please try again later.");
      } else if (error?.status === 503) {
        toast.error("AI service not configured — contact your administrator.");
      } else {
        toast.error("Failed to generate outreach message.");
      }
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!selectedCustomer || !outreachMessage.trim() || isSubmittingComm) return;
    setIsSubmittingComm(true);
    try {
      await addDoc(collection(db, "communications"), {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        type: "Email",
        content: outreachMessage,
        timestamp: serverTimestamp(),
        sender: "AI Assistant",
        status: "Sent"
      });
      // Also add to customer comm history inline
      await updateDoc(doc(db, "customers", selectedCustomer.id), {
        communications: arrayUnion({
          id: Date.now().toString(),
          type: "Email",
          content: outreachMessage,
          author: "AI Outreach",
          timestamp: new Date().toISOString()
        })
      });
      toast.success("Outreach sent and logged");
      setIsOutreachDialogOpen(false);
      setOutreachMessage("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send outreach");
    } finally {
      setIsSubmittingComm(false);
    }
  };

  const handlePrintReport = (reportName: string) => {
    if (!isManager && (reportName === "Purchase History" || reportName === "Full Audit")) {
      toast.error("Access Denied: Manager role required for aggregate exports.");
      return;
    }
    setActivePrintReport(reportName);
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const triggerPrint = () => {
      if (checkInterval) clearInterval(checkInterval);
      window.print();
      setActivePrintReport(null);
    };

    const timer = setTimeout(triggerPrint, 3000);

    checkInterval = setInterval(() => {
      const container = document.getElementById('printable-report-container');
      if (container) {
        const imgs = Array.from(container.getElementsByTagName('img'));
        const allLoaded = imgs.length === 0 || imgs.every(img => img.complete && img.naturalHeight !== 0);
        if (allLoaded) {
          clearTimeout(timer);
          triggerPrint();
        }
      }
    }, 100);

    return () => { clearTimeout(timer); if (checkInterval) clearInterval(checkInterval); };
  };

  const handleShareReport = async (reportName: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: reportName,
          text: `View ${reportName} for ${selectedCustomer.name}`,
          url: window.location.href,
        });
        toast.success("Shared successfully");
      } catch (err) {
        console.log("Sharing failed", err);
      }
    } else {
      toast.info("Native sharing not supported on this device - copied link instead");
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomer) return;

    if (!invoiceData.invoiceNumber || invoiceData.invoiceNumber.trim() === "") {
      toast.error("Please provide an invoice number");
      return;
    }

    const amountStr = String(invoiceData.amount).trim();
    const amountVal = parseFloat(amountStr);
    
    if (!amountStr || isNaN(amountVal) || amountVal <= 0 || !/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      toast.error("Please enter a valid currency amount (e.g., 150.00)");
      return;
    }

    if (!invoiceData.description || invoiceData.description.trim().length < 3) {
      toast.error("Please provide a valid description for the invoice");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!invoiceData.dueDate || !dateRegex.test(invoiceData.dueDate)) {
      toast.error("Please provide a valid due date (YYYY-MM-DD)");
      return;
    }

    const dueDateObj = new Date(invoiceData.dueDate);
    if (isNaN(dueDateObj.getTime())) {
      toast.error("The provided due date is invalid");
      return;
    }

    if (dueDateObj.getFullYear() < 2000) {
      toast.error("Please enter a realistic due date");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDateObj < today) {
      toast.warning("Note: The due date is in the past. Proceeding anyway.");
    }

    const formattedAmount = Number(amountVal.toFixed(2));

    setIsSubmittingInvoice(true);
    try {
      await addDoc(collection(db, "invoices"), {
        invoice_number: invoiceData.invoiceNumber.trim(),
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        amount: formattedAmount,
        total: formattedAmount, // added total reference 
        description: invoiceData.description.trim(),
        date: new Date().toISOString().split('T')[0],
        due_date: invoiceData.dueDate,
        status: invoiceData.status || "UNPAID",
        timestamp: serverTimestamp(),
        branch_id: activeBranch || "main"
      });
      toast.success("Invoice created successfully");
      setIsInvoiceDialogOpen(false);
      setInvoiceData({ invoiceNumber: "", amount: "", description: "", dueDate: new Date().toISOString().split('T')[0], status: "UNPAID" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "invoices");
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const handleScheduleCall = async () => {
    if (!selectedCustomer || isSubmittingCall) return;
    if (!callData.date) { toast.error("Please select a date"); return; }
    if (selectedCustomer.id === 'walk-in') { toast.error("Cannot schedule calls for Walk-in account."); return; }
    setIsSubmittingCall(true);
    const toastId = toast.loading("Scheduling call...");
    try {
      const content = `Scheduled Call: ${callData.objective} on ${callData.date} at ${callData.time}`;
      
      // Log to global communications collection
      await addDoc(collection(db, "communications"), {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        type: "Call",
        content,
        date: callData.date,
        timestamp: serverTimestamp(),
        sender: auth.currentUser?.displayName || "System",
        status: "Scheduled"
      });

      // Update customer document inline record
      await updateDoc(doc(db, "customers", selectedCustomer.id), {
        communications: arrayUnion({
          id: Date.now().toString(),
          type: "Call",
          content,
          author: auth.currentUser?.displayName || "System",
          timestamp: new Date().toISOString()
        })
      });
      
      toast.success("Call scheduled and logged", { id: toastId });
      setIsScheduleCallOpen(false);
    } catch (error: any) {
      console.error("Schedule Call Failure:", error);
      toast.error(`Failed to schedule call: ${error.message || 'Check database permissions'}`, { id: toastId });
    } finally {
      setIsSubmittingCall(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedCustomer || isSubmittingCustomer) return;
    if (selectedCustomer.id === 'walk-in') { toast.error("Cannot tag the Walk-in account."); return; }
    setIsSubmittingCustomer(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(customerRef, { tags: arrayUnion(newTag.trim()) });
      toast.success("Tag added successfully");
      setNewTag("");
      setIsTagDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add tag");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleGenerateOffer = async () => {
    if (!offerDetails.trim() || !selectedCustomer || isSubmittingComm) return;
    if (selectedCustomer.id === 'walk-in') { toast.error("Cannot log offers for Walk-in account."); return; }
    setIsSubmittingComm(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const commObj = {
        id: Date.now().toString(),
        type: "Offer",
        content: offerDetails,
        author: auth.currentUser?.displayName || "Staff",
        timestamp: new Date().toISOString()
      };
      await updateDoc(customerRef, { communications: arrayUnion(commObj) });
      toast.success("Personalized offer saved to communications");
      setOfferDetails("");
      setIsOfferDialogOpen(false);
    } catch (error) {
      toast.error("Failed to generate offer");
    } finally {
      setIsSubmittingComm(false);
    }
  };

  const handleFollowUp = async () => {
    if (!outreachMessage.trim() || !selectedCustomer || isSubmittingComm) return;
    if (selectedCustomer.id === 'walk-in') { toast.error("Cannot send outreach to Walk-in account."); return; }
    setIsSubmittingComm(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const commObj = {
        id: Date.now().toString(),
        type: "Email",
        content: outreachMessage,
        author: auth.currentUser?.displayName || "AI Outreach",
        timestamp: new Date().toISOString()
      };
      await updateDoc(customerRef, { communications: arrayUnion(commObj) });
      toast.success(`Follow-up logged for ${selectedCustomer.name}`);
      setOutreachMessage("");
      setIsOutreachDialogOpen(false);
    } catch (error) {
      toast.error("Failed to schedule outreach");
    } finally {
      setIsSubmittingComm(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedCustomer) return;
    setIsSubmittingNote(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const noteObj = {
        id: Date.now().toString(),
        content: newNote,
        timestamp: new Date().toISOString(),
        author: auth.currentUser?.displayName || "Current User"
      };
      await updateDoc(customerRef, {
        notes: arrayUnion(noteObj)
      });
      setNewNote("");
      toast.success("Note added successfully");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAddCommunication = async () => {
    if (!newComm.trim() || !selectedCustomer) return;
    setIsSubmittingComm(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const commObj = {
        id: Date.now().toString(),
        type: commType,
        content: newComm,
        timestamp: new Date().toISOString(),
        author: auth.currentUser?.displayName || "Current User"
      };
      await updateDoc(customerRef, {
        communications: arrayUnion(commObj)
      });
      setNewComm("");
      toast.success("Communication logged successfully");
    } catch (error) {
      console.error("Error logging communication:", error);
      toast.error("Failed to log communication");
    } finally {
      setIsSubmittingComm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center bg-zinc-50/50">
        <RipplePulseLoader size="lg" />
        <p className="text-sm font-bold text-zinc-400 mt-4 tracking-widest uppercase">Initializing CRM Engine...</p>
      </div>
    );
  }

  const CollectPaymentDialog = (
    <Dialog open={isCollectPaymentOpen} onOpenChange={setIsCollectPaymentOpen}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl bg-white overflow-hidden">
        <DialogHeader>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <Banknote className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-black text-zinc-900">Collect Payment</DialogTitle>
          <DialogDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
            Settle outstanding balance for {selectedCustomer?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex justify-between items-center">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Total Debt</span>
            <span className="text-lg font-black text-rose-600">{formatCurrency(selectedCustomer?.balance || 0)}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount to Collect</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
              <Input 
                type="number"
                placeholder="0.00"
                value={collectionData.amount}
                onChange={(e) => setCollectionData({ ...collectionData, amount: e.target.value })}
                className="h-16 pl-8 rounded-2xl border-none bg-zinc-50 font-black text-2xl focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                onClick={() => setCollectionData({ ...collectionData, amount: String(selectedCustomer?.balance || 0) })}
              >
                Pay Full
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Method</Label>
               <select 
                 className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 font-bold text-xs"
                 value={collectionData.method}
                 onChange={(e) => setCollectionData({ ...collectionData, method: e.target.value })}
               >
                 <option value="CASH">Cash</option>
                 <option value="CARD">Card</option>
                 <option value="TRANSFER">Transfer</option>
                 <option value="CHEQUE">Cheque</option>
               </select>
             </div>
             <div className="space-y-2">
               <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                 Reference #
                 <span className="text-[8px] font-bold text-zinc-300 normal-case">(For Bank Reconciliation)</span>
               </Label>
               <Input 
                 placeholder="Optional"
                 value={collectionData.reference}
                 onChange={(e) => setCollectionData({ ...collectionData, reference: e.target.value })}
                 className="h-12 rounded-xl border-none bg-zinc-50 font-bold text-xs"
               />
             </div>
          </div>

          <Button 
            className="w-full h-14 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold text-lg shadow-xl shadow-zinc-900/20 disabled:opacity-50"
            onClick={handleCollectPayment}
            disabled={isSubmittingCollection || !collectionData.amount}
          >
            {isSubmittingCollection ? "Processing..." : `Record & Settle ${formatCurrency(parseFloat(collectionData.amount) || 0)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const AddCustomerDialog = (
    <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
      <DialogContent className="w-full sm:max-w-4xl p-0 shadow-2xl flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-3xl border-none">
        <DialogHeader className="px-6 py-4 sm:px-8 sm:py-6 border-b border-zinc-100 flex flex-row items-center sticky top-0 bg-white z-10 w-full relative flex-none">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-zinc-900" />
            <div>
              <DialogTitle className="text-lg md:text-2xl font-bold font-display tracking-tight text-zinc-900">Add New Customer</DialogTitle>
              <DialogDescription className="text-[10px] md:text-sm hidden sm:block">Register a new client into the directory.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-50/10">
          <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            
            {/* Customer Number & Type */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-900">Customer Number</Label>
                <Input 
                  placeholder="Leave blank to auto-generate" 
                  value={customerFormData.customer_number}
                  onChange={(e) => setCustomerFormData({...customerFormData, customer_number: e.target.value})}
                  className="rounded-xl h-12 bg-zinc-50 border-zinc-200 text-zinc-600 placeholder:text-zinc-400 focus:bg-white transition-all"
                />
                <p className="text-xs text-zinc-500">Leave blank to auto-generate</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-900">Customer Type</Label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="customer_type" 
                      value="Individual" 
                      checked={customerFormData.customer_type === "Individual"}
                      onChange={(e) => setCustomerFormData({...customerFormData, customer_type: e.target.value})}
                      className="w-4 h-4 text-blue-600 border-zinc-300 focus:ring-blue-500"
                    />
                    <span className="text-zinc-900 text-sm">Individual</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="customer_type" 
                      value="Business" 
                      checked={customerFormData.customer_type === "Business"}
                      onChange={(e) => setCustomerFormData({...customerFormData, customer_type: e.target.value, last_name: ""})}
                      className="w-4 h-4 text-blue-600 border-zinc-300 focus:ring-blue-500"
                    />
                    <span className="text-zinc-900 text-sm">Business</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Names and Photo */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-8 items-start">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-900">{customerFormData.customer_type === "Individual" ? "First Name *" : "Company Name *"}</Label>
                  <Input 
                    placeholder=""
                    value={customerFormData.first_name}
                    onChange={(e) => setCustomerFormData({...customerFormData, first_name: e.target.value})}
                    className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                  />
                </div>
                {customerFormData.customer_type === "Individual" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-900">Last Name *</Label>
                    <Input 
                      placeholder=""
                      value={customerFormData.last_name}
                      onChange={(e) => setCustomerFormData({...customerFormData, last_name: e.target.value})}
                      className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3 flex flex-col items-center justify-start pt-2">
                <Label className="text-sm font-medium text-zinc-900 mb-2 mt-4 md:mt-0">Customer Photo</Label>
                <input 
                  type="file" 
                  ref={photoInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                />
                <div 
                  className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors group cursor-pointer overflow-hidden relative"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {customerFormData.photo_url ? (
                    <img src={customerFormData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold uppercase tracking-wider">{customerFormData.photo_url ? "Change" : "Upload"}</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-500 text-center">Supported: JPG, PNG, WEBP</span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-900">Email Address</Label>
                <Input 
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({...customerFormData, email: e.target.value})}
                  className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-900">Phone Number</Label>
                <Input 
                  type="tel"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({...customerFormData, phone: e.target.value})}
                  className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Other Emails */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900">Other Email Addresses</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCustomerFormData({...customerFormData, other_emails: [...customerFormData.other_emails, ""]})}
                  className="h-8 rounded-lg text-xs font-medium"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Email
                </Button>
              </div>
              <p className="text-sm text-zinc-500 mt-0 pt-0">Add additional email addresses for invoices and quotes delivery</p>
              {customerFormData.other_emails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...customerFormData.other_emails];
                      newEmails[index] = e.target.value;
                      setCustomerFormData({...customerFormData, other_emails: newEmails});
                    }}
                    className="rounded-xl h-12 border-zinc-200 focus:border-blue-500 flex-1"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      const newEmails = [...customerFormData.other_emails];
                      newEmails.splice(index, 1);
                      setCustomerFormData({...customerFormData, other_emails: newEmails});
                    }}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-900">Address</Label>
              <Textarea 
                value={customerFormData.address}
                onChange={(e) => setCustomerFormData({...customerFormData, address: e.target.value})}
                className="rounded-xl min-h-[100px] border-zinc-200 focus:border-blue-500 resize-y"
              />
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-900">Credit Limit ($)</Label>
                  <Input 
                    type="number"
                    value={customerFormData.credit_limit}
                    onChange={(e) => setCustomerFormData({...customerFormData, credit_limit: Number(e.target.value)})}
                    className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-900">Birthday</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input 
                    type="date"
                    value={customerFormData.birthday}
                    onChange={(e) => setCustomerFormData({...customerFormData, birthday: e.target.value})}
                    className="rounded-xl h-12 border-zinc-200 focus:border-blue-500 pl-11"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-900">Customer Group</Label>
              <Select value={customerFormData.segment} onValueChange={(v) => setCustomerFormData({...customerFormData, segment: v})}>
                <SelectTrigger className="rounded-xl h-12 border-zinc-200 focus:border-blue-500 text-left bg-white">
                  <SelectValue placeholder="No Group" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-zinc-200 shadow-xl">
                  <SelectItem value="No Group">No Group</SelectItem>
                  <SelectItem value="Leads">Lead (Active Prospect)</SelectItem>
                  <SelectItem value="Prospects">Prospect (Qualified)</SelectItem>
                  <SelectItem value="Customers">Customer (Verified)</SelectItem>
                  <SelectItem value="VIP">VIP (High Value)</SelectItem>
                  <SelectItem value="Wholesale">Wholesale (Volume)</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </div>

        <DialogFooter className="px-6 py-4 sm:px-8 sm:py-6 bg-white border-t border-zinc-100 flex flex-row gap-3 sm:gap-4 flex-none sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button 
            variant="outline" 
            className="flex-1 rounded-xl border-zinc-200 h-12 md:h-14 font-bold text-zinc-900 hover:bg-zinc-50" 
            onClick={() => setIsAddCustomerOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            className="flex-[2] rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 md:h-14 font-bold shadow-xl shadow-zinc-900/10" 
            onClick={handleCreateCustomer}
            disabled={isSubmittingCustomer}
          >
            {isSubmittingCustomer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Register Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!selectedCustomer) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center bg-zinc-50/50">
        <div className="text-center space-y-4">
          <Users className="w-12 h-12 text-zinc-300 mx-auto" />
          <h3 className="text-lg font-bold text-zinc-900">No customers found</h3>
          <p className="text-zinc-500">Add a customer to get started.</p>
          <Button className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20" onClick={() => setIsAddCustomerOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
        {AddCustomerDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-50/50 relative">
      {/* Global Header Metrics */}
      {AddCustomerDialog}
      {CollectPaymentDialog}
      <div className="flex-none p-4 lg:p-6 pb-0 w-full hidden lg:block">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card className="p-5 flex items-center justify-between border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">Total Relationships</p>
              <h3 className="text-2xl font-bold text-zinc-900 leading-none">{customers.length}</h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-2">Active CRM Scope</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Users className="w-6 h-6"/></div>
          </Card>
          <Card className="p-5 flex items-center justify-between border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">Total LTV</p>
              <h3 className="text-2xl font-bold text-zinc-900 leading-none">
                {formatCurrency(customers.reduce((acc, c) => acc + Number(c.spend || c.total_spent || 0), 0))}
              </h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-2">All active customers</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><TrendingUp className="w-6 h-6"/></div>
          </Card>
          <Card className="p-5 flex items-center justify-between border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">Engaged Leads</p>
              <h3 className="text-2xl font-bold text-zinc-900 leading-none">
                {customers.filter(c => c.segment?.toUpperCase() === "LEAD").length}
              </h3>
              <p className="text-[10px] text-purple-600 font-bold mt-2">Conversion: 14%</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl shadow-inner"><UserPlus className="w-6 h-6"/></div>
          </Card>
          <Card className="p-5 flex items-center justify-between border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">A/R Outstanding</p>
              <h3 className="text-2xl font-bold text-zinc-900 leading-none">
                {formatCurrency(customers.reduce((acc, c) => acc + (c.balance || 0), 0))}
              </h3>
              <p className="text-[10px] text-rose-600 font-bold mt-2">Immediate Attention</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-inner"><AlertCircle className="w-6 h-6"/></div>
          </Card>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden w-full bg-white shadow-sm border-t border-zinc-200">
        {/* Sidebar List */}
        <div className={cn(
          "w-full lg:w-96 border-r border-zinc-200 bg-white flex flex-col shadow-sm z-10 transition-all duration-300",
          showDetailOnMobile ? "hidden lg:flex" : "flex"
        )}>
        <div className="p-6 lg:p-8 space-y-6 border-b border-zinc-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight font-display">Customers</h2>
            <Button onClick={() => setIsAddCustomerOpen(true)} className="flex-1 sm:flex-none rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-6 font-bold text-xs">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Search by name, email or phone..." 
              className="pl-10 rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl border-zinc-200 h-11 px-4 font-black text-[10px] uppercase tracking-widest bg-white shadow-sm hover:bg-zinc-50 flex items-center gap-2 transition-all">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mr-1">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-zinc-400">Showing:</span>
                  <span className="text-zinc-900">{selectedSegment === "All" ? "All Accounts" : selectedSegment}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-300 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl border-zinc-200 p-2 shadow-xl bg-white/95 backdrop-blur-sm">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-2">Quick Filters</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-100 mx-2 mb-1" />
                  {[
                    { name: "All", icon: Users },
                    { name: "With Balance", icon: Banknote },
                    { name: "VIP", icon: Crown },
                    { name: "At Risk", icon: AlertCircle },
                    { name: "Inactive", icon: Clock }
                  ].map((seg) => (
                    <DropdownMenuItem 
                      key={seg.name} 
                      className={cn(
                        "rounded-xl py-2.5 px-3 cursor-pointer flex items-center gap-3 transition-colors",
                        selectedSegment === seg.name ? "bg-zinc-900 text-white hover:bg-zinc-900" : "hover:bg-zinc-50 text-zinc-600"
                      )}
                      onClick={() => setSelectedSegment(seg.name)}
                    >
                      <seg.icon className={cn("w-4 h-4", selectedSegment === seg.name ? "text-white" : "text-zinc-400")} />
                      <span className="font-bold text-xs">{seg.name}</span>
                      {selectedSegment === seg.name && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-white" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {searchTerm && (
              <Badge variant="outline" className="rounded-lg bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-black uppercase px-2 h-6">
                Searching...
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="divide-y divide-zinc-50">
            {filteredCustomers.map((customer) => (
              <div 
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className={cn(
                  "p-6 cursor-pointer transition-all duration-300 hover:bg-zinc-50 group relative",
                  selectedCustomer?.id === customer.id ? "bg-blue-50/50" : ""
                )}
              >
                {selectedCustomer?.id === customer.id && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />
                )}
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                    <AvatarImage src={customer.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
                    <AvatarFallback className="bg-zinc-100 text-zinc-900 font-bold">{customer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-bold text-zinc-900 truncate">{customer.name}</p>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest group-hover:hidden transition-all">{customer.lastContact}</span>
                      <div className="hidden group-hover:flex items-center gap-1 transition-all">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-200" onClick={(e) => { e.stopPropagation(); handleCustomerSelect(customer); setIsInvoiceDialogOpen(true); }}>
                          <FileText className="w-3.5 h-3.5 text-zinc-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-200" onClick={(e) => { e.stopPropagation(); handleCustomerSelect(customer); setIsOutreachDialogOpen(true); }}>
                          <MessageSquare className="w-3.5 h-3.5 text-zinc-600" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mb-1">{customer.email}</p>
                    <div className="flex items-center gap-3 mb-2 text-[10px] font-bold text-zinc-400">
                      <span className="flex items-center gap-1">
                        LTV: {formatCurrency(customer.spend || customer.total_spent || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                        {customer.loyalty || customer.loyalty_points || 0} pts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={cn(
                        "text-[9px] px-1.5 py-0 rounded-md font-bold uppercase",
                        customer.segment === "VIP" ? "bg-blue-50 text-blue-600 border-blue-100" : 
                        customer.segment === "WHOLESALE" ? "bg-purple-50 text-purple-600 border-purple-100" : 
                        "bg-zinc-100 text-zinc-600 border-zinc-200"
                      )}>
                        {customer.segment}
                      </Badge>
                      {(customer.spend >= topSpenderThreshold || customer.total_spent >= topSpenderThreshold) && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md font-bold uppercase bg-amber-50 text-amber-600 border-amber-200">
                          Top Spender
                        </Badge>
                      )}
                      {customer.balance > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md font-bold uppercase bg-rose-50 text-rose-600 border-rose-100">
                          Owing
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail View */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-white lg:bg-transparent transition-all duration-300",
        !showDetailOnMobile ? "hidden lg:flex" : "flex"
      )}>
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-zinc-200 bg-white flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowDetailOnMobile(false)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-zinc-900 truncate">{selectedCustomer.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{selectedCustomer.segment}</p>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 bg-zinc-50/30">
          <div className="responsive-container lg:p-10">
            {/* Profile Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex items-center gap-6 lg:gap-8">
                <div className="relative">
                  <Avatar className="w-20 h-20 lg:w-28 lg:h-28 border-4 border-white shadow-2xl">
                    <AvatarImage src={selectedCustomer.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedCustomer.name}`} />
                    <AvatarFallback className="text-3xl font-bold">{selectedCustomer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 lg:-bottom-2 lg:-right-2 w-8 h-8 lg:w-10 lg:h-10 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-white shadow-lg">
                    <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap max-w-full">
                    <h1 className="text-xl lg:text-4xl font-bold tracking-tight text-zinc-900 font-display break-words">{selectedCustomer.name}</h1>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-600 text-white border-none px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">{selectedCustomer.segment}</Badge>
                      {(selectedCustomer.spend >= topSpenderThreshold || selectedCustomer.total_spent >= topSpenderThreshold) && (
                        <Badge className="bg-amber-500 text-white border-none px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          VIP
                        </Badge>
                      )}
                      {Number(selectedCustomer.balance) > 0.01 && (
                        <Badge className="bg-rose-600 text-white border-none px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Owing: {formatCurrency(selectedCustomer.balance)}
                        </Badge>
                      )}
                      {Number(selectedCustomer.balance) < -0.01 && (
                        <Badge className="bg-emerald-500 text-white border-none px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm">
                          <Wallet className="w-3 h-3" />
                          Store Credit: {formatCurrency(Math.abs(selectedCustomer.balance))}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 lg:gap-6 text-xs lg:text-sm text-zinc-500 font-medium">
                    <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors shrink-0"><Mail className="w-4 h-4" /> {selectedCustomer.email}</a>
                    <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors shrink-0"><Phone className="w-4 h-4" /> {selectedCustomer.phone || "—"}</a>
                    {selectedCustomer.address && (
                      <div className="flex items-center gap-2 min-w-0"><MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{selectedCustomer.address}</span></div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-zinc-200 h-12 px-6 font-bold text-xs bg-white shadow-sm hover:bg-zinc-50 transition-all cursor-pointer")}>
                    <MoreHorizontal className="w-4 h-4 mr-2" />
                    Actions
                  </button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-zinc-200 p-2 shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-2">Profile Management</DropdownMenuLabel>
                    {selectedCustomer.id !== 'walk-in' && canEdit && (
                      <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => {
                        setCustomerFormData({
                          name: selectedCustomer.name || "",
                          first_name: selectedCustomer.first_name || "",
                          last_name: selectedCustomer.last_name || "",
                          customer_number: selectedCustomer.customer_number || "",
                          customer_type: selectedCustomer.customer_type || "Individual",
                          email: selectedCustomer.email || "",
                          phone: selectedCustomer.phone || "",
                          other_emails: selectedCustomer.other_emails || [],
                          credit_limit: selectedCustomer.credit_limit || 0,
                          birthday: selectedCustomer.birthday || "",
                          segment: selectedCustomer.segment || "No Group",
                          address: selectedCustomer.address || "",
                          photo_url: selectedCustomer.photo_url || ""
                        });
                        setIsEditCustomerOpen(true);
                      }}>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-4 h-4" /></div>
                        <span className="font-bold text-xs text-zinc-700">Edit Profile</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsInvoiceDialogOpen(true)}>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><FileText className="w-4 h-4" /></div>
                        <span className="font-bold text-xs text-zinc-700">Create Invoice</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsScheduleCallOpen(true)}>
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Calendar className="w-4 h-4" /></div>
                        <span className="font-bold text-xs text-zinc-700">Schedule Call</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && selectedCustomer.id !== 'walk-in' && (
                      <DropdownMenuItem
                        className={cn(
                          "rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3",
                          selectedCustomer.balance > 0.01
                            ? "text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                            : selectedCustomer.balance < -0.01
                              ? "text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50"
                              : "focus:bg-zinc-50"
                        )}
                        onClick={() => setIsCollectPaymentOpen(true)}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          selectedCustomer.balance > 0.01 ? "bg-rose-50 text-rose-600" : selectedCustomer.balance < -0.01 ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                        )}>
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">
                            {selectedCustomer.balance > 0.01 ? "Settle Debt" : selectedCustomer.balance < -0.01 ? "Adjust Credit" : "Manage Balance"}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {selectedCustomer.balance > 0.01 ? `Collect ${formatCurrency(selectedCustomer.balance)}` : selectedCustomer.balance < -0.01 ? `Credit: +${formatCurrency(Math.abs(selectedCustomer.balance))}` : "Account is settled"}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  
                  <DropdownMenuSeparator className="my-2 bg-zinc-100" />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-2">Marketing</DropdownMenuLabel>
                    {canEdit && (
                      <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsOutreachDialogOpen(true)}>
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Sparkles className="w-4 h-4" /></div>
                        <span className="font-bold text-xs text-zinc-700">AI Outreach</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsTagDialogOpen(true)}>
                        <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600"><Tag className="w-4 h-4" /></div>
                        <span className="font-bold text-xs text-zinc-700">Manage Tags</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  {isManager && selectedCustomer.id !== 'walk-in' && <DropdownMenuSeparator className="my-2 bg-zinc-100" />}
                  
                  {isManager && selectedCustomer.id !== 'walk-in' && (
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3 text-orange-600 focus:text-orange-600 focus:bg-orange-50" onClick={() => {
                      setIsDeleteConfirmOpen(true);
                    }}>
                      <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><History className="w-4 h-4" /></div>
                      <span className="font-bold text-xs">Archive Profile</span>
                    </DropdownMenuItem>
                  )}

                  {isAdmin && selectedCustomer.id !== 'walk-in' && (
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => {
                      setIsPermanentDeleteOpen(true);
                    }}>
                      <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><Trash2 className="w-4 h-4" /></div>
                      <span className="font-bold text-xs">Decommission Record</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

                <Button onClick={() => setIsOutreachDialogOpen(true)} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/20 h-10 px-6 sm:h-12 sm:px-8 font-bold text-xs shrink-0">
                  <Send className="w-4 h-4 mr-2" />
                  AI Outreach
                </Button>
              </div>
            </div>

          {/* Financial Status Banners */}
          <AnimatePresence>
            {Number(selectedCustomer.balance) > 0.01 && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-rose-50 border-2 border-rose-100 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                      <AlertCircle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-base font-black text-rose-900">Outstanding Account Balance</p>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">This customer currently owes {formatCurrency(selectedCustomer.balance)} to the enterprise</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setIsCollectPaymentOpen(true)} 
                    className="w-full sm:w-auto rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-black px-8 shadow-lg shadow-rose-200/50 h-12 text-xs uppercase tracking-widest"
                  >
                    Settle Debt Now
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Store Credit Banner */}
          <AnimatePresence>
            {Number(selectedCustomer.balance) < -0.01 && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                    <Wallet className="w-24 h-24 text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50 shrink-0">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-black text-emerald-900">Store Credit Available</p>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                        {formatCurrency(Math.abs(selectedCustomer.balance))} available — can be redeemed at Point of Sale
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="text-right hidden sm:block">
                      <p className="text-2xl font-black text-emerald-700">+{formatCurrency(Math.abs(selectedCustomer.balance))}</p>
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Credit Balance</p>
                    </div>
                    <div className="w-[1px] h-10 bg-emerald-100 hidden sm:block" />
                    <Button
                      variant="outline"
                      onClick={() => setIsCollectPaymentOpen(true)}
                      className="w-full sm:w-auto rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold px-6 h-12 text-xs uppercase tracking-widest bg-white/60"
                    >
                      Adjust Balance
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lifetime Value</p>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(selectedCustomer.spend || selectedCustomer.total_spent || 0)}</h3>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-400 font-medium">Total lifetime spend</span>
              </div>
            </Card>
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loyalty Balance</p>
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">{selectedCustomer.loyalty} pts</h3>
              <p className="text-[10px] text-zinc-500 font-medium">Gold Tier Member</p>
            </Card>
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Financial Standing</p>
                {selectedCustomer.balance > 0.01 ? <CreditCard className="w-4 h-4 text-rose-500" /> : selectedCustomer.balance < -0.01 ? <Wallet className="w-4 h-4 text-emerald-500" /> : <ShieldCheck className="w-4 h-4 text-zinc-400" />}
              </div>
              <h3 className={cn("text-2xl font-bold", selectedCustomer.balance > 0.01 ? "text-rose-600" : selectedCustomer.balance < -0.01 ? "text-emerald-600" : "text-zinc-900")}>
                {selectedCustomer.balance < -0.01 ? `+${formatCurrency(Math.abs(selectedCustomer.balance))}` : formatCurrency(selectedCustomer.balance)}
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-500 font-medium">
                  {selectedCustomer.balance > 0.01 ? "Outstanding Debt" : selectedCustomer.balance < -0.01 ? "Available Store Credit" : "Account Settled"}
                </p>
                {selectedCustomer.balance > 0.01 && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 rounded-lg text-blue-600 hover:bg-blue-50 text-[10px] font-black uppercase" onClick={() => setIsCollectPaymentOpen(true)}>
                    Collect
                  </Button>
                )}
              </div>
            </Card>
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Engagement Score</p>
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">{selectedCustomer.score}/100</h3>
              <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${selectedCustomer.score}%` }} />
              </div>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="w-full overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="flex-none justify-start h-14 bg-transparent border-b border-zinc-200 w-full rounded-none px-0 gap-8 overflow-x-auto scrollbar-hide">
                <TabsTrigger value="overview" className="tab-modern">Overview</TabsTrigger>
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="transactions" className="tab-modern">Purchase History</TabsTrigger>}
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="invoices" className="tab-modern">Invoices</TabsTrigger>}
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="documents" className="tab-modern">Documents</TabsTrigger>}
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="reports" className="tab-modern text-blue-600 font-black">Reporting Hub</TabsTrigger>}
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="communication" className="tab-modern">Communication</TabsTrigger>}
                {selectedCustomer.id !== 'walk-in' && <TabsTrigger value="notes" className="tab-modern">Internal Notes</TabsTrigger>}
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI Intelligence Card */}
                <Card className="lg:col-span-2 card-modern border-blue-100 bg-blue-50/30 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <BrainCircuit className="w-32 h-32 text-blue-600" />
                  </div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-xl font-bold">Predictive Insights</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-blue-600 font-bold text-xs"
                      onClick={handleSummarizeProfile}
                      disabled={isSummarizing}
                    >
                      {isSummarizing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
                      AI Summary
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {aiSummary && (
                      <div className="bg-white/80 p-4 rounded-xl border border-blue-100 mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <p className="text-sm text-zinc-800 leading-relaxed font-medium">
                          {aiSummary}
                        </p>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Purchase Propensity</p>
                          <div className="flex items-center gap-3">
                            <Badge className={cn("bg-white px-3 py-1 rounded-lg shadow-sm", predictiveInsights?.propensityColor)}>
                              {predictiveInsights?.propensity}
                            </Badge>
                            <span className="text-xs text-zinc-500">{predictiveInsights?.propensityText}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Churn Risk</p>
                          <div className="flex items-center gap-3">
                            <Badge className={cn("bg-white px-3 py-1 rounded-lg shadow-sm", predictiveInsights?.churnColor)}>
                              {predictiveInsights?.churnRisk}
                            </Badge>
                            <span className="text-xs text-zinc-500">{predictiveInsights?.churnText}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">AI Recommendation</p>
                        <p className="text-sm text-zinc-700 leading-relaxed">
                          {predictiveInsights?.recommendation}
                        </p>
                        <Button onClick={() => setIsOfferDialogOpen(true)} variant="outline" className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 font-bold text-xs h-10">
                          Generate Personalized Offer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tags & Segments */}
                <Card className="card-modern">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Tags & Segments</CardTitle>
                    <CardDescription>Categorization for targeted marketing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Segments</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-zinc-900 text-white rounded-lg px-3 py-1 text-[10px] font-bold uppercase">{selectedCustomer.segment}</Badge>
                        {(selectedCustomer.spend || selectedCustomer.total_spent || 0) > 1000 && (
                          <Badge className="bg-zinc-100 text-zinc-600 rounded-lg px-3 py-1 text-[10px] font-bold uppercase">High Spender</Badge>
                        )}
                        {customerTransactions.length > 5 && (
                          <Badge className="bg-zinc-100 text-zinc-600 rounded-lg px-3 py-1 text-[10px] font-bold uppercase">Frequent Buyer</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custom Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomer.tags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="rounded-lg px-3 py-1 text-[10px] font-bold uppercase border-zinc-200 text-zinc-500">
                            {tag}
                          </Badge>
                        ))}
                        <Button onClick={() => setIsTagDialogOpen(true)} variant="ghost" size="sm" className="h-6 px-2 rounded-lg text-blue-600 hover:bg-blue-50 text-[10px] font-bold">
                          + Add Tag
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card className="card-modern">
                <CardHeader className="border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                    <Button variant="ghost" size="sm" className="text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-lg" onClick={() => setActiveTab("communication")}>
                      Full Timeline
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-50">
                    {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                      <div key={i} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-xl bg-zinc-100", activity.color)}>
                            <activity.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{activity.title}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{activity.type} • {activity.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-zinc-900">{activity.amount}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="p-6 text-center text-zinc-500 text-sm">No recent activity found.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice History Section */}
              <Card className="card-modern mt-8">
                <CardHeader className="border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">Invoice History</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-lg flex items-center gap-1"
                      onClick={() => setActiveTab("invoices")}
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100 transition-none">
                        <TableHead className="font-bold text-zinc-900 py-3 text-[10px] uppercase tracking-widest pl-6">Invoice ID</TableHead>
                        <TableHead className="font-bold text-zinc-900 py-3 text-[10px] uppercase tracking-widest">Amount</TableHead>
                        <TableHead className="font-bold text-zinc-900 py-3 text-[10px] uppercase tracking-widest">Due Date</TableHead>
                        <TableHead className="font-bold text-zinc-900 py-3 text-[10px] uppercase tracking-widest pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerInvoices.length > 0 ? customerInvoices.slice(0, 3).map((inv) => (
                        <TableRow key={inv.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                          <TableCell className="py-4 font-mono text-[10px] font-bold text-zinc-400 pl-6">
                            #{inv.invoice_number || inv.id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="py-4 font-bold text-zinc-900 text-xs">{formatCurrency(inv.amount || inv.total || 0)}</TableCell>
                          <TableCell className="py-4 text-[10px] text-zinc-500">{inv.due_date}</TableCell>
                          <TableCell className="py-4 pr-6">
                            <Badge className={cn(
                              "text-[8px] px-2 py-0.5 font-black uppercase rounded-lg border-none",
                              inv.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            )}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="py-12 text-center text-zinc-400 text-sm italic">
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="w-8 h-8 opacity-20" />
                              <p>No active invoices recorded for this account.</p>
                            </div>
                          </TableCell>
                        </TableRow>
)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="transactions">
              <Card className="card-modern overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-zinc-900">Transaction Ledger</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                      {customerTransactions.length} record{customerTransactions.length !== 1 ? "s" : ""} • Full audit trail
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-blue-600 hover:bg-blue-50" onClick={() => handlePrintReport("Purchase History")}>
                    <FileText className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                </div>
                {customerTransactions.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <History className="w-10 h-10 text-zinc-200 mx-auto" />
                    <p className="text-zinc-400 text-sm font-bold">No transactions on record</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {customerTransactions.map((tx) => {
                      const isReturn = tx.type === "RETURN";
                      const isPayment = tx.type === "PAYMENT";
                      const isPartial = tx.status === "PARTIAL";
                      const hasDeduction = (tx.balance_deducted_from_refund || 0) > 0;
                      const txDate = tx.timestamp?.toDate
                        ? tx.timestamp.toDate()
                        : new Date(tx.timestamp || 0);
                      const dateStr = txDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      const timeStr = txDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                      return (
                        <div
                          key={tx.id}
                          className="p-5 hover:bg-zinc-50/70 transition-colors cursor-pointer group"
                          onClick={() => { setSelectedTransaction(tx); setIsTransactionDialogOpen(true); }}
                        >
                          <div className="flex items-start gap-4">
                            {/* Type Icon */}
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5",
                              isReturn ? "bg-rose-100" : isPayment ? "bg-emerald-100" : isPartial ? "bg-amber-100" : "bg-zinc-100"
                            )}>
                              {isReturn ? <ArrowUpRight className="w-5 h-5 text-rose-600 rotate-180" /> :
                               isPayment ? <Banknote className="w-5 h-5 text-emerald-600" /> :
                               isPartial ? <Clock className="w-5 h-5 text-amber-600" /> :
                               <ShoppingCart className="w-5 h-5 text-zinc-500" />}
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {/* Type Badge */}
                                <Badge className={cn(
                                  "text-[8px] font-black uppercase border-none px-2 py-0.5",
                                  isReturn ? "bg-rose-100 text-rose-700" :
                                  isPayment ? "bg-emerald-100 text-emerald-700" :
                                  isPartial ? "bg-amber-100 text-amber-700" :
                                  "bg-zinc-100 text-zinc-600"
                                )}>
                                  {isReturn ? "RETURN" : isPayment ? "PAYMENT" : isPartial ? "PARTIAL SALE" : "SALE"}
                                </Badge>

                                {/* Balance Deduction Flag */}
                                {hasDeduction && (
                                  <Badge className="text-[8px] font-black uppercase border-none px-2 py-0.5 bg-rose-50 text-rose-600">
                                    BAL SETTLED
                                  </Badge>
                                )}

                                {/* Partial/Debt Badge */}
                                {isPartial && (tx.balance_due || 0) > 0 && (
                                  <Badge className="text-[8px] font-black uppercase bg-amber-50 text-amber-700 border-none px-2 animate-pulse">
                                    Debt: {formatCurrency(tx.balance_due || 0)}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-black text-zinc-900">
                                  {isReturn ? `Return — ${formatCurrency(tx.total || 0)}` :
                                   isPayment ? `Payment — ${formatCurrency(tx.total || 0)}` :
                                   formatCurrency(tx.total || 0)}
                                </span>
                                {isReturn && hasDeduction && (
                                  <span className="text-[10px] font-bold text-zinc-500">
                                    (Net paid: {formatCurrency(tx.net_refund_paid || 0)})
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                                <span className="text-[10px] text-zinc-400 font-bold">
                                  {dateStr} at {timeStr}
                                </span>
                                {tx.cashier_name && (
                                  <span className="text-[10px] text-zinc-400 font-bold">
                                    • Cashier: {tx.cashier_name}
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-400 font-bold">
                                  • {tx.items?.length || 0} item{(tx.items?.length || 0) !== 1 ? "s" : ""}
                                </span>
                                <span className="text-[10px] font-bold uppercase text-zinc-400">
                                  • {tx.payment_method || tx.paymentMethod || "—"}
                                </span>
                                {isReturn && tx.original_transaction_id && (
                                  <span className="text-[10px] font-bold text-rose-400">
                                    • Orig: #{tx.original_transaction_id.substring(0, 8).toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {/* Balance Deduction Breakdown Row */}
                              {isReturn && hasDeduction && (
                                <div className="mt-2 flex items-center gap-2 p-2 bg-rose-50 rounded-lg border border-rose-100">
                                  <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Account Settlement:</span>
                                  <span className="text-[9px] font-bold text-rose-700">
                                    Gross {formatCurrency(tx.total || 0)} — Balance Deducted {formatCurrency(tx.balance_deducted_from_refund || 0)} = Net Payout {formatCurrency(tx.net_refund_paid || 0)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Right — ID + action */}
                            <div className="shrink-0 flex flex-col items-end gap-2">
                              <span className="font-mono text-[9px] text-zinc-300 group-hover:text-zinc-400 transition-colors">
                                #{tx.id.substring(0, 8).toUpperCase()}
                              </span>
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 rounded-lg text-[9px] font-black text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setSelectedTransaction(tx); setIsTransactionDialogOpen(true); }}
                              >
                                Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card className="card-modern overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                      <TableHead className="font-bold text-zinc-900 py-4">Invoice ID</TableHead>
                      <TableHead className="font-bold text-zinc-900 py-4">Amount</TableHead>
                      <TableHead className="font-bold text-zinc-900 py-4">Due Date</TableHead>
                      <TableHead className="font-bold text-zinc-900 py-4">Status</TableHead>
                      <TableHead className="text-right font-bold text-zinc-900 py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerInvoices.length > 0 ? customerInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                        <TableCell className="py-4 font-mono text-xs font-bold text-zinc-400">
                          {inv.invoice_number || inv.id}
                        </TableCell>
                        <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(inv.amount || inv.total || 0)}</TableCell>
                        <TableCell className="py-4 text-xs text-zinc-500">{inv.due_date}</TableCell>
                        <TableCell className="py-4">
                          <Badge className={cn(
                            "text-[9px] font-bold uppercase",
                            inv.status === "PAID" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                          )}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-blue-600" onClick={() => handlePrintReport(`Invoice ${inv.invoice_number || inv.id}`)}>
                               <FileText className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-emerald-600" onClick={() => handleShareReport(`Invoice ${inv.invoice_number || inv.id}`)}>
                               <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : customerTransactions.length > 0 ? customerTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-zinc-50/30 transition-colors border-b border-zinc-50">
                        <TableCell className="py-4 font-mono text-xs font-bold text-zinc-400">{tx.id.substring(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(tx.total || 0)}</TableCell>
                        <TableCell className="py-4 text-xs text-zinc-500">N/A</TableCell>
                        <TableCell className="py-4">
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase">Completed</Badge>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg hover:bg-zinc-100" 
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setIsTransactionDialogOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-zinc-500">No invoices or transactions found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
            <TabsContent value="communication">
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Communication History</CardTitle>
                  <CardDescription>Emails, SMS, and calls with this customer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      {["Email", "Call", "SMS", "Meeting"].map(type => (
                        <Badge 
                          key={type} 
                          variant={commType === type ? "default" : "outline"}
                          className={cn("cursor-pointer", commType === type ? "bg-zinc-900 text-white" : "text-zinc-500")}
                          onClick={() => setCommType(type)}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                    <textarea 
                      className="flex min-h-[100px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all resize-none"
                      placeholder={`Log a new ${commType.toLowerCase()}...`}
                      value={newComm}
                      onChange={(e) => setNewComm(e.target.value)}
                    />
                    <Button 
                      className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={handleAddCommunication}
                      disabled={isSubmittingComm || !newComm.trim()}
                    >
                      {isSubmittingComm ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Log Communication
                    </Button>
                  </div>

                  <div className="space-y-4 mt-8 pt-6 border-t border-zinc-100">
                    {selectedCustomer.communications && selectedCustomer.communications.length > 0 ? (
                      [...selectedCustomer.communications].reverse().map((comm: any) => (
                        <div key={comm.id} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-white">{comm.type}</Badge>
                              <span className="text-xs font-bold text-zinc-900">{comm.author}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-medium">{new Date(comm.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{comm.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-zinc-400 text-sm italic">
                        No communication history found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Internal Notes</CardTitle>
                  <CardDescription>Private notes visible only to staff</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <textarea 
                      className="flex min-h-[100px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all resize-none"
                      placeholder="Add a new internal note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <Button 
                      className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={handleAddNote}
                      disabled={isSubmittingNote || !newNote.trim()}
                    >
                      {isSubmittingNote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Add Note
                    </Button>
                  </div>

                  <div className="space-y-4 mt-8 pt-6 border-t border-zinc-100">
                    {selectedCustomer.notes && selectedCustomer.notes.length > 0 ? (
                      [...selectedCustomer.notes].reverse().map((note: any) => (
                        <div key={note.id} className="p-4 rounded-xl border border-amber-100 bg-amber-50/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-900">{note.author}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">{new Date(note.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words">{note.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-zinc-400 text-sm italic">
                        No internal notes found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents">
              <Card className="card-modern shadow-sm border-zinc-100">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-black text-zinc-900">Files & Documents</CardTitle>
                      <CardDescription className="text-xs font-medium text-zinc-500">Secure repository for customer records and attachments.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="flex items-center justify-center w-full">
                    <label 
                      htmlFor="dropzone-file" 
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300",
                        isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.02]" : "border-zinc-100 bg-zinc-50/30 hover:bg-zinc-50",
                        isUploading && "opacity-50 pointer-events-none"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleFileUpload(e.dataTransfer.files);
                      }}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl shadow-sm border flex items-center justify-center mb-4 transition-all duration-500",
                          isDragging ? "bg-blue-600 border-blue-600 scale-110 rotate-90" : "bg-white border-zinc-100"
                        )}>
                          <Plus className={cn("w-6 h-6", isDragging ? "text-white" : "text-zinc-400")} />
                        </div>
                        <p className={cn("mb-1 text-sm font-black transition-colors", isDragging ? "text-blue-600" : "text-zinc-600")}>
                          {isDragging ? "Drop to Upload" : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">PDF, JPG, PNG or DOC (MAX. 10MB)</p>
                      </div>
                      <input id="dropzone-file" type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>


                  <div className="space-y-3">
                    {customerDocuments.length > 0 ? (
                      customerDocuments.map((doc) => (
                        <div key={doc.id} className="p-5 rounded-2xl border border-zinc-100 flex items-center justify-between group bg-white hover:border-zinc-200 hover:shadow-sm transition-all">
                          <div className="flex items-center gap-5">
                            {getFileIcon(doc.type || '')}
                            <div className="min-w-0">
                              <p className="font-black text-sm text-zinc-900 truncate">{doc.name}</p>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight truncate">
                                Uploaded {new Date(doc.uploadedAt).toLocaleDateString()} • {formatFileSize(doc.size)} • {doc.author}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-10 w-10 rounded-xl hover:bg-zinc-50"
                               asChild
                             >
                               <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                 <Plus className="w-4 h-4 text-zinc-900 rotate-45" />
                               </a>
                             </Button>
                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-zinc-50">
                               <MoreVertical className="w-4 h-4 text-zinc-400" />
                             </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center border-2 border-zinc-50 rounded-[2rem] bg-zinc-50/20">
                        <FileText className="w-10 h-10 text-zinc-200 mb-3" />
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">No Documents Archived</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { id: "GCT Tax Statement", icon: FileText, title: "GCT Tax Statement", desc: "Itemized tax paid on all purchases", color: "bg-blue-50 text-blue-600" },
                  { id: "Credit Notes Ledger", icon: ArrowUpRight, title: "Credit Notes Ledger", desc: "History of returns and credits issued", color: "bg-rose-50 text-rose-600" },
                  { id: "Loyalty Audit", icon: Star, title: "Loyalty Audit", desc: "Full history of point movements", color: "bg-amber-50 text-amber-600" },
                  { id: "Account Aging", icon: Clock, title: "Account Aging (A/R)", desc: "Statement of unpaid invoices", color: "bg-zinc-50 text-zinc-600" }
                ].map((rep) => (
                  <Card key={rep.id} className="card-modern p-6 hover:border-zinc-900 transition-all cursor-pointer group" onClick={() => handlePrintReport(rep.id)}>
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", rep.color)}>
                      <rep.icon className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-zinc-900 mb-1">{rep.title}</h4>
                    <p className="text-xs text-zinc-500 mb-6">{rep.desc}</p>
                    <Button variant="ghost" className="w-full rounded-xl bg-zinc-50 font-bold text-xs hover:bg-zinc-900 hover:text-white transition-all">
                       <Download className="w-3 h-3 mr-2" /> Generate Report
                    </Button>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl bg-white sm:max-w-lg p-0 overflow-hidden">
          {selectedTransaction && (() => {
            const tx = selectedTransaction;
            const isReturn = tx.type === "RETURN";
            const isPayment = tx.type === "PAYMENT";
            const isPartial = tx.status === "PARTIAL";
            const hasDeduction = (tx.balance_deducted_from_refund || 0) > 0;
            const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp || 0);
            const fullDateTime = txDate.toLocaleString("en-US", {
              weekday: "long", year: "numeric", month: "long",
              day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
            });

            return (
              <>
                {/* Header */}
                <div className={cn(
                  "px-8 py-6 border-b border-zinc-100",
                  isReturn ? "bg-rose-50/50" : isPayment ? "bg-emerald-50/30" : isPartial ? "bg-amber-50/30" : "bg-zinc-50/30"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={cn(
                      "text-[9px] font-black uppercase border-none px-3 py-1",
                      isReturn ? "bg-rose-100 text-rose-700" :
                      isPayment ? "bg-emerald-100 text-emerald-700" :
                      isPartial ? "bg-amber-100 text-amber-700" :
                      "bg-zinc-100 text-zinc-700"
                    )}>
                      {isReturn ? "Return Transaction" : isPayment ? "Account Payment" : isPartial ? "Partial Sale" : "Sale Completed"}
                    </Badge>
                    <span className="font-mono text-[9px] text-zinc-400">#{tx.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <p className={cn("text-2xl font-black", isReturn ? "text-rose-700" : "text-zinc-900")}>
                    {isReturn ? "–" : ""}{formatCurrency(tx.total || 0)}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold mt-1">{fullDateTime}</p>
                </div>

                <ScrollArea className="max-h-[65vh]">
                  <div className="px-8 py-6 space-y-6">

                    {/* Transaction Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Cashier", value: tx.cashier_name || "—" },
                        { label: "Payment Method", value: (tx.payment_method || tx.paymentMethod || "—").toUpperCase() },
                        { label: "Branch", value: tx.branch_id || "—" },
                        { label: "Session ID", value: tx.sessionId ? `#${tx.sessionId.substring(0, 6).toUpperCase()}` : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-zinc-50 rounded-xl p-3">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{label}</p>
                          <p className="text-xs font-black text-zinc-800 truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Items Breakdown */}
                    {tx.items && tx.items.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                          Items ({tx.items.length})
                        </p>
                        <div className="space-y-2">
                          {tx.items.map((item: any, i: number) => {
                            const qty = item.quantity || item.qty || 1;
                            const price = item.price || 0;
                            const lineTotal = price * qty;
                            const hasDiscount = item.discount && item.discount.value > 0;
                            return (
                              <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                                  <p className="text-[10px] text-zinc-400 font-medium">
                                    {qty} × {formatCurrency(price)}
                                    {hasDiscount && (
                                      <span className="text-emerald-600 font-bold ml-1">
                                        (-{item.discount.type === "Percentage" ? `${item.discount.value}%` : formatCurrency(item.discount.value)})
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <span className={cn("text-sm font-black shrink-0 ml-3", isReturn ? "text-rose-600" : "text-zinc-900")}>
                                  {isReturn ? "–" : ""}{formatCurrency(lineTotal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="space-y-2 bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3">Financial Summary</p>
                      {[
                        { label: "Subtotal", value: formatCurrency(tx.subtotal || tx.total || 0) },
                        tx.discount_amount > 0 && { label: `Discount (${tx.discount?.name || "Applied"})`, value: `–${formatCurrency(tx.discount_amount || 0)}`, highlight: "text-emerald-600" },
                        { label: `Tax (${tx.tax_rate || 0}%)`, value: formatCurrency(tx.tax || 0) },
                      ].filter(Boolean).map((row: any) => (
                        <div key={row.label} className="flex justify-between items-center text-[11px] font-bold">
                          <span className="text-zinc-500">{row.label}</span>
                          <span className={row.highlight || "text-zinc-800"}>{row.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-sm font-black">
                        <span className="text-zinc-900">{isReturn ? "Gross Refund" : "Total"}</span>
                        <span className={isReturn ? "text-rose-700" : "text-zinc-900"}>
                          {isReturn ? "–" : ""}{formatCurrency(tx.total || 0)}
                        </span>
                      </div>
                      {tx.tendered_amount > 0 && !isReturn && (
                        <div className="flex justify-between items-center text-[11px] font-bold text-zinc-500">
                          <span>Tendered</span><span>{formatCurrency(tx.tendered_amount)}</span>
                        </div>
                      )}
                      {(tx.change_due || 0) > 0 && (
                        <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600">
                          <span>Change Returned</span><span>{formatCurrency(tx.change_due)}</span>
                        </div>
                      )}
                      {isPartial && (tx.balance_due || 0) > 0 && (
                        <div className="flex justify-between items-center text-[11px] font-black text-rose-600 bg-rose-50 rounded-lg p-2 mt-2">
                          <span>Outstanding Debt</span><span>{formatCurrency(tx.balance_due)}</span>
                        </div>
                      )}
                    </div>

                    {/* Balance Deduction Breakdown */}
                    {isReturn && hasDeduction && (
                      <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Account Settlement Applied</p>
                        <div className="flex justify-between text-[11px] font-bold text-rose-700">
                          <span>Gross Refund</span><span>{formatCurrency(tx.total || 0)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-rose-700">
                          <span>Account Balance Deducted</span><span>– {formatCurrency(tx.balance_deducted_from_refund || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-rose-800 pt-2 border-t border-rose-200">
                          <span>Net Payout to Customer</span><span>{formatCurrency(tx.net_refund_paid || 0)}</span>
                        </div>
                      </div>
                    )}

                    {/* Return Reference */}
                    {isReturn && tx.original_transaction_id && (
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Original Sale Reference</p>
                          <p className="font-mono text-[10px] font-black text-zinc-700 mt-0.5">
                            #{tx.original_transaction_id.substring(0, 12).toUpperCase()}
                          </p>
                        </div>
                        <Badge className="bg-rose-100 text-rose-600 border-none text-[8px] font-black">LINKED</Badge>
                      </div>
                    )}

                    {/* Full Receipt ID */}
                    <div
                      className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 cursor-pointer hover:bg-zinc-100 transition-colors group"
                      onClick={() => { navigator.clipboard.writeText(tx.id); }}
                      title="Click to copy full Receipt ID"
                    >
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                        {isReturn ? "Return Receipt ID" : "Receipt ID"} — tap to copy
                      </p>
                      <p className="font-mono text-[9px] text-zinc-600 break-all group-hover:text-blue-600 transition-colors">
                        {tx.id.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                <div className="px-8 py-4 border-t border-zinc-100 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-zinc-200 font-bold h-11"
                    onClick={() => { handleOpenDocumentHub(tx); setIsTransactionDialogOpen(false); }}
                  >
                    <FileText className="w-4 h-4 mr-2" /> Document Hub
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl bg-zinc-900 text-white font-bold h-11"
                    onClick={() => setIsTransactionDialogOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Management Dialogs */}
      {selectedCustomer && (
        <>
          {/* Edit Customer Dialog */}
          <Dialog open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Edit Profile</DialogTitle>
                <DialogDescription>Modify contact details for this customer.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex flex-col items-center gap-4 mb-2">
                  <div 
                    className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-200 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-all group cursor-pointer overflow-hidden relative"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {customerFormData.photo_url ? (
                      <img src={customerFormData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-zinc-300 group-hover:text-blue-500 transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold uppercase tracking-wider">Change Photo</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Profile Picture</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Full Name</Label>
                    <Input 
                      placeholder="Full Name" 
                      value={customerFormData.name}
                      onChange={(e) => setCustomerFormData({...customerFormData, name: e.target.value})}
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Segment</Label>
                    <Select value={customerFormData.segment} onValueChange={(v) => setCustomerFormData({...customerFormData, segment: v})}>
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Leads">Lead</SelectItem>
                        <SelectItem value="Prospects">Prospect</SelectItem>
                        <SelectItem value="Customers">Customer</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Wholesale">Wholesale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Email Address</Label>
                  <Input 
                    type="email"
                    placeholder="Email Address" 
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({...customerFormData, email: e.target.value})}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Phone Number</Label>
                  <Input 
                    placeholder="Phone" 
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({...customerFormData, phone: e.target.value})}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Address</Label>
                  <Textarea 
                    placeholder="Physical address" 
                    value={customerFormData.address}
                    onChange={(e) => setCustomerFormData({...customerFormData, address: e.target.value})}
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
              </div>
              <DialogFooter className="gap-3 sm:gap-0">
                <Button variant="outline" className="flex-1 rounded-xl h-14 font-bold" onClick={() => setIsEditCustomerOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-[2] rounded-xl bg-zinc-900 text-white h-14 font-bold"
                  onClick={handleUpdateCustomer}
                  disabled={isSubmittingCustomer}
                >
                  {isSubmittingCustomer ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Archive Confirm Dialog */}
          <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Archive Customer?</DialogTitle>
                <DialogDescription>
                  This will remove {selectedCustomer?.name} from active views. You can restore them from the archive later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-3 sm:gap-0 mt-4">
                <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setIsDeleteConfirmOpen(false)}>No, Keep</Button>
                <Button 
                  className="flex-1 rounded-xl bg-orange-600 text-white h-12 font-bold hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                  onClick={handleArchiveCustomer}
                  disabled={isSubmittingCustomer}
                >
                  {isSubmittingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4 mr-2" />}
                  Yes, Archive
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Permanent Delete Confirm Dialog */}
          <Dialog open={isPermanentDeleteOpen} onOpenChange={setIsPermanentDeleteOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-rose-600">Permanent Deletion?</DialogTitle>
                <DialogDescription>
                  This will PERMANENTLY erase <strong>{selectedCustomer?.name}</strong> and all associated records (transactions, invoices, documents). This action <strong>cannot be reversed</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Type the customer name to confirm:</p>
                <Input
                  placeholder={selectedCustomer?.name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  className="rounded-xl h-11 border-rose-200 focus:border-rose-500"
                />
                <DialogFooter className="gap-3 sm:gap-0 mt-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setIsPermanentDeleteOpen(false)}>No, Preserve</Button>
                  <Button 
                    className="flex-1 rounded-xl bg-rose-600 text-white h-12 font-bold hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                    onClick={async () => { await handleDeleteCustomer(); setIsPermanentDeleteOpen(false); setConfirmName(""); }}
                    disabled={isSubmittingCustomer || confirmName.trim() !== (selectedCustomer?.name || "").trim()}
                  >
                    {isSubmittingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Yes, Purge
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Invoice Dialog */}
          <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
            <DialogContent className="p-0 border-none bg-zinc-50 rounded-[2.5rem] sm:rounded-3xl w-full sm:max-w-[500px] h-[100dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
              <div className="bg-white px-6 py-4 border-b border-zinc-100 flex items-center sticky top-0 z-10 w-full flex-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-zinc-900 leading-none">Draft Invoice</DialogTitle>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{selectedCustomer.name}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-hide">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Reference #</label>
                    <Input 
                      placeholder="INV-001" 
                      value={invoiceData.invoiceNumber}
                      onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                      className="rounded-2xl h-12 bg-white border-zinc-200 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Ledger Status</label>
                    <Select value={invoiceData.status} onValueChange={(v) => setInvoiceData({...invoiceData, status: v})}>
                      <SelectTrigger className="rounded-2xl h-12 bg-white border-zinc-200 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="OVERDUE">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Billable Amount ($)</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400 group-focus-within:text-emerald-600 transition-colors">$</div>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00" 
                      value={invoiceData.amount}
                      onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})}
                      className="rounded-2xl h-16 pl-10 text-xl font-bold bg-white border-zinc-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Document Objective</label>
                  <Textarea 
                    placeholder="Enter billable items or service description..." 
                    value={invoiceData.description}
                    onChange={(e) => setInvoiceData({...invoiceData, description: e.target.value})}
                    className="rounded-2xl min-h-[120px] p-4 bg-white border-zinc-200 focus:ring-4 focus:ring-emerald-500/10 text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Maturity Date</label>
                  <Input 
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                    className="rounded-2xl h-12 bg-white border-zinc-200 font-medium"
                  />
                </div>
              </div>

              <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-zinc-100 flex-none px-8">
                <Button 
                  className="w-full rounded-2xl bg-emerald-600 text-white h-14 font-bold shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  onClick={handleCreateInvoice}
                  disabled={isSubmittingInvoice}
                >
                  {isSubmittingInvoice ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      <span>Generate & Secure Invoice</span>
                    </>
                  )}
                </Button>
                <p className="text-[9px] text-zinc-400 font-medium text-center mt-3 uppercase tracking-widest">Sent via Automated Finance Engine</p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Schedule Call Dialog */}
          <Dialog open={isScheduleCallOpen} onOpenChange={setIsScheduleCallOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Schedule Call</DialogTitle>
                <DialogDescription>Plan a follow-up or discovery session.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Date</Label>
                    <Input 
                      type="date"
                      value={callData.date}
                      onChange={(e) => setCallData({...callData, date: e.target.value})}
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Time</Label>
                    <Input 
                      type="time"
                      value={callData.time}
                      onChange={(e) => setCallData({...callData, time: e.target.value})}
                      className="rounded-xl h-12"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Objective</Label>
                  <Select value={callData.objective} onValueChange={(v) => setCallData({...callData, objective: v})}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Discovery">Discovery Call</SelectItem>
                      <SelectItem value="Technical Demo">Technical Demo</SelectItem>
                      <SelectItem value="Negotiation">Negotiation</SelectItem>
                      <SelectItem value="Check-in">General Check-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  className="w-full rounded-xl bg-amber-500 text-white h-14 font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                  onClick={handleScheduleCall}
                  disabled={isSubmittingCall}
                >
                  {isSubmittingCall ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5 mr-2" />}
                  Confirm Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* AI Outreach Dialog (Refined) */}
          <Dialog open={isOutreachDialogOpen} onOpenChange={setIsOutreachDialogOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-[600px]">
              <DialogHeader>
                <div className="p-3 bg-purple-50 w-fit rounded-2xl mb-2">
                  <BrainCircuit className="w-8 h-8 text-purple-600" />
                </div>
                <DialogTitle className="text-2xl font-bold">AI Personalized Outreach</DialogTitle>
                <DialogDescription>Generate and send highly relevant communications based on customer insights.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    AI Insights Context
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed italic">
                    {predictiveInsights?.recommendation}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Generated Message</Label>
                  <Textarea 
                    className="min-h-[200px] rounded-2xl border-zinc-200 bg-white shadow-inner p-5 text-sm leading-relaxed transition-all resize-none"
                    placeholder="Click the button to generate an AI outreach message..."
                    value={outreachMessage}
                    onChange={(e) => setOutreachMessage(e.target.value)}
                  />
                </div>

                <Button 
                  variant="outline" 
                  className="w-full rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50 font-bold h-12"
                  onClick={handleGenerateAIOutreach}
                  disabled={isGeneratingOutreach}
                >
                  {isGeneratingOutreach ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                  Regenerate with AI
                </Button>
              </div>
              <DialogFooter className="gap-3 sm:gap-0 border-t border-zinc-100 pt-6">
                <Button variant="ghost" className="rounded-xl h-14 font-bold flex-1" onClick={() => setIsOutreachDialogOpen(false)}>Save Draft</Button>
                <Button 
                  className="rounded-xl bg-purple-600 text-white h-14 font-bold flex-[2] shadow-lg shadow-purple-600/20 hover:bg-purple-700"
                  onClick={handleSendOutreach}
                  disabled={isSubmittingComm || !outreachMessage}
                >
                  {isSubmittingComm ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                  Send Communication
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Manage Tags Dialog (Refined) */}
          <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
            <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Manage Tags</DialogTitle>
                <DialogDescription>Organize and categorize {selectedCustomer.name}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-2xl bg-zinc-50/50 border border-zinc-100 italic text-zinc-400 text-xs">
                  {selectedCustomer.tags && selectedCustomer.tags.length > 0 ? (
                    selectedCustomer.tags.map((tag: string, i: number) => (
                      <Badge key={i} className="bg-white text-zinc-700 border-zinc-200 px-3 py-1 flex items-center gap-2 group">
                        {tag}
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, "customers", selectedCustomer.id), {
                              tags: arrayRemove(tag)
                            });
                          }}
                          className="hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  ) : "No tags assigned yet..."}
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Add New Tag</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Early Adopter" 
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      className="rounded-xl h-12"
                    />
                    <Button 
                      className="rounded-xl bg-zinc-900 text-white h-12 px-6 font-bold"
                      onClick={handleAddTag}
                      disabled={!newTag.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full rounded-xl bg-zinc-100 text-zinc-900 h-12 font-bold hover:bg-zinc-200" onClick={() => setIsTagDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Printable Report Container & Preview Modal */}
      {activePrintReport && (
        <div id="printable-report-container" className="fixed inset-0 bg-white z-[9999] overflow-auto animate-in fade-in zoom-in duration-300">
          {/* Preview Controls (Hidden during print) */}
          <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-100 p-4 flex justify-between items-center z-20 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900">Print Preview</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{activePrintReport}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl font-bold h-9" onClick={() => setActivePrintReport(null)}>
                Close Preview
              </Button>
              <Button size="sm" className="rounded-xl font-bold h-9 bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Document
              </Button>
            </div>
          </div>

          <div className="max-w-[8.5in] mx-auto p-10 sm:p-16 bg-white shadow-2xl my-8 print:my-0 print:shadow-none print:p-0">
          <div className="border-b-2 border-zinc-900 pb-6 mb-8 flex justify-between items-end">
             <div>
                <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">{activePrintReport}</h1>
                <p className="text-sm font-bold text-zinc-500 mt-2">Customer: {selectedCustomer.name}</p>
                <p className="text-[10px] font-bold text-zinc-400 mt-1">Generated: {new Date().toLocaleString()}</p>
             </div>
             <div className="text-right flex flex-col items-end">
                {branding.logo ? (
                  <img src={branding.logo} alt="Logo" className="h-12 mb-2 object-contain" />
                ) : (
                  <div className="h-12 w-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-black text-xl mb-2">
                    {branding.name?.substring(0, 1) || "O"}
                  </div>
                )}
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight">{branding.name || "ORIVO CRM-OS"}</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{branding.address || enterpriseId}</p>
             </div>
          </div>

          {/* Enhancement: Subtle Watermark */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.03] rotate-[-45deg] select-none">
             <h2 className="text-[12rem] font-black uppercase whitespace-nowrap">OFFICIAL RECORD • {branding.name}</h2>
          </div>

          {activePrintReport === "Purchase History" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6 mb-8">
                 <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Total Lifetime Spend</p>
                    <h3 className="text-2xl font-bold">{formatCurrency(selectedCustomer.spend)}</h3>
                 </div>
                 <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Transaction Count</p>
                    <h3 className="text-2xl font-bold text-blue-700">{customerTransactions.length}</h3>
                 </div>
                 <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Loyalty Balance</p>
                    <h3 className="text-2xl font-bold text-amber-700">{selectedCustomer.loyalty} Points</h3>
                 </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold text-black px-2">Date</TableHead>
                    <TableHead className="font-bold text-black px-2">Order ID</TableHead>
                    <TableHead className="font-bold text-black px-2 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerTransactions.map((tx: any, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3 px-2 border-b border-zinc-100">{new Date(tx.timestamp?.toDate?.() || tx.timestamp || Date.now()).toLocaleDateString()}</TableCell>
                      <TableCell className="py-3 px-2 border-b border-zinc-100 font-mono text-xs">{tx.id.substring(0,12).toUpperCase()}</TableCell>
                      <TableCell className="py-3 px-2 border-b border-zinc-100 text-right font-bold">{formatCurrency(tx.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {activePrintReport.startsWith("Invoice") && (
            <div className="space-y-8 mt-12">
               <div className="grid grid-cols-2 gap-20">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Billed To</p>
                     <div>
                        <h4 className="text-xl font-bold text-zinc-900">{selectedCustomer.name}</h4>
                        <p className="text-sm text-zinc-500 mt-1">{selectedCustomer.address || "No address on file"}</p>
                        <p className="text-sm text-zinc-500">{selectedCustomer.email}</p>
                        <p className="text-sm text-zinc-500">{selectedCustomer.phone}</p>
                     </div>
                  </div>
                  <div className="space-y-4 text-right">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Account Info</p>
                     <div>
                        <p className="text-sm font-bold text-zinc-900">Document ID: {activePrintReport.split(' ')[1]}</p>
                        <p className="text-sm text-zinc-500">Terms: Net 30</p>
                        <p className="text-sm text-zinc-500">Currency: USD</p>
                     </div>
                  </div>
               </div>

               <div className="mt-12 border-t-2 border-zinc-900 pt-12">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-zinc-200">
                        <TableHead className="text-black font-black text-xs uppercase px-0">Description</TableHead>
                        <TableHead className="text-black font-black text-xs uppercase text-right px-0">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       <TableRow>
                         <TableCell className="py-8 px-0">
                            <h5 className="font-bold text-zinc-900">Standard Service Payout / Itemized Sale</h5>
                            <p className="text-xs text-zinc-400 mt-1">Transaction associated with cloud verification ledger.</p>
                         </TableCell>
                         <TableCell className="py-8 px-0 text-right font-black text-xl">
                            {formatCurrency(customerInvoices.find(inv => `Invoice ${inv.invoice_number || inv.id}` === activePrintReport)?.amount || 0)}
                         </TableCell>
                       </TableRow>
                    </TableBody>
                  </Table>
               </div>

               <div className="mt-20 p-8 bg-zinc-50 rounded-3xl border border-zinc-100 flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-zinc-900 uppercase text-[10px] tracking-widest mb-1">Total Balance Due</h5>
                    <p className="text-4xl font-black text-zinc-900 tracking-tighter">
                       {formatCurrency(customerInvoices.find(inv => `Invoice ${inv.invoice_number || inv.id}` === activePrintReport)?.amount || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Payment Status</p>
                     <Badge className="bg-zinc-900 text-white border-none rounded-full px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
                        {customerInvoices.find(inv => `Invoice ${inv.invoice_number || inv.id}` === activePrintReport)?.status || "UNPAID"}
                     </Badge>
                  </div>
                </div>
             </div>
          )}

          {/* Enhancement: Digital Signature & Verification Area */}
          <div className="mt-16 pt-12 border-t border-zinc-100 grid grid-cols-2 gap-20">
             <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-8">Authorized Signature</p>
                <div className="border-b border-zinc-900 w-64 pb-2">
                   <p className="text-[10px] font-serif italic text-zinc-400">Electronically Signed via CRM-OS</p>
                </div>
                <p className="text-[9px] font-bold text-zinc-900 mt-2 uppercase tracking-tight">{branding.name}</p>
             </div>
             <div className="text-right flex flex-col items-end justify-end">
                <p className="text-[9px] text-zinc-400 max-w-[240px] leading-relaxed font-medium">
                   This document is a certified digital record of the enterprise. Any unauthorized alteration renders this document null and void.
                </p>
             </div>
          </div>
          
          <div className="fixed bottom-10 left-10 right-10 flex justify-between items-end border-t border-zinc-100 pt-6">
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest">Certified Document — 2026 Enterprise Standards</p>
                <p className="text-[9px] text-zinc-400 font-medium">Verification ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
                <p className="text-[9px] text-zinc-400 font-medium">Page 1 of 1</p>
             </div>
             <div className="flex items-center gap-4">
                <div className="text-right">
                   <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter mb-1">Secure Verification Scan</p>
                   <p className="text-[10px] font-bold text-zinc-900">{branding.email}</p>
                   <p className="text-[9px] text-zinc-500">{branding.phone || branding.officePhone}</p>
                   {/* Orivo Branding Seal */}
                   <div className="mt-2 flex items-center justify-end gap-1.5 opacity-40">
                      <div className="w-2.5 h-2.5 bg-zinc-900 rounded-sm flex items-center justify-center">
                         <div className="w-1 h-1 bg-white rounded-full" />
                      </div>
                      <p className="text-[7px] font-black text-zinc-900 uppercase tracking-[0.3em]">Secured by ORIVOCRM PRO</p>
                   </div>
                </div>
                {/* QR Code with cross-origin reliability enhancement */}
                <div className="w-20 h-20 bg-white border-2 border-zinc-900 p-1.5 rounded-xl shadow-sm">
                   <img 
                     src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=ffffff&color=000000&qzone=1&data=https://orivocrm.pro/v/${enterpriseId}/${selectedCustomer.id}`} 
                     alt="Verification QR" 
                     className="w-full h-full object-contain"
                     crossOrigin="anonymous"
                   />
                 </div>
              </div>
           </div>
          </div>
        </div>
      )}

      {/* Document Hub Dialog */}
      <Dialog open={isDocumentHubOpen} onOpenChange={setIsDocumentHubOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white flex flex-col sm:flex-row h-[95vh] sm:h-[700px]">
          {/* Left Side: High-Impact Preview */}
          <div className="w-full sm:w-[500px] bg-zinc-950 flex flex-col relative overflow-hidden group">
            {/* Ambient Background Glow */}
            <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-blue-600/10 via-transparent to-emerald-600/10 animate-pulse pointer-events-none" />
            
            <div className="flex-1 flex items-center justify-center p-6 relative z-10 overflow-hidden bg-zinc-900/40">
              {pdfPreview ? (
                <div className="relative w-full h-full shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-700 ease-out group/doc rounded-sm border-[6px] border-zinc-800/50 bg-white">
                  <iframe 
                    src={`${pdfPreview}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
                    className="w-full h-full border-none"
                    title="Receipt Preview"
                  />
                  {/* Interactive Overlay - Professional Maximize Action */}
                  <div 
                    className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all cursor-zoom-in flex flex-col items-center justify-center group/view"
                    onClick={() => {
                      const win = window.open(pdfPreview, '_blank');
                      if (win) win.focus();
                      else toast.error("Pop-up blocked. Please allow pop-ups to view PDF.");
                    }}
                  >
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full shadow-2xl opacity-0 group-hover/view:opacity-100 transform translate-y-8 group-hover/view:translate-y-0 transition-all duration-500 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Full Screen Protocol</p>
                      <ExternalLink className="w-3 h-3 text-white/60" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-500 gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Compiling Assets...</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 p-6 border-t border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Live Security Manifest</p>
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Verified by Orivo-Engine</p>
              </div>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500" />
                 <div className="w-2 h-2 rounded-full bg-zinc-700" />
                 <div className="w-2 h-2 rounded-full bg-zinc-700" />
              </div>
            </div>
          </div>
          
          {/* Right Side: Command Center */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            <div className="p-6 pb-4 border-b border-zinc-100 relative">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><FileText className="w-28 h-28" /></div>
              <h2 className="text-2xl font-black tracking-tighter mb-1 text-zinc-900">Document Hub</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Secure Document Engine</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Transaction Summary Card */}
              {documentHubTx && (() => {
                const tx = documentHubTx;
                const isReturn = tx.type === 'RETURN';
                const isPayment = tx.type === 'PAYMENT';
                const hasDeduction = (tx.balanceDeducted || 0) > 0;
                return (
                  <div className={cn(
                    "mx-6 mt-5 mb-1 rounded-2xl border p-4 space-y-3",
                    isReturn ? "bg-rose-50 border-rose-200" : isPayment ? "bg-emerald-50 border-emerald-200" : "bg-zinc-50 border-zinc-200"
                  )}>
                    <div className="flex items-center justify-between">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase border-none",
                        isReturn ? "bg-rose-100 text-rose-700" : isPayment ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                      )}>
                        {isReturn ? "Return Receipt" : isPayment ? "Payment Receipt" : "Sales Receipt"}
                      </Badge>
                      <span className="font-mono text-[9px] text-zinc-400">#{tx.id?.substring(0,8).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className={cn("text-xl font-black", isReturn ? "text-rose-700" : "text-zinc-900")}>
                        {isReturn ? "–" : ""}{formatCurrency(tx.total || 0)}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-bold mt-0.5">{tx.date}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                      {tx.cashierName && <div><span className="text-zinc-400 uppercase tracking-wider">Cashier</span><br/><span className="text-zinc-800">{tx.cashierName}</span></div>}
                      <div><span className="text-zinc-400 uppercase tracking-wider">Method</span><br/><span className="text-zinc-800">{(isReturn ? tx.refundMethod || tx.paymentMethod : tx.paymentMethod) || '—'}</span></div>
                      <div><span className="text-zinc-400 uppercase tracking-wider">Items</span><br/><span className="text-zinc-800">{(tx.items || []).length}</span></div>
                      {tx.originalTransactionId && <div><span className="text-zinc-400 uppercase tracking-wider">Orig Ref</span><br/><span className="text-zinc-800 font-mono">#{tx.originalTransactionId.substring(0,8).toUpperCase()}</span></div>}
                    </div>
                    {isReturn && hasDeduction && (
                      <div className="pt-2 border-t border-rose-200 space-y-1">
                        <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Account Settlement</p>
                        <div className="flex justify-between text-[9px] font-bold text-rose-700"><span>Gross Refund</span><span>{formatCurrency(tx.total)}</span></div>
                        <div className="flex justify-between text-[9px] font-bold text-rose-700"><span>Balance Deducted</span><span>– {formatCurrency(tx.balanceDeducted)}</span></div>
                        <div className="flex justify-between text-[10px] font-black text-rose-800 pt-1 border-t border-rose-200"><span>Net Payout</span><span>{formatCurrency(tx.netRefundPaid)}</span></div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="p-6 space-y-5">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Hardware Outputs</p>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      className="w-full h-20 rounded-[1.5rem] border-2 border-zinc-100 bg-white flex items-center justify-start gap-5 px-6 hover:border-blue-500 hover:bg-blue-50 group transition-all shadow-sm"
                      onClick={handlePrintPDF}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-base text-zinc-900">Professional A4 PDF</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Office Printers / Digital Archive</p>
                      </div>
                    </Button>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        className="w-full h-20 rounded-[1.5rem] border-2 border-zinc-100 bg-white flex items-center justify-start gap-5 px-6 hover:border-emerald-500 hover:bg-emerald-50 group transition-all shadow-sm"
                        onClick={handlePrintThermal}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <Printer className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-black text-base text-zinc-900">Thermal Receipt</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Point of Sale Printers</p>
                        </div>
                      </Button>
                      <div className="flex items-center justify-between px-3 bg-zinc-50 rounded-2xl py-3 border border-zinc-100">
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Paper Size</span>
                        <div className="flex gap-1">
                          {['80mm', '58mm'].map((size) => (
                            <button
                              key={size}
                              onClick={() => setThermalSize(size as any)}
                              className={cn(
                                "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all",
                                thermalSize === size ? "bg-zinc-900 text-white shadow-lg" : "bg-white text-zinc-400 hover:text-zinc-600"
                              )}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Digital Distribution</p>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      className="w-full h-20 rounded-[1.5rem] bg-[#25D366] hover:bg-[#128C7E] text-white font-bold flex items-center justify-start gap-5 px-6 shadow-lg shadow-emerald-500/20"
                      onClick={handleShareWhatsApp}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-base">WhatsApp Share</p>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter">Direct Social Outreach</p>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-20 rounded-[1.5rem] border-2 border-zinc-100 bg-white text-zinc-900 font-bold flex items-center justify-start gap-5 px-6 shadow-sm hover:border-zinc-300 transition-all"
                      onClick={handleShareEmail}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                        <Send className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-base">Email Digital Copy</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Official Corporate File</p>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>{/* end overflow-y-auto */}
            
            <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex items-center justify-between px-8">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <p className="text-[9px] font-black text-zinc-900 uppercase tracking-[0.2em]">OrivoCRM.pro Official</p>
              </div>
              <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest">SECURE_ENGINE_V2.6</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    {/* Manage Tags Dialog (Portal-Safe Sibling) */}
    <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
      <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Manage Tags</DialogTitle>
          <DialogDescription>Organize and categorize {selectedCustomer?.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-2xl bg-zinc-50/50 border border-zinc-100 italic text-zinc-400 text-xs">
            {selectedCustomer?.tags && selectedCustomer.tags.length > 0 ? (
              selectedCustomer.tags.map((tag: string, i: number) => (
                <Badge key={i} className="bg-white text-zinc-700 border-zinc-200 px-3 py-1 flex items-center gap-2 group">
                  {tag}
                  <button 
                    onClick={async () => {
                      await updateDoc(doc(db, "customers", selectedCustomer.id), {
                        tags: arrayRemove(tag)
                      });
                    }}
                    className="hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            ) : "No tags assigned yet..."}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">New Tag Entry</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Tag name..." 
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button onClick={handleAddTag} className="rounded-xl bg-zinc-900 text-white font-bold">Add</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Personalized Offer Dialog (Portal-Safe Sibling) */}
    <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
      <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Generate Personalized Offer</DialogTitle>
          <DialogDescription>Create a custom incentive for {selectedCustomer?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input 
            placeholder="Offer details (e.g. 20% off next purchase)" 
            value={offerDetails}
            onChange={(e) => setOfferDetails(e.target.value)}
            className="rounded-xl h-12"
          />
        </div>
        <DialogFooter>
          <Button className="w-full rounded-xl bg-emerald-600 text-white h-14 font-bold shadow-lg shadow-emerald-600/20" onClick={handleGenerateOffer}>
            Distribute Custom Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
    </div>
    </div>
  );
}
