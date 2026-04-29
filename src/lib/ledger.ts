import { db, collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "./firebase";

export enum LedgerAccount {
  CASH = "CASH",
  PETTY_CASH = "PETTY_CASH",
  SALES = "SALES",
  SALES_RETURNS = "SALES_RETURNS",
  EXPENSE = "EXPENSE",
  RECEIVABLE = "RECEIVABLE",
  PAYABLE = "PAYABLE",
  TAX_LIABILITY = "TAX_LIABILITY"
}

export interface LedgerEntry {
  enterprise_id: string;
  timestamp: any;
  amount: number;
  type: "DEBIT" | "CREDIT";
  account: LedgerAccount;
  source_id: string; // ID of the transaction, invoice, or expense
  source_type: "POS_TRANSACTION" | "INVOICE" | "EXPENSE" | "CREDIT_NOTE" | "RETURN" | "PETTY_CASH_FUNDING" | "PAYMENT_RECEIVED" | "INVOICE_VOID";
  description: string;
  metadata?: any;
}

/**
 * Record a financial event using Double-Entry Bookkeeping within a WriteBatch.
 */
export function recordFinancialEventBatch(batch: any, params: {
  enterpriseId: string;
  amount: number;
  sourceId: string;
  sourceType: LedgerEntry["source_type"];
  description: string;
  metadata?: any;
}) {
  const { enterpriseId, amount, sourceId, sourceType, description, metadata: rawMetadata } = params;
  const entries: Omit<LedgerEntry, "id">[] = [];

  const metadata = rawMetadata ? { ...rawMetadata } : {};
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined) metadata[key] = null;
  });

  const taxAmount = Number(metadata?.tax || 0);
  const netAmount = amount - taxAmount;

  // Re-use logic for mapping (internal helper would be better but let's keep it clean for now)
  const createEntries = () => {
    switch (sourceType) {
      case "POS_TRANSACTION":
        entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount, type: "DEBIT", account: LedgerAccount.CASH, source_id: sourceId, source_type: sourceType, description, metadata });
        entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount: netAmount, type: "CREDIT", account: LedgerAccount.SALES, source_id: sourceId, source_type: sourceType, description, metadata });
        if (taxAmount > 0) entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount: taxAmount, type: "CREDIT", account: LedgerAccount.TAX_LIABILITY, source_id: sourceId, source_type: sourceType, description: `GCT collected from ${sourceType}`, metadata });
        break;
      case "RETURN":
      case "CREDIT_NOTE":
        entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount: netAmount, type: "DEBIT", account: LedgerAccount.SALES_RETURNS, source_id: sourceId, source_type: sourceType, description, metadata });
        if (taxAmount > 0) entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount: taxAmount, type: "DEBIT", account: LedgerAccount.TAX_LIABILITY, source_id: sourceId, source_type: sourceType, description: `GCT reversal from ${sourceType}`, metadata });
        entries.push({ enterprise_id: enterpriseId, timestamp: serverTimestamp(), amount, type: "CREDIT", account: metadata?.isRefund ? LedgerAccount.CASH : LedgerAccount.RECEIVABLE, source_id: sourceId, source_type: sourceType, description, metadata });
        break;
      // ... Add others as needed, focusing on POS/CRM core for now
    }
  };

  createEntries();

  const ledgerCol = collection(db, "ledger");
  entries.forEach(entry => {
    batch.set(doc(ledgerCol), entry);
  });

  const summaryRef = doc(db, "financial_summaries", enterpriseId);
  const updates: any = { last_updated: serverTimestamp() };
  if (["POS_TRANSACTION"].includes(sourceType)) {
    updates.total_revenue = increment(netAmount);
    updates.net_profit = increment(netAmount);
  } else if (["RETURN", "CREDIT_NOTE"].includes(sourceType)) {
    updates.total_revenue = increment(-Math.abs(netAmount));
    updates.net_profit = increment(-Math.abs(netAmount));
  }

  batch.update(summaryRef, updates);
}

/**
 * Record a financial event using Double-Entry Bookkeeping.
 * Every event creates a balanced pair of Debit and Credit entries.
 */
export async function recordFinancialEvent(params: {
  enterpriseId: string;
  amount: number;
  sourceId: string;
  sourceType: LedgerEntry["source_type"];
  description: string;
  metadata?: any;
}) {
  const { enterpriseId, amount, sourceId, sourceType, description, metadata: rawMetadata } = params;
  const entries: Omit<LedgerEntry, "id">[] = [];

  // Sanitize metadata to avoid Firestore "undefined" errors
  const metadata = rawMetadata ? { ...rawMetadata } : {};
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined) {
      metadata[key] = null;
    }
  });

  const taxAmount = Number(metadata?.tax || 0);
  const netAmount = amount - taxAmount;

  // Logic for Double-Entry mapping
  switch (sourceType) {
    case "POS_TRANSACTION":
      // Debit Cash (Asset increases)
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "DEBIT",
        account: LedgerAccount.CASH,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      // Credit Sales (Revenue increases) - Net Amount
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount: netAmount,
        type: "CREDIT",
        account: LedgerAccount.SALES,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      // Credit Tax Liability (GCT) if applicable
      if (taxAmount > 0) {
        entries.push({
          enterprise_id: enterpriseId,
          timestamp: serverTimestamp(),
          amount: taxAmount,
          type: "CREDIT",
          account: LedgerAccount.TAX_LIABILITY,
          source_id: sourceId,
          source_type: sourceType,
          description: `GCT collected from ${sourceType}`,
          metadata
        });
      }
      break;

    case "INVOICE":
      const isPaid = metadata?.status === "PAID";
      // Debit Cash or Receivable
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "DEBIT",
        account: isPaid ? LedgerAccount.CASH : LedgerAccount.RECEIVABLE,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      // Credit Sales (Net)
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount: netAmount,
        type: "CREDIT",
        account: LedgerAccount.SALES,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      // Credit Tax Liability
      if (taxAmount > 0) {
        entries.push({
          enterprise_id: enterpriseId,
          timestamp: serverTimestamp(),
          amount: taxAmount,
          type: "CREDIT",
          account: LedgerAccount.TAX_LIABILITY,
          source_id: sourceId,
          source_type: sourceType,
          description: `GCT collected from ${sourceType}`,
          metadata
        });
      }
      break;

    case "RETURN":
    case "CREDIT_NOTE":
      // Reverses a sale: Debit Sales Returns, Credit Cash/Receivable
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount: netAmount,
        type: "DEBIT",
        account: LedgerAccount.SALES_RETURNS,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      // Reverse Tax Liability
      if (taxAmount > 0) {
        entries.push({
          enterprise_id: enterpriseId,
          timestamp: serverTimestamp(),
          amount: taxAmount,
          type: "DEBIT",
          account: LedgerAccount.TAX_LIABILITY,
          source_id: sourceId,
          source_type: sourceType,
          description: `GCT reversal from ${sourceType}`,
          metadata
        });
      }
      // Credit Cash (if refund) or Receivable (if credit note)
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "CREDIT",
        account: metadata?.isRefund ? LedgerAccount.CASH : LedgerAccount.RECEIVABLE,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;

    case "EXPENSE":
      // Debit Expense, Credit Cash or Petty Cash
      const isPettyCash = metadata?.source === "PETTY_CASH";
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "DEBIT",
        account: LedgerAccount.EXPENSE,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "CREDIT",
        account: isPettyCash ? LedgerAccount.PETTY_CASH : LedgerAccount.CASH,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;

    case "PETTY_CASH_FUNDING":
      // Debit Petty Cash (increases), Credit Cash (decreases)
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "DEBIT",
        account: LedgerAccount.PETTY_CASH,
        source_id: sourceId,
        source_type: sourceType,
        description: "Petty Cash Imprest Replenishment",
        metadata
      });
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "CREDIT",
        account: LedgerAccount.CASH,
        source_id: sourceId,
        source_type: sourceType,
        description: "Cash Transfer to Petty Cash Fund",
        metadata
      });
      break;
    case "PAYMENT_RECEIVED":
      // Cash received against a receivable: Debit Cash, Credit Receivable
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "DEBIT",
        account: LedgerAccount.CASH,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "CREDIT",
        account: LedgerAccount.RECEIVABLE,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;

    case "INVOICE_VOID":
      // Reversal of a previously recognized receivable: Debit Sales Returns, Credit Receivable
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount: Math.abs(amount),
        type: "DEBIT",
        account: LedgerAccount.SALES_RETURNS,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount: Math.abs(amount),
        type: "CREDIT",
        account: LedgerAccount.RECEIVABLE,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;
  }

  // Write entries to Firestore
  const ledgerCol = collection(db, "ledger");
  await Promise.all(entries.map(entry => addDoc(ledgerCol, entry)));

  // Proactive Aggregation
  const summaryRef = doc(db, "financial_summaries", enterpriseId);
  const updates: any = { last_updated: serverTimestamp() };

  const isRevenue = ["POS_TRANSACTION", "INVOICE"].includes(sourceType) && (sourceType !== "INVOICE" || metadata?.status === "PAID");
  const isReduction = ["RETURN", "CREDIT_NOTE", "INVOICE_VOID"].includes(sourceType);
  const isCashIn = sourceType === "PAYMENT_RECEIVED";

  if (isRevenue) {
    updates.total_revenue = increment(netAmount);
    updates.net_profit = increment(netAmount);
  } else if (isReduction) {
    updates.total_revenue = increment(-Math.abs(netAmount));
    updates.net_profit = increment(-Math.abs(netAmount));
  } else if (isCashIn) {
    // Payment received moves cash in but doesn't change revenue (already booked at invoice)
    updates.cash_received = increment(amount);
  } else if (sourceType === "EXPENSE") {
    updates.total_expenses = increment(amount);
    updates.net_profit = increment(-amount);
  }

  try {
    await updateDoc(summaryRef, updates);
  } catch (e) {
    // If doc doesn't exist, we skip or initialize (in production you'd handle this better)
  }
}
