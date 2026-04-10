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
