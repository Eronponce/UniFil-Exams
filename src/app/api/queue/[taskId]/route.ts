import { NextRequest, NextResponse } from "next/server";
import { registerDefaultTaskHandlers } from "@/lib/task-handlers";
import { cancelTask, getTask } from "@/lib/task-queue";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  registerDefaultTaskHandlers();
  const { taskId } = await params;
  const task = getTask(taskId);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  registerDefaultTaskHandlers();
  const { taskId } = await params;
  const cancelled = cancelTask(taskId);
  if (!cancelled) {
    return NextResponse.json({ error: "Tarefa não encontrada ou não pode ser cancelada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
