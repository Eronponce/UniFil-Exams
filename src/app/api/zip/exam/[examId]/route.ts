import { NextResponse } from "next/server";
import { getExam } from "@/lib/db/exams";
import { renderHtmlPageToPdfBuffer } from "@/lib/print/browser-pdf";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova nao encontrada" }, { status: 404 });
  if (exam.sets.length === 0) return NextResponse.json({ error: "Prova sem sets" }, { status: 400 });

  const safeName = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `prova-${exam.id}`;

  try {
    const zip = new JSZip();
    const baseUrl = new URL(req.url).origin;

    for (const set of exam.sets) {
      const url = `${baseUrl}/print/set/${set.id}`;
      const pdf = await renderHtmlPageToPdfBuffer(url);
      zip.file(`${safeName}-set-${set.label.toLowerCase()}.pdf`, pdf);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}-todos-sets.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar ZIP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
