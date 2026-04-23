export const dynamic = "force-dynamic";
import { listDisciplines } from "@/lib/db/disciplines";
import { ImportClient } from "./import-client";

export default function ImportPage() {
  const disciplines = listDisciplines();
  return <ImportClient disciplines={disciplines} />;
}
