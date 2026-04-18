import React, { useState, useEffect } from "react";
import { Lock, ArrowLeft, User, Plus, X, Percent, DollarSign, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";

export default function CommissionPartners() {
  const { formatCurrency } = useModules();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [adminPin, setAdminPin] = useState("1234"); // Default, could be fetched from global settings
  
  const [partners, setPartners] = useState<any[]>([]);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: "",
    phone: "",
    type: "percentage",
    value: 0,
    notes: ""
  });

  const admins = [
    { id: "admin1", name: "Daan Sutherland", role: "Business Admin" }
  ];

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (docSnapshot) => {
      if (docSnapshot.exists() && docSnapshot.data().commissionPin) {
        setAdminPin(docSnapshot.data().commissionPin);
      }
    });

    const unsubPartners = onSnapshot(collection(db, "commission_partners"), (snapshot) => {
      setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSettings();
      unsubPartners();
    };
  }, []);

  const handlePinInput = (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      if (newPin.length === 4) {
        if (newPin === adminPin) {
          toast.success("Authorization successful");
          setIsAuthorized(true);
        } else {
          toast.error("Invalid PIN");
          setPinEntry("");
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinEntry("");
  };

  const handleAddPartner = async () => {
    if (!newPartner.name) {
      toast.error("Partner Name is required");
      return;
    }
    try {
      await addDoc(collection(db, "commission_partners"), {
        ...newPartner,
        status: "ACTIVE",
        totalEarned: 0,
        createdAt: serverTimestamp()
      });
      toast.success("Partner created successfully!");
      setIsAddPartnerOpen(false);
      setNewPartner({ name: "", phone: "", type: "percentage", value: 0, notes: "" });
    } catch (error: any) {
      toast.error("Failed to add partner");
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="card-modern shadow-xl overflow-hidden rounded-3xl border-zinc-200">
          <CardContent className="p-8 space-y-6 relative">
            
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-zinc-900" />
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">Authorization Required</h2>
            </div>

            {!selectedAdmin ? (
              <div className="space-y-4 pt-4">
                <p className="text-sm font-medium text-zinc-500">Select an authorized user:</p>
                {admins.map(admin => (
                  <div 
                    key={admin.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer transition-all"
                    onClick={() => setSelectedAdmin(admin)}
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{admin.name}</p>
                      <p className="text-sm text-zinc-500">{admin.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => { setSelectedAdmin(null); setPinEntry(""); }}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-3 flex-1 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 text-sm leading-tight">{selectedAdmin.name}</p>
                      <p className="text-xs text-zinc-500">{selectedAdmin.role}</p>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <p className="text-sm text-zinc-500 font-medium">Enter 4-digit PIN</p>
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <div 
                        key={index} 
                        className={cn(
                          "w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all",
                          pinEntry.length > index ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-transparent"
                        )}
                      >
                        {pinEntry.length > index ? "•" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button 
                      key={num} 
                      variant="outline" 
                      className="h-14 rounded-xl text-xl font-bold bg-white hover:bg-zinc-50 border-zinc-100 shadow-sm"
                      onClick={() => handlePinInput(num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button variant="outline" className="h-14 rounded-xl text-lg font-bold bg-white hover:bg-zinc-50 border-zinc-100 shadow-sm text-zinc-500" onClick={handleClear}>C</Button>
                  <Button variant="outline" className="h-14 rounded-xl text-xl font-bold bg-white hover:bg-zinc-50 border-zinc-100 shadow-sm" onClick={() => handlePinInput("0")}>0</Button>
                  <Button variant="outline" className="h-14 rounded-xl text-lg font-bold bg-white hover:bg-zinc-50 border-zinc-100 shadow-sm text-zinc-500" onClick={handleBackspace}>
                    ⌫
                  </Button>
                </div>
              </div>
            )}
            
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Commission Partners</h3>
          <p className="text-sm text-zinc-500">Manage partners who earn commissions from sales.</p>
        </div>
        <Button className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 px-6 h-11" onClick={() => setIsAddPartnerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Partner
        </Button>
      </div>

      <Card className="card-modern rounded-3xl overflow-hidden border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50/50">
              <TableHead className="font-bold text-zinc-900 py-4">Partner Name</TableHead>
              <TableHead className="font-bold text-zinc-900 py-4">Contact Info</TableHead>
              <TableHead className="font-bold text-zinc-900 py-4">Commission Scope</TableHead>
              <TableHead className="font-bold text-zinc-900 py-4">Total Earned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Briefcase className="w-8 h-8 text-zinc-300" />
                    <p>No commission partners configured.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              partners.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="py-4 font-bold text-zinc-900">{p.name}</TableCell>
                  <TableCell className="py-4 text-zinc-600">{p.phone || "No phone provided"}</TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-1.5 font-medium">
                      {p.type === 'percentage' ? (
                         <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-xs font-bold border border-amber-100 flex items-center gap-1"><Percent className="w-3 h-3" /> {p.value}%</span>
                      ) : (
                         <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-100 flex items-center gap-1">{formatCurrency(p.value)} Fixed</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 font-bold text-zinc-900">{formatCurrency(p.totalEarned || 0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
        <DialogContent className="rounded-[2rem] border-zinc-100 p-0 overflow-hidden sm:max-w-[425px]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="font-bold text-xl">Add Commission Partner</DialogTitle>
            <DialogDescription>Add a new partner who will earn commissions from sales</DialogDescription>
          </DialogHeader>
          <div className="px-6 space-y-4 pb-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-900">Partner Name</label>
              <Input 
                className="rounded-xl h-11 border-zinc-200" 
                placeholder="Enter partner name"
                value={newPartner.name}
                onChange={(e) => setNewPartner({...newPartner, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-900">Phone Number (Optional)</label>
              <Input 
                className="rounded-xl h-11 border-zinc-200" 
                placeholder="Enter phone number"
                value={newPartner.phone}
                onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-900">Commission Type</label>
                <Select value={newPartner.type} onValueChange={(v) => setNewPartner({...newPartner, type: v})}>
                  <SelectTrigger className="rounded-xl h-11 border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage" className="font-medium">
                      <div className="flex items-center gap-2"><Percent className="w-4 h-4 text-zinc-400" /> Percentage</div>
                    </SelectItem>
                    <SelectItem value="fixed" className="font-medium">
                      <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-zinc-400" /> Fixed Amount</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-900">{newPartner.type === "percentage" ? "Percentage (%)" : "Amount"}</label>
                <Input 
                  type="number"
                  className="rounded-xl h-11 border-zinc-200" 
                  placeholder="0"
                  value={newPartner.value || ""}
                  onChange={(e) => setNewPartner({...newPartner, value: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-900">Notes (Optional)</label>
              <textarea 
                className="flex w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-none"
                placeholder="Additional notes about this partner..."
                value={newPartner.notes}
                onChange={(e) => setNewPartner({...newPartner, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
            <Button variant="outline" className="w-full sm:w-auto rounded-xl h-12 font-bold px-8 text-zinc-600 border-zinc-200 hover:bg-zinc-50" onClick={() => setIsAddPartnerOpen(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto rounded-xl h-12 font-bold px-8 bg-[#d97706] hover:bg-[#b45309] text-white shadow-lg shadow-[#d97706]/20" onClick={handleAddPartner}>
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
