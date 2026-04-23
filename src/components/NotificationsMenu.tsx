import React, { useState, useEffect } from "react";
import { Bell, Check, Info, AlertTriangle, AlertCircle, CheckCircle2, X } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, updateDoc, doc, writeBatch, where } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useModules } from "@/context/ModuleContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsMenu() {
  const { enterpriseId } = useModules();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enterpriseId) return;
    const q = query(collection(db, "notifications"), where("enterprise_id", "==", enterpriseId), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SystemNotification));
      // Sort locally to avoid index requirement
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(docs.slice(0, 50));
    });
    return () => unsubscribe();
  }, [enterpriseId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "alert": return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative hover:bg-zinc-200 rounded-xl transition-colors">
            <Bell className={cn("w-5 h-5 transition-colors", isOpen ? "text-zinc-900" : "text-zinc-600")} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2 text-[10px] w-4 h-4 flex items-center justify-center font-bold text-white bg-rose-500 rounded-full border-2 border-zinc-50 outline outline-1 outline-rose-500/20">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[380px] p-0 rounded-2xl overflow-hidden shadow-2xl border-zinc-200/60 z-[100]">
        <div className="flex items-center justify-between p-4 bg-zinc-50 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-zinc-900 leading-none">Notifications</h3>
            {unreadCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-rose-100 text-rose-700 font-bold border-rose-200/50">{unreadCount} New</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" className="h-auto p-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 tracking-wider uppercase h-6 px-2 rounded-lg" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center border border-zinc-100">
                <Bell className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900">All caught up!</p>
                <p className="text-xs text-zinc-500 mt-1">Check back later for new alerts.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100/50">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 flex gap-4 transition-colors relative group",
                    !n.isRead ? "bg-blue-50/30" : "hover:bg-zinc-50/50"
                  )}
                  onClick={(e) => {
                    if (!n.isRead) markAsRead(n.id, e);
                  }}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border shadow-sm",
                      n.type === "success" ? "bg-emerald-50 border-emerald-100" :
                      n.type === "warning" ? "bg-amber-50 border-amber-100" :
                      n.type === "alert" ? "bg-rose-50 border-rose-100" :
                      "bg-blue-50 border-blue-100"
                    )}>
                      {getIcon(n.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={cn("text-sm font-bold truncate", !n.isRead ? "text-zinc-900" : "text-zinc-700")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0 whitespace-nowrap uppercase tracking-widest">
                        {getTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className={cn("text-xs leading-relaxed", !n.isRead ? "text-zinc-600 font-medium" : "text-zinc-500")}>
                      {n.message}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white border shadow-sm border-zinc-200" onClick={(e) => markAsRead(n.id, e)} title="Mark as read">
                        <Check className="w-3.5 h-3.5 text-zinc-600" />
                      </Button>
                    </div>
                  )}
                  {!n.isRead && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 group-hover:opacity-0 transition-opacity">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t border-zinc-100 bg-zinc-50/50">
             <Button variant="ghost" className="w-full text-xs font-bold text-zinc-500 hover:text-zinc-900">View All Architecture Logs</Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
