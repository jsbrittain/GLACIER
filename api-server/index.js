import express from 'express';
import { Collection } from '../dist/main/collection.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const collection = Collection.getInstance();

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '../dist/renderer')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/renderer/index.html'));
});

const post_response = (res, maybe_promise) => {
  Promise.resolve(maybe_promise)
    .then((data) => res.json(data))
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.message });
    });
};

async function call(fcn, ...args) {
  try {
    const data = await fcn(...args);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: { message: err?.message ?? 'Unknown error' }
    };
  }
}

app.post('/api/create-workflow-instance', async (req, res) =>
  post_response(res, collection.createWorkflowInstance(req.body.workflow_id, req.body.version))
);

app.post('/api/run-workflow', async (req, res) =>
  post_response(
    res,
    call(collection.runWorkflow.bind(collection), req.body.instance, req.body.params, req.body.opts)
  )
);

app.post('/api/list-workflow-instances', async (req, res) =>
  post_response(res, collection.listWorkflowInstances())
);

app.post('/api/get-workflow-instance-logs', async (req, res) =>
  post_response(res, collection.getWorkflowInstanceLogs(req.body.instance, req.body.logType))
);

app.post('/api/get-instance-progress', async (req, res) =>
  post_response(res, collection.getInstanceProgress(req.body.instance))
);

app.post('/api/get-workflow-instance-params', async (req, res) =>
  post_response(res, collection.getWorkflowInstanceParams(req.body.instance))
);

app.post('/api/cancel-workflow-instance', async (req, res) =>
  post_response(res, collection.cancelWorkflowInstance(req.body.instance))
);

app.post('/api/kill-workflow-instance', async (req, res) =>
  post_response(res, collection.killWorkflowInstance(req.body.instance))
);

app.post('/api/delete-workflow-instance', async (req, res) =>
  post_response(res, collection.deleteWorkflowInstance(req.body.instance))
);

app.post('/api/open-results-folder', async (req, res) =>
  post_response(res, collection.openResultsFolder(req.body.instance))
);

app.post('/api/update-workflow-instance-status', async (req, res) =>
  post_response(res, collection.updateWorkflowInstanceStatus(req.body.instance))
);

app.post('/api/open-work-folder', async (req, res) =>
  post_response(res, collection.openWorkFolder(req.body.instance, req.body.workID))
);

app.post('/api/get-work-log', async (req, res) =>
  post_response(res, collection.getWorkLog(req.body.instance, req.body.workID, req.body.logType))
);

app.post('/api/get-available-profiles', async (req, res) =>
  post_response(res, collection.getAvailableProfiles(req.body.instance))
);

app.post('/api/clone-repo', async (req, res) =>
  post_response(res, call(collection.cloneRepo.bind(collection), req.body.repoUrl, req.body.ver))
);

app.post('/api/is-repo-installed', async (req, res) =>
  post_response(
    res,
    call(collection.isRepoInstalled.bind(collection), req.body.repoUrl, req.body.ver)
  )
);

app.post('/api/sync-repo', async (req, res) =>
  post_response(res, collection.syncRepo(req.body.repo))
);

app.post('/api/add-catalogue', async (req, res) =>
  post_response(res, call(collection.addCatalogue.bind(collection), req.body.repoUrl, req.body.ver))
);

app.post('/api/remove-catalogue', async (req, res) =>
  post_response(res, collection.removeCatalogue(req.body.catalogue_name))
);

app.post('/api/remove-catalogue-section', async (req, res) =>
  post_response(
    res,
    collection.removeCatalogueSection(req.body.catalogue_name, req.body.section_name)
  )
);

app.post('/api/remove-catalogue-workflow', async (req, res) =>
  post_response(
    res,
    collection.removeCatalogueWorkflow(
      req.body.catalogue_name,
      req.body.section_name,
      req.body.workflow_name
    )
  )
);

app.post('/api/get-catalogues', async (req, res) =>
  post_response(res, call(collection.getCatalogues.bind(collection)))
);

app.post('/api/add-user-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.addUserWorkflow.bind(collection),
      req.body.name,
      req.body.repoUrl,
      req.body.ver,
      req.body.section
    )
  )
);

app.post('/api/get-collection-repos', async (req, res) =>
  post_response(res, collection.getCollectionRepos())
);

app.post('/api/get-collections-path', async (req, res) =>
  post_response(res, collection.getCollectionsPath())
);

app.post('/api/set-collections-path', async (req, res) =>
  post_response(res, collection.setCollectionsPath(req.body.path))
);

app.post('/api/get-container-logs', async (req, res) =>
  post_response(res, collection.getContainerLogs(req.body.containerId))
);

app.post('/api/stop-container', async (req, res) =>
  post_response(res, collection.stopContainer(req.body.containerId))
);

app.post('/api/delete-repo', async (req, res) =>
  post_response(res, collection.deleteRepo(req.body.repoPath))
);

app.post('/api/get-workflow-params', async (req, res) =>
  post_response(res, collection.getWorkflowParams(req.body.repoPath))
);

app.post('/api/get-workflow-schema', async (req, res) =>
  post_response(res, collection.getWorkflowSchema(req.body.repoPath))
);

app.post('/api/get-installable-repos-list', async (req, res) =>
  post_response(res, collection.getInstallableReposList())
);

app.post('/api/add-installable-repo', async (req, res) =>
  post_response(res, collection.addInstallableRepo(req.body.repoUrl))
);

app.post('/api/get-workflow-readme', async (req, res) =>
  post_response(res, collection.getWorkflowReadme(req.body.instance))
);

app.post('/api/get-workflow-information', async (req, res) =>
  post_response(res, collection.getWorkflowInformation(req.body.instance))
);

app.post('/api/settings-get', async (req, res) =>
  post_response(res, collection.settingsGet(req.body.key))
);

app.post('/api/settings-set', async (req, res) =>
  post_response(res, collection.settingsSet(req.body.key, req.body.value))
);

app.post('/api/open-web-page', async (req, res) =>
  post_response(res, collection.openWebPage(req.body.url))
);

app.post('/api/get-environment-status', async (req, res) =>
  post_response(res, collection.getEnvironmentStatus(req.body.key))
);

app.post('/api/perform-environment-action', async (req, res) =>
  post_response(res, collection.performEnvironmentAction(req.body.key, req.body.action))
);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`✅ API server listening on http://localhost:${PORT}`);
});
