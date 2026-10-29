import { describe, expect, it } from "vitest";
import {
  HALF_HOUR,
  WINDOW,
  angleAt,
  angleDelta,
  arcPath,
  clip,
  firstFree,
  floorHalfHour,
  localInput,
  overlaps,
  parseLocal,
  snap,
  timeAt,
  validate,
} from "./time";
const start = new Date(2026, 9, 24, 10).getTime();
const block = {
  id: "a",
  title: "Deep work",
  start,
  end: start + HALF_HOUR,
  color: "#829b78",
};

describe("time and wheel geometry", () => {
  it("floors local time to the last half-hour", () => {
    expect(floorHalfHour(new Date(2026, 9, 24, 10, 17, 58).getTime())).toBe(
      start,
    );
    expect(floorHalfHour(start + HALF_HOUR + 60_000)).toBe(start + HALF_HOUR);
  });
  it("maps the top to the start and moves clockwise", () => {
    expect(timeAt(angleAt(0, -100), start)).toBe(start);
    expect(timeAt(angleAt(100, 0), start)).toBe(start + WINDOW / 4);
    expect(snap(start + 20 * 60_000, start)).toBe(start + HALF_HOUR);
  });
  it("unwraps navigation across the seam in both directions", () => {
    expect(angleDelta(6.2, 0.1)).toBeCloseTo(0.1831853);
    expect(angleDelta(0.1, 6.2)).toBeCloseTo(-0.1831853);
  });
  it("clips blocks on either side of the visible window", () => {
    expect(
      clip({ start: start - WINDOW, end: start + 2 * WINDOW }, start),
    ).toEqual({ start, end: start + WINDOW });
    expect(arcPath(start, start + WINDOW, start)).not.toContain("NaN");
  });
  it("crosses midnight by elapsed hours", () => {
    const evening = new Date(2026, 9, 24, 23, 30).getTime();
    expect(new Date(evening + 2 * HALF_HOUR).getDate()).toBe(25);
    expect(new Date(evening + WINDOW).getHours()).toBe(11);
  });
  it("keeps exactly 12 elapsed hours across a DST offset change", () => {
    const beforeFallback = Date.parse("2026-11-01T00:00:00-04:00");
    const afterFallback = Date.parse("2026-11-01T11:00:00-05:00");
    expect(afterFallback - beforeFallback).toBe(WINDOW);
    const beforeSpring = Date.parse("2026-03-08T00:00:00-05:00");
    expect(Date.parse("2026-03-08T13:00:00-04:00") - beforeSpring).toBe(WINDOW);
  });
  it("round-trips local date fields and preserves original timestamps", () => {
    expect(parseLocal(localInput(start), start)).toBe(start);
    expect(parseLocal("invalid", start)).toBeNaN();
  });
});
describe("scheduling rules", () => {
  it("allows adjacent blocks but rejects even partial overlaps", () => {
    expect(
      overlaps(block, { start: block.end, end: block.end + HALF_HOUR }),
    ).toBe(false);
    expect(validate({ ...block, id: "b" }, [block])).toContain("overlaps");
    expect(
      validate(
        { ...block, id: "b", start: block.end, end: block.end + HALF_HOUR },
        [block],
      ),
    ).toBe("");
  });
  it("permits editing a block without conflicting with itself", () =>
    expect(validate(block, [block])).toBe(""));
  it("rejects missing names, invalid dates, short and unsnapped blocks", () => {
    expect(validate({ ...block, title: " " }, [])).toContain("name");
    expect(validate({ ...block, start: NaN }, [])).toContain("valid");
    expect(validate({ ...block, end: start }, [])).toContain("30 minutes");
    expect(validate({ ...block, end: block.end + 1000 }, [])).toContain(
      "steps",
    );
  });
  it("finds the next free slot across consecutive blocks", () => {
    expect(
      firstFree(
        [
          block,
          { ...block, id: "b", start: block.end, end: block.end + HALF_HOUR },
        ],
        start,
      ),
    ).toBe(start + 2 * HALF_HOUR);
  });
});
