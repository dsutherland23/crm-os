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
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useModules } from "@/context/ModuleContext";
import { auth, db, addDoc, collection, serverTimestamp } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type SupportSection =
  | "share"
  | "feedback"
  | "privacy"
  | "terms"
  | "help"
  | "status"
  | "contact"
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
    q: "How does the Loyalty program work?",
    a: "Customers earn points per purchase based on your configured multiplier. Points are redeemable at POS. Configure tiers in the Loyalty module.",
  },
  {
    q: "Is my data isolated from other companies?",
    a: "Absolutely. Every query is scoped to your unique enterprise_id — no data, user, or transaction is ever shared across accounts.",
  },
  {
    q: "How do I reset a staff member's PIN?",
    a: "Go to Staff → select the member → edit their profile and choose 'Reset PIN'. A temporary PIN is generated and can be changed on next login.",
  },
  {
    q: "What payment methods does the POS support?",
    a: "Cash, Card (Stripe), and custom tender types. You can configure accepted methods in POS Settings.",
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
      await addDoc(collection(db, "feedback"), {
        type,
        subject,
        message,
        rating,
        enterprise_id: enterpriseId,
        user_email: auth.currentUser?.email,
        createdAt: serverTimestamp(),
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
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Rate Your Experience</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHoveredStar(s)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(s)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "w-7 h-7 transition-colors",
                  s <= (hoveredStar || rating) ? "fill-amber-400 text-amber-400" : "text-zinc-200"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11 rounded-xl border-zinc-200"
        />
        <textarea
          placeholder="Describe your idea, issue, or experience in detail..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
        />
      </div>

      <Button
        onClick={submit}
        disabled={loading}
        className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold shadow-lg gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {loading ? "Submitting..." : "Submit Feedback"}
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
    <p><strong className="text-zinc-900">1. Data We Collect</strong><br/>We collect information you provide when creating an account (name, email, business name), operational data generated within the platform (transactions, customer records, inventory), and anonymized usage telemetry to improve the product.</p>
    <p><strong className="text-zinc-900">2. How We Use Your Data</strong><br/>Your data is used exclusively to provide and improve the Orivo CRM service. We never sell, rent, or share your enterprise data with third parties. All analytics are aggregated and anonymized.</p>
    <p><strong className="text-zinc-900">3. Data Isolation & Security</strong><br/>Every record is scoped to your unique <code className="bg-zinc-100 px-1 py-0.5 rounded text-xs font-mono">enterprise_id</code>. Firestore security rules enforce strict read/write isolation — no other tenant can access your data under any circumstances.</p>
    <p><strong className="text-zinc-900">4. Data Retention</strong><br/>Your data is retained for the lifetime of your account plus 90 days after deletion to support recovery requests. You may request immediate deletion by contacting our team.</p>
    <p><strong className="text-zinc-900">5. Your Rights</strong><br/>You have the right to access, correct, export, and delete your personal data at any time. Submit a request via the Contact Support form and we will respond within 48 hours.</p>
    <p><strong className="text-zinc-900">6. Contact</strong><br/>For privacy inquiries: <a href="mailto:privacy@orivocrm.pro" className="text-blue-600 underline">privacy@orivocrm.pro</a></p>
  </>
);

const TERMS_CONTENT = (
  <>
    <p><strong className="text-zinc-900">1. Acceptance of Terms</strong><br/>By using Orivo CRM, you agree to these Terms of Service. If you do not agree, please discontinue use immediately.</p>
    <p><strong className="text-zinc-900">2. License</strong><br/>We grant you a limited, non-exclusive, non-transferable license to use the platform for your internal business operations. You may not resell, sublicense, or reverse-engineer any part of the platform.</p>
    <p><strong className="text-zinc-900">3. Acceptable Use</strong><br/>You agree not to use the platform for illegal activities, to store prohibited content, or to attempt unauthorized access to other tenants' data. Violations may result in immediate account suspension.</p>
    <p><strong className="text-zinc-900">4. Account Responsibility</strong><br/>You are responsible for all activity under your enterprise account, including all sub-users. Keep your credentials secure and report any unauthorized access immediately.</p>
    <p><strong className="text-zinc-900">5. Service Availability</strong><br/>We target 99.9% uptime. Planned maintenance windows will be announced at least 24 hours in advance via email and the System Status page.</p>
    <p><strong className="text-zinc-900">6. Limitation of Liability</strong><br/>Orivo is not liable for indirect, incidental, or consequential damages arising from your use of the platform. Our total liability is limited to fees paid in the last 3 months.</p>
    <p><strong className="text-zinc-900">7. Termination</strong><br/>Either party may terminate the agreement with 30 days written notice. We reserve the right to terminate accounts that violate these terms without notice.</p>
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
    { icon: BookOpen, label: "Documentation", desc: "Full platform guides", href: "#" },
    { icon: Video, label: "Video Tutorials", desc: "Step-by-step walkthroughs", href: "#" },
    { icon: Zap, label: "Quick Start", desc: "Get up and running in 5 min", href: "#" },
    { icon: Shield, label: "Security Guide", desc: "Best practices for your team", href: "#" },
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
          <a
            key={r.label}
            href={r.href}
            className="group flex flex-col gap-3 p-4 bg-white border border-zinc-200 rounded-2xl hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 group-hover:bg-blue-100 flex items-center justify-center text-zinc-500 group-hover:text-blue-600 transition-colors">
              <r.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900">{r.label}</p>
              <p className="text-[10px] text-zinc-500">{r.desc}</p>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-300 group-hover:text-blue-400 transition-colors mt-auto" />
          </a>
        ))}
      </div>

      <div>
        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-zinc-400" />
          Frequently Asked Questions
        </h3>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">No articles match your search.</p>
          )}
          {filtered.map((faq, i) => (
            <div key={i} className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-bold text-zinc-900 pr-4">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusSection() {
  const [uptime] = useState("99.98%");
  const overall = SYSTEM_SERVICES.every((s) => s.status === "operational") ? "operational" : "degraded";

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "p-6 rounded-3xl border flex items-center gap-4",
          overall === "operational"
            ? "bg-emerald-50 border-emerald-100"
            : "bg-amber-50 border-amber-100"
        )}
      >
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
            overall === "operational" ? "bg-emerald-500 shadow-emerald-500/30" : "bg-amber-500 shadow-amber-500/30"
          )}
        >
          <Activity className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900">
            {overall === "operational" ? "All Systems Operational" : "Minor Disruption Detected"}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">30-day uptime: <strong>{uptime}</strong> · Last checked: just now</p>
        </div>
      </div>

      <Card className="card-modern overflow-hidden">
        <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 py-4 px-5">
          <CardTitle className="text-sm font-bold text-zinc-900">Service Health</CardTitle>
        </CardHeader>
        <div className="divide-y divide-zinc-50">
          {SYSTEM_SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <StatusDot status={s.status} />
                <span className="text-sm font-medium text-zinc-900">{s.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400">{s.latency}</span>
                <Badge
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider border-0",
                    s.status === "operational"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  )}
                >
                  {s.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg Response", value: "42ms", icon: Zap },
          { label: "Uptime (30d)", value: uptime, icon: Activity },
          { label: "Active Regions", value: "3", icon: MapPin },
        ].map((m) => (
          <div key={m.label} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-center">
            <m.icon className="w-4 h-4 text-zinc-400 mx-auto mb-2" />
            <p className="text-lg font-black text-zinc-900">{m.value}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
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
      await addDoc(collection(db, "support_tickets"), {
        category,
        subject,
        message,
        enterprise_id: enterpriseId,
        user_email: auth.currentUser?.email,
        status: "OPEN",
        createdAt: serverTimestamp(),
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
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900">Ticket Submitted</h3>
        <p className="text-zinc-500 text-sm max-w-xs">
          Our team will respond to <strong>{auth.currentUser?.email}</strong> within 24 hours.
        </p>
        <Button variant="outline" onClick={() => { setSent(false); setSubject(""); setMessage(""); }} className="mt-4 rounded-xl font-bold">
          Submit Another Ticket
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
        <Button
          onClick={submit}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? "Submitting..." : "Submit Ticket"}
        </Button>
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
  { id: "share",    label: "Share with Friends",    icon: Share2,            accent: true },
  { id: "feedback", label: "Suggestions & Feedback", icon: MessageSquarePlus, accent: true },
  { id: "privacy",  label: "Privacy Policy",         icon: FileText },
  { id: "terms",    label: "Terms & Conditions",     icon: ScrollText },
  { id: "help",     label: "Help Center",            icon: LifeBuoy },
  { id: "status",   label: "System Status",          icon: Activity },
  { id: "contact",  label: "Contact Support",        icon: Headphones },
];

export default function Support({ section = "help" }: Props) {
  const [active, setActive] = useState<SupportSection>(section);

  useEffect(() => {
    setActive(section);
  }, [section]);

  const renderContent = () => {
    switch (active) {
      case "share":    return <ShareSection />;
      case "feedback": return <FeedbackSection />;
      case "privacy":  return <PolicySection title="Privacy Policy" icon={FileText} content={PRIVACY_CONTENT} />;
      case "terms":    return <PolicySection title="Terms & Conditions" icon={ScrollText} content={TERMS_CONTENT} />;
      case "help":     return <HelpSection />;
      case "status":   return <StatusSection />;
      case "contact":  return <ContactSection />;
      default:         return <HelpSection />;
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
                  onClick={() => setActive("contact")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition-all duration-200 text-left group"
                >
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
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
