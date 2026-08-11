import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const examDraft = {
  title: "Prova",
  institution: "UniFil",
  quantitySets: "2",
  numObjetivas: "7",
  numVF: "4",
  numDissertativas: "3",
  numNumericas: "2",
  layoutObjetiva: "full" as const,
  layoutVF: "column" as const,
  layoutNumerica: "column" as const,
  layoutDissertativa: "full" as const,
  allowQuestionSplit: false,
};
const originalExamDraft = { ...examDraft };
const updateExam = vi.fn((patch) => Object.assign(examDraft, patch));

vi.mock("@/lib/state/workspace-store", () => ({
  useWorkspaceStore: () => ({
    exam: examDraft,
    updateExam,
    resetExam: vi.fn(),
    selectedTypeCounts: null,
  }),
}));

import { ExamDraftFields } from "@/app/(app)/exams/_components/exam-draft-fields";

afterEach(() => {
  Object.assign(examDraft, originalExamDraft);
  updateExam.mockClear();
});

const baseProps = {
  initialTitle: "",
  initialInstitution: "",
  initialQuantitySets: "",
  initialNumObjetivas: "",
  initialNumVF: "",
  initialNumDissertativas: "",
  initialNumNumericas: "",
  initialLayoutObjetiva: "",
  initialLayoutVF: "",
  initialLayoutNumerica: "",
  initialLayoutDissertativa: "",
  initialAllowQuestionSplit: "",
};

describe("ExamDraftFields availability synchronization", () => {
  it("uses filtered-pool maxima on the first mount when no validation quantities are present", async () => {
    render(
      <ExamDraftFields
        {...baseProps}
        availabilityKey='{"discipline":1,"areas":[],"questionIds":[1,2,3]}'
        typeCounts={{ objetiva: 2, verdadeiro_falso: 0, numerica: 1, dissertativa: 0 }}
      />,
    );

    await waitFor(() => {
      expect(updateExam).toHaveBeenCalledWith({
        numObjetivas: "2",
        numVF: "0",
        numNumericas: "1",
        numDissertativas: "0",
      });
    });
  });

  it("preserves explicit validation-redirect quantities on the first mount", async () => {
    render(
      <ExamDraftFields
        {...baseProps}
        initialNumObjetivas="7"
        initialNumVF="4"
        initialNumNumericas="2"
        initialNumDissertativas="3"
        availabilityKey='{"discipline":1,"areas":[],"questionIds":[1]}'
        typeCounts={{ objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 }}
      />,
    );

    await waitFor(() => expect(document.querySelector('input[name="numObjetivas"]')).toHaveValue(7));
    expect(updateExam).not.toHaveBeenCalled();
  });

  it("replaces every quantity with filtered-pool maxima, including zero, when availability changes", async () => {
    const { rerender } = render(
      <ExamDraftFields
        {...baseProps}
        availabilityKey='{"discipline":1,"areas":["A"],"questionIds":[1]}'
        typeCounts={{ objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 }}
      />,
    );

    rerender(
      <ExamDraftFields
        {...baseProps}
        availabilityKey='{"discipline":1,"areas":["B"],"questionIds":[2,3,4]}'
        typeCounts={{ objetiva: 2, verdadeiro_falso: 0, numerica: 1, dissertativa: 0 }}
      />,
    );

    await waitFor(() => {
      expect(updateExam).toHaveBeenCalledWith({
        numObjetivas: "2",
        numVF: "0",
        numNumericas: "1",
        numDissertativas: "0",
      });
    });
  });

  it("uses validation-redirect layouts only to seed the draft, then allows a switch to change them", async () => {
    const props = {
      ...baseProps,
      initialLayoutObjetiva: "full",
      availabilityKey: "availability-a",
      typeCounts: { objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 },
    };
    const { rerender } = render(<ExamDraftFields {...props} />);

    await waitFor(() => expect(screen.getByLabelText("Objetivas: largura total")).toBeChecked());
    fireEvent.click(screen.getByLabelText("Objetivas: largura total"));
    rerender(<ExamDraftFields {...props} />);

    expect(screen.getByLabelText("Objetivas: largura total")).not.toBeChecked();
    expect(document.querySelector('input[name="layoutObjetiva"]')).toHaveValue("column");
  });

  it("keeps persisted layouts when no validation-redirect layout values exist", async () => {
    Object.assign(examDraft, { layoutObjetiva: "full", layoutDissertativa: "column" });
    render(
      <ExamDraftFields
        {...baseProps}
        availabilityKey="availability-a"
        typeCounts={{ objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Objetivas: largura total")).toBeChecked());
    expect(screen.getByLabelText("Dissertativas: largura total")).not.toBeChecked();
    expect(document.querySelector('input[name="layoutObjetiva"]')).toHaveValue("full");
    expect(document.querySelector('input[name="layoutDissertativa"]')).toHaveValue("column");
    expect(updateExam).not.toHaveBeenCalledWith(expect.objectContaining({ layoutObjetiva: "column" }));
  });

  it("uses the validation flag in the controlled checkbox and hidden form value", async () => {
    render(
      <ExamDraftFields
        {...baseProps}
        initialAllowQuestionSplit="1"
        availabilityKey="availability-a"
        typeCounts={{ objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 }}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Permitir quebra de questões objetivas longas entre colunas\/páginas/ });
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(document.querySelector('input[name="allowQuestionSplit"]')).toHaveValue("1");

    fireEvent.click(checkbox);
    expect(updateExam).toHaveBeenCalledWith({ allowQuestionSplit: false });
  });
});
