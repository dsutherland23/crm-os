import React from "react";
import { BrandingConfig } from "@/context/ModuleContext";

interface POSReceiptProps {
  branding: BrandingConfig;
  order: {
    id: string;
    customerName: string;
    date: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      qty: number;
      discount?: { type: "Percentage" | "Fixed Amount"; value: number } | null;
    }>;
    subtotal: number;
    tax: number;
    discountAmount?: number;
    total: number;
    paymentMethod: string;
  };
  formatCurrency: (amount: number) => string;
}

export const POSReceipt: React.FC<POSReceiptProps> = ({ branding, order, formatCurrency }) => {
  if (!order) return null;
  return (
    <div className="w-[300px] bg-white p-4 font-mono text-[12px] text-black leading-tight border border-zinc-100" id="pos-receipt">
      {/* Header */}
      <div className="text-center space-y-1 mb-4">
        <h2 className="text-lg font-black uppercase">{branding.name}</h2>
        <p className="text-[10px] whitespace-pre-wrap">{branding.address}</p>
        <p className="text-[10px]">Tel: {branding.phone}</p>
        <p className="text-[10px]">{branding.email}</p>
        <div className="border-b border-dashed border-black my-2" />
        <p className="text-[10px] uppercase font-bold">Sales Receipt</p>
        <p className="text-[10px] uppercase">#{order.id.substring(0, 8).toUpperCase()}</p>
        <p className="text-[10px]">{order.date}</p>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-bold border-b border-dashed border-black pb-1">
          <span>Item</span>
          <span>Total</span>
        </div>
        {order.items.map((item, idx) => {
          const baseTotal = item.price * item.qty;
          let discountVal = 0;
          if (item.discount) {
            if (item.discount.type === "Percentage") {
              discountVal = baseTotal * (item.discount.value / 100);
            } else {
              discountVal = item.discount.value * item.qty;
            }
          }
          return (
            <div key={`${item.id}-${idx}`} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="uppercase">{item.name}</span>
                <span>{formatCurrency(baseTotal - discountVal)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>{item.qty} x {formatCurrency(item.price)}</span>
                {discountVal > 0 && <span className="text-black font-bold">SAVED: -{formatCurrency(discountVal)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-b border-dashed border-black my-2" />

      {/* Totals */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discountAmount && order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>DISCOUNT:</span>
            <span>-{formatCurrency(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>TAX:</span>
          <span>{formatCurrency(order.tax)}</span>
        </div>
        <div className="flex justify-between text-base font-black pt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-2" />

      {/* Payment */}
      <div className="text-center space-y-1 mb-4">
        <p className="uppercase">Paid via {order.paymentMethod}</p>
        <p className="text-[10px]">Tendered: {formatCurrency(order.total)}</p>
        <p className="text-[10px]">Change: {formatCurrency(order.change || 0)}</p>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Footer */}
      <div className="text-center space-y-2">
        <p className="text-[9px] uppercase font-bold">Thank you for your business!</p>
        <p className="text-[8px] italic leading-tight px-2">
          {branding.disclaimer}
        </p>
        <div className="flex justify-center pt-2">
           {/* Placeholder for a simple barcode if needed */}
           <div className="bg-black h-8 w-40 flex items-center justify-center text-[8px] text-white">
             {order.id.substring(0, 12).toUpperCase()}
           </div>
        </div>
        <p className="text-[8px] pt-2 text-zinc-400">Done by Orivocrm.pro System v2026</p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
            -webkit-print-color-adjust: exact;
          }
          #pos-receipt, #pos-receipt * {
            visibility: visible;
          }
          #pos-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm;
            margin: 0;
            border: none;
            background: white;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
};
