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
    isReturn?: boolean;
    originalTransactionId?: string | null;
    cashierName?: string | null;
    refundMethod?: string | null;
    balanceDeducted?: number;
    netRefundPaid?: number;
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
  const isReturn = !!order.isReturn;
  const refundLabel = order.refundMethod === "ACCOUNT" ? "STORE CREDIT" : (order.refundMethod || order.paymentMethod);

  return (
    <div
      className={cn(widthClass, "bg-white p-4 font-mono text-black leading-tight border border-zinc-100", fontSize)}
      id="pos-receipt"
    >
      {/* Header */}
      <div className="text-center space-y-1 mb-4">
        <h2 className="text-lg font-black uppercase tracking-tighter">{branding.name}</h2>
        <p className="text-[10px] whitespace-pre-wrap">{branding.address}</p>
        <p className="text-[10px]">TEL: {branding.phone}</p>
        <div className="border-b border-dashed border-black my-2" />

        {/* Document type — prominently labeled */}
        {isReturn ? (
          <div className="border border-black py-1 px-2">
            <p className="text-[11px] font-black uppercase tracking-widest">*** RETURN RECEIPT ***</p>
            <p className="text-[9px] uppercase font-bold">Refund Document</p>
          </div>
        ) : (
          <p className="text-[10px] uppercase font-bold">*** Sales Receipt ***</p>
        )}

        {/* Full Receipt ID — always printed in full for return processing */}
        <p className="text-[9px] uppercase font-bold">
          {isReturn ? "RETURN ID:" : "RECEIPT ID:"}
        </p>
        <p className="text-[9px] break-all font-bold">{order.id.toUpperCase()}</p>

        {/* Original transaction reference on return receipts */}
        {isReturn && order.originalTransactionId && (
          <>
            <p className="text-[9px] uppercase">Orig. Sale ID:</p>
            <p className="text-[9px] break-all">{order.originalTransactionId.toUpperCase()}</p>
          </>
        )}

        <p className="text-[10px]">{order.date}</p>
        {order.cashierName && (
          <p className="text-[9px] uppercase">Served by: {order.cashierName}</p>
        )}
        <p className="text-[10px] font-bold uppercase underline">
          {isReturn ? "Customer Refund Copy" : "Customer Copy"}
        </p>
      </div>

      {/* Customer */}
      {order.customerName && order.customerName !== "Guest Customer" && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase">
            Customer: {order.customerName}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 uppercase">
          <span>Description</span>
          <span>{isReturn ? "Refund" : "Amount"}</span>
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
          const lineTotal = baseTotal - discountVal;
          return (
            <div key={`${item.id}-${idx}`} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="uppercase font-bold">{item.name}</span>
                <span className="font-bold">
                  {isReturn ? "-" : ""}{formatCurrency(lineTotal)}
                </span>
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
          <span>{isReturn ? "-" : ""}{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discountAmount && order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>TOTAL DISCOUNT:</span>
            <span>-{formatCurrency(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>TAX:</span>
          <span>{isReturn ? "-" : ""}{formatCurrency(order.tax)}</span>
        </div>
        <div className="flex justify-between text-base font-black pt-1 border-t border-black">
          <span>{isReturn ? "REFUND TOTAL:" : "TOTAL DUE:"}</span>
          <span>{isReturn ? "-" : ""}{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-2" />

      {/* Payment / Refund */}
      <div className="text-left space-y-1 mb-4">
        {isReturn ? (
          <>
            <div className="flex justify-between uppercase font-bold">
              <span>GROSS REFUND:</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {(order.balanceDeducted ?? 0) > 0 && (
              <>
                <div className="flex justify-between font-bold">
                  <span>ACCT BAL DEDUCTED:</span>
                  <span>- {formatCurrency(order.balanceDeducted!)}</span>
                </div>
                <div className="flex justify-between font-black border-t border-dashed border-black pt-1 mt-1">
                  <span>NET PAYOUT:</span>
                  <span>{formatCurrency(order.netRefundPaid ?? 0)}</span>
                </div>
              </>
            )}
            {order.refundMethod === "ACCOUNT" && (
              <p className="text-[9px] uppercase mt-1">
                * Credit applied to customer account
              </p>
            )}
            {(order.balanceDeducted ?? 0) > 0 && (
              <p className="text-[9px] uppercase mt-1">
                * Outstanding balance settled against refund
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between uppercase font-bold">
              <span>PAID BY {order.paymentMethod}:</span>
              <span>{formatCurrency(order.tendered || order.total)}</span>
            </div>
            {(order.change ?? 0) > 0 && (
              <div className="flex justify-between font-bold">
                <span>CHANGE:</span>
                <span>{formatCurrency(order.change!)}</span>
              </div>
            )}
            {(order.balanceDue ?? 0) > 0 && (
              <div className="flex justify-between font-bold">
                <span>OUTSTANDING:</span>
                <span>{formatCurrency(order.balanceDue!)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Footer & Policy */}
      <div className="text-center space-y-2">
        {/* Professional return policy — only on sale receipts */}
        {!isReturn && (
          <div className="px-2 py-2 border border-black text-[9px] leading-snug mb-2 text-left">
            <p className="font-black uppercase text-center mb-1">Return &amp; Exchange Policy</p>
            <p>
              Items in their original, unopened condition are eligible for exchange or store credit
              within <span className="font-black">7 (seven) days</span> of the purchase date shown
              on this receipt. Items that have been opened, used, or damaged are not eligible for
              return. All exchanges are subject to stock availability. No cash refunds will be
              issued after the point of sale.
            </p>
            <p className="mt-1 font-bold uppercase">
              To process a return, present this receipt in-store.
            </p>
          </div>
        )}

        {/* On return receipts — confirmation note */}
        {isReturn && (
          <div className="px-2 py-2 border border-black text-[9px] leading-snug mb-2 text-left">
            <p className="font-black uppercase text-center mb-1">Return Confirmation</p>
            <p>
              This document confirms a return transaction processed on {order.date}.
              {order.originalTransactionId
                ? ` The original sale referenced is ${order.originalTransactionId.substring(0, 12).toUpperCase()}.`
                : ""
              } Retain this receipt for your records.
            </p>
          </div>
        )}

        <p className="text-[10px] uppercase font-bold">
          {isReturn ? "Thank you. Your refund has been processed." : "Thank you for your visit!"}
        </p>
        <p className="text-[8px] italic leading-tight text-zinc-500">
          {branding.disclaimer}
        </p>

        {/* Full ID barcode strip — always full ID for return processing */}
        <div className="flex flex-col items-center pt-2 gap-1">
          <div className="bg-black h-10 w-full flex items-center justify-center text-white font-bold tracking-[0.15em] text-[8px] break-all px-1 text-center">
            {order.id.toUpperCase()}
          </div>
          <p className="text-[7px] text-zinc-400 uppercase tracking-widest">
            {isReturn ? "Return Receipt ID" : "Receipt ID — Required for Returns"}
          </p>
        </div>
        <p className="text-[8px] pt-1 text-zinc-400">Powered by CRM-OS v2026 Production</p>
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
