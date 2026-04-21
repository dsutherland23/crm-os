import React from "react";
import { 
  Globe, 
  MapPin, 
  Phone, 
  Facebook, 
  Instagram, 
  Twitter,
  Mail,
  QrCode
} from "lucide-react";
import { BrandingConfig } from "@/context/ModuleContext";

interface PrintableInvoiceProps {
  branding: BrandingConfig;
  enterpriseId: string | null;
  order: {
    id: string;
    customerName: string;
    customerAddress?: string;
    customerPhone?: string;
    customerEmail?: string;
    date: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      qty: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
  };
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ branding, enterpriseId, order }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/connect?id=' + (enterpriseId || 'master-all'))}`;
  return (
    <div className="w-full max-w-[800px] mx-auto bg-white p-0 shadow-2xl overflow-hidden font-sans text-zinc-900 border border-zinc-100 print:shadow-none print:border-0" id="printable-invoice">
      {/* Top Accent Graphics */}
      <div className="relative h-24 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 -rotate-12 translate-x-20 -translate-y-20 transform origin-bottom-left skew-x-12 opacity-90" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 -rotate-12 translate-x-10 -translate-y-10 transform origin-bottom-left skew-x-12 opacity-50" />
      </div>

      <div className="px-12 pb-12">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-16">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white flex items-center justify-center">
              {branding.logo ? (
                <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-zinc-100" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-blue-900 leading-none uppercase tracking-tight">{branding.name}</h2>
            </div>
          </div>
          <div className="text-right relative min-w-[200px]">
            <h1 className="text-7xl font-black italic text-blue-900/10 tracking-tighter leading-none mb-2 select-none uppercase absolute -top-4 right-8 pointer-events-none">INVOICE</h1>
            <div className="relative z-10 space-y-1 pt-12 pr-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Invoice Number</p>
              <p className="text-lg font-black text-zinc-900">#{order.id.split('-')[0].toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Client & Metadata Section */}
        <div className="grid grid-cols-2 gap-20 mb-16 px-2">
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-blue-950 leading-tight">{order.customerName || 'Walk-in Customer'}</h3>
            <div className="space-y-1 text-sm text-zinc-500 font-medium">
              <p>{order.customerAddress}</p>
              <p>{order.customerPhone}</p>
              <p>{order.customerEmail}</p>
            </div>
          </div>
          <div className="flex flex-col justify-end items-end space-y-4">
            {/* Can add more metadata here like due date etc */}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-12">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-700 text-white overflow-hidden">
                <th className="py-4 px-6 text-left text-xs font-black uppercase tracking-widest rounded-l-xl">No</th>
                <th className="py-4 px-4 text-left text-xs font-black uppercase tracking-widest">Product</th>
                <th className="py-4 px-4 text-right text-xs font-black uppercase tracking-widest">Price</th>
                <th className="py-4 px-4 text-center text-xs font-black uppercase tracking-widest">Qty</th>
                <th className="py-4 px-6 text-right text-xs font-black uppercase tracking-widest rounded-r-xl">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {order.items.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                  <td className="py-5 px-6 text-sm font-bold text-zinc-400">{index + 1}</td>
                  <td className="py-5 px-4 text-sm font-black text-blue-950">{item.name}</td>
                  <td className="py-5 px-4 text-right text-sm font-bold text-zinc-600">{item.price.toFixed(2)}</td>
                  <td className="py-5 px-4 text-center text-sm font-bold text-zinc-600">{item.qty}</td>
                  <td className="py-5 px-6 text-right text-sm font-black text-blue-950">{(item.price * item.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Signature */}
        <div className="grid grid-cols-2 gap-12 items-end mb-20">
          <div className="space-y-4 border-t border-zinc-100 pt-8">
            <div className="flex flex-col gap-2">
               <h4 className="text-xl font-black text-blue-950">Authorized Signature</h4>
               <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{branding.name}</p>
            </div>
            <div className="relative pt-6">
              <div className="absolute top-0 left-0 w-32 h-px bg-zinc-900/10" />
              <div className="font-['Cedarville_Cursive',_cursive] text-3xl text-zinc-400/20 italic select-none uppercase tracking-tighter">{branding.name}</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-black text-blue-950 uppercase tracking-widest">Subtotal:</span>
              <span className="text-sm font-bold text-zinc-600">{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-black text-blue-950 uppercase tracking-widest">Tax:</span>
              <span className="text-sm font-bold text-zinc-600">{order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
              <span className="text-sm font-black text-blue-950 uppercase tracking-widest">Total:</span>
              <span className="text-2xl font-black text-blue-700">{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mb-20 flex justify-between items-start gap-12">
          <div className="space-y-4 max-w-xl px-2">
            <h4 className="text-lg font-black text-blue-900 uppercase tracking-widest">Term and Condition</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold italic">
              {branding.disclaimer}
            </p>
          </div>
          
          {/* 2026 Modern Social QR Section */}
          <div className="shrink-0 flex flex-col items-center p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
            <div className="w-24 h-24 bg-white p-2 rounded-2xl shadow-inner border border-zinc-100 mb-3 relative z-10 transition-transform group-hover:scale-105 duration-500">
               <img 
                 src={qrUrl}
                 alt="Social QR"
                 className="w-full h-full object-contain"
               />
            </div>
            <div className="text-center relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-1">Social Ecosystem</p>
              <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">Scan to Choose Platform</p>
              <div className="mt-2 text-[6px] font-mono text-zinc-300 break-all max-w-[100px] uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                {window.location.origin}/connect?id={enterpriseId || 'master-all'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding Area */}
      <div className="relative pt-0 px-12 pb-12 overflow-hidden">
        {/* Bottom Design Accents */}
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600 -rotate-12 transform -translate-x-20 translate-y-20 origin-top-right skew-x-12 opacity-90" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500 -rotate-12 transform -translate-x-10 translate-y-10 origin-top-right skew-x-12 opacity-50" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-600 -rotate-12 transform translate-x-20 translate-y-20 origin-top-left skew-y-12 opacity-90" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-500 -rotate-12 transform translate-x-10 translate-y-10 origin-top-left skew-y-12 opacity-50" />

        <div className="relative z-10 border-t border-zinc-100 flex justify-between items-center pt-8 text-blue-900">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-full text-white">
              <Globe className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black tracking-tight">{branding.socials?.website || 'www.orivocrm.pro'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-full text-white">
              <MapPin className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black tracking-tight line-clamp-1 max-w-[200px]">{branding.address?.trim() !== "" ? branding.address : "No Address Provided"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-full text-white">
              <Phone className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black tracking-tight">{branding.phone?.trim() !== "" ? branding.phone : "No Phone Provided"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-full text-white">
              <Mail className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black tracking-tight">{branding.email?.trim() !== "" ? branding.email : "No Email Provided"}</span>
          </div>
        </div>
        <div className="text-center pt-8">
           <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400">Done by Orivocrm.pro System v2026</p>
        </div>
      </div>
    </div>
  );
};
