# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Communication

- Respond to user prompts in Chinese unless the user asks otherwise.
- Keep code, identifiers, comments, package metadata, and commit messages in English.
- Prefer dense technical answers. Avoid broad explanations unless the user asks for them.
- Use repository tools directly for edits and verification instead of asking the user to copy code.

## Repository Layout

- `Amber/amber-engine/` - Python FastAPI backend.
  - `main.py` starts the backend application.
  - `database.py`, `schemas.py`, `deps.py`, `state.py`, and `ws_manager.py` hold shared backend infrastructure.
  - `routers/`, `services/`, and `repositories/` contain the modularized API, domain logic, and data access code.
- `Amber/main_ui/` - Next.js 16 + Electron 36 desktop app.
  - `app/page.tsx` is the main client-side UI orchestrator.
  - `components/amber/` contains domain UI components.
  - `components/ui/` contains shadcn/Radix primitives.
  - `electron-main.js` launches the desktop shell and backend in packaged mode.
  - `preload.js` exposes Electron IPC helpers.
- The top-level `Amber Digital Life UI` directory with the Chinese name - Vite + React + Capacitor/Electron UI variant.
  - `src/` contains React app code, API clients, pages, stores, and UI components.
  - `capacitor.config.ts`, `android/`, and `ios/` support mobile builds.
- `docs/` and `Readme/` contain project documentation.
- `launch.py` and the local Amber startup PowerShell/batch scripts are launch helpers.

## Working Tree Safety

- The worktree may contain user changes. Do not revert or overwrite unrelated changes.
- Before editing a file that is already modified, inspect it and work with the existing changes.
- Avoid destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- The install or checkout path should avoid Chinese characters when running the packaged Electron/PyInstaller app; paths with Chinese characters may break Windows packaging/runtime behavior.

## Collaboration Log

- Before starting any concrete work, read `用户需求.md` to understand the current product requirements, acceptance criteria, and frontend/backend expectations.
- Before starting any concrete work, read `working.md` and claim the task there.
- `working.md` is the active conflict-avoidance board. It records who is currently editing which files or modules.
- Do not edit files or modules already claimed by Claude Code or another agent unless the user explicitly asks you to coordinate on the same area.
- When the task is complete, move the claim in `working.md` to the recent-done area or clear it.
- `work.md` is the shared handoff log for Claude Code and Codex.
- After completing any concrete work, append a concise entry to `work.md`.
- Each entry must state what was completed, what remains or is blocked, and the next recommended process.
- If backend API contracts change, update the API contract section in `work.md` in the same work session.
- If a requirement status, acceptance criteria, or implementation scope changes, update `用户需求.md` in the same work session.
- Keep the log body in Chinese. Keep code names, variable names, commands, and commit messages in English.

## Backend Commands

From `Amber/amber-engine/`:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

The backend listens on port `8000`.

## Next.js Desktop UI Commands

Node.js v22 is required for Electron 36. A portable install may exist at `%USERPROFILE%\node22\node-v22.16.0-win-x64`.

From the repository root:

```powershell
$env:PATH = "$env:USERPROFILE\node22\node-v22.16.0-win-x64;$env:PATH"
```

Run the three desktop components in separate terminals:

```powershell
cd Amber/amber-engine
python main.py
```

```powershell
cd Amber/main_ui
npm run dev
```

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$electron = "Amber\main_ui\node_modules\electron\dist\electron.exe"
Set-Location "Amber\main_ui"
& $electron .
```

Do not use `npm run electron:dev` from Codex shells. `ELECTRON_RUN_AS_NODE` may be inherited and can prevent Chromium/Electron APIs from initializing.

## Vite UI Commands

From the top-level Vite UI directory with the Chinese name:

```powershell
npm run dev
npm run build
npm run lint
```

The Vite app uses React, TypeScript, Tailwind, Radix/shadcn-style primitives, Zustand, React Router, Capacitor, and Electron.

## Packaging

Production packaging for the Next.js desktop app:

```powershell
cd Amber/amber-engine
pyinstaller --onedir --name amber_core main.py
```

```powershell
cd Amber/main_ui
npm run build
npm run dist
```

`electron-builder` expects `Amber/amber-engine/dist/amber_core/` and bundles it as an extra resource.

## Architecture Notes

- The frontend talks to `http://127.0.0.1:8000`.
- The backend stores runtime data in SQLite under `Amber/amber-engine/data/`.
- Chat flow includes message persistence, memory recall, dynamic persona/emotion prompt construction, LLM response handling, mood JSON parsing, emotion updates, and reply persistence.
- The Janitor background task handles emotion annealing, memory incubation, and corpus pruning.
- QQ relay functionality is backend-owned and depends on per-persona credentials.

## Verification

- For backend changes, prefer targeted Python checks or starting `python main.py` when practical.
- For `Amber/main_ui` changes, run `npm run lint` or `npm run build` depending on risk.
- For changes in the top-level Vite UI directory with the Chinese name, run `npm run lint` or `npm run build` depending on risk.
- If a command fails, inspect stderr, fix actionable issues, and retry before handing the problem back.
