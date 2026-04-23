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
  const dest = path.join(process.cwd(), "public", `unifil-logo.${ext}`);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true });
}
