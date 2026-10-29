import { describe, expect, it } from "vitest";
import { parseSchedule, serializeSchedule } from "./scheduleStorage";
import { type Schedule } from "./tasks";
import { HALF_HOUR } from "./time";

const start = new Date(2026, 9, 29, 10).getTime();
const schedule: Schedule = {
  tasks: [{ id: "task", title: "Project", color: "#829b78" }],
  blocks: [
    { id: "one", taskId: "task", start, end: start + HALF_HOUR },
    {
      id: "two",
      taskId: "task",
      start: start + 2 * HALF_HOUR,
      end: start + 3 * HALF_HOUR,
    },
  ],
};
describe("portable schedule backups", () => {
  it("preserves all task identities, block identities, and timestamps through export/import", () => {
    const backup = serializeSchedule(schedule);
    expect(JSON.parse(backup).format).toBe("timeviz");
    expect(JSON.parse(backup).exportedAt).toBeTypeOf("string");
    expect(parseSchedule(backup)).toEqual(schedule);
  });
  it("accepts UTF-8 BOM and older block-only backups", () => {
    expect(parseSchedule("\uFEFF" + serializeSchedule(schedule))).toEqual(
      schedule,
    );
    const legacy = {
      version: 1,
      blocks: schedule.blocks.map((b) => ({
        ...b,
        title: "Project",
        color: "#829b78",
      })),
    };
    const result = parseSchedule(JSON.stringify(legacy));
    expect(result.tasks).toHaveLength(1);
    expect(result.blocks.map((b) => [b.id, b.start, b.end])).toEqual(
      schedule.blocks.map((b) => [b.id, b.start, b.end]),
    );
  });
  it("rejects malformed, unknown, dangling, overlapping and reversed backups", () => {
    for (const raw of [
      "invalid JSON",
      JSON.stringify({ version: 99, ...schedule }),
      JSON.stringify({ version: 2, ...schedule, tasks: [] }),
      JSON.stringify({
        version: 2,
        ...schedule,
        blocks: [schedule.blocks[0], { ...schedule.blocks[0], id: "other" }],
      }),
      JSON.stringify({
        version: 2,
        ...schedule,
        blocks: [{ ...schedule.blocks[0], end: start - HALF_HOUR }],
      }),
    ]) {
      expect(() => parseSchedule(raw)).toThrow();
    }
    expect(schedule.blocks).toHaveLength(2);
  });
  it("does not re-export arbitrary imported metadata", () => {
    const imported = parseSchedule(
      JSON.stringify({ version: 2, ...schedule, ignored: "unrelated data" }),
    );
    expect(serializeSchedule(imported)).not.toContain("unrelated data");
  });
  it("supports an empty schedule backup", () =>
    expect(parseSchedule(serializeSchedule({ tasks: [], blocks: [] }))).toEqual(
      { tasks: [], blocks: [] },
    ));
});
