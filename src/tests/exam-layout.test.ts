import Database from "better-sqlite3";
import { createElement, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { QuestionBlock } from "@/components/print/exam-print-client";
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
    expect(buildPrintExamPayload(created).questionLayouts).toEqual(created.questionLayouts);
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
});

describe("student print affordances", () => {
  function renderQuestion(question: ComponentProps<typeof QuestionBlock>["question"]) {
    render(createElement(QuestionBlock, { question }));
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
});
