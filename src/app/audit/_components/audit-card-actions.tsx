"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteQuestionAction } from "@/lib/actions/questions";
import { enqueueAuditAction } from "@/lib/actions/queue-actions";

interface Props {
  questionId: number;
}

export function AuditCardActions({ questionId }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [queued, setQueued] = useState(false);
  const [isPendingAudit, startAudit] = useTransition();
  const [isPendingDelete, startDelete] = useTransition();

  function handleDesaudit() {
    startAudit(async () => {
      const { isNew } = await enqueueAuditAction(questionId, false);
      if (isNew) setQueued(true);
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const fd = new FormData();
    fd.set("id", String(questionId));
    fd.set("back", "/audit");
    startDelete(() => deleteQuestionAction(fd));
  }

  return (
    <div className="actions-row" style={{ flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={isPendingAudit || queued}
        onClick={handleDesaudit}
      >
        {queued ? "Na fila…" : isPendingAudit ? "…" : "Des-auditar"}
      </button>
      <Link href={`/questions/${questionId}/edit`} className="btn btn-ghost btn-sm">Editar</Link>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={isPendingDelete}
        onClick={handleDelete}
        style={confirmDelete ? { outline: "2px solid #dc2626" } : {}}
      >
        {confirmDelete ? "Confirmar exclusão" : "Excluir"}
      </button>
      {confirmDelete && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }} onClick={() => setConfirmDelete(false)}>
          Cancelar
        </button>
      )}
    </div>
  );
}
