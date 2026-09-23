import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, CommandTrigger } from "@/components/command-palette";
import { Nav } from "@/components/nav";

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
    expect(routerPush).toHaveBeenCalledWith("/questions");

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

describe("app shell top navigation", () => {
  it("opens grouped menus, closes them with Escape, and cycles the theme", () => {
    render(<Nav />);

    const questions = screen.getByRole("button", { name: "Questões" });
    expect(questions).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(questions);
    expect(questions).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Nova questão/ })).toHaveAttribute("href", "/questions/new");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: /Nova questão/ })).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: /Tema: Sistema/ }));
    expect(screen.getByRole("button", { name: /Tema: Claro/ })).toBeInTheDocument();
  });
});
