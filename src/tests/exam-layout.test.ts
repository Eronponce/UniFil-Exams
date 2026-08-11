import Database from "better-sqlite3";
import { createElement, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const redirectWithToastMock = vi.hoisted(() => vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
}));
vi.mock("@/lib/toast", () => ({ redirectWithToast: redirectWithToastMock }));

import { QuestionBlock } from "@/components/print/exam-print-client";
import { createExamAction } from "@/lib/actions/exams";
import { createExam, getExam } from "@/lib/db/exams";
import { migrate } from "@/lib/db/schema";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";
import { normalizeExamQuestionLayouts } from "@/lib/exam/layout";

beforeEach(() => {
  db = new Database(":memory:");
  migrate();
});

afterEach(() => db.close());

describe("exam question layouts", () => {
  it("defaults the split preference to false for new exams", () => {
    db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
    const created = createExam({ disciplineId: 1, title: "Indivisível", questionIds: [] });

    expect(created.allowQuestionSplit).toBe(false);
    expect(db.prepare("SELECT allow_question_split FROM exams WHERE id = ?").get(created.id)).toEqual({ allow_question_split: 0 });
    expect(buildPrintExamPayload(created).allowQuestionSplit).toBe(false);
  });

  it("normalizes missing and invalid persisted values to backward-compatible defaults", () => {
    expect(normalizeExamQuestionLayouts({ objetiva: "invalid", dissertativa: null })).toEqual({
      objetiva: "column",
      verdadeiro_falso: "column",
      numerica: "column",
      dissertativa: "full",
    });
  });

  it("persists all four layouts and carries them into the print payload", () => {
    db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'Matemática', 'MAT')").run();
    const created = createExam({
      disciplineId: 1,
      title: "Layout misto",
      allowQuestionSplit: true,
      questionIds: [],
      questionLayouts: {
        objetiva: "full",
        verdadeiro_falso: "column",
        numerica: "full",
        dissertativa: "column",
      },
    });

    expect(getExam(created.id)?.questionLayouts).toEqual({
      objetiva: "full",
      verdadeiro_falso: "column",
      numerica: "full",
      dissertativa: "column",
    });
    expect(getExam(created.id)?.allowQuestionSplit).toBe(true);
    expect(buildPrintExamPayload(created).questionLayouts).toEqual(created.questionLayouts);
    expect(buildPrintExamPayload(created).allowQuestionSplit).toBe(true);
  });

  it("adds the split column with a zero default when migrating a legacy exams table", () => {
    db.close();
    db = new Database(":memory:");
    db.exec(`CREATE TABLE exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discipline_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    migrate();

    expect(db.prepare("PRAGMA table_info(exams)").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "allow_question_split", notnull: 1, dflt_value: "0" }),
    ]));
    db.prepare("INSERT INTO exams (discipline_id, title) VALUES (1, 'Legada')").run();
    expect(db.prepare("SELECT allow_question_split FROM exams").get()).toEqual({ allow_question_split: 0 });
  });

  it("loads legacy invalid layout columns using the documented defaults", () => {
    db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'Física', 'FIS')").run();
    const created = createExam({ disciplineId: 1, title: "Legada", questionIds: [] });
    db.prepare(`UPDATE exams SET
      layout_objetiva = 'half',
      layout_verdadeiro_falso = 'wide',
      layout_numerica = 'wide',
      layout_dissertativa = 'wide'
      WHERE id = ?`).run(created.id);

    expect(getExam(created.id)?.questionLayouts).toEqual({
      objetiva: "column",
      verdadeiro_falso: "column",
      numerica: "column",
      dissertativa: "full",
    });
  });

  it("preserves the split preference in validation redirects", async () => {
    redirectWithToastMock.mockClear();
    const formData = new FormData();
    formData.set("disciplineId", "1");
    formData.set("allowQuestionSplit", "1");

    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");
    const redirectUrl = redirectWithToastMock.mock.calls.at(-1)?.[0];
    expect(typeof redirectUrl).toBe("string");
    expect(new URL(`http://local${redirectUrl}`).searchParams.get("allowQuestionSplit")).toBe("1");
  });
});

describe("student print affordances", () => {
  function renderQuestion(
    question: ComponentProps<typeof QuestionBlock>["question"],
    props: Omit<ComponentProps<typeof QuestionBlock>, "question"> = {},
  ) {
    render(createElement(QuestionBlock, { question, ...props }));
  }

  it("renders distinct V/F and numeric response fields", () => {
    const base = {
      id: 1,
      statementHtml: "<p>Enunciado</p>",
      imageUrl: null,
      options: [],
      shuffledOptions: [],
      answerLines: 0,
      displayNumber: 1,
      measureKey: "q-1",
    };
    renderQuestion({ ...base, questionType: "verdadeiro_falso" });
    expect(screen.getByText("Verdadeiro")).toBeInTheDocument();
    expect(screen.getByText("Falso")).toBeInTheDocument();

    renderQuestion({ ...base, id: 2, measureKey: "q-2", questionType: "numerica" });
    expect(screen.getByText("Resposta numérica:")).toBeInTheDocument();
  });

  it("does not invent answer lines when a discursive question explicitly requests zero", () => {
    renderQuestion({
      id: 3,
      statementHtml: "<p>Desenhe</p>",
      imageUrl: null,
      options: [],
      shuffledOptions: [],
      questionType: "dissertativa",
      answerLines: 0,
      displayNumber: 1,
      measureKey: "q-3",
    });

    expect(document.querySelectorAll(".exam-print-essay-line")).toHaveLength(0);
  });

  it("renders a compact continuation with the original shuffled option letters", () => {
    renderQuestion({
      id: 4,
      statementHtml: "<p>Enunciado</p>",
      imageUrl: null,
      options: [
        { index: 0, text: "Opção 1" },
        { index: 1, text: "Opção 2" },
        { index: 2, text: "Opção 3" },
        { index: 3, text: "Opção 4" },
        { index: 4, text: "Opção 5" },
      ],
      shuffledOptions: [2, 0, 4, 1, 3],
      questionType: "objetiva",
      answerLines: 0,
      displayNumber: 4,
      measureKey: "q-4",
    }, { optionStart: 2, optionEnd: 5, continuation: true });

    expect(screen.getByText("4. (continuação)")).toBeInTheDocument();
    expect(screen.queryByText("Enunciado")).not.toBeInTheDocument();
    expect(screen.getByText("C)")).toBeInTheDocument();
    expect(screen.getByText("D)")).toBeInTheDocument();
    expect(screen.getByText("E)")).toBeInTheDocument();
    expect(screen.getByText("Opção 5")).toBeInTheDocument();
  });
});
