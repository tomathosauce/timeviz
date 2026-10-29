import { type Block, validate } from "./time";
import {
  type Schedule,
  type Task,
  emptySchedule,
  migrateBlocks,
  resolveBlocks,
  validateTask,
} from "./tasks";

export const STORAGE_KEY = "timeviz.schedule.v2";
export const LEGACY_KEY = "timeviz.schedule.v1";

function checkBlocks(items: unknown[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const b = item as Block;
    if (
      !b ||
      typeof b.id !== "string" ||
      !b.id ||
      typeof b.title !== "string" ||
      typeof b.start !== "number" ||
      typeof b.end !== "number" ||
      typeof b.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(b.color) ||
      blocks.some((existing) => existing.id === b.id) ||
      validate(b, blocks)
    )
      throw new Error("Invalid block");
    blocks.push(b);
  }
  return blocks;
}

export function parseSchedule(raw: string): Schedule {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!parsed || !Array.isArray(parsed.blocks))
    throw new Error("Invalid schedule");
  if (parsed.version === 1) return migrateBlocks(checkBlocks(parsed.blocks));
  if (parsed.version !== 2 || !Array.isArray(parsed.tasks))
    throw new Error("Unknown version");
  const tasks: Task[] = [];
  for (const task of parsed.tasks) {
    if (
      !task ||
      typeof task.id !== "string" ||
      !task.id ||
      typeof task.title !== "string" ||
      typeof task.color !== "string" ||
      tasks.some((t) => t.id === task.id) ||
      validateTask(task, tasks)
    )
      throw new Error("Invalid task");
    tasks.push({ id: task.id, title: task.title, color: task.color });
  }
  const schedule: Schedule = {
    tasks,
    blocks: parsed.blocks.map(
      (b: { id: string; taskId: string; start: number; end: number }) => {
        if (
          !b ||
          typeof b.taskId !== "string" ||
          !tasks.some((t) => t.id === b.taskId)
        )
          throw new Error("Missing task");
        return { id: b.id, taskId: b.taskId, start: b.start, end: b.end };
      },
    ),
  };
  checkBlocks(resolveBlocks(schedule));
  return schedule;
}

export function serializeSchedule(schedule: Schedule): string {
  return JSON.stringify(
    {
      format: "timeviz",
      exportedAt: new Date().toISOString(),
      version: 2,
      ...parseSchedule(JSON.stringify({ version: 2, ...schedule })),
    },
    null,
    2,
  );
}

export function readSchedule(): { schedule: Schedule; error: string } {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const raw = current ?? localStorage.getItem(LEGACY_KEY);
    if (raw === null) return { schedule: emptySchedule(), error: "" };
    if (current !== null && JSON.parse(raw).version !== 2)
      throw new Error("Unknown version");
    return { schedule: parseSchedule(raw), error: "" };
  } catch {
    return {
      schedule: emptySchedule(),
      error:
        "Your saved schedule could not be read. Existing storage will be preserved until you save a change.",
    };
  }
}

export function writeSchedule(schedule: Schedule): string {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, ...schedule }),
    );
    return "";
  } catch {
    return "Your browser could not save this change. Your tasks and blocks are available for this session; keep this tab open.";
  }
}
