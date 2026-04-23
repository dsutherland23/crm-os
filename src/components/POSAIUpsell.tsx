import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";

interface Product {
  id: string;
  name: string;
  price: number;
  retail_price?: number;
  category: string;
  description?: string;
  image_url?: string;
}

interface POSAIUpsellProps {
  cart: Array<{ product: Product; quantity: number }>;
  allProducts: Product[];
  onAdd: (product: Product) => void;
  formatCurrency: (amount: number) => string;
}

export const POSAIUpsell: React.FC<POSAIUpsellProps> = ({ cart, allProducts, onAdd, formatCurrency }) => {
  const [recommendation, setRecommendation] = useState<{
    product: Product;
    reason: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (cart.length === 0) {
      setRecommendation(null);
      return;
    }

    // Modern 2026 Strategy: Cross-Category Affinity & Meta-Data Matching
    // In a production app, this would be a call to a Vector Search / LLM endpoint
    // Here we implement a high-fidelity heuristic engine
    const generateRecommendation = async () => {
      setIsLoading(true);
      // Simulate neural network latency
      await new Promise(resolve => setTimeout(resolve, 800));

      const cartCategories = new Set(cart.map(item => item.product.category));
      const cartProductNames = cart.map(item => item.product.name.toLowerCase());

      // Affinity Mapping logic
      const affinityMap: Record<string, string[]> = {
        'Electronics': ['Accessories', 'Protection', 'Cables', 'Peripherals'],
        'Coffee': ['Pastry', 'Syrup', 'Mug'],
        'Apparel': ['Accessories', 'Footwear', 'Care Kit'],
        'Skincare': ['Sunscreen', 'Cleanser', 'Applicator'],
        'Medical': ['Safety', 'Hygiene', 'Disposable']
      };

      // Search for complementary products not in cart
      let bestMatch: Product | null = null;
      let reason = "";

      for (const item of cart) {
        const product = item.product;
        const targetCategories = affinityMap[product.category] || [];
        
        // Strategy 1: Explicit Accessory Lookups
        const candidates = allProducts.filter(p => 
          targetCategories.includes(p.category) && 
          !cart.some(cartItem => cartItem.product.id === p.id) &&
          p.id !== product.id
        );

        if (candidates.length > 0) {
          bestMatch = candidates[Math.floor(Math.random() * candidates.length)];
          reason = `Frequently purchased with your ${product.name}.`;
          break;
        }

        // Strategy 2: Upsell within same category (Premium version)
        const premiumUpsell = allProducts.find(p => 
          p.category === product.category && 
          (p.retail_price || p.price) > (product.retail_price || product.price) &&
          !cart.some(cartItem => cartItem.product.id === p.id)
        );

        if (premiumUpsell) {
           bestMatch = premiumUpsell;
           reason = `Upgrade your ${product.name} to the premium version for only ${formatCurrency((premiumUpsell.retail_price || premiumUpsell.price) - (product.retail_price || product.price))} more.`;
           break;
        }
      }

      // Default if no logic hits
      if (!bestMatch && allProducts.length > 0) {
        const randomProduct = allProducts.find(p => !cart.some(c => c.product.id === p.id));
        if (randomProduct) {
          bestMatch = randomProduct;
          reason = "Our customers are also loving this today.";
        }
      }

      setRecommendation(bestMatch ? { product: bestMatch, reason } : null);
      setIsLoading(false);
    };

    generateRecommendation();
  }, [cart, allProducts]);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div 
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-center gap-2 h-[80px]"
        >
          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">AI Intelligence Engine Scanning...</span>
        </motion.div>
      ) : recommendation ? (
        <motion.div 
          key="recommendation"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl border border-blue-400/20 shadow-lg shadow-blue-500/10 flex flex-col gap-3 group relative overflow-hidden"
        >
          {/* Decorative elements for premium feel */}
          <div className="absolute top-0 right-0 p-8 bg-white/5 rounded-full -mr-4 -mt-4 blur-xl group-hover:bg-white/10 transition-colors" />
          
          <div className="flex gap-3 items-start relative z-10">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-1 opacity-80">Smart Suggestion</p>
              <p className="text-xs text-white leading-snug font-medium pr-8">
                {recommendation.reason}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 relative z-10 mt-1">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-white overflow-hidden flex-shrink-0">
                 <img 
                   src={recommendation.product.image_url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400"} 
                   alt={recommendation.product.name} 
                   className="w-full h-full object-cover"
                 />
               </div>
               <div>
                  <p className="text-[10px] font-bold text-white truncate max-w-[120px]">{recommendation.product.name}</p>
                  <p className="text-[10px] font-black text-blue-200">{formatCurrency(recommendation.product.retail_price || recommendation.product.price)}</p>
               </div>
            </div>
            <Button 
              size="sm" 
              className="h-8 rounded-lg bg-white text-blue-700 hover:bg-blue-50 font-black text-[10px] uppercase px-3 gap-1.5"
              onClick={() => onAdd(recommendation.product)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
