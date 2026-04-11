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
