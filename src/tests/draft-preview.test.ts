import { describe, expect, it } from "vitest";
import { buildDraftPrintPayload, DRAFT_ANSWER_KEY_PLACEHOLDER_URL, resolveDraftPreviewSeed, type DraftPreviewDraft, type DraftPreviewQuestion } from "@/lib/exam/draft-preview";

const questions: DraftPreviewQuestion[] = [
  {
    id: 4,
    statement: "<p>Dissertativa</p>",
    imageUrl: null,
    options: [],
    correctIndex: 0,
    questionType: "dissertativa",
    answerLines: 3,
    correctAnswer: "",
  },
  {
    id: 1,
    statement: "<p>Objetiva 1</p>",
    imageUrl: "/uploads/q1.png",
    options: ["A", "B", "C", "D", "E"].map((text, index) => ({ index, text })),
    correctIndex: 2,
    questionType: "objetiva",
    answerLines: 0,
    correctAnswer: "",
  },
  {
    id: 2,
    statement: "<p>V/F</p>",
    imageUrl: null,
    options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }],
    correctIndex: 1,
    questionType: "verdadeiro_falso",
    answerLines: 0,
    correctAnswer: "",
  },
  {
    id: 3,
    statement: "<p>Numérica</p>",
    imageUrl: null,
    options: [],
    correctIndex: 0,
    questionType: "numerica",
    answerLines: 0,
    correctAnswer: "42",
  },
];

function makeDraft(patch: Partial<DraftPreviewDraft> = {}): DraftPreviewDraft {
  return {
    title: "Rascunho",
    institution: "UniFil",
    instructions: "Leia.",
    quantitySets: 3,
    allowQuestionSplit: false,
    questionLayouts: {
      objetiva: "column",
      verdadeiro_falso: "column",
      numerica: "column",
      dissertativa: "full",
    },
    selectedQuestionIds: [4, 1, 2, 3],
    manualQuestionOrder: [4, 2, 1, 3],
    layoutOverrides: { 1: "full" },
    imageScaleOverrides: { 1: 65 },
    draftSeed: "draft-seed",
    ...patch,
  };
}

describe("buildDraftPrintPayload", () => {
  it("uses the backend seed normalization and fallback", () => {
    const longSeed = `  ${"x".repeat(140)}  `;
    expect(resolveDraftPreviewSeed("  visual-seed  ")).toBe("visual-seed");
    expect(resolveDraftPreviewSeed(longSeed)).toBe("x".repeat(128));
    expect(resolveDraftPreviewSeed("   ")).toBe("visual-default");
    expect(buildDraftPrintPayload(questions, makeDraft({ draftSeed: "  visual-seed  " }))).toEqual(
      buildDraftPrintPayload(questions, makeDraft({ draftSeed: "visual-seed" })),
    );
  });

  it("creates deterministic synthetic sets with canonical manual order", () => {
    const first = buildDraftPrintPayload(questions, makeDraft());
    const second = buildDraftPrintPayload(questions, makeDraft());

    expect(first).toEqual(second);
    expect(first.sets).toHaveLength(3);
    expect(first.sets.map((set) => set.id)).toEqual([1_000_000, 1_000_001, 1_000_002]);
    expect(first.sets.map((set) => set.questions.map((question) => question.id))).toEqual([
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ]);
    expect(first.sets[0]?.questions[0]).toMatchObject({
      layout: "full",
      layoutOverride: "full",
      imageScalePercent: 65,
    });
    expect(first.answerKeyUrl).toBe(DRAFT_ANSWER_KEY_PLACEHOLDER_URL);
    expect(decodeURIComponent(first.answerKeyUrl ?? "")).toContain("GABARITO");
    expect(decodeURIComponent(first.answerKeyUrl ?? "")).toContain("PLACEHOLDER");
    expect(decodeURIComponent(first.answerKeyUrl ?? "")).toMatch(/width="1068" height="883"/);
    expect(decodeURIComponent(first.answerKeyUrl ?? "")).toContain("1068 × 883 px");
  });

  it("reflects deselection, width, and default scale omission", () => {
    const payload = buildDraftPrintPayload(questions, makeDraft({
      selectedQuestionIds: [4, 1, 3],
      manualQuestionOrder: [3, 4, 1],
      layoutOverrides: { 1: "column" },
      imageScaleOverrides: { 1: 100 },
      quantitySets: 1,
    }));

    expect(payload.sets[0]?.questions.map((question) => question.id)).toEqual([1, 3, 4]);
    expect(payload.sets[0]?.questions.find((question) => question.id === 1)).toMatchObject({ layout: "column" });
    expect(payload.sets[0]?.questions.find((question) => question.id === 1)).not.toHaveProperty("imageScalePercent");
  });

  it("uses an attached draft answer key and its live width instead of the placeholder", () => {
    const payload = buildDraftPrintPayload(questions, makeDraft({
      answerKeyUrl: "blob:answer-key-preview",
      answerKeyWidthPt: 425,
    }));

    expect(payload.answerKeyUrl).toBe("blob:answer-key-preview");
    expect(payload.answerKeyWidthPt).toBe(425);
  });
});
