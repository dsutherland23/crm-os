import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  ClipboardCheck, 
  AlertTriangle,
  RotateCcw,
  Zap
} from "lucide-react";
import { motion } from "motion/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/constants/plan-limits";
import { useModules } from "@/context/ModuleContext";
import { toast } from "sonner";

export function GlobalBillingNotifications() {
  const { enterpriseId, billing, updateBilling } = useModules();
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    planId: string;
    planName: string;
    renewalDate: string;
    orderId: string;
    autoBill: boolean;
    billingCycle: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const orderId = params.get("order") || "";

    if (paymentStatus === "cancelled") {
      // Clean URL immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      toast.warning("Payment session cancelled.", { description: "Your plan has not changed. You can try again anytime." });
      return;
    }

    if (paymentStatus === "success") {
      // Clean URL immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Parse plan from sessionStorage (stashed in PricingCard)
      const storedPlan = sessionStorage.getItem("lunipay_pending_plan") || billing.planId;
      const storedCycle = sessionStorage.getItem("lunipay_pending_cycle") || billing.billingCycle;
      const planName = PLAN_LIMITS[storedPlan as keyof typeof PLAN_LIMITS]?.name || "Business Pro";

      // Optimistic display immediately
      const optimisticRenewal = storedCycle === "yearly"
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

      setPaymentSuccessData({ 
        planId: storedPlan,
        planName, 
        renewalDate: optimisticRenewal, 
        orderId, 
        autoBill: true, 
        billingCycle: storedCycle 
      });
      setIsPaymentSuccessOpen(true);

      // Background: verify with backend and update billing state
      if (orderId && enterpriseId) {
        const storedUsers = sessionStorage.getItem("lunipay_pending_users");
        const storedBranches = sessionStorage.getItem("lunipay_pending_branches");

        import("@/lib/firebase").then(({ auth }) => {
          auth.currentUser?.getIdToken().then(idToken => {
            fetch("/api/billing/lunipay/verify-session", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({
                sessionId: orderId,
                planId: storedPlan,
                billingCycle: storedCycle,
                userCount: storedUsers,
                branchCount: storedBranches,
              }),
            }).then(r => r.json()).then(data => {
              if (data.verified) {
                setPaymentSuccessData(prev => prev ? { ...prev, renewalDate: data.renewalDate, orderId: data.orderId } : prev);
                updateBilling({ 
                  status: "active", 
                  planId: data.planId, 
                  billingCycle: data.billingCycle, 
                  renewalDate: data.renewalDate, 
                  autoBill: true, 
                  lastPaymentOrderId: data.orderId,
                  userCount: Number(storedUsers) || billing.userCount,
                  branchCount: Number(storedBranches) || billing.branchCount,
                });
                sessionStorage.removeItem("lunipay_pending_plan");
                sessionStorage.removeItem("lunipay_pending_cycle");
                sessionStorage.removeItem("lunipay_pending_users");
                sessionStorage.removeItem("lunipay_pending_branches");
              }
            }).catch(console.warn);
          });
        });
      }
    }
  }, [enterpriseId]); // React on enterpriseId availability

  return (
    <PaymentSuccessDialog 
      open={isPaymentSuccessOpen}
      onClose={() => setIsPaymentSuccessOpen(false)}
      data={paymentSuccessData}
    />
  );
}

// ── Payment Success Dialog ──────────────────────────────────────────
function PaymentSuccessDialog({ open, onClose, data }: {
  open: boolean;
  onClose: () => void;
  data: { planId: string; planName: string; renewalDate: string; orderId: string; autoBill: boolean; billingCycle: string } | null;
}) {
  const renewal = data?.renewalDate ? new Date(data.renewalDate) : null;
  const renewalStr = renewal?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] p-0 max-w-md overflow-hidden border-none shadow-2xl bg-white">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white mx-auto mb-6"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Payment Verified!</h2>
            <p className="text-emerald-100 text-[10px] font-bold mt-1 uppercase tracking-[0.3em]">Transaction Complete</p>
          </motion.div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Plan Badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-black">
              <Zap className="w-4 h-4 fill-indigo-400" />
              {data?.planName || "Business"} Plan Activated
            </span>
          </motion.div>

          {/* Details Grid */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-zinc-50 rounded-2xl border border-zinc-100 divide-y divide-zinc-100">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2 text-zinc-500">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Next Renewal</span>
              </div>
              <span className="text-sm font-black text-zinc-900">{renewalStr}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Billing Cycle</span>
              </div>
              <span className="text-sm font-black text-zinc-900 capitalize">{data?.billingCycle || "Monthly"}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2 text-zinc-500">
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Auto-Renewal</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE
              </span>
            </div>
            {data?.orderId && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-2 text-zinc-500">
                  <ClipboardCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Order ID</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 max-w-[160px] truncate">{data.orderId}</span>
              </div>
            )}
          </motion.div>

          {/* New Capabilities Gained */}
          {data?.planId && PLAN_LIMITS[data.planId]?.displayFeatures && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="space-y-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Included in your {data.planName} tier</p>
              <div className="grid grid-cols-1 gap-2">
                {PLAN_LIMITS[data.planId].displayFeatures.slice(0, 4).map((feature, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-700">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Auto-bill notice */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-3 p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
            <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              <span className="font-black">Auto-renewal is ON.</span> Your account will be charged automatically on <span className="font-black">{renewalStr}</span>. You can disable this anytime in Settings → Billing.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-3">
            <Button
              onClick={onClose}
              className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black shadow-xl shadow-zinc-900/20 hover:bg-zinc-800 transition-all"
            >
              Continue to Dashboard
            </Button>
            <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-widest">
              A receipt has been sent to your email
            </p>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
