import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { COLORS } from "./time";
import { type Task, validateTask } from "./tasks";

interface Props {
  task: Task;
  tasks: Task[];
  blockCount: number;
  onSave: (task: Task) => void;
  onClose: () => void;
}
export default function TaskEditor({
  task,
  tasks,
  blockCount,
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(task.title);
  const [color, setColor] = useState(task.color);
  const [error, setError] = useState("");
  const existing = tasks.some((t) => t.id === task.id);
  useEffect(() => {
    dialog.current!.showModal();
    dialog.current!.querySelector<HTMLInputElement>("#task-title")?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="task-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = { ...task, title: title.trim(), color };
          const problem = validateTask(next, tasks);
          if (problem) setError(problem);
          else onSave(next);
        }}
      >
        <div className="editor-heading">
          <div>
            <span className="eyebrow">ONE TASK. MORE ROOM.</span>
            <h2 id="task-editor-title">
              {existing ? "Edit task" : "Create a task"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close task editor"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <label className="field-label" htmlFor="task-title">
          Task name
        </label>
        <input
          id="task-title"
          required
          maxLength={80}
          placeholder="Read, work on your project, exercise…"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
        />
        <p className="task-editor-note">
          {existing
            ? `Changes apply to all ${blockCount} ${blockCount === 1 ? "block" : "blocks"} for this task, on every date.`
            : "Create it once, then schedule as many blocks as you need."}
        </p>
        <fieldset className="color-picker">
          <legend>Task color</legend>
          {COLORS.map((c, i) => (
            <label
              key={c}
              className={color === c ? "color-option selected" : "color-option"}
              style={{ background: c }}
            >
              <input
                type="radio"
                name="task-color"
                checked={color === c}
                onChange={() => setColor(c)}
                aria-label={
                  ["Sage", "Blue", "Rose", "Sand", "Lavender", "Teal"][i]
                }
              />
              <span>{color === c ? "✓" : ""}</span>
            </label>
          ))}
        </fieldset>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="editor-footer">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            {existing ? "Save task" : "Create task"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
