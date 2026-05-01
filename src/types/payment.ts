import { Timestamp } from "firebase/firestore";

export type PaymentStatus = "pending" | "paid" | "failed" | "error" | "cancelled";

export interface PaymentRecord {
  id: string;
  tenant_id: string;
  order_id: string; // Unique order reference
  customer_id: string;
  invoice_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transaction_id?: string; // WiPay's reference
  payment_method: string;
  environment: "sandbox" | "live";
  customer_name?: string;
  customer_email?: string;
  message?: string;
  raw_response?: any;
  hash_validated: boolean;
  created_at: Timestamp | string;
  updated_at: Timestamp | string;
  metadata?: Record<string, any>;
}

export interface WiPayConfig {
  account_number: string;
  api_key: string;
  environment: "sandbox" | "live";
  currency: string;
}

export const countryCodeMap: Record<string, string> = {
  JMD: "JM",
  TTD: "TT",
  BBD: "BB",
  USD: "TT"
};

export interface WiPayPayload {
  account_number: string;
  avs: number;
  currency: string;
  environment: "sandbox" | "live";
  fee_structure: "customer_pay" | "merchant_pay";
  method: "credit_card" | "voucher" | "wallet";
  order_id: string;
  origin: string;
  response_url: string;
  total: number;
  country_code: string;
  data: string; // JSON stringified extra metadata
}

export interface WiPayResponse {
  status: "success" | "failed" | "error";
  url?: string;
  message?: string;
  transaction_id?: string;
}
