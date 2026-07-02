# AGENTS.md — GLACIER

## Project

Electron + React (Vite/TS) desktop app for orchestrating bioinformatics workflows (Nextflow, Docker, Snakemake). Dual-mode: runs as Electron app or web server.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run build` | `npm run build:backend` → `npm run build:frontend` → `npm run build:bundle` |
| `npm run build:backend` | `tsc` (compiles `src/main/` + `src/preload/` to `dist/main/`) |
| `npm run build:frontend` | `vite build` (compiles `src/renderer/` to `dist/renderer/`) |
| `npm run build:bundle` | `node scripts/prepare_bundle.js` (on macOS/Linux: JRE + Nextflow; on Windows: calls `build-wsl-image.js` to build a pre-configured WSL image with Docker+Java+Nextflow) |
| `npm run build:wsl` | `node scripts/build-wsl-image.js` (Windows only; builds WSL image directly without manifest or JRE) |
| `npm start` | `npm run build && electron .` |
| `npm test` | `vitest run --coverage` (two projects: backend + frontend) |
| `npm run lint` | `eslint .` (flat config) |
| `npm run format` | `prettier --write src/ tests/ scripts/` |
| `npm run dist` | Build + package with electron-builder |
| `npm run server` | Build → `npm install` inside `api-server/` → start Express on port 3030 |
| `npx playwright test` | E2E tests under `tests/e2e/` (run after `npm run build`) |
| `GLACIER_MANIFEST=artic-network npm run dist` | Build with a pre-configured manifest from `build-configs/` |

## Architecture

- **`src/main/`** — Electron main process (compiled by `tsc` to `dist/main/`); `tsconfig.json` only covers this + preload
- **`src/renderer/`** — React frontend (compiled by Vite to `dist/renderer/`); uses `@/` alias for `src/renderer/`. Two Vite entry points: `index.html` and `loading.html`
- **`src/runners/`** — Nextflow (`nextflow.ts`, `nf-parse.ts`, `environment.ts`) and Docker runners
- **`src/types/`** — Shared TS types (`types.ts`, `environment.ts`, `settings.ts`, `shard.ts`) used by both main and renderer
- **`src/locales/`** — i18n translations (English, French)
- **`api-server/index.js`** — Express server that imports `dist/main/collection.js` + `dist/main/repo.js`; serves built frontend statically. Reuses the same compiled backend code as Electron
- **`src/renderer/services/api.ts`** — API abstraction: routes calls to Electron IPC (`window.electronAPI`) or HTTP (`/api/...`). Both paths must be kept in sync
- **`src/renderer/services/showFileBrowser.tsx`** — Fallback file-browser dialog for web mode (used when no Electron IPC available)
- **`src/main/collection.ts`** — Singleton `Collection` managing catalogues, workflows, instances; all backend logic goes through it
- **`src/main/preload.ts`** — Must use CommonJS (`require`); bridges IPC calls to renderer

## Testing

- **Vitest** (unit): two project contexts — `backend` (node env, `tests/unit/**/*.test.js`) and `frontend` (jsdom env, `tests/unit/frontend/**/*.test.{js,ts,tsx}`). Run targeted: `npx vitest --project backend`. Backend setup (`tests/unit/backend/setup.js`) mocks `electron` + `electron-store`; frontend setup (`tests/setup.js`) mocks `react-i18next` / `i18next`. Docker tests need Docker running.
- **Playwright** (E2E): `workers: 1`, sequential. Custom fixture in `tests/e2e/fixtures.ts` handles both Electron launch and web `page.goto('/')`, dismisses startup dialog. Projects: `Web (chromium)`, `Web (firefox)`, `Web (webkit)`, conditionally `Electron`. Web server auto-starts on `http://localhost:3030` via Playwright config. Test data in `tests/test-data/`. Run after `npm run build`.
- **CI**: `GLACIER.yml` orchestrates `unit.yml` (ubuntu) → `e2e.yml` (ubuntu) → `e2e_wsl.yml` (windows-latest). E2E requires Java 21 (Temurin), Nextflow, Xvfb (Linux). WSL CI uses `scripts/wsl-setup.ps1`.

## Build & deploy quirks

- `scripts/prepare_bundle.js` downloads Nextflow jar (`26.04.4`), runs `jdeps`/`jlink` to create minimal JRE (macOS/Linux); on Windows calls `scripts/build-wsl-image.js` to build a pre-configured WSL image (`bundle/wsl/glacier-wsl.tar`) with Docker, Java 17, Nextflow. Auto-downloads Temurin JDK to `.temurin/` on first run if not detected
- `GLACIER_MANIFEST` env var copies a JSON from `build-configs/` to `bundle/manifest.json` — pre-loads catalogues on first run. `build-configs/default-theme.json` provides MUI theme overrides
- Release builds (`v*` tag) run on macOS, Windows, Ubuntu. macOS: decompress `nextflow.jar`, sign internal native libs (`codesign`), repackage. Windows: NSIS installer. Linux: AppImage
- `scripts/after-pack.cjs` runs post-package via electron-builder
- `bundle/` is gitignored; created by the build step

## Code style

- ESLint flat config (`eslint.config.js`), Prettier (`singleQuote`, no trailing commas, printWidth 100)
- Unused imports warn via `eslint-plugin-unused-imports`
- Backend files `src/main/` and `src/preload/`: Node globals (`process`, `__dirname`, `require`)

## Operational gotchas

- Single-instance lock (`app.requestSingleInstanceLock()`) prevents multiple Electron windows
- Graceful crash handler kills all child processes + Docker containers before `process.exit(1)`
- All API responses wrapped in `{ ok: boolean, data?: any, error?: { message: string } }` envelope
- WSL config handlers (`write-wslconfig`, `check-wsl-config`, `restart-wsl`) are no-ops on non-Windows
