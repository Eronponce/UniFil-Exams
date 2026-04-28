export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/db/questions";
import { listDisciplines } from "@/lib/db/disciplines";
import { updateQuestionAction } from "@/lib/actions/questions";
import { QuestionForm } from "../../_components/question-form";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(Number(id));
  if (!question) notFound();
  const disciplines = listDisciplines();

  return (
    <QuestionForm
      disciplines={disciplines}
      action={updateQuestionAction}
      question={question}
      cancelHref={`/questions/${question.id}`}
      title={`Editar Questão #${question.id}`}
      submitLabel="Salvar"
    />
  );
}
