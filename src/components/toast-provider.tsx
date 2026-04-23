"use client";

import { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TOAST_QUERY_KEYS, type ToastKind, type ToastPayload } from "@/lib/toast";

interface ToastItem extends ToastPayload {
  id: string;
}

interface ToastContextValue {
  pushToast: (toast: ToastPayload) => string;
  updateToast: (id: string, next: Partial<ToastPayload>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-copy">
            <strong>{toast.title}</strong>
            {toast.description && <p>{toast.description}</p>}
          </div>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Fechar">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function FlashToastReader({ pushToast }: Pick<ToastContextValue, "pushToast">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    const type = searchParams.get(TOAST_QUERY_KEYS.type) as ToastKind | null;
    const title = searchParams.get(TOAST_QUERY_KEYS.title);
    const description = searchParams.get(TOAST_QUERY_KEYS.description) ?? undefined;
    const signature = `${type ?? ""}|${title ?? ""}|${description ?? ""}`;

    if (!type || !title || consumedRef.current === signature) return;

    consumedRef.current = signature;
    pushToast({ type, title, description });

    const next = new URLSearchParams(searchParams.toString());
    next.delete(TOAST_QUERY_KEYS.type);
    next.delete(TOAST_QUERY_KEYS.title);
    next.delete(TOAST_QUERY_KEYS.description);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, pushToast, router, searchParams]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  const value = useMemo<ToastContextValue>(() => ({
    pushToast(toast) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, ...toast }]);
      return id;
    },
    updateToast(id, next) {
      setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, ...next } : toast));
    },
    dismissToast,
  }), []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), 5000));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={value}>
      <Suspense fallback={null}>
        <FlashToastReader pushToast={value.pushToast} />
      </Suspense>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
