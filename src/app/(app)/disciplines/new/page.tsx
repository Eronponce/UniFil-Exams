import Link from "next/link";
import { createDisciplineAction } from "@/lib/actions/disciplines";
import { PageHeader } from "@/components/ui";

export default function NewDisciplinePage() {
  return (
    <>
      <PageHeader eyebrow="Organizar · Conteúdo" title="Nova disciplina" description="Cadastre um componente curricular para conectar questões, auditoria e provas." actions={<Link href="/disciplines" className="btn btn-ghost">← Voltar</Link>} />
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
