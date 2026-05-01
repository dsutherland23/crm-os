import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Kpi({ icon: Icon, label, value, color = "zinc" }: {
  icon: React.ElementType; label: string; value: string | number; color?: string;
}) {
  const cls: Record<string, string> = {
    zinc:    "bg-zinc-900 border-white/[0.06] text-zinc-400",
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    rose:    "bg-rose-500/10 border-rose-500/20 text-rose-400",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };
  return (
    <div className={cn("rounded-2xl border p-5 space-y-3", cls[color] || cls.zinc)}>
      <Icon className="w-4 h-4" />
      <div>
        <p className="text-2xl font-black text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-[11px] font-semibold text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6 space-y-6">{children}</div>;
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-white font-black text-lg">{title}</h2>
      {sub && <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={onClose} />}
      <div className={cn(
        "fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/[0.05] shrink-0">
          <p className="text-white font-black text-sm">{title}</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "md" | "lg";
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative z-10 bg-[#0d0d0f] border border-white/[0.08] rounded-2xl flex flex-col max-h-[85vh] w-full shadow-2xl",
        size === "lg" ? "max-w-2xl" : "max-w-lg"
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] shrink-0">
          <p className="text-white font-black text-sm">{title}</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}
