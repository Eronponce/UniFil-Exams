import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getPrototypeMeasurementKey, isRenderStateCurrent, QuestionBlock } from "@/components/print/exam-print-client";
import { paginateQuestionsWithReservedLastPage } from "@/lib/print/pagination";

const question = {
  id: 10,
  displayNumber: 1,
  measureKey: "set-q1",
  statementHtml: "<p>Enunciado longo</p>",
  imageUrl: null,
  options: [0, 1, 2].map((index) => ({ index, text: `Opção ${index + 1}` })),
  shuffledOptions: [2, 0, 1],
  questionType: "objetiva" as const,
  answerLines: 0,
  layout: "column" as const,
};

describe("objective print continuation", () => {
  it("invalidates the prototype metric when multiline instructions or metadata change", () => {
    const baseline = {
      title: "Prova final",
      institution: "UniFil",
      instructions: "Leia atentamente.\nAssinale uma alternativa.",
    };

    expect(getPrototypeMeasurementKey(baseline)).not.toBe(
      getPrototypeMeasurementKey({ ...baseline, instructions: "Leia atentamente." }),
    );
    expect(getPrototypeMeasurementKey(baseline)).not.toBe(
      getPrototypeMeasurementKey({ ...baseline, title: "Prova final revisada" }),
    );
  });

  it("hides the old render while a new metric is measured and pages are rebuilt", () => {
    const oldKey = getPrototypeMeasurementKey({
      title: "Prova final",
      institution: "UniFil",
      instructions: "Instruções curtas",
    });
    const newKey = getPrototypeMeasurementKey({
      title: "Prova final revisada",
      institution: "UniFil",
      instructions: "Instruções\ncom segunda linha",
    });

    // Metadata changed and the new prototype metric arrived, but the async
    // pagination run has not published its new RenderState yet.
    expect(isRenderStateCurrent(newKey, oldKey, newKey)).toBe(false);
    // Only the completed run may make the preview visible again.
    expect(isRenderStateCurrent(newKey, newKey, newKey)).toBe(true);
  });

  it("starts incomplete fragments on the next physical page and exposes both markers", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [{
        id: question.id,
        displayNumber: question.displayNumber,
        layout: "column",
        columnHeight: 180,
        fullHeight: 180,
        split: {
          optionCount: 3,
          firstHeights: [0, 48, 120, 180],
          continuationHeights: [
            [0, 0, 0, 0],
            [0, 0, 50, 50],
            [0, 0, 0, 50],
            [0, 0, 0, 0],
          ],
        },
      }],
      100,
      100,
      { allowQuestionSplit: true },
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]?.placed[0]).toMatchObject({ optionStart: 0, optionEnd: 1, continuesToNextPage: true });
    expect(pages[1]?.placed[0]).toMatchObject({ optionStart: 1, optionEnd: 3, continuation: true, continuesToNextPage: false });
    expect(pages[1]?.placed[0]?.column).toBe("left");

    const { rerender } = render(
      <QuestionBlock question={question} optionStart={0} optionEnd={1} continuesToNextPage />,
    );
    expect(screen.getByTestId("exam-print-continuation-marker")).toHaveTextContent("Questão 1 continua na próxima página →");
    rerender(<QuestionBlock question={question} optionStart={1} optionEnd={3} continuation />);
    expect(screen.getByText(/1\. \(continuação\)/)).toBeInTheDocument();
  });
});
