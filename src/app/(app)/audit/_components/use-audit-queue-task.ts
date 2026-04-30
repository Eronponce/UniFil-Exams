"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskRecord, TaskStatus } from "@/lib/task-queue";

const TERMINAL_STATUSES: TaskStatus[] = ["done", "error", "cancelled"];

export function useAuditQueueTask() {
  const router = useRouter();
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (!active) return;

      try {
        const res = await fetch(`/api/queue/${taskId}`, { cache: "no-store" });
        if (res.ok) {
          const task = (await res.json()) as TaskRecord;
          if (TERMINAL_STATUSES.includes(task.status)) {
            setTaskId(null);
            router.refresh();
            return;
          }
        }
      } catch {
        // silent retry
      }

      if (active) timeoutId = setTimeout(poll, 250);
    }

    poll();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router, taskId]);

  return {
    observedTaskId: taskId,
    watchTask(taskIdToWatch: string) {
      setTaskId(taskIdToWatch);
    },
  };
}
