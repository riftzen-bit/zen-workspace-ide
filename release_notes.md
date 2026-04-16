## ✨ What's New in v1.1.6

### 🚀 Features & Enhancements

- **Git History & Branch Switcher:** The Git dashboard now exposes a branch dropdown (chevron next to the current branch) that lists every local and remote branch with last-commit metadata, plus a collapsible **History** section showing the last 50 commits (subject, short hash, author, timestamp tooltip). Backed by three new main-process IPCs — `git:log`, `git:branchList`, `git:checkout` — each wired through `execFile` with explicit argv. Branch checkout is gated: if the working tree or index has pending changes, the switch is refused with a toast telling the user to commit or stash first, preventing accidental state loss.
- **External File Change Detection with Dirty-State Preservation:** Monaco tabs now render a small accent-colored dot when the buffer diverges from the last saved contents. When a file changes on disk (e.g., `git pull`, external editor save), `AppLayout` checks the tab's dirty state: clean tabs auto-reload from disk with an info toast; dirty tabs keep the in-memory edits and surface a warning toast ("X changed on disk. Your unsaved edits are kept — save to overwrite, or close the tab to discard."). Implemented via a new `savedContents` map and `markFileSaved` action on `useFileStore`, updated from every save path (`MonacoEditor` manual + auto-save, `SplitEditor`, `CodeReviewPanel` quick-fix apply).
- **Sidebar Consolidation (12 views → 4 groups):** The activity dock now exposes four semantic groups — **Files**, **Work**, **Agents**, **Insights** — each with a horizontal sub-tab strip. Only one feature is visible at a time. Tabs map as Files → `explorer`/`find`/`bookmarks`, Work → `git`/`tasks`/`notes`/`activity`, Agents → `projects`/`terminal`/`orchestrator`, Insights → `focus`. Implemented via new `SidebarGroup` type, `GROUP_TABS` / `GROUP_OF` maps, `activeGroup` state (persisted) in `useUIStore`, and a reusable `SubTabStrip` component.
- **Pinned Files:** Pin up to 12 files from the file tree context menu (Pin File / Unpin File). Pinned files appear in a new `PinnedFilesStrip` at the top of the Explorer panel and are marked with a pin badge in the tree. Persisted across sessions via `useFileStore` (`pinnedFiles`, `togglePinnedFile`, `removePinnedFile`, `isPinned`).
- **Unified Search:** New single-panel search across files, bookmarks, and notes. Results are grouped by kind, capped at 50 per group, debounced at 350ms. Replaces the separate in-sidebar Search view under the Files group.
- **Keyboard Group & Tab Navigation:** `Ctrl+1`–`Ctrl+4` switch between the four sidebar groups. `Ctrl+Shift+]` / `Ctrl+Shift+[` cycle sub-tabs within the active group. `setActiveView` automatically syncs `activeGroup` via `GROUP_OF`.
- **Scratchpad Notes Panel:** New Notes sidebar view for persistent markdown scratchpad notes. Each note is either scoped to the active workspace or marked Global. Supports create, pin (pinned notes float to the top), inline title and body editing, full-text search across title and body, scope toggle (Workspace vs. All), per-note delete with confirm, and auto-sorted list by `updatedAt`. Notes persist via the existing encrypted electron-store layer under key `zen-notes`.
- **Editor Auto-Save:** New Auto Save setting in the Editor section of Settings. When enabled, Monaco debounces saves after you stop typing, with a configurable delay slider (500ms–5000ms, default 1000ms). Manual `Ctrl+S` still works. Setting persists across sessions.
- **Terminal Session Export:** Press `Ctrl+Shift+E` inside a focused terminal to export the full session buffer to a `.txt` or `.log` file via the native Save dialog. Uses a trusted IPC handler (`terminal:exportSession`) and default filename `terminal-<id>-<date>.txt`.

### 🛡️ Security & Reliability

**🔒 Highest-impact hardening in this release — main-process IPC and sandboxing:**

- **🔐 Safe Git Ref Validation for Checkout (HIGH):** Added `isSafeGitRef` helper in `gitHandler.ts` that rejects refs starting with `-` (flag injection), containing `..` (traversal), exceeding 200 chars, or containing any character outside `[A-Za-z0-9._/-]`. The `git:checkout` handler gates every branch argument through it before invoking `git`.
- **🔐 Debug Ping IPC Trusted-Sender Guard:** The leftover `ipcMain.on('ping', ...)` debug handler in `src/main/index.ts` now calls `isTrustedIpcSender(event)` and drops untrusted frames, closing the last unguarded IPC entry point in the main process.
- **🔐 Setup Guide Host Allowlist + Timer Cleanup (DNS Rebinding):** The Gemini OAuth setup-guide loopback server now validates the `Host` header against an explicit `127.0.0.1` / `localhost` allowlist on every request, defeating DNS-rebinding attacks that would otherwise expose the local OAuth callback. The inactivity timer is cleared on every transport close.
- **🔐 Google OAuth Timeout Leak Fix:** The token-exchange fetch now wraps its `AbortController` timeout in a `try/finally` so the timer is cleared on both success and error paths, preventing long-lived timers from piling up across repeated auth attempts.
- **🔐 Store Handler Array-as-Object Rejection:** `store:set` now rejects arrays passed as the persist payload (zustand persist shape must be `{state, version}`). Prior code silently accepted arrays, which would later crash rehydration. Guarded with a typeof + `Array.isArray` check.
- **🔐 FS Handler searchWithContext Relative-Path Normalization:** Results now return paths relative to the resolved workspace root rather than leaking absolute OS paths into the renderer.
- **🔐 Git IPC Workspace Containment (HIGH):** All eleven `git:*` handlers (`branch`, `status`, `statusFiles`, `fileDiffContent`, `add`, `unstage`, `diff`, `commit`, `stashList`, `stashSave`, `stashPop`, `stashApply`, `stashDrop`) now resolve the renderer-supplied `cwd` through `resolvePathWithinRoot(getCurrentWorkspacePath(), cwd)` before invoking `git`. Requests targeting any directory outside the active workspace are rejected up-front. The `file` argument to `git:fileDiffContent` is also re-contained under the resolved workspace root, closing a path-traversal vector on file reads during diff.
- **🔐 YouTube & Lyria IPC Trusted-Sender Check (MEDIUM):** Added `isTrustedIpcSender(event)` guards to `youtube:search`, `lyria:generate`, and `lyria:abort`. These handlers previously accepted any IPC sender; they now reject untrusted frames, aligning them with the rest of the main-process IPC surface.
- **🔐 Explicit BrowserWindow WebPreferences (MEDIUM):** The main `BrowserWindow` now sets `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true` explicitly rather than relying on defaults. Renderer capabilities are pinned to a known-safe baseline regardless of Electron version shifts.
- **🧹 Duplicate PTY IPC Handler Removal:** `terminal:resize` and `terminal:write` had both `ipcMain.handle(...)` and `ipcMain.on(...)` registrations. The preload surface uses `ipcRenderer.send` (fire-and-forget), so the unused `.handle` entries were removed — no more silent handler shadowing and no extra attack surface.
- **Tightened CSP:** Removed `'unsafe-eval'` from the main-window Content-Security-Policy `script-src` directive, shrinking the renderer's dynamic-code attack surface.
- **SafeStorage Visibility:** Main process now logs a clear warning when OS-level `safeStorage` encryption is unavailable and credentials fall back to plaintext, so operators can detect unprotected environments.
- **PTY Lifecycle Hardening:** Terminal recreation now clears activity buffer state, `ptyCreatedAt`, `ptyReadyAt`, and the PTY map before killing the old process, preventing stale status or buffered output from leaking into the replacement terminal.
- **PTY IPC Broadcast Fix:** Terminal `onData` and `onExit` now dispatch through the active `BrowserWindow.webContents` rather than the original `event.sender`, avoiding dropped frames when the originating renderer context is torn down (e.g., during navigation or workspace switches).
- **File Watcher Reentrancy Guard:** Added a `startingWatcher` latch so rapid successive `watchWorkspace` calls cannot spawn overlapping Chokidar watchers on the same tree.

### 🐛 Bug Fixes & Polish

**⚡ Renderer race conditions, stale closures, and unhandled IPC rejections — fixed across nine components:**

- **SplitEditor Ctrl+S Active-Pane Fix:** The split view's save shortcut saved the wrong pane's file when the non-focused side was active. Save path now reads the focused pane's `currentFile` / `currentContent` and calls `markFileSaved` against the correct buffer.
- **Sidebar Windows Path Crash:** File-tree expansion split paths with `/` only, breaking on Windows when the workspace root used backslashes. Switched to `/[\\/]/` everywhere path segments are derived.
- **useMusicStore Blob URL Leak:** Generated Lyria audio blobs were never revoked. Store now tracks the previous object URL and calls `URL.revokeObjectURL` before assigning a new one, and on explicit clear.
- **MusicGenerator Listener Leak:** `music.onProgress` subscriptions accumulated across remounts. The component now stores the unsubscribe function in a ref and tears it down on unmount.
- **ZenOrchestrator Lyria Teardown:** Pomodoro-end path now cancels any in-flight Lyria generation and revokes its blob URL before kicking off the upbeat switch track.
- **GitDashboard AI Generate Sequence Guard:** The "generate commit message" AI call could race with manual typing; added a `genSeqRef` last-write-wins counter so a slow AI response never clobbers a newer user edit.
- **Activity Parser Unbounded Buffer:** PTY activity parsing kept appending to a per-terminal buffer with no cap, growing without bound for long-running agents. Buffer is now trimmed to the last 64 KB on every append.
- **🛠️ AppLayout File Watcher Race (HIGH):** The workspace file watcher effect now carries a `cancelled` flag plus a `treeSeq` last-write-wins sequence counter. Rapid `onFileCreated` / `onDirCreated` / `onDirDeleted` events no longer race with slower `readDirectory` results — stale trees are dropped. All IPC chains (`readDirectory`, `readFile`) have `.catch(() => {})` so rejected promises never surface as unhandled errors. Path splitting uses `/[\\/]/` for Windows safety.
- **🛠️ MonacoEditor Stale Closures (HIGH):** The inline-completion provider now resolves `resolveAIRequestConfig()` and `activeFile` inside the `provideInlineCompletions` call instead of capturing them at effect mount. Changing provider/model no longer leaves the editor talking to a dead config. The provider body is wrapped in `try/catch`, so a failed AI call returns `{ items: [] }` instead of throwing into Monaco. The `onKeyDown` WPM tracker also reads `activeFile` from the store at call time.
- **🛠️ GitDashboard Race + Error Handling:** `loadGitState` runs on a 5s interval; added a `loadSeqRef` sequence counter and `cancelledRef` so overlapping ticks drop stale results. All stash / stage / unstage / commit handlers are wrapped in `try/catch` with user-visible error toasts — IPC failures no longer silently drop.
- **🛠️ StatusBar Git Branch Race:** The `git:branch` fetch in the status bar now uses a `cancelled` flag on unmount and a `.catch(() => setGitBranch(null))`, preventing state updates against a stale workspace and silencing unhandled rejections.
- **🛠️ WeatherTimeWidget Multi-Await Race:** `fetchLocationData` now takes an `isCancelled` callback that is checked between every `await` (geocode → IP-locate → weather fetch). The unmount cleanup flips the flag, so a slow network response after the widget remounts cannot overwrite fresh state.
- **🛠️ TaskTracker Cancel Flag:** `refreshTodos` accepts an `isCancelled` callback; the mount effect wires it up so an in-flight `scanTodos` result is dropped if the workspace changes mid-scan.
- **🛠️ ProjectList Async Error Paths:** `handleClick` (switch project) and `handleAddProject` now wrap `readDirectory` in `try/catch` and surface failures through a user-visible toast. Previously, a failing IPC would leave the UI in an inconsistent "workspace set but no tree" state.
- **🛠️ Sidebar Async Error Paths:** `handleOpenFolder`, the file-tree node click (open file), the recent-files click handler, and `refreshTree` all now `try/catch` their IPC calls. Errors surface as toasts rather than unhandled promise rejections.
- **🛠️ ZenOrchestrator Fire-and-Forget Safety:** Both `window.api.music.generate` call sites (Focus-mode kickoff, Pomodoro-end upbeat switch) now go through `Promise.resolve(...).catch(() => {})`, preventing Lyria rejections from polluting the console during a focus session.
- **AI Chat Memory Leak:** AIChat now tracks streaming chunk listeners in a ref and tears down the prior subscription on unmount and on each new send, preventing accumulated `onChunk` handlers during long sessions.
- **Monaco Save-Path Accuracy:** Save command now reads `activeFile` from the file store at call time (instead of the closed-over React value) and splits paths with `/[\\/]/`, correctly handling Windows paths and rapid tab switches during save.
- **Git Dashboard Effect Fix:** Resolved a `react-hooks/set-state-in-effect` lint error in `GitDashboard.tsx` by dispatching `loadGitState()` through `setTimeout` / `setInterval` callbacks instead of invoking it synchronously inside the effect body.
- **OAuth Setup Guide, AI Providers, Music, Git, and Handlers:** Assorted reliability touch-ups across `setupGuide`, Anthropic/OpenAI/Ollama providers, `aiHandler`, `lyriaHandler`, `gitHandler`, `storeHandler`, `fsHandler`, and `security` — tightened trusted-sender checks, cleaned up tool-call plumbing, and synced preload type definitions with the terminal export IPC surface.

### 🔧 Follow-Up Hardening Pass

Additional audit-driven fixes layered on top of the items above. Only new work — nothing previously listed has been re-issued.

- **🔐 PTY cwd Containment (HIGH):** `terminal:create` previously accepted any renderer-supplied `cwd` and passed it straight to `node-pty`, allowing a compromised renderer to spawn shells in arbitrary directories. The handler now resolves `cwd` through `resolvePathWithinRoot(getCurrentWorkspacePath(), cwd, true)`; out-of-workspace paths are silently rejected and the spawn falls back to the workspace root (or `HOME`/`USERPROFILE`/`process.cwd()` when no workspace is set).
- **🔐 Dead `ping` IPC Handler Removed:** The previously guarded debug `ipcMain.on('ping', ...)` channel had no renderer caller and has now been deleted outright, along with its `ipcMain` and `isTrustedIpcSender` imports in `src/main/index.ts`. Smaller IPC surface, fewer unused symbols.
- **🔐 Renderer Console Pipe Gated to Dev:** The `webContents.on('console-message', ...)` bridge that mirrored renderer logs into the main-process console is now wrapped in `if (is.dev)`, so production builds no longer leak renderer log content (which can include user data) into stdout.
- **🛡️ Lyria Save-Dialog Filename Sanitization:** `lyria:save` previously fed a renderer-supplied `suggestedName` straight into `dialog.showSaveDialog`'s `defaultPath`. The handler now strips path separators, collapses traversal (`..`), removes ASCII control characters and Windows-illegal `<>:"|?*`, trims, and caps the name at 120 chars before the dialog is shown. A malicious renderer can no longer prefill the Save dialog with `../foo` or `C:\Windows\foo`.
- **🐛 `fs:replaceInFiles` Surfaces Per-File Failures:** The bulk replace IPC used to swallow individual write errors and report only a count. It now returns `{ ok, count, failures: Array<{path, error}> }` so the renderer can show which files failed (for example, EACCES on read-only files). `ok` is `false` if any single file failed. Preload typings (`src/preload/index.ts` and `src/preload/index.d.ts`) updated to match.
- **🐛 `fs:setWorkspace` Async Stat:** Replaced the in-handler `fs.statSync` with `await fs.promises.stat`, removing the only remaining sync filesystem call from a workspace-switch IPC path. Long-running workspace selections no longer block the main process event loop.
- **🐛 Removed Redundant `fs:stopWatcher` IPC:** The file watcher exposed both `fs:watchWorkspace(null)` and a separate `fs:stopWatcher` channel that did the same thing. The duplicate handler has been removed; `fs:watchWorkspace(null)` is now the single canonical stop path. `tests/main/fileWatcher.test.ts` was updated accordingly.
- **🧹 `aiHandler` `catch (e: any)` → `unknown`:** Two `catch` blocks in `src/main/ai/aiHandler.ts` (the tool-call error path and the `ai:generateTest` error path) previously typed the caught value as `any`. Both now use `catch (e: unknown)` with `e instanceof Error ? e.message : String(e)` narrowing, matching the rest of the IPC layer and satisfying `@typescript-eslint/no-explicit-any`.
- **🧹 `WeatherTimeWidget` Typed Icon Map:** The `WMO_CODES` lookup table used `Record<number, { text: string; icon: any }>`. Replaced `any` with the `LucideIcon` type imported from `lucide-react`, restoring strict typing on the weather-icon map.
- **🧹 `activityParser` ESLint Disable Tightened:** The `no-control-regex` block-disable around the ANSI regex was replaced with a single line-level `// eslint-disable-next-line no-control-regex` directly above the regex literal, matching the project's existing style for unavoidable control-character patterns.

### 🧪 New Test Coverage — Trust Boundary

- **`tests/main/security.test.ts` (NEW, 18 tests):** Direct unit coverage for the IPC trust boundary — `isTrustedIpcSender` (null/undefined sender, missing `senderFrame`, `file:` scheme, allowed loopback origin, evil HTTP origin, malformed URL, `senderFrame.url` precedence over `sender.getURL()`), `canonicalizePath` (real path for an existing dir, resolved path for a non-existent path), `isPathInsideRoot` (identical, child, parent, sibling), and `resolvePathWithinRoot` (existing child file, `..` escape, missing path with `allowMissing=false`, missing path with `allowMissing=true`, missing path that escapes root even with `allowMissing`). Uses `fs.mkdtempSync` against `os.tmpdir()` so the tests are platform-portable and self-cleaning.

### ✅ Test & Lint Health

- **Test Suite:** 190 tests across 23 files — all green (was 172 / 22). The new `tests/main/security.test.ts` adds 18 tests; the file watcher suite lost two assertions tied to the deleted `fs:stopWatcher` channel.
- **Type Checks:** `npm run typecheck:node` and `npm run typecheck:web` both clean.
- **Lint:** `npm run lint` zero errors, zero warnings — including the pre-existing `GitDashboard.tsx:72` `react-hooks/set-state-in-effect` warning resolved this release.

### 🎨 Theme System Overhaul

A ground-up rebuild of the theming pipeline so every surface — UI chrome, Monaco editor, xterm terminal — reads from a single source of truth and updates live when the user picks a preset, edits a custom color, or toggles light/dark base.

- **Expanded `ThemeColors` Token Contract (28 tokens, was 9):** `useThemeStore.ts` now exposes seven surface layers (`surface0`–`surface6`), three accent variants (`accentDim` / `accent` / `accentBright`), a sage secondary pair, four-tier text hierarchy (`textPrimary` → `textMuted`), three border opacity tiers (`borderSubtle` / `borderDefault` / `borderHover`), four editor-specific tokens (`editorBg`, `editorLineHighlight`, `editorLineNumber`, `editorIndentGuide`), four xterm tokens (`terminalBg`, `terminalFg`, `terminalCursor`, `terminalSelection`), plus a `buttonText` token used to invert the on-amber CTA text in light mode. `applyTheme(colors, mode)` now writes 21 CSS custom properties on `document.documentElement` and derives `--color-accent-glow` / `--color-accent-glow-strong` / `--color-border-accent` (and the secondary equivalents) at runtime via a `hexToRgb` helper, so accent-tinted overlays follow the active theme without requiring extra props.
- **Light Mode + 3 New Light Presets:** Added a `ThemeMode = 'dark' | 'light'` flag and three light presets — **Paper** (warm cream + amber accent), **Snow** (pure white + blue accent), **Sand** (sand cream + orange accent). `applyTheme` writes `data-theme="light"` on the document root for any future selectors that need to fork on mode. Light presets ship with inverted text contrast (`#1a1a1a` primary), light-tinted borders (`rgba(0,0,0,0.06–0.18)`), and matching editor / terminal palettes (e.g. white editor background, dark cursor).
- **Subscription-Reactive Theme Apply (App.tsx):** `App.tsx` now subscribes to `activePreset`, `customColors`, and `customMode` via zustand selectors and re-runs `applyTheme(getActiveColors(), getActiveMode())` whenever any of them change. Previously, switching presets only updated the in-memory store and required a hard reload before the CSS variables were rewritten.
- **Single Shared Monaco Theme (`useEditorTheme` hook):** New `src/renderer/src/lib/useEditorTheme.ts` exports a single `'zen-editor'` theme name and a `useEditorTheme(monaco)` hook that subscribes to the theme store and re-defines the Monaco theme whenever `activePreset` / `customColors` / `customMode` changes. The hook flips Monaco's `base` between `'vs'` (light) and `'vs-dark'` (dark) and wires editor background, foreground, line highlight, line number, indent guide, suggest widget, and editor widget colors to the active palette. `MonacoEditor.tsx`, `SplitEditor.tsx`, and `GitDiffEditor.tsx` were updated to consume `editorThemeName` from the hook instead of each defining their own (`'modern-dark'` / `'zen-dark'`) Monaco theme — three sources of truth collapsed into one.
- **Reactive Xterm Palette (`TerminalInstance.tsx`):** The terminal constructor now reads `terminalBg/Fg/Cursor/Selection` from `useThemeStore.getState().getActiveColors()` instead of hard-coded `#000000` / `#d4d4d8`, and a new effect subscribed to `activePreset` + `customColors` mutates `term.options.theme` whenever the user changes themes — so xterm follows light/dark and accent shifts without recreating the PTY.
- **CSS Variable Cleanup (`assets/main.css`):** Replaced hard-coded `text-zinc-400` body text and hex-pinned scrollbar / slider thumb colors with the new tokens (`--color-text-tertiary`, `--color-border-default/hover`, `--color-text-primary`, `--color-surface-2`). `.btn-primary` and `.btn-secondary` now use `var(--color-button-text)` so on-amber and on-sage CTAs invert correctly under light themes.
- **Custom Color Picker UI (`SettingsOverlay.tsx`):** The Theme section was rebuilt around two preset grids (Dark Themes / Light Themes) plus a new **Custom Colors** panel with eight `<input type="color">` pickers (accent, accent bright, secondary, three surface tints, primary text, secondary text), a **Dark base / Light base** toggle for the custom theme's mode, and a **Reset** button that restores the Default preset and Dark mode in one click. Editing any color auto-switches `activePreset` to `'custom'` and persists immediately — no Save button needed.
- **Persisted Store Migration (`version: 2`):** The theme store now declares `version: 2` with a `migrate(persisted, version)` callback that upgrades v1 payloads (which only carried the original 9 fields) by merging stored colors over the full default palette via a `mergeWithDefault` helper. v1 users keep their custom accent on first launch and inherit defaults for the new fields without a wipe.

### 🛠️ Editor Customization

Settings → Editor now goes beyond font size and word wrap. Six new knobs let users dial in their preferred typography, cursor, and chrome.

- **Font Family Selector:** Pick from eight curated monospace families (JetBrains Mono, Fira Code, Cascadia Code, Source Code Pro, Consolas, Menlo, Monaco, Courier New). Each editor instance composes the selection with a sensible fallback stack (`'<chosen>', 'JetBrains Mono', 'Fira Code', Consolas, monospace`) so unknown families fall back gracefully.
- **Line Height Slider:** Drag from 14 px to 40 px to control vertical density. Default is 22 px. Setter clamps the value so out-of-band imports never produce a broken editor.
- **Cursor Style Picker:** Choose between Line, Line Thin, Block, Block Outline, and Underline cursors. Wired through Monaco's `cursorStyle` option in `MonacoEditor` and `SplitEditor`.
- **Render Whitespace Mode:** Pick None / Boundary / Selection / All — applied as Monaco's `renderWhitespace` option across `MonacoEditor`, `SplitEditor`, and `GitDiffEditor`.
- **Minimap Toggle:** Show or hide the right-side overview map. Default off.
- **Font Ligatures Toggle:** Enable or disable combined glyphs (`=>`, `!==`, `-->`). Default on for ligature-friendly fonts, but instantly switchable for users who prefer plain glyphs.

All six values live in `useSettingsStore.ts` (`editorFontFamily`, `editorLineHeight`, `editorCursorStyle`, `editorMinimapEnabled`, `editorLigaturesEnabled`, `editorRenderWhitespace`), are persisted via the existing `partialize` block, and feed `MonacoEditor`, `SplitEditor`, and `GitDiffEditor` through normal store reads — no prop drilling. New `EditorFontFamily` / `EditorCursorStyle` types and an `EDITOR_FONT_FAMILIES` array are exported for any future selector reuse.

### ✅ Theme & Editor Verification

- **Type Checks:** `npm run typecheck:node` and `npm run typecheck:web` both clean across the new `useThemeStore` shape, the `useEditorTheme` hook, the expanded `useSettingsStore`, and every editor component.
- **Tests:** `npm test` — 190 / 190 tests across 23 files green. Theme work touches no test fixtures, and existing settings-store tests continued to pass against the new fields (additive change, defaults supplied).
- **Lint:** `npm run lint` zero errors, zero warnings after Prettier auto-fix on the SettingsOverlay panel.

## ✨ What's New in v1.1.5

### 🚀 Features & Enhancements

- **Theme Customization:** Added 5 built-in color presets (Default, Midnight, Forest, Ocean, Sunset) with live preview swatches in Settings. Theme persists across sessions and applies on app startup.
- **Split Editor View:** Work on two files simultaneously with horizontal or vertical split layouts. Each pane has independent file tabs and scroll position.
- **Recent Files Panel:** Quick access to your 20 most recently opened files in the Explorer sidebar, sorted by last access time.
- **File Bookmarks:** Pin important code locations with optional labels. Navigate instantly to bookmarked lines from the dedicated Bookmarks panel.
- **Search & Replace Across Files:** Full-text search with context preview and batch replace functionality. Supports case-sensitive matching and shows surrounding lines for each match.
- **Git Stash Management:** Save, list, apply, pop, and drop stashes directly from the Git Dashboard UI without touching the terminal.
- **Customizable Keyboard Shortcuts:** Rebind editor and app shortcuts to your preferences via the new Keybindings panel in Settings.

### 🐛 Bug Fixes & Performance

- **EISDIR Fix:** Prevented crash when accidentally reading a directory path as a file in the file system handler.
- **File Tree Performance:** Optimized rendering in ProjectList and Sidebar components by removing unnecessary React state and motion wrappers, reducing re-renders on hover.

## ✨ What's New in v1.1.4

### 🚀 Features & Enhancements

- **Agent Orchestrator Dashboard:** Added a dedicated multi-agent control surface with node selection, broadcast commands, per-node activity summaries, and real-time cost visibility.
- **Focus Analytics Dashboard:** Added a new focus analytics view with streak tracking, focus score, WPM telemetry, weekly coding activity, and file-touch summaries.
- **Task Tracker:** Added a workspace task scanner for `TODO`, `FIXME`, and `HACK` comments so you can review them quickly, open them in the editor, or send them directly to AI chat.
- **Snippet Library:** Added built-in and custom code snippets with placeholder prompts, quick insertion into the editor, and AI-generated snippet support.
- **AI Code Review Panel:** Added an AI-assisted code review panel in the Git diff workflow with structured findings, severity levels, Monaco highlights, and one-click suggestion apply for working tree diffs.
- **Gemini Setup Guide & OAuth Flow:** Added an in-app Gemini setup guide, safer OAuth credential handling, quota project derivation, and improved sign-in flows for Gemini and Lyria usage.
- **Expanded Provider Support Cleanup:** Removed the legacy Antigravity provider and consolidated the active AI provider lineup around Gemini, OpenAI, Anthropic, Groq, and Ollama.

### 🛡️ Security & Reliability

- **Trusted IPC Guardrails:** Hardened main-process IPC handlers so file system, terminal, AI, OAuth, Git, watcher, and secure-store actions reject untrusted renderer senders.
- **Safer Workspace Path Handling:** Tightened path resolution for AI tools, file system actions, file watching, and AI-generated test output so operations stay inside the active workspace.
- **Secure Credential Storage:** Expanded encrypted credential storage and cleanup flows for Gemini OAuth, Google OAuth secrets, and music generation keys.
- **Safer External Link Handling:** Restricted external URL opening to public `http(s)` destinations and blocked unsafe private/local targets.
- **Provider Safety Improvements:** Added stronger Gemini OAuth error guidance, better rate-limit messaging, and capped tool-call loops in AI chat to prevent runaway tool execution.

### 🐛 Bug Fixes & Platform Improvements

- **Orchestrator Stability:** Fixed flaky multi-node broadcast behavior by waiting for PTY readiness before writes and by surfacing immediate command dispatch events in the activity feed.
- **Windows Terminal Logging:** Fixed missing or delayed logs on Windows by handling carriage-return-only terminal output correctly and normalizing terminal input writes to use Windows-friendly `\r`.
- **Terminal View Persistence:** Prevented orchestrator-related PTY shutdowns by keeping the terminal surface mounted when switching views.
- **Activity Parsing:** Improved ANSI stripping, Windows path detection, paused/working status parsing, and command event rendering in the activity feed.
- **OAuth Refresh & Migration:** Improved Google OAuth token refresh, migrated older stored tokens safely, and cleared legacy credentials that no longer match the new flow.
- **Git, Settings, Chat, and Editor Polish:** Refined cross-feature wiring across Git dashboard, AI chat, Monaco editor, settings, prompt flows, and status surfaces for the new dashboards and credential model.
- **Warning Cleanup:** Removed the full batch of local ESLint/Prettier warnings introduced by the release work, including the final React hooks dependency warning in Task Tracker, so `npm run lint` is clean again.
- **CI Annotation Cleanup:** Upgraded GitHub Actions workflow dependencies to Node 24-compatible versions and replaced the deprecated release action path, eliminating the Actions runtime deprecation warnings shown in the release annotations.
- **Release Verification:** Added more provider tests, AI handler safeguards, orchestrator coverage, and updated CI so automated tests now run before packaging.

## ✨ What's New in v1.1.3

### 🚀 Features & Enhancements

- **AI Music Generator (Lyria):** Create customized ambient tracks for your coding sessions directly in the app. Integrated new `MusicGenerator` and `lyriaHandler` for seamless Google DeepMind Lyria support.
- **Antigravity AI Provider:** Added a new AI provider (Antigravity) to expand your options for intelligent coding assistance.
- **Improved Gemini AI Provider:** Updates and enhancements to the Gemini provider for better performance and response quality.

### 🐛 Bug Fixes & Stability

- **UI & Layout Fixes:** Resolved various layout and rendering issues across `WelcomeScreen`, `AIChat`, `GitDashboard`, and `TerminalInstance`.
- **Performance Improvements:** General performance improvements and code cleanups for a more responsive development environment.

## ✨ What's New in v1.1.2

### 🚀 Features & Enhancements

- **AI Auto-Commit & Git Dashboard:** A complete, built-in Source Control tab. View staged/unstaged changes, stage individual files, and generate highly concise conventional commit messages using your configured AI provider with a single click.
- **Side-by-Side Git Diff Editor:** Added a professional, Monaco-powered side-by-side diff viewer. Click on any changed file in the Git Dashboard to instantly see a color-coded, syntax-highlighted comparison before committing.
- **3D Audio Visualizer:** The Vibe Player now features an organic, real-time 3D sound wave visualizer built with Three.js, adding an immersive touch to your lo-fi coding sessions.
- **"Vortex Tunnel" Welcome Screen:** The Welcome Screen has been completely redesigned with a deeper dark theme aesthetic and a mesmerizing, infinite 3D "Vortex Tunnel" background to help you get into the Zen focus zone.
- **Refined Activity Feed:** Cleaned up the empty state design of the Agent Activity Feed for a more minimalist and professional look.

### 🐛 Bug Fixes & Stability

- **Gemini OAuth Authentication:** Fixed the `400 client_secret is missing` and `403 restricted_client` errors when signing in with Gemini OAuth. It now securely routes directly to the public Generative Language API with correct scopes.
- **Quota Exhaustion Handling:** Improved error handling for 429 Quota limits when using the free Google Cloud Code proxy, providing actionable advice to use personal API keys.
- **Diff Editor Crash:** Resolved a critical crash (`TextModel got disposed before DiffEditorWidget model got reset`) that occurred when unmounting the Monaco Editor during loading states.
- **Deprecation Warnings:** Migrated file system operations to `fs-extra` to resolve `fs.Stats` deprecation warnings on newer Node.js versions.
