export type Role = "Super Admin" | "Admin" | "Manager" | "Staff" | "Accountant";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_id: string;
}

export interface Company {
  id: string;
  name: string;
  branding_config: {
    logo_url?: string;
    primary_color?: string;
    invoice_template?: string;
  };
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  loyalty_points: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  wholesale_price?: number;
  barcode: string;
  image_url?: string;
  category: string;
  variants?: { name: string; price: number; stock: number }[];
}

export interface InventoryItem {
  id: string;
  product_id: string;
  location: string;
  stock: number;
  min_stock_alert: number;
}

export interface Transaction {
  id: string;
  type: "SALE" | "RETURN" | "TRANSFER";
  amount: number;
  status: "COMPLETED" | "PENDING" | "CANCELLED";
  customer_id?: string;
  items: { product_id: string; quantity: number; price: number }[];
  timestamp: string;
  user_id: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  total: number;
  status: "PAID" | "UNPAID" | "OVERDUE";
  due_date: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Workflow {
  id: string;
  title: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  assigned_to?: string;
  related_id?: string;
  history: { status: string; timestamp: string; user_id: string }[];
}

export interface ModuleConfig {
  crm: boolean;
  pos: boolean;
  inventory: boolean;
  finance: boolean;
  operations: boolean;
  pricing: boolean;
  analytics: boolean;
  branding: boolean;
  ai: boolean;
  audit_logs: boolean;
  workflow: boolean;
  groups: boolean;
  loyalty: boolean;
}
