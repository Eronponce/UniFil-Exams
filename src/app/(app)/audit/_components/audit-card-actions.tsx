"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteQuestionAction, setQuestionAuditedAction } from "@/lib/actions/questions";
import { useAuditOptimistic } from "./audit-optimistic-context";

interface Props {
  questionId: number;
}

export function AuditCardActions({ questionId }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPendingAudit, startAudit] = useTransition();
  const [isPendingDelete, startDelete] = useTransition();
  const { hideQuestion, showQuestion } = useAuditOptimistic();

  function handleDesaudit() {
    hideQuestion(questionId);
    startAudit(async () => {
      let success = false;
      try {
        const result = await setQuestionAuditedAction(questionId, false);
        if (result.ok) {
          success = true;
          router.refresh();
        }
      } catch {
        success = false;
      }

      if (!success) {
        showQuestion(questionId);
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

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
        disabled={isPendingAudit}
        onClick={handleDesaudit}
      >
        {isPendingAudit ? "..." : "Des-auditar"}
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
