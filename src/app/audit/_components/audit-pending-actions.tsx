"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteQuestionAction } from "@/lib/actions/questions";
import { enqueueAuditAction } from "@/lib/actions/queue-actions";
import { ConfirmButton } from "@/components/confirm-button";

interface Props {
  questionId: number;
}

export function AuditPendingActions({ questionId }: Props) {
  const [queued, setQueued] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAudit() {
    startTransition(async () => {
      const { isNew } = await enqueueAuditAction(questionId, true);
      if (isNew) setQueued(true);
    });
  }

  return (
    <div className="actions-row" style={{ flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn-success btn-sm"
        disabled={isPending || queued}
        onClick={handleAudit}
      >
        {queued ? "Na fila…" : isPending ? "…" : "✓ Auditar"}
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
