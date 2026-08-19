import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/types";

const { listQuestionsFiltered } = vi.hoisted(() => ({ listQuestionsFiltered: vi.fn() }));

vi.mock("@/lib/db/questions-filter", () => ({
  listQuestionsFiltered,
}));

import { GET } from "@/app/api/export/questions/route";

const QUESTION: Question = {
  id: 42, disciplineId: 1, statement: "Questão exportada", imageUrl: null, options: [], correctIndex: 0,
  difficulty: "medium", source: "manual", audited: true, rejected: false, thematicArea: "A", explanation: "",
  questionType: "dissertativa", answerLines: 2, correctAnswer: "", createdAt: "2026-01-01",
};

beforeEach(() => {
  listQuestionsFiltered.mockReset();
  listQuestionsFiltered.mockReturnValue([QUESTION]);
});

describe("question export filters", () => {
  it("passes repeated areas as the same normalized union filter for JSON and CSV", async () => {
    const json = await GET(new NextRequest("http://localhost/api/export/questions?discipline=1&area=%20A%20&area=B&area=A&format=json"));
    const csv = await GET(new NextRequest("http://localhost/api/export/questions?discipline=1&area=%20A%20&area=B&area=A&format=csv"));

    expect(await json.json()).toMatchObject({ questions: [{ statement: "Questão exportada" }] });
    expect(await csv.text()).toContain("Questão exportada");
    expect(listQuestionsFiltered).toHaveBeenNthCalledWith(1, expect.objectContaining({ disciplineId: 1, thematicAreas: ["A", "B"] }));
    expect(listQuestionsFiltered).toHaveBeenNthCalledWith(2, expect.objectContaining({ disciplineId: 1, thematicAreas: ["A", "B"] }));
  });

  it("passes the missing thematic-area filter to exports", async () => {
    await GET(new NextRequest("http://localhost/api/export/questions?withoutArea=1&format=json"));

    expect(listQuestionsFiltered).toHaveBeenCalledWith(expect.objectContaining({ withoutThematicArea: true }));
  });
});
