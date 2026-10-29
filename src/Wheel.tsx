import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  type Block,
  HALF_HOUR,
  WINDOW,
  angleAt,
  angleDelta,
  arcPath,
  clamp,
  clip,
  duration,
  formatTime,
  point,
  snap,
  timeAt,
  validate,
} from "./time";

interface Props {
  blocks: Block[];
  start: number;
  now: number;
  onEdit: (block: Block) => void;
  onChange: (block: Block) => void;
  onNavigate: (start: number) => void;
  onBusy: (busy: boolean) => void;
}
type Mode = "create" | "move" | "start" | "end" | "navigate";
interface Gesture {
  mode: Mode;
  pointerId: number;
  x: number;
  y: number;
  previous: number;
  total: number;
  origin: number;
  anchor: number;
  pointerTime: number;
  moved: boolean;
  original?: Block;
  draft?: Block;
}

export default function Wheel({
  blocks,
  start,
  now,
  onEdit,
  onChange,
  onNavigate,
  onBusy,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<Block | null>(null);
  const [error, setError] = useState("");
  const [navigating, setNavigating] = useState(false);
  const endRef = useRef<() => void>(() => {});
  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    if (active && svg.current?.hasPointerCapture(active.pointerId))
      svg.current.releasePointerCapture(active.pointerId);
    setDraft(null);
    setError("");
    setNavigating(false);
    onBusy(false);
  }
  endRef.current = cancel;
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") endRef.current();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  function coordinates(e: ReactPointerEvent<SVGElement>) {
    const rect = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 600 - 300;
    const y = ((e.clientY - rect.top) / rect.height) * 600 - 300;
    return { angle: angleAt(x, y), radius: Math.hypot(x, y) };
  }
  function begin(
    e: ReactPointerEvent<SVGElement>,
    mode: Mode,
    original?: Block,
  ) {
    if (!e.isPrimary || e.button !== 0 || gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    const { angle } = coordinates(e);
    const anchor = clamp(
      snap(timeAt(angle, start), start),
      start,
      start + WINDOW - HALF_HOUR,
    );
    gesture.current = {
      mode,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      previous: angle,
      total: 0,
      origin: start,
      anchor,
      pointerTime: timeAt(angle, start),
      moved: false,
      original,
    };
    svg.current!.setPointerCapture(e.pointerId);
    onBusy(true);
    setError("");
    if (mode === "navigate") setNavigating(true);
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const { angle, radius } = coordinates(e);
    if (radius < 90) return;
    g.total += angleDelta(g.previous, angle);
    g.previous = angle;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return;
    g.moved = true;
    const shift =
      Math.round(((g.total / (Math.PI * 2)) * WINDOW) / HALF_HOUR) * HALF_HOUR;
    if (g.mode === "navigate") {
      onNavigate(g.origin + shift);
      return;
    }
    let next: Block;
    if (g.mode === "create") {
      next = {
        id: "preview",
        title: "New block",
        color: "#829b78",
        start: g.anchor,
        end: clamp(
          snap(g.pointerTime + (g.total / (Math.PI * 2)) * WINDOW, g.origin),
          g.anchor + HALF_HOUR,
          g.origin + WINDOW,
        ),
      };
    } else {
      const original = g.original!;
      next = { ...original };
      if (g.mode === "move") {
        next.start += shift;
        next.end += shift;
      }
      if (g.mode === "start")
        next.start = Math.min(original.start + shift, original.end - HALF_HOUR);
      if (g.mode === "end")
        next.end = Math.max(original.end + shift, original.start + HALF_HOUR);
    }
    g.draft = next;
    setDraft(next);
    setError(validate(next, blocks));
  }
  function finish(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const next = g.draft;
    cancel();
    if (g.mode === "navigate") return;
    if (!g.moved) {
      onEdit(
        g.original ?? {
          id: crypto.randomUUID(),
          title: "",
          start: g.anchor,
          end: g.anchor + HALF_HOUR,
          color: "#829b78",
        },
      );
    } else if (next) {
      const problem = validate(next, blocks);
      if (problem) {
        setError(problem);
        return;
      }
      if (g.mode === "create")
        onEdit({ ...next, id: crypto.randomUUID(), title: "" });
      else onChange(next);
    }
  }
  const visible = blocks.filter(
    (b) => b.start < start + WINDOW && b.end > start,
  );
  const shown = draft
    ? [...visible.filter((b) => b.id !== draft.id), draft]
    : visible;
  const repeatedLabels = new Set<string>();
  const counts = new Map<string, number>();
  for (let i = 0; i < 24; i++) {
    const t = start + i * HALF_HOUR;
    if (i === 0 || new Date(t).getMinutes() === 0) {
      const label = formatTime(t);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  counts.forEach((count, label) => {
    if (count > 1) repeatedLabels.add(label);
  });
  const nowAngle = ((now - start) / WINDOW) * Math.PI * 2;
  const nowPoint = point(nowAngle, 218);
  const nowInner = point(nowAngle, 147);
  return (
    <div className="wheel-area">
      <svg
        ref={svg}
        viewBox="0 0 600 600"
        className={`wheel ${navigating ? "is-navigating" : ""}`}
        aria-label="12-hour schedule. Drag the activity ring clockwise to create a block. Use the agenda or Add block for keyboard editing."
        onPointerDown={(e) => {
          const { radius } = coordinates(e);
          if (radius >= 162 && radius <= 219) begin(e, "create");
        }}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel();
        }}
      >
        <circle
          cx="300"
          cy="300"
          r="278"
          className="nav-rim"
          onPointerDown={(e) => begin(e, "navigate")}
        >
          <title>Drag this outer rim to move through time</title>
        </circle>
        <circle cx="300" cy="300" r="264" className="rim-line" />
        <circle cx="300" cy="300" r="190.5" className="empty-track" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const p = point(a, 220),
            q = point(a, i % 2 === 0 ? 230 : 225);
          const t = start + i * HALF_HOUR;
          const show = i === 0 || new Date(t).getMinutes() === 0;
          const label = point(a, 246);
          return (
            <g key={i} className="clock-tick">
              <line
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                className={show ? "major-tick" : "minor-tick"}
              />
              {show ? (
                <text
                  x={label.x}
                  y={label.y}
                  className={i === 0 ? "time-label first-label" : "time-label"}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {formatTime(t, repeatedLabels.has(formatTime(t))).replace(
                    ":00",
                    "",
                  )}
                </text>
              ) : null}
            </g>
          );
        })}
        {shown.map((b) => {
          const clipped = clip(b, start);
          if (clipped.end <= clipped.start) return null;
          const selected = draft?.id === b.id;
          const midpoint = (clipped.start + clipped.end) / 2;
          const label = point(
            ((midpoint - start) / WINDOW) * Math.PI * 2,
            190.5,
          );
          const textAngle = ((midpoint - start) / WINDOW) * 360;
          const rotation =
            textAngle > 90 && textAngle < 270 ? textAngle + 180 : textAngle;
          return (
            <g
              key={b.id}
              className={`time-block ${selected ? "dragging" : ""} ${selected && error ? "invalid" : ""}`}
            style={{ "--block-color": b.color } as CSSProperties}
            >
              <path
                d={arcPath(clipped.start, clipped.end, start)}
                fill={b.color}
                tabIndex={b.id === "preview" ? -1 : 0}
                role="button"
                aria-label={`${b.title}, ${formatTime(b.start, true)} to ${formatTime(b.end, true)}. Press Enter to edit.`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit(b);
                  }
                }}
                onPointerDown={(e) => begin(e, "move", b)}
              >
                <title>
                  {b.title}: {formatTime(b.start)} – {formatTime(b.end)} ·{" "}
                  {duration(b.end - b.start)}
                </title>
              </path>
              {clipped.end - clipped.start >= 2 * HALF_HOUR ? (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="block-label"
                  transform={`rotate(${rotation},${label.x},${label.y})`}
                >
                  {b.title.length > 16 ? `${b.title.slice(0, 14)}…` : b.title}
                </text>
              ) : null}
              {(["start", "end"] as const).map((side) => {
                const t = b[side],
                  continued = side === "start" ? t < start : t > start + WINDOW;
                const at = clamp(t, start, start + WINDOW);
                const handle = point(
                  ((at - start) / WINDOW) * Math.PI * 2 +
                    (side === "start" ? 0.018 : -0.018),
                  190.5,
                );
                return continued ? (
                  <text
                    key={side}
                    x={handle.x}
                    y={handle.y}
                    className="continuation"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    ↕
                  </text>
                ) : (
                  <circle
                    key={side}
                    cx={handle.x}
                    cy={handle.y}
                    r="8"
                    className="resize-handle"
                    onPointerDown={(e) => begin(e, side, b)}
                  >
                    <title>Drag to adjust {side} time</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
        <circle cx="300" cy="300" r="145" className="inner-circle" />
        {now >= start && now < start + WINDOW ? (
          <g className="now-marker">
            <line
              x1={nowInner.x}
              y1={nowInner.y}
              x2={nowPoint.x}
              y2={nowPoint.y}
            />
            <circle cx={nowPoint.x} cy={nowPoint.y} r="4.5" />
          </g>
        ) : null}
        <text x="300" y="264" textAnchor="middle" className="center-eyebrow">
          {draft ? "YOUR TIME BLOCK" : "LOCAL TIME"}
        </text>
        <text
          x="300"
          y="310"
          textAnchor="middle"
          className={draft ? "center-preview" : "center-time"}
        >
          {draft
            ? duration(draft.end - draft.start)
            : formatTime(now).replace(/\s*[AP]M/i, "")}
        </text>
        <text x="300" y="339" textAnchor="middle" className="center-date">
          {draft
            ? `${formatTime(draft.start)} – ${formatTime(draft.end)}`
            : `${new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now)} · ${new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: true }).format(now).match(/[AP]M/i)?.[0] ?? ""}`}
        </text>
        <circle cx="274" cy="369" r="3" className="live-dot" />
        <text x="284" y="373" className="center-live">
          {navigating ? "Browsing" : "Time is yours"}
        </text>
      </svg>
      <div
        className={`wheel-feedback ${error ? "has-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {error ||
          (navigating
            ? "Release to settle here. Use Now to return to the present."
            : draft
              ? "Release to save this time. Escape to cancel."
              : "Drag clockwise on the ring to make a little room.")}
      </div>
    </div>
  );
}
