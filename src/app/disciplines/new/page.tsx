import Link from "next/link";
import { createDisciplineAction } from "@/lib/actions/disciplines";

export default function NewDisciplinePage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Nova Disciplina</h1>
        <Link href="/disciplines" className="btn btn-ghost">← Voltar</Link>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <form action={createDisciplineAction}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="name">Nome *</label>
              <input id="name" name="name" className="form-input" required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="code">Código *</label>
              <input id="code" name="code" className="form-input" placeholder="ex: ALP" required style={{ textTransform: "uppercase" }} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Salvar</button>
            <Link href="/disciplines" className="btn btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </>
  );
}
