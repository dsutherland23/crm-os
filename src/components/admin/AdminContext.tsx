import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { AdminPrincipal, AdminCapability } from "@/lib/admin";

export interface AdminRecord {
  email: string;
  role: "super_admin" | "admin";
  granted_at: string;
  granted_by?: string;
  capabilities?: AdminCapability[];
  scope?: {
    tenantIds?: string[];
    regions?: string[];
    environments?: Array<"production" | "staging">;
  };
}

export interface AdminContextType {
  user: User;
  record: AdminRecord;
  principal: AdminPrincipal;
  isSuperAdmin: boolean;
}

const AdminCtx = createContext<AdminContextType | null>(null);

export const AdminProvider = AdminCtx.Provider;

export function useAdmin(): AdminContextType {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
