# Testing

Run `npm test` to execute the unit test suite, which also produces coverage reports.

End-to-end tests are managed by playright, run `npx playwright test` to execute them. This will test both the electron build and the client-server build. You can run playright in UI mode by appending the `--ui` flag.

# Adding backend functionality

Since GLACIER supports both an electron build (where the backend runs in the same process as the frontend) and a client-server build (where the backend runs in a separate server), backend functionality is abstracted through an API layer. Calls from the frontend to the backend are made through either 1) electron's Inter-Process Communication (IPC) mechanism, or 2) an HTTP server request. To add new functionality that can be called from the frontend, you need to do the following:

- Expose an API endpoint in `src/renderer/services/api.ts`. This file redirects requests to either an electron backend (if defined during the build), or produces HTTP requests to a backend server.
- For electron, define the context bridge in `src/electron/preload.ts`. This invokes an IPC call to the main process.
- Define the IPC handler in `src/electron/ipc-handler.ts`. This is where the backend logic can be implemented, but is generally instead used to call the relevant service.
- Most services are defined in a (singleton) `Collection` object (`src/main/collection.ts`), which manages the lifecycle of workflows. You can add a new services here as needed.
- For HTTP, define the service endpoint in `api-server/index.js`, which should call the same service as the IPC handler by invoking the relevant method in the `Collection` object.
