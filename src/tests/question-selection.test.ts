import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { ThematicAreaFilter } from "@/components/thematic-area-filter";
import { reconcileSelectedQuestionIds } from "@/lib/questions/selection";
import { ExamDisciplineFilter } from "@/app/(app)/exams/_components/exam-discipline-filter";

const navigationState = vi.hoisted(() => ({
  query: "discipline=1",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigationState.query),
  useRouter: () => ({ replace: navigationState.replace }),
  usePathname: () => "/exams",
}));

describe("reconcileSelectedQuestionIds", () => {
  it("keeps only selections still visible after a filter or data change", () => {
    expect([...reconcileSelectedQuestionIds([1, 2, 3], [2, 3, 4])]).toEqual([2, 3]);
  });

  it("shows visible checkboxes for multiple areas and clears them together", () => {
    function Harness() {
      const [selected, setSelected] = useState(["Álgebra"]);
      return createElement(ThematicAreaFilter, { areas: ["Álgebra", "Geometria", "Cálculo"], selectedAreas: selected, onChange: setSelected });
    }

    render(createElement(Harness));
    expect(screen.getByLabelText("Selecionar área temática Álgebra")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Selecionar área temática Geometria"));
    expect(screen.getByText("2 selecionadas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("0 selecionadas")).toBeInTheDocument();
  });

  it("supports the opt-in compact native dropdown without changing selection semantics", () => {
    function Harness() {
      const [selected, setSelected] = useState(["Álgebra"]);
      return createElement(ThematicAreaFilter, {
        areas: ["Álgebra", "Geometria"],
        selectedAreas: selected,
        onChange: setSelected,
        presentation: "dropdown",
      });
    }

    render(createElement(Harness));
    expect(document.querySelector("details.thematic-area-filter--dropdown")).toBeInTheDocument();
    expect(screen.getAllByText("1 selecionada")).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Selecionar área temática Geometria"));
    expect(screen.getAllByText("2 selecionadas")).toHaveLength(2);
  });

  it("keeps rapid compact toggles cumulative while router navigation is deferred", () => {
    navigationState.replace.mockClear();
    render(createElement(ExamDisciplineFilter, {
      disciplines: [{ id: 1, name: "Álgebra" }],
      areas: ["Álgebra", "Geometria"],
      selectedAreas: [],
    }));

    fireEvent.click(screen.getByLabelText("Selecionar área temática Álgebra"));
    fireEvent.click(screen.getByLabelText("Selecionar área temática Geometria"));

    expect(navigationState.replace).toHaveBeenCalledTimes(2);
    const latestUrl = String(navigationState.replace.mock.calls[1]?.[0]);
    expect(latestUrl).toContain("area=%C3%81lgebra");
    expect(latestUrl).toContain("area=Geometria");
  });

  it("keeps an optimistic clear while stale selected props await navigation", () => {
    navigationState.query = "discipline=1&area=%C3%81lgebra";
    navigationState.replace.mockClear();
    render(createElement(ExamDisciplineFilter, {
      disciplines: [{ id: 1, name: "Álgebra" }],
      areas: ["Álgebra", "Geometria"],
      selectedAreas: ["Álgebra"],
    }));

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar área temática Álgebra")).not.toBeChecked();
    expect(String(navigationState.replace.mock.calls[0]?.[0])).not.toContain("area=");
  });

  it("resets optimistic areas when the discipline context changes", () => {
    navigationState.query = "discipline=1";
    navigationState.replace.mockClear();
    const props = {
      disciplines: [{ id: 1, name: "Disciplina A" }, { id: 2, name: "Disciplina B" }],
      areas: ["Álgebra", "Geometria"],
      selectedAreas: [] as string[],
    };
    const view = render(createElement(ExamDisciplineFilter, props));

    fireEvent.click(screen.getByLabelText("Selecionar área temática Álgebra"));
    expect(screen.getByLabelText("Selecionar área temática Álgebra")).toBeChecked();

    navigationState.query = "discipline=2";
    view.rerender(createElement(ExamDisciplineFilter, { ...props, selectedAreas: [] }));

    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar área temática Álgebra")).not.toBeChecked();
  });
});
