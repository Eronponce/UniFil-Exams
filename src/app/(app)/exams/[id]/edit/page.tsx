export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getDiscipline } from "@/lib/db/disciplines";
import { getExam, listExamVersions } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { getExamQuestionIdsInSetAOrder } from "@/lib/exam/reference-set";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";
import { restoreExamVersionAction } from "@/lib/actions/exams";
import { VisualExamBuilder } from "../../_components/visual-exam-builder";

export default async function ExamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = Number(id);
  const exam = Number.isSafeInteger(examId) && examId > 0 ? getExam(examId) : undefined;
  if (!exam) notFound();

  const discipline = getDiscipline(exam.disciplineId);
  const selectedQuestionIds = getExamQuestionIdsInSetAOrder(exam.sets);
  const currentQuestions = selectedQuestionIds
    .map((questionId) => getQuestion(questionId))
    .filter((question): question is NonNullable<typeof question> => question !== undefined);
  const auditedQuestions = listQuestionsFiltered({ disciplineId: exam.disciplineId, audited: true });
  const availableById = new Map([...auditedQuestions, ...currentQuestions].map((question) => [question.id, question]));
  const availableQuestions = [...availableById.values()].sort((left, right) => left.id - right.id);
  const answerKeyUrl = buildPrintExamPayload(exam).answerKeyUrl;
  const versions = listExamVersions(exam.id);

  return (
    <>
      <PageHeader
        eyebrow="Avaliações · Editar"
        title={`Editar ${exam.title}`}
        description="A mesma montagem visual da criação, agora salvando cada alteração como uma versão rastreável."
        actions={(
          <div className="actions-row">
            <Link href={`/print/exam/${exam.id}`} className="btn btn-ghost">Abrir preview</Link>
            <Link href={`/exports?exam=${exam.id}`} className="btn btn-ghost">← Exportações</Link>
          </div>
        )}
      />

      <VisualExamBuilder
        key={`edit-${exam.id}`}
        mode="edit"
        examId={exam.id}
        disciplineId={exam.disciplineId}
        disciplineName={discipline?.name}
        questions={availableQuestions}
        initialTitle={exam.title}
        initialInstitution={exam.institution}
        initialInstructions={exam.instructions}
        initialQuantitySets={String(exam.sets.length)}
        initialAllowQuestionSplit={exam.allowQuestionSplit ? "1" : ""}
        initialDraftSeed={`edit-${exam.id}`}
        initialSelectedQuestionIds={selectedQuestionIds}
        initialManualQuestionOrder={selectedQuestionIds}
        initialLayoutOverrides={exam.questionLayoutOverrides}
        initialImageScaleOverrides={exam.questionImageScaleOverrides}
        initialAnswerKeyWidthPt={exam.answerKeyWidthPt}
        initialAnswerKeyUrl={answerKeyUrl}
      />

      <details className="card exam-editor-history">
        <summary className="visual-exam-panel-summary">
          <span className="visual-exam-panel-summary-copy">
            <span role="heading" aria-level={2}>Histórico de versões</span>
            <small>Versões anteriores permanecem imutáveis e podem ser restauradas.</small>
          </span>
          <span className="badge">{versions.length} versão(ões)</span>
        </summary>
        <div className="exam-editor-version-list">
          {versions.map((version) => (
            <div key={version.id} className="exam-editor-version">
              <div className="exam-editor-version-heading">
                <strong>Versão {version.versionNumber}</strong>
                <time dateTime={version.createdAt}>{version.createdAt}</time>
              </div>
              <p>{version.changeNote || "Sem nota"}</p>
              <div className="actions-row">
                <Link href={`/print/exam/${exam.id}?version=${version.versionNumber}`} className="btn btn-ghost btn-sm">Preview</Link>
                <a href={`/api/pdf/exam/${exam.id}?version=${version.versionNumber}`} className="btn btn-ghost btn-sm">PDF</a>
                <form action={restoreExamVersionAction}>
                  <input type="hidden" name="examId" value={exam.id} />
                  <input type="hidden" name="versionNumber" value={version.versionNumber} />
                  <button type="submit" className="btn btn-ghost btn-sm">Restaurar como nova</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
