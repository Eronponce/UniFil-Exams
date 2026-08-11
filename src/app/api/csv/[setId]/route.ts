import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getExam, getExamVersion } from "@/lib/db/exams";
import { buildAnswerKeyCsv, buildAnswerKeyCsvFromSnapshot } from "@/lib/pdf/exam-csv";
import { parseExamVersionNumber } from "@/lib/exam/version";

interface SetRow { id: number; exam_id: number }

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const requestedVersion = parseExamVersionNumber(new URL(req.url).searchParams.get("version"));
  if (requestedVersion === "invalid") return new NextResponse("Versão inválida", { status: 400 });

  const row = getDb().prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?").get(Number(setId)) as SetRow | undefined;
  if (!row) return new NextResponse("Set não encontrado", { status: 404 });

  const exam = getExam(row.exam_id);
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const version = requestedVersion === undefined ? undefined : getExamVersion(exam.id, requestedVersion);
  if (requestedVersion !== undefined && !version) return new NextResponse("Versão não encontrada", { status: 404 });

  const set = exam.sets.find((s) => s.id === row.id);
  if (!set) return new NextResponse("Set não encontrado", { status: 404 });
  const snapshotSet = version?.snapshot.sets.find((candidate) => candidate.sourceSetId === row.id);
  if (version && !snapshotSet) return new NextResponse("Set não encontrado na versão", { status: 404 });

  const csv = version && snapshotSet
    ? buildAnswerKeyCsvFromSnapshot(version.snapshot.title, snapshotSet)
    : buildAnswerKeyCsv(exam.title, set);
  const title = version?.snapshot.title ?? exam.title;
  const label = snapshotSet?.label ?? set.label;
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `gabarito-${safeName}-set-${label.toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
