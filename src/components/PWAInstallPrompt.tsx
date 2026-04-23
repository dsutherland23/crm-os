import React, { useState, useEffect } from "react";
import { Download, X, Laptop, Monitor, Smartphone, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallEvent(e);
      
      // Delay showing the prompt slightly after login/load for better UX
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener('appinstalled', () => {
      setInstallEvent(null);
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    
    // Show the install prompt
    installEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setInstallEvent(null);
    setShowPrompt(false);
  };

  if (isInstalled) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-[420px] rounded-[2.5rem] border-zinc-200/60 p-0 overflow-hidden bg-white shadow-2xl">
        <div className="bg-zinc-950 p-8 text-center relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-600/10 rounded-full blur-2xl" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <img src="/icon-192.png" alt="Orivo Logo" className="w-14 h-14 rounded-2xl shadow-2xl" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-500 border-4 border-zinc-950 flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            
            <h2 className="text-xl font-black text-white uppercase tracking-widest leading-tight">
              Install Orivo OS
            </h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-2">
              Standalone Desktop Experience
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 group hover:border-blue-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-blue-500 transition-colors">
                <Monitor className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wide">Native Performance</h4>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-1">Run Orivo directly from your dock or taskbar without browser overhead.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 group hover:border-blue-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-blue-500 transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wide">Offline Ready</h4>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-1">Access critical data and cached records even when your connection drops.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="ghost" 
              onClick={() => setShowPrompt(false)} 
              className="flex-1 h-12 rounded-2xl font-bold text-zinc-400 hover:text-zinc-600"
            >
              Maybe Later
            </Button>
            <Button 
              onClick={handleInstall}
              className="flex-1 h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black shadow-xl shadow-zinc-900/20 flex items-center gap-2 group"
            >
              Install Now
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </Button>
          </div>
          
          <p className="text-[9px] text-zinc-400 text-center font-medium">
            Compatible with Windows, macOS, Linux, and Mobile Chrome
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
