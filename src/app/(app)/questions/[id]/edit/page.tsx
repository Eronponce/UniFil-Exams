export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getQuestion, getQuestionNavigation } from "@/lib/db/questions";
import { listDisciplines } from "@/lib/db/disciplines";
import { updateQuestionAction } from "@/lib/actions/questions";
import { QuestionForm } from "../../_components/question-form";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(Number(id));
  if (!question) notFound();
  const disciplines = listDisciplines();
  const navigation = getQuestionNavigation(question.id, question.disciplineId);

  return (
    <QuestionForm
      disciplines={disciplines}
      action={updateQuestionAction}
      question={question}
      cancelHref={`/questions/${question.id}`}
      title={`Editar Questão #${question.id}`}
      submitLabel="Salvar"
      navigation={navigation}
    />
  );
}
