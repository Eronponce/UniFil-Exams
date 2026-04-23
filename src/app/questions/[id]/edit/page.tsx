import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/db/questions";
import { listDisciplines } from "@/lib/db/disciplines";
import { updateQuestionAction } from "@/lib/actions/questions";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFFICULTIES = [
  { value: "easy", label: "Fácil" },
  { value: "medium", label: "Médio" },
  { value: "hard", label: "Difícil" },
];

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(Number(id));
  if (!question) notFound();
  const disciplines = listDisciplines();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Editar Questão #{question.id}</h1>
        <Link href={`/questions/${question.id}`} className="btn btn-ghost">← Voltar</Link>
      </div>
      <div className="card" style={{ maxWidth: 700 }}>
        <form action={updateQuestionAction}>
          <input type="hidden" name="id" value={question.id} />

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Disciplina</label>
              <select name="disciplineId" className="form-select" defaultValue={question.disciplineId}>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dificuldade</label>
              <select name="difficulty" className="form-select" defaultValue={question.difficulty}>
                {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Enunciado *</label>
            <textarea name="statement" className="form-textarea" rows={4} defaultValue={question.statement} required />
          </div>

          <div className="form-group">
            <label className="form-label">Alternativas *</label>
            <div className="options-list">
              {question.options.map((opt) => (
                <div key={opt.index} className="option-row">
                  <div className="option-letter">{LETTERS[opt.index]}</div>
                  <input name={`option${opt.index}`} className="form-input" defaultValue={opt.text} required />
                  <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="radio" name="correctIndex" value={opt.index} defaultChecked={opt.index === question.correctIndex} required />
                    Correta
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Área Temática</label>
            <input name="thematicArea" className="form-input" defaultValue={question.thematicArea ?? ""} placeholder="Ex: Herança, Polimorfismo, Normalização…" />
          </div>

          <div className="form-group">
            <label className="form-label">Justificativa da resposta</label>
            <textarea name="explanation" className="form-textarea" rows={3} defaultValue={question.explanation} placeholder="Explique por que a alternativa correta é a correta…" />
          </div>

          <div className="form-group">
            <label className="form-label">Imagem{question.imageUrl ? " (substituir)" : " (opcional)"}</label>
            {question.imageUrl && (
              <div style={{ marginBottom: "0.5rem" }}>
                <Image src={question.imageUrl} alt="Atual" width={200} height={140} style={{ borderRadius: 4, border: "1px solid var(--border)" }} />
              </div>
            )}
            <input name="image" type="file" accept="image/*" className="form-input" style={{ padding: "0.4rem" }} />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Salvar</button>
            <Link href={`/questions/${question.id}`} className="btn btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </>
  );
}
