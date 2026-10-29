export const HALF_HOUR = 30 * 60 * 1000;
export const WINDOW = 24 * HALF_HOUR;
export const COLORS = [
  "#829b78",
  "#879ab3",
  "#ba91a4",
  "#c5a16b",
  "#9a8cbb",
  "#73a7a0",
];
export interface Block {
  id: string;
  taskId?: string;
  title: string;
  start: number;
  end: number;
  color: string;
}

export function floorHalfHour(time: number): number {
  const date = new Date(time);
  return (
    time -
    ((date.getMinutes() % 30) * 60_000 +
      date.getSeconds() * 1000 +
      date.getMilliseconds())
  );
}
export function snap(time: number, origin = 0) {
  return origin + Math.round((time - origin) / HALF_HOUR) * HALF_HOUR;
}
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
export function angleAt(x: number, y: number) {
  return (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
}
export function angleDelta(previous: number, current: number) {
  return ((current - previous + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
export function timeAt(angle: number, start: number) {
  return start + (angle / (Math.PI * 2)) * WINDOW;
}
export function overlaps(
  a: Pick<Block, "start" | "end">,
  b: Pick<Block, "start" | "end">,
) {
  return a.start < b.end && a.end > b.start;
}
export function validate(block: Block, blocks: Block[]): string {
  if (!block.title.trim()) return "Give this block a name.";
  if (!Number.isFinite(block.start) || !Number.isFinite(block.end))
    return "Choose a valid start and end time.";
  if (block.end - block.start < HALF_HOUR)
    return "Make your block at least 30 minutes long.";
  if ([block.start, block.end].some((t) => floorHalfHour(t) !== t))
    return "Choose times in 30-minute steps.";
  const conflict = blocks.find((b) => b.id !== block.id && overlaps(b, block));
  return conflict
    ? `This overlaps with “${conflict.title}”. Choose another time.`
    : "";
}
export function clip(block: Pick<Block, "start" | "end">, windowStart: number) {
  return {
    start: Math.max(block.start, windowStart),
    end: Math.min(block.end, windowStart + WINDOW),
  };
}
export function point(angle: number, radius: number) {
  return {
    x: 300 + Math.sin(angle) * radius,
    y: 300 - Math.cos(angle) * radius,
  };
}
export function arcPath(
  start: number,
  end: number,
  windowStart: number,
  inner = 166,
  outer = 215,
) {
  const a = ((start - windowStart) / WINDOW) * Math.PI * 2;
  const b = Math.min(
    ((end - windowStart) / WINDOW) * Math.PI * 2,
    a + Math.PI * 2 - 0.00001,
  );
  const gap = Math.min(0.009, (b - a) / 8);
  const p = point(a + gap, outer),
    q = point(b - gap, outer);
  const r = point(b - gap, inner),
    s = point(a + gap, inner);
  const large = b - a - gap * 2 > Math.PI ? 1 : 0;
  return `M ${p.x} ${p.y} A ${outer} ${outer} 0 ${large} 1 ${q.x} ${q.y} L ${r.x} ${r.y} A ${inner} ${inner} 0 ${large} 0 ${s.x} ${s.y} Z`;
}
export function formatTime(time: number, withOffset = false) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(withOffset ? { timeZoneName: "shortOffset" as const } : {}),
  }).format(time);
}
export function formatDate(time: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}
export function duration(ms: number) {
  const minutes = Math.round(ms / 60_000),
    hours = Math.floor(minutes / 60);
  return (
    [hours ? `${hours}h` : "", minutes % 60 ? `${minutes % 60}m` : ""]
      .filter(Boolean)
      .join(" ") || "0m"
  );
}
export function localInput(time: number) {
  const d = new Date(time),
    pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Preserve the selected occurrence of a repeated local hour when an unchanged field is saved.
export function parseLocal(value: string, original: number) {
  if (value === localInput(original)) return original;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && localInput(parsed) === value ? parsed : NaN;
}
export function firstFree(blocks: Block[], start: number) {
  let candidate = start;
  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    if (overlaps({ start: candidate, end: candidate + HALF_HOUR }, block))
      candidate = block.end;
  }
  return candidate;
}
