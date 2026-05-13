"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AuditOptimisticContextValue {
  isHidden(questionId: number): boolean;
  hideQuestion(questionId: number): void;
  showQuestion(questionId: number): void;
}

const AuditOptimisticContext = createContext<AuditOptimisticContextValue | null>(null);

export function AuditOptimisticProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set());

  const value = useMemo<AuditOptimisticContextValue>(
    () => ({
      isHidden(questionId) {
        return hiddenIds.has(questionId);
      },
      hideQuestion(questionId) {
        setHiddenIds((current) => {
          const next = new Set(current);
          next.add(questionId);
          return next;
        });
      },
      showQuestion(questionId) {
        setHiddenIds((current) => {
          if (!current.has(questionId)) return current;
          const next = new Set(current);
          next.delete(questionId);
          return next;
        });
      },
    }),
    [hiddenIds],
  );

  return <AuditOptimisticContext.Provider value={value}>{children}</AuditOptimisticContext.Provider>;
}

export function useAuditOptimistic() {
  const context = useContext(AuditOptimisticContext);
  if (!context) {
    throw new Error("useAuditOptimistic must be used within AuditOptimisticProvider.");
  }
  return context;
}

export function AuditOptimisticCard({
  questionId,
  children,
}: Readonly<{ questionId: number; children: ReactNode }>) {
  const { isHidden } = useAuditOptimistic();
  if (isHidden(questionId)) return null;
  return <>{children}</>;
}
