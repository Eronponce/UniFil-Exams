import { NextRequest, NextResponse } from "next/server";
import { getExam } from "@/lib/db/exams";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "gabaritos");
  fs.mkdirSync(dir, { recursive: true });
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  fs.writeFileSync(path.join(dir, `${exam.id}.${ext}`), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const dir = path.join(process.cwd(), "public", "gabaritos");
  for (const ext of ["png", "jpg", "jpeg"]) {
    if (fs.existsSync(path.join(dir, `${examId}.${ext}`))) {
      return NextResponse.json({ exists: true, url: `/gabaritos/${examId}.${ext}` });
    }
  }
  return NextResponse.json({ exists: false });
}
