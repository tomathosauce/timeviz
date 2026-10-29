import { describe, expect, it } from "vitest";
import { HALF_HOUR, type Block } from "./time";
import {
  emptySchedule,
  migrateBlocks,
  resolveBlocks,
  taskTotals,
  upsertBlock,
  validateTask,
} from "./tasks";

const start = new Date(2026, 9, 24, 10).getTime();
const block: Block = {
  id: "a",
  title: "My project",
  start,
  end: start + HALF_HOUR,
  color: "#829b78",
};
describe("tasks with multiple blocks", () => {
  it("groups names ignoring case and extra spaces without changing times or IDs", () => {
    const second = {
      ...block,
      id: "b",
      title: "  MY   project ",
      start: block.end,
      end: block.end + HALF_HOUR,
      color: "#879ab3",
    };
    const schedule = migrateBlocks([block, second]);
    expect(schedule.tasks).toHaveLength(1);
    expect(schedule.blocks.map((b) => [b.id, b.start, b.end])).toEqual([
      [block.id, block.start, block.end],
      [second.id, second.start, second.end],
    ]);
    expect(resolveBlocks(schedule).map((b) => b.color)).toEqual([
      block.color,
      block.color,
    ]);
  });
  it("creates a task once and reuses it for subsequent blocks", () => {
    const schedule = upsertBlock(emptySchedule(), block);
    const next = upsertBlock(schedule, {
      ...block,
      id: "b",
      taskId: schedule.tasks[0].id,
      start: block.end,
      end: block.end + HALF_HOUR,
    });
    expect(next.tasks).toHaveLength(1);
    expect(taskTotals(next, next.tasks[0].id)).toEqual({
      count: 2,
      duration: 2 * HALF_HOUR,
    });
    expect(schedule.blocks).toHaveLength(1);
  });
  it("derives every block label and color from its shared task", () => {
    const schedule = migrateBlocks([
      block,
      { ...block, id: "b", start: block.end, end: block.end + HALF_HOUR },
    ]);
    const renamed = {
      ...schedule,
      tasks: [{ ...schedule.tasks[0], title: "Thesis", color: "#879ab3" }],
    };
    expect(
      resolveBlocks(renamed).every(
        (b) => b.title === "Thesis" && b.color === "#879ab3",
      ),
    ).toBe(true);
    expect(resolveBlocks(schedule)[0].title).toBe("My project");
  });
  it("moving or resizing a block preserves its task and does not duplicate the block", () => {
    const schedule = migrateBlocks([block]);
    const moved = upsertBlock(schedule, {
      ...resolveBlocks(schedule)[0],
      start: block.end,
      end: block.end + 2 * HALF_HOUR,
    });
    expect(moved.tasks).toEqual(schedule.tasks);
    expect(moved.blocks).toHaveLength(1);
    expect(moved.blocks[0].taskId).toBe(schedule.tasks[0].id);
  });
  it("reassigns one block without changing its previous task", () => {
    const schedule = migrateBlocks([block]);
    const next = upsertBlock(schedule, {
      ...block,
      taskId: undefined,
      title: "Exercise",
    });
    expect(next.tasks).toHaveLength(2);
    expect(resolveBlocks(next)[0].title).toBe("Exercise");
    expect(taskTotals(next, schedule.tasks[0].id)).toEqual({
      count: 0,
      duration: 0,
    });
  });
  it("rejects duplicate names but permits saving the same task", () => {
    const task = { id: "task", title: "My project", color: "#829b78" };
    expect(validateTask(task, [task])).toBe("");
    expect(
      validateTask({ ...task, id: "other", title: " MY  PROJECT " }, [task]),
    ).toContain("already exists");
    expect(validateTask({ ...task, title: " " }, [])).toContain("name");
  });
});
