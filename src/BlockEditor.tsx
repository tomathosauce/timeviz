import { useEffect, useRef, useState } from "react";
import { ArrowRight, Trash2, X } from "lucide-react";
import { type Task, taskName } from "./tasks";
import {
  type Block,
  COLORS,
  duration,
  formatTime,
  localInput,
  parseLocal,
  validate,
} from "./time";

interface Props {
  block: Block;
  blocks: Block[];
  tasks: Task[];
  onSave: (block: Block) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}
export default function BlockEditor({
  block,
  blocks,
  tasks,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(block.title);
  const [taskId, setTaskId] = useState(block.taskId ?? "");
  const [start, setStart] = useState(localInput(block.start));
  const [end, setEnd] = useState(localInput(block.end));
  const [color, setColor] = useState(block.color);
  const [error, setError] = useState("");
  const existing = blocks.some((b) => b.id === block.id);
  const selectedTask = tasks.find((task) => task.id === taskId);
  const matchingTask =
    selectedTask ??
    tasks.find((task) => taskName(task.title) === taskName(title));
  const startTime = parseLocal(start, block.start),
    endTime = parseLocal(end, block.end);
  useEffect(() => {
    dialog.current!.showModal();
    dialog.current!.querySelector<HTMLInputElement>("#block-title")?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="editor-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = {
            ...block,
            taskId: matchingTask?.id,
            title: matchingTask?.title ?? title.trim(),
            start: startTime,
            end: endTime,
            color: matchingTask?.color ?? color,
          };
          const problem = validate(next, blocks);
          if (problem) setError(problem);
          else onSave(next);
        }}
      >
        <div className="editor-heading">
          <div>
            <span className="eyebrow">MAKE IT INTENTIONAL</span>
            <h2 id="editor-title">
              {existing ? "Edit your block" : "A little time for…"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close editor"
          >
            <X size={19} />
          </button>
        </div>
        <label className="field-label" htmlFor="block-task">
          Task
        </label>
        <select
          id="block-task"
          className="task-select"
          value={taskId}
          onChange={(e) => {
            const chosen = tasks.find((task) => task.id === e.target.value);
            setTaskId(e.target.value);
            setTitle(chosen?.title ?? "");
            setColor(chosen?.color ?? block.color);
            setError("");
          }}
        >
          <option value="">Create a new task…</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="block-title">
          {selectedTask ? "Task name" : "What are you making time for?"}
        </label>
        <input
          id="block-title"
          autoFocus
          required
          maxLength={80}
          placeholder="Deep work, a walk, doing nothing…"
          value={title}
          readOnly={!!selectedTask}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
        />
        <p className="task-editor-note">
          {selectedTask
            ? "This block belongs to an existing task. Edit its name or color in Your tasks to update every block."
            : matchingTask
              ? `This name matches “${matchingTask.title}”. This block will join that task.`
              : "A new task will be created with this name. You can give it more blocks later."}
        </p>
        <div className="time-inputs">
          <label>
            Starts
            <input
              type="datetime-local"
              step="1800"
              required
              value={start}
              onInput={(e) => {
                setStart(e.currentTarget.value);
                setError("");
              }}
              onChange={(e) => {
                setStart(e.target.value);
                setError("");
              }}
            />
          </label>
          <ArrowRight size={16} />
          <label>
            Ends
            <input
              type="datetime-local"
              step="1800"
              required
              value={end}
              onInput={(e) => {
                setEnd(e.currentTarget.value);
                setError("");
              }}
              onChange={(e) => {
                setEnd(e.target.value);
                setError("");
              }}
            />
          </label>
        </div>
        <p className="editor-duration">
          {Number.isFinite(startTime) &&
          Number.isFinite(endTime) &&
          endTime > startTime
            ? `${duration(endTime - startTime)} · ${formatTime(startTime, true)} → ${formatTime(endTime, true)}`
            : "Choose a time range in 30-minute steps."}
        </p>
        <fieldset className="color-picker" disabled={!!matchingTask}>
          <legend>
            {matchingTask ? "Shared task color" : "Give the task a color"}
          </legend>
          {COLORS.map((c, i) => (
            <label
              key={c}
              className={
                (matchingTask?.color ?? color) === c
                  ? "color-option selected"
                  : "color-option"
              }
              style={{ background: c }}
            >
              <input
                type="radio"
                name="color"
                value={c}
                checked={(matchingTask?.color ?? color) === c}
                onChange={() => setColor(c)}
                aria-label={
                  ["Sage", "Blue", "Rose", "Sand", "Lavender", "Teal"][i]
                }
              />
              <span>{(matchingTask?.color ?? color) === c ? "✓" : ""}</span>
            </label>
          ))}
        </fieldset>
        <p role="alert" className="form-error">
          {error}
        </p>
        <div className="editor-footer">
          {existing ? (
            <button
              type="button"
              className="delete-button"
              onClick={() => onDelete(block.id)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button className="primary-button" type="submit">
            {existing ? "Save changes" : "Create block"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
