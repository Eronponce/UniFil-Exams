export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplinesWithCount } from "@/lib/db/stats";
import { deleteDisciplineAction } from "@/lib/actions/disciplines";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export default function DisciplinesPage() {
  const disciplines = listDisciplinesWithCount();

  return (
    <>
      <PageHeader eyebrow="Organizar · Conteúdo" title="Disciplinas" description="Mantenha os componentes curriculares que alimentam seu banco de questões." actions={<Link href="/disciplines/new" className="btn btn-primary"><Icon name="plus" size={16} /> Nova disciplina</Link>} />

      {disciplines.length === 0 ? (
        <EmptyState title="Nenhuma disciplina cadastrada" description="Crie a primeira para começar a organizar questões e avaliações." action={<Link href="/disciplines/new" className="btn btn-primary">Criar primeira disciplina</Link>} icon="book-open" />
      ) : (
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Questões</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => (
              <tr key={d.id}>
                <td><code style={{ background: "#f3f4f6", padding: "0.1rem 0.4rem", borderRadius: 4 }}>{d.code}</code></td>
                <td><Link href={`/questions?discipline=${d.id}`}>{d.name}</Link></td>
                <td>{d.questionCount}</td>
                <td>
                  <div className="actions-row">
                    <Link href={`/disciplines/${d.id}/edit`} className="btn btn-sm btn-ghost">Editar</Link>
                    <form action={deleteDisciplineAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton type="submit" className="btn btn-sm btn-danger" confirm="Desativar disciplina?">
                        Desativar
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
