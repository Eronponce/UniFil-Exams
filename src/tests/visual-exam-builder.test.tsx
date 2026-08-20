import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/types";

vi.mock("@/lib/actions/exams", () => ({ createExamAction: vi.fn() }));
vi.mock("@/components/print/exam-print-client", () => ({
  ExamPrintClient: ({ payload, setId }: { payload: { sets: Array<{ id: number; questions: Array<{ id: number }> }> }; setId?: number }) => {
    const set = payload.sets.find((candidate) => candidate.id === setId) ?? payload.sets[0];
    return <div data-testid="embedded-preview">{set?.questions.map((question) => question.id).join(",")}</div>;
  },
}));

import { calculateEmbeddedPreviewFit, VisualExamBuilder } from "@/app/(app)/exams/_components/visual-exam-builder";

const baseQuestion = (patch: Partial<Question>): Question => ({
  id: 1,
  disciplineId: 1,
  statement: "<p>Questão</p>",
  imageUrl: null,
  options: ["A", "B", "C", "D", "E"].map((text, index) => ({ index, text })),
  correctIndex: 0,
  difficulty: "medium",
  source: "manual",
  audited: true,
  rejected: false,
  thematicArea: null,
  explanation: "",
  questionType: "objetiva",
  answerLines: 0,
  correctAnswer: "",
  createdAt: "2026-01-01",
  ...patch,
});

const questions = [
  baseQuestion({ id: 1, statement: "<p>Objetiva 1</p>", imageUrl: "/q1.png" }),
  baseQuestion({ id: 2, statement: "<p>Objetiva 2</p>" }),
  baseQuestion({ id: 3, statement: "<p>V/F</p>", questionType: "verdadeiro_falso", options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }] }),
  baseQuestion({ id: 4, statement: "<p>Numérica</p>", questionType: "numerica", options: [] }),
  baseQuestion({ id: 5, statement: "<p>Dissertativa</p>", questionType: "dissertativa", options: [], answerLines: 4 }),
];

afterEach(() => {
  vi.clearAllMocks();
});

function renderBuilder() {
  return render(
    <VisualExamBuilder
      disciplineId={1}
      questions={questions}
      initialDraftSeed="visual-test"
      initialTitle="Prova visual"
      initialInstitution="UniFil"
      initialQuantitySets="2"
    />,
  );
}

describe("VisualExamBuilder", () => {
  it("fits an A4 page to the embedded panel without changing its measured dimensions", () => {
    const fit = calculateEmbeddedPreviewFit(793.7, 462.65, 1200);
    expect(fit.scale).toBeCloseTo(462.65 / 793.7, 6);
    expect(fit.height).toBe(Math.ceil(1200 * fit.scale));
    expect(fit.scale).toBeLessThan(1);
  });

  it("renders every canonical subgroup and disables moves at subgroup boundaries", () => {
    renderBuilder();

    for (const heading of ["objetiva meia", "objetiva total", "V/F meia", "V/F total", "numérica meia", "numérica total", "dissertativa meia", "dissertativa total"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Mover questão 1 para cima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover questão 2 para baixo" })).toBeDisabled();
  });

  it("keeps ordering inside a subgroup, regroups layout toggles, and submits the exact order", () => {
    renderBuilder();

    fireEvent.click(screen.getByRole("button", { name: "Mover questão 2 para cima" }));
    const orderInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="manualQuestionOrder"]'));
    expect(orderInputs.map((input) => input.value)).toEqual(["2", "1", "3", "4", "5"]);
    fireEvent.click(screen.getByRole("button", { name: "Alternar largura da questão 1" }));
    expect(screen.getByRole("heading", { name: "objetiva total" }).parentElement).toHaveTextContent("Questão 1");
    expect(document.querySelector<HTMLInputElement>('input[name="layoutOverride-1"]')).toHaveValue("full");
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="manualQuestionOrder"]')).map((input) => input.value)).toEqual(["2", "1", "3", "4", "5"]);
  });

  it("keeps slider state in parent form and the selected order in preview", () => {
    renderBuilder();

    fireEvent.change(screen.getByRole("slider", { name: "Escala da imagem da questão 1" }), { target: { value: "60" } });
    expect(document.querySelector<HTMLInputElement>('input[name="imageScale-1"]')).toHaveValue("60");
    const objectiveTwo = screen.getByRole("checkbox", { name: "Selecionar questão 2" });
    fireEvent.click(objectiveTwo);
    expect(document.querySelector<HTMLInputElement>('input[name="questionIds"][value="2"]')).not.toBeInTheDocument();
    expect(screen.getByTestId("embedded-preview")).toHaveTextContent("1,3,4,5");
    const setGroup = screen.getByRole("group", { name: "Sets da pré-visualização" });
    expect(within(setGroup).getByRole("button", { name: "Set A" })).toHaveAttribute("aria-pressed", "true");
    expect(within(setGroup).getByRole("button", { name: "Set B" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(setGroup).getByRole("button", { name: "Set B" }));
    expect(within(setGroup).getByRole("button", { name: "Set B" })).toHaveAttribute("aria-pressed", "true");
  });
});
