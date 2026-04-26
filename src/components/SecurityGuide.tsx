import React, { useState } from "react";
import { 
  ShieldCheck, ShieldAlert, Lock, Key, Eye, Fingerprint, 
  AlertTriangle, Shield, Search, ChevronRight,
  Database, HardDrive, Network, Globe, Zap, CheckCircle2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface SecurityTopic {
  id: string;
  title: string;
  icon: React.ElementType;
  level: "STANDARD" | "ADVANCED" | "CRITICAL";
  description: string;
  details: {
    label: string;
    text: string;
    technical?: string;
  }[];
}

const SECURITY_TOPICS: SecurityTopic[] = [
  {
    id: "data-isolation",
    title: "Identity Sovereignty",
    icon: Database,
    level: "CRITICAL",
    description: "Every enterprise record is cryptographically isolated and scoped to your unique identity.",
    details: [
      {
        label: "Enterprise ID Scoping",
        text: "Your data never co-mingles with other tenants. Every database query is strictly gated by your enterprise_id at the infrastructure level.",
        technical: "Firestore Security Rules enforce enterprise_id matching on every read/write operation."
      },
      {
        label: "Encryption at Rest",
        text: "All sensitive financial and customer data is encrypted using AES-256 standards before hitting the storage cluster.",
        technical: "Managed by Google Cloud KMS with hardware-backed security modules."
      }
    ]
  },
  {
    id: "rbac",
    title: "RBAC Governance",
    icon: Key,
    level: "CRITICAL",
    description: "Fine-grained control over which staff members can access sensitive modules or perform critical actions.",
    details: [
      {
        label: "Role Definition",
        text: "Define roles such as 'Cashier', 'Manager', or 'Administrator'. Only Administrators can view high-level financial dashboards.",
      },
      {
        label: "Critical Action Gating",
        text: "Actions like Voids, Manual Discounts, and Stock Write-offs require specific permissions or manager overrides.",
      }
    ]
  },
  {
    id: "terminal-security",
    title: "Terminal Hardening",
    icon: Fingerprint,
    level: "ADVANCED",
    description: "Best practices for securing physical POS terminals and staff session management.",
    details: [
      {
        label: "PIN Best Practices",
        text: "Staff should use unique, non-sequential 4-digit PINs. Change PINs immediately if a staff member's credentials are compromised.",
      },
      {
        label: "Automatic Lockouts",
        text: "Configure idle timeouts to automatically lock the POS terminal if no activity is detected for 5 minutes.",
      }
    ]
  },
  {
    id: "forensic-auditing",
    title: "Forensic Monitoring",
    icon: Eye,
    level: "ADVANCED",
    description: "Real-time visibility into system events and user operations for audit compliance.",
    details: [
      {
        label: "Audit Log Inspection",
        text: "Every significant action—logins, price edits, and batch transfers—is recorded in the Forensic Audit Trail.",
      },
      {
        label: "Change Tracking",
        text: "The system captures 'Before' and 'After' states for critical configuration changes, allowing for rapid rollback analysis.",
      }
    ]
  },
  {
    id: "fraud-detection",
    title: "AI Fraud Detection",
    icon: ShieldAlert,
    level: "ADVANCED",
    description: "Neural models monitor for anomalous behavior that may indicate internal or external fraud.",
    details: [
      {
        label: "Pattern Recognition",
        text: "The AI flags unusual patterns such as high-frequency voids, after-hours inventory movements, or repetitive small-value discounts.",
      },
      {
        label: "Risk Scoring",
        text: "Every audit event is assigned a Risk Score. High-risk events trigger immediate notifications to the Enterprise Owner.",
      }
    ]
  }
];

export default function SecurityGuide() {
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<SecurityTopic | null>(null);

  const filteredTopics = SECURITY_TOPICS.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Security Header */}
      <div className="relative p-6 sm:p-10 bg-gradient-to-br from-zinc-900 to-black rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-white/5 text-blue-400 border-blue-500/20 text-[10px] font-black uppercase tracking-[0.2em] px-4">SOC-3 Compliant Platform</Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-zinc-400">Security Protocols</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
              Forensic guides for securing your enterprise data, managing staff access, and implementing AI-driven fraud detection in the 2026 financial ecosystem.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-4 justify-center md:justify-end">
            <div className="p-4 sm:p-6 bg-white/5 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] backdrop-blur-xl text-center min-w-[120px] sm:min-w-[140px]">
               <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mx-auto mb-2" />
               <p className="text-lg sm:text-xl font-black text-white">256-bit</p>
               <p className="text-[7px] sm:text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">AES Encryption</p>
            </div>
            <div className="p-4 sm:p-6 bg-white/5 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] backdrop-blur-xl text-center min-w-[120px] sm:min-w-[140px]">
               <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mx-auto mb-2" />
               <p className="text-lg sm:text-xl font-black text-white">Isolated</p>
               <p className="text-[7px] sm:text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">Global Clusters</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Technical Security Catalog</h2>
            <p className="text-sm font-medium text-zinc-500 mt-0.5">Deep-dive into our infrastructure and governance logic.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Search security topics..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 rounded-2xl border-zinc-200 bg-zinc-50 focus:bg-white transition-all text-xs font-bold shadow-inner"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTopics.map((topic) => (
            <Card 
              key={topic.id}
              className={cn(
                "card-modern group cursor-pointer hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500",
                selectedTopic?.id === topic.id ? "border-blue-500 bg-blue-50/10" : ""
              )}
              onClick={() => setSelectedTopic(topic)}
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-all duration-500">
                    <topic.icon className="w-6 h-6" />
                  </div>
                  <Badge className={cn("text-[8px] font-black uppercase tracking-widest border-0",
                    topic.level === 'CRITICAL' ? "bg-rose-50 text-rose-600" :
                    topic.level === 'ADVANCED' ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"
                  )}>
                    {topic.level}
                  </Badge>
                </div>
                <h3 className="font-black text-lg text-zinc-900 mb-2 group-hover:text-blue-600 transition-colors">{topic.title}</h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed">{topic.description}</p>
                <div className="mt-6 pt-6 border-t border-zinc-50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900 transition-colors">
                  Inspect Logic <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            <div className="h-px bg-zinc-100 mb-4" />
            <div className="flex items-center justify-between">
               <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                 <selectedTopic.icon className="w-6 h-6 text-blue-600" />
                 {selectedTopic.title} Documentation
               </h2>
               <Button variant="ghost" onClick={() => setSelectedTopic(null)} className="rounded-xl font-bold text-xs text-zinc-400 hover:text-zinc-900">Close Inspector</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedTopic.details.map((detail, i) => (
                <Card key={i} className="card-modern border-0 shadow-xl bg-zinc-50/50 p-8">
                   <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">{detail.label}</p>
                   <p className="text-sm font-medium text-zinc-700 leading-relaxed mb-6">{detail.text}</p>
                   {detail.technical && (
                     <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                           <Zap className="w-3 h-3 text-emerald-400" />
                           <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Technical Stack</span>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-300 leading-snug">{detail.technical}</p>
                     </div>
                   )}
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Footer Action */}
      <div className="p-6 sm:p-10 bg-blue-600 rounded-[2rem] sm:rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-blue-600/20">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white backdrop-blur-xl">
               <Shield className="w-8 h-8" />
            </div>
            <div className="text-center md:text-left">
               <p className="text-white font-black text-xl tracking-tight">Need a full Compliance Export?</p>
               <p className="text-blue-100 text-sm font-medium opacity-80">Generate a comprehensive SOC-3 compliant report for your auditors.</p>
            </div>
         </div>
         <Button className="bg-white text-blue-600 hover:bg-zinc-100 rounded-2xl h-14 px-8 font-black text-xs uppercase tracking-widest border-0">
           Generate Report
         </Button>
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-10 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
         {[
           { icon: Shield, label: "GDPR READY" },
           { icon: Network, label: "ENCRYPTED TRANSIT" },
           { icon: HardDrive, label: "REDUNDANT BACKUPS" },
           { icon: AlertTriangle, label: "FRAUD MONITORING" }
         ].map((badge, i) => (
           <div key={i} className="flex items-center gap-2">
              <badge.icon className="w-4 h-4 text-zinc-900" />
              <span className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.3em]">{badge.label}</span>
           </div>
         ))}
      </div>
    </div>
  );
}
