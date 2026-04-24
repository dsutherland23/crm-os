import React, { createContext, useContext, useState, useCallback } from "react";

interface PendingAction {
  module: string;
  action: string;
}

interface PendingActionContextType {
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
  consumeAction: (module: string) => PendingAction | null;
}

const PendingActionContext = createContext<PendingActionContextType | undefined>(undefined);

export function PendingActionProvider({ children }: { children: React.ReactNode }) {
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(null);

  const setPendingAction = useCallback((action: PendingAction | null) => {
    setPendingActionState(action);
  }, []);

  // Atomically reads and clears the pending action if it belongs to the given module
  const consumeAction = useCallback((module: string): PendingAction | null => {
    let result: PendingAction | null = null;
    setPendingActionState((prev) => {
      if (prev?.module === module) {
        result = prev;
        return null;
      }
      return prev;
    });
    return result;
  }, []);

  return (
    <PendingActionContext.Provider value={{ pendingAction, setPendingAction, consumeAction }}>
      {children}
    </PendingActionContext.Provider>
  );
}

export function usePendingAction() {
  const ctx = useContext(PendingActionContext);
  if (!ctx) throw new Error("usePendingAction must be used within PendingActionProvider");
  return ctx;
}
