import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { ThematicAreaFilter } from "@/components/thematic-area-filter";
import { reconcileSelectedQuestionIds } from "@/lib/questions/selection";

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
});
