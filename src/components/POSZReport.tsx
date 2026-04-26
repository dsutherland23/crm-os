import React from "react";
import { BrandingConfig } from "@/context/ModuleContext";

interface POSZReportProps {
  branding: BrandingConfig;
  session: {
    id: string;
    staffName: string;
    startTime: string;
    endTime: string;
    openingFloat: number;
    expectedCash: number;
    countedCash: number;
    variance: number;
    notes?: string;
  };
  stats: {
    sales: number;
    tax: number;
    discounts: number;
    cash: number;
    card: number;
    split: number;
  };
  formatCurrency: (amount: number) => string;
}

export const POSZReport: React.FC<POSZReportProps> = ({ branding, session, stats, formatCurrency }) => {
  const now = new Date().toLocaleString();
  
  return (
    <div className="w-[300px] bg-white p-6 font-mono text-[12px] text-black leading-tight border border-zinc-100 hidden print:block" id="pos-z-report">
      {/* Header */}
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-lg font-black uppercase">{branding.name}</h2>
        <p className="text-[10px] uppercase font-bold tracking-widest">Settlement Report (Z-Report)</p>
        <div className="border-b border-dashed border-black my-2" />
      </div>

      {/* Session Info */}
      <div className="space-y-1 mb-4 text-[10px]">
        <div className="flex justify-between">
          <span>Terminal ID:</span>
          <span className="font-bold">#{(session.id || 'N/A').substring(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>Operator:</span>
          <span className="font-bold">{session.staffName}</span>
        </div>
        <div className="flex justify-between">
          <span>Opened:</span>
          <span>{new Date(session.startTime).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Closed:</span>
          <span>{new Date(session.endTime || Date.now()).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Report Generated:</span>
          <span>{now}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Sales Summary */}
      <div className="space-y-2 mb-4">
        <p className="font-black uppercase text-[10px]">Sales Summary</p>
        <div className="flex justify-between">
          <span>Gross Sales:</span>
          <span className="font-bold">{formatCurrency(stats.sales)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Tax:</span>
          <span>{formatCurrency(stats.tax)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Discounts:</span>
          <span>({formatCurrency(stats.discounts)})</span>
        </div>
        <div className="flex justify-between border-t border-black pt-1 font-black">
          <span>NET SALES:</span>
          <span>{formatCurrency(stats.sales)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Payment Breakdown */}
      <div className="space-y-2 mb-4">
        <p className="font-black uppercase text-[10px]">Payment Breakdown</p>
        <div className="flex justify-between">
          <span>Cash Payments:</span>
          <span>{formatCurrency(stats.cash)}</span>
        </div>
        <div className="flex justify-between">
          <span>Card Payments:</span>
          <span>{formatCurrency(stats.card)}</span>
        </div>
        <div className="flex justify-between">
          <span>Split Payments:</span>
          <span>{formatCurrency(stats.split)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Cash Audit */}
      <div className="space-y-2 mb-4 bg-zinc-50 p-2">
        <p className="font-black uppercase text-[10px]">Registry Reconciliation</p>
        <div className="flex justify-between">
          <span>Opening Float:</span>
          <span>{formatCurrency(session.openingFloat)}</span>
        </div>
        <div className="flex justify-between">
          <span>Expected Cash:</span>
          <span className="font-bold">{formatCurrency(session.expectedCash)}</span>
        </div>
        <div className="flex justify-between border-t border-black pt-1">
          <span>Actual Counted:</span>
          <span className="font-black">{formatCurrency(session.countedCash)}</span>
        </div>
        <div className="flex justify-between text-base font-black pt-1 border-t-2 border-black">
          <span>VARIANCE:</span>
          <span className={session.variance === 0 ? "text-black" : "text-black"}>
            {session.variance > 0 ? "+" : ""}{formatCurrency(session.variance)}
          </span>
        </div>
      </div>

      {session.notes && (
        <div className="mt-4 p-2 border border-black border-dashed">
          <p className="text-[8px] font-black uppercase mb-1">Audit Notes:</p>
          <p className="text-[9px] leading-tight italic">{session.notes}</p>
        </div>
      )}

      <div className="border-b border-dashed border-black my-6" />

      {/* Footer */}
      <div className="text-center space-y-2">
        <p className="text-[9px] uppercase font-bold">End of Shift Audit Complete</p>
        <div className="flex flex-col gap-4 mt-6">
          <div className="border-t border-black pt-1">
            <p className="text-[8px] uppercase">Cashier Signature</p>
          </div>
          <div className="border-t border-black pt-1">
            <p className="text-[8px] uppercase">Manager Signature</p>
          </div>
        </div>
        <p className="text-[8px] pt-4 text-zinc-400 uppercase tracking-widest">Done by Orivocrm.pro System v2026</p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
            -webkit-print-color-adjust: exact !important;
          }
          #pos-z-report, #pos-z-report * {
            visibility: visible !important;
          }
          #pos-z-report {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            border: none !important;
            background: white !important;
          }
        }
      `}} />
    </div>
  );
};
