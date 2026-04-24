import { NextRequest, NextResponse } from "next/server";
import { cancelTask } from "@/lib/task-queue";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const cancelled = cancelTask(taskId);
  if (!cancelled) {
    return NextResponse.json({ error: "Tarefa não encontrada ou não pode ser cancelada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
