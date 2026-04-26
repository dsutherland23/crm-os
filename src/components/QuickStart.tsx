import React, { useState } from "react";
import { 
  Zap, CheckCircle2, Circle, ChevronRight, Rocket, Building2, 
  UserPlus, PackagePlus, ShoppingCart, DollarSign, ArrowRight,
  Sparkles, ShieldCheck, PlayCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface QuickStartStep {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  task: string;
  actionLabel: string;
  module: string;
  tips: string[];
}

const STEPS: QuickStartStep[] = [
  {
    id: "branding",
    title: "Identity & Branding",
    icon: Rocket,
    description: "Establish your enterprise presence by configuring your brand identity.",
    task: "Upload your company logo and define your primary trading currency.",
    actionLabel: "Configure Brand",
    module: "settings",
    tips: [
      "Upload a high-resolution PNG for clear invoice printing.",
      "Set your fiscal year start date for accurate tax reporting."
    ]
  },
  {
    id: "branch",
    title: "Branch Provisioning",
    icon: Building2,
    description: "Create your first operational location to begin managing stock and sales.",
    task: "Add a new branch with its physical address and operating hours.",
    actionLabel: "Provision Branch",
    module: "settings",
    tips: [
      "Assign a unique branch ID for inventory tracking.",
      "Define geo-coordinates to enable regional analytics."
    ]
  },
  {
    id: "staff",
    title: "Staff Onboarding",
    icon: UserPlus,
    description: "Add your team and provision their secure access credentials.",
    task: "Create a staff profile and set a 4-digit secure access PIN.",
    actionLabel: "Onboard Team",
    module: "staff",
    tips: [
      "Use RBAC roles to limit financial visibility for junior staff.",
      "Enable 'Shift Alerts' to receive notifications on clock-ins."
    ]
  },
  {
    id: "inventory",
    title: "Inventory Initialization",
    icon: PackagePlus,
    description: "Populate your digital ledger with your first batch of products.",
    task: "Add a product, set its cost price, and define initial stock levels.",
    actionLabel: "Initialize Stock",
    module: "inventory",
    tips: [
      "Use the barcode scanner for rapid item entry.",
      "Define low-stock thresholds to enable automated reordering."
    ]
  },
  {
    id: "pos",
    title: "POS Activation",
    icon: ShoppingCart,
    description: "Prepare your terminal for live transactions and customer engagement.",
    task: "Open a new POS session and perform a $0 test transaction.",
    actionLabel: "Launch Terminal",
    module: "pos",
    tips: [
      "Verify your receipt printer connectivity before going live.",
      "Test the 'AI Upsell' trigger with a sample customer profile."
    ]
  },
  {
    id: "revenue",
    title: "Revenue Logic",
    icon: DollarSign,
    description: "Finalize your financial engine for audit-ready reporting.",
    task: "Configure your local tax rates and invoice numbering sequence.",
    actionLabel: "Finalize Ledger",
    module: "revenue",
    tips: [
      "Sync your bank account for automated reconciliation.",
      "Define your default payment terms (e.g., Net 30)."
    ]
  }
];

export default function QuickStart() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const toggleStep = (id: string) => {
    setCompletedSteps(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const progress = (completedSteps.length / STEPS.length) * 100;
  const currentStep = STEPS[activeStep];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Hero Header */}
      <div className="relative p-6 sm:p-10 bg-zinc-900 rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 rounded-full -ml-32 -mb-32 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Zap className="w-6 h-6 text-white" />
               </div>
               <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-black uppercase tracking-[0.2em] px-4">Deployment Phase 01</Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Ignite Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Enterprise Engine</span>
            </h1>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8">
              Welcome to CRM-OS 2026. Follow this hyper-fast initialization sequence to transition from deployment to live operations in under 5 minutes.
            </p>
            
            <div className="space-y-3">
               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Activation Progress</span>
                  <span className="text-blue-400">{Math.round(progress)}% Complete</span>
               </div>
               <Progress value={progress} className="h-2 bg-white/5 border-0 rounded-full" />
            </div>
          </div>

          <div className="hidden sm:block shrink-0">
             <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] sm:rounded-[2.5rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center backdrop-blur-xl">
                <p className="text-3xl sm:text-4xl font-black text-white">{completedSteps.length}</p>
                <p className="text-[7px] sm:text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">Steps Cleared</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-10">
        {/* Main Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Initialization Sequence</h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Step {activeStep + 1} of {STEPS.length}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="card-modern border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-white to-zinc-50/50">
                <CardContent className="p-6 sm:p-10">
                  <div className="flex flex-col md:flex-row gap-10">
                    <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 text-white flex items-center justify-center shadow-xl shrink-0">
                      <currentStep.icon className="w-10 h-10" />
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">{currentStep.title}</h3>
                        <p className="text-zinc-500 font-medium leading-relaxed">{currentStep.description}</p>
                      </div>

                      <div className="p-6 bg-white border border-zinc-100 rounded-[2rem] shadow-inner">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Required Action</p>
                        <p className="text-sm font-bold text-zinc-900 leading-snug">{currentStep.task}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentStep.tips.map((tip, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="w-3 h-3" />
                            </div>
                            <p className="text-[11px] text-zinc-500 font-bold leading-tight">{tip}</p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-6 flex flex-col sm:flex-row gap-4">
                        <Button 
                          onClick={() => {
                            if (!completedSteps.includes(currentStep.id)) toggleStep(currentStep.id);
                            // In a real app, this would navigate to the module
                            window.location.hash = `#${currentStep.module}`;
                          }}
                          className="h-14 rounded-2xl bg-zinc-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest gap-3 flex-1"
                        >
                          {currentStep.actionLabel} <ArrowRight className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => toggleStep(currentStep.id)}
                          className={cn(
                            "h-14 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all",
                            completedSteps.includes(currentStep.id) 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                              : "border-zinc-100 hover:bg-zinc-50"
                          )}
                        >
                          {completedSteps.includes(currentStep.id) ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Circle className="w-5 h-5 mr-2" />}
                          {completedSteps.includes(currentStep.id) ? "Mark as Done" : "Skip for Now"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pt-4">
             <Button 
               variant="ghost" 
               disabled={activeStep === 0}
               onClick={() => setActiveStep(prev => prev - 1)}
               className="rounded-xl font-bold text-xs"
             >
               Previous Step
             </Button>
             <div className="flex gap-2">
                {STEPS.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveStep(i)}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all",
                      activeStep === i ? "bg-zinc-900 w-8" : "bg-zinc-200 hover:bg-zinc-300"
                    )} 
                  />
                ))}
             </div>
             <Button 
               variant="ghost" 
               disabled={activeStep === STEPS.length - 1}
               onClick={() => setActiveStep(prev => prev + 1)}
               className="rounded-xl font-bold text-xs"
             >
               Next Step
             </Button>
          </div>
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
          <Card className="card-modern bg-white border-zinc-100 shadow-xl p-8">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-8">Deployment Checklist</h3>
            <div className="space-y-4">
              {STEPS.map((step, i) => (
                <button 
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group",
                    activeStep === i ? "bg-zinc-900 shadow-xl shadow-zinc-900/10" : "hover:bg-zinc-50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    completedSteps.includes(step.id) 
                      ? "bg-emerald-500 text-white" 
                      : activeStep === i ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-400 group-hover:bg-white border border-transparent group-hover:border-zinc-200"
                  )}>
                    {completedSteps.includes(step.id) ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-black uppercase tracking-tight", activeStep === i ? "text-white" : "text-zinc-900")}>{step.title}</p>
                    <p className={cn("text-[9px] font-bold uppercase tracking-widest", activeStep === i ? "text-zinc-500" : "text-zinc-400")}>
                      {completedSteps.includes(step.id) ? "Verified" : "Pending Action"}
                    </p>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", activeStep === i ? "text-white translate-x-1" : "text-zinc-200")} />
                </button>
              ))}
            </div>
          </Card>

          <div className="p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                      <PlayCircle className="w-4 h-4" />
                   </div>
                   <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Training Resources</p>
                </div>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mb-6">Need a visual guide? Watch our 2026 deployment masterclass for enterprise managers.</p>
                <Button variant="outline" className="w-full rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-[10px] uppercase h-10">Watch Masterclass</Button>
             </div>
          </div>

          <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 flex items-start gap-4">
             <ShieldCheck className="w-6 h-6 text-blue-500 shrink-0 mt-1" />
             <div>
                <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">SOC-3 Compliant</p>
                <p className="text-[9px] text-blue-700/60 font-bold leading-relaxed">Initialization sequences are gated by mandatory identity protocols.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
