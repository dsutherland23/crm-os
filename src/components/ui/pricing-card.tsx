"use client";

import React from "react";
import {
  Add01Icon,
  MinusSignIcon,
  Tick02Icon,
  UserStoryIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { useModules } from "@/context/ModuleContext";
import { toast } from "sonner";
import { CreditCardIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/constants/plan-limits";
import { RefreshCw, ShieldCheck, Zap, Landmark, FileUp, Image as ImageIcon, Trash2, Globe, Copy, CheckCircle2, ChevronRight, Info, RotateCcw, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, addDoc, collection, serverTimestamp } from "@/lib/firebase";
import { recordAuditLog } from "@/lib/audit";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const plans = Object.values(PLAN_LIMITS);


const TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

function PricingCard() {
  const { billing, updateBilling, enterpriseId } = useModules();
  
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    billing.billingCycle || "monthly"
  );
  const [selectedPlan, setSelectedPlan] = useState(billing.planId || "business-pro");
  const [userCounts, setUserCounts] = useState<Record<string, number>>(() => ({
    starter: billing.planId === "starter" ? billing.userCount : PLAN_LIMITS.starter.maxUsers,
    "business-pro": billing.planId === "business-pro" ? billing.userCount : PLAN_LIMITS["business-pro"].maxUsers,
    enterprise: billing.planId === "enterprise" ? billing.userCount : PLAN_LIMITS.enterprise.maxUsers,
  }));
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>(() => ({
    starter: billing.planId === "starter" ? billing.branchCount : PLAN_LIMITS.starter.maxBranches,
    "business-pro": billing.planId === "business-pro" ? billing.branchCount : PLAN_LIMITS["business-pro"].maxBranches,
    enterprise: billing.planId === "enterprise" ? billing.branchCount : PLAN_LIMITS.enterprise.maxBranches,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [autoBill, setAutoBill] = useState<boolean>(billing.autoBill !== false);

  // Sync with context if it changes from cloud
  useEffect(() => {
    setBillingCycle(billing.billingCycle);
    setSelectedPlan(billing.planId);
    setUserCounts(prev => ({ ...prev, [billing.planId]: billing.userCount }));
    setBranchCounts(prev => ({ ...prev, [billing.planId]: billing.branchCount }));
  }, [billing.planId, billing.billingCycle, billing.userCount, billing.branchCount]);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await updateBilling({
        planId: selectedPlan,
        userCount: userCounts[selectedPlan],
        branchCount: branchCounts[selectedPlan],
        billingCycle
      });
      toast.success("Configuration updated successfully!");
    } catch (err) {
      toast.error("Failed to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [handoffStep, setHandoffStep] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  
  // Consolidation State
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [bankMode, setBankMode] = useState<"local" | "international">("local");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [bankRef, setBankRef] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLunipayCheckout = async () => {
    setIsSummaryOpen(false);
    setIsHandoffOpen(true);
    setHandoffStep(0);

    // Stash plan & cycle so Settings can read them back from the return URL
    sessionStorage.setItem("lunipay_pending_plan", selectedPlan);
    sessionStorage.setItem("lunipay_pending_cycle", billingCycle);

    try {
      const breakdown = calculateBreakdown();
      const finalAmount = billingCycle === "yearly" ? breakdown.total * 12 : breakdown.total;

      // Step 1: Verification
      await new Promise(r => setTimeout(r, 800));
      setHandoffStep(1);

      // Step 2: Call secure backend to create a Lunipay session
      await new Promise(r => setTimeout(r, 800));
      setHandoffStep(2);

      const idToken = await import("@/lib/firebase").then(m => m.auth.currentUser?.getIdToken());
      const response = await fetch("/api/billing/lunipay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          planId: selectedPlan,
          billingCycle,
          userCount: userCounts[selectedPlan],
          branchCount: branchCounts[selectedPlan],
          enterpriseId,
        }),
      });

      if (!response.ok) {
        let errMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            const parsed = JSON.parse(text);
            errMsg = parsed.error || errMsg;
          }
        } catch { /* body was not JSON — use status text */ }
        throw new Error(errMsg);
      }

      const { url } = await response.json();

      // Step 3: Redirect to Lunipay hosted checkout
      await new Promise(r => setTimeout(r, 400));
      window.location.href = url;
    } catch (err: any) {
      console.error("Lunipay Handoff Error:", err);
      toast.error(err.message || "Handshake failed. Please check your connection.");
      setIsHandoffOpen(false);
    }
  };

  const calculateBreakdown = () => {
    const plan = PLAN_LIMITS[selectedPlan as keyof typeof PLAN_LIMITS];
    if (!plan) return { base: 0, users: 0, branches: 0, total: 0, extraUsers: 0, extraBranches: 0 };
    
    const extraUsers = Math.max(0, (userCounts[selectedPlan] ?? plan.maxUsers) - plan.maxUsers);
    const extraBranches = Math.max(0, (branchCounts[selectedPlan] ?? plan.maxBranches) - plan.maxBranches);
    const basePrice = billingCycle === "monthly" ? plan.pricing.monthly : plan.pricing.yearly;
    const userAddonPrice = billingCycle === "monthly" ? plan.addons.userMonthly : plan.addons.userYearly;
    const branchAddonPrice = billingCycle === "monthly" ? plan.addons.branchMonthly : plan.addons.branchYearly;
    
    const total = basePrice + (extraUsers * userAddonPrice) + (extraBranches * branchAddonPrice);
    
    return {
      base: basePrice,
      users: extraUsers * userAddonPrice,
      branches: extraBranches * branchAddonPrice,
      total: total,
      extraUsers,
      extraBranches
    };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setProofFile(f);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setProofPreview(compressed);
        };
      };
      reader.readAsDataURL(f);
    }
  };

  const handleBankSubmit = async () => {
    console.log("[PricingCard] Initiating Bank Submit...", { enterpriseId, selectedPlan, billingCycle });
    
    if (!proofPreview) {
      toast.error("Please upload your transfer receipt proof.");
      return;
    }

    if (!enterpriseId) {
      toast.error("Account verification error. Please refresh and try again.");
      console.error("[PricingCard] Missing enterpriseId during bank submit");
      return;
    }
    
    setIsSubmittingBank(true);
    try {
      const breakdown = calculateBreakdown();
      const finalAmount = billingCycle === "yearly" ? breakdown.total * 12 : breakdown.total;
      
      const noticeRef = await addDoc(collection(db, "billing_notices"), {
        enterprise_id: enterpriseId,
        noticeId: `PAY-${Date.now()}`,
        amount: finalAmount,
        reference: bankRef || "MANUAL_BT",
        status: "PENDING",
        submittedAt: new Date().toISOString(),
        planId: selectedPlan,
        billingCycle: billingCycle,
        receiptData: proofPreview,
        userCount: userCounts[selectedPlan],
        branchCount: branchCounts[selectedPlan],
        created_at: serverTimestamp()
      });

      console.log("[PricingCard] Notice created:", noticeRef.id);

      await recordAuditLog({
        enterpriseId,
        action: "BILLING_PAYMENT_SUBMITTED",
        details: `Manual bank transfer notice submitted for ${selectedPlan} plan ($${finalAmount.toFixed(2)}).`,
        severity: "INFO",
        type: "BILLING",
        metadata: { noticeId: noticeRef.id, planId: selectedPlan, amount: finalAmount }
      });

      toast.success("Payment notification submitted!");
      
      setIsSuccess(true);
      setProofPreview(null);
      setProofFile(null);
      setBankRef("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("[PricingCard] Bank Submit Error:", err);
      toast.error(err.message || "Failed to submit payment notice.");
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const bankDetails = bankMode === "local" ? {
    holder: "DAAN SUTHERLAND",
    bank: "FCIB",
    branch: "NEW KINGSTON",
    transit: "09676",
    acc: "1002141453",
    note: "Jamaica Local Transfer"
  } : {
    holder: "DAAN SUTHERLAND",
    bank: "FCIB",
    swift: "FCIBJMKN",
    acc: "1002141453",
    note: "International Wire Transfer"
  };


  const isChanged = 
    selectedPlan !== billing.planId || 
    billingCycle !== billing.billingCycle || 
    userCounts[selectedPlan] !== billing.userCount || 
    branchCounts[selectedPlan] !== billing.branchCount;

  return (
    <div className="w-full max-w-[450px] flex flex-col gap-6 p-5 px-4 sm:p-6 rounded-4xl sm:rounded-2xl border border-border bg-background shadow-sm transition-colors duration-300 not-prose">
      <div className="flex flex-col gap-4 mb-2">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Select a Plan
        </h1>

        <div className="bg-muted p-1 h-10 w-full rounded-xl ring-1 ring-border flex">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 h-full rounded-lg text-base font-medium relative transition-colors duration-300 ${
              billingCycle === "monthly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {billingCycle === "monthly" && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-background rounded-lg shadow-sm ring-1 ring-border"
                transition={TRANSITION}
              />
            )}
            <span className="relative z-10">Monthly</span>
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`flex-1 h-full rounded-lg text-base font-medium relative transition-colors duration-300 flex items-center justify-center gap-2 ${
              billingCycle === "yearly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {billingCycle === "yearly" && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-background rounded-lg shadow-sm ring-1 ring-border"
                transition={TRANSITION}
              />
            )}
            <span className="relative z-10">Yearly</span>
            <span className="relative z-10 bg-primary text-xs font-black px-1.5 py-0.5 rounded-full uppercase text-primary-foreground tracking-tight whitespace-nowrap font-light">
              16% OFF
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          
          // Pricing logic: Addons from PLAN_LIMITS
          const extraUsers = Math.max(0, userCounts[plan.id] - plan.maxUsers);
          const extraBranches = Math.max(0, branchCounts[plan.id] - plan.maxBranches);
          
          const basePrice = billingCycle === "monthly" ? plan.pricing.monthly : plan.pricing.yearly;
          const userAddonPrice = billingCycle === "monthly" ? plan.addons.userMonthly : plan.addons.userYearly;
          const branchAddonPrice = billingCycle === "monthly" ? plan.addons.branchMonthly : plan.addons.branchYearly;
          
          const totalPrice = basePrice + (extraUsers * userAddonPrice) + (extraBranches * branchAddonPrice);

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className="relative cursor-pointer"
            >
              <div
                className={`relative rounded-xl bg-card border border-foreground/10 transition-colors duration-300 ${
                  isSelected ? "z-10 border-primary border-2" : ""
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
                    <div className="flex gap-4">
                      <div className="mt-1 shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected
                              ? "border-primary"
                              : "border-muted-foreground/15"
                          }`}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="w-4 h-4 rounded-full bg-primary"
                                transition={{
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 25,
                                  duration: 0.2,
                                }}
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-foreground leading-tight">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-muted-foreground lowercase">
                          {plan.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                      <div className="flex flex-col items-end">
                        <AnimatePresence mode="wait" initial={false}>
                          {billingCycle === "monthly" ? (
                            <motion.div
                              key="monthly"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="text-2xl font-black text-foreground"
                            >
                              <NumberFlow
                                value={totalPrice}
                                format={{ style: "currency", currency: "USD" }}
                              />
                              <span className="text-[10px] text-muted-foreground/60 ml-1 font-bold uppercase tracking-widest">/ mo</span>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="yearly"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex flex-col items-end"
                            >
                              <div className="text-2xl font-black text-foreground">
                                <NumberFlow
                                  value={totalPrice * 12}
                                  format={{ style: "currency", currency: "USD" }}
                                />
                                <span className="text-[10px] text-muted-foreground/60 ml-1 font-bold uppercase tracking-widest">/ yr</span>
                              </div>
                              <div className="text-[10px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/10">
                                <NumberFlow
                                  value={totalPrice}
                                  format={{ style: "currency", currency: "USD" }}
                                /> / mo value
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.4,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="overflow-hidden w-full"
                      >
                        <div className="pt-6 flex flex-col gap-6">
                          <div className="flex flex-col gap-3.5">
                            {plan.displayFeatures.map((feature, idx) => (
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  delay: idx * 0.05,
                                  duration: 0.3,
                                }}
                                key={idx}
                                className="flex items-center gap-3 text-sm text-foreground/80 "
                              >
                                <HugeiconsIcon
                                  icon={Tick02Icon}
                                  size={16}
                                  className="text-primary"
                                />
                                {feature}
                              </motion.div>
                            ))}
                          </div>

                          <div className="h-px bg-muted" />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-muted shrink-0 flex items-center justify-center">
                                <HugeiconsIcon
                                  icon={UserStoryIcon}
                                  size={30}
                                  className="text-muted-foreground"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-base font-medium  text-foreground leading-none">
                                  Users
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                                  {userCounts[plan.id] <= plan.maxUsers ? "Included" : `+${userCounts[plan.id] - plan.maxUsers} Additional`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 bg-muted p-1.5 rounded-xl border border-border">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserCounts(prev => ({ ...prev, [plan.id]: Math.max(1, (prev[plan.id] ?? 1) - 1) }));
                                }}
                                className="p-1.5 rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground/60 hover:text-foreground active:scale-95"
                              >
                                <HugeiconsIcon icon={MinusSignIcon} size={14} />
                              </button>
                              <span className="text-sm  w-4 text-center tabular-nums text-foreground/80">
                                <NumberFlow value={userCounts[plan.id] ?? plan.maxUsers} />
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserCounts(prev => ({ ...prev, [plan.id]: (prev[plan.id] ?? 1) + 1 }));
                                }}
                                className="p-1.5 rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground/60 hover:text-foreground active:scale-95"
                              >
                                <HugeiconsIcon icon={Add01Icon} size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-muted shrink-0 flex items-center justify-center">
                                <HugeiconsIcon
                                  icon={Store01Icon}
                                  size={24}
                                  className="text-muted-foreground"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-base font-medium  text-foreground leading-none">
                                  Branches
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                                  {branchCounts[plan.id] <= plan.maxBranches ? "Included" : `+${branchCounts[plan.id] - plan.maxBranches} Additional`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 bg-muted p-1.5 rounded-xl border border-border">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBranchCounts(prev => ({ ...prev, [plan.id]: Math.max(1, (prev[plan.id] ?? 1) - 1) }));
                                }}
                                className="p-1.5 rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground/60 hover:text-foreground active:scale-95"
                              >
                                <HugeiconsIcon icon={MinusSignIcon} size={14} />
                              </button>
                              <span className="text-sm  w-4 text-center tabular-nums text-foreground/80">
                                <NumberFlow value={branchCounts[plan.id] ?? plan.maxBranches} />
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBranchCounts(prev => ({ ...prev, [plan.id]: (prev[plan.id] ?? 1) + 1 }));
                                }}
                                className="p-1.5 rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground/60 hover:text-foreground active:scale-95"
                              >
                                <HugeiconsIcon icon={Add01Icon} size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pt-2 flex flex-col gap-2"
          >
            <button
              onClick={() => setIsSummaryOpen(true)}
              disabled={isSaving}
              className="w-full h-12 bg-zinc-900 text-white rounded-xl font-bold shadow-xl shadow-black/10 hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
              Proceed to Checkout
            </button>
            {isChanged && (
              <button
                onClick={handleUpdate}
                disabled={isSaving}
                className="w-full h-10 text-zinc-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-zinc-900 transition-all disabled:opacity-50"
              >
                Update Config
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isSummaryOpen} onOpenChange={(val) => {
        setIsSummaryOpen(val);
        if (!val) {
          // Reset success state when closing
          setTimeout(() => setIsSuccess(false), 300);
        }
      }}>
        <DialogContent className="rounded-[2.5rem] p-0 max-w-xl overflow-hidden border-none shadow-2xl bg-white">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div 
                key="success-view"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-12 text-center space-y-8"
              >
                <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Submission Received!</h2>
                  <p className="text-sm font-medium text-zinc-500 leading-relaxed px-4">
                    Your payment notice has been logged. Our billing team will verify the transfer and activate your <span className="font-black text-zinc-900">{selectedPlan}</span> plan within 24 hours.
                  </p>
                </div>
                <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100 flex flex-col gap-2">
                   <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                     <span>Status</span>
                     <span className="text-emerald-600">Pending Review</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                     <span>Estimated Time</span>
                     <span className="text-zinc-900">~ 2-4 Hours</span>
                   </div>
                </div>
                <Button onClick={() => setIsSummaryOpen(false)} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black text-sm">
                  Back to Dashboard
                </Button>
              </motion.div>
            ) : (
              <motion.div key="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="bg-zinc-950 p-8 text-center relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />
                  <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] relative z-10">Checkout Summary</h2>
                  <p className="text-zinc-500 text-[10px] font-bold mt-2 uppercase tracking-[0.3em] relative z-10">Select your preferred payment method</p>
                </div>
                
                <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                  {/* Step 1: Order Details */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Details</p>
                    <div className="bg-zinc-50 rounded-3xl p-5 border border-zinc-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-zinc-900 capitalize">{selectedPlan} Plan</span>
                        <span className="text-sm font-black text-zinc-900">${calculateBreakdown().base.toFixed(2)}</span>
                      </div>
                      {(calculateBreakdown().extraUsers > 0 || calculateBreakdown().extraBranches > 0) && (
                        <div className="space-y-2 pt-2 border-t border-zinc-200/50">
                          {calculateBreakdown().extraUsers > 0 && (
                            <div className="flex justify-between items-center text-[11px] text-zinc-500">
                              <span>+{calculateBreakdown().extraUsers} Additional Users</span>
                              <span>${calculateBreakdown().users.toFixed(2)}</span>
                            </div>
                          )}
                          {calculateBreakdown().extraBranches > 0 && (
                            <div className="flex justify-between items-center text-[11px] text-zinc-500">
                              <span>+{calculateBreakdown().extraBranches} Additional Branches</span>
                              <span>${calculateBreakdown().branches.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-zinc-200 text-indigo-600">
                        <span className="text-sm font-black uppercase tracking-widest">Total Due ({billingCycle})</span>
                        <span className="text-xl font-black">${(billingCycle === 'yearly' ? calculateBreakdown().total * 12 : calculateBreakdown().total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Payment Method Selector */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Payment Method</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={() => setPaymentMethod("card")}
                        className={cn(
                          "flex flex-col gap-3 p-5 rounded-3xl border-2 transition-all text-left group",
                          paymentMethod === "card" ? "border-indigo-600 bg-indigo-50/30" : "border-zinc-100 bg-white hover:border-zinc-200"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-colors", paymentMethod === "card" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200")}>
                          <HugeiconsIcon icon={CreditCardIcon} size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-900">Card Payment</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Lunipay Secure Gateway</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => setPaymentMethod("bank")}
                        className={cn(
                          "flex flex-col gap-3 p-5 rounded-3xl border-2 transition-all text-left group",
                          paymentMethod === "bank" ? "border-indigo-600 bg-indigo-50/30" : "border-zinc-100 bg-white hover:border-zinc-200"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-colors", paymentMethod === "bank" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200")}>
                          <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-900">Bank Transfer</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Manual Deposit / Wire</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Payment Method Specific Content */}
                  <AnimatePresence mode="wait">
                    {paymentMethod === "card" ? (
                      <motion.div 
                        key="card-info"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <div className="p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100 flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shrink-0 shadow-sm border border-indigo-50">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Secure Caribbean Gateway</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">We use Lunipay to ensure your payment data is encrypted end-to-end. Supports Visa, MasterCard, and local debit cards.</p>
                          </div>
                        </div>
                        <Button onClick={handleLunipayCheckout} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black shadow-xl shadow-zinc-900/20 text-sm gap-2">
                          Pay via Secure Card
                          <ChevronRight className="w-4 h-4" />
                        </Button>

                        {/* ── Auto-Bill Toggle ───────────────────────── */}
                        <div className={cn(
                          "rounded-2xl border p-4 space-y-3 transition-all",
                          autoBill ? "bg-emerald-50/40 border-emerald-100" : "bg-amber-50/40 border-amber-200"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <RotateCcw className={cn("w-4 h-4", autoBill ? "text-emerald-600" : "text-amber-600")} />
                              <span className="text-xs font-black text-zinc-900">Auto-Renewal</span>
                            </div>
                            <button
                              onClick={() => {
                                const next = !autoBill;
                                setAutoBill(next);
                                updateBilling({ autoBill: next });
                                toast[next ? "success" : "warning"](next ? "Auto-renewal enabled." : "Auto-renewal disabled.", {
                                  description: next
                                    ? "Your subscription will renew automatically."
                                    : "You will need to manually renew before your plan expires."
                                });
                              }}
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 ease-in-out focus:outline-none",
                                autoBill ? "bg-emerald-500 border-emerald-500" : "bg-zinc-300 border-zinc-300"
                              )}
                            >
                              <span className={cn(
                                "pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-300",
                                autoBill ? "translate-x-5" : "translate-x-0.5"
                              )} />
                            </button>
                          </div>

                          {/* Next billing date */}
                          {billing.renewalDate && (
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Next charge: <span className="font-black text-zinc-700">
                                  {new Date(billing.renewalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                </span>
                              </span>
                            </div>
                          )}

                          {/* Warning when disabled */}
                          {!autoBill && (
                            <div className="flex items-start gap-2 mt-1 pt-2 border-t border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                                Auto-renewal is off. Your subscription will expire on the billing date and will not renew automatically.
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="bank-info"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-6"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Bank Details</p>
                            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                              <button onClick={() => setBankMode("local")} className={cn("px-3 py-1 rounded-md text-[9px] font-black transition-all", bankMode === "local" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>LOCAL</button>
                              <button onClick={() => setBankMode("international")} className={cn("px-3 py-1 rounded-md text-[9px] font-black transition-all", bankMode === "international" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>INTL</button>
                            </div>
                          </div>
                          
                          <div className="bg-zinc-50 rounded-3xl border border-zinc-200 p-6 space-y-4">
                            {Object.entries(bankDetails).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center group/item">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{key}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-900">{value}</span>
                                  <button onClick={() => copyToClipboard(value)} className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-indigo-600 hover:bg-indigo-50 rounded-md">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Submit Proof of Payment</p>
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                              <input 
                                type="text" 
                                value={bankRef} 
                                onChange={e => setBankRef(e.target.value)}
                                placeholder="Transaction ID / Reference Number"
                                className="w-full h-12 px-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-black text-zinc-900 outline-none focus:border-indigo-600 transition-all"
                              />
                            </div>
                            {!proofPreview ? (
                              <label className="flex flex-col items-center justify-center w-full h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[2.5rem] cursor-pointer hover:bg-zinc-100 hover:border-indigo-300 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-zinc-400">
                                  <ImageIcon className="w-8 h-8 mb-2" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider">Upload Transfer Receipt</p>
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
                              </label>
                            ) : (
                              <div className="relative rounded-[2rem] overflow-hidden border border-zinc-200 aspect-[2/1] group">
                                <img src={proofPreview} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button onClick={() => { setProofFile(null); setProofPreview(null); }} className="w-10 h-10 rounded-full bg-white text-rose-600 flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button onClick={handleBankSubmit} disabled={isSubmittingBank || !proofPreview} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black shadow-xl shadow-zinc-900/20 text-sm gap-2">
                          {isSubmittingBank ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Submit Payment Notice"}
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <Info className="w-4 h-4 text-zinc-400 shrink-0" />
                    <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
                      By proceeding, you agree to Orivo's Terms of Service. 
                      <span className="font-bold text-zinc-900"> No Refund Policy</span> applies to all digital subscriptions.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* High-Fidelity Handoff Dialog */}
      <Dialog open={isHandoffOpen} onOpenChange={setIsHandoffOpen}>
        <DialogContent className="rounded-[2.5rem] p-12 max-w-sm text-center border-none shadow-2xl bg-white overflow-hidden">
          <div className="space-y-8 relative z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto shadow-inner">
                {handoffStep === 0 && <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />}
                {handoffStep === 1 && <ShieldCheck className="w-10 h-10 text-emerald-500 animate-bounce" />}
                {handoffStep === 2 && <Zap className="w-10 h-10 text-amber-500 animate-pulse" />}
              </div>
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-12">
                <HugeiconsIcon icon={CreditCardIcon} size={24} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                {handoffStep === 0 && "Initializing..."}
                {handoffStep === 1 && "Verifying Order"}
                {handoffStep === 2 && "Securing Portal"}
              </h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">
                {handoffStep === 0 && "Preparing your secure checkout session..."}
                {handoffStep === 1 && "Validating plan integrity and addons..."}
                {handoffStep === 2 && "Handing off to Lunipay Gateway..."}
              </p>
            </div>

            <div className="flex gap-1.5 justify-center">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500", 
                  handoffStep === i ? "w-8 bg-indigo-600" : (handoffStep > i ? "w-4 bg-emerald-500" : "w-1.5 bg-zinc-100")
                )} />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-50/20 via-transparent to-transparent pointer-events-none" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PricingCard;
