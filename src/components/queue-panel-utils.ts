import type { TaskRecord, TaskStatus } from "@/lib/task-queue";

const TERMINAL_TASK_STATUSES: TaskStatus[] = ["done", "error", "cancelled"];

export function shouldRefreshForTask(task: TaskRecord, previousStatus: TaskStatus | undefined, mountedAt: number) {
  if (!TERMINAL_TASK_STATUSES.includes(task.status)) return false;
  if (previousStatus) return previousStatus !== task.status;

  const terminalAt = task.finishedAt ?? task.createdAt;
  return terminalAt >= mountedAt;
}
