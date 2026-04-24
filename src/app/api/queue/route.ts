import { NextResponse } from "next/server";
import { registerDefaultTaskHandlers } from "@/lib/task-handlers";
import { getQueue } from "@/lib/task-queue";

export const dynamic = "force-dynamic";

export function GET() {
  registerDefaultTaskHandlers();
  return NextResponse.json(getQueue());
}
