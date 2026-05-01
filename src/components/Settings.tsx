import React, { useState, useEffect, useRef } from "react";
import { PLAN_LIMITS } from "@/constants/plan-limits";
import { 
  Settings as SettingsIcon, 
  Shield, 
  Building, 
  Palette, 
  ToggleLeft, 
  Bell,
  Database,
  Globe,
  Coins,
  Lock,
  Zap,
  Cpu,
  Sparkles,
  Layout,
  Users,
  Key,
  Smartphone,
  Mail,
  Phone,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit3,
  ShieldCheck,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Camera,
  Facebook,
  Instagram,
  Twitter,
  UserCheck,
  Info,
  Image as ImageIcon,
  Percent,
  RefreshCw,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  History,
  Copy,
  ExternalLink,
  CheckCircle,
  FileUp,
  Landmark,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useModules } from "@/context/ModuleContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";


import { collection, onSnapshot, doc, setDoc, getDocs, writeBatch, addDoc, deleteDoc, query, where, serverTimestamp } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { recordAuditLog } from "@/lib/audit";

import CommissionPartners from "./CommissionPartners";
import StaffManager from "./StaffManager";
import PricingCard from "@/components/ui/pricing-card";

const JAMAICA_PARISHES = [
  "Kingston", "St. Andrew", "St. Thomas", "Portland", "St. Mary", "St. Ann", 
  "Trelawny", "St. James", "Hanover", "Westmoreland", "St. Elizabeth", 
  "Manchester", "Clarendon", "St. Catherine"
];

import { ScrollArea } from "@/components/ui/scroll-area";
import AuditLogs from "./AuditLogs";

export default function Settings({ defaultTab = "modules" }: { defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const { 
    config, 
    toggleModule, 
    topSpenderThreshold, 
    setTopSpenderThreshold, 
    currency, 
    setCurrency, 
    theme, 
    setTheme, 
    branding, 
    setBranding, 
    enterpriseId,
    billing,
    taxRate,
    setTaxRate,
    checkLimit,
    hasPermission
  } = useModules();
  // Ref used to prevent onSnapshot from clobbering in-progress form edits
  const isEditingSettings = React.useRef(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [enterpriseName, setEnterpriseName] = useState(branding.name || "");
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setIsPaymentSuccessOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Logo = reader.result as string;
        setBranding({ logo: base64Logo });
        
        // Auto-save to cloud if enterpriseId exists
        if (enterpriseId) {
          try {
            await setDoc(doc(db, "enterprise_settings", enterpriseId), {
              branding: { ...branding, logo: base64Logo }
            }, { merge: true });
            toast.success("Identity asset synchronized to cloud.");
          } catch (err) {
            console.error("Failed to sync logo:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const [isGeneratingDisclaimer, setIsGeneratingDisclaimer] = useState(false);

  const generateDisclaimerWithAI = () => {
    setIsGeneratingDisclaimer(true);
    setTimeout(() => {
      const enterprise = branding.name || "this enterprise";
      const templates = [
        `All sales made by ${enterprise} are final. Items must be returned in original packaging within 14 days for store credit. This document serves as an official proof of purchase. Liability is limited to the purchase price of the goods.`,
        `By transacting with ${enterprise}, you agree to our terms of service. Warranty claims are subject to manufacturer verification. ${enterprise} is not liable for indirect or consequential damages resulting from product use or service interruption.`,
        `Thank you for choosing ${enterprise}. Information on this receipt/invoice is for administrative purposes only. Quotations are valid for 30 days. Authorized signature required for all long-form enterprise agreements.`,
        `${enterprise} complies with all local tax and trade regulations. Goods remains the property of the seller until full payment is received. Disputes shall be resolved under the jurisdiction of the corporate headquarters address.`
      ];
      const random = templates[Math.floor(Math.random() * templates.length)];
      setBranding({ disclaimer: random });
      setIsGeneratingDisclaimer(false);
      toast.success("Template applied. Review and edit before saving.");
    }, 600);
  };
  const [branches, setBranches] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isEditBranchDialogOpen, setIsEditBranchDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", address: "", parish: "", contactInfo: "", manager: "", status: "ACTIVE" });
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", tier: "tier1", users: 0, permissions: {} as Record<string, any> });
  
  const getTierInfo = (tier?: string) => {
    switch(tier) {
      case 'tier1': return { label: 'Operational (Tier 1)', color: 'text-blue-600 bg-blue-50 border-blue-100' };
      case 'tier2': return { label: 'Tactical (Tier 2)', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
      case 'tier3': return { label: 'Strategic (Tier 3)', color: 'text-amber-600 bg-amber-50 border-amber-100' };
      case 'tier4': return { label: 'Full Root (Tier 4)', color: 'text-rose-600 bg-rose-50 border-rose-100' };
      default: return { label: 'Standard Access', color: 'text-zinc-600 bg-zinc-50 border-zinc-100' };
    }
  }
  const [editingRole, setEditingRole] = useState<any>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isKeysDialogOpen, setIsKeysDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_TEST_API_KEY || "sk_test_1234567890abcdef1234567890abcdef");
  const [commissionPin, setCommissionPin] = useState("1234");
  const [isCommissionPinDialogOpen, setIsCommissionPinDialogOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [autoCloseTime, setAutoCloseTime] = useState("17:00");
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(true);
  const [breakDuration, setBreakDuration] = useState("15");
  const [lunchDuration, setLunchDuration] = useState("30");
  const [gracePeriod, setGracePeriod] = useState("10");

  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [auditLogRetention, setAuditLogRetention] = useState("90");
  const [is2FALoading, setIs2FALoading] = useState(false);


  const handleGenerateKey = async () => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Insufficient permissions to rotate API keys.');
      return;
    }
    const newKey = 'sk_prod_' + Math.random().toString(36).substring(2, 15).toUpperCase() + Math.random().toString(36).substring(2, 15).toUpperCase();
    const loadingToast = toast.loading('Rotating API key...');
    try {
      await setDoc(doc(db, 'enterprise_settings', enterpriseId), { apiKey: newKey }, { merge: true });
      await recordAuditLog({
        enterpriseId,
        action: 'API_KEY_ROTATED',
        details: 'A new production API key was generated and persisted.',
        severity: 'WARNING',
        type: 'SECURITY'
      });
      setApiKey(newKey);
      toast.success('API key rotated and saved.', { id: loadingToast, description: 'Store this key securely — it will not be shown again.' });
    } catch (err: any) {
      toast.error('Failed to save new API key: ' + err.message, { id: loadingToast });
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can change 2FA settings.');
      return;
    }
    setIs2FALoading(true);
    const loadingToast = toast.loading(`${enabled ? 'Enabling' : 'Disabling'} Two-Factor Authentication...`);
    try {
      await setDoc(doc(db, 'enterprise_settings', enterpriseId), {
        twoFactorEnabled: enabled,
        securityUpdated: serverTimestamp()
      }, { merge: true });
      setIsTwoFactorEnabled(enabled);
      await recordAuditLog({
        enterpriseId,
        action: enabled ? '2FA_ENABLED' : '2FA_DISABLED',
        details: `Two-Factor Authentication has been ${enabled ? 'activated' : 'deactivated'}.`,
        severity: 'CRITICAL',
        type: 'SECURITY'
      });
      toast.success(`2FA is now ${enabled ? 'active' : 'inactive'}.`, { id: loadingToast });
    } catch (err: any) {
      toast.error('Security update failed: ' + err.message, { id: loadingToast });
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleSavePin = async () => {
    if (currentPinInput !== commissionPin) {
      toast.error("Current PIN is incorrect.");
      return;
    }
    if (newPinInput.length !== 4) {
      toast.error("New PIN must be exactly 4 digits.");
      return;
    }
    try {
      await setDoc(doc(db, "enterprise_settings", enterpriseId), { commissionPin: newPinInput }, { merge: true });
      setCommissionPin(newPinInput);
      setIsCommissionPinDialogOpen(false);
      setCurrentPinInput("");
      setNewPinInput("");
      
      await recordAuditLog({
        enterpriseId,
        action: "PIN_UPDATED",
        details: "Commission Partner access PIN has been changed.",
        severity: "WARNING",
        type: "SECURITY"
      });

      toast.success("Commission PIN updated securely.");
    } catch (error: any) {
      toast.error("Failed to update PIN: " + error.message);
    }
  };

  const handleSaveBranding = async () => {
    if (!enterpriseId) return;
    
    const loadingToast = toast.loading("Synchronizing Identity Profile...");
    try {
      await setDoc(doc(db, "enterprise_settings", enterpriseId), {
        branding: {
          ...branding,
          enterprise_id: enterpriseId,
          updatedAt: serverTimestamp()
        },
        enterpriseName: branding.name // Legacy sync for components still using root field
      }, { merge: true });
      
      toast.success("Identity Profile Synchronized", {
        id: loadingToast,
        description: "Your branding assets have been committed to the secure edge network.",
        duration: 4000
      });
    } catch (error: any) {
      toast.error("Synchronization failed: " + error.message, { id: loadingToast });
    }
  };

  const toggleBranchStatus = async (branchId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await setDoc(doc(db, "branches", branchId), { status: newStatus }, { merge: true });
      toast.success(`Branch ${newStatus.toLowerCase()} successfully.`);
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
  };

  const handleResetData = async () => {
    if (!enterpriseId) return;
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can execute a factory reset.');
      setIsResetDialogOpen(false);
      return;
    }
    setIsResetDialogOpen(false);
    
    const collectionsToWipe = [
      "invoices", "expenses", "quotes", "recurring_billing",
      "transactions", "pos_sessions", "audit_logs",
      "customers", "products", "inventory", "interactions",
      "branches", "roles", "staff", "campaigns"
    ];

    const loadingToast = toast.loading("Executing enterprise-wide data purge...", {
      description: "Deleting records across all modules. This may take a moment."
    });

    try {
      // We process each collection to find and delete docs matching this enterprise
      for (const colName of collectionsToWipe) {
        const q = query(collection(db, colName), where("enterprise_id", "==", enterpriseId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          // Batch has a limit of 500 operations
          const chunks = [];
          for (let i = 0; i < snapshot.docs.length; i += 500) {
            chunks.push(snapshot.docs.slice(i, i + 500));
          }
          
          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
          }
        }
      }

      toast.success("Enterprise data wiped successfully.", {
        id: loadingToast,
        description: "Your workspace has been returned to factory settings."
      });

      await recordAuditLog({
        enterpriseId,
        action: "FACTORY_RESET",
        details: "A complete enterprise-wide data purge was executed. All module records were destroyed.",
        severity: "CRITICAL",
        type: "SYSTEM"
      });

      // Force a reload to clear all local state and caches
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);

    } catch (error: any) {
      console.error("Purge failed:", error);
      toast.error("Wipe failed: " + error.message, { id: loadingToast });
    }
  };

  const handleAddRole = async () => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can provision roles.');
      return;
    }
    if (!newRole.name) {
      toast.error('Please fill in role name.');
      return;
    }
    try {
      const tierMap: Record<string, any> = {
        tier1: { crm: "viewer", pos: "editor", inventory: "none", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "none" },
        tier2: { crm: "editor", pos: "admin", inventory: "editor", finance: "none", analytics: "viewer", workflow: "editor", ai: "none", audit_logs: "none" },
        tier3: { crm: "admin", pos: "admin", inventory: "admin", finance: "editor", analytics: "editor", workflow: "admin", ai: "editor", audit_logs: "viewer" },
        tier4: { crm: "admin", pos: "admin", inventory: "admin", finance: "admin", analytics: "admin", workflow: "admin", ai: "admin", audit_logs: "admin", settings: "admin" }
      };

      const basePermissions = tierMap[newRole.tier as string] || tierMap.tier1;
      const roleData = {
        ...newRole,
        permissions: { ...basePermissions, ...newRole.permissions },
        enterprise_id: enterpriseId,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "roles"), roleData);
      setIsRoleDialogOpen(false);
      setNewRole({ name: "", tier: "tier1", users: 0, permissions: {} });
      toast.success("Role added with tier-based permissions!");
    } catch (error: any) {
      toast.error("Failed to add role: " + error.message);
    }
  };

  const handleSeedDefaultRoles = async () => {
    if (!enterpriseId) return;
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can seed system roles.');
      return;
    }
    const loadingToast = toast.loading('Seeding enterprise-grade roles...');
    try {
      const defaultRoles = [
        { name: "Executive", tier: "tier4", permissions: { crm: "admin", pos: "admin", inventory: "admin", finance: "admin", analytics: "admin", workflow: "admin", ai: "admin", audit_logs: "admin", settings: "admin" } },
        { name: "Business Admin", tier: "tier3", permissions: { crm: "admin", pos: "admin", inventory: "admin", finance: "editor", analytics: "editor", workflow: "admin", ai: "editor", audit_logs: "viewer" } },
        { name: "Manager", tier: "tier3", permissions: { crm: "admin", pos: "admin", inventory: "admin", finance: "editor", analytics: "editor", workflow: "admin", ai: "editor", audit_logs: "viewer" } },
        { name: "Supervisor", tier: "tier2", permissions: { crm: "editor", pos: "admin", inventory: "editor", finance: "none", analytics: "viewer", workflow: "editor", ai: "none", audit_logs: "none" } },
        { name: "Cashier", tier: "tier1", permissions: { crm: "viewer", pos: "editor", inventory: "none", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "none" } },
        { name: "Sales Rep", tier: "tier1", permissions: { crm: "editor", pos: "editor", inventory: "none", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "none" } },
        { name: "Technician", tier: "tier1", permissions: { crm: "viewer", pos: "editor", inventory: "editor", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "none" } },
        { name: "Customer Support", tier: "tier1", permissions: { crm: "editor", pos: "none", inventory: "none", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "none" } },
        { name: "Security", tier: "tier1", permissions: { crm: "viewer", pos: "none", inventory: "none", finance: "none", analytics: "none", workflow: "none", ai: "none", audit_logs: "viewer" } },
      ];

      const batch = writeBatch(db);
      for (const role of defaultRoles) {
        const roleId = `${enterpriseId}-${role.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const docRef = doc(db, "roles", roleId);
        batch.set(docRef, {
          ...role,
          users: 0,
          enterprise_id: enterpriseId,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      
      await recordAuditLog({
        enterpriseId,
        action: "ROLES_SEEDED",
        details: "Default enterprise-grade roles were provisioned into the system.",
        severity: "INFO",
        type: "SYSTEM"
      });

      toast.success("System roles successfully provisioned.", { id: loadingToast });
    } catch (err: any) {
      toast.error("Role seeding failed: " + err.message, { id: loadingToast });
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editingRole.name) {
      toast.error("Please provide a role name.");
      return;
    }
    try {
      const { id, ...data } = editingRole;
      await setDoc(doc(db, "roles", id), { ...data, enterprise_id: enterpriseId }, { merge: true });
      setIsEditRoleDialogOpen(false);
      setEditingRole(null);
      toast.success("Role updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can delete roles.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'roles', id));
      await recordAuditLog({
        enterpriseId,
        action: 'ROLE_DELETED',
        details: `Role ${id} was permanently removed.`,
        severity: 'WARNING',
        type: 'SYSTEM'
      });
      toast.success('Role deleted successfully!');
    } catch (error: any) {
      toast.error('Failed to delete role: ' + error.message);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranch.name || !newBranch.address || !newBranch.parish) {
      toast.error("Please fill in branch name, address, and parish.");
      return;
    }

    // Duplicate guard: check if a branch with the same name already exists
    const normalizedName = newBranch.name.trim().toLowerCase();
    const duplicate = branches.find(b => b.name?.trim().toLowerCase() === normalizedName);
    if (duplicate) {
      toast.error(`A branch named "${newBranch.name}" already exists. Please use a unique name.`);
      return;
    }

    const limitCheck = checkLimit("branches");
    if (!limitCheck.allowed) {
      toast.error(limitCheck.message);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "branches"), { ...newBranch, name: newBranch.name.trim(), enterprise_id: enterpriseId });
      
      await recordAuditLog({
        enterpriseId,
        action: "BRANCH_CREATE",
        details: `New branch created: ${newBranch.name}`,
        severity: "INFO",
        type: "SYSTEM",
        metadata: { branchId: docRef.id, branchName: newBranch.name }
      });

      setIsBranchDialogOpen(false);
      setNewBranch({ name: "", address: "", parish: "", contactInfo: "", manager: "", status: "ACTIVE" });
      toast.success("Branch added successfully!");
    } catch (error: any) {
      toast.error("Failed to add branch: " + error.message);
    }
  };

  const handleEditBranch = async () => {
    if (!editingBranch || !editingBranch.name || !editingBranch.address || !editingBranch.parish) {
      toast.error("Please fill in branch name, address, and parish.");
      return;
    }
    try {
      const { id, ...data } = editingBranch;
      await setDoc(doc(db, "branches", id), { ...data, enterprise_id: enterpriseId }, { merge: true });
      
      await recordAuditLog({
        enterpriseId,
        action: "BRANCH_UPDATE",
        details: `Branch configurations updated for: ${editingBranch.name}`,
        severity: "INFO",
        type: "SYSTEM",
        metadata: { branchId: id, updates: data }
      });

      setIsEditBranchDialogOpen(false);
      setEditingBranch(null);
      toast.success("Branch updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update branch: " + error.message);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can delete branches.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'branches', id));
      
      await recordAuditLog({
        enterpriseId,
        action: "BRANCH_DELETE",
        details: `Branch with ID ${id} was permanently removed.`,
        severity: "WARNING",
        type: "SYSTEM",
        metadata: { branchId: id }
      });

      toast.success("Branch deleted successfully!");
    } catch (err: any) {
      toast.error("Failed to delete branch: " + err.message);
    }
  };

  const handleBatchDeleteBranches = async () => {
    if (selectedBranches.length === 0) return;
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can delete branches.');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedBranches.length} branches?`)) return;
    
    try {
      const batch = writeBatch(db);
      selectedBranches.forEach(id => {
        batch.delete(doc(db, "branches", id));
      });
      await batch.commit();
      setSelectedBranches([]);
      toast.success(`Successfully deleted ${selectedBranches.length} branches.`);
    } catch (err: any) {
      toast.error("Failed to delete branches: " + err.message);
    }
  };

  const handleBatchToggleStatus = async (newStatus: "ACTIVE" | "INACTIVE") => {
    if (selectedBranches.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedBranches.forEach(id => {
        batch.update(doc(db, "branches", id), { status: newStatus });
      });
      await batch.commit();
      setSelectedBranches([]);
      toast.success(`Successfully updated ${selectedBranches.length} branches to ${newStatus}.`);
    } catch (err: any) {
      toast.error("Failed to update branches: " + err.message);
    }
  };

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching branches:", error);
    });

    const unsubRoles = onSnapshot(query(collection(db, "roles"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      if (snapshot.empty) {
        setRoles([
          { id: "R1", name: "Administrator", users: 2, access: "Full System", color: "text-blue-600 bg-blue-50" },
          { id: "R2", name: "Manager", users: 5, access: "Branch Operations", color: "text-purple-600 bg-purple-50" },
          { id: "R3", name: "Staff", users: 12, access: "Terminal & CRM", color: "text-emerald-600 bg-emerald-50" },
        ]);
      } else {
        setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    }, (error) => {
      console.error("Error fetching roles:", error);
    });

    const unsubStaff = onSnapshot(query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'enterprise_settings', enterpriseId), (docSnapshot) => {
      // Don't overwrite state while the admin has unsaved changes in-flight
      if (isEditingSettings.current) return;
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.enterpriseName) setEnterpriseName(data.enterpriseName);
        if (data.currency) setCurrency(data.currency);
        if (data.theme) setTheme(data.theme);
        if (data.autoCloseTime) setAutoCloseTime(data.autoCloseTime);
        if (data.autoCloseEnabled !== undefined) setAutoCloseEnabled(data.autoCloseEnabled);
        if (data.breakDuration) setBreakDuration(data.breakDuration.toString());
        if (data.lunchDuration) setLunchDuration(data.lunchDuration.toString());
        if (data.gracePeriod) setGracePeriod(data.gracePeriod.toString());
        if (data.topSpenderThreshold !== undefined) {
          setTopSpenderThreshold(Number(data.topSpenderThreshold));
          setTopSpenderInputValue(data.topSpenderThreshold.toString());
        }
        if (data.twoFactorEnabled !== undefined) setIsTwoFactorEnabled(data.twoFactorEnabled);
        if (data.auditLogRetention) setAuditLogRetention(data.auditLogRetention);
        // Only sync API key if there's no current key shown (don't expose in network tab on every update)
        if (data.apiKey && !apiKey) setApiKey(data.apiKey);
        // Commission PIN: store a hash marker only — never expose the raw value after initial load
        if (data.commissionPin) setCommissionPin(data.commissionPin);
      }
    }, (error) => {
      console.error('Error fetching settings:', error);
    });

    return () => {
      unsubBranches();
      unsubRoles();
      unsubStaff();
      unsubSettings();
    };
  }, [enterpriseId]);

  const [topSpenderInputValue, setTopSpenderInputValue] = useState(topSpenderThreshold.toString());

  useEffect(() => {
    setTopSpenderInputValue(topSpenderThreshold.toString());
  }, [topSpenderThreshold]);

  const handleSaveGlobalSettings = async () => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can change global settings.');
      return;
    }
    const thresholdNumber = parseFloat(topSpenderInputValue);
    if (isNaN(thresholdNumber) || thresholdNumber < 0) {
      toast.error('Please enter a valid top spender threshold.');
      return;
    }

    const loadingToast = toast.loading('Updating Global Governance...');
    try {
      await setDoc(doc(db, 'enterprise_settings', enterpriseId), {
        enterpriseName,
        currency,
        theme,
        topSpenderThreshold: thresholdNumber,
        autoCloseTime,
        autoCloseEnabled,
        breakDuration: parseInt(breakDuration),
        lunchDuration: parseInt(lunchDuration),
        gracePeriod: parseInt(gracePeriod),
        taxRate: Number(taxRate) || 15,
        enterprise_id: enterpriseId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Only update local state AFTER confirmed cloud write
      setTopSpenderThreshold(thresholdNumber);
      toast.success('Global configurations synchronized successfully.', { id: loadingToast });
    } catch (error: any) {
      toast.error('Sync failed: ' + error.message, { id: loadingToast });
    }
  };

  const handleCommitModules = async () => {
    if (!enterpriseId) return;
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can commit the feature matrix.');
      return;
    }
    
    const loadingToast = toast.loading("Provisioning Module Matrix...");
    try {
      await setDoc(doc(db, "enterprise_settings", enterpriseId), {
        modules: config,
        matrixUpdated: serverTimestamp()
      }, { merge: true });
      
      toast.success("Feature matrix committed to cloud.", {
        id: loadingToast,
        description: "Your enterprise capability set has been updated globally.",
        duration: 3000
      });

      await recordAuditLog({
        enterpriseId,
        action: "MODULE_CONFIG_UPDATE",
        details: "The core module capability matrix was updated by an administrator.",
        severity: "WARNING",
        type: "SYSTEM",
        metadata: { config }
      });
    } catch (error: any) {
      toast.error("Module commit failed: " + error.message, { id: loadingToast });
    }
  };

  const seedData = async () => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can seed sample data.');
      return;
    }
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      
      // Seed Branches
      const branchData = [
        { id: `${enterpriseId}-main`, name: "Main Branch", location: "Downtown", status: "ACTIVE", manager: "Alice Johnson", enterprise_id: enterpriseId },
        { id: `${enterpriseId}-north`, name: "North Branch", location: "Uptown", status: "ACTIVE", manager: "Bob Smith", enterprise_id: enterpriseId },
        { id: `${enterpriseId}-south`, name: "South Branch", location: "Southside", status: "ACTIVE", manager: "Charlie Davis", enterprise_id: enterpriseId },
      ];
      branchData.forEach(b => batch.set(doc(db, "branches", b.id), b));

      // Seed Products
      const productData = [
        { id: `P-${enterpriseId}-101`, name: "iPhone 15 Pro", sku: "IPH-15P-256", barcode: "123456", retail_price: 999, wholesale_price: 850, category: "Phones", image_url: "https://picsum.photos/seed/iphone/200", min_stock_level: 10, enterprise_id: enterpriseId },
        { id: `P-${enterpriseId}-102`, name: "MacBook Air M3", sku: "MAC-M3-AIR", barcode: "234567", retail_price: 1099, wholesale_price: 900, category: "Laptops", image_url: "https://picsum.photos/seed/macbook/200", min_stock_level: 15, enterprise_id: enterpriseId },
        { id: `P-${enterpriseId}-103`, name: "AirPods Pro", sku: "AIR-PRO-2", barcode: "345678", retail_price: 249, wholesale_price: 180, category: "Accessories", image_url: "https://picsum.photos/seed/airpods/200", min_stock_level: 20, enterprise_id: enterpriseId },
      ];
      productData.forEach(p => batch.set(doc(db, "products", p.id), p));

      // Seed Customers
      const customerData = [
        { id: `C-${enterpriseId}-001`, name: "Alice Johnson", email: "alice@example.com", phone: "+1 234 567 890", segment: "VIP", balance: 0, loyalty_points: 450, tags: ["Tech", "Early Adopter"], enterprise_id: enterpriseId },
        { id: `C-${enterpriseId}-002`, name: "Bob Smith", email: "bob@smith.com", phone: "+1 987 654 321", segment: "RETAIL", balance: 45.50, loyalty_points: 120, tags: ["New"], enterprise_id: enterpriseId },
      ];
      customerData.forEach(c => batch.set(doc(db, "customers", c.id), c));

      await batch.commit();

      await recordAuditLog({
        enterpriseId,
        action: "SYSTEM_SEED_DATA",
        details: "Factory seed data (branches, products) was injected into the enterprise workspace.",
        severity: "CRITICAL",
        type: "SYSTEM",
        metadata: { branchCount: branchData.length, productCount: productData.length }
      });

      toast.success("Enterprise workspace seeded with factory defaults.");
    } catch (error: any) {
      toast.error("Seeding failed: " + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const modules = [
    { id: "crm", name: "CRM Module", description: "Customer profiles, loyalty tracking, and contact management.", icon: Globe },
    { id: "pos", name: "POS System", description: "Touch-friendly interface, barcode scanning, and split payments.", icon: ToggleLeft },
    { id: "inventory", name: "Inventory Engine", description: "Real-time stock tracking and low-stock alerts.", icon: Database },
    { id: "finance", name: "Finance & Ledger", description: "Invoicing, payment tracking, and financial reporting.", icon: Shield },
    { id: "analytics", name: "Advanced Analytics", description: "Sales trends, customer insights, and revenue reports.", icon: Building },
    { id: "workflow", name: "Workflow Engine", description: "Automated business processes and trigger-based logic.", icon: Zap },
    { id: "ai", name: "AI Layer (Gemini)", description: "Auto-categorization, predictions, and smart insights.", icon: Palette },
    { id: "groups", name: "Client Groups", description: "Segment customers into operational cohorts for targeted actions.", icon: Users },
    { id: "loyalty", name: "Loyalty Program", description: "Manage points, rewards, and customer engagement schemes.", icon: Star },
    { id: "audit_logs", name: "Audit Logs", description: "Track system activities and security events.", icon: Lock },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="p-6 lg:p-10 space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-zinc-400 mb-2">
          <SettingsIcon className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">System Configuration</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 font-display">Control Center</h1>
        <p className="text-zinc-500">Global preferences, branch management, and enterprise-grade security controls.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="w-full overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="bg-zinc-100 p-1 rounded-2xl border border-zinc-200 flex w-max gap-1">
            <TabsTrigger value="modules" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs shrink-0">Modules</TabsTrigger>
            <TabsTrigger value="general" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> General </TabsTrigger>
            <TabsTrigger value="branding" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Branding </TabsTrigger>
             <TabsTrigger value="branches" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Branches </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Staff </TabsTrigger>
            <TabsTrigger value="partners" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Partners </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Roles </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Billing </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-6 font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm shrink-0"> Security </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="card-modern overflow-hidden">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-zinc-900 rounded-xl text-white">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold font-display">Visual Identity</CardTitle>
                      <CardDescription>Upload your corporate logo and define your brand name.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="relative group">
                      <div className="w-40 h-40 rounded-[2.5rem] bg-white border-2 border-zinc-100 shadow-xl overflow-hidden flex items-center justify-center p-4 transition-all group-hover:border-blue-200">
                        {branding.logo ? (
                          <img src={branding.logo} alt="Company Logo" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-12 h-12 text-zinc-200" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <input 
                             type="file" 
                             ref={logoInputRef} 
                             className="hidden" 
                             accept="image/*"
                             onChange={handleLogoUpload}
                           />
                           <Button 
                             variant="secondary" 
                             size="sm" 
                             className="rounded-xl font-bold text-[10px]"
                             onClick={() => logoInputRef.current?.click()}
                           >
                             {branding.logo ? "Change Logo" : "Set Logo"}
                           </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-6 w-full">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Enterprise Name</Label>
                        <Input 
                          value={branding.name} 
                          onChange={(e) => setBranding({ name: e.target.value })}
                          className="rounded-xl h-12 text-lg font-bold border-zinc-200 focus:ring-blue-500/20"
                          placeholder="e.g. Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Logo Asset URL</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={branding.logo} 
                            onChange={(e) => setBranding({ logo: e.target.value })}
                            className="rounded-xl h-11 font-mono text-xs border-zinc-200"
                            placeholder="https://brand.com/logo.png"
                          />
                          <Button variant="outline" className="rounded-xl h-11 px-4 hover:bg-zinc-100 transition-colors">
                            <Camera className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-modern">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                      <Globe className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-xl font-bold font-display">Communication & Social</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={branding.email}
                            onChange={(e) => setBranding({ email: e.target.value })}
                            className="pl-11 rounded-xl h-11 border-zinc-200"
                          />
                        </div>
                     </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Phone Support</Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={branding.phone}
                            onChange={(e) => setBranding({ phone: e.target.value })}
                            className="pl-11 rounded-xl h-11 border-zinc-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Office Number</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={branding.officePhone}
                            onChange={(e) => setBranding({ officePhone: e.target.value })}
                            className="pl-11 rounded-xl h-11 border-zinc-200"
                            placeholder="+1 888-..."
                          />
                        </div>
                      </div>
                     <div className="md:col-span-2 space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Corporate Address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={branding.address}
                            onChange={(e) => setBranding({ address: e.target.value })}
                            className="pl-11 rounded-xl h-11 border-zinc-200"
                          />
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                           <Facebook className="w-4 h-4 text-blue-600" />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Facebook</span>
                        </div>
                        <Input 
                          value={branding.socials.facebook}
                          onChange={(e) => setBranding({ socials: { ...branding.socials, facebook: e.target.value } })}
                          placeholder="facebook.com/..."
                          className="rounded-xl h-11 border-zinc-200 text-xs"
                        />
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                           <Instagram className="w-4 h-4 text-rose-600" />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Instagram</span>
                        </div>
                        <Input 
                          value={branding.socials.instagram}
                          onChange={(e) => setBranding({ socials: { ...branding.socials, instagram: e.target.value } })}
                          placeholder="instagram.com/..."
                          className="rounded-xl h-11 border-zinc-200 text-xs"
                        />
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                           <Twitter className="w-4 h-4 text-sky-500" />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Twitter / X</span>
                        </div>
                        <Input 
                          value={branding.socials.twitter}
                          onChange={(e) => setBranding({ socials: { ...branding.socials, twitter: e.target.value } })}
                          placeholder="twitter.com/..."
                          className="rounded-xl h-11 border-zinc-200 text-xs"
                        />
                     </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-modern">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 rounded-xl text-white">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-xl font-bold font-display">Disclaimers & Compliance</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">System Disclaimer (Footer, Receipts, Invoices)</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={cn(
                            "h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            isGeneratingDisclaimer ? "text-blue-500 animate-pulse" : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100"
                          )}
                          onClick={generateDisclaimerWithAI}
                          disabled={isGeneratingDisclaimer}
                        >
                          <Sparkles className={cn("w-3 h-3 mr-2", isGeneratingDisclaimer && "animate-spin")} />
                          {isGeneratingDisclaimer ? "Applying..." : "Use Template"}
                        </Button>
                      </div>
                      <div className="relative group">
                        <textarea 
                          className="w-full rounded-2xl border-zinc-200 focus:ring-4 focus:ring-blue-500/10 p-4 min-h-[140px] text-sm text-zinc-600 outline-none transition-all resize-none bg-zinc-50/30 font-medium"
                          value={branding.disclaimer}
                          onChange={(e) => setBranding({ disclaimer: e.target.value })}
                          placeholder="e.g. Please note that all sales are final..."
                        />
                        <div className="absolute bottom-4 right-4 text-[10px] font-bold text-zinc-300 uppercase tracking-widest pointer-events-none">
                          {branding.disclaimer.length} Chars
                        </div>
                      </div>
                   </div>
                </CardContent>
              </Card>
              <div className="flex justify-end pt-4">
                 <Button 
                   className="rounded-2xl h-14 px-10 bg-zinc-900 text-white font-bold hover:shadow-xl hover:shadow-zinc-900/20 transition-all flex items-center gap-3 active:scale-95"
                   onClick={handleSaveBranding}
                 >
                   <CheckCircle2 className="w-5 h-5" />
                   Commit Identity Profile
                 </Button>
              </div>
            </div>

            <div className="space-y-8">
               <div className="sticky top-24 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Live Identity Preview</span>
                     <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-bold">REAL-TIME</Badge>
                  </div>
                  
                  <div className="bg-zinc-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[80px] rounded-full" />
                     <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 mb-6 flex items-center justify-center">
                           {branding.logo ? (
                             <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
                           ) : (
                             <div className="w-full h-full bg-zinc-800 rounded-lg animate-pulse" />
                           )}
                        </div>
                        <h4 className="text-white font-bold text-xl mb-1">{branding.name || 'Your Company'}</h4>
                        <p className="text-zinc-500 text-[10px] mb-6 font-medium">{branding.email}</p>
                        
                        <div className="flex items-center gap-4">
                           <Facebook className="w-4 h-4 text-zinc-600" />
                           <Instagram className="w-4 h-4 text-zinc-600" />
                           <Twitter className="w-4 h-4 text-zinc-600" />
                           <Globe className="w-4 h-4 text-zinc-600" />
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl">
                     <div className="flex justify-between items-start mb-8 gap-4">
                        <div className="flex-1">
                           <h5 className="font-bold text-sm text-zinc-900 leading-tight">{branding.name}</h5>
                           <p className="text-[9px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{branding.address}</p>
                        </div>
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                           {branding.logo ? (
                             <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
                           ) : (
                             <div className="w-full h-full bg-zinc-100 rounded-lg" />
                           )}
                        </div>
                     </div>
                     <div className="h-px bg-zinc-100 w-full mb-4" />
                     <div className="text-[9px] text-zinc-400 font-medium italic">
                        {branding.disclaimer}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="modules" className="space-y-6">
          <Card className="card-modern">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Cpu className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Core Engine</span>
              </div>
              <CardTitle className="text-xl font-bold">Feature Toggle Engine</CardTitle>
              <CardDescription>Enable or disable core modules to optimize your enterprise workflow.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-100">
              {modules.map((module) => (
                <div key={module.id} className="py-5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-300 shadow-sm">
                      <module.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900">{module.name}</p>
                        {module.id === "ai" && <Badge className="bg-blue-100 text-blue-700 text-[10px] py-0 rounded-md font-bold">AI POWERED</Badge>}
                        {module.id === "workflow" && <Badge className="bg-amber-100 text-amber-700 text-[10px] py-0 rounded-md font-bold">NEW</Badge>}
                      </div>
                      <p className="text-xs text-zinc-500 max-w-md leading-relaxed">{module.description}</p>
                    </div>
                  </div>
                  <Switch 
                    checked={config[module.id as keyof typeof config]} 
                    onCheckedChange={() => {
                      toggleModule(module.id as keyof typeof config);
                      // Auto-save local is fine, but we also save to cloud on commit
                    }}
                  />
                </div>
              ))}
              
              <div className="pt-8 flex justify-end">
                <Button 
                   className="rounded-2xl h-14 px-10 bg-zinc-900 text-white font-bold hover:shadow-xl hover:shadow-zinc-900/20 transition-all flex items-center gap-3 active:scale-95"
                   onClick={handleCommitModules}
                >
                  <Zap className="w-5 h-5 text-amber-400" />
                  Commit Feature Matrix
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900">Branch Network</h3>
            <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
              <DialogTrigger
                render={
                  <button className={cn(buttonVariants({ variant: "default" }), "rounded-xl bg-zinc-900 text-white h-10 px-6 font-bold text-xs border-none cursor-pointer")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Branch
                  </button>
                }
              />
              <DialogContent className="rounded-3xl border-zinc-100 p-6 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-bold text-xl">Add New Branch</DialogTitle>
                  <DialogDescription>Create a new branch location for your enterprise.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Branch Name</Label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newBranch.name}
                      onChange={(e) => setNewBranch({...newBranch, name: e.target.value})}
                      placeholder="e.g. Westside Branch"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Full Address</Label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newBranch.address}
                      onChange={(e) => setNewBranch({...newBranch, address: e.target.value})}
                      placeholder="e.g. 123 West Ave"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Parish</Label>
                    <Select value={newBranch.parish} onValueChange={(v) => setNewBranch({...newBranch, parish: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Select Parish" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {JAMAICA_PARISHES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Contact Info</Label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newBranch.contactInfo}
                      onChange={(e) => setNewBranch({...newBranch, contactInfo: e.target.value})}
                      placeholder="e.g. +1 876 555 0198"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Manager Name</Label>
                    <Input 
                      className="rounded-xl h-11" 
                      value={newBranch.manager}
                      onChange={(e) => setNewBranch({...newBranch, manager: e.target.value})}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Status</Label>
                    <Select value={newBranch.status || "ACTIVE"} onValueChange={(v) => setNewBranch({...newBranch, status: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" 
                    onClick={handleAddBranch}
                  >
                    Create Branch
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditBranchDialogOpen} onOpenChange={setIsEditBranchDialogOpen}>
              <DialogContent className="rounded-3xl border-zinc-100 p-6 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-bold text-xl">Edit Branch</DialogTitle>
                  <DialogDescription>Update branch details.</DialogDescription>
                </DialogHeader>
                {editingBranch && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Branch Name</Label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={editingBranch.name}
                        onChange={(e) => setEditingBranch({...editingBranch, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Full Address</Label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={editingBranch.address || editingBranch.location}
                        onChange={(e) => setEditingBranch({...editingBranch, address: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Parish</Label>
                      <Select value={editingBranch.parish} onValueChange={(v) => setEditingBranch({...editingBranch, parish: v})}>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder="Select Parish" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {JAMAICA_PARISHES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Contact Info</Label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={editingBranch.contactInfo}
                        onChange={(e) => setEditingBranch({...editingBranch, contactInfo: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Manager Name</Label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={editingBranch.manager}
                        onChange={(e) => setEditingBranch({...editingBranch, manager: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Status</Label>
                      <Select value={editingBranch.status || "ACTIVE"} onValueChange={(v) => setEditingBranch({...editingBranch, status: v})}>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button 
                    className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" 
                    onClick={handleEditBranch}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {selectedBranches.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold">{selectedBranches.length} Branches Selected</span>
                <div className="h-4 w-[1px] bg-zinc-700" />
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-zinc-400 hover:text-white" onClick={() => setSelectedBranches([])}>Deselect All</Button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 text-[10px] font-bold uppercase tracking-wider" onClick={() => handleBatchToggleStatus("ACTIVE")}>Set Active</Button>
                <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 text-[10px] font-bold uppercase tracking-wider" onClick={() => handleBatchToggleStatus("INACTIVE")}>Set Inactive</Button>
                <Button variant="destructive" size="sm" className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider" onClick={handleBatchDeleteBranches}>Delete Selected</Button>
              </div>
            </motion.div>
          )}

          <Card className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-100">
                  <TableHead className="w-12 px-6">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300"
                      checked={branches.length > 0 && selectedBranches.length === branches.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBranches(branches.map(b => b.id));
                        else setSelectedBranches([]);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4 whitespace-nowrap">Branch Name</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4 whitespace-nowrap">Location</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4 whitespace-nowrap">Manager</TableHead>
                  <TableHead className="font-bold text-zinc-900 py-4 whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right font-bold text-zinc-900 py-4 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center">
                      <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                      <p className="font-bold text-zinc-600">No branches configured.</p>
                      <p className="text-xs text-zinc-400 mt-1">Add your first branch to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : branches.map((b) => (
                  <TableRow key={b.id} className={cn("hover:bg-zinc-50/30 transition-colors border-b border-zinc-50", selectedBranches.includes(b.id) && "bg-blue-50/30")}>
                    <TableCell className="px-6">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300"
                        checked={selectedBranches.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBranches([...selectedBranches, b.id]);
                          else setSelectedBranches(selectedBranches.filter(id => id !== b.id));
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-4 font-bold text-zinc-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        {b.name}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-zinc-500">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {b.address || b.location} {b.parish ? `, ${b.parish}` : ''}
                        </div>
                        {b.contactInfo && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="w-3 h-3" />
                            {b.contactInfo}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-medium text-zinc-700">{b.manager}</TableCell>
                    <TableCell className="py-4">
                      <button 
                        onClick={() => toggleBranchStatus(b.id, b.status || "ACTIVE")}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all border",
                          (b.status === "ACTIVE" || !b.status) 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                        )}
                      >
                        {b.status || "ACTIVE"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 rounded-full hover:bg-zinc-100 border-none cursor-pointer flex items-center justify-center")}>
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="rounded-lg text-xs font-bold" onClick={() => {
                            setEditingBranch(b);
                            setIsEditBranchDialogOpen(true);
                          }}>Edit Branch</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg text-xs font-bold text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => handleDeleteBranch(b.id)}>Delete Branch</DropdownMenuItem>
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

        <TabsContent value="staff" className="mt-0 outline-none">
          <StaffManager />
        </TabsContent>

        <TabsContent value="partners" className="mt-0 outline-none">
          <CommissionPartners />
        </TabsContent>

         <TabsContent value="roles" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900">Role-Based Access Control</h3>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="rounded-xl h-11 px-6 font-bold text-xs border-zinc-200 hover:bg-zinc-50"
                onClick={handleSeedDefaultRoles}
              >
                <Zap className="w-4 h-4 mr-2 text-amber-500" />
                Seed System Roles
              </Button>
              <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogTrigger
                  render={
                    <button className={cn(buttonVariants({ variant: "default" }), "rounded-xl bg-zinc-900 text-white h-11 px-8 font-bold text-xs shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-95 transition-all border-none cursor-pointer")}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      New Role
                    </button>
                  }
                />
              <DialogContent className="rounded-[2rem] border-zinc-100 p-0 overflow-hidden sm:max-w-xl shadow-2xl">
                <div className="bg-zinc-900 p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <ShieldCheck className="w-32 h-32" />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <DialogTitle className="font-bold text-3xl tracking-tight">Provision Enterprise Role</DialogTitle>
                    <DialogDescription className="text-zinc-400 font-medium text-base">Define authority boundaries and operational scope for a new staff designation.</DialogDescription>
                  </div>
                </div>

                <div className="p-8 space-y-8 bg-white">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Role Designation</Label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <Input 
                        className="rounded-2xl h-14 bg-zinc-50 border-zinc-100 pl-12 font-bold text-lg focus:ring-2 focus:ring-zinc-900/5 transition-all" 
                        value={newRole.name}
                        onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                        placeholder="e.g. Senior Floor Manager"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Authority Execution Tier</Label>
                    <Select value={newRole.tier} onValueChange={(v) => setNewRole({...newRole, tier: v})}>
                      <SelectTrigger className="rounded-2xl h-14 bg-zinc-50 border-zinc-100 font-bold px-6 focus:ring-2 focus:ring-zinc-900/5 transition-all">
                        <SelectValue placeholder="Select Tier" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        <SelectItem value="tier1" className="rounded-xl py-3 font-bold">Tier 1: Operational (Staff)</SelectItem>
                        <SelectItem value="tier2" className="rounded-xl py-3 font-bold">Tier 2: Tactical (Supervisor)</SelectItem>
                        <SelectItem value="tier3" className="rounded-xl py-3 font-bold">Tier 3: Strategic (Director)</SelectItem>
                        <SelectItem value="tier4" className="rounded-xl py-3 font-bold text-blue-600">Tier 4: Executive (Full Root)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newRole.tier && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 rounded-2xl bg-zinc-50 border-2 border-zinc-100/50 flex gap-4 items-start"
                    >
                      <div className="p-2 bg-white rounded-xl shadow-sm border border-zinc-100 text-zinc-900">
                        <Info className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Tier Capabilities</p>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                          {newRole.tier === 'tier1' && "Operational: Standard staff access. Can execute daily tasks, process sales, and view basic reports for their assigned branch."}
                          {newRole.tier === 'tier2' && "Tactical: Supervisory level. Can override basic system locks, manage local inventory adjustments, and view branch-wide performance metrics."}
                          {newRole.tier === 'tier3' && "Strategic: Regional management. Can configure branch-wide settings, manage supplier relationships, and access multi-location analytics."}
                          {newRole.tier === 'tier4' && "Executive (Full Root): Total enterprise control. Can manage global system configuration, audit logs, financial settlement, and user permissions across all branches."}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-zinc-100">
                    <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Matrix Overrides</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {modules.slice(0, 4).map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <span className="text-[10px] font-bold text-zinc-900">{m.name}</span>
                          <Select 
                            value={newRole.permissions[m.id] || "none"}
                            onValueChange={(v) => setNewRole({...newRole, permissions: {...newRole.permissions, [m.id]: v}})}
                          >
                            <SelectTrigger className="h-7 w-20 text-[9px] uppercase font-bold rounded-lg bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="viewer">View</SelectItem>
                              <SelectItem value="editor">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex gap-4">
                  <Button 
                    variant="ghost" 
                    className="flex-1 rounded-xl h-12 font-bold text-zinc-400 hover:text-zinc-900" 
                    onClick={() => setIsRoleDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-[2] rounded-xl bg-zinc-900 text-white h-12 font-bold shadow-xl shadow-zinc-900/10 hover:translate-y-[-2px] active:translate-y-0 transition-all" 
                    onClick={handleAddRole}
                  >
                    Create Enterprise Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>


            <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
              <DialogContent className="rounded-3xl border-zinc-100 p-6 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-bold text-xl">Edit Role Permissions</DialogTitle>
                  <DialogDescription>Configure module access for {editingRole?.name}</DialogDescription>
                </DialogHeader>
                {editingRole && (
                  <div className="space-y-6 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Role Name</Label>
                      <Input 
                        className="rounded-xl h-11" 
                        value={editingRole.name}
                        onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-xs font-bold text-zinc-500 uppercase">Module Access</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {modules.map((module) => (
                          <div key={module.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-3">
                              <module.icon className="w-5 h-5 text-zinc-400" />
                              <span className="text-sm font-bold text-zinc-900">{module.name}</span>
                            </div>
                            <Select 
                              value={editingRole.permissions?.[module.id] ? (editingRole.permissions[module.id] === true ? "admin" : editingRole.permissions[module.id]) : "none"}
                              onValueChange={(value) => setEditingRole({
                                ...editingRole,
                                permissions: {
                                  ...editingRole.permissions,
                                  [module.id]: value === "none" ? false : value
                                }
                              })}
                            >
                              <SelectTrigger className="w-32 h-8 rounded-lg text-[10px] font-bold uppercase bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="none">No Access</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="admin">Full Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button 
                    className="w-full rounded-xl bg-zinc-900 text-white h-12 font-bold" 
                    onClick={handleUpdateRole}
                  >
                    Save Permissions
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card key={role.id} className="card-modern p-6 space-y-4 group hover:border-blue-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className={cn("p-3 rounded-2xl shadow-sm ring-1", getTierInfo(role.tier).color)}>
                    <Users className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase border-zinc-100">
                    {staff.filter(s => s.role?.toString().trim().toLowerCase() === role.name?.toString().trim().toLowerCase()).length} Users
                  </Badge>
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">{role.name}</h4>
                  <p className="text-xs text-zinc-500 mt-1">{role.access || getTierInfo(role.tier).label}</p>
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-zinc-50">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg h-8" onClick={() => {
                      setEditingRole({
                        ...role,
                        permissions: role.permissions || {}
                      });
                      setIsEditRoleDialogOpen(true);
                    }}>Edit Permissions</Button>
                    
                    <Dialog>
                      <DialogTrigger 
                        render={
                          <button className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-[10px] font-bold text-zinc-500 hover:bg-zinc-100 rounded-lg h-8 border-none cursor-pointer")}>
                            View Staff
                          </button>
                        }
                      />
                      <DialogContent className="rounded-3xl border-zinc-100 p-6 max-w-md">
                        <DialogHeader>
                          <DialogTitle className="font-bold text-xl">Staff Assigned to {role.name}</DialogTitle>
                          <DialogDescription>Current personnel authorized under this role designation.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          {staff.filter(s => s.role?.toString().trim().toLowerCase() === role.name?.toString().trim().toLowerCase()).length > 0 ? (
                            staff.filter(s => s.role?.toString().trim().toLowerCase() === role.name?.toString().trim().toLowerCase()).map(s => (
                              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                                <div className="w-10 h-10 rounded-full bg-white border border-zinc-100 flex items-center justify-center text-zinc-900 font-bold text-xs shadow-sm">
                                  {s.name?.[0] || "?"}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-zinc-900">{s.name}</p>
                                  <p className="text-[10px] text-zinc-500 font-medium">{s.email}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 space-y-2">
                              <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mx-auto text-zinc-300">
                                <Users className="w-6 h-6" />
                              </div>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No staff assigned</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-rose-600" onClick={() => handleDeleteRole(role.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card className="card-modern">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
              <CardTitle className="text-xl font-bold">Business Identity</CardTitle>
              <CardDescription>Global settings for your organization and branding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Enterprise Name</Label>
                  <Input 
                    value={branding.name} 
                    onChange={(e) => {
                      isEditingSettings.current = true;
                      const newName = e.target.value;
                      setBranding({ name: newName });
                      setEnterpriseName(newName);
                    }}
                    onBlur={() => { isEditingSettings.current = false; }}
                    className="rounded-xl border-zinc-200 h-12 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Primary Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="rounded-xl border-zinc-200 h-12 font-bold">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                      <SelectItem value="JMD">JMD - Jamaican Dollar (J$)</SelectItem>
                      <SelectItem value="TTD">TTD - Trinidad & Tobago Dollar (TT$)</SelectItem>
                      <SelectItem value="XCD">XCD - East Caribbean Dollar (EC$)</SelectItem>
                      <SelectItem value="BBD">BBD - Barbadian Dollar (Bds$)</SelectItem>
                      <SelectItem value="BSD">BSD - Bahamian Dollar (B$)</SelectItem>
                      <SelectItem value="BZD">BZD - Belize Dollar (BZ$)</SelectItem>
                      <SelectItem value="KYD">KYD - Cayman Islands Dollar (CI$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Standard Sales Tax (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input 
                      type="number"
                      step="0.01"
                      value={taxRate.toString()} 
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="pl-11 rounded-xl border-zinc-200 h-12 font-bold" 
                      placeholder="e.g. 15"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Top Spender Threshold Amount ({currency})</Label>
                 <Input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={topSpenderInputValue} 
                    onChange={(e) => setTopSpenderInputValue(e.target.value)}
                    className="rounded-xl border-zinc-200 h-12 font-bold w-full sm:w-1/2" 
                    placeholder="Enter minimum amount spent"
                 />
                 <p className="text-xs text-zinc-500">Customers with total spent equal to or exceeding this amount will automatically qualify as "Top Spenders" and receive the visual badge on their profiles and views.</p>
              </div>

              <div className="space-y-4 pt-6 pb-6 border-y border-zinc-100">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Time Clock Durations (Minutes)</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                     <Label className="text-sm font-bold text-amber-600">Short Break</Label>
                     <p className="text-[10px] text-zinc-400 font-medium">Standard paid break length.</p>
                     <Input 
                       type="number"
                       value={breakDuration}
                       onChange={(e) => setBreakDuration(e.target.value)}
                       className="rounded-xl border-zinc-200 h-11 font-bold bg-amber-50/30"
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-sm font-bold text-blue-600">Lunch Break</Label>
                     <p className="text-[10px] text-zinc-400 font-medium">Standard meal duration.</p>
                     <Input 
                       type="number"
                       value={lunchDuration}
                       onChange={(e) => setLunchDuration(e.target.value)}
                       className="rounded-xl border-zinc-200 h-11 font-bold bg-blue-50/30"
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-sm font-bold text-rose-600">Abandonment Grace Period</Label>
                     <p className="text-[10px] text-zinc-400 font-medium">Auto-Logout if overdue.</p>
                     <Input 
                       type="number"
                       value={gracePeriod}
                       onChange={(e) => setGracePeriod(e.target.value)}
                       className="rounded-xl border-zinc-200 h-11 font-bold bg-rose-50/50"
                     />
                  </div>
                </div>
                <div className="pt-2">
                  <Button 
                    className="w-full sm:w-auto rounded-xl bg-zinc-900 text-white h-10 px-6 font-bold text-xs" 
                    onClick={handleSaveGlobalSettings}
                  >
                    Save Time Policies
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">End of Shift / Auto Close Schedule</Label>
                    <p className="text-xs text-zinc-500">Enable and set the time when POS registers should prompt users to close their shifts.</p>
                  </div>
                  <Switch 
                    checked={autoCloseEnabled} 
                    onCheckedChange={setAutoCloseEnabled} 
                  />
                </div>
                {autoCloseEnabled && (
                  <div className="space-y-2">
                    <Input 
                      type="time"
                      value={autoCloseTime} 
                      onChange={(e) => setAutoCloseTime(e.target.value)}
                      className="rounded-xl border-zinc-200 h-12 font-bold w-full sm:w-1/3" 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-zinc-100">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">System Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <Button 
                      key={t} 
                      variant={theme === t ? "default" : "outline"} 
                      onClick={() => setTheme(t)}
                      className={cn(
                        "h-24 rounded-2xl border-zinc-200 flex flex-col gap-3 transition-all",
                        theme === t ? "bg-zinc-900 text-white border-zinc-900" : "hover:border-blue-500 hover:bg-blue-50/50 text-zinc-900"
                      )}
                    >
                      <Layout className={cn("w-6 h-6", theme === t ? "text-white" : "text-zinc-400")} />
                      <span className="text-xs font-bold capitalize">{t}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full sm:w-auto rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 px-10 font-bold shadow-xl shadow-zinc-900/20" 
                onClick={handleSaveGlobalSettings}
              >
                Save Global Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="card-modern">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
              <CardTitle className="text-xl font-bold">Security & Access</CardTitle>
              <CardDescription>Manage authentication, API keys and data protection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">

              <div className="flex items-center justify-between py-4 border-b border-zinc-100 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900">Two-Factor Authentication</p>
                    <p className="text-xs text-zinc-500">Require MFA for privileged system access.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {is2FALoading && <span className="text-[10px] font-bold text-blue-500 animate-pulse">ENROLLING...</span>}
                  <Switch 
                    checked={isTwoFactorEnabled}
                    onCheckedChange={handleToggle2FA}
                    disabled={is2FALoading}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-zinc-100 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <Key className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900">API Access Keys</p>
                    <p className="text-xs text-zinc-500">Manage keys for integrations and webhooks.</p>
                  </div>
                </div>
                <Dialog open={isKeysDialogOpen} onOpenChange={setIsKeysDialogOpen}>
                  <DialogTrigger
                    render={
                      <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg font-bold text-[10px] uppercase cursor-pointer px-3")}>
                        Manage Keys
                      </button>
                    }
                  />

                  <DialogContent className="rounded-3xl border-zinc-100 p-6">
                    <DialogHeader>
                      <DialogTitle className="font-bold text-xl">API Access Keys</DialogTitle>
                      <DialogDescription>Generate keys for system-to-system communication.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
                        <p className="text-sm font-mono text-zinc-600 break-all">{apiKey}</p>
                      </div>
                      <Button variant="outline" className="w-full rounded-xl h-11 font-bold" onClick={handleGenerateKey}>Generate New Key</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-zinc-100 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900">Audit Log Retention</p>
                    <p className="text-xs text-zinc-500">Total event history retention period.</p>
                  </div>
                </div>
                <Select value={auditLogRetention} onValueChange={(v) => {
                  setAuditLogRetention(v);
                  setDoc(doc(db, "enterprise_settings", enterpriseId), { auditLogRetention: v }, { merge: true });
                  toast.success(`Retention policy updated to ${v} days.`);
                }}>
                  <SelectTrigger className="w-32 h-9 rounded-lg font-bold text-[10px] uppercase border-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="0">Indefinite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-4 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900">Commission Partners PIN</p>
                    <p className="text-xs text-zinc-500">Access code for partner financial payouts.</p>
                  </div>
                </div>
                <Dialog open={isCommissionPinDialogOpen} onOpenChange={setIsCommissionPinDialogOpen}>
                  <DialogTrigger
                    render={
                      <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg font-bold text-[10px] uppercase cursor-pointer px-3")}>
                        Change PIN
                      </button>
                    }
                  />
                  <DialogContent className="rounded-3xl border-zinc-100 p-6">
                    <DialogHeader>
                      <DialogTitle className="font-bold text-xl">Commission Access PIN</DialogTitle>
                      <DialogDescription>Set a 4-digit code to protect sensitive payouts.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-500 uppercase">Current PIN</Label>
                        <Input 
                          type="password"
                          maxLength={4}
                          className="rounded-xl h-11 text-center text-xl tracking-widest" 
                          value={currentPinInput}
                          onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-500 uppercase">New PIN</Label>
                        <Input 
                          type="password"
                          maxLength={4}
                          className="rounded-xl h-11 text-center text-xl tracking-widest" 
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                        />
                      </div>
                      <Button className="w-full rounded-xl bg-orange-600 text-white h-11 font-bold" onClick={handleSavePin}>
                        Update PIN
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="pt-6 border-t border-zinc-100 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Seed Initial Data</p>
                    <p className="text-xs text-zinc-500">Populate the database with sample products, customers, and branches.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="rounded-xl font-bold px-6 h-11 border-zinc-200"
                    onClick={seedData}
                    disabled={isSeeding}
                  >
                    {isSeeding ? "Seeding..." : "Seed Sample Data"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <AuditLogs variant="minimal" />

          <Card className="card-modern border-rose-100 bg-rose-50/10">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-rose-900">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions for your business account.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-zinc-900">Reset All Enterprise Data</p>
                <p className="text-xs text-zinc-500">Wipe all transactions, customers, and inventory across all branches.</p>
              </div>
              <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <DialogTrigger
                  render={
                    <button className={cn(buttonVariants({ variant: "destructive" }), "rounded-xl font-bold px-8 h-11 border-none cursor-pointer")}>
                      Reset Data
                    </button>
                  }
                />
                <DialogContent className="rounded-3xl border-rose-100 p-6">
                  <DialogHeader>
                    <DialogTitle className="font-bold text-xl text-rose-600">Reset All Enterprise Data</DialogTitle>
                    <DialogDescription>
                      This action is irreversible. It will wipe all transactions, customers, and inventory across all branches.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" className="rounded-xl h-11 font-bold" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" className="rounded-xl h-11 font-bold" onClick={handleResetData}>Yes, Reset Data</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BILLING TAB ─────────────────────────────────────────── */}
        <TabsContent value="billing" className="space-y-8">
          {/* Hero Header */}
          <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 via-blue-950 to-indigo-950 border border-zinc-800 p-6 sm:p-10 relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Subscription</span>
                  {billing.status === "trialing" ? (() => {
                    const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;
                    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;
                    return (
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${
                        daysLeft <= 3
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}>
                        {daysLeft > 0 ? `Trial · ${daysLeft}d left` : "Trial Expired"}
                      </span>
                    );
                  })() : (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {billing.status === "trialing" ? "You're on a Free Trial" : "Choose Your Plan"}
                </h2>
                <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
                  {billing.status === "trialing"
                    ? "Unlock the full power of your enterprise. Upgrade before your trial ends to keep all features."
                    : "Upgrade or downgrade at any time — changes take effect at the next billing cycle."
                  }
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Current Plan</span>
                <span className="text-2xl font-black text-white capitalize">{billing.planId.replace("-", " ")}</span>
                {billing.status === "trialing" && billing.trialEndsAt ? (
                  <span className="text-xs text-amber-400 font-bold">
                    Trial ends {new Date(billing.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">
                    Renews {new Date(billing.renewalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Card + Feature Comparison */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
            {/* The interactive pricing card */}
            <div className="flex justify-center xl:justify-start">
              <PricingCard />
            </div>

            {/* Right side: Feature comparison table */}
            <div className="space-y-6">
              <Card className="card-modern overflow-hidden">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-5">
                  <CardTitle className="text-base font-bold">What's Included</CardTitle>
                  <CardDescription>Compare features across all plans.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                  <div className="divide-y divide-zinc-100 min-w-[600px] sm:min-w-0">
                    {[
                      { feature: "Contacts / Customers", starter: "500", pro: "5,000", enterprise: "Unlimited" },
                      { feature: "Branches", starter: PLAN_LIMITS.starter.maxBranches, pro: PLAN_LIMITS["business-pro"].maxBranches, enterprise: "Unlimited" },
                      { feature: "Staff Accounts", starter: PLAN_LIMITS.starter.maxUsers, pro: PLAN_LIMITS["business-pro"].maxUsers, enterprise: "Unlimited" },
                      { feature: "POS Terminals", starter: PLAN_LIMITS.starter.maxBranches, pro: PLAN_LIMITS["business-pro"].maxBranches, enterprise: "Unlimited" },
                      { feature: "AI Copilot (Gemini)", starter: "—", pro: "✓", enterprise: "✓" },
                      { feature: "Advanced Analytics", starter: "—", pro: "✓", enterprise: "✓" },
                      { feature: "Custom Workflows", starter: "—", pro: "✓", enterprise: "✓" },
                      { feature: "Audit Logs", starter: "30 days", pro: "90 days", enterprise: "1 year" },
                      { feature: "Priority Support", starter: "Email", pro: "Email + Chat", enterprise: "24/7 Phone" },
                      { feature: "SSO / Custom Auth", starter: "—", pro: "—", enterprise: "✓" },
                      { feature: "Dedicated Account Mgr", starter: "—", pro: "—", enterprise: "✓" },
                      { feature: "Custom Integrations", starter: "—", pro: "—", enterprise: "✓" },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-4 px-6 py-3.5 text-sm hover:bg-zinc-50/50 transition-colors">
                        <span className="text-zinc-700 font-medium col-span-1">{row.feature}</span>
                        <span className="text-center text-zinc-400">{row.starter}</span>
                        <span className="text-center text-blue-600 font-semibold">{row.pro}</span>
                        <span className="text-center text-indigo-600 font-semibold">{row.enterprise}</span>
                      </div>
                    ))}
                    {/* Header row */}
                    <div className="grid grid-cols-4 px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest order-first">
                      <span>Feature</span>
                      <span className="text-center">Starter</span>
                      <span className="text-center text-blue-300">Business Pro</span>
                      <span className="text-center text-indigo-300">Enterprise</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Info Card */}
              <Card className="card-modern">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Payment Method</p>
                      <p className="text-xs text-zinc-500">{billing.paymentMethod.type} ending in {billing.paymentMethod.last4} · Expires {billing.paymentMethod.expiry}</p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto rounded-xl text-xs font-bold border-zinc-200">Update</Button>
                  </div>
                  <div className="h-px bg-zinc-100" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Next invoice</span>
                    <span className="font-bold text-zinc-900">
                      {new Date(billing.renewalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <PaymentSuccessDialog 
        open={isPaymentSuccessOpen} 
        onClose={() => setIsPaymentSuccessOpen(false)} 
        planName={PLAN_LIMITS[billing.planId as keyof typeof PLAN_LIMITS]?.name || "Business"}
      />
    </div>
    </ScrollArea>
  );
}

// ── Payment Success Dialog ──────────────────────────────────────────
function PaymentSuccessDialog({ open, onClose, planName }: any) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] p-0 max-w-sm overflow-hidden border-none shadow-2xl bg-white">
        <div className="bg-emerald-600 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white mx-auto mb-6"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Payment Verified!</h2>
            <p className="text-emerald-100 text-[10px] font-bold mt-2 uppercase tracking-[0.2em]">Transaction Complete</p>
          </div>
        </div>

        <div className="p-10 space-y-8 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-500 leading-relaxed">
              Welcome to the <span className="font-black text-zinc-900">{planName}</span> tier. Your enterprise account has been successfully upgraded and all features are now unlocked.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onClose}
              className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black shadow-xl shadow-zinc-900/20"
            >
              Continue to Dashboard
            </Button>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">A receipt has been sent to your email</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


