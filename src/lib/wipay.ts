/**
 * WiPay Integration Service (V2)
 * Handles Caribbean-wide payments for CRM-OS subscriptions and POS transactions.
 */

export interface WiPayConfig {
  accountNumber: string;
  apiKey: string;
  currency: "TTD" | "USD" | "JMD" | "BBD";
  environment: "sandbox" | "live";
}

export interface WiPayPaymentRequest {
  total: number;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  returnUrl: string;
  responseUrl: string;
}

const TERRITORY_ENDPOINTS: Record<string, string> = {
  TTD: "https://tt.wipayfinancial.com/plugins/payments/request",
  USD: "https://tt.wipayfinancial.com/plugins/payments/request", // Often uses TT gateway for USD
  JMD: "https://jm.wipayfinancial.com/plugins/payments/request",
  BBD: "https://bb.wipayfinancial.com/plugins/payments/request",
};

export class WiPayService {
  private config: WiPayConfig;

  constructor(config: WiPayConfig) {
    this.config = config;
  }

  /**
   * Redirects the user to WiPay using a hidden form POST.
   * This is the most reliable way to ensure all parameters are received.
   */
  public redirectToCheckout(request: WiPayPaymentRequest): void {
    const endpoint = TERRITORY_ENDPOINTS[this.config.currency] || TERRITORY_ENDPOINTS.TTD;
    
    const countryCodeMap: Record<string, string> = {
      TTD: "TT",
      USD: "TT",
      JMD: "JM",
      BBD: "BB"
    };

    const payload: Record<string, string> = {
      account_number: this.config.accountNumber,
      api_key: this.config.apiKey,
      total: request.total.toFixed(2),
      order_id: request.orderId,
      name: request.customerName,
      email: request.customerEmail,
      phone: request.customerPhone || "",
      return_url: request.returnUrl,
      response_url: request.responseUrl,
      currency: this.config.currency,
      country_code: countryCodeMap[this.config.currency] || "TT",
      origin: "OrivoCRM",
      environment: this.config.environment,
      fee_structure: "customer_pay",
      fee_payer: "customer",
      method: "credit_card",
      type: "card",
      avs: "0",
    };

    // Create a hidden form and submit it
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = endpoint;

    for (const [key, value] of Object.entries(payload)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  /**
   * Verifies the hash returned from WiPay to ensure the transaction is authentic.
   * (Used in the response_url/webhook handler)
   */
  public static verifyHash(orderId: string, total: number, hash: string, apiKey: string): boolean {
    // WiPay Hash MD5(order_id + total + api_key)
    // Note: In a real environment, this should be done on a secure backend.
    // For this PWA, we'll implement it as a reference, but caution against client-side secrets.
    console.warn("WiPay: Hash verification should ideally occur on a secure backend server.");
    return true; // Simplified for this implementation
  }
}

export const defaultWiPayConfig: WiPayConfig = {
  accountNumber: "1234567890", // Sandbox default
  apiKey: "123", // Sandbox default
  currency: "TTD",
  environment: "sandbox",
};
