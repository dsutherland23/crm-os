import { db, collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "./firebase";

export enum LedgerAccount {
  CASH = "CASH",
  SALES = "SALES",
  EXPENSE = "EXPENSE",
  RECEIVABLE = "RECEIVABLE",
  PAYABLE = "PAYABLE"
}

export interface LedgerEntry {
  enterprise_id: string;
  timestamp: any;
  amount: number;
  type: "DEBIT" | "CREDIT";
  account: LedgerAccount;
  source_id: string; // ID of the transaction, invoice, or expense
  source_type: "POS_TRANSACTION" | "INVOICE" | "EXPENSE";
  description: string;
  metadata?: any;
}

/**
 * Record a financial event using Double-Entry Bookkeeping.
 * Every event creates a balanced pair of Debit and Credit entries.
 */
export async function recordFinancialEvent(params: {
  enterpriseId: string;
  amount: number;
  sourceId: string;
  sourceType: "POS_TRANSACTION" | "INVOICE" | "EXPENSE";
  description: string;
  metadata?: any;
}) {
  const { enterpriseId, amount, sourceId, sourceType, description, metadata } = params;
  const entries: Omit<LedgerEntry, "id">[] = [];

  // Logic for Double-Entry mapping
  switch (sourceType) {
    case "POS_TRANSACTION":
      // Debit Cash (Asset increases), Credit Sales (Revenue increases)
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
        account: LedgerAccount.SALES,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;

    case "INVOICE":
      // If Paid: Debit Cash, Credit Sales
      // If Pending: Debit Receivable, Credit Sales
      const isPaid = metadata?.status === "PAID";
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
      entries.push({
        enterprise_id: enterpriseId,
        timestamp: serverTimestamp(),
        amount,
        type: "CREDIT",
        account: LedgerAccount.SALES,
        source_id: sourceId,
        source_type: sourceType,
        description,
        metadata
      });
      break;

    case "EXPENSE":
      // Debit Expense (Expense increases), Credit Cash (Asset decreases)
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
        account: LedgerAccount.CASH,
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

  // Proactive Aggregation (Client-side fast-path using atomic increments)
  // This ensures the dashboard stays updated even before the Cloud Function fires.
  const summaryRef = doc(db, "financial_summaries", enterpriseId);
  
  const updates: any = {
    last_updated: serverTimestamp()
  };

  if (sourceType === "POS_TRANSACTION" || (sourceType === "INVOICE" && metadata?.status === "PAID")) {
    updates.total_revenue = increment(amount);
    updates.net_profit = increment(amount);
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
