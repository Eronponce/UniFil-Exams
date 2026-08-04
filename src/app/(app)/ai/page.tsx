export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { AIClient } from "./ai-client";
import { PageHeader } from "@/components/ui";

export default async function AIPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  return (
    <>
      <PageHeader eyebrow="Criar · Assistido" title="Geração com IA" description="Gere uma questão por vez, acompanhe a fila e revise o resultado antes de salvar no banco." actions={<Link href="/ai/import" className="btn btn-ghost">Gerar em lote →</Link>} />
      <AIClient disciplines={disciplines} initialTaskId={sp.task} />
    </>
  );
}
