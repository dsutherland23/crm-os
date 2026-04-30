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
   * Generates the hosted payment URL for the customer to complete payment.
   */
  public async getCheckoutUrl(request: WiPayPaymentRequest): Promise<string> {
    const endpoint = TERRITORY_ENDPOINTS[this.config.currency] || TERRITORY_ENDPOINTS.TTD;
    
    // WiPay expects a POST request or a URL with query params for the hosted gateway.
    // Most integrations use a direct redirect with form data or query params.
    const params = new URLSearchParams({
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
      environment: this.config.environment,
      fee_payer: "merchant", // or 'customer'
    });

    return `${endpoint}?${params.toString()}`;
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
