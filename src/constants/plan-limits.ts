export interface PlanLimits {
  name: string;
  maxUsers: number;
  maxBranches: number;
  features: string[];
  pricing: {
    monthly: number;
    yearly: number;
  };
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    name: "Starter",
    maxUsers: 3,
    maxBranches: 1,
    features: ["crm", "pos", "inventory"],
    pricing: { monthly: 49, yearly: 529 }
  },
  professional: {
    name: "Professional",
    maxUsers: 10,
    maxBranches: 5,
    features: ["crm", "pos", "inventory", "finance", "groups", "loyalty"],
    pricing: { monthly: 149, yearly: 1609 }
  },
  enterprise: {
    name: "Enterprise",
    maxUsers: Infinity,
    maxBranches: Infinity,
    features: ["crm", "pos", "inventory", "finance", "groups", "loyalty", "analytics", "workflow", "audit_logs", "ai"],
    pricing: { monthly: 499, yearly: 5389 }
  }
};
