"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskRecord, TaskStatus } from "@/lib/task-queue";
import { cancelTaskAction } from "@/lib/actions/queue-actions";
import { shouldRefreshForTask } from "@/components/queue-panel-utils";
import { Icon } from "@/components/icon";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Aguardando",
  processing: "Processando",
  done: "Concluída",
  error: "Erro",
  cancelled: "Cancelada",
};

export function QueuePanel() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const knownStatuses = useRef<Map<string, TaskStatus>>(new Map());
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    mountedAt.current = Date.now();

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch("/api/queue", { cache: "no-store" });
        if (res.ok) {
          const data: TaskRecord[] = await res.json();
          const shouldRefresh = data.some((task) => {
            const previous = knownStatuses.current.get(task.id);
            return shouldRefreshForTask(task, previous, mountedAt.current ?? 0);
          });
          knownStatuses.current = new Map(data.map((task) => [task.id, task.status]));
          setTasks(data);
          if (shouldRefresh) router.refresh();
        }
      } catch {
        // silent
      }
      if (active) window.setTimeout(poll, 1000);
    }

    poll();
    return () => { active = false; };
  }, [router]);

  const activeTasks = tasks.filter((task) => task.status === "pending" || task.status === "processing");
  const recentDone = tasks.filter((task) => task.status === "done" || task.status === "error" || task.status === "cancelled");
  const visible = [...activeTasks, ...recentDone.slice(0, 5)];

  function handleCancel(id: string) {
    startTransition(async () => {
      await cancelTaskAction(id);
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (res.ok) setTasks(await res.json());
    });
  }

  return (
    <section className="activity-panel queue-panel" aria-label="Painel de tarefas">
      <button type="button" className="activity-panel-toggle" aria-expanded={expanded} aria-controls="queue-panel-content" onClick={() => setExpanded((current) => !current)}>
        <span className="activity-panel-title">
          <span className={`activity-dot${activeTasks.length > 0 ? " is-active" : ""}`} />
          {activeTasks.length > 0 ? `Painel de tarefas · ${activeTasks.length} ativa${activeTasks.length !== 1 ? "s" : ""}` : `Painel de tarefas · ${visible.length > 0 ? "concluída" : "vazio"}`}
        </span>
        <Icon name="chevron-down" size={16} className={expanded ? "activity-chevron is-open" : "activity-chevron"} />
      </button>

      {expanded && (
        <div id="queue-panel-content" className="activity-panel-content">
          {visible.length === 0 && <p className="activity-empty">Nenhuma tarefa em execução. Auditorias e gerações por IA aparecem aqui.</p>}
          {visible.map((task) => (
            <div key={task.id} className="activity-task-row">
              <span className={`activity-status activity-status-${task.status}`}>{STATUS_LABEL[task.status]}</span>
              <span className="activity-task-label" title={task.label}>{task.label}</span>
              {(task.status === "pending" || task.status === "processing") && <button type="button" className="btn btn-ghost btn-sm" disabled={isPending} onClick={() => handleCancel(task.id)}>Cancelar</button>}
              {task.status === "done" && task.type === "ai-generate" && <a href={`/ai/import?task=${task.id}`} className="btn btn-ghost btn-sm">Ver</a>}
              {task.status === "done" && task.type === "ai-generate-single" && <a href={`/ai?task=${task.id}`} className="btn btn-ghost btn-sm">Ver</a>}
              {task.status === "error" && task.errorMessage && <span className="activity-error" title={task.errorMessage}><Icon name="help" size={15} /></span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
