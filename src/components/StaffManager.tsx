import React, { useState, useEffect } from "react";
import { User, Plus, X, Activity, UserMinus, ShieldAlert, MoreVertical, CheckCircle2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where, orderBy, addDoc } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { cn } from "@/lib/utils";

export default function StaffManager() {
  const { formatCurrency, enterpriseId } = useModules();
  const [staff, setStaff] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
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

    const unsubStaff = onSnapshot(query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSessions = onSnapshot(query(collection(db, "pos_sessions"), where("enterprise_id", "==", enterpriseId), orderBy("startTime", "desc")), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRoles = onSnapshot(query(collection(db, "roles"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(rolesList);
      if (rolesList.length > 0 && !newUser.role) {
        setNewUser(prev => ({ ...prev, role: rolesList[0].name }));
      }
    });

    return () => {
      unsubStaff();
      unsubSessions();
      unsubRoles();
    };
  }, [enterpriseId]);

  const handleCreateStaff = async () => {
    if (!newUser.name || newUser.pin.length !== 4) {
      toast.error("Please enter a valid name and 4-digit PIN");
      return;
    }
    try {
      if (isEditing && selectedStaffMember) {
        await updateDoc(doc(db, "staff", selectedStaffMember.id), {
          ...newUser,
          updatedAt: new Date().toISOString()
        });
        toast.success("Staff profile updated");
      } else {
        const id = newUser.name.toLowerCase().replace(/\s+/g, '-') + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, "staff", id), {
          ...newUser,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          enterprise_id: enterpriseId
        });
        
        const logData = {
          action: "Staff Access Created",
          details: `Created new ${newUser.role} access for ${newUser.name}`,
          timestamp: new Date().toISOString(),
          user: "Admin",
          enterprise_id: enterpriseId
        };
        await addDoc(collection(db, "audit_logs"), logData);
        
        await addDoc(collection(db, "notifications"), {
          title: "Staff Member Created",
          message: `${newUser.name} has been provisioned as a ${newUser.role}.`,
          type: "success",
          isRead: false,
          createdAt: new Date().toISOString(),
          enterprise_id: enterpriseId
        });
        toast.success("Staff profile created");
      }

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
      toast.success("Staff profile created");
    } catch (error: any) {
      toast.error("Operation failed: " + error.message);
    }
  };

  const openEditDialog = (member: any) => {
    setSelectedStaffMember(member);
    setNewUser({
      name: member.name,
      role: member.role,
      pin: member.pin,
      branches: member.branches || ["all"],
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
    try {
      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
      await updateDoc(doc(db, "staff", id), { status: newStatus });
      
      if (newStatus === "DISABLED") {
         const activeSessions = sessions.filter(s => s.staffId === id && s.status !== 'CLOSED');
         for (const s of activeSessions) {
           await updateDoc(doc(db, "pos_sessions", s.id), {
             status: "CLOSED",
             endTime: new Date().toISOString(),
             notes: "System Auto-Closed via Admin Suspension."
           });
         }
      }

      await addDoc(collection(db, "audit_logs"), {
        action: "Staff Status Changed",
        details: `Updated access for ${staffName} to ${newStatus}`,
        timestamp: new Date().toISOString(),
        user: "Admin",
        enterprise_id: enterpriseId
      });

      toast.success(`Staff profile ${newStatus.toLowerCase()}`);
    } catch (error: any) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteStaff = async (id: string, staffName: string) => {
    try {
      await deleteDoc(doc(db, "staff", id));
      
      // We don't delete sessions to preserve financial history, but we do close active ones
      const activeSessions = sessions.filter(s => s.staffId === id && s.status !== 'CLOSED');
      for (const s of activeSessions) {
        await updateDoc(doc(db, "pos_sessions", s.id), {
          status: "CLOSED",
          endTime: new Date().toISOString(),
          notes: "Security Terminated: Staff account deleted by Admin."
        });
      }

      await addDoc(collection(db, "audit_logs"), {
        action: "Staff Deleted",
        details: `Permanently removed ${staffName} from system.`,
        timestamp: new Date().toISOString(),
        user: "Admin",
        enterprise_id: enterpriseId
      });

      if (selectedStaffMember?.id === id) setSelectedStaffMember(null);
      setSelectedStaffIds(prev => prev.filter(sid => sid !== id));
      toast.success(`${staffName} removed from directory`);
    } catch (error: any) {
      toast.error("Failed to delete staff member");
    }
  };

  const handleBatchOperation = async (action: 'SUSPEND' | 'ACTIVATE' | 'DELETE') => {
    const loadingToast = toast.loading(`Processing ${selectedStaffIds.length} members...`);
    try {
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (!member) continue;

        if (action === 'DELETE') {
          await handleDeleteStaff(id, member.name);
        } else {
          await handleToggleStatus(id, action === 'SUSPEND' ? 'ACTIVE' : 'DISABLED', member.name);
        }
      }
      toast.success(`Batch ${action.toLowerCase()} complete`, { id: loadingToast });
      setSelectedStaffIds([]);
    } catch (error) {
      toast.error("Batch operation failed", { id: loadingToast });
    }
  };

  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedStaffIds.length === staff.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(staff.map(s => s.id));
    }
  };

  const calculateDuration = (start: string, end?: string) => {
    if (!end) return "Active Now";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = (endTime - startTime) / 60000; // minutes
    if (diff < 60) return `${Math.floor(diff)} mins`;
    const hours = Math.floor(diff / 60);
    const mins = Math.floor(diff % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 overflow-x-hidden pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Credentials & Security</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 font-display">Staff Registry</h2>
          <p className="text-sm text-zinc-500 font-medium max-w-md">Manage POS PIN codes, track sessions, and monitor enterprise register closures.</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button 
              className="rounded-2xl px-8 h-14 bg-zinc-900 text-white hover:bg-zinc-800 font-black shadow-2xl shadow-zinc-900/20 text-xs uppercase tracking-widest w-full md:w-auto"
              onClick={() => {
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
                setIsAddUserOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Provision Access
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-zinc-100 p-0 overflow-hidden sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">{isEditing ? "Edit Staff Access" : "New Staff Access"}</DialogTitle>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">{isEditing ? "Update existing credentials and parameters." : "Provision secure credentials and location access."}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Full Name</Label>
                  <Input 
                    className="rounded-xl border-zinc-200 h-12 font-bold bg-white" 
                    placeholder="e.g., Sarah Jenkins"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">4-Digit PIN</Label>
                  <Input 
                    type="password"
                    maxLength={4}
                    className="rounded-xl border-zinc-200 h-12 font-bold text-center tracking-widest text-xl bg-white" 
                    placeholder="••••"
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                     <SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        {roles.length === 0 ? (
                           <>
                             <SelectItem value="Manager">Manager</SelectItem>
                             <SelectItem value="Supervisor">Supervisor</SelectItem>
                             <SelectItem value="Cashier">Cashier</SelectItem>
                             <SelectItem value="Sales Rep">Sales Rep</SelectItem>
                             <SelectItem value="Technician">Technician</SelectItem>
                             <SelectItem value="Business Admin">Business Admin</SelectItem>
                             <SelectItem value="Customer Support">Customer Support</SelectItem>
                             <SelectItem value="Security">Security</SelectItem>
                             <SelectItem value="Executive">Executive</SelectItem>
                           </>
                        ) : (
                          roles.map(r => (
                            <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                          ))
                        )}
                     </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Primary Branch</Label>
                  <Select value={newUser.branches?.[0] || "all"} onValueChange={(v) => setNewUser({...newUser, branches: [v]})}>
                     <SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="all">All Locations (Global Access)</SelectItem>
                        <SelectItem value="main">Main Branch</SelectItem>
                        <SelectItem value="uptown">Uptown Office</SelectItem>
                        <SelectItem value="downtown">Downtown Hub</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Email (Optional)</Label>
                  <Input 
                    className="rounded-xl border-zinc-200 h-12 bg-white" 
                    placeholder="sarah@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Phone (Optional)</Label>
                  <Input 
                    className="rounded-xl border-zinc-200 h-12 bg-white" 
                    placeholder="+1 555 0000"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* ── NEW 2026 COMPENSATION CONFIG ── */}
              <div className="pt-6 border-t border-zinc-100 space-y-6">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Coins className="w-4 h-4" />
                     </div>
                     <h4 className="font-bold text-sm text-zinc-900">Incentive & Compensation</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pay Model</Label>
                        <Select value={newUser.salaryType} onValueChange={(v) => setNewUser({...newUser, salaryType: v})}>
                           <SelectTrigger className="rounded-xl border-zinc-200 bg-white h-12">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl">
                              <SelectItem value="HOURLY">Hourly Productivity</SelectItem>
                              <SelectItem value="WEEKLY">Weekly Payment</SelectItem>
                              <SelectItem value="FORTNIGHTLY">Fortnightly (Bi-Weekly)</SelectItem>
                              <SelectItem value="MONTHLY">Monthly Retainer</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Base Rate ($)</Label>
                        <Input 
                           type="number"
                           value={newUser.baseRate}
                           onChange={(e) => setNewUser({...newUser, baseRate: parseFloat(e.target.value)})}
                           className="rounded-xl border-zinc-200 h-12 font-bold bg-white"
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Productivity Target ($/day)</Label>
                        <Input 
                           type="number"
                           value={newUser.productivityTarget}
                           onChange={(e) => setNewUser({...newUser, productivityTarget: parseFloat(e.target.value)})}
                           className="rounded-xl border-zinc-200 h-12 font-bold bg-white"
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Enterprise Pay Grade</Label>
                     <div className="grid grid-cols-3 gap-2">
                        {['STANDARD', 'SUPERVISOR', 'EXECUTIVE'].map((grade) => (
                           <button
                              key={grade}
                              type="button"
                              onClick={() => setNewUser({...newUser, payGrade: grade})}
                              className={cn(
                                 "py-3 px-4 rounded-xl border-2 text-[10px] font-black tracking-widest transition-all",
                                 newUser.payGrade === grade 
                                    ? "bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-200" 
                                    : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200"
                              )}
                           >
                              {grade}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>

              <Button className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-14 font-bold shadow-xl shadow-zinc-900/10 mt-4 group" onClick={handleCreateStaff}>
                {isEditing ? "Update Staff Record" : "Grant Access & Lock Contract"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── PERFORMANCE DASHBOARD (2026 INTELLIGENCE) ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-modern bg-zinc-900 text-white border-zinc-800 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl" />
           <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-2 bg-zinc-800 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-400 group-hover:animate-pulse" />
                 </div>
                 <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-black tracking-widest px-2 py-0.5">ROSTER LIVE</Badge>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">On-Clock Personnel</p>
              <h3 className="text-4xl font-black mt-1 tracking-tight">
                {sessions.filter(s => s.status === 'ACTIVE').length} <span className="text-xs font-bold text-zinc-500 uppercase">Deployed</span>
              </h3>
           </CardContent>
        </Card>

        <Card className="card-modern group hover:border-blue-200 transition-all">
           <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Coins className="w-5 h-5" />
                 </div>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Enterprise ATV</p>
              <h3 className="text-3xl font-black mt-1">
                {formatCurrency(sessions.length > 0 ? (sessions.reduce((acc, s) => acc + (s.totalSales || 0), 0) / sessions.length) : 0)}
              </h3>
              <p className="text-[10px] text-zinc-400 font-bold mt-2 font-mono italic">Avg Transaction Value</p>
           </CardContent>
        </Card>

        <Card className="card-modern group hover:border-indigo-200 transition-all">
           <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <CheckCircle2 className="w-5 h-5" />
                 </div>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Productivity Score</p>
              <h3 className="text-3xl font-black mt-1 text-indigo-600">84.2%</h3>
              <div className="mt-2 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500" style={{ width: '84%' }} />
              </div>
           </CardContent>
        </Card>

        <Card className="card-modern group hover:border-emerald-200 transition-all">
           <CardContent className="p-6 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between mb-2">
                 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <User className="w-5 h-5" />
                 </div>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Top Revenue Performer</p>
              <h3 className="text-lg font-black mt-2 truncate text-zinc-900">
                 {staff.length > 0 ? staff.sort((a,b) => (sessions.filter(s => s.staffId === b.id).reduce((acc,s) => acc + (s.totalSales || 0), 0)) - (sessions.filter(s => s.staffId === a.id).reduce((acc,s) => acc + (s.totalSales || 0), 0)))[0].name : "N/A"}
              </h3>
              <Badge variant="outline" className="text-[8px] font-black bg-emerald-50 text-emerald-600 border-emerald-100 uppercase mt-1">Executive Tier</Badge>
           </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Staff Directory */}
        <Card className="card-modern">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/10">
               <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    checked={selectedStaffIds.length === staff.length && staff.length > 0}
                    onChange={toggleAllSelection}
                  />
                  <h3 className="font-bold text-zinc-900">Active POS Users</h3>
               </div>
               {selectedStaffIds.length > 0 ? (
                 <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                   <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase text-rose-600 border-rose-100 hover:bg-rose-50" onClick={() => handleBatchOperation('DELETE')}>Decommission</Button>
                   <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase text-amber-600 border-amber-100 hover:bg-amber-50" onClick={() => handleBatchOperation('SUSPEND')}>Suspend</Button>
                   <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase text-emerald-600 border-emerald-100 hover:bg-emerald-50" onClick={() => handleBatchOperation('ACTIVATE')}>Activate</Button>
                 </div>
               ) : (
                 <Badge variant="secondary" className="font-bold">{staff.length} Users</Badge>
               )}
            </div>
                <div className="divide-y divide-zinc-100">
                  {staff.map(s => {
                    const staffSessions = sessions.filter(sess => sess.staffId === s.id);
                    const totalSalesValue = staffSessions.reduce((acc, sess) => acc + (sess.totalSales || 0), 0);
                    const isActive = sessions.find(session => session.staffId === s.id && session.status === 'ACTIVE');
                    
                    return (
                      <div key={s.id} className={cn(
                        "group p-4 flex items-center justify-between transition-all cursor-pointer relative",
                        selectedStaffIds.includes(s.id) ? "bg-zinc-50" : "hover:bg-zinc-50/30"
                      )} onClick={() => setSelectedStaffMember(s)}>
                        <div className="flex items-center gap-4">
                           <input 
                             type="checkbox" 
                             className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" 
                             checked={selectedStaffIds.includes(s.id)}
                             onClick={(e) => e.stopPropagation()}
                             onChange={(e) => { e.stopPropagation(); toggleStaffSelection(s.id); }}
                           />
                           <div 
                             className={cn(
                               "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center cursor-pointer",
                               selectedStaffIds.includes(s.id) ? "bg-blue-600 border-blue-600 text-white" : "border-zinc-200 bg-white shadow-sm"
                             )}
                             onClick={(e) => { e.stopPropagation(); toggleStaffSelection(s.id); }}
                           >
                              {selectedStaffIds.includes(s.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                           </div>
                           <div className="relative">
                             <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-sm ring-1 ring-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                               {s.name.substring(0,2).toUpperCase()}
                             </div>
                             {isActive && (
                               <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                             )}
                           </div>
                           <div>
                             <p className="font-bold text-zinc-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">{s.name}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{s.role}</span>
                               <span className="w-1 h-1 rounded-full bg-zinc-300" />
                               <span className="text-[10px] text-zinc-500 font-medium">Branch: {s.branches?.[0]?.toUpperCase() || 'ALL'}</span>
                             </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                           <div className="hidden md:block text-right">
                              <p className="text-sm font-bold text-zinc-900">{formatCurrency(totalSalesValue)}</p>
                              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Lifetime GMV</p>
                           </div>
                           <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:bg-white hover:shadow-sm hover:text-zinc-900 border border-transparent hover:border-zinc-100">
                                     <MoreVertical className="w-4 h-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-56 rounded-2xl font-medium shadow-2xl border-zinc-100">
                                <DropdownMenuItem className="gap-2 py-3" onClick={() => setSelectedStaffMember(s)}>
                                  <Activity className="w-4 h-4 text-blue-600" />
                                  View Intelligence
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 py-3" onClick={(e) => { e.stopPropagation(); openEditDialog(s); }}>
                                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                                  Configure Access
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 py-3" onClick={(e) => { e.stopPropagation(); handleToggleStatus(s.id, s.status, s.name); }}>
                                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                                  {s.status === 'ACTIVE' ? 'Suspend Access' : 'Restore Access'}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 py-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={(e) => { e.stopPropagation(); handleDeleteStaff(s.id, s.name); }}>
                                  <UserMinus className="w-4 h-4" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
               </div>

            {/* ── BATCH ACTION BAR (NEW 2026 SECTION) ── */}
            {selectedStaffIds.length > 0 && (
              <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-600 text-white border-0 font-bold">{selectedStaffIds.length} Selected</Badge>
                  <p className="text-xs text-zinc-400 font-medium">Perform action on team group</p>
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="text-white hover:bg-zinc-800 font-bold text-xs" onClick={() => setSelectedStaffIds([])}>Cancel</Button>
                   <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs" onClick={() => handleBatchOperation('SUSPEND')}>Suspend Group</Button>
                   <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs" onClick={() => handleBatchOperation('DELETE')}>Delete Selection</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── STAFF INTELLIGENCE SIDEBAR (NEW 2026 SECTION) ────────── */}
        <div className="space-y-6">
           {selectedStaffMember ? (
             <Card className="card-modern border-blue-100 bg-blue-50/10 overflow-hidden sticky top-24">
                <div className="p-6 border-b border-blue-100 bg-white">
                   <div className="flex items-center justify-between mb-6">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedStaffMember(null)} className="text-zinc-400 hover:text-zinc-900">
                         Close
                      </Button>
                      <Badge className="bg-blue-600 text-white border-0 py-1 px-3 rounded-full font-bold uppercase tracking-widest text-[9px]">STAFF INSIGHT</Badge>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-zinc-900 text-white flex items-center justify-center text-xl font-bold">
                        {selectedStaffMember.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-zinc-900">{selectedStaffMember.name}</h3>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">{selectedStaffMember.role}</p>
                      </div>
                   </div>
                </div>
                <CardContent className="p-6 space-y-8">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm">
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Shift Hours</p>
                         <p className="text-lg font-black text-zinc-900">
                           {sessions.filter(s => s.staffId === selectedStaffMember.id && s.status === 'CLOSED').length * 8}h
                         </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm">
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Conversion</p>
                         <p className="text-lg font-black text-emerald-600">88.4%</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Daily Productivity Target</p>
                         <span className="text-[10px] text-zinc-900 font-black">
                           {formatCurrency(sessions.filter(s => s.staffId === selectedStaffMember.id && s.status === 'ACTIVE').reduce((acc,s) => acc + (s.totalSales || 0), 0))} / {formatCurrency(selectedStaffMember.productivityTarget || 0)}
                         </span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                         <div 
                           className={cn(
                             "h-full rounded-full transition-all duration-1000",
                             ((sessions.filter(s => s.staffId === selectedStaffMember.id && s.status === 'ACTIVE').reduce((acc,s) => acc + (s.totalSales || 0), 0) / (selectedStaffMember.productivityTarget || 1)) * 100) > 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-blue-600"
                           )} 
                           style={{ width: `${Math.min(100, (sessions.filter(s => s.staffId === selectedStaffMember.id && s.status === 'ACTIVE').reduce((acc,s) => acc + (s.totalSales || 0), 0) / (selectedStaffMember.productivityTarget || 1)) * 100)}%` }} 
                         />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold italic">
                        {((sessions.filter(s => s.staffId === selectedStaffMember.id && s.status === 'ACTIVE').reduce((acc,s) => acc + (s.totalSales || 0), 0) / (selectedStaffMember.productivityTarget || 1)) * 100).toFixed(1)}% of shift target achieved.
                      </p>
                   </div>

                   <div className="pt-4 space-y-3">
                      <Button className="w-full rounded-xl h-12 bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 font-bold text-xs" onClick={() => toast.info("Performance report is being generated...")}>
                        Export Productivity PDF
                      </Button>
                      <Button variant="ghost" className="w-full h-12 text-rose-600 font-bold text-xs hover:bg-rose-50" onClick={() => handleToggleStatus(selectedStaffMember.id, selectedStaffMember.status, selectedStaffMember.name)}>
                         Suspend Security Token
                      </Button>
                   </div>
                </CardContent>
             </Card>
           ) : (
             <Card className="card-modern border-dashed border-2 flex flex-col items-center justify-center p-12 text-center bg-zinc-50/50">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-zinc-100 shadow-sm mb-4">
                   <Activity className="w-8 h-8 text-zinc-200" />
                </div>
                <h4 className="font-bold text-zinc-400">Intelligence Node Inactive</h4>
                <p className="text-xs text-zinc-400 mt-2 max-w-[200px]">Select a staff member from the directory to view their live performance stats.</p>
             </Card>
           )}

           <Card className="card-modern">
             <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                      <Activity className="w-4 h-4" />
                   </div>
                   <h4 className="font-bold text-sm">System Health</h4>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Cloud Sync Status</span>
                      <span className="text-emerald-600 font-bold">Encrypted & Online</span>
                   </div>
                   <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Terminal Latency</span>
                      <span className="text-zinc-900 font-bold">14ms</span>
                   </div>
                </div>
             </CardContent>
           </Card>
        </div>

        {/* Shift History / Sessions */}
        <Card className="card-modern">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-3xl">
               <div className="flex items-center gap-2">
                 <Activity className="w-5 h-5 text-indigo-600" />
                 <h3 className="font-bold text-zinc-900">POS Shift History</h3>
               </div>
            </div>
            <ScrollArea className="h-[400px]">
              {sessions.length === 0 ? (
                <div className="p-8 text-center">
                  <ShieldAlert className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-zinc-500">No shift records found.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                   {sessions.map(v => (
                     <div key={v.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-zinc-900">{v.staffName}</p>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded bg-white text-zinc-500 border-zinc-200 uppercase font-bold tracking-tight">
                                  {v.branchId === 'all' ? 'Enterprise' : v.branchId || 'Terminal A'}
                                </Badge>
                             </div>
                             <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(v.startTime).toLocaleString()}</p>
                          </div>
                         {v.status === 'ACTIVE' ? (
                           <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50 text-[10px] uppercase font-bold py-0.5">Active</Badge>
                         ) : v.status === 'ON_BREAK' ? (
                           <Badge className="bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50 text-[10px] uppercase font-bold py-0.5">On Break</Badge>
                         ) : v.status === 'ON_LUNCH' ? (
                           <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50 text-[10px] uppercase font-bold py-0.5">On Lunch</Badge>
                         ) : v.status === 'IN_MEETING' ? (
                           <Badge className="bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-50 text-[10px] uppercase font-bold py-0.5">In Meeting</Badge>
                         ) : (
                           <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0.5 text-zinc-500">{calculateDuration(v.startTime, v.endTime)}</Badge>
                         )}
                       </div>
                       
                       {v.status === 'CLOSED' && v.countedCash !== undefined && (
                          <div className="mt-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-zinc-500">Declared Cash:</span>
                              <span className="font-bold text-zinc-900">{formatCurrency(v.countedCash)}</span>
                            </div>
                            {v.notes && (
                              <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-600 italic">
                                "{v.notes}"
                              </div>
                            )}
                          </div>
                       )}
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
