"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskRecord, TaskStatus } from "@/lib/task-queue";
import { cancelTaskAction } from "@/lib/actions/queue-actions";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Aguardando",
  processing: "Processando",
  done: "Concluída",
  error: "Erro",
  cancelled: "Cancelada",
};

const STATUS_BG: Record<TaskStatus, string> = {
  pending: "#fef9c3",
  processing: "#dbeafe",
  done: "#dcfce7",
  error: "#fee2e2",
  cancelled: "#f3f4f6",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "#92400e",
  processing: "#1e40af",
  done: "#166534",
  error: "#991b1b",
  cancelled: "#6b7280",
};

export function QueuePanel() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const knownStatuses = useRef<Map<string, TaskStatus>>(new Map());

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch("/api/queue", { cache: "no-store" });
        if (res.ok) {
          const data: TaskRecord[] = await res.json();
          const shouldRefresh = data.some((task) => {
            const previous = knownStatuses.current.get(task.id);
            return previous && previous !== task.status && ["done", "error", "cancelled"].includes(task.status);
          });
          knownStatuses.current = new Map(data.map((task) => [task.id, task.status]));
          setTasks(data);
          if (shouldRefresh) router.refresh();
        }
      } catch {
        // silent
      }
      if (active) setTimeout(poll, 1000);
    }

    poll();
    return () => { active = false; };
  }, [router]);

  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "processing");
  const recentDone = tasks.filter((t) => t.status === "done" || t.status === "error" || t.status === "cancelled");
  const visible = [...activeTasks, ...recentDone.slice(0, 5)];

  function handleCancel(id: string) {
    startTransition(async () => {
      await cancelTaskAction(id);
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (res.ok) setTasks(await res.json());
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: "1rem",
        zIndex: 9999,
        maxWidth: 460,
        width: "calc(100vw - 2rem)",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderBottom: "none",
        borderRadius: "8px 8px 0 0",
        boxShadow: "0 -4px 18px rgba(0,0,0,0.14)",
        fontSize: "0.8rem",
      }}
    >
      {/* Header */}
      <button
        type="button"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.6rem 0.85rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.82rem",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span>
          {activeTasks.length > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", animation: "pulse 1.5s ease-in-out infinite" }} />
              Painel de tarefas · {activeTasks.length} ativa{activeTasks.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span style={{ color: "#6b7280" }}>
              Painel de tarefas · {visible.length > 0 ? "concluída" : "vazio"}
            </span>
          )}
        </span>
        <span style={{ color: "#9ca3af", marginLeft: "0.5rem" }}>{expanded ? "▼" : "▲"}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "0.5rem 0.85rem 0.75rem" }}>
          {visible.length === 0 && (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.78rem" }}>
              Nenhuma tarefa em execução. Auditorias e gerações por IA aparecem aqui.
            </p>
          )}
          {visible.map((task) => (
            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid #f9fafb" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "0.1rem 0.4rem",
                  borderRadius: 99,
                  background: STATUS_BG[task.status],
                  color: STATUS_COLOR[task.status],
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {STATUS_LABEL[task.status]}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>
                {task.label}
              </span>
              {(task.status === "pending" || task.status === "processing") && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", flexShrink: 0 }}
                  disabled={isPending}
                  onClick={() => handleCancel(task.id)}
                >
                  Cancelar
                </button>
              )}
              {task.status === "done" && task.type === "ai-generate" && (
                <a
                  href={`/ai/import?task=${task.id}`}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", flexShrink: 0 }}
                >
                  Ver
                </a>
              )}
              {task.status === "done" && task.type === "ai-generate-single" && (
                <a
                  href={`/ai?task=${task.id}`}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", flexShrink: 0 }}
                >
                  Ver
                </a>
              )}
              {task.status === "error" && task.errorMessage && (
                <span title={task.errorMessage} style={{ color: "#991b1b", cursor: "help", flexShrink: 0 }}>⚠</span>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
