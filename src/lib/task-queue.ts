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
  dedupKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskHandler = (task: TaskRecord) => Promise<any>;

interface TaskQueueState {
  queue: TaskRecord[];
  handlers: Map<TaskType, TaskHandler>;
  processing: boolean;
}

const globalState = globalThis as typeof globalThis & {
  __UNIFIL_EXAMS_TASK_QUEUE__?: TaskQueueState;
};

const state = globalState.__UNIFIL_EXAMS_TASK_QUEUE__ ??= {
  queue: [],
  handlers: new Map<TaskType, TaskHandler>(),
  processing: false,
};

export function registerHandler(type: TaskType, handler: TaskHandler) {
  state.handlers.set(type, handler);
  scheduleProcessing();
}

export function enqueueTask(params: Omit<TaskRecord, "id" | "status" | "createdAt">): { task: TaskRecord; isNew: boolean } {
  const existing = state.queue.find(
    (task) => task.dedupKey === params.dedupKey && (task.status === "pending" || task.status === "processing"),
  );
  if (existing) return { task: existing, isNew: false };

  const task: TaskRecord = {
    ...params,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: Date.now(),
  };

  state.queue.push(task);
  scheduleProcessing();
  return { task, isNew: true };
}

export function cancelTask(id: string): boolean {
  const task = state.queue.find((entry) => entry.id === id);
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
  scheduleProcessing();
  return [...state.queue].reverse().slice(0, 50);
}

export function getTask(id: string): TaskRecord | undefined {
  scheduleProcessing();
  return state.queue.find((task) => task.id === id);
}

function scheduleProcessing() {
  if (state.processing) return;
  setTimeout(processNext, 0);
}

async function processNext() {
  if (state.processing) return;

  const task = state.queue.find((entry) => entry.status === "pending");
  if (!task) {
    state.processing = false;
    return;
  }

  state.processing = true;
  task.status = "processing";
  task.startedAt = Date.now();

  try {
    const handler = state.handlers.get(task.type);
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
    state.processing = false;
    if (state.queue.some((entry) => entry.status === "pending")) {
      setTimeout(processNext, 0);
    }
  }
}
