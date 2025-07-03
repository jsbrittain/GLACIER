# Workflow Runner

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

The application is build using Electron, but this repository also supports web server deployment. To run the web server, run `node index.js` from inside the `\api-server` folder. This will serve the electron front-end while providing a backend API that calls the backend code. The same code is used for frontend and backend components, although the API interface must be maintained in-line with Electron's interface.
