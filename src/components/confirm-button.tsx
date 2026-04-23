"use client";

import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  confirm: string;
}

export function ConfirmButton({ confirm: message, onClick, ...props }: Props) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
        onClick?.(e);
      }}
    />
  );
}
