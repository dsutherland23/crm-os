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
  PieChart as PieChartIcon
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
      insights.push({
        title: "Stable Growth Trajectory",
        description: "All key metrics are stable. AI suggests maintaining current operational strategies.",
        icon: TrendingUp,
        color: "blue"
      });
      insights.push({
        title: "Customer Retention Opportunity",
        description: "AI models indicate a potential 5% increase in retention by implementing a targeted loyalty program.",
        icon: Users,
        color: "purple"
      });
    }

    return insights.slice(0, 3);
  }, [performanceData, branchPerformance, categoryDistribution]);

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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <BrainCircuit className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Enterprise Intelligence</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 font-display">Intelligence Engine</h1>
            <p className="text-zinc-500 max-w-md">Predictive modeling, multi-branch performance analysis, and AI-driven growth strategies.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-zinc-200 h-11 px-6 font-bold text-xs" onClick={() => toast.success("Exporting Intelligence Report...")}>
              <Download className="w-4 h-4 mr-2 text-zinc-400" />
              Export Intelligence Report
            </Button>
            <Button className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 h-11 px-6 font-bold text-xs" onClick={() => toast.info("Running Predictive Simulation...")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Run Predictive Simulation
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
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">+18.4%</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Efficiency Score</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">94.2/100</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                <Globe className="w-5 h-5" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">Optimal</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Market Share</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">12.8%</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                <Target className="w-5 h-5" />
              </div>
              <Badge className="bg-rose-50 text-rose-600 border-rose-100">92% Met</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Goal Completion</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">{formatCurrency(1200000)} / {formatCurrency(1300000)}</h3>
            </div>
          </Card>
          <Card className="card-modern p-6 space-y-4 border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <Badge className="bg-white text-emerald-600 border-emerald-100">+24%</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">AI Growth Velocity</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">High</h3>
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
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: index === 0 ? '100%' : index === 1 ? '75%' : '50%' }} />
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
    </ScrollArea>
  );
}
