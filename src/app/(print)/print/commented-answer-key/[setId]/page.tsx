export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import { parseExamVersionNumber } from "@/lib/exam/version";
import { loadCommentedAnswerKey } from "@/lib/export/commented-answer-key";
import {
  resolveAnswerKeyImageAnswer,
  type AnswerKeyImageQuestion,
} from "@/lib/export/answer-key-image";
import styles from "./commented-answer-key.module.css";

function questionTypeLabel(question: AnswerKeyImageQuestion): string {
  if (question.questionType === "objetiva") return "Objetiva";
  if (question.questionType === "verdadeiro_falso") return "Verdadeiro ou falso";
  if (question.questionType === "numerica") return "Numérica";
  return "Dissertativa";
}

export default async function CommentedAnswerKeyPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { setId } = await params;
  const sp = await searchParams;
  const numericSetId = Number(setId);
  if (!Number.isSafeInteger(numericSetId) || numericSetId <= 0) notFound();

  const requestedVersion = parseExamVersionNumber(sp.version ?? null);
  if (requestedVersion === "invalid") notFound();
  const result = loadCommentedAnswerKey(numericSetId, requestedVersion);
  if (!result.ok) notFound();
  const { data } = result;

  return (
    <main className={styles.document}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>UNIFIL EXAMS - GABARITO COMENTADO</p>
        <h1>{data.examTitle}</h1>
        <div className={styles.metadata}>
          {data.institution && <span>{data.institution}</span>}
          <span>Set {data.setLabel}</span>
          <span>{data.versionNumber ? `Versão ${data.versionNumber}` : "Versão atual"}</span>
          <span>{data.questions.length} {data.questions.length === 1 ? "questão" : "questões"}</span>
        </div>
      </header>

      <div className={styles.questionList}>
        {data.questions.length === 0 ? (
          <p className={styles.empty}>Nenhuma questão encontrada neste set.</p>
        ) : data.questions.map((question) => (
          <article key={`${question.position}-${question.sourceQuestionId}`} className={styles.questionCard}>
            <div className={styles.questionHeading}>
              <span className={styles.questionNumber}>{question.position}</span>
              <div>
                <strong>{questionTypeLabel(question)}</strong>
                <span>Questão do banco #{question.sourceQuestionId}</span>
              </div>
            </div>

            <section className={styles.statementBox}>
              <h2>Enunciado</h2>
              <RichText html={question.statementHtml} className={styles.richText} />
            </section>

            <section className={styles.answerBox}>
              <h2>Resposta correta</h2>
              <p>{resolveAnswerKeyImageAnswer(question)}</p>
            </section>

            <section className={styles.explanationBox}>
              <h2>{question.questionType === "dissertativa" || question.questionType === "numerica" ? "Gabarito esperado" : "Justificativa"}</h2>
              <p>{question.explanation.trim() || "Sem justificativa cadastrada."}</p>
            </section>
          </article>
        ))}
      </div>

      <footer className={styles.footer}>
        Gabarito comentado - confirme o set antes da correção
      </footer>
    </main>
  );
}
