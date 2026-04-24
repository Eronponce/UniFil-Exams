import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/task-queue";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = getTask(taskId);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (task.status !== "done") return NextResponse.json({ error: `Tarefa no estado: ${task.status}` }, { status: 409 });
  return NextResponse.json({ result: task.result, payload: task.payload });
}
