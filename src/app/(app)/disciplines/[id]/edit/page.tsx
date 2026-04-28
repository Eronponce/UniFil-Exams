export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiscipline } from "@/lib/db/disciplines";
import { updateDisciplineAction } from "@/lib/actions/disciplines";

export default async function EditDisciplinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const disc = getDiscipline(Number(id));
  if (!disc) notFound();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Editar Disciplina</h1>
        <Link href="/disciplines" className="btn btn-ghost">← Voltar</Link>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <form action={updateDisciplineAction}>
          <input type="hidden" name="id" value={disc.id} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="name">Nome *</label>
              <input id="name" name="name" className="form-input" defaultValue={disc.name} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="code">Código *</label>
              <input id="code" name="code" className="form-input" defaultValue={disc.code} required />
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
