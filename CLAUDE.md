# Zen Workspace - Claude Code Instructions

Electron + React + TypeScript IDE application. Main process in `src/main/`, renderer in `src/renderer/`, preload in `src/preload/`.

## Mandatory Verification Before Reporting Done

After ANY code change, run ALL of these. No exceptions. No skipping.

```
npm run typecheck:node
npm run typecheck:web
npm test
npm run lint
```

All four must pass with zero new errors before reporting completion. If any fail, fix the issue and re-run. Do not report partial success as done.

## Re-read Rule

After editing a file, re-read the ENTIRE file (not just the changed lines). Check that edits integrate correctly with surrounding code. If file A's change affects file B, read file B too.

## Project-Specific Notes

- Two TypeScript configs: `tsconfig.node.json` (main process) and `tsconfig.web.json` (renderer). Both must pass.
- Tests use Vitest. 162+ tests across 21 files. All must pass.
- One pre-existing ESLint error at `GitDashboard.tsx:72` (not caused by us). Do not count this as a new failure.
- IPC security: all `ipcMain.handle` handlers must call `isTrustedIpcSender(event)`. Null/undefined events are trusted (internal main-process calls).
- Windows paths: always use `/[\\/]/` regex for path splitting, never just `/` or `\\`.
- `fs-extra` for sync checks (`existsSync`), `fs/promises` for async reads (`readFile`). Never use `readFileSync` in IPC handlers.
- Shell commands: use `execFile` with explicit shell args, never `exec` with string interpolation.
