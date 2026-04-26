import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  BrainCircuit, 
  Zap, 
  Target, 
  TrendingUp,
  MessageSquare,
  Mic,
  Paperclip,
  MoreHorizontal,
  Plus,
  ChevronRight,
  Lightbulb,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShoppingCart,
  Users,
  Warehouse
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "chart" | "action";
  data?: any;
  actions?: { label: string; action: string; icon: any }[];
}

import { GoogleGenAI } from "@google/genai";
import { collection, getDocs, query, orderBy, limit } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";

export default function AIInsights() {
  const { activeBranch } = useModules();
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1",
      role: "assistant", 
      content: "Hello! I'm your Enterprise Business Copilot. I have real-time access to your branches, inventory, and financial data. How can I assist your operations today?",
      timestamp: new Date(),
      type: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { setPendingAction, consumeAction } = usePendingAction();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  const ai = useMemo(() => {
    // process.env.GEMINI_API_KEY is globally defined in vite.config.ts
    const key = (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || "";
    if (!key) {
      console.warn("CRM OS: GEMINI_API_KEY is missing. Copilot will run in offline mode.");
    }
    return new GoogleGenAI({ apiKey: key });
  }, []);

  useEffect(() => {
    const key = (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
    if (!key) {
      toast.error("Enterprise Intelligence Engine requires a GEMINI_API_KEY to activate neural features.");
    }
  }, []);

  const getBusinessContext = async () => {
    try {
      const [productsSnap, inventorySnap, customersSnap, invoicesSnap, staffSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "inventory")),
        getDocs(collection(db, "customers")),
        getDocs(query(collection(db, "invoices"), orderBy("timestamp", "desc"), limit(10))),
        getDocs(collection(db, "staff"))
      ]);
      const products = productsSnap.docs.map(d => d.data());
      const inventory = inventorySnap.docs.map(d => d.data());
      const customers = customersSnap.docs.map(d => d.data());
      const recentInvoices = invoicesSnap.docs.map(d => d.data());
      const staff = staffSnap.docs.map(d => d.data());

      return JSON.stringify({
        summary: {
          totalProducts: products.length,
          totalCustomers: customers.length,
          recentSalesCount: recentInvoices.length,
          activeStaff: staff.filter((s: any) => s.status === "Active").length,
        },
        inventoryAlerts: inventory.filter((i: any) => i.quantity < 10).map((i: any) => {
          const p = products.find((prod: any) => prod.id === i.product_id);
          return { product: p?.name, branch: i.branch_id, quantity: i.quantity };
        }),
        recentInvoices: recentInvoices.map((inv: any) => ({
          id: inv.id,
          total: inv.total,
          status: inv.status,
          customer: inv.customer_name
        }))
      });
    } catch (error) {
      console.error("Error fetching context:", error);
      return "Error fetching real-time business context.";
    }
  };

  const handleSend = async (overrideMessage?: string) => {
    const textToSend = overrideMessage || input;
    if (!textToSend.trim()) return;
    
    const userMsg: Message = { 
      id: Date.now().toString(),
      role: "user", 
      content: textToSend, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const context = await getBusinessContext();
      const prompt = `You are an Enterprise Business Copilot. 
      Real-time business data: ${context}
      
      User request: ${textToSend}
      
      Provide actionable, data-driven insights. If the user asks for charts, use [CHART] in your response.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const aiText = response.text || "I'm sorry, I couldn't process that request.";
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiText,
        timestamp: new Date(),
        type: "text"
      };

      // Simple parsing for demo purposes - in a real app we'd use responseSchema
      if (aiText.includes("[CHART")) {
        aiMsg.type = "chart";
        
        // Generate dynamic chart data based on recent invoices
        const invoicesSnap = await getDocs(query(collection(db, "invoices"), orderBy("timestamp", "desc"), limit(7)));
        const recentInvoices = invoicesSnap.docs.map(d => d.data());
        
        const dynamicChartData = recentInvoices.map((inv, index) => ({
          name: `Day ${index + 1}`,
          sales: inv.total || 0
        })).reverse();
        
        if (dynamicChartData.length === 0) {
          dynamicChartData.push({ name: "Today", sales: 0 });
        }

        aiMsg.data = dynamicChartData;
      } else if (aiText.includes("[ACTION")) {
        aiMsg.type = "action";
        aiMsg.actions = [
          { label: "Execute Recommendation", action: "execute", icon: Zap }
        ];
      }

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("AI Copilot is currently unavailable.");
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const action = consumeAction("ai");
    if (action?.action === "AI_REPORT") {
      handleSend("Generate a full enterprise intelligence report based on current data.");
    }
  }, [consumeAction]);

  return (
    <div className="flex h-[100dvh] bg-zinc-50/50 overflow-hidden">
      {/* Sidebar - History & Suggestions */}
      <div className="w-80 border-r border-zinc-200 bg-white hidden xl:flex flex-col shadow-sm z-10">
        <div className="p-8 border-b border-zinc-100">
          <Button 
            className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/20 h-12 font-bold text-xs"
            onClick={() => {
              setMessages([
                {
                  id: Date.now().toString(),
                  role: "assistant",
                  content: "Starting a new session. How can I assist your business operations today?",
                  timestamp: new Date(),
                  type: "text"
                }
              ]);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Intelligence Session
          </Button>
        </div>
        <ScrollArea className="flex-1 p-8">
          <div className="space-y-10">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Recent Intelligence</p>
              {[
                "Q2 Revenue Forecasting",
                "North Branch Logistics",
                "VIP Churn Mitigation",
                "Inventory Audit - Mar"
              ].map((chat, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 cursor-pointer group transition-all">
                  <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                    <MessageSquare className="w-4 h-4 text-zinc-400 group-hover:text-blue-500" />
                  </div>
                  <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 truncate">{chat}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Neural Shortcuts</p>
              {[
                { title: "Revenue Deep-Dive", icon: TrendingUp, color: "text-emerald-500", desc: "Analyze branch performance", prompt: "Analyze revenue performance across all branches and identify the top 3 growth opportunities." },
                { title: "Stock Optimization", icon: Warehouse, color: "text-amber-500", desc: "Predict replenishment needs", prompt: "Identify all products that are critically low on stock and suggest optimal reorder quantities." },
                { title: "Customer Sentiment", icon: Users, color: "text-blue-500", desc: "Analyze feedback logs", prompt: "Analyze customer activity data and identify any churn risks or high-value engagement trends." },
              ].map((s, i) => (
                <div key={i} className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group" onClick={() => handleSend(s.prompt)}>
                  <div className={cn("p-2.5 rounded-xl bg-white shadow-sm w-fit mb-4 group-hover:scale-110 transition-transform", s.color)}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-zinc-900 mb-1">{s.title}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative w-full min-w-0 overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b border-zinc-200 bg-white/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between shadow-sm pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-2xl shadow-zinc-900/20">
              <BrainCircuit className="w-5 h-5 md:w-7 md:h-7" />
            </div>
            <div>
              <h2 className="text-sm md:text-xl font-black text-zinc-900 font-display tracking-tight">Enterprise Copilot</h2>
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest">Neural v2.4 Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex rounded-lg border-zinc-200 text-zinc-500 font-mono text-[10px] px-3 py-1 bg-white uppercase">Neural Flash</Badge>
            <Button variant="ghost" size="icon" onClick={() => setIsShortcutsOpen(!isShortcutsOpen)} className="xl:hidden rounded-xl text-zinc-400 hover:bg-zinc-100">
              <Lightbulb className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl text-zinc-400 hover:bg-zinc-100">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Shortcuts Overlay */}
        <AnimatePresence>
          {isShortcutsOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="absolute inset-0 z-50 bg-white xl:hidden flex flex-col h-full"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Intelligence Shortcuts</p>
                <Button variant="ghost" size="icon" onClick={() => setIsShortcutsOpen(false)}>
                  <ChevronRight className="rotate-180 w-5 h-5" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {[
                    { title: "Revenue Deep-Dive", icon: TrendingUp, color: "text-emerald-500", desc: "Analyze branch performance", prompt: "Analyze revenue performance across all branches and identify the top 3 growth opportunities." },
                    { title: "Stock Optimization", icon: Warehouse, color: "text-amber-500", desc: "Predict replenishment needs", prompt: "Identify all products that are critically low on stock and suggest optimal reorder quantities." },
                    { title: "Customer Sentiment", icon: Users, color: "text-blue-500", desc: "Analyze feedback logs", prompt: "Analyze customer activity data and identify any churn risks or high-value engagement trends." },
                  ].map((s, i) => (
                    <div key={i} className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50/50 active:bg-white hover:bg-white transition-all shadow-sm" onClick={() => { handleSend(s.prompt); setIsShortcutsOpen(false); }}>
                      <div className={cn("p-2.5 rounded-xl bg-white shadow-sm w-fit mb-4", s.color)}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-black text-zinc-900 mb-1">{s.title}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed font-bold">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-6 border-t border-zinc-100 bg-zinc-50">
                <Button className="w-full rounded-2xl bg-zinc-900 text-white h-12 font-black uppercase tracking-widest text-[10px]" onClick={() => {
                  setMessages([{ id: Date.now().toString(), role: "assistant", content: "Session reset. How can I assist?", timestamp: new Date(), type: "text" }]);
                  setIsShortcutsOpen(false);
                }}>
                  Reset Intelligence Session
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 md:p-10 w-full" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-10 w-full px-1">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2.5 md:gap-6 w-full",
                    msg.role === "user" ? "flex-row-reverse pl-8" : "flex-row pr-8"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform hover:scale-105",
                    msg.role === "user" ? "bg-zinc-900 text-white" : "bg-white text-zinc-900 border border-zinc-100"
                  )}>
                    {msg.role === "user" ? <User className="w-4 h-4 md:w-6 md:h-6" /> : <Bot className="w-4 h-4 md:w-6 md:h-6" />}
                  </div>
                  <div className={cn(
                    "max-w-[90%] md:max-w-[85%] space-y-4",
                    msg.role === "user" ? "text-right" : "text-left"
                  )}>
                    <div className={cn(
                      "p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] md:rounded-tr-none text-sm leading-relaxed shadow-xl border transition-all break-words overflow-hidden",
                      msg.role === "user" 
                        ? "bg-zinc-900 text-white border-zinc-800" 
                        : "bg-white text-zinc-700 border-zinc-100 md:rounded-tr-[2.5rem] md:rounded-tl-none rounded-tl-none"
                    )}>
                      {msg.content}
                      
                      {msg.type === "chart" && (
                        <div className="mt-8 h-[200px] w-full bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={msg.data}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                              <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {msg.type === "action" && (
                        <div className="mt-6 flex flex-wrap gap-3">
                          {msg.actions?.map((a, i) => (
                            <Button 
                              key={i} 
                              variant="outline" 
                              className="rounded-xl border-blue-200 bg-blue-50/50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-bold text-xs h-10 px-5"
                              onClick={() => toast.success(`Executing: ${a.label}`)}
                            >
                              <a.icon className="w-4 h-4 mr-2" />
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className={cn(
                        "mt-6 text-[10px] font-bold uppercase tracking-widest opacity-40",
                        msg.role === "user" ? "text-white" : "text-zinc-400"
                      )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex gap-6"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                    <Bot className="w-6 h-6 text-zinc-400 animate-pulse" />
                  </div>
                  <div className="bg-white border border-zinc-100 p-6 rounded-[2rem] rounded-tl-none shadow-sm flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 md:p-8 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent flex-none pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto w-full px-1 sm:px-0">
            {/* Chips sit ABOVE the input now to 'carry up' the controls */}
            <div className="flex flex-row items-center justify-center gap-4 md:gap-7 mb-4 md:mb-6 overflow-x-auto no-scrollbar pb-1 px-4">
              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer" onClick={() => handleSend("Analyze Branches")}>
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                Analyze Branches
              </div>
              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer" onClick={() => handleSend("Check Inventory Alert")}>
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                Stock Audits
              </div>
              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer" onClick={() => handleSend("Run Revenue Simulation")}>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Growth Models
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] md:rounded-[2.5rem] blur opacity-10 group-focus-within:opacity-20 transition duration-1000 hidden md:block"></div>
              <div className="relative bg-white border border-zinc-200 rounded-[2rem] md:rounded-[2.5rem] shadow-xl md:shadow-2xl overflow-hidden p-1.5 md:p-3 flex items-end gap-1.5 md:gap-3">
                <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-zinc-900 shrink-0 h-10 w-10 md:h-12 md:w-12">
                  <Plus className="w-5 h-5 md:w-6 md:h-6" />
                </Button>
                <textarea 
                  rows={1}
                  placeholder="Ask your copilot..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] md:text-sm py-3 md:py-4 px-1 md:px-2 resize-none max-h-48 scrollbar-hide font-medium"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex items-center gap-1 md:gap-2 shrink-0 pb-1 md:pb-1.5 pr-1 md:pr-1.5">
                  <Button 
                    size="icon" 
                    className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/40 h-10 w-10 md:h-12 md:w-12 transition-transform active:scale-95"
                    onClick={() => handleSend()}
                  >
                    <Send className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
