import { listDisciplines } from "@/lib/db/disciplines";
import { AIClient } from "./ai-client";

export default function AIPage() {
  const disciplines = listDisciplines();
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Geração com IA</h1>
      </div>
      <AIClient disciplines={disciplines} />
    </>
  );
}
