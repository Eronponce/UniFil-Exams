export const dynamic = "force-dynamic";
import { listDisciplines } from "@/lib/db/disciplines";
import { ImportFileClient } from "./import-file-client";

export default function ImportarQuestoesPage() {
  const disciplines = listDisciplines();
  return <ImportFileClient disciplines={disciplines} />;
}
