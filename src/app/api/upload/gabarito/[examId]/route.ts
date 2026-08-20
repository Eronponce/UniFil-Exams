import { NextRequest, NextResponse } from "next/server";
import { getExam, updateExamAnswerKeyWidth } from "@/lib/db/exams";
import fs from "fs";
import path from "path";
import {
  ANSWER_KEY_EXTENSIONS,
  AnswerKeyUploadError,
  getAnswerKeyDirectory,
  prepareAnswerKeyUpload,
  storeAnswerKeyUpload,
} from "@/lib/uploads/answer-key";

export async function POST(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  try {
    const upload = await prepareAnswerKeyUpload((await req.formData()).get("file"));
    if (!upload) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    storeAnswerKeyUpload(exam.id, upload);
  } catch (error) {
    if (error instanceof AnswerKeyUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const dir = getAnswerKeyDirectory();
  for (const ext of ANSWER_KEY_EXTENSIONS) {
    const filePath = path.join(dir, `${examId}.${ext}`);
    if (fs.existsSync(filePath)) {
      const version = Math.trunc(fs.statSync(filePath).mtimeMs);
      return NextResponse.json({
        exists: true,
        url: `/api/upload/gabarito/${examId}/file?v=${version}`,
        widthPt: exam.answerKeyWidthPt,
      });
    }
  }
  return NextResponse.json({ exists: false, widthPt: exam.answerKeyWidthPt });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { widthPt?: number } | null;
  const widthPt = updateExamAnswerKeyWidth(exam.id, Number(body?.widthPt));
  return NextResponse.json({ ok: true, widthPt });
}
