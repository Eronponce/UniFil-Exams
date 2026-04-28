"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteQuestionAction, rejectQuestionAction } from "@/lib/actions/questions";
import { enqueueAuditAction } from "@/lib/actions/queue-actions";
import { ConfirmButton } from "@/components/confirm-button";

interface Props {
  questionId: number;
}

export function AuditPendingActions({ questionId }: Props) {
  const [queued, setQueued] = useState(false);
  const [isPendingAudit, startAudit] = useTransition();
  const [isPendingReject, startReject] = useTransition();

  function handleAudit() {
    startAudit(async () => {
      const { isNew } = await enqueueAuditAction(questionId, true);
      if (isNew) setQueued(true);
    });
  }

  function handleReject() {
    startReject(async () => {
      const fd = new FormData();
      fd.set("id", String(questionId));
      fd.set("value", "1");
      await rejectQuestionAction(fd);
    });
  }

  return (
    <div className="actions-row" style={{ flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn-success btn-sm"
        disabled={isPendingAudit || isPendingReject || queued}
        onClick={handleAudit}
      >
        {queued ? "Na fila…" : isPendingAudit ? "…" : "✓ Auditar"}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        style={{ background: "#f97316", color: "#fff", border: "none" }}
        disabled={isPendingAudit || isPendingReject || queued}
        onClick={handleReject}
      >
        {isPendingReject ? "…" : "✕ Recusar"}
      </button>
      <Link href={`/questions/${questionId}/edit`} className="btn btn-ghost btn-sm">Editar</Link>
      <form action={deleteQuestionAction}>
        <input type="hidden" name="id" value={questionId} />
        <input type="hidden" name="back" value="/audit" />
        <ConfirmButton type="submit" className="btn btn-danger btn-sm" confirm="Excluir questão?">
          Excluir
        </ConfirmButton>
      </form>
    </div>
  );
}
