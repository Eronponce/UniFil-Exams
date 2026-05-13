import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOGO_EXTENSIONS = ["jpg", "jpeg", "png"] as const;

function findLogoFile(): { absolutePath: string; ext: string } | null {
  const publicDir = path.join(process.cwd(), "public");
  for (const ext of LOGO_EXTENSIONS) {
    const absolutePath = path.join(publicDir, `unifil-logo.${ext}`);
    if (fs.existsSync(absolutePath)) return { absolutePath, ext };
  }
  return null;
}

function contentTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

export async function GET() {
  const found = findLogoFile();
  if (!found) return new NextResponse("Not found", { status: 404 });

  const bytes = fs.readFileSync(found.absolutePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentTypeFor(found.ext),
      "Cache-Control": "no-store",
    },
  });
}
