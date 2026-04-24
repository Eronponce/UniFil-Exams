import { NextResponse } from "next/server";
import { getQueue } from "@/lib/task-queue";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getQueue());
}
