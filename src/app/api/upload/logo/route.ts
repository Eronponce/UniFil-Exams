import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const publicDir = path.join(process.cwd(), "public");
  // Remove any previous logo regardless of extension before saving the new one
  for (const oldExt of ["png", "jpg", "jpeg"]) {
    try { fs.unlinkSync(path.join(publicDir, `unifil-logo.${oldExt}`)); } catch { /* not found */ }
  }
  const dest = path.join(publicDir, `unifil-logo.${ext}`);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true });
}
