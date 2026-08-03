import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function findQuestionImage(filename: string): { absolutePath: string; contentType: string } | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) return null;

  const extension = path.extname(filename).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return null;

  const directory = path.resolve(process.cwd(), "public", "uploads", "questions");
  const absolutePath = path.resolve(directory, filename);
  if (!absolutePath.startsWith(`${directory}${path.sep}`) || !fs.existsSync(absolutePath)) return null;

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) return null;
  return { absolutePath, contentType };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const image = findQuestionImage(filename);
  if (!image) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(fs.readFileSync(image.absolutePath), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "no-store",
    },
  });
}
