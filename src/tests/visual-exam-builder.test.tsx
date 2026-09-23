import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintExamPayload } from "@/lib/print/build-print-payload";
import type { Question } from "@/types";

vi.mock("@/lib/actions/exams", () => ({
  createExamAction: vi.fn(),
  saveVisualExamVersionAction: vi.fn(),
  saveExamPreviewImageScalesAction: vi.fn(),
}));
vi.mock("@/components/print/exam-print-client", () => ({
  ExamPrintClient: ({ payload, setId }: { payload: { answerKeyUrl: string | null; answerKeyWidthPt: number; sets: Array<{ id: number; questions: Array<{ id: number }> }> }; setId?: number }) => {
    const set = payload.sets.find((candidate) => candidate.id === setId) ?? payload.sets[0];
    return <div data-testid="embedded-preview" data-answer-key-url={payload.answerKeyUrl} data-answer-key-width={payload.answerKeyWidthPt}>{set?.questions.map((question) => question.id).join(",")}</div>;
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

  it("renders only the populated canonical subgroups and disables moves at subgroup boundaries", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("tab", { name: /Na prova/ }));

    for (const heading of ["objetiva meia", "V/F meia", "numérica meia", "dissertativa total"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "objetiva total" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover questão 1 para cima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover questão 2 para baixo" })).toBeDisabled();
  });

  it("keeps ordering inside a subgroup, regroups layout toggles, and submits the exact order", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("tab", { name: /Na prova/ }));

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

    fireEvent.click(screen.getByRole("tab", { name: /Na prova/ }));
    fireEvent.change(screen.getByRole("slider", { name: "Escala da imagem da questão 1" }), { target: { value: "60" } });
    expect(document.querySelector<HTMLInputElement>('input[name="imageScale-1"]')).toHaveValue("60");
    fireEvent.click(screen.getByRole("tab", { name: /Banco/ }));
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

  it("attaches, previews, resizes, and removes the draft answer key", () => {
    const createObjectUrl = vi.fn(() => "blob:draft-answer-key");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
    renderBuilder();
    fireEvent.click(screen.getByRole("tab", { name: /Configurar/ }));

    const fileInput = screen.getByLabelText("Anexar gabarito");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "gabarito.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const preview = screen.getByTestId("embedded-preview");
    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(preview).toHaveAttribute("data-answer-key-url", "blob:draft-answer-key");
    expect(screen.getByText("gabarito.png")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Tamanho do gabarito" }), { target: { value: "425" } });
    expect(preview).toHaveAttribute("data-answer-key-width", "425");
    expect(document.querySelector<HTMLInputElement>('input[name="answerKeyWidthPt"]')).toHaveValue("425");

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByTestId("embedded-preview").getAttribute("data-answer-key-url")).toContain("data:image/svg+xml");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:draft-answer-key");
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

  it("keeps questions marked out of this exam unavailable to quantity changes", () => {
    render(
      <VisualExamBuilder
        disciplineId={1}
        questions={[
          ...questions,
          baseQuestion({ id: 6, statement: "<p>Objetiva 3</p>" }),
          baseQuestion({ id: 7, statement: "<p>Objetiva 4</p>" }),
        ]}
        initialDraftSeed="visual-test"
        initialTitle="Prova visual"
      />,
    );

    const objectiveQuantity = screen.getByRole("spinbutton", { name: "Quantidade de Objetivas" });
    expect(objectiveQuantity).toHaveValue(4);
    fireEvent.click(screen.getByRole("checkbox", { name: "Deixar questão 2 fora desta prova" }));

    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).toBeDisabled();
    expect(objectiveQuantity).toHaveValue(3);
    expect(objectiveQuantity).toHaveAttribute("max", "3");
    expect(screen.getByText("de 3 · 1 fora")).toBeInTheDocument();
    expect(screen.getByText("6 disponível(is) · 6 na prova · 1 fora")).toBeInTheDocument();

    fireEvent.change(objectiveQuantity, { target: { value: "0" } });
    fireEvent.change(objectiveQuantity, { target: { value: "4" } });
    expect(objectiveQuantity).toHaveValue(3);
    expect(document.querySelector<HTMLInputElement>('input[name="questionIds"][value="2"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Deixar questão 2 fora desta prova" }));
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).not.toBeChecked();
    expect(objectiveQuantity).toHaveAttribute("max", "4");
  });

  it("resolves typed quantities against the focus-time selection", () => {
    render(
      <VisualExamBuilder
        disciplineId={1}
        questions={[
          ...questions,
          baseQuestion({ id: 6, statement: "<p>Objetiva 3</p>" }),
          baseQuestion({ id: 7, statement: "<p>Objetiva 4</p>" }),
        ]}
        initialDraftSeed="visual-test"
        initialTitle="Prova visual"
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar questão 2" }));
    const objectiveQuantity = screen.getByRole("spinbutton", { name: "Quantidade de Objetivas" });
    expect(objectiveQuantity).toHaveValue(3);

    fireEvent.focus(objectiveQuantity);
    fireEvent.change(objectiveQuantity, { target: { value: "" } });
    fireEvent.change(objectiveQuantity, { target: { value: "2" } });
    fireEvent.blur(objectiveQuantity);

    const selectedObjectives = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="questionIds"]'))
      .map((input) => input.value)
      .filter((id) => ["1", "2", "6", "7"].includes(id));
    expect(selectedObjectives).toEqual(["1", "6"]);
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).not.toBeChecked();
  });

  it("filters the audited bank by text, type and status without changing the selection", () => {
    renderBuilder();

    const poolRows = () => document.querySelectorAll(".visual-exam-pool-row").length;
    expect(poolRows()).toBe(5);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar no banco auditado" }), { target: { value: "numerica" } });
    expect(poolRows()).toBe(1);
    expect(screen.getByText("Mostrando 1 de 5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole("button", { name: /Objetivas/ }));
    expect(poolRows()).toBe(2);

    fireEvent.click(screen.getByRole("checkbox", { name: "Deixar questão 2 fora desta prova" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por situação" }), { target: { value: "excluded" } });
    expect(poolRows()).toBe(1);
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por situação" }), { target: { value: "selected" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole("button", { name: /Todas/ }));
    expect(poolRows()).toBe(4);
    expect(document.querySelectorAll('input[name="questionIds"]')).toHaveLength(4);
  });

  it("does not submit the exam when Enter is pressed inside a field", () => {
    renderBuilder();

    const title = screen.getByRole("textbox", { name: "Título *" });
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    title.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /Configurar/ }));
    const instructions = screen.getByRole("textbox", { name: "Instruções da primeira página" });
    const textareaEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    instructions.dispatchEvent(textareaEvent);
    expect(textareaEvent.defaultPrevented).toBe(false);
  });

  it("reuses the visual creation surface in edit mode with the saved composition", () => {
    render(
      <VisualExamBuilder
        mode="edit"
        examId={42}
        disciplineId={1}
        questions={questions}
        initialDraftSeed="edit-42"
        initialTitle="Prova existente"
        initialInstitution="UniFil"
        initialQuantitySets="1"
        initialSelectedQuestionIds={[1, 3]}
        initialManualQuestionOrder={[1, 3]}
        initialImageScaleOverrides={{ 1: 70 }}
        initialAnswerKeyUrl="/api/upload/gabarito/42/file"
      />,
    );

    expect(screen.getByRole("heading", { name: "Editar prova" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar nova versão" })).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="examId"]')).toHaveValue("42");
    expect(document.querySelector<HTMLInputElement>('input[name="questionIds"][value="1"]')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="questionIds"][value="2"]')).not.toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="imageScale-1"]')).toHaveValue("70");
    expect(screen.getByTestId("embedded-preview")).toHaveAttribute("data-answer-key-url", "/api/upload/gabarito/42/file");
    expect(screen.getByRole("checkbox", { name: "Selecionar questão 2" })).not.toBeChecked();
  });

  it("keeps the submit bar visible and switches between bank, order and settings tabs", () => {
    renderBuilder();

    expect(screen.getByText("5 questão(ões) · 2 set(s)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar prova" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /Banco/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /Banco/ })).toBeVisible();

    fireEvent.keyDown(screen.getByRole("tab", { name: /Banco/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Na prova/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Posição 1 na prova")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mover questão 2 para cima" }));
    expect(screen.getByText("Posição 1 na prova").closest("li")).toHaveTextContent("Questão 2");

    fireEvent.click(screen.getByRole("tab", { name: /Configurar/ }));
    expect(screen.getByRole("textbox", { name: "Instituição" })).toHaveValue("UniFil");
    expect(screen.queryByRole("checkbox", { name: "Selecionar questão 1" })).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[name="questionIds"]')).toHaveLength(5);
  });

  it("steps type quantities with the minus and plus buttons", () => {
    renderBuilder();

    const objectiveQuantity = screen.getByRole("spinbutton", { name: "Quantidade de Objetivas" });
    expect(screen.getByRole("button", { name: "Aumentar Objetivas" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Objetivas" }));
    expect(objectiveQuantity).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Objetivas" }));
    expect(objectiveQuantity).toHaveValue(2);
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

  it("offers persisted image-size saving in the standalone exam preview", async () => {
    const { ExamPrintClient } = await vi.importActual<typeof import("@/components/print/exam-print-client")>("@/components/print/exam-print-client");
    const payload: PrintExamPayload = {
      ...landmarkPayload,
      examId: 42,
      sets: [{
        id: 9,
        label: "A",
        questions: [{
          id: 7,
          sourceQuestionId: 7,
          statementHtml: "<p>Questão com imagem</p>",
          imageUrl: "/uploads/questions/7.png",
          options: ["A", "B", "C", "D", "E"].map((text, index) => ({ index, text })),
          shuffledOptions: [0, 1, 2, 3, 4],
          questionType: "objetiva",
          answerLines: 0,
          layout: "column",
          imageScalePercent: 65,
        }],
      }],
    };
    const previousFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>(() => undefined) } });

    try {
      render(<ExamPrintClient payload={payload} mode="exam" />);
      expect(screen.getByRole("button", { name: "Salvar tamanhos" })).toBeInTheDocument();
      expect(document.querySelector<HTMLInputElement>('input[name="examId"]')).toHaveValue("42");
      expect(document.querySelector<HTMLInputElement>('input[name="imageScale-7"]')).toHaveValue("65");
    } finally {
      if (previousFonts) Object.defineProperty(document, "fonts", previousFonts);
      else Reflect.deleteProperty(document, "fonts");
    }
  });
});
