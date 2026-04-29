import React from "react";
import { cn } from "@/lib/utils";
import { BrandingConfig } from "@/context/ModuleContext";

interface POSReceiptProps {
  branding: BrandingConfig;
  paperSize?: "80mm" | "58mm";
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
    tendered?: number;
    change?: number;
    balanceDue?: number;
  };
  formatCurrency: (amount: number) => string;
}

export const POSReceipt: React.FC<POSReceiptProps> = ({ branding, order, formatCurrency, paperSize = "80mm" }) => {
  if (!order) return null;
  
  const widthClass = paperSize === "58mm" ? "w-[58mm]" : "w-[80mm]";
  const fontSize = paperSize === "58mm" ? "text-[10px]" : "text-[12px]";

  return (
    <div className={cn(widthClass, "bg-white p-4 font-mono text-black leading-tight border border-zinc-100", fontSize)} id="pos-receipt">
      {/* Header */}
      <div className="text-center space-y-1 mb-4">
        <h2 className="text-lg font-black uppercase tracking-tighter">{branding.name}</h2>
        <p className="text-[10px] whitespace-pre-wrap">{branding.address}</p>
        <p className="text-[10px]">TEL: {branding.phone}</p>
        <div className="border-b border-dashed border-black my-2" />
        <p className="text-[10px] uppercase font-bold">*** Sales Receipt ***</p>
        <p className="text-[10px] uppercase">ID: {order.id.toUpperCase()}</p>
        <p className="text-[10px]">{order.date}</p>
        <p className="text-[10px] font-bold uppercase underline">Customer Copy</p>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 uppercase">
          <span>Description</span>
          <span>Amount</span>
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
                <span className="uppercase font-bold">{item.name}</span>
                <span className="font-bold">{formatCurrency(baseTotal - discountVal)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-800">
                <span>{item.qty} UNIT(S) @ {formatCurrency(item.price)}</span>
                {discountVal > 0 && <span className="font-bold">DISC: -{formatCurrency(discountVal)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-b border-dashed border-black my-2" />

      {/* Totals */}
      <div className="space-y-1 font-bold">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discountAmount && order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>TOTAL DISCOUNT:</span>
            <span>-{formatCurrency(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>TAX:</span>
          <span>{formatCurrency(order.tax)}</span>
        </div>
        <div className="flex justify-between text-base font-black pt-1 border-t border-black">
          <span>TOTAL DUE:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-2" />

      {/* Payment */}
      <div className="text-left space-y-1 mb-4">
        <div className="flex justify-between uppercase font-bold">
          <span>PAID BY {order.paymentMethod}:</span>
          <span>{formatCurrency(order.tendered || order.total)}</span>
        </div>
        {order.change > 0 && (
          <div className="flex justify-between font-bold">
            <span>CHANGE:</span>
            <span>{formatCurrency(order.change)}</span>
          </div>
        )}
        {order.balanceDue > 0 && (
          <div className="flex justify-between font-bold">
            <span>OUTSTANDING:</span>
            <span>{formatCurrency(order.balanceDue)}</span>
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Footer & Policy */}
      <div className="text-center space-y-2">
        <div className="px-2 py-1 border border-black text-[9px] font-bold uppercase leading-tight mb-2">
          Policy: No refund only exchange on not open or damaged product after few days of purchase
        </div>
        <p className="text-[10px] uppercase font-bold">Thank you for your visit!</p>
        <p className="text-[8px] italic leading-tight text-zinc-500">
          {branding.disclaimer}
        </p>
        
        <div className="flex justify-center pt-2">
           <div className="bg-black h-10 w-full flex items-center justify-center text-[10px] text-white font-bold tracking-[0.2em]">
             {order.id.substring(0, 16).toUpperCase()}
           </div>
        </div>
        <p className="text-[8px] pt-2 text-zinc-400">Powered by CRM-OS v2026 Production</p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0;
            size: ${paperSize === '58mm' ? '58mm' : '80mm'} auto;
          }
          body * {
            visibility: hidden;
          }
          #pos-receipt, #pos-receipt * {
            visibility: visible;
          }
          #pos-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperSize === '58mm' ? '58mm' : '80mm'};
            padding: 2mm;
            margin: 0;
            border: none;
          }
        }
      `}} />
    </div>
  );
};

