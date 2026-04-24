export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/db/questions";
import { getDiscipline } from "@/lib/db/disciplines";
import { auditQuestionAction, deleteQuestionAction } from "@/lib/actions/questions";
import { ConfirmButton } from "@/components/confirm-button";
import { MarkdownText } from "@/components/markdown-text";

const LETTERS = ["A", "B", "C", "D", "E"];

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(Number(id));
  if (!question) notFound();
  const discipline = getDiscipline(question.disciplineId);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Questão #{question.id}</h1>
        <div className="actions-row">
          <Link href="/questions" className="btn btn-ghost">← Banco</Link>
          <Link href={`/questions/${question.id}/edit`} className="btn btn-ghost">Editar</Link>
          <form action={auditQuestionAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="audited" value={question.audited ? "false" : "true"} />
            <button type="submit" className={`btn ${question.audited ? "btn-ghost" : "btn-success"}`}>
              {question.audited ? "Desmarcar Auditada" : "✓ Marcar Auditada"}
            </button>
          </form>
          <form action={deleteQuestionAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="back" value="/questions" />
            <ConfirmButton type="submit" className="btn btn-danger btn-sm" confirm="Excluir questão?">
              Excluir
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span className="badge" style={{ background: "#f3f4f6" }}>{discipline?.name ?? "—"}</span>
          <span className="badge" style={{ background: question.questionType === "objetiva" ? "#dbeafe" : question.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff" }}>
            {question.questionType === "objetiva" ? "Objetiva" : question.questionType === "verdadeiro_falso" ? "V ou F" : "Dissertativa"}
          </span>
          <span className="badge" style={{ background: "#f3f4f6" }}>{question.difficulty}</span>
          <span className={`badge ${question.source === "ai" ? "badge-ai" : ""}`}>{question.source}</span>
          <span className={`badge ${question.audited ? "badge-audited" : "badge-draft"}`}>
            {question.audited ? "Auditada" : "Rascunho"}
          </span>
        </div>

        <div className="question-statement"><MarkdownText text={question.statement} /></div>

        {question.imageUrl && (
          <div style={{ marginBottom: "1.25rem" }}>
            <Image src={question.imageUrl} alt="Imagem da questão" width={600} height={400} style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid var(--border)" }} />
          </div>
        )}

        {question.questionType === "objetiva" && (
          <div>
            {question.options.map((opt) => (
              <div key={opt.index} className={`option-item${opt.index === question.correctIndex ? " correct" : ""}`}>
                <span className="option-letter">{LETTERS[opt.index]}</span>
                <span>{opt.text}</span>
                {opt.index === question.correctIndex && <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 600 }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {question.questionType === "verdadeiro_falso" && (
          <div style={{ display: "flex", gap: "1rem" }}>
            {["Verdadeiro", "Falso"].map((label, i) => (
              <div key={i} className={`option-item${i === question.correctIndex ? " correct" : ""}`} style={{ flex: 1 }}>
                <span className="option-letter">{i === 0 ? "V" : "F"}</span>
                <span>{label}</span>
                {i === question.correctIndex && <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 600 }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {question.questionType === "dissertativa" && (
          <p style={{ opacity: 0.65, fontSize: "0.875rem" }}>Questão dissertativa · {question.answerLines} linha{question.answerLines !== 1 ? "s" : ""} em branco no PDF</p>
        )}

        {question.explanation && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#eff6ff", borderRadius: 6, borderLeft: "3px solid #3b82f6" }}>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>
              <strong>{question.questionType === "dissertativa" ? "Gabarito esperado:" : "Justificativa:"}</strong> {question.explanation}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
