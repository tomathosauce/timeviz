import { type Block } from "./time";

export interface Task {
  id: string;
  title: string;
  color: string;
}
export interface ScheduledBlock {
  id: string;
  taskId: string;
  start: number;
  end: number;
}
export interface Schedule {
  tasks: Task[];
  blocks: ScheduledBlock[];
}
export const emptySchedule = (): Schedule => ({ tasks: [], blocks: [] });
export function taskName(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}
export function resolveBlocks(schedule: Schedule): Block[] {
  const tasks = new Map(schedule.tasks.map((task) => [task.id, task]));
  return schedule.blocks.map((block) => {
    const task = tasks.get(block.taskId);
    if (!task) throw new Error("Missing task");
    return { ...block, title: task.title, color: task.color };
  });
}
export function upsertBlock(schedule: Schedule, block: Block): Schedule {
  let task = schedule.tasks.find((task) => task.id === block.taskId);
  if (!task)
    task = schedule.tasks.find(
      (task) => taskName(task.title) === taskName(block.title),
    );
  const tasks = [...schedule.tasks];
  if (!task) {
    task = {
      id: crypto.randomUUID(),
      title: block.title.trim().replace(/\s+/g, " "),
      color: block.color,
    };
    tasks.push(task);
  }
  return {
    tasks,
    blocks: [
      ...schedule.blocks.filter((b) => b.id !== block.id),
      { id: block.id, taskId: task.id, start: block.start, end: block.end },
    ],
  };
}
export function migrateBlocks(blocks: Block[]): Schedule {
  return blocks.reduce(upsertBlock, emptySchedule());
}
export function validateTask(task: Task, tasks: Task[]): string {
  if (!task.title.trim()) return "Give this task a name.";
  if (task.title.trim().length > 80)
    return "Keep the task name to 80 characters.";
  if (!/^#[0-9a-f]{6}$/i.test(task.color)) return "Choose a valid task color.";
  if (
    tasks.some(
      (t) => t.id !== task.id && taskName(t.title) === taskName(task.title),
    )
  )
    return "A task with this name already exists. Select it when adding a block.";
  return "";
}
export function taskTotals(schedule: Schedule, taskId: string) {
  const blocks = schedule.blocks.filter((block) => block.taskId === taskId);
  return {
    count: blocks.length,
    duration: blocks.reduce((sum, block) => sum + block.end - block.start, 0),
  };
}
