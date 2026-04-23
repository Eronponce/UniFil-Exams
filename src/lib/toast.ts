import { redirect } from "next/navigation";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  type: ToastKind;
  title: string;
  description?: string;
}

export const TOAST_QUERY_KEYS = {
  type: "toastType",
  title: "toastTitle",
  description: "toastDescription",
} as const;

export function withToast(url: string, toast: ToastPayload): string {
  const parsed = new URL(url, "http://local");
  parsed.searchParams.set(TOAST_QUERY_KEYS.type, toast.type);
  parsed.searchParams.set(TOAST_QUERY_KEYS.title, toast.title);
  if (toast.description) parsed.searchParams.set(TOAST_QUERY_KEYS.description, toast.description);
  else parsed.searchParams.delete(TOAST_QUERY_KEYS.description);

  const search = parsed.searchParams.toString();
  return `${parsed.pathname}${search ? `?${search}` : ""}${parsed.hash}`;
}

export function redirectWithToast(url: string, toast: ToastPayload): never {
  redirect(withToast(url, toast));
}
