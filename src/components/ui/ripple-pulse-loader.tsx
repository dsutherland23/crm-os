import React from "react";
import { cn } from "@/lib/utils";

interface RipplePulseLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  hideLogo?: boolean;
}

export const RipplePulseLoader: React.FC<RipplePulseLoaderProps> = ({ 
  className,
  size = "md",
  hideLogo = false
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };

  const svgSizeClasses = {
    sm: "w-5 h-5",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  };

  return (
    <div className={cn("flex items-center justify-center min-h-[140px] w-full", className)}>
      <div className="relative flex items-center justify-center">
        {/* Ripple Rings - Sophisticated Fluid Motion */}
        <div className={cn(
          "absolute rounded-full border border-zinc-200/50 bg-white/40 backdrop-blur-[2px] animate-ripple",
          size === "sm" ? "w-12 h-12" : size === "md" ? "w-24 h-24" : "w-36 h-36"
        )} />
        
        <div className={cn(
          "absolute rounded-full border border-zinc-200/30 bg-white/20 backdrop-blur-[1px] animate-ripple",
          size === "sm" ? "w-10 h-10" : size === "md" ? "w-20 h-20" : "w-32 h-32"
        )} style={{ animationDelay: "1s" }} />

        <div className={cn(
          "absolute rounded-full border border-zinc-200/20 bg-white/10 backdrop-blur-[1px] animate-ripple",
          size === "sm" ? "w-8 h-8" : size === "md" ? "w-16 h-16" : "w-28 h-28"
        )} style={{ animationDelay: "2s" }} />

        {/* Core Branding Cavity */}
        <div className={cn(
          "relative z-10 bg-white rounded-full shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] flex items-center justify-center border border-zinc-100 transition-all duration-500 animate-pulse-soft",
          sizeClasses[size]
        )}>
          {!hideLogo && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 94 94"
              className={cn("animate-logo-color", svgSizeClasses[size])}
            >
              <path
                d="M38.0481 4.82927C38.0481 2.16214 40.018 0 42.4481 0H51.2391C53.6692 0 55.6391 2.16214 55.6391 4.82927V40.1401C55.6391 48.8912 53.2343 55.6657 48.4248 60.4636C43.6153 65.2277 36.7304 67.6098 27.7701 67.6098C18.8099 67.6098 11.925 65.2953 7.11548 60.6663C2.37183 56.0036 3.8147e-06 49.2967 3.8147e-06 40.5456V4.82927C3.8147e-06 2.16213 1.96995 0 4.4 0H13.2405C15.6705 0 17.6405 2.16214 17.6405 4.82927V39.1265C17.6405 43.7892 18.4805 47.2018 20.1605 49.3642C21.8735 51.5267 24.4759 52.6079 27.9678 52.6079C31.4596 52.6079 34.0127 51.5436 35.6268 49.4149C37.241 47.2863 38.0481 43.8399 38.0481 39.0758V4.82927Z"
              ></path>
              <path
                d="M86.9 61.8682C86.9 64.5353 84.9301 66.6975 82.5 66.6975H73.6595C71.2295 66.6975 69.2595 64.5353 69.2595 61.8682V4.82927C69.2595 2.16214 71.2295 0 73.6595 0H82.5C84.9301 0 86.9 2.16214 86.9 4.82927V61.8682Z"
              ></path>
              <path
                d="M2.86102e-06 83.2195C2.86102e-06 80.5524 1.96995 78.3902 4.4 78.3902H83.6C86.0301 78.3902 88 80.5524 88 83.2195V89.1707C88 91.8379 86.0301 94 83.6 94H4.4C1.96995 94 0 91.8379 0 89.1707L2.86102e-06 83.2195Z"
              ></path>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default RipplePulseLoader;
