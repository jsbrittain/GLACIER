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

When upgrading the bundled Nextflow version, follow these steps:

1. **Update the download URL** — Change `NXF_URL` in `scripts/prepare_bundle.js` (line 27) to point to the new release JAR. The URL pattern is:
   ```
   https://www.nextflow.io/releases/v<version>/nextflow-<version>-one.jar
   ```

2. **Update the license file** — Verify whether Nextflow's license has changed (`bundle/LICENSE-nextflow`). If it has, replace the file with the updated version from the Nextflow source distribution.

3. **Check JRE compatibility** — Read the Nextflow release notes to confirm the minimum Java version. If it has changed, update `JAVA_VERSION` in `scripts/prepare_bundle.js` accordingly. After the build, verify the bundled JRE:
   ```
   java -version
   ```

4. **Run tests** to verify — particularly check that log parsing still works (it relies on `nextflow.log` output, which is not a documented API and may change between releases).

# Adding languages

GLACIER uses i8n for language support. To add a new language, you need to do the following:

- Add the translation file in `src/locale/`
- Register the new language in `src/renderer/i18n.js`
- Add the language to the locale map (used by date-fns) in `src/locale/index.ts`
