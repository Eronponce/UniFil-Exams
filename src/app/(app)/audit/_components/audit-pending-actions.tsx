"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteQuestionAction, rejectQuestionAction, setQuestionAuditedAction } from "@/lib/actions/questions";
import { ConfirmButton } from "@/components/confirm-button";
import { useAuditOptimistic } from "./audit-optimistic-context";

interface Props {
  questionId: number;
}

export function AuditPendingActions({ questionId }: Props) {
  const router = useRouter();
  const [isPendingAudit, startAudit] = useTransition();
  const [isPendingReject, startReject] = useTransition();
  const { hideQuestion, showQuestion } = useAuditOptimistic();

  function handleAudit() {
    hideQuestion(questionId);
    startAudit(async () => {
      let success = false;
      try {
        const result = await setQuestionAuditedAction(questionId, true);
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
        disabled={isPendingAudit || isPendingReject}
        onClick={handleAudit}
      >
        {isPendingAudit ? "..." : "✓ Auditar"}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        style={{ background: "#f97316", color: "#fff", border: "none" }}
        disabled={isPendingAudit || isPendingReject}
        onClick={handleReject}
      >
        {isPendingReject ? "..." : "✕ Recusar"}
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
