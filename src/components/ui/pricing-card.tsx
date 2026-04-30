"use client";

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
import { useState, useEffect } from "react";
import { useModules } from "@/context/ModuleContext";
import { toast } from "sonner";
import { WiPayService, defaultWiPayConfig } from "@/lib/wipay";
import { CreditCardIcon } from "@hugeicons/core-free-icons";

import { PLAN_LIMITS } from "@/constants/plan-limits";

const plans = Object.values(PLAN_LIMITS);


const TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

function PricingCard() {
  const { billing, updateBilling } = useModules();
  
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

  const handleWiPayCheckout = async () => {
    setIsSaving(true);
    try {
      const plan = PLAN_LIMITS[selectedPlan as keyof typeof PLAN_LIMITS];
      
      // Calculate total for WiPay
      const extraUsers = Math.max(0, userCounts[selectedPlan] - plan.maxUsers);
      const extraBranches = Math.max(0, branchCounts[selectedPlan] - plan.maxBranches);
      const basePrice = billingCycle === "monthly" ? plan.pricing.monthly : plan.pricing.yearly;
      const userAddonPrice = billingCycle === "monthly" ? plan.addons.userMonthly : plan.addons.userYearly;
      const branchAddonPrice = billingCycle === "monthly" ? plan.addons.branchMonthly : plan.addons.branchYearly;
      const total = basePrice + (extraUsers * userAddonPrice) + (extraBranches * branchAddonPrice);

      const wipay = new WiPayService({
        ...defaultWiPayConfig,
        currency: "USD" // or TTD based on user settings
      });

      const checkoutUrl = await wipay.getCheckoutUrl({
        total: billingCycle === "yearly" ? total * 12 : total,
        orderId: `SUB-${billing.enterpriseId || "NEW"}-${Date.now()}`,
        customerName: billing.enterpriseId || "Customer",
        customerEmail: "connect@orivocrm.pro", // Should pull from auth/branding
        returnUrl: window.location.href,
        responseUrl: "https://us-central1-crm-os.cloudfunctions.net/wipayWebhook", // Example webhook
      });

      toast.info("Redirecting to WiPay Secure Gateway...");
      setTimeout(() => {
        window.location.href = checkoutUrl;
      }, 1500);
    } catch (err) {
      toast.error("Checkout initialization failed.");
      setIsSaving(false);
    }
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
                  <div className="flex justify-between items-start">
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
                    <div className="text-right">
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
        {isChanged && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pt-2 flex flex-col gap-2"
          >
            <button
              onClick={handleWiPayCheckout}
              disabled={isSaving}
              className="w-full h-12 bg-zinc-900 text-white rounded-xl font-bold shadow-xl shadow-black/10 hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <HugeiconsIcon icon={CreditCardIcon} size={18} />
              {isSaving ? "Initializing..." : "Secure Checkout via WiPay"}
            </button>
            <button
              onClick={handleUpdate}
              disabled={isSaving}
              className="w-full h-10 text-zinc-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-zinc-900 transition-all disabled:opacity-50"
            >
              Save Configuration (Internal)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PricingCard;
