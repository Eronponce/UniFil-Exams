import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, CommandTrigger } from "@/components/command-palette";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  routerPush.mockReset();
});

describe("app shell command palette", () => {
  it("opens from the visible trigger, navigates with arrows and Enter, and closes with Escape", () => {
    render(<><CommandPalette /><CommandTrigger /></>);

    fireEvent.click(screen.getByRole("button", { name: "Abrir busca rápida" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Pesquisar destinos e ações" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(routerPush).toHaveBeenCalledWith("/disciplines");

    fireEvent.click(screen.getByRole("button", { name: "Abrir busca rápida" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Pesquisar destinos e ações" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with Ctrl+K and filters destinations by text", () => {
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("textbox", { name: "Pesquisar destinos e ações" });
    fireEvent.change(input, { target: { value: "auditoria" } });

    expect(screen.getByRole("option", { name: /Auditoria/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Disciplinas/ })).not.toBeInTheDocument();
  });
});
