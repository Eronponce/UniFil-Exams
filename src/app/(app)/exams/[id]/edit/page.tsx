export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getExam, getExamVersion, listExamVersions } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { getExamQuestionIdsInSetAOrder } from "@/lib/exam/reference-set";
import { RichText } from "@/components/rich-text";
import { PageHeader } from "@/components/ui";
import { restoreExamVersionAction, saveExamVersionAction } from "@/lib/actions/exams";

const TYPE_LABEL: Record<string, string> = {
  objetiva: "Objetiva",
  verdadeiro_falso: "V/F",
  numerica: "Numérica",
  dissertativa: "Dissertativa",
};

function normalizeSelectedVersion(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export default async function ExamEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const examId = Number(id);
  const exam = Number.isSafeInteger(examId) && examId > 0 ? getExam(examId) : undefined;
  if (!exam) notFound();

  const versions = listExamVersions(exam.id);
  const selectedVersionNumber = normalizeSelectedVersion(sp.version);
  const selectedVersion = selectedVersionNumber ? getExamVersion(exam.id, selectedVersionNumber) : undefined;
  const questionIds = getExamQuestionIdsInSetAOrder(exam.sets);
  const questions = questionIds.map((questionId) => getQuestion(questionId)).filter((question): question is NonNullable<typeof question> => question != null);

  return (
    <>
      <PageHeader
        eyebrow="Avaliações · Editar"
        title={`Editar ${exam.title}`}
        description="Cada salvamento cria uma versão imutável. Sets e questões continuam rastreáveis ao banco de origem."
        actions={<Link href={`/exports?exam=${exam.id}`} className="btn btn-ghost">← Exportações</Link>}
      />

      <div className="exam-editor-layout">
        <form action={saveExamVersionAction} className="card exam-editor-form">
          <input type="hidden" name="examId" value={exam.id} />
          <div className="exam-editor-status-row">
            <span className={`badge ${exam.active ? "badge-success" : "badge-warning"}`}>{exam.active ? "Prova ativa" : "Prova inativa"}</span>
            {selectedVersion && <span className="badge">Visualizando histórico: versão {selectedVersion.versionNumber}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="exam-title">Título *</label>
            <input id="exam-title" name="title" className="form-input" defaultValue={exam.title} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exam-institution">Instituição</label>
            <input id="exam-institution" name="institution" className="form-input" defaultValue={exam.institution} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exam-instructions">Instruções da primeira página</label>
            <textarea id="exam-instructions" name="instructions" className="form-textarea exam-editor-instructions" defaultValue={exam.instructions} required />
            <p className="form-help">Este bloco aparece e é medido no primeiro page de cada set.</p>
          </div>

          <section className="exam-editor-section">
            <h2>Layout e paginação</h2>
            <div className="exam-editor-layout-grid">
              {([
                ["Objetiva", "layoutObjetiva", exam.questionLayouts.objetiva],
                ["V/F", "layoutVF", exam.questionLayouts.verdadeiro_falso],
                ["Numérica", "layoutNumerica", exam.questionLayouts.numerica],
                ["Dissertativa", "layoutDissertativa", exam.questionLayouts.dissertativa],
              ] as const).map(([label, name, value]) => (
                <label key={name} className="form-group">
                  <span className="form-label">{label}</span>
                  <select name={name} className="form-select" defaultValue={value}>
                    <option value="column">Meia página</option>
                    <option value="full">Largura total</option>
                  </select>
                </label>
              ))}
            </div>
            <label className="exam-editor-checkbox">
              <input type="checkbox" name="allowQuestionSplit" value="1" defaultChecked={exam.allowQuestionSplit} />
              <span><strong>Permitir quebra de questões objetivas longas</strong><small>Alternativas continuam inteiras e a continuação é identificada.</small></span>
            </label>
          </section>

          <section className="exam-editor-section">
            <h2>Largura individual</h2>
            <p className="form-help">“Herdar” usa o layout do tipo. Uma escolha aqui vence o layout por tipo apenas para esta questão.</p>
            <div className="exam-editor-question-list">
              {questions.map((question, index) => (
                <div key={question.id} className="exam-editor-question-row">
                  <div className="exam-editor-question-copy">
                    <strong>Q{index + 1} · {TYPE_LABEL[question.questionType] ?? question.questionType} · ID {question.id}</strong>
                    <RichText html={question.statement} />
                  </div>
                  <label className="exam-editor-question-control">
                    <span className="form-label">Largura</span>
                    <select name={`layoutOverride-${question.id}`} className="form-select" defaultValue={exam.questionLayoutOverrides[question.id] ?? ""}>
                      <option value="">Herdar do tipo</option>
                      <option value="column">Meia página</option>
                      <option value="full">Largura total</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <div className="form-group">
            <label className="form-label" htmlFor="exam-change-note">Nota da alteração</label>
            <input id="exam-change-note" name="changeNote" className="form-input" placeholder="Ex.: Ajuste das instruções e largura da Q3" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Salvar como nova versão</button>
            <Link href={`/exports?exam=${exam.id}`} className="btn btn-ghost">Cancelar</Link>
          </div>
        </form>

        <aside className="card exam-editor-history">
          <h2>Histórico</h2>
          <p className="form-help">Versões antigas não são sobrescritas. Restaurar também cria uma nova versão.</p>
          {versions.length === 0 ? (
            <div className="exam-editor-empty-history">Ainda não há versões. Este exame legado receberá baseline antes do primeiro salvamento.</div>
          ) : (
            <div className="exam-editor-version-list">
              {versions.map((version) => (
                <div key={version.id} className={`exam-editor-version ${version.versionNumber === selectedVersion?.versionNumber ? "is-selected" : ""}`}>
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
                      <button type="submit" className="btn btn-sm btn-ghost">Restaurar como nova</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
