export type TaskStatus = "pending" | "processing" | "done" | "error" | "cancelled";
export type TaskType = "audit" | "ai-generate" | "ai-generate-single";

export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  errorMessage?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** Unique key for deduplication per question/request */
  dedupKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskHandler = (task: TaskRecord) => Promise<any>;

const queue: TaskRecord[] = [];
const handlers = new Map<TaskType, TaskHandler>();
let processing = false;

export function registerHandler(type: TaskType, handler: TaskHandler) {
  handlers.set(type, handler);
}

export function enqueueTask(params: Omit<TaskRecord, "id" | "status" | "createdAt">): { task: TaskRecord; isNew: boolean } {
  const existing = queue.find(
    (t) => t.dedupKey === params.dedupKey && (t.status === "pending" || t.status === "processing"),
  );
  if (existing) return { task: existing, isNew: false };

  const task: TaskRecord = {
    ...params,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: Date.now(),
  };
  queue.push(task);
  scheduleProcessing();
  return { task, isNew: true };
}

export function cancelTask(id: string): boolean {
  const task = queue.find((t) => t.id === id);
  if (!task) return false;
  if (task.status === "pending") {
    task.status = "cancelled";
    task.finishedAt = Date.now();
    return true;
  }
  if (task.status === "processing") {
    task.status = "cancelled";
    return true;
  }
  return false;
}

export function getQueue(): TaskRecord[] {
  return [...queue].reverse().slice(0, 50);
}

export function getTask(id: string): TaskRecord | undefined {
  return queue.find((t) => t.id === id);
}

function scheduleProcessing() {
  if (processing) return;
  setImmediate(processNext);
}

async function processNext() {
  if (processing) return;
  const task = queue.find((t) => t.status === "pending");
  if (!task) { processing = false; return; }

  processing = true;
  task.status = "processing";
  task.startedAt = Date.now();

  try {
    const handler = handlers.get(task.type);
    if (!handler) throw new Error(`No handler for task type: ${task.type}`);
    const result = await handler(task);
    if (task.status === "processing") {
      task.status = "done";
      task.result = result;
      task.finishedAt = Date.now();
    }
  } catch (err) {
    if (task.status === "processing") {
      task.status = "error";
      task.errorMessage = err instanceof Error ? err.message : String(err);
      task.finishedAt = Date.now();
    }
  } finally {
    processing = false;
    const hasMore = queue.some((t) => t.status === "pending");
    if (hasMore) setImmediate(processNext);
  }
}
