import React, { useState } from "react";
import { 
  BookOpen, Search, ChevronRight, Layout, ShoppingCart, Package, Users, 
  DollarSign, ShieldAlert, BadgeCheck, Truck, Zap, Activity, ChevronLeft,
  FileText, PlayCircle, Star, Info, MessageSquare, Target, Settings
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  content: {
    subtitle: string;
    sections: {
      title: string;
      text: string;
      bullets?: string[];
      tip?: string;
    }[];
  };
}

const GUIDES: GuideSection[] = [
  {
    id: "dashboard",
    title: "Command Center",
    icon: Layout,
    description: "Real-time enterprise metrics and AI-driven business intelligence.",
    content: {
      subtitle: "Mastering the Dashboard Hub",
      sections: [
        {
          title: "Intelligent Overview",
          text: "The Dashboard is your high-fidelity viewport into the health of your enterprise. It aggregates data from all branches in real-time.",
          bullets: [
            "Revenue Streams: Live tracking of gross income and profit margins.",
            "Operational Health: Real-time status of active POS terminals and staff roster.",
            "Customer Velocity: Monitoring new acquisitions and retention rates."
          ]
        },
        {
          title: "Neural AI Insights",
          text: "The platform uses advanced predictive models to highlight trends before they become issues.",
          tip: "Look for the 'Sparkle' icon in the top right to see AI-generated recommendations for stock replenishment and staff scheduling."
        }
      ]
    }
  },
  {
    id: "pos",
    title: "Point of Sale",
    icon: ShoppingCart,
    description: "High-performance checkout logic, sessions, and AI upselling.",
    content: {
      subtitle: "Advanced POS Operations",
      sections: [
        {
          title: "Session Lifecycle",
          text: "Every register must be opened with a starting float and closed with a verified cash count to maintain audit integrity.",
          bullets: [
            "Opening: Declare your initial cash-in-drawer to begin the shift.",
            "Active State: Perform transactions, apply rewards, and manage the cart.",
            "Closing: Count physical cash and declare discrepancies. This generates a daily registry closure log."
          ]
        },
        {
          title: "AI Upsell Engine",
          text: "During checkout, the system analyzes the cart and suggests relevant additions based on historical customer behavior.",
          bullets: [
            "Smart Suggestions: One-click additions for frequently paired items.",
            "Loyalty Triggers: Automatic alerts when a customer is eligible for a reward."
          ]
        }
      ]
    }
  },
  {
    id: "inventory",
    title: "Inventory Control",
    icon: Package,
    description: "Batch management, stock transfers, and automated procurement.",
    content: {
      subtitle: "Enterprise Stock Logistics",
      sections: [
        {
          title: "Global Stock Ledger",
          text: "Track every item across all branches with a forensic movements log.",
          bullets: [
            "Stock Transfers: Move inventory between branches with a digital chain of custody.",
            "Batch Tracking: Manage perishable goods or serialized items using batches.",
            "Barcode Integration: Use the camera or dedicated scanners for rapid intake."
          ]
        },
        {
          title: "Automated Replenishment",
          text: "Configure low-stock thresholds to trigger procurement alerts.",
          tip: "Enable 'Auto-PO' for strategic partners to have purchase orders drafted automatically when stock hits critical levels."
        }
      ]
    }
  },
  {
    id: "crm",
    title: "Customer Intelligence",
    icon: Users,
    description: "Loyalty systems, clinical records, and personalized engagement.",
    content: {
      subtitle: "CRM & Relationship Logic",
      sections: [
        {
          title: "Deep Profiles",
          text: "Customer records store more than just contact info; they maintain a full history of engagement.",
          bullets: [
            "Transactional History: Every receipt and invoice linked to the profile.",
            "Preferences: Capture specific notes, clinical records, and scanned documents.",
            "Personalized Outreach: AI-generated messaging for birthdays or re-engagement."
          ]
        },
        {
          title: "Loyalty Architecture",
          text: "The platform supports multi-tiered loyalty programs (e.g., Bronze, Silver, Gold).",
          bullets: [
            "Points Accumulation: Earn points automatically during checkout.",
            "Reward Redemption: Deduct points for free products or tiered discounts."
          ]
        }
      ]
    }
  },
  {
    id: "revenue",
    title: "Financial Treasury",
    icon: DollarSign,
    description: "General ledger, automated invoicing, and compliance reporting.",
    content: {
      subtitle: "Revenue & Ledger Management",
      sections: [
        {
          title: "Unified Ledger",
          text: "All financial events across the platform are logged in a central general ledger.",
          bullets: [
            "Invoicing: Create and manage professional invoices for B2B or custom sales.",
            "Expenses: Log operating costs, supplier payments, and staff payroll.",
            "Tax Engine: Automatic VAT/Sales Tax calculations based on regional rules."
          ]
        },
        {
          title: "Treasury Controls",
          text: "Manage petty cash, bank deposits, and inter-branch financial transfers.",
          tip: "Use the 'Audit PDF' tool to generate monthly financial reports for your accounting team."
        }
      ]
    }
  },
  {
    id: "staff",
    title: "Staff & Productivity",
    icon: BadgeCheck,
    description: "Roster management, performance tracking, and security.",
    content: {
      subtitle: "Personnel Management",
      sections: [
        {
          title: "Secure Access",
          text: "Manage staff roles and 4-digit PINs for secure POS access.",
          bullets: [
            "Role RBAC: Define who can perform voids, discounts, or view financials.",
            "Identity Provisioning: Revoke security tokens instantly for deactivated staff."
          ]
        },
        {
          title: "Productivity Metrics",
          text: "Track real-time performance against daily targets.",
          bullets: [
            "ATV tracking: Monitor Average Transaction Value per staff member.",
            "Attendance: Automated clock-in/out logs synced with POS sessions."
          ]
        }
      ]
    }
  },
  {
    id: "audit",
    title: "Audit & Security",
    icon: ShieldAlert,
    description: "Forensic logs, risk scoring, and compliance monitoring.",
    content: {
      subtitle: "Enterprise Compliance Logic",
      sections: [
        {
          title: "Forensic Audit Trail",
          text: "Every action on the platform—from a price change to a login—is captured with a permanent timestamp.",
          bullets: [
            "Technical Metadata: Inspect browser versions, IP addresses, and unique operation IDs.",
            "Risk Scoring: AI flags unusual patterns like excessive voids or after-hours logins."
          ]
        },
        {
          title: "90-Day Retention",
          text: "Audit logs are retained for 90 days as standard, exportable for external regulatory reviews."
        }
      ]
    }
  },
  {
    id: "suppliers",
    title: "Procurement Hub",
    icon: Truck,
    description: "Partner management, purchase orders, and sourcing cycles.",
    content: {
      subtitle: "Supply Chain & Partnerships",
      sections: [
        {
          title: "Partner Ecosystem",
          text: "Maintain a directory of all wholesale suppliers and service partners.",
          bullets: [
            "Credit Limits: Monitor outstanding payables and credit usage per partner.",
            "Performance Rating: Track lead times and delivery accuracy."
          ]
        },
        {
          title: "Digital Procurement",
          text: "Generate Purchase Orders (POs) and track them from 'Draft' to 'Received'.",
          tip: "When a PO is marked as 'Received', the associated items are automatically added to your branch inventory."
        }
      ]
    }
  },
  {
    id: "workflows",
    title: "Logic Workflows",
    icon: Zap,
    description: "Task automation, project boards, and team collaboration.",
    content: {
      subtitle: "Operational Automation",
      sections: [
        {
          title: "Task Delegation",
          text: "Create, assign, and track tasks across your enterprise departments.",
          bullets: [
            "Status Boards: Move tasks through 'Todo', 'Active', and 'Resolved'.",
            "Priority Logic: Flag critical infrastructure tasks or urgent client follow-ups."
          ]
        },
        {
          title: "Automation Triggers",
          text: "Define logic that triggers actions based on system events (e.g., alert manager when inventory is low)."
        }
      ]
    }
  },
  {
    id: "settings",
    title: "System Core",
    icon: Settings,
    description: "Branding, branch configuration, and subscription management.",
    content: {
      subtitle: "Platform Configuration",
      sections: [
        {
          title: "Branding & Identity",
          text: "Customize the platform's look and feel to match your enterprise identity.",
          bullets: [
            "White-Labeling: Upload logos and define brand colors for invoices and receipts.",
            "Localization: Set currency, time zones, and language preferences."
          ]
        },
        {
          title: "Branch Management",
          text: "Provision and manage physical and digital locations.",
          tip: "You can restrict users to specific branches or grant 'Global' access to managers."
        }
      ]
    }
  }
];

export default function Documentation() {
  const [search, setSearch] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<GuideSection | null>(null);

  const filteredGuides = GUIDES.filter(g => 
    g.title.toLowerCase().includes(search.toLowerCase()) || 
    g.description.toLowerCase().includes(search.toLowerCase()) ||
    g.content.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <AnimatePresence mode="wait">
        {!selectedGuide ? (
          <motion.div 
            key="guide-list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Platform Intelligence Center</h2>
                <p className="text-sm font-medium text-zinc-500 mt-0.5">Comprehensive guides for every enterprise module.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input 
                  placeholder="Search documentation..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 rounded-2xl border-zinc-200 bg-zinc-50 focus:bg-white transition-all text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGuides.map((guide) => (
                <Card 
                  key={guide.id} 
                  className="card-modern group cursor-pointer hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden"
                  onClick={() => setSelectedGuide(guide)}
                >
                  <CardContent className="p-0">
                    <div className="p-6 bg-gradient-to-br from-zinc-50 to-white border-b border-zinc-100 flex items-center justify-between group-hover:from-blue-50/50 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-all duration-500">
                        <guide.icon className="w-6 h-6" />
                      </div>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-500 border-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        Core Module
                      </Badge>
                    </div>
                    <div className="p-6">
                      <h3 className="font-black text-lg text-zinc-900 group-hover:text-blue-600 transition-colors">{guide.title}</h3>
                      <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-1.5">{guide.description}</p>
                      <div className="flex items-center gap-2 mt-6 text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        Read Guide <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredGuides.length === 0 && (
              <div className="py-24 text-center border-4 border-dashed border-zinc-50 rounded-[4rem]">
                <Search className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">No matching guides</p>
                <p className="text-xs text-zinc-500 mt-2">Try searching for modules like 'POS' or 'Inventory'.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="guide-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedGuide(null)}
                className="rounded-xl px-4 h-10 font-bold text-xs gap-2 hover:bg-zinc-100"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Guides
              </Button>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase h-9"><PlayCircle className="w-3.5 h-3.5 mr-2" /> Watch Demo</Button>
                 <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase h-9"><FileText className="w-3.5 h-3.5 mr-2" /> PDF Export</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-8">
              <div className="space-y-12">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-[2rem] bg-zinc-900 text-white flex items-center justify-center shadow-2xl shrink-0">
                      <selectedGuide.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-3">Official Logic Documentation</Badge>
                      <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight leading-none">{selectedGuide.content.subtitle}</h1>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  {selectedGuide.content.sections.map((section, idx) => (
                    <div key={idx} className="space-y-4">
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-black text-zinc-400">0{idx + 1}</span>
                        {section.title}
                      </h3>
                      <p className="text-zinc-600 leading-relaxed font-medium">{section.text}</p>
                      
                      {section.bullets && (
                        <div className="grid grid-cols-1 gap-3 pl-11">
                          {section.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                              <p className="text-sm text-zinc-600 font-bold">{bullet}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {section.tip && (
                        <div className="ml-0 sm:ml-11 p-6 bg-amber-50/50 border border-amber-100 rounded-[2rem] flex items-start gap-4">
                           <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                              <Zap className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Neural Pro Tip</p>
                              <p className="text-xs font-bold text-amber-900 leading-relaxed">{section.tip}</p>
                           </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Card className="card-modern bg-zinc-950 text-white border-zinc-800 shadow-2xl">
                  <CardContent className="p-8">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Quick Actions</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Video Tutorials', icon: PlayCircle },
                        { label: 'Security Protocols', icon: ShieldAlert },
                        { label: 'API Reference', icon: Info },
                        { label: 'Community Hub', icon: MessageSquare }
                      ].map((link, lIdx) => (
                        <button key={lIdx} className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors group">
                           <div className="flex items-center gap-3">
                              <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                              <span className="text-xs font-bold">{link.label}</span>
                           </div>
                           <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-white transition-all" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm mb-4">
                      <Target className="w-6 h-6" />
                   </div>
                   <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Need a custom guide?</p>
                   <p className="text-[10px] text-blue-700 font-medium leading-relaxed mb-6">If your team requires specialized training for custom enterprise logic, our documentation engineers can build it for you.</p>
                   <Button variant="outline" className="w-full rounded-xl border-blue-200 text-blue-600 hover:bg-white font-bold text-[10px] uppercase h-10">Request Custom Guide</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
