import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GABARITO_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

function getGabaritoDir() {
  return path.join(process.cwd(), "public", "gabaritos");
}

function findGabaritoFile(examId: string): { absolutePath: string; ext: string } | null {
  const dir = getGabaritoDir();
  for (const ext of GABARITO_EXTENSIONS) {
    const absolutePath = path.join(dir, `${examId}.${ext}`);
    if (fs.existsSync(absolutePath)) return { absolutePath, ext };
  }
  return null;
}

function contentTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const found = findGabaritoFile(examId);
  if (!found) return new NextResponse("Not found", { status: 404 });

  const bytes = fs.readFileSync(found.absolutePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentTypeFor(found.ext),
      "Cache-Control": "no-store",
    },
  });
}
