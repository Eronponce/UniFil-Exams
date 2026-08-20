import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintExamPayload } from "@/lib/print/build-print-payload";
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

const landmarkPayload: PrintExamPayload = {
  examId: 1,
  title: "Prova de landmark",
  institution: "UniFil",
  instructions: "",
  answerKeyWidthPt: 150,
  allowQuestionSplit: false,
  questionLayouts: { objetiva: "column", verdadeiro_falso: "column", numerica: "column", dissertativa: "full" },
  logoUrl: null,
  answerKeyUrl: null,
  sets: [{ id: 1, label: "A", questions: [] }],
};

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

  it("keeps visible type quantities bidirectional with exact selection", () => {
    renderBuilder();

    const objectiveQuantity = screen.getByRole("spinbutton", { name: "Quantidade de Objetivas" });
    expect(objectiveQuantity).toHaveValue(2);
    fireEvent.change(objectiveQuantity, { target: { value: "1" } });
    expect(objectiveQuantity).toHaveValue(1);
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).not.toBeChecked();
    expect(document.querySelector<HTMLInputElement>('input[name="questionIds"][value="2"]')).not.toBeInTheDocument();

    fireEvent.change(objectiveQuantity, { target: { value: "2" } });
    expect(objectiveQuantity).toHaveValue(2);
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar questão 1" }));
    expect(objectiveQuantity).toHaveValue(1);
  });

  it("collapses setup and audited-bank panels while retaining useful summaries and positions", () => {
    renderBuilder();

    const setup = document.querySelector<HTMLDetailsElement>(".visual-exam-setup");
    const pool = document.querySelector<HTMLDetailsElement>(".visual-exam-pool");
    expect(setup?.open).toBe(true);
    expect(pool?.open).toBe(true);
    expect(screen.getByText("5 selecionada(s) · 2 set(s)")).toBeInTheDocument();
    expect(screen.getByText("5 disponível(is) · 5 selecionada(s)")).toBeInTheDocument();
    expect(screen.getByText("Posição 1 na prova")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Nova prova"));
    fireEvent.click(screen.getByText("Banco auditado"));
    expect(setup?.open).toBe(false);
    expect(pool?.open).toBe(false);
    expect(screen.getByText("5 selecionada(s) · 2 set(s)")).toBeInTheDocument();
    expect(screen.getByText("5 disponível(is) · 5 selecionada(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mover questão 2 para cima" }));
    expect(screen.getByText("Posição 1 na prova").closest("li")).toHaveTextContent("Questão 2");
  });

  it("keeps the standalone image rail in a layout column instead of a toolbar offset", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.exam-print-layout--has-image-controls \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 280px;/);
    expect(css).toMatch(/\.exam-print-scale-sidebar \{ position: sticky;[\s\S]*?top: 0;/);
    expect(css).toContain(".exam-print-page { width: 210mm;");
    expect(1120).toBeGreaterThanOrEqual(793.7 + 280);
    expect(css).toMatch(/@media \(max-width: 1120px\)[\s\S]*?\.exam-print-scale-sidebar \{[\s\S]*?position: static;[\s\S]*?top: auto;[\s\S]*?z-index: auto;/);
    expect(css).toMatch(/@media \(max-width: 1120px\)[\s\S]*?\.visual-exam-preview-canvas \{[\s\S]*?height: min\(680px, calc\(100vh - 8\.5rem\)\);[\s\S]*?max-height: min\(680px, calc\(100vh - 8\.5rem\)\);[\s\S]*?min-height: 280px;[\s\S]*?overflow: auto;[\s\S]*?overscroll-behavior: contain;/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.visual-exam-preview-canvas \{[\s\S]*?height: min\(560px, calc\(100vh - 7rem\)\);[\s\S]*?max-height: min\(560px, calc\(100vh - 7rem\)\);[\s\S]*?min-height: 240px;[\s\S]*?overflow: auto;[\s\S]*?overscroll-behavior: contain;/);
    expect(css).not.toContain(".visual-exam-preview-canvas { height: auto; max-height: none; }");
    expect(css).not.toContain("top: 5.25rem");
    expect(css).not.toContain("top: 8.25rem");
    expect(css).toContain(".exam-print-shell--embedded .exam-print-toolbar, .exam-print-shell--embedded .exam-print-scale-sidebar");
    expect(css).toContain(".exam-print-shell--embedded .exam-print-layout { min-height: 0; }");
  });

  it("uses a neutral embedded wrapper and a main landmark for standalone print", async () => {
    const { ExamPrintClient } = await vi.importActual<typeof import("@/components/print/exam-print-client")>("@/components/print/exam-print-client");
    const previousFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>(() => undefined) } });

    try {
      const standalone = render(<ExamPrintClient payload={landmarkPayload} mode="exam" />);
      expect(standalone.container.querySelector("main.exam-print-main")).toBeInTheDocument();
      expect(standalone.container.querySelector("div.exam-print-main")).not.toBeInTheDocument();
      standalone.unmount();

      const embedded = render(<ExamPrintClient payload={landmarkPayload} mode="exam" embedded />);
      expect(embedded.container.querySelector("main.exam-print-main")).not.toBeInTheDocument();
      expect(embedded.container.querySelector("div.exam-print-main")).toBeInTheDocument();
      embedded.unmount();
    } finally {
      if (previousFonts) Object.defineProperty(document, "fonts", previousFonts);
      else Reflect.deleteProperty(document, "fonts");
    }
  });
});
