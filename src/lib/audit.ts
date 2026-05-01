import { db, collection, addDoc, serverTimestamp, doc } from "./firebase";
import { auth } from "./firebase";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AuditType = "SECURITY" | "POS" | "CRM" | "FINANCE" | "SYSTEM" | "BILLING";

export interface AuditLogParams {
  enterpriseId: string;
  action: string;
  details?: string;
  severity: AuditSeverity;
  type: AuditType;
  branchId?: string;
  metadata?: any;
}

/**
 * Record an entry in the enterprise audit trail within a WriteBatch.
 */
export function recordAuditLogBatch(batch: any, params: AuditLogParams) {
  const { enterpriseId, action, details, severity, type, branchId, metadata } = params;
  const auditCol = collection(db, "audit_logs");
  
  batch.set(doc(auditCol), {
    enterprise_id: enterpriseId,
    action,
    details,
    severity,
    type,
    branch_id: branchId || "main",
    user_id: auth.currentUser?.uid || "system",
    user_email: auth.currentUser?.email || "system",
    timestamp: serverTimestamp(),
    metadata: metadata || {}
  });
}

/**
 * Record an entry in the enterprise audit trail.
 * Ensures compliance with 2026 financial and security standards.
 */
export async function recordAuditLog(params: AuditLogParams) {
  try {
    const { enterpriseId, action, details, severity, type, branchId, metadata } = params;
    
    await addDoc(collection(db, "audit_logs"), {
      enterprise_id: enterpriseId,
      action,
      details,
      severity,
      type,
      branch_id: branchId || "main",
      user_id: auth.currentUser?.uid || "system",
      user_email: auth.currentUser?.email || "system",
      timestamp: serverTimestamp(),
      metadata: metadata || {}
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
    // We don't throw here to avoid breaking the primary operation
  }
}
