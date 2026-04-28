export const dynamic = "force-dynamic";
import { listDisciplines } from "@/lib/db/disciplines";
import { ImportClient } from "./import-client";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  return <ImportClient disciplines={disciplines} initialTaskId={sp.task} />;
}
