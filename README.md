# Timeviz

A personal circular planner built with React, TypeScript, Vite, and SVG. All schedule data stays in your browser's local storage. No account or backend is required.

## Run locally

On this Windows workspace, run `start.cmd` (or double-click it). It uses the portable Node.js runtime in `.tools` when available, so a global Node installation is not required.

Install Node.js 22.12 or newer, then run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Keep using the same hostname and port to access your saved schedule; browser storage is origin-specific.

```sh
npm test         # scheduling and geometry tests
npm run build    # TypeScript check and production build
npm run preview  # preview the production build
```

Production builds use `/timeviz/` for GitHub Pages. Open the production preview at `http://127.0.0.1:4173/timeviz/`; local development stays at `/`.

## Backups and moving to the published site

Use **Export / Import → Download backup** in your existing local browser tab. It downloads a JSON file with every task and block across all dates. Then open the published site and use **Export / Import** to select that file, review the counts, and import it. Nothing from your personal schedule is included in this repository or the deployed app.

Import replaces the schedule for the current browser origin after an explicit preview. Export the current schedule first if you want a permanent copy; immediate Undo also restores the previous schedule. Invalid backups are rejected without changing data. Both v2 task backups and v1 block-only data are supported. Backups larger than 5 MB are rejected.

The published URL and localhost use separate browser storage. Different devices also have separate storage; use backups to transfer schedules manually.

## GitHub Pages

The `.github/workflows/deploy.yml` workflow runs `npm ci`, tests, and a production build for pull requests and pushes to `main`. Successful pushes to `main` automatically deploy `dist/` to GitHub Pages. In repository **Settings → Pages**, choose **GitHub Actions** as the publishing source.

The repository is named `timeviz`, matching the production base path in `vite.config.ts`. If renamed or moved to a custom domain, update that path as well. Local runtimes, dependency folders, environment files, build output, and downloaded backups are ignored by Git.

## Your wheel

- The top starts at the most recent local half-hour and the wheel covers 12 elapsed hours clockwise. Follow mode updates every half-hour unless you are dragging or editing.
- Drag clockwise on the wide activity ring to create a block, then name it and choose a color. Clicking an empty part of the ring also opens a 30-minute block.
- Drag a block to move it. Drag its endpoint dots to resize it. The minimum duration is 30 minutes, and overlaps are prevented. Escape or a cancelled pointer gesture discards the preview.
- Drag the thin outer rim to shift the window in 30-minute steps. Arrow buttons shift 12 hours; the date picker jumps further. **Now** restores following.
- Use **Add block** or an agenda item for keyboard-friendly date/time editing. The editor can create longer blocks across windows, shown with continuation markers.
- Completed changes autosave. The notification provides Undo for the most recent change. Browser storage failures display a warning and preserve the working schedule in memory.

## Time and persistence

Tasks have an ID, a shared name, and a six-digit color. Each scheduled block has its own ID, start/end timestamps, and a `taskId`. The `timeviz.schedule.v2` storage entry contains `{ version: 2, tasks: [...], blocks: [...] }`. Names and colors are resolved from the task, so editing a task updates every linked block.

The **Your tasks** section shows all tasks, their block counts, and their total scheduled time across all dates. Use **Add another block** to schedule an existing task, or select it in the block editor. Deleting a block keeps its task available. **Edit** on a task changes its shared name/color. Undo restores both tasks and blocks for the last change.

Existing v1 schedules are migrated in memory by grouping names after trimming, collapsing whitespace, and ignoring case. All block IDs and times are preserved. The first matching block supplies the task's name and color. New names matching an existing task reuse that task. The original `timeviz.schedule.v1` entry is retained as a backup; v2 is saved on the next deliberate change. Invalid or unreadable data is not overwritten until an explicit change is saved.

The browser's local timezone controls labels and date entry. Twelve hours means elapsed time across daylight-saving transitions; repeated hour labels include their UTC offsets. Unchanged editor fields preserve the selected occurrence of a repeated hour. Newly entered repeated local times use the browser's earlier occurrence. Nonexistent local times are rejected.

Google Fonts are optional; the UI falls back to system sans-serif if offline. Local storage is specific to this browser profile and origin. There is no cross-device sync, recurring schedule, calendar integration, or reminder service.
