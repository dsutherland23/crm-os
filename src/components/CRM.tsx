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
  X as XIcon,
  Camera,
  Crown
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
import { Button } from "@/components/ui/button";
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

import { db, auth, handleFirestoreError, OperationType, collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, where, addDoc, serverTimestamp, deleteDoc } from "@/lib/firebase";

export default function CRM() {
  const { activeBranch, formatCurrency, topSpenderThreshold, enterpriseId } = useModules();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("All");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [customerDocuments, setCustomerDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [newComm, setNewComm] = useState("");
  const [commType, setCommType] = useState("Email");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSubmittingComm, setIsSubmittingComm] = useState(false);

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

  // New Management State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Photo exceeds 10MB limit");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setCustomerFormData({ ...customerFormData, photo_url: compressedDataUrl });
          toast.success("Photo optimized and attached");
        };
      };
      reader.readAsDataURL(file);
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
    if (!customerFormData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerFormData.email)) {
      toast.error("A valid email address is required");
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
    setIsSubmittingCustomer(true);
    try {
      await deleteDoc(doc(db, "customers", selectedCustomer.id));
      toast.success("Customer deleted");
      setIsDeleteConfirmOpen(false);
      setSelectedCustomer(null);
      setShowDetailOnMobile(false);
    } catch (error) {
      console.error(error);
      toast.error("Delete failed — please try again");
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
    setActiveTab("overview"); // Reset tab context when switching customers
  };

  useEffect(() => {
    if (!enterpriseId) return;
    const q = query(
      collection(db, "customers"), 
      where("enterprise_id", "==", enterpriseId),
      where("status", "!=", "Archived"),
      orderBy("status"),
      orderBy("name", "asc")
    );
    const path = "customers";
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(docs);
      if (docs.length > 0 && !selectedCustomer) {
        setSelectedCustomer(docs[0]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [enterpriseId]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail === "ADD_CUSTOMER") {
        setIsAddCustomerOpen(true);
      }
    };
    window.addEventListener("app:action", handleAction);
    return () => window.removeEventListener("app:action", handleAction);
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    const q = query(
      collection(db, "transactions"), 
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id)
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
      where("customer_id", "==", selectedCustomer.id)
    );
    const unsubscribeInv = onSnapshot(qInv, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCustomerInvoices(invs);
    }, (error) => {
      console.error("Error fetching customer invoices:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeInv();
    };
  }, [selectedCustomer, enterpriseId]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const q = query(
      collection(db, "documents"),
      where("enterprise_id", "==", enterpriseId),
      where("customer_id", "==", selectedCustomer.id)
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
    
    let propensity = "Medium (50%)";
    let propensityColor = "text-amber-600 border-amber-100";
    let propensityText = "Average likelihood to buy";
    
    if (totalSpent > 1000 && daysSinceLastPurchase < 30) {
      propensity = "High (88%)";
      propensityColor = "text-emerald-600 border-emerald-100";
      propensityText = "Likely to buy in next 7 days";
    } else if (daysSinceLastPurchase > 90) {
      propensity = "Low (12%)";
      propensityColor = "text-rose-600 border-rose-100";
      propensityText = "Needs re-engagement";
    }

    let churnRisk = "Low (4%)";
    let churnColor = "text-emerald-600 border-emerald-100";
    let churnText = "Stable engagement";
    
    if (daysSinceLastPurchase > 120) {
      churnRisk = "High (85%)";
      churnColor = "text-rose-600 border-rose-100";
      churnText = "At risk of churning";
    } else if (daysSinceLastPurchase > 60) {
      churnRisk = "Medium (45%)";
      churnColor = "text-amber-600 border-amber-100";
      churnText = "Engagement dropping";
    }

    let recommendation = `Customer shows consistent engagement. AI suggests maintaining regular communication.`;
    if (selectedCustomer.segment === "VIP") {
      recommendation = `Customer is a VIP. AI suggests offering a private demo of new premium products.`;
    } else if (daysSinceLastPurchase > 90) {
      recommendation = `Customer hasn't purchased recently. AI suggests sending a 15% win-back discount.`;
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
      activities.push({
        type: comm.type.toUpperCase(),
        title: comm.content.substring(0, 30) + "...",
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

  const filteredCustomers = useMemo(() => customers.filter(c => {
    const name = (c.name || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    const phone = (c.phone || "");
    const term = searchTerm.toLowerCase();

    const matchesSearch = !term ||
      name.includes(term) ||
      email.includes(term) ||
      phone.includes(term);

    let matchesSegment = true;
    const segment = selectedSegment.toUpperCase();

    if (segment === "ALL") matchesSegment = true;
    else if (segment === "CUSTOMERS") matchesSegment = c.segment !== "LEAD" && c.segment !== "Leads";
    else if (segment === "LEADS") matchesSegment = c.segment === "LEAD" || c.segment === "Leads";
    else if (segment === "VIP") matchesSegment = c.segment === "VIP";
    else if (segment === "PROSPECTS") matchesSegment = c.segment === "Prospects" || (Number(c.total_spent || c.spend || 0) === 0);
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
  }), [customers, searchTerm, selectedSegment]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomer) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading "${file.name}"...`);

    try {
      const { getStorage, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp } = await import("@/lib/firebase");
      
      const storage = getStorage();
      const storageRef = ref(storage, `customers/${selectedCustomer.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "documents"), {
        customer_id: selectedCustomer.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: url,
        path: storageRef.path,
        uploadedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        author: auth.currentUser?.displayName || "System"
      });

      toast.success(`Successfully uploaded ${file.name}`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Upload failed", { id: toastId });
    } finally {
      setIsUploading(false);
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
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      
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

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      
      setAiSummary(response.text);
      toast.success("Profile summary generated");
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("Failed to generate AI summary");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleArchiveCustomer = async () => {
    if (!selectedCustomer) return;
    setIsSubmittingCustomer(true);
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(customerRef, {
        status: "Archived",
        archivedAt: new Date().toISOString()
      });
      toast.success("Customer archived successfully");
      setIsDeleteConfirmOpen(false);
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
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      
      const prompt = `Write a professional and friendly personalized outreach email for a customer.
      Customer Name: ${selectedCustomer.name}
      Segment: ${selectedCustomer.segment}
      Recent Activity: Spent $${selectedCustomer.spend || 0} total.
      Insights: ${predictiveInsights?.recommendation}
      
      The email should be concise, helpful, and encourage them to connect or check out our latest offers.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setOutreachMessage(response.text || "");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate outreach");
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

  const handleCreateInvoice = async () => {
    if (!selectedCustomer) return;

    // Validation
    if (!invoiceData.invoiceNumber || invoiceData.invoiceNumber.trim() === "") {
      toast.error("Please provide an invoice number");
      return;
    }

    const amountStr = String(invoiceData.amount).trim();
    const amountVal = parseFloat(amountStr);
    
    // Currency format validation (optional strict: ^\d+(\.\d{1,2})?$)
    if (!amountStr || isNaN(amountVal) || amountVal <= 0 || !/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      toast.error("Please enter a valid currency amount (e.g., 150.00)");
      return;
    }

    if (!invoiceData.description || invoiceData.description.trim().length < 3) {
      toast.error("Please provide a valid description for the invoice");
      return;
    }

    // Date format validation (YYYY-MM-DD)
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

    // Ensure due date isn't arbitrarily in the past (e.g., year 2000) - simple check
    if (dueDateObj.getFullYear() < 2000) {
      toast.error("Please enter a realistic due date");
      return;
    }

    const formattedAmount = Number(amountVal.toFixed(2));

    setIsSubmittingInvoice(true);
    try {
      const { addDoc, collection, serverTimestamp } = await import("@/lib/firebase");
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
        branch_id: activeBranch?.id || "main"
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
    setIsSubmittingCall(true);
    try {
      const content = `Scheduled Call: ${callData.objective} on ${callData.date} at ${callData.time}`;
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
      await updateDoc(doc(db, "customers", selectedCustomer.id), {
        communications: arrayUnion({
          id: Date.now().toString(),
          type: "Call",
          content,
          author: auth.currentUser?.displayName || "System",
          timestamp: new Date().toISOString()
        })
      });
      toast.success("Call scheduled and logged");
      setIsScheduleCallOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to schedule call");
    } finally {
      setIsSubmittingCall(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedCustomer) return;
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      await updateDoc(customerRef, {
        tags: arrayUnion(newTag.trim())
      });
      toast.success("Tag added successfully");
      setNewTag("");
      setIsTagDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add tag");
    }
  };

  const handleGenerateOffer = async () => {
    if (!offerDetails.trim() || !selectedCustomer) return;
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const commObj = {
        id: Date.now().toString(),
        type: "Offer",
        content: offerDetails,
        author: "AI Copilot",
        timestamp: new Date().toISOString()
      };
      await updateDoc(customerRef, {
        communications: arrayUnion(commObj)
      });
      toast.success("Personalized offer generated and saved to communications");
      setOfferDetails("");
      setIsOfferDialogOpen(false);
    } catch (error) {
      toast.error("Failed to generate offer");
    }
  };

  const handleFollowUp = async () => {
    if (!outreachMessage.trim() || !selectedCustomer) return;
    try {
      const customerRef = doc(db, "customers", selectedCustomer.id);
      const commObj = {
        id: Date.now().toString(),
        type: "Email",
        content: outreachMessage,
        author: "AI Outreach",
        timestamp: new Date().toISOString()
      };
      await updateDoc(customerRef, {
        communications: arrayUnion(commObj)
      });
      toast.success(`AI Follow-up email scheduled for ${selectedCustomer.name}`);
      setOutreachMessage("");
      setIsOutreachDialogOpen(false);
    } catch (error) {
      toast.error("Failed to schedule outreach");
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

  const AddCustomerDialog = (
    <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
      <DialogContent showCloseButton={false} className="rounded-3xl border-zinc-200 w-[95vw] max-w-5xl sm:max-w-4xl md:max-w-4xl lg:max-w-5xl max-h-[96vh] sm:max-h-[90vh] p-0 shadow-2xl flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
        <DialogHeader className="px-6 py-4 sm:px-8 sm:py-6 border-b border-zinc-100 flex flex-row items-center justify-between sticky top-0 bg-white z-10 w-full relative flex-none">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-zinc-900" />
            <DialogTitle className="text-xl font-bold text-zinc-900">Add New Customer</DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsAddCustomerOpen(false)} className="rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 absolute right-4 top-4">
            <XIcon className="w-5 h-5" />
          </Button>
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
                      onChange={(e) => setCustomerFormData({...customerFormData, customer_type: e.target.value})}
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
                    <Label className="text-sm font-medium text-zinc-900">Last Name *"</Label>
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
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-900">Credit Limit ($)</Label>
                <Input 
                  type="number"
                  value={customerFormData.credit_limit}
                  onChange={(e) => setCustomerFormData({...customerFormData, credit_limit: Number(e.target.value)})}
                  className="rounded-xl h-12 border-zinc-200 focus:border-blue-500"
                />
              </div>
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

        <DialogFooter className="px-6 py-4 sm:px-8 sm:py-5 bg-white border-t border-zinc-100 flex flex-row gap-3 sm:gap-4 flex-none">
          <Button 
            className="flex-1 rounded-xl bg-[#2C2D33] text-white hover:bg-[#1E1F24] h-12 font-medium" 
            onClick={handleCreateCustomer}
            disabled={isSubmittingCustomer}
          >
            {isSubmittingCustomer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Customer
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 rounded-xl border-zinc-200 h-12 font-medium text-zinc-900 hover:bg-zinc-50" 
            onClick={() => setIsAddCustomerOpen(false)}
          >
            Cancel
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
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {["All", "Customers", "Leads", "VIP", "At Risk", "Prospects", "Inactive"].map(seg => (
              <Badge 
                key={seg} 
                variant="secondary" 
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0",
                  selectedSegment === seg ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
                onClick={() => setSelectedSegment(seg)}
              >
                {seg}
              </Badge>
            ))}
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-200" onClick={(e) => { e.stopPropagation(); toast.success("Drafting Invoice..."); }}>
                          <FileText className="w-3.5 h-3.5 text-zinc-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-200" onClick={(e) => { e.stopPropagation(); toast.success("Opening Messenger..."); }}>
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
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="rounded-xl border-zinc-200 h-12 px-6 font-bold text-xs bg-white shadow-sm hover:bg-zinc-50 transition-all">
                      <MoreHorizontal className="w-4 h-4 mr-2" />
                      Actions
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-zinc-200 p-2 shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-2">Profile Management</DropdownMenuLabel>
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
                        address: selectedCustomer.address || ""
                      });
                      setIsEditCustomerOpen(true);
                    }}>
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-4 h-4" /></div>
                      <span className="font-bold text-xs text-zinc-700">Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsInvoiceDialogOpen(true)}>
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><FileText className="w-4 h-4" /></div>
                      <span className="font-bold text-xs text-zinc-700">Create Invoice</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsScheduleCallOpen(true)}>
                      <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Calendar className="w-4 h-4" /></div>
                      <span className="font-bold text-xs text-zinc-700">Schedule Call</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  
                  <DropdownMenuSeparator className="my-2 bg-zinc-100" />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 py-2">Marketing</DropdownMenuLabel>
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsOutreachDialogOpen(true)}>
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Sparkles className="w-4 h-4" /></div>
                      <span className="font-bold text-xs text-zinc-700">AI Outreach</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3" onClick={() => setIsTagDialogOpen(true)}>
                      <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600"><Tag className="w-4 h-4" /></div>
                      <span className="font-bold text-xs text-zinc-700">Manage Tags</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator className="my-2 bg-zinc-100" />
                  
                  <DropdownMenuItem className="rounded-xl py-3 px-3 cursor-pointer flex items-center gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => {
                    setIsDeleteConfirmOpen(true);
                  }}>
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><Trash2 className="w-4 h-4" /></div>
                    <span className="font-bold text-xs">Archive Customer</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

                <Button onClick={() => setIsOutreachDialogOpen(true)} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/20 h-10 px-6 sm:h-12 sm:px-8 font-bold text-xs shrink-0">
                  <Send className="w-4 h-4 mr-2" />
                  AI Outreach
                </Button>
              </div>
            </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lifetime Value</p>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(selectedCustomer.spend)}</h3>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold">+12%</Badge>
                <span className="text-[10px] text-zinc-400 font-medium">vs avg</span>
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
            <Card className="card-modern p-6 space-y-2 group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Account Balance</p>
                <CreditCard className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className={cn("text-2xl font-bold", selectedCustomer.balance > 0 ? "text-rose-600" : "text-zinc-900")}>
                {formatCurrency(selectedCustomer.balance)}
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium">{selectedCustomer.balance > 0 ? "Outstanding Payment" : "No debt"}</p>
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
              <TabsList className="bg-zinc-100 p-1 rounded-xl w-max flex gap-1">
                <TabsTrigger value="overview" className="rounded-lg px-8 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Overview</TabsTrigger>
                <TabsTrigger value="invoices" className="rounded-lg px-8 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Invoices</TabsTrigger>
                <TabsTrigger value="communication" className="rounded-lg px-8 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Communication</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-lg px-8 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Internal Notes</TabsTrigger>
                <TabsTrigger value="files" className="rounded-lg px-8 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0">Files</TabsTrigger>
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
                        <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
                          <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Generate Personalized Offer</DialogTitle>
                              <DialogDescription>Create a custom offer for {selectedCustomer.name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Textarea 
                                placeholder="Describe the offer details..." 
                                value={offerDetails}
                                onChange={(e) => setOfferDetails(e.target.value)}
                                className="min-h-[100px] rounded-xl"
                              />
                            </div>
                            <DialogFooter>
                              <Button className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700 h-12 font-bold" onClick={handleGenerateOffer}>
                                Generate & Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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
                        <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
                          <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Custom Tag</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Input 
                                placeholder="Enter tag name..." 
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                className="rounded-xl h-11"
                              />
                            </div>
                            <DialogFooter>
                              <Button className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" onClick={handleAddTag}>
                                Add Tag
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100">
                            <FileText className="w-4 h-4" />
                          </Button>
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
            <TabsContent value="files">
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
                    <label htmlFor="dropzone-file" className={cn(
                      "flex flex-col items-center justify-center w-full h-44 border-2 border-zinc-100 border-dashed rounded-[2rem] cursor-pointer bg-zinc-50/30 hover:bg-zinc-50 transition-all",
                      isUploading && "opacity-50 pointer-events-none"
                    )}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center mb-4">
                          <Plus className="w-6 h-6 text-zinc-400" />
                        </div>
                        <p className="mb-1 text-sm font-black text-zinc-600">Click to upload or drag and drop</p>
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
                               render={
                                 <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                   <Plus className="w-4 h-4 text-zinc-900 rotate-45" />
                                 </a>
                               }
                             />
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
          </Tabs>
        </div>
      </ScrollArea>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-3xl border-zinc-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Order ID: {selectedTransaction?.id}</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-500">Date</span>
                <span className="text-sm font-bold text-zinc-900">
                  {selectedTransaction.timestamp?.toDate ? selectedTransaction.timestamp.toDate().toLocaleString() : new Date(selectedTransaction.timestamp || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-500">Total Amount</span>
                <span className="text-sm font-bold text-zinc-900">{formatCurrency(selectedTransaction.total || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-500">Status</span>
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase">Completed</Badge>
              </div>
              <div className="space-y-2 mt-4">
                <span className="text-sm font-bold text-zinc-500">Items</span>
                <div className="space-y-2">
                  {selectedTransaction.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-900">{item.name}</span>
                        <span className="text-xs text-zinc-500">Qty: {item.quantity}</span>
                      </div>
                      <span className="text-sm font-bold text-zinc-900">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" onClick={() => setIsTransactionDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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

          {/* Create Invoice Dialog */}
          <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
            <DialogContent showCloseButton={false} className="p-0 border-none bg-zinc-50 rounded-[2.5rem] sm:rounded-3xl w-full sm:max-w-[500px] h-[100dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
              <div className="bg-white px-6 py-4 border-b border-zinc-100 flex items-center justify-between flex-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-zinc-900 leading-none">Draft Invoice</DialogTitle>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{selectedCustomer.name}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsInvoiceDialogOpen(false)} className="rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100">
                  <XIcon className="w-5 h-5" />
                </Button>
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
                            const { updateDoc, doc, arrayRemove } = await import("@/lib/firebase");
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

      </div>
      </div>
    </div>
  );
}
