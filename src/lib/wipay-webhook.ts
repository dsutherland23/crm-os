/**
 * FIREBASE CLOUD FUNCTION: WiPay Webhook Handler
 * 
 * Instructions:
 * 1. Copy this logic into your 'functions/index.js' or 'functions/src/index.ts'
 * 2. Deploy: firebase deploy --only functions
 * 3. Set the 'response_url' in WiPay dashboard to your function URL:
 *    https://[your-region]-[your-project].cloudfunctions.net/wipayWebhook
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

// Note: You must implement an MD5 helper in your functions environment
// or use 'crypto' module
const crypto = require('crypto');
function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

exports.wipayWebhook = functions.https.onRequest(async (req, res) => {
  // WiPay sends response via POST or GET depending on configuration
  const data = req.method === 'POST' ? req.body : req.query;
  
  const { 
    transaction_id, 
    status, 
    message, 
    order_id, 
    total, 
    hash,
    customer_name,
    customer_email
  } = data;

  if (!order_id) {
    return res.status(400).send("Missing order_id");
  }

  try {
    // 1. Fetch the pending payment to get the tenant's API Key
    const paymentSnap = await db.collection("payments")
      .where("order_id", "==", order_id)
      .limit(1)
      .get();

    if (paymentSnap.empty) {
      return res.status(404).send("Order not found");
    }

    const paymentDoc = paymentSnap.docs[0];
    const paymentData = paymentDoc.data();
    const tenantId = paymentData.tenant_id;

    // 2. Fetch Merchant Config for this tenant
    const enterpriseSnap = await db.collection("enterprise_settings").doc(tenantId).get();
    if (!enterpriseSnap.exists()) {
      return res.status(404).send("Tenant settings not found");
    }
    
    const config = enterpriseSnap.data().billing?.wipay_config;
    if (!config || !config.api_key) {
      return res.status(500).send("Merchant WiPay configuration missing");
    }

    // 3. Security Check: Validate Hash
    // Formula: md5(transaction_id + total + api_key)
    const calculatedHash = md5(transaction_id + total.toString() + config.api_key);
    
    if (calculatedHash.toLowerCase() !== hash.toLowerCase()) {
      console.error("Hash validation failed for order:", order_id);
      await paymentDoc.ref.update({
        status: "error",
        message: "Webhook security hash mismatch",
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(403).send("Hash mismatch");
    }

    // 4. Update Payment Record
    const finalStatus = status === "success" ? "paid" : status === "failed" ? "failed" : "error";
    
    await paymentDoc.ref.update({
      status: finalStatus,
      transaction_id,
      hash_validated: true,
      raw_response: data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. If Paid, Update Invoice & Balance
    if (finalStatus === "paid") {
      const batch = db.batch();
      
      // Update Invoice
      if (paymentData.invoice_id) {
        batch.update(db.collection("invoices").doc(paymentData.invoice_id), {
          status: "Paid",
          paid_at: admin.firestore.FieldValue.serverTimestamp(),
          transaction_id: transaction_id
        });
      }

      // Record Audit Log
      const auditRef = db.collection("audit_logs").doc();
      batch.set(auditRef, {
        enterprise_id: tenantId,
        action: "PAYMENT_WEBHOOK_SUCCESS",
        details: `Webhook confirmed payment of ${paymentData.currency} ${total} for order ${order_id}`,
        severity: "CRITICAL",
        type: "FINANCE",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).send("Internal processing error");
  }
});
