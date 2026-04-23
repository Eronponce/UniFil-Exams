import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { createQuestionAction } from "@/lib/actions/questions";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFFICULTIES = [
  { value: "easy", label: "Fácil" },
  { value: "medium", label: "Médio" },
  { value: "hard", label: "Difícil" },
];

export default function NewQuestionPage() {
  const disciplines = listDisciplines();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Nova Questão</h1>
        <Link href="/questions" className="btn btn-ghost">← Voltar</Link>
      </div>
      <div className="card" style={{ maxWidth: 700 }}>
        <form action={createQuestionAction}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="disciplineId">Disciplina *</label>
              <select id="disciplineId" name="disciplineId" className="form-select" required>
                <option value="">Selecione…</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="difficulty">Dificuldade</label>
              <select id="difficulty" name="difficulty" className="form-select" defaultValue="medium">
                {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="statement">Enunciado *</label>
            <textarea id="statement" name="statement" className="form-textarea" rows={4} required />
          </div>

          <div className="form-group">
            <label className="form-label">Alternativas *</label>
            <div className="options-list">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="option-row">
                  <div className="option-letter">{LETTERS[i]}</div>
                  <input name={`option${i}`} className="form-input" placeholder={`Alternativa ${LETTERS[i]}`} required />
                  <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="radio" name="correctIndex" value={i} defaultChecked={i === 0} required />
                    Correta
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="thematicArea">Área Temática</label>
            <input id="thematicArea" name="thematicArea" className="form-input" placeholder="Ex: Herança, Polimorfismo, Normalização…" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="explanation">Justificativa da resposta</label>
            <textarea id="explanation" name="explanation" className="form-textarea" rows={3} placeholder="Explique por que a alternativa correta é a correta…" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="image">Imagem (opcional)</label>
            <input id="image" name="image" type="file" accept="image/*" className="form-input" style={{ padding: "0.4rem" }} />
          </div>

          <input type="hidden" name="source" value="manual" />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Salvar Questão</button>
            <Link href="/questions" className="btn btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </>
  );
}
