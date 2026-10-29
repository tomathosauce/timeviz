import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Leaf,
  LocateFixed,
  ListTodo,
  Download,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import Wheel from "./Wheel";
import BlockEditor from "./BlockEditor";
import TaskEditor from "./TaskEditor";
import Backups from "./Backups";
import {
  type Schedule,
  type Task,
  resolveBlocks,
  upsertBlock,
  validateTask,
  taskTotals,
} from "./tasks";
import {
  type Block,
  COLORS,
  HALF_HOUR,
  WINDOW,
  clip,
  duration,
  firstFree,
  floorHalfHour,
  formatDate,
  formatTime,
  localInput,
  validate,
} from "./time";
import { readSchedule, writeSchedule } from "./scheduleStorage";

export default function App() {
  const [initial] = useState(readSchedule);
  const [schedule, setSchedule] = useState<Schedule>(initial.schedule);
  const blocks = useMemo(() => resolveBlocks(schedule), [schedule]);
  const [saveError, setSaveError] = useState(initial.error);
  const [now, setNow] = useState(Date.now);
  const [windowStart, setWindowStart] = useState(() =>
    floorHalfHour(Date.now()),
  );
  const [following, setFollowing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Block | null>(null);
  const [taskEditor, setTaskEditor] = useState<Task | null>(null);
  const [backups, setBackups] = useState(false);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<Schedule | null>(null);
  const agendaHeading = useRef<HTMLHeadingElement>(null);
  const tasksHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (following && !busy && !editor && !taskEditor && !backups)
      setWindowStart(floorHalfHour(now));
  }, [now, following, busy, editor, taskEditor, backups]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  function commit(next: Schedule, message: string) {
    setUndo(schedule);
    setSchedule(next);
    setSaveError(writeSchedule(next));
    setNotice(message);
  }
  function openEditor(block: Block) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditor(block);
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else document.getElementById("add-block")?.focus();
    });
  }
  function save(block: Block) {
    const problem = validate(block, blocks);
    if (problem) {
      setNotice(problem);
      return;
    }
    const existing = blocks.some((b) => b.id === block.id);
    commit(
      upsertBlock(schedule, block),
      existing ? "Time block updated." : "A little time, well planned.",
    );
    if (editor) closeEditor();
  }
  function navigate(start: number) {
    setFollowing(false);
    setWindowStart(start);
  }
  function chooseDate(value: string) {
    if (!value) return;
    const date = new Date(windowStart);
    const [y, m, d] = value.split("-").map(Number);
    date.setFullYear(y, m - 1, d);
    if (Number.isFinite(date.getTime()))
      navigate(floorHalfHour(date.getTime()));
  }
  function addBlock(task?: Task) {
    const start = firstFree(
      blocks,
      following ? floorHalfHour(now) + HALF_HOUR : windowStart,
    );
    openEditor({
      id: crypto.randomUUID(),
      taskId: task?.id,
      title: task?.title ?? "",
      start,
      end: start + HALF_HOUR,
      color: task?.color ?? COLORS[schedule.tasks.length % COLORS.length],
    });
  }
  function saveTask(task: Task) {
    if (validateTask(task, schedule.tasks)) return;
    const existing = schedule.tasks.some((t) => t.id === task.id);
    commit(
      {
        ...schedule,
        tasks: [
          ...schedule.tasks.filter((t) => t.id !== task.id),
          { ...task, title: task.title.trim().replace(/\s+/g, " ") },
        ],
      },
      existing
        ? "Task updated across all its blocks."
        : "Task created. Add a block whenever you are ready.",
    );
    setTaskEditor(null);
  }
  function newTask() {
    setTaskEditor({
      id: crypto.randomUUID(),
      title: "",
      color: COLORS[schedule.tasks.length % COLORS.length],
    });
  }
  const end = windowStart + WINDOW;
  const visible = blocks
    .filter((b) => b.start < end && b.end > windowStart)
    .sort((a, b) => a.start - b.start);
  const planned = visible.reduce((sum, b) => {
    const c = clip(b, windowStart);
    return sum + c.end - c.start;
  }, 0);
  const active = blocks.find((b) => b.start <= now && b.end > now);
  const sameDate = formatDate(windowStart) === formatDate(end);
  const dateTitle = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(windowStart);
  const timezone = Intl.DateTimeFormat()
    .resolvedOptions()
    .timeZone.replaceAll("_", " ");
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Application navigation">
        <a className="brand-mark" href="#main" aria-label="Timeviz home">
          <span />
          <span />
          <span />
        </a>
        <div className="sidebar-links">
          <button
            className="sidebar-button active"
            aria-label="Your time wheel"
            title="Your time wheel"
            onClick={() => document.getElementById("main")?.focus()}
          >
            <Compass size={22} />
          </button>
          <button
            className="sidebar-button"
            aria-label="Go to agenda"
            title="Go to agenda"
            onClick={() => {
              agendaHeading.current?.focus();
              agendaHeading.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          >
            <Clock3 size={21} />
          </button>
          <button
            className="sidebar-button"
            aria-label="Go to tasks"
            title="Go to tasks"
            onClick={() => {
              tasksHeading.current?.focus();
              tasksHeading.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            <ListTodo size={21} />
          </button>
        </div>
        <button
          className="sidebar-button help-button"
          aria-label="How to use Timeviz"
          title="How to use Timeviz"
          onClick={() => setHelp(!help)}
        >
          <CircleHelp size={21} />
        </button>
        <div className="sidebar-avatar" title="Your personal space">
          Y
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a href="#main" className="wordmark">
            timeviz<span> / </span>
            <small>your personal rhythm</small>
          </a>
          <div className="topbar-right">
            <span className={`save-status ${saveError ? "save-failed" : ""}`}>
              {saveError ? <CircleHelp size={14} /> : <Check size={14} />}
              {saveError ? "Save needs attention" : "Saved on this device"}
            </span>
            <span className="personal-badge">PERSONAL SPACE</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="small-line" /> A LITTLE STRUCTURE. A LOT OF
                POSSIBILITY.
              </div>
              <h1>
                Make room for your day<span>.</span>
              </h1>
              <p>
                See your time. Shape your rhythm. Leave a little breathing room.
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary-button backups-button"
                onClick={() => setBackups(true)}
              >
                <Download size={16} />
                Export / Import
              </button>
              <button
                className="primary-button"
                id="add-block"
                onClick={() => addBlock()}
              >
                <Plus size={17} />
                Add block
              </button>
            </div>
          </section>
          {saveError ? (
            <div className="storage-warning" role="alert">
              {saveError}
            </div>
          ) : null}
          {help ? (
            <section className="help-panel" aria-label="How to use Timeviz">
              <button
                className="icon-button"
                aria-label="Close help"
                onClick={() => setHelp(false)}
              >
                <X size={18} />
              </button>
              <strong>Your day, one arc at a time.</strong>
              <p>
                Drag clockwise on the colored track to create a block. Drag a
                block to move it, or its end dots to resize. Drag the thin outer
                rim to browse time. Everything snaps to 30 minutes; overlapping
                blocks stay out of your schedule. Use Add block or an agenda
                item to edit with your keyboard. Escape cancels a drag. Choose
                an existing task in the block editor to give it another block,
                or open Your tasks to see its total time and edit its shared
                name and color.
              </p>
            </section>
          ) : null}
          <section className="planner-layout" aria-label="Time planner">
            <div className="wheel-panel">
              <div className="wheel-toolbar">
                <div className="date-navigation">
                  <button
                    className="icon-button"
                    aria-label="Previous 12 hours"
                    onClick={() => navigate(windowStart - WINDOW)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <label className="date-picker">
                    <span>{dateTitle}</span>
                    <input
                      type="date"
                      aria-label="Choose schedule date"
                      value={localInput(windowStart).slice(0, 10)}
                      onInput={(e) => chooseDate(e.currentTarget.value)}
                      onChange={(e) => chooseDate(e.target.value)}
                    />
                  </label>
                  <button
                    className="icon-button"
                    aria-label="Next 12 hours"
                    onClick={() => navigate(windowStart + WINDOW)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <button
                  className={`now-button ${following ? "following" : ""}`}
                  onClick={() => {
                    setFollowing(true);
                    setWindowStart(floorHalfHour(Date.now()));
                  }}
                >
                  <LocateFixed size={14} />
                  Now
                </button>
              </div>
              <div className="window-range">
                {formatTime(windowStart, true)}
                <ArrowRight size={12} />
                {formatTime(end, true)}
                {!sameDate ? (
                  <span className="end-date"> · {formatDate(end)}</span>
                ) : null}
                <span className="range-divider">/</span>
                <span>12-hour view</span>
              </div>
              <Wheel
                blocks={blocks}
                start={windowStart}
                now={now}
                onEdit={openEditor}
                onChange={save}
                onNavigate={navigate}
                onBusy={setBusy}
              />
              <div className="wheel-bottom">
                <span>
                  <span className="legend-dot" />
                  {following
                    ? "Following the present"
                    : "Exploring your schedule"}
                </span>
                <span>
                  30-minute blocks <span className="subtle-dot">·</span> Drag
                  outer rim to explore
                </span>
              </div>
            </div>
            <aside className="agenda-panel" aria-label="Agenda">
              <div className="agenda-title">
                <div>
                  <span className="eyebrow">ONE THING AT A TIME</span>
                  <h2 ref={agendaHeading} tabIndex={-1}>
                    Your next 12 hours
                    <span>{visible.length.toString().padStart(2, "0")}</span>
                  </h2>
                </div>
              </div>
              <div className="time-summary">
                <div>
                  <span className="summary-label">Planned</span>
                  <strong>{duration(planned)}</strong>
                </div>
                <div>
                  <span className="summary-label">Breathing room</span>
                  <strong>{duration(WINDOW - planned)}</strong>
                </div>
                <div className="summary-track">
                  <span style={{ width: `${(planned / WINDOW) * 100}%` }} />
                </div>
                <span className="summary-caption">
                  A little intention goes a long way.
                </span>
              </div>
              <div className="agenda-list">
                {visible.length === 0 ? (
                  <div className="empty-agenda">
                    <div className="empty-illustration">
                      <div />
                      <Clock3 size={32} strokeWidth={1} />
                      <span />
                    </div>
                    <h3>A fresh stretch of time.</h3>
                    <p>
                      What would you like to make room for?
                      <br />
                      Start with one small block.
                    </p>
                    <button className="text-button" onClick={() => addBlock()}>
                      Plan your first block
                      <ArrowDownRight size={16} />
                    </button>
                  </div>
                ) : (
                  visible.map((b) => (
                    <button
                      key={b.id}
                      className={`agenda-item ${active?.id === b.id ? "is-current" : ""}`}
                      onClick={() => openEditor(b)}
                    >
                      <span
                        className="agenda-color"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="agenda-item-body">
                        <span className="agenda-time">
                          {formatTime(b.start)} — {formatTime(b.end)}
                          {formatDate(b.start) !== formatDate(b.end)
                            ? ` · ends ${formatDate(b.end)}`
                            : ""}
                        </span>
                        <strong>{b.title}</strong>
                        <span className="agenda-duration">
                          {duration(b.end - b.start)}
                          {active?.id === b.id ? (
                            <span className="current-badge">HAPPENING NOW</span>
                          ) : null}
                          {b.start < windowStart || b.end > end
                            ? " · continues outside view"
                            : ""}
                        </span>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                )}
              </div>
              <button className="agenda-add" onClick={() => addBlock()}>
                <Plus size={17} />
                Make time for something
              </button>
              <div className="gentle-note">
                <Leaf size={19} strokeWidth={1.4} />
                <p>
                  You don’t have to fill every moment.
                  <br />
                  <span>Space is part of the plan, too.</span>
                </p>
              </div>
            </aside>
          </section>
          <section className="tasks-panel" aria-labelledby="tasks-heading">
            <div className="tasks-heading">
              <div>
                <span className="eyebrow">THE THINGS YOU MAKE TIME FOR</span>
                <h2 id="tasks-heading" ref={tasksHeading} tabIndex={-1}>
                  Your tasks <span>{schedule.tasks.length}</span>
                </h2>
                <p>
                  One task, as many blocks as you need. Totals include all
                  dates.
                </p>
              </div>
              <button
                className="secondary-button new-task-button"
                onClick={newTask}
              >
                <Plus size={16} />
                New task
              </button>
            </div>
            {schedule.tasks.length ? (
              <div className="task-grid">
                {schedule.tasks.map((task) => {
                  const totals = taskTotals(schedule, task.id);
                  return (
                    <article key={task.id} className="task-card">
                      <div className="task-card-title">
                        <span
                          className="task-color"
                          style={{ background: task.color }}
                        />
                        <h3>{task.title}</h3>
                        <button
                          className="text-button"
                          aria-label={`Edit task ${task.title}`}
                          onClick={() => setTaskEditor(task)}
                        >
                          Edit
                        </button>
                      </div>
                      <p>
                        {totals.count} {totals.count === 1 ? "block" : "blocks"}
                        <span className="subtle-dot">·</span>
                        {duration(totals.duration)} scheduled
                      </p>
                      <button
                        className="task-schedule-button"
                        onClick={() => addBlock(task)}
                        aria-label={`Add block for ${task.title}`}
                      >
                        <Plus size={14} />
                        Add another block
                      </button>
                      {totals.count ? (
                        <details className="task-blocks">
                          <summary>View blocks</summary>
                          <div>
                            {blocks
                              .filter((b) => b.taskId === task.id)
                              .sort((a, b) => a.start - b.start)
                              .map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => {
                                    navigate(floorHalfHour(b.start));
                                    openEditor(b);
                                  }}
                                >
                                  <span>{formatDate(b.start)}</span>
                                  <span>
                                    {formatTime(b.start)} – {formatTime(b.end)}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-tasks">
                Create a task here, or name your first block to create one
                automatically.
              </div>
            )}
          </section>
          <footer className="page-footer">
            <span>
              <span className="footer-star">✳</span> Less rush. More rhythm.
            </span>
            <span>
              {timezone}
              <span className="subtle-dot">·</span>Made for your own pace
            </span>
          </footer>
        </main>
      </div>
      {notice ? (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{notice}</span>
          {undo ? (
            <button
              onClick={() => {
                const previous = undo;
                setSchedule(previous);
                setSaveError(writeSchedule(previous));
                setUndo(null);
                setNotice("Change undone.");
              }}
            >
              <RotateCcw size={13} />
              Undo
            </button>
          ) : null}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {editor ? (
        <BlockEditor
          key={editor.id}
          block={editor}
          blocks={blocks}
          tasks={schedule.tasks}
          onSave={save}
          onDelete={(id) => {
            commit(
              {
                ...schedule,
                blocks: schedule.blocks.filter((b) => b.id !== id),
              },
              "Time block deleted. Its task is still available.",
            );
            closeEditor();
          }}
          onClose={closeEditor}
        />
      ) : null}
      {taskEditor ? (
        <TaskEditor
          key={taskEditor.id}
          task={taskEditor}
          tasks={schedule.tasks}
          blockCount={taskTotals(schedule, taskEditor.id).count}
          onSave={saveTask}
          onClose={() => setTaskEditor(null)}
        />
      ) : null}
      {backups ? (
        <Backups
          schedule={schedule}
          onClose={() => setBackups(false)}
          onImport={(imported) => {
            commit(
              imported,
              "Schedule imported. Your previous schedule can be restored with Undo.",
            );
            setBackups(false);
          }}
        />
      ) : null}
    </div>
  );
}
