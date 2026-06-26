# AGENTS.md — GLACIER

## Project

Electron + React (Vite/TS) desktop app for orchestrating bioinformatics workflows (Nextflow, Docker, Snakemake). Dual-mode: runs as Electron app or web server.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run build` | `tsc` (backend) → `vite build` (frontend) → `node scripts/prepare_bundle.js` (JRE+Nextflow) |
| `npm start` | `npm run build && electron .` |
| `npm test` | `vitest run --coverage` (unit tests under `tests/unit/`) |
| `npm run lint` | `eslint .` (flat config) |
| `npm run format` | `prettier --write .` |
| `npm run dist` | Build + package with electron-builder |
| `npm run server` | Build + start Express API server on port 3030 |
| `npx playwright test` | E2E tests under `tests/e2e/` |
| `GLACIER_MANIFEST=artic-network npm run dist` | Build with a pre-configured manifest from `build-configs/` |

## Architecture

- **`src/main/`** — Electron main process (compiled by `tsc` to `dist/main/`); `tsconfig.json` only covers this + preload
- **`src/renderer/`** — React frontend (compiled by Vite to `dist/renderer/`); uses `@/` alias for `src/renderer/`
- **`src/runners/`** — Nextflow (`nextflow.ts`, `nf-parse.ts`, `environment.ts`) and Docker runners
- **`api-server/index.js`** — Express server that imports `dist/main/collection.js`; serves built frontend statically
- **`src/renderer/services/api.ts`** — API abstraction: routes calls to Electron IPC (`window.electronAPI`) or HTTP (`/api/...`)
- **`src/main/collection.ts`** — Singleton `Collection` managing catalogues, workflows, instances; all backend logic goes through it
- **`src/main/preload.ts`** — Must use CommonJS (`require`); bridges IPC calls to renderer

## Testing quirks

- E2E (Playwright): `workers: 1`, sequential only. Web server on `http://localhost:3030`. Tests both Electron + web modes. Run after `npm run build`.
- Unit (Vitest): node environment. Docker tests need Docker running.
- CI runs: unit → e2e (Linux) → e2e (Windows WSL). E2E requires Java, Nextflow, and Xvfb (Linux).

## Build & deploy quirks

- `scripts/prepare_bundle.js` downloads Nextflow jar, runs `jdeps`/`jlink` to create minimal JRE; skipped on Windows
- `GLACIER_MANIFEST` env var copies a JSON from `build-configs/` to `bundle/manifest.json` — pre-loads catalogues on first run
- Release builds (`v*` tag) sign macOS bundles, repackage Nextflow jar with signed native libs

## Code style

- ESLint flat config (`eslint.config.js`), Prettier (`singleQuote`, no trailing commas, printWidth 100)
- Unused imports warn via `eslint-plugin-unused-imports`
- React: `react/react-in-jsx-scope` off (automatic JSX transform)
- Backend files `src/main/` and `src/preload/`: Node globals (`process`, `__dirname`, `require`)
- `git add` before `git commit` if creating files (they may appear as untracked)
