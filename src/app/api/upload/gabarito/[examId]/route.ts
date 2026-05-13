import { NextRequest, NextResponse } from "next/server";
import { getExam, updateExamAnswerKeyWidth } from "@/lib/db/exams";
import fs from "fs";
import path from "path";

const GABARITO_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

function getGabaritoDir() {
  return path.join(process.cwd(), "public", "gabaritos");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const dir = getGabaritoDir();
  fs.mkdirSync(dir, { recursive: true });
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  if (!GABARITO_EXTENSIONS.includes(ext as (typeof GABARITO_EXTENSIONS)[number])) {
    return NextResponse.json({ error: "Formato inválido. Use PNG ou JPG." }, { status: 400 });
  }

  for (const knownExt of GABARITO_EXTENSIONS) {
    const previousPath = path.join(dir, `${exam.id}.${knownExt}`);
    if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
  }

  fs.writeFileSync(path.join(dir, `${exam.id}.${ext}`), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const dir = getGabaritoDir();
  for (const ext of GABARITO_EXTENSIONS) {
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
