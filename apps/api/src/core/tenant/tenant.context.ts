import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: string;
  branchId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('TenantContext not initialized — ensure TenantMiddleware is applied');
  }
  return ctx;
}
