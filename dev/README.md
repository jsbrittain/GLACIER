# Prerequisites

The build requires a **Temurin JDK** (OpenJDK's jlink uses incompatible flags). If a system Temurin is not detected, `scripts/prepare_bundle.js` will automatically download Temurin to `.temurin/` in the repo root on first run and reuse the cached copy thereafter. CI workflows use `actions/setup-java` directly and are unaffected.

# Build variants

The `scripts/prepare_bundle.js` script looks for an environment variable `GLACIER_MANIFEST` in order to determine which manifest file from `build-configs/` to use for the build. For instance, `GLACIER_MANIFEST=artic-network npm run dist` will include the `artic-network.json` manifest file. If unspecified, no default manifest is included.

# Testing

Run `npm test` to execute the unit test suite, which also produces coverage reports.

End-to-end tests are managed by playwright, run `npx playwright test` to execute them. This will test both the electron build and the client-server build. You can run playwright in UI mode by appending the `--ui` flag.

# Making a release

Update the version number in `package.json` and tag the commit, e.g. `git tag v1.0.0`. Then, push the tag, e.g. `git push origin v1.0.0`. The CI workflow will automatically build and publish the release (as a draft) to GitHub.

# Adding backend functionality

Since GLACIER supports both an electron build (where the backend runs in the same process as the frontend) and a client-server build (where the backend runs in a separate server), backend functionality is abstracted through an API layer. Calls from the frontend to the backend are made through either 1) electron's Inter-Process Communication (IPC) mechanism, or 2) an HTTP server request. To add new functionality that can be called from the frontend, you need to do the following:

- Expose an API endpoint in `src/renderer/services/api.ts`. This file redirects requests to either an electron backend (if defined during the build), or produces HTTP requests to a backend server.
- For electron, define the context bridge in `src/electron/preload.ts`. This invokes an IPC call to the main process.
- Define the IPC handler in `src/electron/ipc-handler.ts`. This is where the backend logic can be implemented, but is generally instead used to call the relevant service.
- Most services are defined in a (singleton) `Collection` object (`src/main/collection.ts`), which manages the lifecycle of workflows. You can add a new services here as needed.
- For HTTP, define the service endpoint in `api-server/index.js`, which should call the same service as the IPC handler by invoking the relevant method in the `Collection` object.

# Upgrading Nextflow

The bundled Nextflow version is defined in `scripts/nextflow-version.json`. It is the single source of truth for the jar download, the WSL image and the release checker.

A weekly workflow (`.github/workflows/nextflow-release-check.yml`) checks the nextflow-io/nextflow releases every Monday and opens an issue when a newer stable release or stable patch is available. Only the April (`04`) and October (`10`) release lines are considered; edge (`-edge`), draft and prerelease builds are ignored. The issue suggests a GLACIER version bump: a patch for a same-line Nextflow patch, a minor bump for a new stable line.

To apply an update manually:

1. **Set the version** — run `node scripts/set-nextflow-version.js <version>` (for example `26.10.6`). This updates `scripts/nextflow-version.json`; the jar and launcher URLs are derived from it.

2. **Build and verify** —
   - macOS/Linux: `npm run build` (or `npm run build:bundle`) downloads `nextflow-<version>-one.jar` and builds the minimal JRE, then asserts that the bundled Nextflow reports the pinned version. The build also fails if the jar targets a Java version newer than the bundled Java 21.
   - Windows: `node scripts/build-wsl-image.js` rebuilds `bundle/wsl/glacier-wsl.tar` and asserts the version inside the image. It also runs automatically as part of `npm run build` on Windows.
   - Version markers (`bundle/.nextflow-version` and `bundle/wsl/.nextflow-version`) ensure a version change refreshes stale local artifacts.

3. **Update the license** — diff the Nextflow license and update it if it changed:

   ```
   curl -fsSL https://raw.githubusercontent.com/nextflow-io/nextflow/v<version>/COPYING | diff - bundle/LICENSE-nextflow
   ```

4. **Run tests** — `npm test` and `npx playwright test`. Pay particular attention to `nextflow.log` parsing, which relies on output that is not a documented Nextflow API and may change between releases.

5. **Bump GLACIER** — use a patch bump for a same-line Nextflow patch and a minor bump for a new stable line, then tag and release as usual.

GLACIER bundles Temurin 21. Nextflow 26.x and 27.04 target Java 17, which is within Nextflow's supported range. If a build reports that Nextflow now requires a newer Java version, bump `JAVA_VERSION` in `scripts/prepare_bundle.js`, the OpenJDK package in `scripts/build-wsl-image.js`, and `setup-java` in the CI and release workflows together.

# Adding languages

GLACIER uses i8n for language support. To add a new language, you need to do the following:

- Add the translation file in `src/locale/`
- Register the new language in `src/renderer/i18n.js`
- Add the language to the locale map (used by date-fns) in `src/locale/index.ts`
