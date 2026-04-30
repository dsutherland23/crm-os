export interface PlanLimits {
  id: string;
  name: string;
  description: string;
  maxUsers: number;
  maxBranches: number;
  features: string[];
  displayFeatures: string[];
  pricing: {
    monthly: number;
    yearly: number;
  };
  addons: {
    userMonthly: number;
    userYearly: number;
    branchMonthly: number;
    branchYearly: number;
  };
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "essential features for small teams",
    maxUsers: 3,
    maxBranches: 1,
    features: ["crm", "pos", "inventory"],
    displayFeatures: [
      "Core CRM functionality",
      "Point of Sale terminal",
      "Basic Inventory management",
      "Up to 500 contacts",
      "Email support"
    ],
    pricing: { monthly: 39, yearly: 32.76 },
    addons: {
      userMonthly: 5,
      userYearly: 4.20,
      branchMonthly: 29,
      branchYearly: 24.36
    }
  },
  "business-pro": {
    id: "business-pro",
    name: "Business Pro",
    description: "power tools for growing teams",
    maxUsers: 25,
    maxBranches: 5,
    features: ["crm", "pos", "inventory", "finance", "groups", "loyalty", "analytics"],
    displayFeatures: [
      "Advanced CRM & Automation",
      "Multi-branch POS Sync",
      "Financial Ledger & Revenue",
      "Loyalty & Rewards engine",
      "Custom reporting",
      "Priority support"
    ],
    pricing: { monthly: 79, yearly: 66.36 },
    addons: {
      userMonthly: 5,
      userYearly: 4.20,
      branchMonthly: 29,
      branchYearly: 24.36
    }
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "full control for large organizations",
    maxUsers: 100,
    maxBranches: 10,
    features: ["crm", "pos", "inventory", "finance", "groups", "loyalty", "analytics", "workflow", "audit_logs", "ai"],
    displayFeatures: [
      "Unlimited contacts",
      "AI-powered Insights",
      "Workflow Automations",
      "Full Forensic Audit Logs",
      "Dedicated account manager",
      "Custom integrations",
      "SSO & Advanced Security"
    ],
    pricing: { monthly: 199, yearly: 167.16 },
    addons: {
      userMonthly: 5,
      userYearly: 4.20,
      branchMonthly: 29,
      branchYearly: 24.36
    }
  }
};
