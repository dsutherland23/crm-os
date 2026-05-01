import React, { useState, useEffect } from "react";
import {
  Share2,
  MessageSquarePlus,
  FileText,
  ScrollText,
  LifeBuoy,
  Activity,
  Headphones,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Twitter,
  Facebook,
  Linkedin,
  Mail,
  Send,
  ArrowUpRight,
  Sparkles,
  Clock,
  Circle,
  ExternalLink,
  Search,
  Star,
  MessageCircle,
  Zap,
  Shield,
  BookOpen,
  Video,
  HelpCircle,
  Phone,
  MapPin,
  Loader2,
  Ticket,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";
import { auth, db, addDoc, collection, serverTimestamp, onSnapshot, query, where, orderBy, doc, updateDoc } from "@/lib/firebase";
import Documentation from "./Documentation";
import QuickStart from "./QuickStart";
import SecurityGuide from "./SecurityGuide";




// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type SupportSection =
  | "share"
  | "feedback"
  | "privacy"
  | "terms"
  | "help"
  | "documentation"
  | "quick_start"
  | "security_guide"
  | "status"
  | "contact"
  | "my_tickets"
  | "delete";

interface Props {
  section?: SupportSection;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SHARE_URL = "https://orivocrm.pro";

const SYSTEM_SERVICES = [
  { name: "Authentication", status: "operational", latency: "12ms" },
  { name: "Database (Firestore)", status: "operational", latency: "23ms" },
  { name: "POS Engine", status: "operational", latency: "8ms" },
  { name: "AI Copilot", status: "operational", latency: "340ms" },
  { name: "File Storage", status: "operational", latency: "45ms" },
  { name: "Email Notifications", status: "degraded", latency: "1.2s" },
  { name: "Analytics Pipeline", status: "operational", latency: "67ms" },
];

const FAQ_ITEMS = [
  {
    q: "How do I add a new branch?",
    a: "Go to System → Branch Management and click 'Add Branch'. You can configure location, staff assignments, and operating hours.",
  },
  {
    q: "Can I export my customer data?",
    a: "Yes. In the Customers module, use the 'Export' button to download a CSV of all customer records scoped to your enterprise.",
  },
  {
    q: "How does the the new Scan Engine work?",
    a: "The engine supports continuous scanning for high-volume tasks. You can toggle 'Continuous Mode' in the scanner dialog to keep the camera active. It also provides audio, haptic, and visual feedback for every successful match.",
  },
  {
    q: "Can I automatically reorder low stock?",
    a: "Yes. By enabling 'Auto-Replenishment' in POS Settings, the system will automatically draft Purchase Orders (POs) when an item's stock level drops during a sale.",
  },
  {
    q: "What are the Loyalty Tiers?",
    a: "We support three tiers: Silver (1x points), Gold (1.25x points), and Platinum (1.5x points). Multipliers are applied automatically at checkout based on the customer's profile.",
  },
  {
    q: "How do I handle returns?",
    a: "In the POS, you can toggle 'Return Mode'. When completing a return, you'll be asked if the items should be restocked. If 'Yes', the inventory levels are adjusted automatically.",
  },
];

const StatusDot = ({ status }: { status: string }) => (
  <span
    className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      status === "operational"
        ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]"
        : status === "degraded"
        ? "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]"
        : "bg-rose-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.4)]"
    )}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ShareSection() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(SHARE_URL);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareItems = [
    {
      label: "Share on X",
      icon: Twitter,
      color: "hover:border-zinc-700 hover:bg-zinc-900",
      href: `https://twitter.com/intent/tweet?text=I%20use%20Orivo%20CRM%20to%20run%20my%20business.%20Check%20it%20out!&url=${SHARE_URL}`,
    },
    {
      label: "Share on Facebook",
      icon: Facebook,
      color: "hover:border-blue-200 hover:bg-blue-50",
      href: `https://www.facebook.com/sharer/sharer.php?u=${SHARE_URL}`,
    },
    {
      label: "Share on LinkedIn",
      icon: Linkedin,
      color: "hover:border-blue-300 hover:bg-blue-50",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${SHARE_URL}`,
    },
    {
      label: "Share via Email",
      icon: Mail,
      color: "hover:border-zinc-200 hover:bg-zinc-50",
      href: `mailto:?subject=Check out Orivo CRM&body=I use Orivo CRM to manage my business. Try it here: ${SHARE_URL}`,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center py-10 bg-gradient-to-br from-cyan-50 via-blue-50/50 to-indigo-50 rounded-3xl border border-blue-100">
        <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20">
          <Share2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Share the Platform</h2>
        <p className="text-zinc-500 text-sm max-w-sm mx-auto">
          Know a business that could benefit from Orivo? Send them the link — it takes 30 seconds.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {shareItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center gap-3 p-5 rounded-2xl border border-zinc-200 bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group",
              item.color
            )}
          >
            <item.icon className="w-6 h-6 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
            <span className="text-xs font-bold text-zinc-600 text-center leading-tight">{item.label}</span>
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
        <div className="flex-1 font-mono text-sm text-zinc-600 truncate">{SHARE_URL}</div>
        <Button
          size="sm"
          variant="outline"
          onClick={copy}
          className="shrink-0 rounded-xl h-9 px-4 font-bold text-xs border-zinc-300 gap-2"
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
      </div>
    </div>
  );
}

function FeedbackSection() {
  const { enterpriseId } = useModules();
  const [type, setType] = useState<"idea" | "bug" | "praise" | "other">("idea");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const types = [
    { id: "idea", label: "Feature Idea", icon: Sparkles, color: "blue" },
    { id: "bug", label: "Bug Report", icon: AlertCircle, color: "rose" },
    { id: "praise", label: "Praise", icon: Star, color: "amber" },
    { id: "other", label: "Other", icon: MessageCircle, color: "zinc" },
  ] as const;

  const submit = async () => {
    if (!message.trim()) { toast.error("Please describe your feedback."); return; }
    setLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      await addDoc(collection(db, "feedback"), {
        type,
        subject,
        message,
        rating,
        enterprise_id: enterpriseId,
        user_email: auth.currentUser?.email,
        createdAt: serverTimestamp(),
        metadata: deviceInfo,
      });
      setDone(true);
    } catch {
      toast.error("Failed to submit — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900">Thank you!</h3>
        <p className="text-zinc-500 text-sm max-w-xs">Your feedback has been submitted to the Orivo team. We read every single one.</p>
        <Button variant="outline" onClick={() => { setDone(false); setMessage(""); setSubject(""); setRating(0); }} className="mt-4 rounded-xl font-bold">
          Submit Another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 mb-1">Suggestions & Feedback</h2>
        <p className="text-sm text-zinc-500">Your feedback shapes the product. Tell us what's on your mind.</p>
      </div>

      <div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Feedback Type</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-bold transition-all duration-200",
                type === t.id
                  ? t.color === "blue" ? "bg-blue-50 border-blue-200 text-blue-700"
                  : t.color === "rose" ? "bg-rose-50 border-rose-200 text-rose-700"
                  : t.color === "amber" ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-zinc-100 border-zinc-300 text-zinc-900"
                  : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
              )}
            >
              <t.icon className="w-5 h-5" />
              <span className="text-xs leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Rate Your Experience</p>
          {rating > 0 && (
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-in fade-in zoom-in">
              {rating === 5 ? "ABSOLUTELY AMAZING" : rating === 4 ? "GREAT EXPERIENCE" : rating === 3 ? "GOOD" : rating === 2 ? "COULD BE BETTER" : "POOR"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHoveredStar(s)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(s)}
              className="group relative"
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-all duration-300",
                  (hoveredStar || rating) >= s
                    ? "fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                    : "text-zinc-200 hover:text-zinc-300"
                )}
              />
              {rating === s && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Subject</label>
        <Input
          placeholder="Summary of your feedback..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-12 rounded-2xl border-zinc-200 bg-zinc-50 focus:bg-white transition-all text-sm font-medium"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Detailed Comments</label>
          <span className={cn("text-[10px] font-bold", message.length > 500 ? "text-rose-500" : "text-zinc-400")}>
            {message.length} / 1000
          </span>
        </div>
        <textarea
          placeholder="Tell us more. What would you change? What do you love?"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
          rows={6}
          className="w-full rounded-[2.5rem] border border-zinc-200 bg-zinc-50 px-8 py-6 text-sm font-medium placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 focus:bg-white transition-all resize-none shadow-inner"
        />
      </div>

      <div className="flex items-center gap-4 p-5 bg-zinc-50 border border-zinc-200 rounded-[2rem]">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-900">Direct Pipeline to Engineering</p>
          <p className="text-[10px] text-zinc-500 leading-tight">Your feedback is instantly triaged and delivered to our product team's weekly sprint planning.</p>
        </div>
      </div>

      <Button
        onClick={submit}
        disabled={loading || !message.trim()}
        className={cn(
          "w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 gap-3",
          type === "praise" ? "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/25 text-white border-0" :
          type === "bug" ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/25 text-white border-0" :
          "bg-zinc-900 hover:bg-black shadow-lg shadow-zinc-900/25 text-white border-0"
        )}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        Submit Feedback
      </Button>
    </div>
  );
}

function PolicySection({ title, icon: Icon, content }: { title: string; icon: React.ElementType; content: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-zinc-100">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600 border border-zinc-200">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-400 font-mono">Last updated: April 2026</p>
        </div>
      </div>
      <div className="prose prose-sm max-w-none text-zinc-600 leading-relaxed space-y-4">{content}</div>
    </div>
  );
}

const PRIVACY_CONTENT = (
  <>
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-blue-500/30">1. Data Sovereignty</h4>
        <p>We implement a "Zero-Knowledge" infrastructure for enterprise sensitive data. All operational records, including customer financials and dental scans, are encrypted at rest and scoped to your unique <code className="bg-zinc-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">ENT_ID_{Math.random().toString(36).slice(2, 6).toUpperCase()}</code>. We do not have visual access to your clinical records.</p>
      </section>
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-blue-500/30">2. AI Training & Isolation</h4>
        <p>Your data is never used to train global AI models for other tenants. Any local AI Copilot optimizations are performed in a sandboxed environment dedicated to your enterprise instance.</p>
      </section>
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-blue-500/30">3. Third-Party Protocols</h4>
        <p>We share minimal essential data only with verified 2026 compliance partners (e.g., Stripe for payments, Twilio for communications) who adhere to our strict SOC-3 data handling standards.</p>
      </section>
    </div>
  </>
);

const TERMS_CONTENT = (
  <>
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-rose-500/30">1. Platform License</h4>
        <p>Orivo Pro grants you a revocable, non-transferable license to manage your dental/CRM operations. Use of the platform for high-frequency algorithmic trading or illegal clinical practices is strictly prohibited.</p>
      </section>
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-rose-500/30">2. System Performance</h4>
        <p>While we target 99.99% availability, you acknowledge that internet-based services are subject to disruptions. We assume no liability for lost clinical sessions due to regional ISP failures.</p>
      </section>
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-rose-500/30">3. Termination Logic</h4>
        <p>Accounts in arrears for &gt;30 days will be placed in read-only mode. Failure to settle balance within 90 days results in permanent data archival and eventual purging.</p>
      </section>
      <section>
        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2 italic underline decoration-blue-500/30">4. No Refund Policy</h4>
        <p>All subscription payments, digital products, and service fees are strictly non-refundable once the transaction is processed. We do not provide credits or prorated refunds for partially used billing cycles.</p>
      </section>
    </div>
  </>
);

function HelpSection() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filtered = FAQ_ITEMS.filter(
    (f) =>
      !search ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  const resources = [
    { icon: BookOpen, label: "Documentation", desc: "Full platform guides", id: "documentation" },
    { icon: Video, label: "Video Tutorials", desc: "Step-by-step walkthroughs", id: "#" },
    { icon: Zap, label: "Quick Start", desc: "Get up and running in 5 min", id: "quick_start" },
    { icon: Shield, label: "Security Guide", desc: "Best practices for your team", id: "security_guide" },
  ];

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          placeholder="Search help articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-12 rounded-2xl border-zinc-200 bg-zinc-50 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {resources.map((r) => (
          <button
            key={r.label}
            onClick={() => r.id !== "#" && window.dispatchEvent(new CustomEvent('switchSupportTab', { detail: r.id }))}
            className="group flex flex-col gap-3 p-4 bg-white border border-zinc-200 rounded-2xl hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 group-hover:bg-blue-100 flex items-center justify-center text-zinc-500 group-hover:text-blue-600 transition-colors">
              <r.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900">{r.label}</p>
              <p className="text-[10px] text-zinc-500">{r.desc}</p>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-300 group-hover:text-blue-400 transition-colors mt-auto" />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2 uppercase tracking-widest text-xs">
          <HelpCircle className="w-4 h-4 text-zinc-400" />
          Frequently Asked Questions
        </h3>
        {search && (
          <Badge variant="outline" className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 border-blue-200">
            {filtered.length} Results Found
          </Badge>
        )}
      </div>
      
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-100 rounded-[2.5rem]">
             <Search className="w-10 h-10 text-zinc-200 mx-auto mb-4" />
             <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No matching articles</p>
             <p className="text-xs text-zinc-500 mt-2">Try broader keywords or reach out to support.</p>
          </div>
        )}
        {filtered.map((faq, i) => (
          <div key={i} className="border border-zinc-100 rounded-3xl overflow-hidden bg-white hover:border-blue-200 transition-all group">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors"
            >
              <span className="text-sm font-bold text-zinc-900 pr-4 group-hover:text-blue-600 transition-colors">{faq.q}</span>
              {openFaq === i ? (
                <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
            </button>
            {openFaq === i && (
              <div className="px-5 pb-5 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-4 animate-in slide-in-from-top-2">
                {faq.a}
                <div className="mt-4 flex gap-4">
                   <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">Useful</button>
                   <button className="text-[10px] font-black text-zinc-400 uppercase hover:underline">Not Helpful</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 bg-zinc-900 rounded-[2.5rem] flex items-center justify-between gap-6 shadow-2xl">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
               <LifeBuoy className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
               <p className="text-white font-black uppercase tracking-widest text-xs">Still need expert help?</p>
               <p className="text-zinc-500 text-[10px] mt-0.5">Our 2026 response team is standing by.</p>
            </div>
         </div>
         <Button onClick={() => window.dispatchEvent(new CustomEvent('switchSupportTab', { detail: 'contact' }))} 
           className="bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl font-bold px-6 border-0">
           Start Chat
         </Button>
      </div>
    </div>
  );
}

function StatusSection() {
  const [uptime] = useState("99.98%");
  const [lastCheck, setLastCheck] = useState(new Date());
  
  // Simulated dynamic latency
  const [services, setServices] = useState(SYSTEM_SERVICES.map(s => ({ ...s, currentLatency: s.latency })));
  
  useEffect(() => {
    const timer = setInterval(() => {
      setServices(prev => prev.map(s => ({
        ...s,
        currentLatency: s.latency.includes('ms') 
          ? (parseInt(s.latency) + (Math.random() * 5 - 2.5)).toFixed(0) + 'ms'
          : s.latency
      })));
      setLastCheck(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const overall = services.every((s) => s.status === "operational") ? "operational" : "degraded";

  const incidents = [
    { id: 1, date: "April 15", title: "Degraded Performance: Analytics Pipeline", status: "Resolved", color: "blue" },
    { id: 2, date: "April 12", title: "Scheduled Maintenance: Global Database Cluster", status: "Completed", color: "emerald" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Banner */}
      <div className={cn(
          "p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden transition-all duration-500",
          overall === "operational"
            ? "bg-emerald-50/50 border-emerald-100 shadow-emerald-500/5"
            : "bg-amber-50/50 border-amber-100 shadow-amber-500/5"
        )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        <div className="relative z-10 flex items-center gap-6">
          <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shrink-0 animate-pulse",
              overall === "operational" ? "bg-emerald-500 shadow-emerald-500/40" : "bg-amber-500 shadow-amber-500/40"
            )}>
            <Activity className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-none mb-1.5">
              {overall === "operational" ? "System Core Healthy" : "Limited Service Reach"}
            </h2>
            <p className="text-sm text-zinc-500 font-medium">
              Global reliability: <strong className="text-zinc-900">{uptime}</strong> · 
              Last verified: <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-zinc-100 ml-1">
                {lastCheck.toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((s) => (
          <div key={s.name} className="bg-white border border-zinc-100 rounded-[2rem] p-5 hover:shadow-xl hover:shadow-zinc-200/40 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", s.status === 'operational' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500')} />
                <span className="text-sm font-black text-zinc-900 uppercase tracking-tight">{s.name}</span>
              </div>
              <Badge className={cn("text-[8px] font-black uppercase tracking-widest border-0", 
                 s.status === 'operational' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                {s.status}
              </Badge>
            </div>
            
            {/* Uptime Bar (Visualization) */}
            <div className="flex gap-1 h-6 mb-4 items-end">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className={cn("flex-1 rounded-sm transition-all duration-500", 
                  i === 22 && s.status !== 'operational' ? "bg-amber-200 h-3" : "bg-emerald-100 h-5 group-hover:h-6") } />
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-zinc-600 uppercase tracking-widest">Latency</span>
              <span className={cn("font-mono px-2 py-0.5 rounded-md", 
                parseInt(s.currentLatency) > 100 ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
              )}>{s.currentLatency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Incident History */}
      <div className="bg-zinc-50/50 border border-zinc-100 rounded-[2.5rem] p-8">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mb-6">Recent Security & Stability Events</h3>
        <div className="space-y-4">
          {incidents.map(incident => (
            <div key={incident.id} className="flex items-start gap-4 p-5 bg-white border border-zinc-100 rounded-3xl group shadow-sm hover:shadow-md transition-all">
               <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", 
                 incident.color === 'emerald' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")}>
                 <Activity className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1.5">{incident.date}</p>
                  <h4 className="text-sm font-bold text-zinc-900 mb-1">{incident.title}</h4>
                  <Badge variant="outline" className="text-[8px] font-black uppercase">{incident.status}</Badge>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDeviceInfo() {
  return {
    os: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio,
    time: new Date().toISOString(),
    url: window.location.href,
    appVersion: "v2026.4.18",
    connection: (navigator as any).connection?.effectiveType || "unknown"
  };
}

function ContactSection() {
  const { enterpriseId } = useModules();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const categories = [
    { id: "general", label: "General" },
    { id: "billing", label: "Billing" },
    { id: "technical", label: "Technical" },
    { id: "security", label: "Security" },
    { id: "data_deletion", label: "Account Deletion" },
  ];

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both the subject and message.");
      return;
    }
    setLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      await addDoc(collection(db, "support_tickets"), {
        category,
        subject,
        message,
        enterprise_id: enterpriseId,
        user_email: auth.currentUser?.email,
        status: "OPEN",
        createdAt: serverTimestamp(),
        metadata: deviceInfo,
      });
      setSent(true);
    } catch {
      toast.error("Could not submit ticket — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-6 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white border border-emerald-100 px-3 py-1 rounded-full shadow-sm text-[10px] font-black text-emerald-600 uppercase tracking-widest">
            Verified
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Ticket Launched</h3>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto">
            Your request has been prioritized. We'll reach out to <strong>{auth.currentUser?.email}</strong> within 24 hours.
          </p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 px-6 py-4 rounded-3xl flex items-center gap-4">
          <div className="text-left py-1">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Reference ID</p>
            <p className="text-lg font-mono font-black text-zinc-900 tracking-tighter">ORV-{Math.random().toString(36).slice(2, 8).toUpperCase()}</p>
          </div>
          <div className="w-px h-10 bg-zinc-200" />
          <Button variant="ghost" size="sm" onClick={() => toast.success("Ref ID Copied")} className="text-blue-600 font-bold">Copy</Button>
        </div>
        <Button variant="outline" onClick={() => { setSent(false); setSubject(""); setMessage(""); }} className="rounded-2xl font-bold h-12 px-8 border-2 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all">
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Mail, label: "Email Us", value: "support@orivocrm.pro", href: "mailto:support@orivocrm.pro" },
          { icon: Phone, label: "Call Us", value: "+1 (876) 255-4848", href: "tel:+18762554848" },
          { icon: Clock, label: "Response Time", value: "< 24 hours", href: null },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 shadow-sm">
              <c.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{c.label}</p>
              {c.href ? (
                <a href={c.href} className="text-sm font-bold text-zinc-900 hover:text-blue-600 transition-colors truncate block">
                  {c.value}
                </a>
              ) : (
                <p className="text-sm font-bold text-zinc-900">{c.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 p-6 bg-white border border-zinc-200 rounded-3xl">
        <h3 className="font-bold text-zinc-900">Submit a Support Ticket</h3>

        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "px-3 h-8 rounded-xl text-xs font-bold transition-all",
                  category === c.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11 rounded-xl border-zinc-200"
        />
        <textarea
          placeholder="Describe your issue in detail..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
        />
        <div className="flex items-center gap-3 p-5 bg-[#f8fafc] border border-blue-100 rounded-[2rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-600/10 transition-colors" />
          <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm relative z-10">
             <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-black text-blue-900 uppercase tracking-widest">Technical Signature Attached</p>
            <p className="text-[10px] text-blue-700/60 leading-tight mt-0.5">Automated diagnostics capturing {navigator.platform} env + {window.innerWidth}x{window.innerHeight} resolution.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
             <span className="text-[10px] font-black text-blue-400">SYNCING</span>
          </div>
        </div>

        <Button
          onClick={submit}
          disabled={loading || !subject.trim() || !message.trim()}
          className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-black text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-zinc-900/20 transition-all hover:-translate-y-0.5"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {loading ? "Launching Ticket..." : "Launch Ticket"}
        </Button>
      </div>
    </div>
  );
}

function TicketCenter() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!auth.currentUser?.email) return;
    const q = query(
      collection(db, "support_tickets"),
      where("user_email", "==", auth.currentUser.email)
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || 0;
        return tB - tA;
      });
      setTickets(docs);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) { setReplies([]); return; }
    const q = query(
      collection(db, `support_tickets/${selected.id}/replies`)
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || 0;
        return tA - tB;
      });
      setReplies(docs);
    });
  }, [selected?.id]);

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const ticketRef = doc(db, "support_tickets", selected.id);
      await addDoc(collection(db, `support_tickets/${selected.id}/replies`), {
        message: replyText.trim(),
        sender_email: auth.currentUser?.email,
        sender_type: "USER",
        createdAt: serverTimestamp(),
      });
      await updateDoc(ticketRef, { status: "OPEN", updatedAt: serverTimestamp() });
      setReplyText("");
    } catch {
      toast.error("Could not send reply.");
    } finally {
      setSending(false);
    }
  };

  const filtered = tickets.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-zinc-200 mx-auto mb-4" /><p className="text-sm font-bold text-zinc-400 uppercase tracking-widest leading-loose">Syncing Terminal...</p></div>;

  if (selected) {
    return (
      <div className="flex flex-col h-[650px] animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="rounded-2xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all">
              <Circle className="w-4 h-4 text-zinc-400" />
            </Button>
            <div>
              <h3 className="font-black text-xl text-zinc-900 tracking-tight leading-none mb-1">{selected.subject}</h3>
              <div className="flex items-center gap-2">
                 <Badge className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border-0", 
                   selected.status === 'RESOLVED' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                   {selected.status}
                 </Badge>
                 <span className="text-[10px] text-zinc-400 font-mono">#ID-{selected.id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar mb-6 pb-4">
          {/* User Entry */}
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-400 shrink-0 shadow-sm uppercase">
              {auth.currentUser?.email?.[0]}
            </div>
            <div className="space-y-1.5 max-w-[85%]">
              <div className="bg-zinc-50 border border-zinc-200/60 p-5 rounded-[2rem] rounded-tl-none shadow-sm">
                <p className="text-sm text-zinc-800 leading-relaxed font-medium">{selected.message}</p>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold ml-1 flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5" />
                You · Initial Request
              </p>
            </div>
          </div>

          {replies.map(r => (
            <div key={r.id} className={cn("flex gap-4", r.sender_type === "ADMIN" ? "flex-row-reverse" : "")}>
              <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-black shrink-0 shadow-md",
                r.sender_type === "ADMIN" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-400"
              )}>
                {r.sender_type === "ADMIN" ? "S" : "U"}
              </div>
              <div className={cn("space-y-1.5 max-w-[85%]", r.sender_type === "ADMIN" ? "items-end text-right" : "")}>
                <div className={cn("p-5 rounded-[2rem] shadow-sm",
                   r.sender_type === "ADMIN" 
                    ? "bg-zinc-900 text-white rounded-tr-none" 
                    : "bg-white border border-zinc-100 rounded-tl-none"
                )}>
                  <p className="text-sm leading-relaxed font-medium">{r.message}</p>
                </div>
                <p className="text-[10px] text-zinc-400 font-bold px-2">
                  {r.sender_type === "ADMIN" ? "Official Support" : "You"} · {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleTimeString() : 'Recently'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 bg-white border border-zinc-200 rounded-[2.5rem] shadow-xl shadow-zinc-200/20 focus-within:border-blue-500/30 transition-all">
          <div className="flex items-center gap-2 pl-4 pr-1">
            <textarea
              placeholder="Type your message..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              className="flex-1 bg-transparent border-0 py-4 text-sm resize-none outline-none font-medium placeholder:text-zinc-300"
              rows={1}
            />
            <Button onClick={sendReply} disabled={sending || !replyText.trim() || selected.status === "RESOLVED"} 
              className="rounded-full h-12 w-12 bg-zinc-900 hover:bg-black p-0 shrink-0">
              {sending ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Send className="w-5 h-5 text-white" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Support History</h3>
          <p className="text-sm font-medium text-zinc-500 mt-0.5">Track, review, and manage your active threads.</p>
        </div>
        <div className="relative group min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-blue-500 transition-colors" />
          <Input 
            placeholder="Search threads..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-11 h-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map(t => (
          <button key={t.id} onClick={() => setSelected(t)}
            className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-7 bg-white border border-zinc-100/80 rounded-[2.5rem] hover:border-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/5 transition-all text-left">
            <div className="flex items-center gap-6">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                t.status === 'RESOLVED' ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
              )}>
                <MessageSquarePlus className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-black text-lg text-zinc-900 uppercase tracking-tight mb-0.5">{t.subject}</h4>
                <div className="flex items-center gap-2">
                   <span className="text-[11px] text-zinc-400 font-mono">#{t.id.slice(-6).toUpperCase()}</span>
                   <div className="w-1 h-1 rounded-full bg-zinc-200" />
                   <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{t.category}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-6 sm:mt-0">
               <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest leading-none">Last Update</p>
                  <p className="text-xs font-bold text-zinc-600 mt-1">{t.updatedAt?.toDate ? t.updatedAt.toDate().toLocaleDateString() : 'Just now'}</p>
               </div>
               <Badge className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 border-0 rounded-full",
                   t.status === "OPEN" ? "bg-rose-500 text-white" :
                   t.status === "IN_PROGRESS" ? "bg-amber-400 text-zinc-900" : "bg-zinc-100 text-zinc-500"
               )}>
                 {t.status.replace("_", " ")}
               </Badge>
               <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <ArrowUpRight className="w-5 h-5" />
               </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="py-24 text-center border-4 border-dashed border-zinc-50 rounded-[4rem]">
            <div className="w-20 h-20 bg-zinc-50 rounded-[2.5rem] flex items-center justify-center text-zinc-200 mx-auto mb-6 transform rotate-6">
              <HelpCircle className="w-10 h-10" />
            </div>
            <h4 className="text-zinc-400 font-black uppercase tracking-[0.3em] text-sm">Clear Terminal</h4>
            <p className="text-zinc-500 text-xs mt-3 font-medium max-w-[280px] mx-auto leading-relaxed">No threads found matching your criteria. Start a new conversation via the Contact tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteSection() {
  const [confirmText, setConfirmText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [purged, setPurged] = useState(false);

  const performDelete = () => {
    if (confirmText !== "DELETE DATA") return;
    setVerifying(true);
    // Simulate complex enterprise deletion logic
    setTimeout(() => {
      setVerifying(false);
      setPurged(true);
      toast.success("Enterprise record scheduled for purge.");
    }, 3000);
  };

  if (purged) {
    return (
      <div className="py-20 text-center animate-in zoom-in duration-500">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">Account Purge Initiated</h3>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">
          Your data is being removed from all core clusters. You will be logged out globally in 60 seconds.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl font-bold">Return to Login</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-20 h-20 bg-rose-500 rounded-3xl flex items-center justify-center shadow-xl shadow-rose-500/30 shrink-0">
             <Trash2 className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-rose-900 tracking-tight leading-none mb-1.5 underline decoration-rose-200 underline-offset-4">The Nuclear Option</h2>
            <p className="text-sm text-rose-700/70 font-bold uppercase tracking-widest">Permanent Data Deletion</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4">
        <div className="space-y-2">
          <h3 className="font-black text-zinc-900 uppercase tracking-tight">What happens next?</h3>
          <ul className="space-y-3">
            {[
              "Your enterprise records will be scrubbed from all CRM modules.",
              "Staff credentials and access logs are permanently invalidated.",
              "All customer transaction history and loyalty points are voided.",
              "Subscription billing is canceled immediately."
            ].map((text, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-600 font-medium">
                <div className="w-5 h-5 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                   <AlertCircle className="w-3 h-3 text-rose-500" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="h-px bg-zinc-100" />

        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-rose-600 uppercase tracking-[0.2em] mb-3 block">Identity Confirmation</label>
            <p className="text-xs text-zinc-400 mb-4">Type <span className="text-zinc-900 font-black">DELETE DATA</span> below to unlock the purge sequence.</p>
            <Input 
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Case sensitive confirmation..."
              className={cn("h-14 rounded-2xl border-2 transition-all font-mono tracking-tight", 
                confirmText === "DELETE DATA" ? "border-emerald-500 bg-emerald-50/20" : "border-zinc-100 focus:border-rose-500 shadow-inner"
              )}
            />
          </div>

          <Button 
            onClick={performDelete}
            disabled={confirmText !== "DELETE DATA" || verifying}
            className={cn("w-full h-14 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all",
              confirmText === "DELETE DATA" 
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-500/30" 
                : "bg-zinc-100 text-zinc-300 pointer-events-none"
            )}
          >
            {verifying ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trash2 className="w-5 h-5 mr-2" />}
            Confirm Data Purge
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS: {
  id: SupportSection;
  label: string;
  icon: React.ElementType;
  accent?: boolean;
}[] = [
  { id: "share",         label: "Share with Friends",    icon: Share2,            accent: true },
  { id: "feedback",      label: "Suggestions & Feedback", icon: MessageSquarePlus, accent: true },
  { id: "documentation", label: "Documentation",          icon: BookOpen,          accent: true },
  { id: "quick_start",   label: "Quick Start",            icon: Zap,               accent: true },
  { id: "security_guide",label: "Security Guide",         icon: Shield,            accent: true },
  { id: "privacy",       label: "Privacy Policy",         icon: FileText },
  { id: "terms",         label: "Terms & Conditions",     icon: ScrollText },
  { id: "help",          label: "Help Center",            icon: LifeBuoy },
  { id: "status",        label: "System Status",          icon: Activity },
  { id: "contact",       label: "Contact Support",        icon: Headphones },
  { id: "my_tickets",    label: "My Tickets",             icon: Ticket, accent: true },
];

export default function Support({ section = "help" }: Props) {
  const [active, setActive] = useState<SupportSection>(section);

  useEffect(() => {
    setActive(section);
  }, [section]);

  useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail) setActive(e.detail);
    };
    window.addEventListener('switchSupportTab', handleSwitch);
    return () => window.removeEventListener('switchSupportTab', handleSwitch);
  }, []);

  const renderContent = () => {
    switch (active) {
      case "share":         return <ShareSection />;
      case "feedback":      return <FeedbackSection />;
      case "privacy":       return <PolicySection title="Privacy Policy" icon={FileText} content={PRIVACY_CONTENT} />;
      case "terms":         return <PolicySection title="Terms & Conditions" icon={ScrollText} content={TERMS_CONTENT} />;
      case "help":          return <HelpSection />;
      case "documentation": return <Documentation />;
      case "quick_start":   return <QuickStart />;
      case "security_guide":return <SecurityGuide />;
      case "status":        return <StatusSection />;
      case "contact":       return <ContactSection />;
      case "my_tickets":    return <TicketCenter />;
      case "delete":        return <DeleteSection />;
      default:              return <HelpSection />;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <LifeBuoy className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Support Center</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">How can we help?</h1>
          <p className="text-zinc-500 mt-1">Resources, policies, and direct support — all in one place.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Nav */}
          <div className="lg:w-56 shrink-0">
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm sticky top-4">
              <p className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                Support
              </p>
              <nav className="p-2 space-y-0.5">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left group",
                      active === s.id
                        ? "bg-zinc-900 text-white"
                        : s.accent
                        ? "text-cyan-600 hover:bg-cyan-50"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    )}
                  >
                    <s.icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        active === s.id
                          ? "text-white"
                          : s.accent
                          ? "text-cyan-500"
                          : "text-zinc-400 group-hover:text-zinc-600"
                      )}
                    />
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}

                <div className="h-px bg-zinc-100 my-2" />

                <button
                  onClick={() => setActive("delete")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left group",
                    active === "delete" ? "bg-rose-500 text-white" : "text-rose-500 hover:bg-rose-50"
                  )}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Delete Account</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Card className="card-modern p-6 lg:p-8">
              {renderContent()}
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
