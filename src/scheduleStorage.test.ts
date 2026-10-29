import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSchedule,
  STORAGE_KEY,
  LEGACY_KEY,
  writeSchedule,
} from "./scheduleStorage";
import { HALF_HOUR, type Block } from "./time";
import { emptySchedule, migrateBlocks } from "./tasks";

const start = new Date(2026, 9, 24, 10).getTime();
const block: Block = {
  id: "one",
  title: "A walk",
  start,
  end: start + HALF_HOUR,
  color: "#829b78",
};
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("task schedule persistence and migration", () => {
  it("starts with an empty schedule", () =>
    expect(readSchedule()).toEqual({ schedule: emptySchedule(), error: "" }));
  it("round-trips tasks and references without copying names into stored blocks", () => {
    const schedule = migrateBlocks([block]);
    expect(writeSchedule(schedule)).toBe("");
    expect(readSchedule()).toEqual({ schedule, error: "" });
    const data = JSON.parse(memory.get(STORAGE_KEY)!);
    expect(data.version).toBe(2);
    expect(data.blocks[0].taskId).toBe(data.tasks[0].id);
    expect(data.blocks[0].title).toBeUndefined();
  });
  it("migrates repeated legacy names and preserves the original saved data", () => {
    const raw = JSON.stringify({
      version: 1,
      blocks: [
        block,
        {
          ...block,
          id: "two",
          title: " A WALK ",
          start: block.end,
          end: block.end + HALF_HOUR,
        },
      ],
    });
    memory.set(LEGACY_KEY, raw);
    const result = readSchedule();
    expect(result.error).toBe("");
    expect(result.schedule.tasks).toHaveLength(1);
    expect(result.schedule.blocks).toHaveLength(2);
    expect(memory.get(LEGACY_KEY)).toBe(raw);
    expect(memory.has(STORAGE_KEY)).toBe(false);
    writeSchedule(result.schedule);
    expect(readSchedule().schedule).toEqual(result.schedule);
    expect(memory.get(LEGACY_KEY)).toBe(raw);
  });
  it("prefers v2 data, including a deliberately emptied schedule", () => {
    memory.set(LEGACY_KEY, JSON.stringify({ version: 1, blocks: [block] }));
    writeSchedule(emptySchedule());
    expect(readSchedule().schedule).toEqual(emptySchedule());
  });
  it("preserves corrupt v2 data instead of falling back to an older schedule", () => {
    memory.set(STORAGE_KEY, "{broken");
    memory.set(LEGACY_KEY, JSON.stringify({ version: 1, blocks: [block] }));
    expect(readSchedule().error).toContain("could not be read");
    expect(memory.get(STORAGE_KEY)).toBe("{broken");
  });
  it("rejects missing tasks, duplicate blocks, overlapping blocks, and duplicate task names", () => {
    const valid = migrateBlocks([block]);
    for (const invalid of [
      { ...valid, tasks: [] },
      { ...valid, blocks: [valid.blocks[0], valid.blocks[0]] },
      {
        ...valid,
        blocks: [valid.blocks[0], { ...valid.blocks[0], id: "two" }],
      },
      { ...valid, tasks: [valid.tasks[0], { ...valid.tasks[0], id: "other" }] },
    ]) {
      memory.set(STORAGE_KEY, JSON.stringify({ version: 2, ...invalid }));
      expect(readSchedule().error).not.toBe("");
    }
  });
  it("rejects invalid legacy data without altering it", () => {
    const raw = JSON.stringify({
      version: 1,
      blocks: [{ ...block, color: "invalid" }],
    });
    memory.set(LEGACY_KEY, raw);
    expect(readSchedule().error).not.toBe("");
    expect(memory.get(LEGACY_KEY)).toBe(raw);
  });
  it("reports inaccessible or exhausted storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(readSchedule().error).not.toBe("");
    expect(writeSchedule(emptySchedule())).toContain("could not save");
  });
});
