import { NextRequest, NextResponse } from "next/server";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import type { QuestionType } from "@/types";
import { questionsToJson, questionsToCsv } from "@/lib/importexport/export";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "json";
  const disciplineId = sp.get("discipline") ? Number(sp.get("discipline")) : undefined;
  const questionType = (sp.get("type") ?? undefined) as QuestionType | undefined;
  const auditedParam = sp.get("audited");
  const audited = auditedParam === "1" ? true : auditedParam === "0" ? false : undefined;

  const questions = listQuestionsFiltered({ disciplineId, audited, questionType });

  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = questionsToCsv(questions);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="questoes-${date}.csv"`,
      },
    });
  }

  const json = questionsToJson(questions);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="questoes-${date}.json"`,
    },
  });
}
