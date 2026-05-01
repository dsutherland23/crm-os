import React, { useState, useEffect } from "react";
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
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { PaymentRecord } from "@/types/payment";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export function PaymentsTable() {
  const { enterpriseId, formatCurrency } = useModules();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, "payments"),
      where("tenant_id", "==", enterpriseId),
      orderBy("created_at", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PaymentRecord));
      setPayments(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payments:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [enterpriseId]);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || p.status === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "failed":
        return <Badge className="bg-rose-100 text-rose-700 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "error":
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="card-modern">
      <CardHeader className="border-b border-zinc-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">WiPay Transactions</CardTitle>
              <CardDescription>Real-time Caribbean & Global payment logs</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row gap-4 bg-zinc-50/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Search Order ID, Customer, or Trans ID..." 
              className="pl-10 rounded-xl bg-white border-zinc-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-zinc-200 p-1 rounded-xl gap-1">
              {["All", "Paid", "Pending", "Failed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === s 
                      ? "bg-zinc-900 text-white shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="hover:bg-transparent border-zinc-100">
                <TableHead className="font-bold text-zinc-900 py-4">Date</TableHead>
                <TableHead className="font-bold text-zinc-900">Order ID</TableHead>
                <TableHead className="font-bold text-zinc-900">Customer</TableHead>
                <TableHead className="font-bold text-zinc-900">Amount</TableHead>
                <TableHead className="font-bold text-zinc-900">Status</TableHead>
                <TableHead className="font-bold text-zinc-900">Hash</TableHead>
                <TableHead className="text-right px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="p-4">
                      <div className="h-4 bg-zinc-100 rounded w-full"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-zinc-400">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="w-8 h-8 opacity-20" />
                      <p className="font-medium">No payments found matching criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-50">
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900">
                          {p.created_at instanceof Timestamp 
                            ? format(p.created_at.toDate(), "MMM dd, yyyy")
                            : format(new Date(p.created_at as string), "MMM dd, yyyy")}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-400">
                          {p.created_at instanceof Timestamp 
                            ? format(p.created_at.toDate(), "hh:mm a")
                            : format(new Date(p.created_at as string), "hh:mm a")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-black font-mono text-zinc-900">{p.order_id}</span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                          {p.transaction_id || "No Trans ID"}
                          {p.transaction_id && <ExternalLink className="w-2.5 h-2.5" />}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-900">{p.customer_name || "Guest"}</span>
                        <span className="text-xs text-zinc-500">{p.customer_email || "no-email@wipay.com"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start">
                        <span className="text-base font-black text-zinc-900">
                          {formatCurrency(p.amount)}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                          p.environment === "live" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {p.environment}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(p.status)}
                    </TableCell>
                    <TableCell>
                      {p.hash_validated ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono text-[10px]">
                          VALIDATED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-50 text-zinc-400 border-zinc-100 font-mono text-[10px]">
                          UNVERIFIED
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-zinc-100">
                            <MoreHorizontal className="w-4 h-4 text-zinc-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-zinc-200 shadow-xl">
                          <DropdownMenuItem className="gap-2 font-bold text-xs p-3 cursor-pointer">
                            <FileText className="w-4 h-4" /> View Details
                          </DropdownMenuItem>
                          {p.invoice_id && (
                            <DropdownMenuItem className="gap-2 font-bold text-xs p-3 cursor-pointer">
                              <ExternalLink className="w-4 h-4" /> View Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Re-using some icons from Revenue.tsx for the dropdown
function FileText(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
}
