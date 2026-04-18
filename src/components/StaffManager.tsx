import React, { useState, useEffect } from "react";
import { User, Plus, X, Activity, UserMinus, ShieldAlert } from "lucide-react";
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy, addDoc } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";

export default function StaffManager() {
  const { formatCurrency } = useModules();
  const [staff, setStaff] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", role: "Cashier", pin: "" });

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSessions = onSnapshot(query(collection(db, "pos_sessions"), orderBy("startTime", "desc")), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRoles = onSnapshot(collection(db, "roles"), (snapshot) => {
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
  }, []);

  const handleCreateStaff = async () => {
    if (!newUser.name || newUser.pin.length !== 4) {
      toast.error("Please enter a valid name and 4-digit PIN");
      return;
    }
    try {
      const id = newUser.name.toLowerCase().replace(/\s+/g, '-') + Math.floor(Math.random() * 1000);
      await setDoc(doc(db, "staff", id), {
        ...newUser,
        status: "ACTIVE",
        createdAt: new Date().toISOString()
      });
      
      // Log to audit logs and notifications
      const logData = {
        action: "Staff Access Created",
        details: `Created new ${newUser.role} access for ${newUser.name}`,
        timestamp: new Date().toISOString(),
        user: "Admin",
      };
      await addDoc(collection(db, "audit_logs"), logData);
      
      await addDoc(collection(db, "notifications"), {
        title: "Staff Member Created",
        message: `${newUser.name} has been provisioned as a ${newUser.role}.`,
        type: "success",
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsAddUserOpen(false);
      setNewUser({ name: "", role: "Cashier", pin: "" });
      toast.success("Staff profile created");
    } catch (error: any) {
      toast.error("Failed to create staff: " + error.message);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string, staffName: string) => {
    try {
      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
      await updateDoc(doc(db, "staff", id), { status: newStatus });
      
      // If we are suspending the user, let's also close their active sessions to lock them out immediately
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
      });

      toast.success(`Staff profile ${newStatus.toLowerCase()}`);
    } catch (error: any) {
      toast.error("Failed to update status");
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Staff & Terminal Access</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage POS PIN codes, track sessions, and monitor register closures.</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger
            render={
              <Button 
                className="rounded-xl px-6 h-11 bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-xl shadow-zinc-200"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Staff Member
              </Button>
            }
          />
          <DialogContent className="rounded-3xl border-zinc-100 p-0 overflow-hidden sm:max-w-md">
            <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">New Staff Access</DialogTitle>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">Generate a POS PIN Profile</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Full Name</Label>
                <Input 
                  className="rounded-xl border-zinc-200 h-12 font-bold bg-white" 
                  placeholder="e.g., Sarah Jenkins"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
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
                             <SelectItem value="Cashier">Cashier</SelectItem>
                             <SelectItem value="Manager">Manager</SelectItem>
                             <SelectItem value="Business Admin">Business Admin</SelectItem>
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

              <Button className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 h-12 font-bold shadow-xl shadow-zinc-200" onClick={handleCreateStaff}>
                Grant Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Staff Directory */}
        <Card className="card-modern">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
               <h3 className="font-bold text-zinc-900">Active POS Users</h3>
               <Badge variant="secondary" className="font-bold">{staff.length} Users</Badge>
            </div>
            {staff.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50/50">
                <UserMinus className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-500">No staff members configured.<br/>Users will fall back to legacy global PIN.</p>
              </div>
            ) : (
               <div className="divide-y divide-zinc-100">
                  {staff.map(s => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center font-bold text-xs ring-1 ring-zinc-200">
                           {s.name.substring(0,2).toUpperCase()}
                         </div>
                         <div>
                           <p className="font-bold text-zinc-900 text-sm leading-tight">{s.name}</p>
                           <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] text-zinc-500 font-medium">{s.role}</span>
                             {s.status === 'DISABLED' ? (
                               <Badge variant="destructive" className="text-[9px] h-3.5 px-1 py-0">Suspended</Badge>
                             ) : sessions.find(session => session.staffId === s.id && session.status === 'ACTIVE') ? (
                               <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50 text-[9px] h-3.5 px-1 py-0">Working</Badge>
                             ) : sessions.find(session => session.staffId === s.id && session.status === 'ON_LUNCH') ? (
                               <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50 text-[9px] h-3.5 px-1 py-0">Lunch</Badge>
                             ) : sessions.find(session => session.staffId === s.id && session.status === 'ON_BREAK') ? (
                               <Badge className="bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50 text-[9px] h-3.5 px-1 py-0">Break</Badge>
                             ) : null}
                           </div>
                         </div>
                      </div>
                      <DropdownMenu>
                         <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                             <MoreVertical className="w-4 h-4" />
                          </Button>
                        }
                      />
                         <DropdownMenuContent align="end" className="w-48 rounded-xl font-medium">
                           <DropdownMenuItem onClick={() => handleToggleStatus(s.id, s.status, s.name)}>
                             {s.status === 'ACTIVE' ? 'Suspend Access' : 'Restore Access'}
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
               </div>
            )}
          </CardContent>
        </Card>

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
                            <p className="text-sm font-bold text-zinc-900">{v.staffName}</p>
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
