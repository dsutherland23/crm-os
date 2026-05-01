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

  public static createRedirect(params: {
    accountNumber: string;
    apiKey: string;
    currency: string;
    environment: string;
    total: number;
    orderId: string;
    name: string;
    email: string;
    phone?: string;
    returnUrl: string;
    responseUrl: string;
    data?: string;
  }): void {
    const endpoints: Record<string, string> = {
      TTD: "https://tt.wipayfinancial.com/plugins/payments/request",
      USD: "https://tt.wipayfinancial.com/plugins/payments/request",
      JMD: "https://jm.wipayfinancial.com/plugins/payments/request",
      BBD: "https://bb.wipayfinancial.com/plugins/payments/request",
    };

    const countryCodes: Record<string, string> = {
      TTD: "TT",
      USD: "TT",
      JMD: "JM",
      BBD: "BB"
    };

    const endpoint = endpoints[params.currency] || endpoints.TTD;

    const payload: Record<string, string> = {
      account_number: params.accountNumber,
      api_key: params.apiKey,
      total: params.total.toFixed(2),
      order_id: params.orderId,
      name: params.name,
      email: params.email,
      phone: params.phone || "",
      return_url: params.returnUrl,
      response_url: params.responseUrl,
      currency: params.currency,
      country_code: countryCodes[params.currency] || "TT",
      origin: "OrivoCRM",
      environment: params.environment,
      fee_structure: "customer_pay",
      method: "credit_card",
      type: "card",
      avs: "0",
    };

    if (params.data) {
      payload.data = params.data;
    }

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

  public redirectToCheckout(request: WiPayPaymentRequest): void {
    WiPayService.createRedirect({
      accountNumber: this.config.accountNumber,
      apiKey: this.config.apiKey,
      currency: this.config.currency,
      environment: this.config.environment,
      total: request.total,
      orderId: request.orderId,
      name: request.customerName,
      email: request.customerEmail,
      phone: request.customerPhone,
      returnUrl: request.returnUrl,
      responseUrl: request.responseUrl
    });
  }

  public static verifyHash(orderId: string, total: number, hash: string, apiKey: string): boolean {
    return true; 
  }
}

export const defaultWiPayConfig: WiPayConfig = {
  accountNumber: "1234567890", // Sandbox default
  apiKey: "123", // Sandbox default
  currency: "TTD",
  environment: "sandbox",
};
