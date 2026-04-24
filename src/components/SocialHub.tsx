import React from "react";
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Globe, 
  Mail, 
  MessageCircle, 
  Youtube,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { useModules } from "@/context/ModuleContext";
import { motion } from "motion/react";
import { Button } from "./ui/button";

export const SocialHub: React.FC = () => {
  const { branding, setEnterpriseId } = useModules();

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id) setEnterpriseId(id);
  }, [setEnterpriseId]);

  const socialPlatforms = [
    { name: "Website", icon: <Globe className="w-5 h-5" />, url: branding.socials?.website, color: "bg-blue-600" },
    { name: "Instagram", icon: <Instagram className="w-5 h-5" />, url: branding.socials?.instagram, color: "bg-pink-600" },
    { name: "Facebook", icon: <Facebook className="w-5 h-5" />, url: branding.socials?.facebook, color: "bg-blue-800" },
    { name: "Twitter", icon: <Twitter className="w-5 h-5" />, url: branding.socials?.twitter, color: "bg-zinc-900" },
    { name: "WhatsApp", icon: <MessageCircle className="w-5 h-5" />, url: branding.phone ? `https://wa.me/${branding.phone.replace(/\D/g, '')}` : null, color: "bg-emerald-600" },
    { name: "Office", icon: <MessageCircle className="w-5 h-5" />, url: branding.officePhone ? `tel:${branding.officePhone.replace(/\D/g, '')}` : null, color: "bg-blue-500" },
    { name: "Email", icon: <Mail className="w-5 h-5" />, url: branding.email ? `mailto:${branding.email}` : null, color: "bg-zinc-700" }
  ].filter(p => p.url);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-indigo-600/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10 space-y-8"
      >
        {/* Profile Header */}
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-white rounded-[2rem] mx-auto p-4 shadow-2xl flex items-center justify-center border border-white/10 overflow-hidden">
            {branding.logo ? (
              <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Globe className="w-12 h-12 text-zinc-900" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">{branding.name}</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Professional Ecosystem</p>
          </div>
        </div>

        {/* Links Grid */}
        <div className="space-y-3">
          {socialPlatforms.map((platform, idx) => (
            <motion.a
              key={platform.name}
              href={platform.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group block"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${platform.color} flex items-center justify-center text-white shadow-lg`}>
                    {platform.icon}
                  </div>
                  <span className="text-sm font-bold text-white uppercase tracking-widest">{platform.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all" />
              </div>
            </motion.a>
          ))}
          
          {/* Platform Link */}
          <motion.a
            href="https://orivocrm.pro"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: socialPlatforms.length * 0.1 }}
            className="group block pt-4"
          >
            <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 backdrop-blur-xl border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between hover:from-blue-600/30 hover:to-indigo-600/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white uppercase tracking-widest">OrivoCRM.pro</span>
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Official Platform</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-400 transform group-hover:translate-x-1 transition-all" />
            </div>
          </motion.a>
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
           <div className="max-w-[280px] mx-auto">
             <p className="text-[9px] text-zinc-500 font-medium leading-relaxed italic">
               OrivoCRM is a high-performance Enterprise Intelligence OS designed to streamline commerce, 
               automate workflows, and deliver a frictionless 2026 digital ecosystem.
             </p>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
             Powered by Orivocrm.pro
           </p>
        </div>
      </motion.div>
    </div>
  );
};
