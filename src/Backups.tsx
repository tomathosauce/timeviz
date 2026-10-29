import { useEffect, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { type Schedule } from "./tasks";
import { parseSchedule, serializeSchedule } from "./scheduleStorage";

interface Props {
  schedule: Schedule;
  onImport: (schedule: Schedule) => void;
  onClose: () => void;
}
export default function Backups({ schedule, onImport, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [candidate, setCandidate] = useState<Schedule | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    dialog.current!.showModal();
  }, []);
  function download() {
    try {
      const data = serializeSchedule(schedule);
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `timeviz-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExported(true);
      setError("");
    } catch {
      setError(
        "This schedule could not be exported. Your current data has not changed.",
      );
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor backups-editor"
      aria-labelledby="backups-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="editor-heading">
        <div>
          <span className="eyebrow">TAKE YOUR TIME WITH YOU</span>
          <h2 id="backups-title">Schedule backups</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close backups"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <p className="task-editor-note">
        Save a file to move your tasks and blocks from this browser to the
        published site or another device. Files stay on your device; there is no
        automatic sync.
      </p>
      <section className="backup-section">
        <h3>Export your schedule</h3>
        <p>
          {schedule.tasks.length} tasks · {schedule.blocks.length} blocks,
          across all dates.
        </p>
        <button className="primary-button" onClick={download}>
          <Download size={16} />
          Download backup
        </button>
        {exported ? (
          <p className="backup-success" role="status">
            Backup download started. Keep this file somewhere safe.
          </p>
        ) : null}
      </section>
      <section className="backup-section">
        <h3>Import a backup</h3>
        <p>
          Choose a Timeviz JSON backup. You can review it before replacing this
          browser’s schedule.
        </p>
        <label className="field-label" htmlFor="backup-file">
          Backup file
        </label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          disabled={reading}
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            setCandidate(null);
            setFileName("");
            setError("");
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setError("Choose a backup smaller than 5 MB.");
              return;
            }
            setReading(true);
            try {
              const imported = parseSchedule(await file.text());
              setCandidate(imported);
              setFileName(file.name);
            } catch {
              setError(
                "This is not a valid Timeviz backup. Check the file and try again. Your current schedule has not changed.",
              );
            } finally {
              setReading(false);
            }
          }}
        />
        {reading ? (
          <p role="status" className="task-editor-note">
            Reading backup…
          </p>
        ) : null}
        {candidate ? (
          <div className="import-preview">
            <strong>{fileName}</strong>
            <p>
              {candidate.tasks.length} tasks · {candidate.blocks.length} blocks
              ready to import.
            </p>
            <p>
              This will replace your current {schedule.tasks.length} tasks and{" "}
              {schedule.blocks.length} blocks in this browser. Export first to
              keep a permanent copy. You can undo the import immediately
              afterward.
            </p>
            <button
              className="primary-button"
              onClick={() => onImport(candidate)}
            >
              <Upload size={16} />
              {schedule.tasks.length || schedule.blocks.length
                ? "Replace schedule"
                : "Import schedule"}
            </button>
          </div>
        ) : null}
      </section>
      <p className="form-error" role="alert">
        {error}
      </p>
    </dialog>
  );
}
