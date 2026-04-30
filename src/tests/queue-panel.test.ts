import { describe, expect, it } from "vitest";
import { shouldRefreshForTask } from "@/components/queue-panel-utils";
import type { TaskRecord } from "@/lib/task-queue";

function buildTask(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: "task-1",
    type: "audit",
    status: "pending",
    label: "Auditoria",
    payload: {},
    createdAt: 1000,
    dedupKey: "audit-1",
    ...overrides,
  };
}

describe("shouldRefreshForTask", () => {
  it("refreshes when a known active task reaches a terminal status", () => {
    const task = buildTask({ status: "done", finishedAt: 2000 });

    expect(shouldRefreshForTask(task, "processing", 1500)).toBe(true);
  });

  it("refreshes when the first observed state is terminal after mount", () => {
    const task = buildTask({ status: "done", finishedAt: 2000 });

    expect(shouldRefreshForTask(task, undefined, 1500)).toBe(true);
  });

  it("does not refresh for historical terminal tasks that finished before mount", () => {
    const task = buildTask({ status: "done", finishedAt: 1200 });

    expect(shouldRefreshForTask(task, undefined, 1500)).toBe(false);
  });

  it("does not refresh while the task is still active", () => {
    const task = buildTask({ status: "processing" });

    expect(shouldRefreshForTask(task, undefined, 1500)).toBe(false);
  });
});
