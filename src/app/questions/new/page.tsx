export const dynamic = "force-dynamic";
import { listDisciplines } from "@/lib/db/disciplines";
import { createQuestionAction } from "@/lib/actions/questions";
import { QuestionForm } from "../_components/question-form";

export default function NewQuestionPage() {
  const disciplines = listDisciplines();
  return (
    <QuestionForm
      disciplines={disciplines}
      action={createQuestionAction}
      cancelHref="/questions"
      title="Nova Questão"
    />
  );
}
