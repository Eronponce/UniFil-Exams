"use client";

import { useWorkspaceStore } from "@/lib/state/workspace-store";

interface ExamDraftFieldsProps {
  initialTitle: string;
  initialInstitution: string;
  initialQuantitySets: string;
  initialNumObjetivas: string;
  initialNumVF: string;
  initialNumDissertativas: string;
  typeCounts: {
    objetiva: number;
    verdadeiro_falso: number;
    dissertativa: number;
  };
}

export function ExamDraftFields({
  initialTitle,
  initialInstitution,
  initialQuantitySets,
  initialNumObjetivas,
  initialNumVF,
  initialNumDissertativas,
  typeCounts,
}: ExamDraftFieldsProps) {
  const { exam, updateExam, resetExam } = useWorkspaceStore();
  const draft = {
    title: initialTitle || exam.title,
    institution: initialInstitution || exam.institution,
    quantitySets: initialQuantitySets || exam.quantitySets,
    numObjetivas: initialNumObjetivas || exam.numObjetivas,
    numVF: initialNumVF || exam.numVF,
    numDissertativas: initialNumDissertativas || exam.numDissertativas,
  };

  return (
    <>
      <div className="form-group">
        <label className="form-label">TÃ­tulo *</label>
        <input
          name="title"
          className="form-input"
          placeholder="Ex: Prova 1 â€” POO 2026"
          value={draft.title}
          onChange={(e) => updateExam({ title: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">InstituiÃ§Ã£o</label>
        <input
          name="institution"
          className="form-input"
          value={draft.institution}
          onChange={(e) => updateExam({ institution: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Quantidade de Sets</label>
        <input
          name="quantitySets"
          type="number"
          className="form-input"
          value={draft.quantitySets}
          min={1}
          max={8}
          style={{ maxWidth: 120 }}
          onChange={(e) => updateExam({ quantitySets: e.target.value })}
        />
      </div>

      <div className="card" style={{ background: "#f8fafc", marginBottom: "1.25rem", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.9rem" }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Quantidade por tipo</p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Preencha para montar a prova com composiÃ§Ã£o fixa por categoria. Campo vazio = 0 quando qualquer tipo for usado.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "#dbeafe" }}>Objetivas disponÃ­veis: {typeCounts.objetiva}</span>
            <span className="badge" style={{ background: "#fef9c3" }}>V/F disponÃ­veis: {typeCounts.verdadeiro_falso}</span>
            <span className="badge" style={{ background: "#f3e8ff" }}>Dissertativas disponÃ­veis: {typeCounts.dissertativa}</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Objetivas</label>
            <input
              name="numObjetivas"
              type="number"
              className="form-input"
              min={0}
              max={typeCounts.objetiva || 0}
              placeholder="0"
              value={draft.numObjetivas}
              onChange={(e) => updateExam({ numObjetivas: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Verdadeiro/Falso</label>
            <input
              name="numVF"
              type="number"
              className="form-input"
              min={0}
              max={typeCounts.verdadeiro_falso || 0}
              placeholder="0"
              value={draft.numVF}
              onChange={(e) => updateExam({ numVF: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, marginTop: "1rem" }}>
          <label className="form-label">Dissertativas</label>
          <input
            name="numDissertativas"
            type="number"
            className="form-input"
            min={0}
            max={typeCounts.dissertativa || 0}
            placeholder="0"
            value={draft.numDissertativas}
            onChange={(e) => updateExam({ numDissertativas: e.target.value })}
          />
        </div>
      </div>

      <button type="button" className="btn btn-ghost" style={{ marginBottom: "1rem" }} onClick={resetExam}>
        Limpar rascunho
      </button>
    </>
  );
}
