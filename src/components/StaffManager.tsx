import React, { useState, useEffect, useMemo } from "react";
import { User, Plus, X as XIcon, Activity, UserMinus, ShieldAlert, MoreVertical, CheckCircle2, Coins } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where, orderBy, addDoc, setAdminRole, writeBatch, limit } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useModules } from "@/context/ModuleContext";

export default function StaffManager() {
  const { formatCurrency, enterpriseId, branding, checkLimit, hasPermission, currency } = useModules();
  const [staff, setStaff] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<any>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({ 
    name: "", 
    role: "Cashier", 
    pin: "", 
    branches: ["all"],
    email: "",
    phone: "",
    salaryType: "HOURLY",
    baseRate: 25,
    payGrade: "STANDARD",
    productivityTarget: 2500 // New 2026 Target Field
  });

  useEffect(() => {
    if (!enterpriseId) return;

    // FIX: Added limit() to unbounded staff/roles/branches listeners
    const unsubStaff = onSnapshot(query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId), limit(500)), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Limit to last 500 sessions to prevent memory bloat — paginate further on demand
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const unsubSessions = onSnapshot(
      query(
        collection(db, "pos_sessions"),
        where("enterprise_id", "==", enterpriseId),
        where("startTime", ">=", thirtyDaysAgo),
        orderBy("startTime", "desc"),
        limit(500)
      ),
      (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }
    );

    const unsubRoles = onSnapshot(query(collection(db, "roles"), where("enterprise_id", "==", enterpriseId), limit(50)), (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(rolesList);
      if (rolesList.length > 0 && !newUser.role) {
        setNewUser(prev => ({ ...prev, role: rolesList[0].name }));
      }
    });

    const unsubBranchesList = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId), limit(100)), (snapshot) => {
      setAvailableBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStaff();
      unsubSessions();
      unsubRoles();
      unsubBranchesList();
    };
  }, [enterpriseId]);

  // Synchronize the active intelligence node with real-time staff updates
  useEffect(() => {
    if (selectedStaffMember) {
      const current = staff.find(s => s.id === selectedStaffMember.id);
      if (!current) {
        setSelectedStaffMember(null);
      } else if (JSON.stringify(current) !== JSON.stringify(selectedStaffMember)) {
        setSelectedStaffMember(current);
      }
    }
  }, [staff, selectedStaffMember?.id]);

  const handleInviteToPortal = async () => {
    const email = newUser.email?.trim().toLowerCase();
    if (!email) {
      toast.error("Email Required", { description: "Please enter a valid email first." });
      return;
    }
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can provision portal access.');
      return;
    }

    const loadingToast = toast.loading(`Provisioning portal access for ${newUser.name}...`);
    try {
      // Use clean email slug as ID so it's discoverable by Auth module during login
      const inviteId = email.replace(/[^a-z0-9]/g, '_');

      await setDoc(doc(db, "staff_invites", inviteId), {
        fullName: newUser.name,
        email: email,
        role: newUser.role,
        enterprise_id: enterpriseId,
        status: "PENDING_ACTIVATION",
        provisionedAt: new Date().toISOString(),
        enterpriseName: branding?.name || enterpriseId
      }, { merge: true });

      toast.success("Portal access provisioned!", {
        description: `${newUser.name} can now sign up using ${email}.`,
        id: loadingToast
      });
    } catch (error: any) {
      toast.error("Provisioning failed: " + error.message, { id: loadingToast });
    }
  };

  const handleCreateStaff = async () => {
    if (!newUser.name || newUser.pin.length !== 4) {
      toast.error("Please enter a valid name and 4-digit PIN");
      return;
    }
    if (!isEditing && !hasPermission('settings', 'editor')) {
      toast.error('Insufficient permissions to create staff.');
      return;
    }
    const loadingToast = toast.loading(isEditing ? "Updating staff record..." : "Creating staff record...");
    try {
      if (!isEditing) {
        const limitCheck = checkLimit("users");
        if (!limitCheck.allowed) {
          toast.dismiss(loadingToast);
          toast.error(limitCheck.message);
          return;
        }
      }

      if (isEditing && selectedStaffMember) {
        await updateDoc(doc(db, "staff", selectedStaffMember.id), {
          ...newUser,
          enterprise_id: enterpriseId,
          updatedAt: new Date().toISOString()
        });

        // Only attempt auth sync if the record appears to be a real Firebase Auth UID
        // (Firebase UIDs are exactly 28 chars; local PIN-only IDs are shorter)
        if (selectedStaffMember.id.length === 28) {
          try {
            await updateDoc(doc(db, "users", selectedStaffMember.id), { role: newUser.role });
            await setAdminRole(selectedStaffMember.id, newUser.role);
          } catch (syncErr) {
            // Auth claims sync failed — surface a warning; don't swallow silently
            toast.warning('Profile saved, but permission sync failed. Role may not update until next login.', { duration: 6000 });
          }
        }
        toast.success("Staff profile updated", { id: loadingToast });
      } else {
        const id = newUser.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 10000);
        await setDoc(doc(db, "staff", id), {
          ...newUser,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          enterprise_id: enterpriseId
        });

        await addDoc(collection(db, "audit_logs"), {
          action: "Staff Access Created",
          details: `Created new ${newUser.role} access for ${newUser.name}`,
          timestamp: new Date().toISOString(),
          user: "Admin",
          enterprise_id: enterpriseId
        });

        toast.success("Staff profile created", { id: loadingToast });
      }

      resetAndCloseForm();
    } catch (error: any) {
      toast.error("Operation failed: " + error.message, { id: loadingToast });
    }
  };

  const resetAndCloseForm = () => {
    setIsAddUserOpen(false);
    setIsEditing(false);
    setNewUser({
      name: "",
      role: "Cashier",
      pin: "",
      branches: ["all"],
      email: "",
      phone: "",
      salaryType: "HOURLY",
      baseRate: 25,
      payGrade: "STANDARD",
      productivityTarget: 2500
    });
  };

  const openEditDialog = (member: any) => {
    setSelectedStaffMember(member);
    setNewUser({
      name: member.name,
      role: member.role,
      pin: member.pin,
      branches: Array.isArray(member.branches) ? member.branches : [member.branches || "all"],
      email: member.email || "",
      phone: member.phone || "",
      salaryType: member.salaryType || "HOURLY",
      baseRate: member.baseRate || 25,
      payGrade: member.payGrade || "STANDARD",
      productivityTarget: member.productivityTarget || 2500
    });
    setIsEditing(true);
    setIsAddUserOpen(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: string, staffName: string) => {
    if (!hasPermission('settings', 'editor')) {
      toast.error('Insufficient permissions to change staff status.');
      return;
    }
    try {
      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const updates: any = { status: newStatus };
      if (newStatus === "DISABLED") {
        updates.suspendedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, "staff", id), updates);

      if (newStatus === "DISABLED") {
        const activeSessions = sessions.filter(s => s.staffId === id && s.status !== 'CLOSED');
        for (const s of activeSessions) {
          await updateDoc(doc(db, "pos_sessions", s.id), {
            status: "CLOSED",
            endTime: new Date().toISOString(),
            notes: "Security Token Revoked: System Auto-Closed via Admin Suspension."
          });
        }
      }

      await addDoc(collection(db, "audit_logs"), {
        action: newStatus === "DISABLED" ? "Security Token Suspended" : "Staff Reactivated",
        details: `${newStatus === "DISABLED" ? "Suspended access" : "Restored access"} for ${staffName}.`,
        timestamp: new Date().toISOString(),
        user: "Admin",
        enterprise_id: enterpriseId
      });

      toast.success(newStatus === "DISABLED" ? "Security token suspended" : "Staff profile reactivated");
    } catch (error: any) {
      toast.error("Cloud synchronization failed");
    }
  };

  const handleDeleteStaff = async (id: string, staffName: string) => {
    if (!hasPermission('settings', 'admin')) {
      toast.error('Only administrators can delete staff members.');
      return;
    }
    try {
      // Use writeBatch for atomic session close + staff delete
      const batch = writeBatch(db);
      const activeSessions = sessions.filter(s => s.staffId === id && s.status !== 'CLOSED');
      for (const s of activeSessions) {
        batch.update(doc(db, "pos_sessions", s.id), {
          status: "CLOSED",
          endTime: new Date().toISOString(),
          notes: "Account Terminated: Session force-closed during staff deletion."
        });
      }
      batch.delete(doc(db, "staff", id));
      await batch.commit();

      await addDoc(collection(db, "audit_logs"), {
        action: "Staff Deleted",
        details: `Permanently removed ${staffName} and terminated all active sessions.`,
        timestamp: new Date().toISOString(),
        user: "Admin",
        enterprise_id: enterpriseId
      });

      if (selectedStaffMember?.id === id) setSelectedStaffMember(null);
      setSelectedStaffIds(prev => prev.filter(sid => sid !== id));
      toast.success(`${staffName} decommissioned successfully`);
    } catch (error: any) {
      toast.error("Failed to delete staff: " + error.message);
    }
  };

  const handleExportProductivityPDF = async (staffMember: any) => {
    if (!staffMember) return;
    const tid = toast.loading(`Generating report for ${staffMember.name}...`);
    try {
      const staffSessions = sessions.filter(s => s.staffId === staffMember.id);
      const totalSales = staffSessions.reduce((acc, s) => acc + (s.totalSales || 0), 0);
      const target = staffMember.productivityTarget || 2500;
      const progress = (totalSales / (target || 1)) * 100;

      const printWindow = window.open('', '_blank', 'width=1000,height=1200');
      if (!printWindow) {
        toast.dismiss(tid); // Clear the loading toast before showing the error
        toast.error("Pop-up blocked. Please allow pop-ups for this site and try again.");
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Productivity Report - ${staffMember.name}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
              body { font-family: 'Outfit', sans-serif; color: #18181b; padding: 60px; line-height: 1.6; background: white; -webkit-print-color-adjust: exact; }
              .header { border-bottom: 4px solid #18181b; padding-bottom: 30px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
              .title { font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1px; }
              .subtitle { font-size: 14px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-top: 8px; }
              .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 50px; }
              .stat-card { background: #f9fafb; border: 1px solid #e4e4e7; padding: 24px; border-radius: 20px; }
              .stat-label { font-size: 11px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
              .stat-value { font-size: 24px; font-weight: 900; color: #18181b; }
              table { width: 100%; border-collapse: collapse; margin-top: 30px; }
              th { text-align: left; font-size: 11px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; padding: 16px; border-bottom: 2px solid #e4e4e7; }
              td { padding: 16px; font-size: 13px; border-bottom: 1px solid #f4f4f5; font-weight: 500; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
              .badge-active { background: #d1fae5; color: #065f46; }
              .badge-closed { background: #f3f4f6; color: #374151; }
              .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e4e4e7; font-size: 10px; color: #a1a1aa; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
              @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="title">${staffMember.name}</h1>
                <p class="subtitle">Performance Intelligence • ${new Date().toLocaleDateString()}</p>
              </div>
              <div style="text-align: right">
                <p style="font-weight: 900; font-size: 18px; margin: 0; text-transform: uppercase;">${staffMember.role || 'Personnel'}</p>
              </div>
            </div>
            <div class="grid">
              <div class="stat-card"><div class="stat-label">Gross Revenue</div><div class="stat-value">${formatCurrency(totalSales)}</div></div>
              <div class="stat-card"><div class="stat-label">Shift Target</div><div class="stat-value">${formatCurrency(target)}</div></div>
              <div class="stat-card"><div class="stat-label">Target Efficiency</div><div class="stat-value" style="color: ${progress >= 100 ? '#10b981' : '#18181b'}">${progress.toFixed(1)}%</div></div>
            </div>
            <table>
              <thead><tr><th>Shift Start</th><th>Status</th><th>Contribution</th></tr></thead>
              <tbody>
                ${staffSessions.slice(0, 20).map(s => `
                  <tr>
                    <td>${new Date(s.startTime).toLocaleString()}</td>
                    <td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-closed'}">${s.status}</span></td>
                    <td style="font-weight: 700">${formatCurrency(s.totalSales || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">Confidential Enterprise Document • Neural Audit Verification: ${staffMember.id}</div>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Delay to ensure rendering completes before print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        toast.success("Intelligence report exported", { id: tid });
      }, 1000);
    } catch (error) {
      toast.error("Export sequence failed", { id: tid });
    }
  };

  const handleBatchOperation = async (action: 'SUSPEND' | 'ACTIVATE' | 'DELETE') => {
    if (!hasPermission('settings', action === 'DELETE' ? 'admin' : 'editor')) {
      toast.error('Insufficient permissions for this batch operation.');
      return;
    }
    if (action === 'DELETE') {
      if (!window.confirm(`Are you sure you want to permanently decommission ${selectedStaffIds.length} staff members? This action is irreversible and will force-close all active POS sessions.`)) return;
    }
    const loadingToast = toast.loading(`Processing batch sequence...`);
    try {
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (!member) continue;
        if (action === 'DELETE') await handleDeleteStaff(id, member.name);
        else await handleToggleStatus(id, action === 'SUSPEND' ? 'ACTIVE' : 'DISABLED', member.name);
      }
      toast.success(`Batch operation successfully synchronized`, { id: loadingToast });
      setSelectedStaffIds([]);
    } catch (error) {
      toast.error("Cloud synchronization failed", { id: loadingToast });
    }
  };

  // ── Memoized stat calculations (fixes O(N^2) render-cycle computation) ──────
  const todayStart = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const staffStats = useMemo(() => {
    const statsMap: Record<string, { lifetimeSales: number; todaySales: number; sessionCount: number }> = {};
    for (const s of sessions) {
      if (!statsMap[s.staffId]) statsMap[s.staffId] = { lifetimeSales: 0, todaySales: 0, sessionCount: 0 };
      statsMap[s.staffId].lifetimeSales += s.totalSales || 0;
      statsMap[s.staffId].sessionCount += 1;
      if (s.startTime?.slice(0, 10) === todayStart) {
        statsMap[s.staffId].todaySales += s.totalSales || 0;
      }
    }
    return statsMap;
  }, [sessions, todayStart]);

  const topPerformer = useMemo(() => {
    if (staff.length === 0) return "N/A";
    return [...staff].sort((a, b) =>
      (staffStats[b.id]?.lifetimeSales || 0) - (staffStats[a.id]?.lifetimeSales || 0)
    )[0]?.name || "N/A";
  }, [staff, staffStats]);

  const enterpriseATV = useMemo(() => {
    const totalSales = sessions.reduce((acc, s) => acc + (s.totalSales || 0), 0);
    const totalTx = sessions.reduce((acc, s) => acc + (s.transactionCount || 0), 0);
    return totalTx > 0 ? totalSales / totalTx : (sessions.length > 0 ? totalSales / sessions.length : 0);
  }, [sessions]);

  const realProductivityScore = useMemo(() => {
    if (staff.length === 0) return 0;
    const scores = staff.map(s => {
      const target = s.productivityTarget || 2500;
      const today = staffStats[s.id]?.todaySales || 0;
      return Math.min(100, (today / target) * 100);
    });
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [staff, staffStats, todayStart]);

  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const toggleAllSelection = () => {
    if (selectedStaffIds.length === staff.length) setSelectedStaffIds([]);
    else setSelectedStaffIds(staff.map(s => s.id));
  };

  const calculateDuration = (start: string, end?: string) => {
    if (!end) return "Active Now";
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (diff < 60) return `${Math.floor(diff)} mins`;
    return `${Math.floor(diff / 60)}h ${Math.floor(diff % 60)}m`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 overflow-x-hidden pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Credentials & Security</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 font-display">Staff Registry</h2>
          <p className="text-sm text-zinc-500 font-medium max-w-md">Manage POS PIN codes, track sessions, and monitor enterprise register closures.</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={(open) => { if (!open) resetAndCloseForm(); else setIsAddUserOpen(true); }}>
          <DialogTrigger render={<button className={cn(buttonVariants({ variant: "default" }), "rounded-2xl px-8 h-14 bg-zinc-900 text-white hover:bg-zinc-800 font-black shadow-2xl shadow-zinc-900/20 text-xs uppercase tracking-widest w-full md:w-auto border-none cursor-pointer")} onClick={() => { setIsEditing(false); setIsAddUserOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Provision Access</button>} />
          <DialogContent className="rounded-3xl border-zinc-100 p-0 overflow-hidden sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600"><User className="w-5 h-5" /></div>
                <div><DialogTitle className="text-lg font-bold">{isEditing ? "Edit Staff Access" : "New Staff Access"}</DialogTitle><p className="text-xs text-zinc-500 font-medium mt-0.5">Provision secure credentials and location access.</p></div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Full Name</Label><Input className="rounded-xl border-zinc-200 h-12 font-bold bg-white" placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
                <div className="space-y-2"><Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">4-Digit PIN</Label><Input type="password" maxLength={4} className="rounded-xl border-zinc-200 h-12 font-bold text-center tracking-widest text-xl bg-white" placeholder="••••" value={newUser.pin} onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}><SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl">{roles.length === 0 ? ['Manager', 'Supervisor', 'Cashier', 'Sales Rep'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>) : roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Primary Branch</Label>
                  <Select value={newUser.branches?.[0] || "all"} onValueChange={(v) => setNewUser({...newUser, branches: [v]})}>
                    <SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12"><SelectValue>{availableBranches.find(b => b.id === (newUser.branches?.[0] || "all"))?.name || (newUser.branches?.[0] === 'all' ? "All Locations" : newUser.branches[0])}</SelectValue></SelectTrigger>
                    <SelectContent className="rounded-xl"><SelectItem value="all">All Locations</SelectItem>{availableBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Email</Label><Input className="rounded-xl border-zinc-200 h-12 bg-white" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                <div className="space-y-2"><Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Phone</Label><Input className="rounded-xl border-zinc-200 h-12 bg-white" placeholder="Phone" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} /></div>
              </div>
              <div className="pt-6 border-t border-zinc-100 space-y-6">
                  <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Coins className="w-4 h-4" /></div><h4 className="font-bold text-sm text-zinc-900">Compensation</h4></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pay Model</Label><Select value={newUser.salaryType} onValueChange={(v) => setNewUser({...newUser, salaryType: v})}><SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="HOURLY">Hourly Productivity</SelectItem><SelectItem value="WEEKLY">Weekly</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Base Rate ($)</Label><Input type="number" value={newUser.baseRate} onChange={(e) => setNewUser({...newUser, baseRate: parseFloat(e.target.value)})} className="rounded-xl border-zinc-200 h-12 font-bold bg-white" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Daily Target ($)</Label><Input type="number" value={newUser.productivityTarget} onChange={(e) => setNewUser({...newUser, productivityTarget: parseFloat(e.target.value)})} className="rounded-xl border-zinc-200 h-12 font-bold bg-white" /></div>
              </div>
              {isEditing && (
                <div className="pt-6 border-t border-zinc-100 space-y-4">
                  <Button variant="outline" className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 h-12 font-bold text-xs" onClick={() => handleInviteToPortal()}>Provision Portal Identity</Button>
                </div>
              )}
              <Button className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-14 font-bold shadow-xl shadow-zinc-900/10 mt-4 group" onClick={handleCreateStaff}>{isEditing ? "Update Staff Record" : "Grant Access & Lock Contract"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-modern bg-zinc-900 text-white border-zinc-800 shadow-2xl relative overflow-hidden group">
           <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4"><div className="p-2 bg-zinc-800 rounded-lg"><Activity className="w-5 h-5 text-blue-400" /></div><Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-black tracking-widest px-2 py-0.5">ROSTER LIVE</Badge></div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">On-Clock Personnel</p>
              <h3 className="text-4xl font-black mt-1 tracking-tight">
                {sessions.filter(s => s.status === 'ACTIVE').length} 
                <span className="text-xs font-bold text-zinc-500 uppercase ml-2">Deployed</span>
              </h3>
           </CardContent>
        </Card>
        <Card className="card-modern group hover:border-blue-200 transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Coins className="w-5 h-5" /></div></div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Enterprise ATV</p>
            <h3 className="text-3xl font-black mt-1">{formatCurrency(enterpriseATV)}</h3>
          </CardContent>
        </Card>
        <Card className="card-modern group hover:border-indigo-200 transition-all"><CardContent className="p-6"><div className="flex items-center justify-between mb-4"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div></div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Productivity Score (Today)</p><h3 className="text-3xl font-black mt-1 text-indigo-600">{staff.length === 0 ? '—' : `${realProductivityScore.toFixed(1)}%`}</h3></CardContent></Card>
        <Card className="card-modern group hover:border-emerald-200 transition-all"><CardContent className="p-6 border-l-4 border-l-emerald-500"><div className="flex items-center justify-between mb-2"><div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><User className="w-5 h-5" /></div></div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Top Revenue Performer</p><h3 className="text-lg font-black mt-2 truncate text-zinc-900">{topPerformer}</h3></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="card-modern">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-50/10">
               <div className="flex items-center gap-3"><input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" checked={selectedStaffIds.length === staff.length && staff.length > 0} onChange={toggleAllSelection} /><h3 className="font-bold text-zinc-900">Staff Directory</h3></div>
               {selectedStaffIds.length > 0 ? <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase text-rose-600 border-rose-100 hover:bg-rose-50" onClick={() => handleBatchOperation('DELETE')}>Decommission</Button></div> : <Badge variant="secondary" className="font-bold">{staff.length} Users</Badge>}
            </div>
            <div className="divide-y divide-zinc-100">
              {staff.length === 0 ? (
                <div className="p-12 text-center text-sm font-medium text-zinc-400">No staff members found. Click "Provision Access" to add your first team member.</div>
              ) : staff.map(s => {
                const lifetimeSales = staffStats[s.id]?.lifetimeSales || 0;
                const isActive = sessions.find(session => session.staffId === s.id && session.status === 'ACTIVE');
                return (
                  <div key={s.id} className={cn("group p-4 flex items-center justify-between transition-all cursor-pointer", selectedStaffIds.includes(s.id) ? "bg-zinc-50" : "hover:bg-zinc-50/30")} onClick={() => setSelectedStaffMember(s)}>
                    <div className="flex items-center gap-4">
                      <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer", selectedStaffIds.includes(s.id) ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 bg-white")} onClick={(e) => { e.stopPropagation(); toggleStaffSelection(s.id); }}>{selectedStaffIds.includes(s.id) && <CheckCircle2 className="w-3.5 h-3.5" />}</div>
                      <div className="relative"><div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-sm ring-1 ring-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-all">{s.name.substring(0,2).toUpperCase()}</div>{isActive && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />}</div>
                      <div><p className="font-bold text-zinc-900 text-sm group-hover:text-blue-600 transition-colors">{s.name}</p><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{s.role}</p></div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden md:block text-right"><p className="text-sm font-bold text-zinc-900">{formatCurrency(lifetimeSales)}</p><p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Lifetime GMV</p></div>
                      <DropdownMenu><DropdownMenuTrigger render={<button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9 rounded-xl text-zinc-400 hover:bg-white hover:text-zinc-900 border border-transparent flex items-center justify-center cursor-pointer")}><MoreVertical className="w-4 h-4" /></button>} />
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl font-medium shadow-2xl border-zinc-100"><DropdownMenuItem className="gap-2 py-3" onClick={() => setSelectedStaffMember(s)}><Activity className="w-4 h-4 text-blue-600" />View Intelligence</DropdownMenuItem><DropdownMenuItem className="gap-2 py-3" onClick={(e) => { e.stopPropagation(); openEditDialog(s); }}><ShieldAlert className="w-4 h-4 text-emerald-600" />Configure Access</DropdownMenuItem><DropdownMenuItem className="gap-2 py-3" onClick={(e) => { e.stopPropagation(); handleToggleStatus(s.id, s.status, s.name); }}><ShieldAlert className="w-4 h-4 text-rose-600" />{s.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</DropdownMenuItem><DropdownMenuItem className="gap-2 py-3 text-rose-600" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to permanently delete ${s.name}?`)) handleDeleteStaff(s.id, s.name); }}><UserMinus className="w-4 h-4" />Delete</DropdownMenuItem></DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
            <AnimatePresence>
              {selectedStaffIds.length > 0 && (
                <motion.div key="staff-batch-action-bar" initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 50, x: "-50%" }} className="fixed bottom-6 left-1/2 z-50 w-[92%] sm:w-full max-w-lg bg-zinc-900 text-white rounded-[2rem] shadow-2xl border border-zinc-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center justify-between w-full sm:w-auto px-2"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black">{selectedStaffIds.length}</div><p className="font-bold text-sm tracking-tight">Members Selected</p></div><button onClick={() => setSelectedStaffIds([])} className="sm:hidden p-1 text-zinc-500 hover:text-white"><XIcon className="w-5 h-5" /></button></div>
                  <div className="flex items-center gap-2 w-full sm:w-auto"><Button size="sm" className="flex-1 sm:flex-none bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] uppercase tracking-widest h-11 px-6 rounded-xl border border-zinc-700" onClick={() => handleBatchOperation('SUSPEND')}>Suspend</Button><Button size="sm" className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase tracking-widest h-11 px-6 rounded-xl" onClick={() => handleBatchOperation('DELETE')}>Decommission</Button></div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedStaffMember ? (
              <motion.div key={`intelligence-node-${selectedStaffMember.id}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                <Card className="card-modern border-blue-100 bg-blue-50/10 overflow-hidden sticky top-24">
                  <div className="p-6 border-b border-blue-100 bg-white"><div className="flex items-center justify-between mb-6"><Button variant="ghost" size="sm" onClick={() => setSelectedStaffMember(null)} className="text-zinc-400 hover:text-zinc-900">Close</Button><Badge className="bg-blue-600 text-white border-0 py-1 px-3 rounded-full font-bold uppercase tracking-widest text-[9px]">STAFF INSIGHT</Badge></div><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-3xl bg-zinc-900 text-white flex items-center justify-center text-xl font-bold">{selectedStaffMember.name.substring(0,2).toUpperCase()}</div><div><h3 className="text-xl font-bold text-zinc-900">{selectedStaffMember.name}</h3><p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">{selectedStaffMember.role}</p></div></div></div>
                  <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Sessions (30d)</p>
                        <p className="text-lg font-black text-zinc-900">{staffStats[selectedStaffMember.id]?.sessionCount || 0}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Today Sales</p>
                        <p className="text-lg font-black text-emerald-600">{formatCurrency(staffStats[selectedStaffMember.id]?.todaySales || 0)}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Today's Progress</p>
                        <span className="text-[10px] text-zinc-900 font-black">{formatCurrency(staffStats[selectedStaffMember.id]?.todaySales || 0)} / {formatCurrency(selectedStaffMember.productivityTarget || 0)}</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                        {(() => {
                           const pct = Math.min(100, ((staffStats[selectedStaffMember.id]?.todaySales || 0) / (selectedStaffMember.productivityTarget || 1)) * 100);
                           return <div className={cn("h-full rounded-full transition-all duration-1000", pct >= 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-blue-600")} style={{ width: `${pct}%` }} />;
                        })()}
                      </div>
                    </div>
                    <div className="pt-4 space-y-3"><Button className="w-full rounded-xl h-12 bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 font-bold text-xs" onClick={() => handleExportProductivityPDF(selectedStaffMember)}>Export Productivity PDF</Button><Button variant="ghost" className="w-full h-12 text-rose-600 font-bold text-xs hover:bg-rose-50" onClick={() => handleToggleStatus(selectedStaffMember.id, selectedStaffMember.status, selectedStaffMember.name)}>Suspend Security Token</Button></div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="intelligence-node-inactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="card-modern border-dashed border-2 flex flex-col items-center justify-center p-12 text-center bg-zinc-50/50"><div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-zinc-100 shadow-sm mb-4"><Activity className="w-8 h-8 text-zinc-200" /></div><h4 className="font-bold text-zinc-400">Intelligence Node Inactive</h4><p className="text-xs text-zinc-400 mt-2 max-w-[200px]">Select a staff member from the directory to view their live performance stats.</p></Card>
              </motion.div>
            )}
          </AnimatePresence>
          <Card className="card-modern"><CardContent className="p-6"><div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600"><Activity className="w-4 h-4" /></div><h4 className="font-bold text-sm">System Health</h4></div><div className="space-y-4"><div className="flex justify-between text-xs"><span className="text-zinc-500">Cloud Sync</span><span className="text-emerald-600 font-bold">Online</span></div><div className="flex justify-between text-xs"><span className="text-zinc-500">Active Sessions</span><span className="text-zinc-900 font-bold">{sessions.filter(s => s.status === 'ACTIVE').length}</span></div><div className="flex justify-between text-xs"><span className="text-zinc-500">Last 30 Days</span><span className="text-zinc-900 font-bold">{sessions.length} sessions</span></div></div></CardContent></Card>
        </div>

        <Card className="card-modern">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-3xl"><div className="flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-zinc-900">POS Shift History</h3></div></div>
            <ScrollArea className="h-[400px]">
              {sessions.length === 0 ? <div className="p-8 text-center text-sm font-medium text-zinc-500">No records found.</div> : (
                <div className="divide-y divide-zinc-100">
                  {sessions.map(v => (
                    <div key={v.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                      <div className="flex justify-between items-start mb-2"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-zinc-900">{v.staffName}</p><Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded bg-white text-zinc-500 border-zinc-200 uppercase font-bold tracking-tight">{v.branchId === 'all' ? 'Enterprise' : v.branchId || 'Terminal A'}</Badge></div><p className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(v.startTime).toLocaleString()}</p></div>{v.status === 'ACTIVE' ? <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] uppercase font-bold py-0.5">Active</Badge> : <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0.5 text-zinc-500">{calculateDuration(v.startTime, v.endTime)}</Badge>}</div>
                      {v.status === 'CLOSED' && v.countedCash !== undefined && <div className="mt-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-2 text-xs text-zinc-900 font-bold"><div className="flex justify-between"><span>Declared Cash:</span><span>{formatCurrency(v.countedCash)}</span></div>{v.notes && <div className="pt-2 border-t border-zinc-100 text-zinc-600 italic font-medium">"{v.notes}"</div>}</div>}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
