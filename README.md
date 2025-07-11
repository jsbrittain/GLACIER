# IceFlow

## Quick start

To build and run the electron app:

```
npm install
npm start
```

You can also package the app for distribution (the app will be placed in `/dist`):

```
npm run dist
```

## Usage

Within the application:

- Clone the default repository: `jsbrittain/workflow-runner-testworkflow`
- Click the run button on the workflow card to launch the container/workflow

## Web deployment

The application is build using Electron, but this repository also supports web server deployment. To run the web server, run `npm run server` (after building the app). This will serve the electron front-end while providing an API that calls the backend code. The same code is as in the electron app, noting that the API interface must be maintained in-line with Electron's interface (see `src/renderer/services/api.ts`).
