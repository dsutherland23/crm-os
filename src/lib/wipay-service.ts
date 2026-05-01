import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { PaymentRecord, WiPayConfig, WiPayPayload, WiPayResponse } from "../types/payment";
import { toast } from "sonner";
import { recordAuditLog } from "./audit";
import { recordFinancialEvent } from "./ledger";

/**
 * PRODUCTION-READY WIPAY INTEGRATION SERVICE
 * Supports Jamaica, Caribbean, and International payments.
 */

// Lightweight MD5 for hash validation
function md5(s: string) {
  let k = [], i = 0;
  for (; i < 64;) k[i] = 0 | (Math.abs(Math.sin(++i)) * 4294967296);
  let b = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476],
      a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      c = s + "\x80";
  while (c.length % 64 - 56) c += "\x00";
  for (i = 0; i < c.length; i += 64) {
    let d = b.slice(), j = 0;
    for (; j < 64; j++) {
      let f = [
        (d[1] & d[2]) | (~d[1] & d[3]),
        (d[3] & d[1]) | (~d[3] & d[2]),
        d[1] ^ d[2] ^ d[3],
        d[2] ^ (d[1] | ~d[3])
      ][j >> 4],
      m = [
        [0, 1, 5, 0],
        [1, 5, 3, 1],
        [5, 3, 7, 5],
        [0, 7, 0, 0]
      ][j >> 4],
      e = d[3];
      d[3] = d[2];
      d[2] = d[1];
      d[1] = d[1] + ((((d[0] + f + k[j] + (c.charCodeAt(i + (j * m[1] + m[2]) % 16 + 1) << 8 | c.charCodeAt(i + (j * m[1] + m[2]) % 16))) | 0) << (m = [
        [7, 12, 17, 22],
        [5, 9, 14, 20],
        [4, 11, 16, 23],
        [6, 10, 15, 21]
      ][j >> 4][j % 4])) | (((d[0] + f + k[j] + (c.charCodeAt(i + (j * m[1] + m[2]) % 16 + 1) << 8 | c.charCodeAt(i + (j * m[1] + m[2]) % 16))) | 0) >>> (32 - m)));
      d[0] = e;
    }
    for (j = 0; j < 4; j++) b[j] = b[j] + d[j] | 0;
  }
  return b.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

export class WiPayService {
  private static COLLECTION = "payments";
  private static API_ENDPOINTS = {
    jamaica: "https://jm.wipayfinancial.com/plugins/payments/request",
    caribbean: "https://tt.wipayfinancial.com/plugins/payments/request" // General Caribbean
  };

  /**
   * Initializes a payment request and redirects user to WiPay
   */
  static async createPayment(params: {
    tenantId: string;
    customerId: string;
    invoiceId?: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    config: WiPayConfig;
    returnUrl: string;
  }): Promise<WiPayResponse> {
    const { tenantId, customerId, invoiceId, amount, customerName, customerEmail, config, returnUrl } = params;

    try {
      // 1. Generate unique order ID
      const orderId = `ORV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 2. Idempotency Check: Ensure order_id is unique (handled by timestamp + random)
      
      // 3. Store initial payment record as "pending"
      const paymentData: Partial<PaymentRecord> = {
        tenant_id: tenantId,
        order_id: orderId,
        customer_id: customerId,
        invoice_id: invoiceId,
        amount: amount,
        currency: config.currency,
        status: "pending",
        environment: config.environment,
        customer_name: customerName,
        customer_email: customerEmail,
        payment_method: "credit_card",
        hash_validated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, this.COLLECTION), {
        ...paymentData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 4. Build Payload for WiPay
      const countryCodeMap: Record<string, string> = {
        JMD: "JM",
        TTD: "TT",
        BBD: "BB",
        USD: "TT"
      };

      const payload: WiPayPayload = {
        account_number: config.account_number,
        avs: 0,
        currency: config.currency,
        environment: config.environment,
        fee_structure: "customer_pay",
        method: "credit_card",
        order_id: orderId,
        origin: "OrivoCRM",
        response_url: returnUrl,
        total: amount,
        country_code: countryCodeMap[config.currency] || "JM",
        data: JSON.stringify({
          tenant_id: tenantId,
          customer_id: customerId,
          invoice_id: invoiceId,
          payment_id: docRef.id
        })
      };

      // 5. Send POST request to WiPay API
      const endpoint = config.currency === "JMD" ? this.API_ENDPOINTS.jamaica : this.API_ENDPOINTS.caribbean;
      
      const formBody = Object.entries(payload)
        .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
        .join('&');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody
      });

      const result = await response.json();

      if (result.status === "success" && result.url) {
        // Log event
        await recordAuditLog({
          enterpriseId: tenantId,
          action: "PAYMENT_INITIATED",
          details: `Payment of ${config.currency} ${amount} initiated for order ${orderId}.`,
          severity: "INFO",
          type: "FINANCE",
          metadata: { orderId, paymentId: docRef.id }
        });

        return {
          status: "success",
          url: result.url,
          transaction_id: result.transaction_id
        };
      } else {
        // Update record to error
        await updateDoc(doc(db, this.COLLECTION, docRef.id), {
          status: "error",
          message: result.message || "Failed to get redirect URL",
          updated_at: serverTimestamp()
        });

        return {
          status: "error",
          message: result.message || "WiPay initialization failed"
        };
      }

    } catch (error: any) {
      console.error("WiPay createPayment error:", error);
      return {
        status: "error",
        message: error.message || "Internal system error during payment initialization"
      };
    }
  }

  /**
   * Validates the return hash from WiPay
   * Formula: md5(transaction_id + total + api_key)
   */
  static validateHash(params: {
    transactionId: string;
    total: number;
    apiKey: string;
    returnedHash: string;
  }): boolean {
    const calculated = md5(params.transactionId + params.total.toString() + params.apiKey);
    return calculated.toLowerCase() === params.returnedHash.toLowerCase();
  }

  /**
   * Handles the response from WiPay (called from return page or webhook)
   */
  static async handleResponse(params: {
    order_id: string;
    transaction_id: string;
    status: string;
    total: string;
    hash: string;
    apiKey: string;
    message?: string;
  }): Promise<{ success: boolean; message: string; payment?: PaymentRecord }> {
    const { order_id, transaction_id, status, total, hash, apiKey, message } = params;

    try {
      // 1. Find the pending payment record
      const q = query(collection(db, this.COLLECTION), where("order_id", "==", order_id));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return { success: false, message: "Order not found in database" };
      }

      const paymentDoc = querySnapshot.docs[0];
      const paymentData = paymentDoc.data() as PaymentRecord;

      // 2. Security Validations
      
      // A. Total Mismatch
      if (Math.abs(parseFloat(total) - paymentData.amount) > 0.01) {
        await this.updateStatus(paymentDoc.id, "error", "Total mismatch detected during validation");
        return { success: false, message: "Transaction amount mismatch" };
      }

      // B. Hash Validation
      const isHashValid = this.validateHash({
        transactionId: transaction_id,
        total: parseFloat(total),
        apiKey: apiKey,
        returnedHash: hash
      });

      if (!isHashValid) {
        await this.updateStatus(paymentDoc.id, "error", "Security hash validation failed");
        return { success: false, message: "Security hash mismatch" };
      }

      // 3. Update Payment Status
      const finalStatus: any = status === "success" ? "paid" : status === "failed" ? "failed" : "error";
      
      await updateDoc(doc(db, this.COLLECTION, paymentDoc.id), {
        status: finalStatus,
        transaction_id: transaction_id,
        hash_validated: true,
        message: message || "Handled successfully",
        raw_response: params,
        updated_at: serverTimestamp()
      });

      // 4. Trigger CRM Business Logic on SUCCESS
      if (finalStatus === "paid") {
        await this.processBusinessLogic(paymentData, transaction_id);
      }

      return { 
        success: finalStatus === "paid", 
        message: message || "Payment processed",
        payment: { ...paymentData, status: finalStatus, transaction_id }
      };

    } catch (error: any) {
      console.error("WiPay handleResponse error:", error);
      return { success: false, message: error.message || "Failed to process payment response" };
    }
  }

  private static async updateStatus(id: string, status: string, message: string) {
    await updateDoc(doc(db, this.COLLECTION, id), {
      status,
      message,
      updated_at: serverTimestamp()
    });
  }

  /**
   * Core Business Logic: Mark Invoices as Paid, Ledger Events, etc.
   */
  private static async processBusinessLogic(payment: PaymentRecord, transactionId: string) {
    // 1. Mark Invoice as PAID if invoice_id exists
    if (payment.invoice_id) {
      await updateDoc(doc(db, "invoices", payment.invoice_id), {
        status: "Paid",
        paid_at: serverTimestamp(),
        transaction_id: transactionId,
        payment_method: "WiPay Credit Card"
      });
    }

    // 2. Record Financial Event (Ledger)
    await recordFinancialEvent({
      enterpriseId: payment.tenant_id,
      amount: payment.amount,
      sourceId: payment.id,
      sourceType: 'INVOICE_PAYMENT',
      description: `WiPay Payment for Order ${payment.order_id}`,
      metadata: { 
        transactionId, 
        orderId: payment.order_id, 
        invoiceId: payment.invoice_id,
        customerId: payment.customer_id
      }
    });

    // 3. Log Audit Record
    await recordAuditLog({
      enterpriseId: payment.tenant_id,
      action: "PAYMENT_SUCCESS",
      details: `Successfully processed payment of ${payment.currency} ${payment.amount} via WiPay.`,
      severity: "CRITICAL",
      type: "FINANCE",
      metadata: { transactionId, orderId: payment.order_id }
    });

    // Note: Email receipts and notifications would be triggered here 
    // or via a separate cloud function listener on the 'payments' collection
  }
}
