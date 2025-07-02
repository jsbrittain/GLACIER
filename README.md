# Workflow Runner

## Quick start

```
npm install
npm start
```

## Usage

Use the default repository:
```
https://github.com/jsbrittain/workflow-runner-testworkflow.git
```

Select a local folder to place the repository (the folder will be created if it does not exist), e.g. `/Users/username/Desktop/testworkflow`.

Select `Clone Repo`.

The path to the Dockerfile will update to the cloned repository path. The assigned image name can be left as `testworkflow` or changed to a custom name.

Select `Build & Run` to build the Docker image and run the container.

Check Docker Desktop logs to see the output of the workflow.

Clicking `List containers` will show the currently running containers. This will probably be empty since the default container runs momentarily and exits. However, you can customise the Dockerfile to run a long-running process to test this feature.
