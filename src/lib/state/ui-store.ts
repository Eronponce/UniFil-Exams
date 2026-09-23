"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

interface UiState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "unifil-ui-preferences",
      version: 1,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
