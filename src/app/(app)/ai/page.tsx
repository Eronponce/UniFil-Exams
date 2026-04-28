export const dynamic = "force-dynamic";
import { listDisciplines } from "@/lib/db/disciplines";
import { AIClient } from "./ai-client";

export default async function AIPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Geração com IA</h1>
      </div>
      <AIClient disciplines={disciplines} initialTaskId={sp.task} />
    </>
  );
}
