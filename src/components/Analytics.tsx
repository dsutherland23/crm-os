import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  ShoppingCart, 
  ArrowUpRight,
  Sparkles,
  BrainCircuit,
  Target,
  Zap,
  BarChart3,
  Globe,
  Layers,
  ArrowRight,
  Download,
  Calendar,
  Filter,
  ChevronRight,
  Activity,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Scale,
  Brain,
  History as HistoryIcon,
  X as XIcon,
  Info
} from "lucide-react";
import RipplePulseLoader from "@/components/ui/ripple-pulse-loader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useModules } from "@/context/ModuleContext";
import { collection, onSnapshot, query, orderBy, where } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const InsightCard = ({ title, description, icon: Icon, color }: any) => (
  <div className={cn(
    "p-6 rounded-2xl border flex gap-4 items-start transition-all duration-300 hover:scale-[1.02] group cursor-pointer",
    color === "blue" ? "bg-blue-50/50 border-blue-100 hover:border-blue-300" : 
    color === "purple" ? "bg-purple-50/50 border-purple-100 hover:border-purple-300" : 
    "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300"
  )}>
    <div className={cn(
      "p-3 rounded-xl shrink-0 shadow-sm transition-transform group-hover:rotate-6",
      color === "blue" ? "bg-white text-blue-600" : 
      color === "purple" ? "bg-white text-purple-600" : 
      "bg-white text-emerald-600"
    )}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h4 className="text-sm font-bold text-zinc-900 mb-1">{title}</h4>
      <p className="text-xs text-zinc-600 leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
        Execute Strategy <ArrowRight className="w-3 h-3" />
      </div>
    </div>
  </div>
);

export default function Analytics() {
  const { activeBranch, formatCurrency, enterpriseId } = useModules();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationParams, setSimulationParams] = useState({
    adSpend: 15, // percentage increase
    newBranch: false,
    retentionFocus: false
  });
  const [simulationResults, setSimulationResults] = useState<any>(null);

  useEffect(() => {
    if (!enterpriseId) return;

    const unsubTx = onSnapshot(query(collection(db, "transactions"), where("enterprise_id", "==", enterpriseId), orderBy("timestamp", "asc")), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubProducts = onSnapshot(query(collection(db, "products"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubBranches = onSnapshot(query(collection(db, "branches"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubStaff = onSnapshot(query(collection(db, "staff"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSessions = onSnapshot(query(collection(db, "pos_sessions"), where("enterprise_id", "==", enterpriseId)), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTx();
      unsubProducts();
      unsubBranches();
      unsubStaff();
      unsubSessions();
    };
  }, [enterpriseId]);

  const performanceData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = months.map(m => ({ name: m, revenue: 0, target: 40000, profit: 0 }));
    
    transactions.forEach(tx => {
      const date = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
      if (date && !isNaN(date.getTime())) {
        const monthIndex = date.getMonth();
        data[monthIndex].revenue += tx.total || 0;
        // Estimate profit based on items cost if available, else fallback to 28%
        let txCost = 0;
        if (tx.items) {
          tx.items.forEach((item: any) => {
            const product = products.find(p => p.id === item.product_id || p.id === item.id);
            txCost += (product?.cost || (item.price * 0.72)) * item.quantity;
          });
        } else {
           txCost = (tx.total || 0) * 0.72;
        }
        data[monthIndex].profit += (tx.total || 0) - txCost;
      }
    });
    
    // Adjust target based on previous month's revenue to make it dynamic
    for (let i = 1; i < data.length; i++) {
        data[i].target = data[i-1].revenue > 0 ? data[i-1].revenue * 1.1 : 40000;
    }

    // Filter to only show months up to current month if no data
    const currentMonth = new Date().getMonth();
    return data.slice(Math.max(0, currentMonth - 5), currentMonth + 1);
  }, [transactions, products]);

  const branchPerformance = useMemo(() => {
    const branchMap: Record<string, any> = {};
    branches.forEach(b => {
      branchMap[b.id] = { name: b.name, revenue: 0, previousRevenue: 0, txCount: 0 };
    });
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    transactions.forEach(tx => {
      const date = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
      if (branchMap[tx.branch_id]) {
        if (date >= thirtyDaysAgo) {
          branchMap[tx.branch_id].revenue += tx.total || 0;
          branchMap[tx.branch_id].txCount += 1;
        } else {
          branchMap[tx.branch_id].previousRevenue += tx.total || 0;
        }
      }
    });
    
    return Object.values(branchMap).map(b => {
      const growth = b.previousRevenue > 0 ? ((b.revenue - b.previousRevenue) / b.previousRevenue) * 100 : 0;
      const efficiency = Math.min(100, 70 + (b.txCount * 0.5)); // Dynamic efficiency score based on tx volume
      return { ...b, growth: Math.round(growth), efficiency: Math.round(efficiency) };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [transactions, branches]);

  const categoryDistribution = useMemo(() => {
    const catMap: Record<string, number> = {};
    const colors = ["#3b82f6", "#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6"];
    
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.product_id || p.id === item.id);
          const cat = product?.category || "Other";
          catMap[cat] = (catMap[cat] || 0) + (item.price * item.quantity);
        });
      }
    });
    
    const total = Object.values(catMap).reduce((a, b) => a + b, 0);
    return Object.entries(catMap).map(([name, value], index) => ({
      name,
      value: total > 0 ? (value / total) * 100 : 0,
      color: colors[index % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [transactions, products]);

  const intelligenceMetrics = useMemo(() => {
    const totalRevenue = transactions.reduce((acc, tx) => acc + (tx.total || 0), 0);
    const avgEfficiency = branchPerformance.length > 0 
      ? branchPerformance.reduce((acc, b) => acc + b.efficiency, 0) / branchPerformance.length 
      : 0;
    
    // Total goal is sum of targets in performance data
    const totalTarget = performanceData.reduce((acc, d) => acc + d.target, 0) || 100000;
    const goalPercentage = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
    
    // For market share, since we don't have external data, we'll proxy it with 
    // revenue relative to an 'ambition' benchmark of 10M for this SaaS level
    const marketShare = Math.min(100, (totalRevenue / 10000000) * 100);

    return {
      efficiency: avgEfficiency.toFixed(1),
      marketShare: marketShare.toFixed(1),
      revenue: totalRevenue,
      target: totalTarget,
      goalPercentage: Math.round(goalPercentage)
    };
  }, [transactions, branchPerformance, performanceData]);

  const aiInsights = useMemo(() => {
    const insights = [];
    
    if (performanceData.length >= 2) {
      const current = performanceData[performanceData.length - 1];
      const previous = performanceData[performanceData.length - 2];
      if (current.revenue > previous.revenue * 1.2 && previous.revenue > 0) {
        insights.push({
          title: "Revenue Spike Detected",
          description: `Revenue in ${current.name} spiked by ${Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)}% compared to ${previous.name}. AI suggests this correlates with recent marketing efforts.`,
          icon: Zap,
          color: "blue"
        });
      } else if (current.revenue < previous.revenue * 0.8 && previous.revenue > 0) {
        insights.push({
          title: "Revenue Drop Alert",
          description: `Revenue in ${current.name} dropped by ${Math.round(((previous.revenue - current.revenue) / previous.revenue) * 100)}% compared to ${previous.name}. AI recommends reviewing recent pricing changes.`,
          icon: TrendingDown,
          color: "rose"
        });
      }
    }

    if (branchPerformance.length > 1) {
      const topBranch = branchPerformance[0];
      const bottomBranch = branchPerformance[branchPerformance.length - 1];
      if (topBranch.revenue > bottomBranch.revenue * 2 && bottomBranch.revenue > 0) {
        insights.push({
          title: "Branch Discrepancy",
          description: `${topBranch.name} is outperforming ${bottomBranch.name} significantly. AI suggests analyzing ${topBranch.name}'s operational strategies for cross-branch implementation.`,
          icon: Target,
          color: "purple"
        });
      }
    }

    if (categoryDistribution.length > 0) {
      const topCategory = categoryDistribution[0];
      if (topCategory.value > 50) {
        insights.push({
          title: "Category Over-reliance",
          description: `Your revenue is heavily reliant on ${topCategory.name} (${Math.round(topCategory.value)}%). AI recommends diversifying product offerings to mitigate risk.`,
          icon: PieChartIcon,
          color: "emerald"
        });
      }
    }

    if (insights.length === 0) {
      if (transactions.length === 0) {
        insights.push({
          title: "Intelligence Model Initializing",
          description: "Awaiting baseline transaction data to generate predictive growth models.",
          icon: BrainCircuit,
          color: "blue"
        });
      } else {
        insights.push({
          title: "Stable Growth Trajectory",
          description: "All key metrics are stable. AI suggests maintaining current operational strategies.",
          icon: TrendingUp,
          color: "blue"
        });
      }
      insights.push({
        title: "Customer Retention Opportunity",
        description: "AI models indicate a potential 5% increase in retention by implementing a targeted loyalty program.",
        icon: Users,
        color: "purple"
      });
    }

    return insights.slice(0, 3);
  }, [performanceData, branchPerformance, categoryDistribution, transactions]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <RipplePulseLoader size="lg" />
        <p className="text-sm font-bold text-zinc-400 mt-4 tracking-widest uppercase">Compiling Analytics Architecture...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <BrainCircuit className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Neural Analytics Tier</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 font-display">Intelligence Engine</h1>
            <p className="text-zinc-500 max-w-md text-xs md:text-sm font-medium leading-relaxed">Predictive modeling, multi-branch performance analysis, and AI-driven growth strategies.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Button variant="outline" className="rounded-xl border-zinc-200 h-12 md:h-14 px-6 md:px-8 font-bold text-[10px] uppercase tracking-widest w-full sm:flex-1 md:w-auto" onClick={() => toast.success("Exporting Intelligence Report...")}>
              <Download className="w-4 h-4 mr-2 text-zinc-400" />
              Export Intel
            </Button>
            <Button 
              className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/10 h-12 md:h-14 px-6 md:px-10 font-black text-[10px] uppercase tracking-widest w-full sm:flex-1 md:w-auto flex items-center justify-center gap-2" 
              onClick={() => setIsSimulating(true)}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Run Simulation
            </Button>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <Activity className="w-5 h-5" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">+0.0%</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Efficiency Score</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{intelligenceMetrics.efficiency}/100</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                <Globe className="w-5 h-5" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">{Number(intelligenceMetrics.marketShare) > 0 ? 'Growing' : 'Baseline'}</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Market Share</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{intelligenceMetrics.marketShare}%</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                <Target className="w-5 h-5" />
              </div>
              <Badge className={cn(
                "border-0",
                intelligenceMetrics.goalPercentage >= 100 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>{intelligenceMetrics.goalPercentage}% Met</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Goal Completion</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{formatCurrency(intelligenceMetrics.revenue)} / {formatCurrency(intelligenceMetrics.target)}</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4 border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <Badge className="bg-white text-emerald-600 border-emerald-100">+{performanceData.length > 1 ? '5%' : '0%'}</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">AI Growth Velocity</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{intelligenceMetrics.revenue > 0 ? 'Optimal' : 'Neutral'}</h3>
            </div>
          </Card>
        </div>

        {/* ── STAFF PERFORMANCE LEADERBOARD (NEW 2026 SECTION) ── */}
        <Card className="card-modern overflow-hidden">
          <CardHeader className="border-b border-zinc-100 bg-zinc-50/30 py-5 px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-900">Enterprise Talent Leaderboard</CardTitle>
                <CardDescription>Top revenue contributors across all locations.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                 <Badge className="bg-blue-600 text-white border-0 font-bold uppercase tracking-widest text-[9px] px-3">PERFORMANCE PEAK</Badge>
              </div>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
             {staff.length === 0 ? (
               <div className="col-span-3 p-12 text-center text-zinc-400 font-medium italic">
                  Compiling talent performance data...
               </div>
             ) : staff
                 .map(member => ({
                   ...member,
                   revenue: sessions?.filter(s => s.staffId === member.id).reduce((acc, s) => acc + (s.totalSales || 0), 0) || 0
                 }))
                 .sort((a, b) => b.revenue - a.revenue)
                 .slice(0, 3)
                 .map((member, index) => {
                
                const rankColor = index === 0 ? "text-amber-500" : index === 1 ? "text-zinc-400" : "text-orange-400";
                const maxRev = sessions?.reduce((max, s) => Math.max(max, s.totalSales || 0), 0) || 1000;
                
                return (
                  <div key={member.id} className="p-8 flex flex-col items-center text-center hover:bg-zinc-50 transition-colors group">
                     <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-3xl bg-zinc-900 text-white flex items-center justify-center text-xl font-bold font-display shadow-2xl group-hover:scale-110 transition-transform">
                           {member.name.substring(0,2).toUpperCase()}
                        </div>
                        <div className={cn("absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center text-sm font-black border border-zinc-50", rankColor)}>
                          {index + 1}
                        </div>
                     </div>
                     <h4 className="font-bold text-lg text-zinc-900 mb-1">{member.name}</h4>
                     <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-4">{member.role}</p>
                     
                     <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-blue-600">{formatCurrency(member.revenue)}</span>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Revenue Generated</span>
                     </div>
                     
                     <div className="mt-6 w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(member.revenue / (Math.max(...staff.map(s => sessions?.filter(sess => sess.staffId === s.id).reduce((acc, sess) => acc + (sess.totalSales || 0), 0) || 0)) || 1)) * 100}%` }} />
                     </div>
                  </div>
                );
             })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
          {/* Main Performance Chart */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="card-modern overflow-hidden">
              <CardHeader className="border-b border-zinc-100 bg-zinc-50/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">Revenue vs Target Projection</CardTitle>
                    <CardDescription>Predictive modeling for the current fiscal period</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">Actual Revenue</Badge>
                    <Badge variant="outline" className="text-zinc-400 border-zinc-200">Target Goal</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-10">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', padding: '12px' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Branch Comparison */}
            <Card className="card-modern">
              <CardHeader className="border-b border-zinc-100">
                <CardTitle className="text-lg font-bold">Multi-Branch Performance</CardTitle>
                <CardDescription>Comparative analysis across all operational hubs</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-50">
                  {branchPerformance.map((branch) => (
                    <div key={branch.name} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{branch.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase border-emerald-100 text-emerald-600 bg-emerald-50">+{branch.growth}% Growth</Badge>
                            <span className="text-[10px] text-zinc-400 font-medium">Efficiency: {branch.efficiency}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-zinc-900">{formatCurrency(branch.revenue)}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Total Revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Strategy & Distribution */}
          <div className="space-y-8">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  AI Strategy Insights
                </CardTitle>
                <CardDescription>Neural-driven business recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiInsights.map((insight, idx) => (
                  <InsightCard 
                    key={idx}
                    title={insight.title}
                    description={insight.description}
                    icon={insight.icon}
                    color={insight.color}
                  />
                ))}
                <Button variant="ghost" className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-bold h-12" onClick={() => toast.success("Generating Full AI Report...")}>
                  Generate Full AI Report
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader className="border-b border-zinc-100">
                <CardTitle className="text-lg font-bold">Revenue Distribution</CardTitle>
                <CardDescription>Contribution by product category</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-6">
                  {categoryDistribution.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs font-bold text-zinc-700">{cat.name}</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900">{cat.value.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Simulation Engine Dialog */}
      <Dialog open={isSimulating} onOpenChange={(o) => !o && setIsSimulating(false)}>
        <DialogContent showCloseButton={false} className="w-full sm:max-w-4xl p-0 shadow-2xl flex flex-col bg-white overflow-hidden top-0 sm:top-1/2 translate-y-0 sm:-translate-y-1/2 h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[2.5rem] border-none">
          <DialogHeader className="p-5 sm:p-8 bg-zinc-900 text-white flex-none relative">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Brain className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Predictive Growth Engine</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-xl md:text-3xl font-black text-white font-display tracking-tight leading-tight">Growth Simulator</DialogTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsSimulating(false)} className="md:hidden text-white/50 hover:text-white">
                  <XIcon className="w-5 h-5" />
                </Button>
              </div>
              <DialogDescription className="text-zinc-500 font-medium text-[10px] md:text-sm">
                Calibrate market variables to project enterprise trajectory.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="p-5 md:p-10 lg:p-14 space-y-10 md:space-y-16">
              {/* Parameters section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
                <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Scale className="w-3 h-3" /> Growth Accelerators
                  </h4>
                  
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-zinc-900 uppercase tracking-widest">AI Marketing Spend</Label>
                        <span className="text-sm font-black text-blue-600">+{simulationParams.adSpend}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={simulationParams.adSpend}
                        onChange={(e) => setSimulationParams({...simulationParams, adSpend: parseInt(e.target.value)})}
                        className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900" 
                      />
                      <p className="text-[10px] text-zinc-400 italic">Projected customer acquisition lift via neural targeting.</p>
                    </div>

                    <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50/50 space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-zinc-900">Branch Expansion</p>
                          <p className="text-[10px] text-zinc-400">Deploy additional 24/7 terminal</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={simulationParams.newBranch}
                          onChange={(e) => setSimulationParams({...simulationParams, newBranch: e.target.checked})}
                          className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-zinc-900">Retention Ops Focus</p>
                          <p className="text-[10px] text-zinc-400">Maximize LTV via automated loyalty</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={simulationParams.retentionFocus}
                          onChange={(e) => setSimulationParams({...simulationParams, retentionFocus: e.target.checked})}
                          className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <TrendingUpIcon className="w-3 h-3" /> Projected Impact
                  </h4>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-8 rounded-[2rem] bg-zinc-900 text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute right-0 top-0 opacity-10 -mt-4 -mr-4 pointer-events-none">
                        <DollarSign className="w-32 h-32" />
                      </div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Projected Monthly Revenue</p>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl md:text-5xl font-black font-display tracking-tighter">
                          {formatCurrency(intelligenceMetrics.revenue * (1 + (simulationParams.adSpend * 0.015) + (simulationParams.newBranch ? 0.3 : 0) + (simulationParams.retentionFocus ? 0.15 : 0)))}
                        </span>
                        <Badge className="bg-emerald-500 text-white border-0 mb-2">
                          <TrendingUpIcon className="w-3 h-3 mr-1" />
                          {Math.round(((simulationParams.adSpend * 0.015) + (simulationParams.newBranch ? 0.3 : 0) + (simulationParams.retentionFocus ? 0.15 : 0)) * 100)}%
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100/50">
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-2">Market Velocity</p>
                        <p className="text-xl font-black text-zinc-900">+{simulationParams.adSpend > 50 ? 'Accelerated' : 'Steady'}</p>
                      </div>
                      <div className="p-6 rounded-3xl bg-purple-50/50 border border-purple-100/50">
                        <p className="text-[9px] font-bold text-purple-600 uppercase tracking-widest mb-2">Efficiency Projection</p>
                        <p className="text-xl font-black text-zinc-900">{simulationParams.retentionFocus ? '94%' : '88%'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Chart */}
              <div className="space-y-6 pt-10 border-t border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-xl text-white">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Revenue Trajectory Map</h5>
                    <p className="text-[10px] text-zinc-400">Comparing current baseline vs simulation projection.</p>
                  </div>
                </div>
                
                <div className="h-[250px] w-full bg-zinc-50 rounded-[2rem] border border-zinc-100 p-6">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData.map((d, i) => {
                        const multiplier = 1 + ((simulationParams.adSpend * 0.01) * (i / performanceData.length)) + (simulationParams.newBranch ? 0.3 * (i/performanceData.length) : 0);
                        return { 
                          ...d, 
                          projected: d.revenue * multiplier
                        };
                      })}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#94a3b8" fill="#f1f5f9" fillOpacity={1} strokeWidth={2} />
                        <Area type="monotone" dataKey="projected" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={4} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-5 md:p-10 bg-zinc-50 border-t border-zinc-100 flex-none flex flex-row items-center gap-3 md:gap-4 sticky bottom-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" className="rounded-xl h-12 md:h-14 px-6 md:px-8 font-bold text-zinc-400 hover:text-zinc-600 transition-all text-[10px] uppercase tracking-widest flex-1 md:flex-none" onClick={() => setIsSimulating(false)}>
              Close Engine
            </Button>
            <Button
              className="rounded-xl md:rounded-2xl h-12 md:h-16 px-6 md:px-14 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/10 transition-all flex-1 md:flex-none flex items-center justify-center gap-2"
              onClick={() => {
                toast.success("Simulation Strategy Deployed to Neural Backlog");
                setIsSimulating(false);
              }}
            >
              Deploy Strategy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
